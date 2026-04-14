"use client"

import { useState, useEffect } from "react"

const ASCII_LINES = [
  "██████╗ ██╗     ██╗      ██████╗ ███████╗████████╗",
  "██╔══██╗██║     ██║     ██╔════╝ ██╔════╝╚══██╔══╝",
  "██████╔╝██║     ██║     ██║  ███╗█████╗     ██║   ",
  "██╔══██╗██║     ██║     ██║   ██║██╔══╝     ██║   ",
  "██████╔╝███████╗██║     ╚██████╔╝███████╗   ██║   ",
  "╚═════╝ ╚══════╝╚═╝      ╚═════╝ ╚══════╝   ╚═╝   ",
]

export function Ascii() {
  const [visibleLines, setVisibleLines] = useState<string[]>([])

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    ASCII_LINES.forEach((line, i) => {
      const t = setTimeout(() => {
        setVisibleLines(v => [...v, " " + line])
      }, i * 120)
      timers.push(t)
    })
    return () => timers.forEach(t => clearTimeout(t))
  }, [])

  return (
    <pre
      className="ascii-art max-w-4xl mx-auto pt-4 pb-1 font-mono text-[0.6rem] md:text-base whitespace-pre overflow-x-auto leading-none text-center"
      style={{
        fontFamily: `ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace`,
      }}
    >
      {visibleLines.join("\n")}
    </pre>
  )
}
