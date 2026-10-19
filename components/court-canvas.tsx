"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

import { DESIGN, drawAttacks } from "@/lib/draw-court"
import type { Attack, PlotMode } from "@/lib/types"

type Props = {
  attacks: Attack[]
  mode: PlotMode
  byRotation: boolean
  themeId: string
}

export const CourtCanvas = forwardRef<HTMLCanvasElement, Props>(function CourtCanvas(
  { attacks, mode, byRotation, themeId },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement)

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    const paint = () => {
      const design = byRotation ? DESIGN.rotation : DESIGN.single
      const maxHeight = byRotation ? 840 : Math.min(window.innerHeight * 0.62, 700)
      const widthFromHeight = maxHeight * (design.w / design.h)
      const cssWidth = Math.max(280, Math.min(parent.clientWidth, widthFromHeight))
      const cssHeight = cssWidth * (design.h / design.w)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`
      canvas.width = Math.round(cssWidth * dpr)
      canvas.height = Math.round(cssHeight * dpr)
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.setTransform((cssWidth / design.w) * dpr, 0, 0, (cssHeight / design.h) * dpr, 0, 0)
      drawAttacks(ctx, attacks, mode, byRotation, themeId)
    }

    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [attacks, mode, byRotation, themeId])

  return <canvas ref={canvasRef} className="mx-auto block max-w-full rounded-2xl" />
})
