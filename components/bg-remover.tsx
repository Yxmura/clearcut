"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Logo } from "./logo"
import { UploadArea } from "./upload-area"
import { ResultPanel } from "./result-panel"
import { Progress } from "./ui/progress"
import { Badge } from "./ui/badge"
import { Separator } from "./ui/separator"

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
  const [detectedDevice, setDetectedDevice] = useState<string>('')
  const [result, setResult] = useState<ImageResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pipeRef = useRef<any>(null)
  const preloadRef = useRef(false)
  const progressRef = useRef<{ loaded: number; time: number }[]>([])
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

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
      ;(env as any).allowWasmCache = false

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

      const model = await AutoModel.from_pretrained("briaai/RMBG-1.4", {
        device: "webgpu",
        dtype: "fp16",
        progress_callback: progressCb,
      } as any)

      const processor = await AutoProcessor.from_pretrained("briaai/RMBG-1.4", {
        progress_callback: progressCb,
      } as any)

      pipeRef.current = { model, processor }
      setDetectedDevice("webgpu")
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
    const baseTime = 2.5 + (pixels / 1_000_000) * 1.5
    return Math.max(2, Math.min(20, baseTime))
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

  const isLoading = state === "loading-model" && !pipeRef.current
  const isProcessing = state === "processing"

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <section className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 py-10 md:py-16">
        {isLoading ? (
          <div className="w-full max-w-sm text-center space-y-5 fade-in">
            <div className="flex items-center justify-center gap-2.5">
              <Logo className="w-5 h-5 text-muted-foreground/50" />
              <span className="text-sm font-medium">Loading model</span>
            </div>
            <div className="space-y-2">
              <Progress value={progress} className="h-1.5" indicatorClassName="bg-[var(--accent-color)]" />
              <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                <span>176 MB · RMBG 1.4</span>
                {timeRemaining && <span>{timeRemaining} left</span>}
              </div>
            </div>
          </div>
        ) : state === "idle" ? (
          <div className="w-full max-w-xl">
            <div className="text-center space-y-2 mb-8 fade-in">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Logo className="w-5 h-5 text-foreground/70" />
                <span className="text-sm font-semibold tracking-tight">ClearCut</span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1]">
                Remove any background
              </h1>
              <p className="text-muted-foreground text-[15px] leading-relaxed max-w-sm mx-auto">
                Pixel-perfect results, processed in your browser. Your images never leave your device.
              </p>
            </div>

            <div className="fade-in fade-in-delay-1" style={{ animationFillMode: 'both' }}>
              <UploadArea onFile={processImage} />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 fade-in fade-in-delay-2" style={{ animationFillMode: 'both' }}>
              <Badge variant="outline" className="text-[11px] font-normal border-border/60 text-muted-foreground/70 gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Zero uploads
              </Badge>
              <Badge variant="outline" className="text-[11px] font-normal border-border/60 text-muted-foreground/70 gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                {detectedDevice === 'webgpu' ? '~6s per image' : '~12s per image'}
              </Badge>
              <Badge variant="outline" className="text-[11px] font-normal border-border/60 text-muted-foreground/70 gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                HD PNG output
              </Badge>
            </div>
          </div>
        ) : isProcessing ? (
          <div className="w-full max-w-lg text-center space-y-5 fade-in">
            <div className="relative w-full aspect-[4/3] rounded-2xl border border-border/80 overflow-hidden bg-muted/30">
              {/* Real countdown overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-background/60 backdrop-blur-sm">
                <span className="countdown-number text-7xl md:text-8xl font-bold text-foreground/90">
                  {countdown !== null ? countdown.toFixed(1) : '…'}
                </span>
                <span className="text-sm text-muted-foreground mt-2 font-medium">
                  {countdown !== null && countdown > 0 ? 'seconds remaining' : 'finishing…'}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Removing background…</p>
          </div>
        ) : state === "done" && result ? (
          <div className="w-full max-w-5xl fade-in">
            <ResultPanel result={result} onReset={reset} />
          </div>
        ) : state === "error" ? (
          <div className="w-full max-w-xs text-center space-y-4 fade-in">
            <div className="w-11 h-11 mx-auto rounded-full border border-border flex items-center justify-center text-muted-foreground">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={reset} className="text-sm text-[var(--accent-color)] hover:underline underline-offset-4 font-medium">
              Try again
            </button>
          </div>
        ) : null}
      </section>

      <Separator className="opacity-50" />
      <footer className="px-6 py-2.5 text-center text-[11px] text-muted-foreground/50">
        100% local · No uploads · RMBG 1.4 · {detectedDevice === 'webgpu' ? 'WebGPU' : 'WASM'}
      </footer>
    </main>
  )
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`
}
