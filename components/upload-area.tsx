"use client"

import { useCallback, useRef, useState } from "react"

interface UploadAreaProps {
  onFile: (file: File) => void
}

export function UploadArea({ onFile }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return
    onFile(file)
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [onFile]
  )

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"))
      if (file) handleFile(file)
    },
    [onFile]
  )

  return (
    <div
      role="button"
      tabIndex={0}
      className="cursor-pointer outline-none rounded-xl"
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onPaste={onPaste}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      <div className={`
        border-2 border-dashed rounded-xl text-center transition-colors duration-150 py-12 px-6
        ${isDragging
          ? "border-[var(--accent-color)] bg-[var(--accent-color)]/5"
          : "border-border"
        }
      `}>
        <div className="mb-4 flex justify-center">
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center transition-colors
            ${isDragging ? "bg-[var(--accent-color)]/10 text-[var(--accent-color)]" : "bg-muted text-muted-foreground/60"}
          `}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
        </div>

        <p className="text-[15px] font-medium tracking-tight mb-1">
          {isDragging ? "Drop it here" : "Upload an image"}
        </p>
        <p className="text-muted-foreground text-[13px]">
          Drag, click, or paste from clipboard
        </p>
      </div>
    </div>
  )
}
