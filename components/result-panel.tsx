"use client"

import { useState } from "react"
import type { ImageResult } from "./bg-remover"
import { Comparison, ComparisonItem, ComparisonHandle } from "./comparison-slider"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"

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

  const bgClass = bgStyle === "checker" ? "checkerboard" : bgStyle === "black" ? "bg-black" : "bg-white"

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-[var(--accent-color)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span className="text-sm font-semibold">Background removed</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={download}
            size="sm"
            className="gap-1.5 h-9 px-4"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download PNG
          </Button>
          <Button
            onClick={onReset}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>
            </svg>
            New image
          </Button>
        </div>
      </div>

      {/* Comparison */}
      <div className="relative rounded-xl overflow-hidden border border-border/80 shadow-sm">
        <Comparison className="aspect-[4/3] md:aspect-[16/10]" mode="drag">
          <ComparisonItem position="left" className="bg-card">
            <img src={result.original} alt="Original" className="size-full object-contain" />
          </ComparisonItem>
          <ComparisonItem position="right" className={bgClass}>
            <img src={result.processed} alt="Result" className="size-full object-contain" />
          </ComparisonItem>
          <ComparisonHandle />
        </Comparison>
        <div className="absolute top-3 left-3 text-[10px] uppercase tracking-wider text-black/50 bg-white/80 px-2 py-0.5 rounded-md backdrop-blur-md z-20 pointer-events-none font-semibold">
          Before
        </div>
        <div className="absolute top-3 right-3 text-[10px] uppercase tracking-wider text-black/50 bg-white/80 px-2 py-0.5 rounded-md backdrop-blur-md z-20 pointer-events-none font-semibold">
          After
        </div>
      </div>

      {/* Background toggle - visible as actual buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Background</span>
          <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
            {([
              { value: "checker" as const, label: "Transparent", icon: <CheckerIcon /> },
              { value: "black" as const, label: "Black", icon: <SolidBox className="text-black" /> },
              { value: "white" as const, label: "White", icon: <SolidBox className="text-zinc-300" /> },
            ]).map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setBgStyle(value)}
                title={label}
                className={cn(
                  "flex items-center justify-center w-8 h-7 rounded-md transition-all",
                  bgStyle === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* File info */}
        <span className="text-[11px] text-muted-foreground/50 tabular-nums">
          {result.name}
        </span>
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
      <rect width="14" height="14" rx="2" fill="currentColor" />
    </svg>
  )
}
