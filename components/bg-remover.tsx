"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "./ui/button"
import { Ascii } from "./Ascii"
import { ResultPanel } from "./result-panel"

export type ProcessingState = "idle" | "loading-model" | "processing" | "done" | "error"

export interface ImageResult {
  original: string
  processed: string
  name: string
}

export function BgRemover() {
  const [state, setState] = useState<ProcessingState>("idle")
  const [progress, setProgress] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const [detectedDevice, setDetectedDevice] = useState<string>("")
  const [result, setResult] = useState<ImageResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const pipeRef = useRef<any>(null)
  const preloadRef = useRef(false)
  const progressRef = useRef<{ loaded: number; time: number }[]>([])
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!preloadRef.current) {
      preloadRef.current = true
      loadModel()
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [])

  const loadModel = async () => {
    if (pipeRef.current) return
    setState("loading-model")
    setProgress(0)
    setTimeRemaining(null)
    progressRef.current = []

    try {
      const { AutoModel, AutoProcessor, env } = await import("@huggingface/transformers")
      ;(env as any).allowWasmCache = true
      ;(env as any).backends.onnx.wasm.numThreads = navigator.hardwareConcurrency ?? 4

      const progressCb = (p: any) => {
        if (p.status === "progress" && p.total) {
          const pct = Math.round((p.loaded / p.total) * 100)
          setProgress(pct)
          progressRef.current.push({ loaded: p.loaded, time: Date.now() })
          const samples = progressRef.current.slice(-5)
          if (samples.length >= 2) {
            const first = samples[0]
            const last = samples[samples.length - 1]
            const elapsed = (last.time - first.time) / 1000
            if (elapsed > 0) {
              const speed = (last.loaded - first.loaded) / elapsed
              const remaining = (p.total - p.loaded) / speed
              if (remaining > 0 && remaining < 300) {
                setTimeRemaining(formatTime(remaining))
              }
            }
          }
        }
      }

      let model: any
      let device = "webgpu"

      try {
        model = await AutoModel.from_pretrained("briaai/RMBG-1.4", {
          device: "webgpu",
          dtype: "fp16",
          progress_callback: progressCb,
        } as any)
      } catch {
        console.warn("WebGPU unavailable, falling back to WASM")
        device = "wasm"
        model = await AutoModel.from_pretrained("briaai/RMBG-1.4", {
          device: "wasm",
          dtype: "fp32",
          progress_callback: progressCb,
        } as any)
      }

      const processor = await AutoProcessor.from_pretrained("briaai/RMBG-1.4", {
        progress_callback: progressCb,
      } as any)

      pipeRef.current = { model, processor }
      setDetectedDevice(device)
      setState("idle")
      setTimeRemaining(null)
    } catch (err: any) {
      console.error(err)
      setError(err?.message ?? "Failed to load RMBG-1.4")
      setState("error")
    }
  }

  const estimateProcessingTime = (width: number, height: number): number => {
    const pixels = width * height
    const isWebGPU = detectedDevice === "webgpu"
    const baseTime = isWebGPU
      ? 2.5 + (pixels / 1_000_000) * 1.5
      : 5 + (pixels / 1_000_000) * 3
    return Math.max(isWebGPU ? 2 : 5, Math.min(isWebGPU ? 20 : 35, baseTime))
  }

  const processImage = useCallback(async (file: File) => {
    setError(null)
    setResult(null)
    const originalUrl = URL.createObjectURL(file)

    try {
      if (!pipeRef.current) {
        setState("loading-model")
        while (!pipeRef.current) await new Promise(r => setTimeout(r, 200))
      }

      const { model, processor } = pipeRef.current
      setState("processing")

      const { RawImage } = await import("@huggingface/transformers")
      const image = await RawImage.fromURL(originalUrl)
      const estimatedTime = estimateProcessingTime(image.width, image.height)

      const startTime = Date.now()
      let remaining = estimatedTime
      setCountdown(Math.ceil(remaining))

      countdownRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000
        remaining = Math.max(0, estimatedTime - elapsed)
        setCountdown(Math.ceil(remaining))
      }, 1000)

      const { pixel_values } = await processor(image)
      const { output } = await model({ input: pixel_values })

      if (countdownRef.current) clearInterval(countdownRef.current)
      setCountdown(0)

      const mask = await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(image.width, image.height)
      const canvas = document.createElement("canvas")
      const img = new Image()
      img.crossOrigin = "anonymous"

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext("2d")!
          ctx.drawImage(img, 0, 0)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          for (let i = 0; i < mask.data.length; i++) {
            data[i * 4 + 3] = mask.data[i]
          }
          ctx.putImageData(imageData, 0, 0)
          resolve()
        }
        img.onerror = reject
        img.src = originalUrl
      })

      setResult({
        original: originalUrl,
        processed: canvas.toDataURL("image/png"),
        name: file.name.replace(/\.[^.]+$/, "") + "_nobg.png",
      })
      setState("done")
    } catch (err: any) {
      console.error(err)
      setError(err?.message ?? "Unknown error")
      setState("error")
      URL.revokeObjectURL(originalUrl)
      if (countdownRef.current) clearInterval(countdownRef.current)
      setCountdown(0)
    }
  }, [])

  const reset = () => {
    setState("idle")
    setProgress(0)
    setTimeRemaining(null)
    setCountdown(0)
    setResult(null)
    setError(null)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  const handleFile = (file: File) => {
    if (file.type.startsWith("image/")) processImage(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const isLoading = state === "loading-model" && !pipeRef.current
  const isProcessing = state === "processing"

  return (
    <>
      {/* Dot-grid background */}
      <div className="fixed inset-0 -z-10 h-full w-full bg-grid" />

      {/* Main container */}
      <div className="max-w-[1280px] mx-auto p-8 w-100vw h-100vh text-left">

        {/* Hero / Main window */}
        <section className="flex items-center justify-center py-16">
          <div className="mx-auto w-full max-w-4xl border-black dark:border-white border-2 text-center bg-background">

            {/* Title bar */}
            <div className="bg-foreground text-background px-4 py-2 text-xs flex items-center justify-between border-b-2 border-foreground">
              <span>[CLEAR_CUT.EXE]</span>
              <img src="/minmaxclose.svg" alt="Window controls" className="w-16 h-4 cursor-pointer" />
            </div>

            {/* ASCII art */}
            <Ascii />

            {/* Status text */}
            <div className="text-sm space-y-1 pt-4 pb-4 text-center">
              <p>
                <span className="text-primary mr-2">&gt;</span>
                Remove any background from your images.
              </p>
              <p>
                <span className="text-primary mr-2">&gt;</span>
                {detectedDevice === "webgpu" ? "WebGPU acceleration active." : detectedDevice === "wasm" ? "Running on WASM." : "Detecting runtime..."}
              </p>
            </div>

            {/* Upload / Progress / Result */}
            <div className="px-6 pb-6">
              {isLoading ? (
                <div className="text-left">
                  <p className="text-xs mb-3">&gt; Loading model...</p>
                  <div className="border-2 border-foreground bg-background h-2">
                    <div className="bg-foreground h-full transition-all duration-200" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                    <span>176 MB · RMBG 1.4</span>
                    {timeRemaining && <span>{timeRemaining} left</span>}
                  </div>
                </div>
              ) : isProcessing ? (
                <div className="text-left space-y-3">
                  <p className="text-xs">&gt; Removing background...</p>
                  <div className="border-2 border-foreground p-8 text-center">
                    <span className="countdown-number text-5xl font-bold">
                      {countdown.toFixed(1)}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-2">seconds remaining</p>
                  </div>
                </div>
              ) : state === "done" && result ? (
                <ResultPanel result={result} onReset={reset} />
              ) : state === "error" ? (
                <div className="text-left space-y-3">
                  <div className="border-2 border-foreground p-6">
                    <p className="text-[10px] text-muted-foreground mb-2">&gt; ERROR:</p>
                    <p className="text-xs mb-4">{error}</p>
                    <Button onClick={reset} variant="ghost">RETRY</Button>
                  </div>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed border-foreground p-8 text-center cursor-pointer transition-all ${
                    isDragging ? "bg-muted border-solid" : "bg-background"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFile(file)
                    }}
                  />
                  <p className="text-xs mb-2">&gt; DROP IMAGE HERE</p>
                  <p className="text-[10px] text-muted-foreground">or click to browse · PNG, JPG, WEBP</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Info boxes */}
        {state === "idle" && (
          <section className="grid md:grid-cols-3 gap-4 pb-16 fade-in fade-in-delay-1">
            {[
              { title: "[SECURITY.INI]", line1: "> Zero uploads", line2: "All processing happens locally. Images never touch a server." },
              { title: "[SPEED.CFG]", line1: `> ${detectedDevice === "webgpu" ? "~5s per image" : detectedDevice === "wasm" ? "~10s per image" : "~5s per image"}`, line2: "Powered by RMBG 1.4 AI acceleration." },
              { title: "[OUTPUT.FMT]", line1: "> HD PNG output", line2: "Lossless PNG with transparency mask. Ready for any use case." },
            ].map(({ title, line1, line2 }) => (
              <div key={title} className="border-2 border-foreground bg-background">
                <div className="bg-foreground text-background px-4 py-2 text-xs flex items-center justify-between">
                  <span>{title}</span>
                  <img src="/minmaxclose.svg" alt="Window controls" className="w-16 h-4" />
                </div>
                <div className="p-4 space-y-2">
                  <p className="text-[10px] text-muted-foreground">{line1}</p>
                  <p className="text-xs">{line2}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Footer */}
        <footer className="border-t-2 border-foreground pt-6 pb-8 flex justify-between items-center">
          <p className="text-[10px] text-muted-foreground">
            © {new Date().getFullYear()} ClearCut · RMBG 1.4 · {detectedDevice === "webgpu" ? "WebGPU" : detectedDevice === "wasm" ? "WASM" : "..."}
          </p>
          <p className="text-[10px] text-muted-foreground">100% local · No uploads</p>
        </footer>
      </div>
    </>
  )
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`
}
