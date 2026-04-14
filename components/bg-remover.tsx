"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const isLoading = state === "loading-model" && !pipeRef.current
  const isProcessing = state === "processing"

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Dot-grid background */}
      <div className="fixed inset-0 -z-10 h-full w-full bg-grid" />

      {/* Main container */}
      <div className="max-w-4xl mx-auto p-8">

        {/* Hero section */}
        <section className="py-16">
          <div className="window-box">
            {/* Title bar */}
            <div className="window-titlebar">
              <span>[CLEAR_CUT.EXE]</span>
              <svg width="64" height="16" viewBox="0 0 64 16" fill="none" className="opacity-70">
                <rect x="0" y="0" width="16" height="16" fill="currentColor"/>
                <rect x="24" y="0" width="16" height="16" fill="currentColor"/>
                <rect x="48" y="0" width="16" height="16" fill="currentColor"/>
              </svg>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Terminal header */}
              <div className="mb-6 space-y-1">
                <p className="text-xs text-muted-foreground">&gt; Remove any background from your images.</p>
                <p className="text-xs text-muted-foreground">&gt; 100% local AI — nothing leaves your browser.</p>
                <p className="text-xs text-muted-foreground">&gt; {detectedDevice === "webgpu" ? "WebGPU acceleration active." : detectedDevice === "wasm" ? "Running on WASM." : "Detecting runtime..."}</p>
              </div>

              {/* Upload area */}
              {isLoading ? (
                <div className="space-y-4 fade-in">
                  <p className="text-xs">&gt; Loading model...</p>
                  <div className="progress-bar w-full">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>176 MB · RMBG 1.4</span>
                    {timeRemaining && <span>{timeRemaining} left</span>}
                  </div>
                </div>
              ) : isProcessing ? (
                <div className="space-y-4 fade-in">
                  <p className="text-xs">&gt; Processing image...</p>
                  <div className="border-2 border-foreground p-6 text-center">
                    <span className="countdown-number text-5xl font-bold">
                      {countdown.toFixed(1)}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-2">seconds remaining</p>
                  </div>
                </div>
              ) : state === "done" && result ? (
                <ResultPanel result={result} onReset={reset} />
              ) : state === "error" ? (
                <div className="space-y-4 fade-in">
                  <div className="border-2 border-foreground p-6">
                    <p className="text-xs text-muted-foreground mb-4">&gt; ERROR:</p>
                    <p className="text-xs mb-4">{error}</p>
                    <button onClick={reset} className="btn-primary">RETRY</button>
                  </div>
                </div>
              ) : (
                <div
                  className={`upload-zone ${isDragging ? "border-solid bg-muted" : ""}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
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
            <div className="window-box">
              <div className="window-titlebar">
                <span>[SECURITY.INI]</span>
                <svg width="64" height="16" viewBox="0 0 64 16" fill="none" className="opacity-70">
                  <rect x="0" y="0" width="16" height="16" fill="currentColor"/>
                  <rect x="24" y="0" width="16" height="16" fill="currentColor"/>
                  <rect x="48" y="0" width="16" height="16" fill="currentColor"/>
                </svg>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-[10px] text-muted-foreground">&gt; Zero uploads</p>
                <p className="text-xs">All processing happens locally in your browser. Your images never touch a server.</p>
              </div>
            </div>

            <div className="window-box">
              <div className="window-titlebar">
                <span>[SPEED.CFG]</span>
                <svg width="64" height="16" viewBox="0 0 64 16" fill="none" className="opacity-70">
                  <rect x="0" y="0" width="16" height="16" fill="currentColor"/>
                  <rect x="24" y="0" width="16" height="16" fill="currentColor"/>
                  <rect x="48" y="0" width="16" height="16" fill="currentColor"/>
                </svg>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-[10px] text-muted-foreground">&gt; {detectedDevice === "webgpu" ? "~5s per image" : detectedDevice === "wasm" ? "~10s per image" : "~5s per image"}</p>
                <p className="text-xs">Powered by {detectedDevice === "webgpu" ? "WebGPU" : detectedDevice === "wasm" ? "WASM" : "RMBG 1.4"} AI acceleration.</p>
              </div>
            </div>

            <div className="window-box">
              <div className="window-titlebar">
                <span>[OUTPUT.FMT]</span>
                <svg width="64" height="16" viewBox="0 0 64 16" fill="none" className="opacity-70">
                  <rect x="0" y="0" width="16" height="16" fill="currentColor"/>
                  <rect x="24" y="0" width="16" height="16" fill="currentColor"/>
                  <rect x="48" y="0" width="16" height="16" fill="currentColor"/>
                </svg>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-[10px] text-muted-foreground">&gt; HD PNG output</p>
                <p className="text-xs">Lossless PNG with transparency mask. Ready for any use case.</p>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t-2 border-foreground pt-6 pb-8 flex justify-between items-center">
          <p className="text-[10px] text-muted-foreground">
            © 2026 ClearCut · RMBG 1.4 · {detectedDevice === "webgpu" ? "WebGPU" : detectedDevice === "wasm" ? "WASM" : "..."}
          </p>
          <p className="text-[10px] text-muted-foreground">
            100% local · No uploads
          </p>
        </footer>
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`
}
