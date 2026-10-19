import { courtById, type CourtTheme } from "@/lib/courts"
import {
  HEAT_BW,
  HEAT_NX,
  HEAT_NY,
  buildLayout,
  designPoint,
  heatColor,
  splatDensity,
  type ChartLayout,
} from "@/lib/court-geom"
import type { Attack, GroupMode, PlotMode, Skill } from "@/lib/types"

export { buildLayout, columnCount } from "@/lib/court-geom"
export type { ChartLayout } from "@/lib/court-geom"

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function paintTexture(
  ctx: CanvasRenderingContext2D,
  theme: CourtTheme,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (theme.texture === "wood") {
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 === 0 ? "rgba(90,48,18,0.08)" : "rgba(255,236,210,0.08)"
      ctx.fillRect(x, y + (h / 14) * i, w, h / 14)
    }
    ctx.restore()
  }
  if (theme.texture === "sand") {
    ctx.save()
    ctx.fillStyle = "rgba(255,248,230,0.28)"
    ctx.beginPath()
    ctx.ellipse(x + w * 0.3, y + h * 0.35, w * 0.28, h * 0.12, -0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "rgba(180,130,60,0.12)"
    ctx.beginPath()
    ctx.ellipse(x + w * 0.7, y + h * 0.62, w * 0.22, h * 0.1, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function courtInk(theme: CourtTheme) {
  if (theme.id === "scout") {
    return { title: "#161616", label: "#8d8d8d", border: "#161616", grid: "#c5c5c5" }
  }
  return { title: theme.caption, label: theme.caption, border: theme.line, grid: theme.line }
}

function drawSurface(
  ctx: CanvasRenderingContext2D,
  theme: CourtTheme,
  ox: number,
  oy: number,
  scale: number,
  inkOnly: boolean,
) {
  const px = (x: number) => ox + x * scale
  const py = (y: number) => oy + (7 - y) * scale
  const x0 = px(0.5)
  const x1 = px(3.5)
  const yTop = py(6.5)
  const yBot = py(0.5)
  const yNet = py(3.5)
  const ink = courtInk(theme)

  ctx.save()
  if (!inkOnly) {
    ctx.fillStyle = theme.surround
    ctx.fillRect(px(0), py(7), 4 * scale, 7 * scale)
    ctx.fillStyle = theme.floor
    ctx.fillRect(x0, yTop, x1 - x0, yBot - yTop)
    if (theme.attackLine && theme.front !== theme.floor) {
      ctx.fillStyle = theme.front
      ctx.fillRect(x0, py(4.5), x1 - x0, yNet - py(4.5))
      ctx.fillRect(x0, yNet, x1 - x0, py(2.5) - yNet)
    }
    paintTexture(ctx, theme, x0, yTop, x1 - x0, yBot - yTop)
  } else {
    ctx.strokeStyle = ink.grid
    ctx.lineWidth = Math.max(0.8, scale * 0.012)
    ctx.beginPath()
    if (theme.attackLine) {
      ctx.moveTo(x0, py(4.5))
      ctx.lineTo(x1, py(4.5))
      ctx.moveTo(x0, py(2.5))
      ctx.lineTo(x1, py(2.5))
    }
    if (theme.zoneGrid) {
      ctx.moveTo(px(1.5), yTop)
      ctx.lineTo(px(1.5), yBot)
      ctx.moveTo(px(2.5), yTop)
      ctx.lineTo(px(2.5), yBot)
      ctx.moveTo(x0, py(5.5))
      ctx.lineTo(x1, py(5.5))
      ctx.moveTo(x0, py(1.5))
      ctx.lineTo(x1, py(1.5))
    }
    ctx.stroke()

    ctx.strokeStyle = ink.border
    ctx.lineWidth = Math.max(1.25, scale * 0.02)
    ctx.strokeRect(x0, yTop, x1 - x0, yBot - yTop)

    ctx.strokeStyle = theme.net
    ctx.lineWidth = Math.max(3.4, scale * 0.078)
    ctx.lineCap = "butt"
    ctx.beginPath()
    ctx.moveTo(px(0.36), yNet)
    ctx.lineTo(px(3.64), yNet)
    ctx.stroke()
    if (theme.netTape !== theme.net) {
      ctx.strokeStyle = theme.netTape
      ctx.lineWidth = Math.max(1, scale * 0.014)
      ctx.beginPath()
      ctx.moveTo(px(0.36), yNet)
      ctx.lineTo(px(3.64), yNet)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawHeat(
  ctx: CanvasRenderingContext2D,
  attacks: Attack[],
  ox: number,
  oy: number,
  scale: number,
) {
  const points = attacks.filter((attack) => attack.endMeasured !== false).map((attack) => ({ x: attack.ex, y: attack.ey }))
  if (points.length === 0) return
  const grid = splatDensity(points, HEAT_BW, HEAT_NX, HEAT_NY)
  let max = 0
  for (let i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i]
  if (max <= 0) return

  const off = document.createElement("canvas")
  off.width = HEAT_NX
  off.height = HEAT_NY
  const octx = off.getContext("2d")
  if (!octx) return
  const image = octx.createImageData(HEAT_NX, HEAT_NY)
  for (let j = 0; j < HEAT_NY; j++) {
    const row = HEAT_NY - 1 - j
    for (let i = 0; i < HEAT_NX; i++) {
      const color = heatColor(grid[j * HEAT_NX + i] / max)
      if (!color) continue
      const pixel = (row * HEAT_NX + i) * 4
      image.data[pixel] = color[0]
      image.data[pixel + 1] = color[1]
      image.data[pixel + 2] = color[2]
      image.data[pixel + 3] = color[3]
    }
  }
  octx.putImageData(image, 0, 0)

  const top = designPoint(ox, oy, scale, 0, 7)
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox - 14, oy - 14, 4 * scale + 28, 7 * scale + 28)
  ctx.clip()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(off, top.px, top.py, 4 * scale, 7 * scale)
  ctx.restore()
}

function drawDirections(
  ctx: CanvasRenderingContext2D,
  attacks: Attack[],
  ox: number,
  oy: number,
  scale: number,
  withLines: boolean,
  heatStarts: boolean,
) {
  const alpha = attacks.length > 24 ? 0.42 : attacks.length > 12 ? 0.62 : 0.82
  const width = Math.max(1.15, scale * 0.02)
  const radius = Math.max(2.7, scale * 0.058)

  const marker = (x: number, y: number, filled: boolean, color: string) => {
    const point = designPoint(ox, oy, scale, x, y)
    ctx.beginPath()
    ctx.arc(point.px, point.py, radius, 0, Math.PI * 2)
    if (filled) {
      ctx.fillStyle = color
      ctx.fill()
    } else {
      ctx.lineWidth = Math.max(1.25, scale * 0.022)
      ctx.strokeStyle = color
      ctx.stroke()
    }
  }

  if (withLines) {
    ctx.save()
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = `rgba(72, 72, 72, ${alpha})`
    ctx.lineWidth = width
    for (const attack of attacks) {
      const start = designPoint(ox, oy, scale, attack.sx, attack.sy)
      const end = designPoint(ox, oy, scale, attack.ex, attack.ey)
      const measured = attack.endMeasured !== false
      ctx.setLineDash(measured ? [] : [Math.max(3, scale * 0.06), Math.max(2.5, scale * 0.045)])
      ctx.beginPath()
      ctx.moveTo(start.px, start.py)
      if (
        measured &&
        attack.mx != null &&
        attack.my != null &&
        Math.hypot(attack.mx - attack.sx, attack.my - attack.sy) > 0.08 &&
        Math.hypot(attack.ex - attack.mx, attack.ey - attack.my) > 0.08
      ) {
        const mid = designPoint(ox, oy, scale, attack.mx, attack.my)
        ctx.lineTo(mid.px, mid.py)
      }
      ctx.lineTo(end.px, end.py)
      ctx.stroke()
    }
    ctx.restore()
  }

  for (const attack of attacks) {
    if (heatStarts && !withLines) {
      marker(attack.sx, attack.sy, attack.startMeasured !== false, "#e10600")
      continue
    }
    if (!withLines) continue
    const dot = "rgba(28, 28, 28, 0.92)"
    marker(attack.sx, attack.sy, attack.startMeasured !== false, dot)
    marker(attack.ex, attack.ey, attack.endMeasured !== false, dot)
  }
}

function paintFrame(ctx: CanvasRenderingContext2D, theme: CourtTheme, w: number, h: number) {
  ctx.clearRect(0, 0, w, h)
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, theme.frame[0])
  grad.addColorStop(1, theme.frame[1])
  roundRect(ctx, 0, 0, w, h, 18)
  ctx.fillStyle = grad
  ctx.fill()
}

export function drawAttacks(
  ctx: CanvasRenderingContext2D,
  attacks: Attack[],
  mode: PlotMode,
  group: GroupMode,
  themeId: string,
  title: string,
  columns: number,
  fontFamily: string,
  skill: Skill = "attack",
) {
  const theme = courtById(themeId)
  const layout = buildLayout(attacks, group, columns, title, skill)
  const ink = courtInk(theme)
  paintFrame(ctx, theme, layout.w, layout.h)

  ctx.save()
  ctx.fillStyle = ink.title
  ctx.font = `700 22px ${fontFamily}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.direction = "ltr"
  ctx.fillText(layout.title, layout.w / 2, 24)
  ctx.restore()

  for (const panel of layout.panels) {
    const bleed = 10
    ctx.save()
    ctx.beginPath()
    ctx.rect(panel.ox - bleed, panel.oy - bleed, 4 * layout.scale + bleed * 2, 7 * layout.scale + bleed * 2)
    ctx.clip()
    drawSurface(ctx, theme, panel.ox, panel.oy, layout.scale, false)
    if (mode !== "lines") drawHeat(ctx, panel.attacks, panel.ox, panel.oy, layout.scale)
    drawSurface(ctx, theme, panel.ox, panel.oy, layout.scale, true)
    drawDirections(ctx, panel.attacks, panel.ox, panel.oy, layout.scale, mode !== "heatmap", mode === "heatmap")
    ctx.restore()
    const centerX = panel.ox + 2 * layout.scale
    if (panel.label) {
      ctx.save()
      ctx.fillStyle = ink.label
      ctx.font = `600 14px ${fontFamily}`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.direction = /[\u0600-\u06FF]/.test(panel.label) ? "rtl" : "ltr"
      ctx.fillText(panel.label, centerX, panel.oy - 12)
      ctx.restore()
    }
    ctx.save()
    ctx.fillStyle = ink.label
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.direction = "rtl"
    const captionWidth = 4 * layout.scale - 8
    let captionSize = 12
    ctx.font = `500 ${captionSize}px ${fontFamily}`
    while (captionSize > 8 && ctx.measureText(panel.summary).width > captionWidth) {
      captionSize -= 0.5
      ctx.font = `500 ${captionSize}px ${fontFamily}`
    }
    ctx.fillText(panel.summary, centerX, panel.oy + 7 * layout.scale + 14)
    ctx.restore()
  }

  return layout
}

export function chartCssSize(parentWidth: number, layout: ChartLayout, group: GroupMode) {
  const panelDesign = layout.scale * 4
  const maxPanel = group === "court" ? 280 : 176
  const panelIfFull = panelDesign * (parentWidth / layout.w)
  const cssWidth = Math.max(220, Math.min(parentWidth, panelIfFull > maxPanel ? (maxPanel / panelDesign) * layout.w : parentWidth))
  return { cssWidth, cssHeight: cssWidth * (layout.h / layout.w) }
}
