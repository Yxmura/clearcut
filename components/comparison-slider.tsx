"use client"

import { GripVertical } from "lucide-react"
import { motion, useMotionValue, useSpring, useTransform } from "motion/react"
import { createContext, type HTMLAttributes, type MouseEventHandler, type TouchEventHandler, useContext, useState } from "react"
import { cn } from "@/lib/utils"

interface Ctx {
  motionSliderPosition: ReturnType<typeof useMotionValue<number>>
}

const Ctx = createContext<Ctx | undefined>(undefined)
const use = () => { const c = useContext(Ctx); if (!c) throw new Error(); return c }

export function Comparison({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const [dragging, setDragging] = useState(false)
  const mv = useMotionValue(50)

  const drag = (rect: DOMRect, x: number) => {
    if (!dragging) return
    mv.set(Math.min(Math.max(((x - rect.left) / rect.width) * 100, 0), 100))
  }

  return (
    <Ctx.Provider value={{ motionSliderPosition: mv }}>
      <div
        className={cn("relative w-full select-none overflow-hidden", className)}
        onMouseDown={() => setDragging(true)}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onMouseMove={(e) => drag(e.currentTarget.getBoundingClientRect(), e.clientX)}
        onTouchMove={(e) => drag(e.currentTarget.getBoundingClientRect(), e.touches[0]?.clientX ?? 0)}
        onTouchStart={() => setDragging(true)}
        onTouchEnd={() => setDragging(false)}
        {...props}
      >
        {children}
      </div>
    </Ctx.Provider>
  )
}

export function ComparisonItem({ className, position, ...props }: HTMLAttributes<HTMLDivElement> & { position: "left" | "right" }) {
  const { motionSliderPosition } = use()
  const clip = useTransform(motionSliderPosition, (v) =>
    position === "left" ? `inset(0 ${100 - v}% 0 0)` : `inset(0 0 0 ${v}%)`
  )
  return <motion.div className={cn("absolute inset-0 size-full object-cover", className)} style={{ clipPath: clip }} {...(props as any)} />
}

export function ComparisonHandle({ className }: { className?: string }) {
  const { motionSliderPosition } = use()
  const left = useTransform(motionSliderPosition, (v) => `${v}%`)
  return (
    <motion.div
      className={cn("absolute top-0 z-10 flex h-full w-9 -translate-x-1/2 items-center justify-center cursor-ew-resize", className)}
      style={{ left }}
    >
      <div className="flex flex-col items-center">
        <div className="h-full w-[1px] bg-black/10" />
        <div className="flex items-center justify-center rounded-full bg-white shadow-lg border border-border/60 p-1.5 -my-1">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/70" />
        </div>
        <div className="h-full w-[1px] bg-black/10" />
      </div>
    </motion.div>
  )
}
