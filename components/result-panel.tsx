"use client"

import { useState } from "react"
import type { ImageResult } from "./bg-remover"
import { Button } from "./ui/button"
import { Comparison, ComparisonItem, ComparisonHandle } from "./comparison-slider"

interface ResultPanelProps {
  result: ImageResult
  onReset: () => void
}

export function ResultPanel({ result, onReset }: ResultPanelProps) {
  const [bgStyle, setBgStyle] = useState<"checker" | "black" | "white">("checker")

  const download = () => {
    const a = document.createElement("a")
    a.href = result.processed
    a.download = result.name
    a.click()
  }

  return (
    <div className="space-y-4 text-left fade-in">
      <div className="border-2 border-foreground bg-background">
        <div className="bg-foreground text-background px-4 py-2 text-xs flex items-center justify-between border-b-2 border-foreground">
          <span>[RESULT.PNG]</span>
          <img src="/minmaxclose.svg" alt="Window controls" className="w-16 h-4" />
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-3">
            <Button onClick={download}>[DOWNLOAD PNG]</Button>
            <Button onClick={onReset}>[NEW IMAGE]</Button>
          </div>

          <div className="relative border-2 border-foreground overflow-hidden">
            <Comparison className="w-full aspect-[4/3]">
              <ComparisonItem position="left">
                <img src={result.original} alt="Original" className="size-full object-contain" />
              </ComparisonItem>
              <ComparisonItem
                position="right"
                className={
                  bgStyle === "checker"
                    ? "checkerboard"
                    : bgStyle === "black"
                    ? "bg-black"
                    : "bg-white"
                }
              >
                <img src={result.processed} alt="Result" className="size-full object-contain" />
              </ComparisonItem>
              <ComparisonHandle />
            </Comparison>

            <div className="absolute top-2 left-2 z-10">
              <span className="text-[10px] px-2 py-0.5 bg-background border-2 border-foreground">
                BEFORE
              </span>
            </div>
            <div className="absolute top-2 right-2 z-10">
              <span className="text-[10px] px-2 py-0.5 bg-background border-2 border-foreground">
                AFTER
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">BG:</span>
              <div className="flex gap-1">
                {([
                  { value: "checker" as const, icon: <CheckerIcon /> },
                  { value: "black" as const, icon: <SolidBox className="text-black" /> },
                  { value: "white" as const, icon: <SolidBox className="text-zinc-300" /> },
                ]).map(({ value, icon }) => (
                  <button
                    key={value}
                    onClick={() => setBgStyle(value)}
                    className={`flex items-center justify-center w-8 h-7 border-2 border-foreground transition-all ${
                      bgStyle === value
                        ? "bg-foreground text-background"
                        : "bg-background"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">{result.name}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="0" y="0" width="7" height="7" fill="currentColor" opacity="0.3" />
      <rect x="7" y="7" width="7" height="7" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

function SolidBox({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={className}>
      <rect width="14" height="14" fill="currentColor" />
    </svg>
  )
}