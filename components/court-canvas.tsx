"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

import { buildLayout, chartCssSize, columnCount, drawAttacks } from "@/lib/draw-court"
import type { Attack, GroupMode, PlotMode, Skill } from "@/lib/types"

type Props = {
  attacks: Attack[]
  mode: PlotMode
  group: GroupMode
  themeId: string
  title: string
  skill: Skill
}

export const CourtCanvas = forwardRef<HTMLCanvasElement, Props>(function CourtCanvas(
  { attacks, mode, group, themeId, title, skill },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement)

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    const paint = () => {
      const columns = columnCount(parent.clientWidth, group)
      const layout = buildLayout(attacks, group, columns, title, skill)
      const { cssWidth, cssHeight } = chartCssSize(parent.clientWidth, layout, group)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`
      canvas.width = Math.round(cssWidth * dpr)
      canvas.height = Math.round(cssHeight * dpr)
      canvas.dataset.layout = JSON.stringify({
        w: layout.w,
        h: layout.h,
        scale: layout.scale,
        columns: layout.columns,
          panels: layout.panels.map((panel) => ({
          label: panel.label,
          ox: panel.ox,
          oy: panel.oy,
          n: panel.attacks.length,
          summary: panel.summary,
        })),
      })
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.setTransform((cssWidth / layout.w) * dpr, 0, 0, (cssHeight / layout.h) * dpr, 0, 0)
      const family = getComputedStyle(document.body).fontFamily || "sans-serif"
      drawAttacks(ctx, attacks, mode, group, themeId, title, columns, family, skill)
    }

    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(parent)
    window.addEventListener("resize", paint)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", paint)
    }
  }, [attacks, mode, group, themeId, title, skill])

  return <canvas ref={canvasRef} className="mx-auto block max-w-full rounded-2xl" />
})
