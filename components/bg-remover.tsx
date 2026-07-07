"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import Ascii from "./Ascii";
import { ResultPanel } from "./result-panel";
import Navbar from "./Navbar";

export type ProcessingState =
  | "idle"
  | "loading-model"
  | "processing"
  | "done"
  | "error";

export interface ImageResult {
  original: string;
  processed: string;
  name: string;
}

const MODEL_ID = "yamura4/RMBG-2.0-ONNX";
const MODEL_SIZE_MB = 490;

export function BgRemover() {
  const [state, setState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [detectedDevice, setDetectedDevice] = useState<string>("");
  const [result, setResult] = useState<ImageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const pipeRef = useRef<any>(null);
  const preloadRef = useRef(false);
  const progressRef = useRef<{ loaded: number; time: number }[]>([]);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!preloadRef.current) {
      preloadRef.current = true;
      loadModel();
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const loadModel = async () => {
    if (pipeRef.current) return;
    setState("loading-model");
    setProgress(0);
    setTimeRemaining(null);
    progressRef.current = [];

    try {
      const { AutoModel, AutoProcessor, env } =
        await import("@huggingface/transformers");
      (env as any).allowWasmCache = true;
      (env as any).backends.onnx.wasm.numThreads =
        navigator.hardwareConcurrency ?? 4;

      const progressCb = (p: any) => {
        if (p.status === "progress" && p.total) {
          const pct = Math.round((p.loaded / p.total) * 100);
          setProgress(pct);
          progressRef.current.push({ loaded: p.loaded, time: Date.now() });
          const samples = progressRef.current.slice(-5);
          if (samples.length >= 2) {
            const first = samples[0];
            const last = samples[samples.length - 1];
            const elapsed = (last.time - first.time) / 1000;
            if (elapsed > 0) {
              const speed = (last.loaded - first.loaded) / elapsed;
              const remaining = (p.total - p.loaded) / speed;
              if (remaining > 0 && remaining < 300) {
                setTimeRemaining(formatTime(remaining));
              }
            }
          }
        }
      };

      let model: any;
      let device = "webgpu";

      try {
        model = await AutoModel.from_pretrained(MODEL_ID, {
          device: "webgpu",
          dtype: "fp16",
          progress_callback: progressCb,
        } as any);
      } catch {
        console.warn("WebGPU unavailable, falling back to WASM");
        device = "wasm";
        (env as any).backends.onnx.wasm.proxy = false;
        model = await AutoModel.from_pretrained(MODEL_ID, {
          device: "wasm",
          dtype: "fp16",
          progress_callback: progressCb,
        } as any);
      }

      const processor = await AutoProcessor.from_pretrained(MODEL_ID, {
        progress_callback: progressCb,
      } as any);

      pipeRef.current = { model, processor };
      setDetectedDevice(device);
      setState("idle");
      setTimeRemaining(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to load RMBG-2.0");
      setState("error");
    }
  };

  const estimateProcessingTime = (width: number, height: number): number => {
    const pixels = width * height;
    const isWebGPU = detectedDevice === "webgpu";
    const adjustedPixels = Math.max(pixels, 1024 * 1024);
    const baseTime = isWebGPU
      ? 1.5 + (adjustedPixels / 1_000_000) * 1.2
      : 4 + (adjustedPixels / 1_000_000) * 2.5;
    return Math.max(isWebGPU ? 1.5 : 4, Math.min(isWebGPU ? 15 : 30, baseTime));
  };

  const processImage = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    const originalUrl = URL.createObjectURL(file);

    try {
      if (!pipeRef.current) {
        setState("loading-model");
        while (!pipeRef.current) await new Promise((r) => setTimeout(r, 200));
      }

      const { model, processor } = pipeRef.current;
      setState("processing");

      const { RawImage } = await import("@huggingface/transformers");
      const image = await RawImage.fromURL(originalUrl);
      const estimatedTime = estimateProcessingTime(image.width, image.height);

      const startTime = Date.now();
      let remaining = estimatedTime;
      setCountdown(Math.ceil(remaining));

      countdownRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        remaining = Math.max(0, estimatedTime - elapsed);
        setCountdown(Math.ceil(remaining));
      }, 1000);

      const { pixel_values } = await processor(image);
      const { alphas } = await model({ pixel_values });

      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(0);

      const mask = await RawImage.fromTensor(
        alphas[0].mul(255).to("uint8"),
      ).resize(image.width, image.height);
      const canvas = document.createElement("canvas");
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < mask.data.length; i++) {
            data[i * 4 + 3] = mask.data[i];
          }
          ctx.putImageData(imageData, 0, 0);
          resolve();
        };
        img.onerror = reject;
        img.src = originalUrl;
      });

      setResult({
        original: originalUrl,
        processed: canvas.toDataURL("image/png"),
        name: file.name.replace(/\.[^.]+$/, "") + "_nobg.png",
      });
      setState("done");
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Unknown error");
      setState("error");
      URL.revokeObjectURL(originalUrl);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(0);
    }
  }, []);

  const reset = () => {
    setState("idle");
    setProgress(0);
    setTimeRemaining(null);
    setCountdown(0);
    setResult(null);
    setError(null);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const handleFile = (file: File) => {
    if (file.type.startsWith("image/")) processImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const isLoading = state === "loading-model" && !pipeRef.current;
  const isProcessing = state === "processing";

  return (
    <>
      <div className="fixed inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[14px_24px]"></div>
      <div className="max-w-7xl mx-auto p-8 w-100vw h-100vh text-left scroll-smooth selection:bg-accent selection:text-white">
        <section className="flex items-center justify-center py-16">
          <div className="mx-auto w-full max-w-4xl border-black border-2 text-center bg-background">
            <Navbar currentLang="en" currentPage="home" />
            <Ascii />
            <div className="text-sm space-y-2 pt-4 text-center">
              <p>
                <span className="text-primary  mr-2">&gt;</span>
                AI BACKGROUND REMOVAL
              </p>
              <p>
                <span className="text-primary  mr-2">&gt;</span>
                100% LOCAL - NO SERVER UPLOADS
              </p>
            </div>
            <div className="pt-4 md:flex grid justify-center pb-4 gap-4 flex-none">
              <Button>[DROP IMAGE]</Button>
            </div>
            <div className="px-6 pb-6">
              {isLoading ? (
                <div className="text-left">
                  <p className="text-xs mb-3">&gt; Loading model...</p>
                  <div className="border-2 border-foreground bg-background h-2">
                    <div
                      className="bg-foreground h-full transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                    <span>{MODEL_SIZE_MB} MB - RMBG 2.0</span>
                    {timeRemaining && <span>{timeRemaining} left</span>}
                  </div>
                </div>
              ) : isProcessing ? (
                <div className="text-left space-y-3">
                  <p className="text-xs">&gt; Processing image...</p>
                  <div className="border-2 border-foreground p-8 text-center">
                    <span className="countdown-number text-5xl font-bold">
                      {countdown.toFixed(1)}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      seconds remaining
                    </p>
                  </div>
                </div>
              ) : state === "done" && result ? (
                <ResultPanel result={result} onReset={reset} />
              ) : state === "error" ? (
                <div className="text-left space-y-3">
                  <div className="border-2 border-foreground p-6">
                    <p className="text-[10px] text-muted-foreground mb-2">
                      &gt; ERROR:
                    </p>
                    <p className="text-xs mb-4">{error}</p>
                    <Button onClick={reset}>[RETRY]</Button>
                  </div>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed border-foreground p-8 text-center cursor-pointer transition-all ${isDragging ? "bg-muted border-solid" : "bg-background"}`}
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                  <p className="text-xs mb-2">&gt; DROP IMAGE HERE</p>
                  <p className="text-[10px] text-muted-foreground">
                    or click to browse - PNG, JPG, WEBP
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
        <footer className="border-t-2 border-foreground pt-6 pb-8 flex justify-between items-center">
          <p className="text-[10px] text-muted-foreground">
            &copy; {new Date().getFullYear()} ClearCut
          </p>
          <p className="text-[10px] text-muted-foreground">
            RMBG 2.0 -{" "}
            {detectedDevice === "webgpu"
              ? "WebGPU"
              : detectedDevice === "wasm"
                ? "WASM"
                : "..."}
          </p>
        </footer>
      </div>
    </>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
}
