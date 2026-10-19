import { courtById, type CourtTheme } from "@/lib/courts"
import type { Attack, PlotMode } from "@/lib/types"

export const DESIGN = { single: { w: 460, h: 760 }, rotation: { w: 1080, h: 780 } }

const ROTATION_ORDER = [1, 6, 5, 4, 3, 2]

const EVAL_COLOR: Record<string, string> = {
  "#": "#f2c14e",
  "+": "#7dcea0",
  "!": "#85c1e9",
  "-": "#d5d8dc",
  "/": "#5dade2",
  "=": "#e85d4c",
}

type Pt = { x: number; y: number }

function courtTransform(originX: number, originY: number, scale: number) {
  return {
    px(x: number) {
      return originX + x * scale
    },
    py(y: number) {
      return originY + (7 - y) * scale
    },
  }
}

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

function drawSurface(
  ctx: CanvasRenderingContext2D,
  theme: CourtTheme,
  originX: number,
  originY: number,
  scale: number,
  labels: boolean,
  inkOnly = false,
) {
  const { px, py } = courtTransform(originX, originY, scale)
  const x0 = px(0.5)
  const x1 = px(3.5)
  const yTop = py(6.5)
  const yBot = py(0.5)
  const yNet = py(3.5)
  const yAtkHi = py(4.5)
  const yAtkLo = py(2.5)

  ctx.save()
  if (!inkOnly) {
    ctx.fillStyle = theme.surround
    ctx.fillRect(px(0), py(7), 4 * scale, 7 * scale)
    ctx.fillStyle = theme.floor
    ctx.fillRect(x0, yTop, x1 - x0, yBot - yTop)
    if (theme.attackLine) {
      ctx.fillStyle = theme.front
      ctx.fillRect(x0, yAtkHi, x1 - x0, yNet - yAtkHi)
      ctx.fillRect(x0, yNet, x1 - x0, yAtkLo - yNet)
    }
    paintTexture(ctx, theme, x0, yTop, x1 - x0, yBot - yTop)
  }

  ctx.strokeStyle = theme.line
  ctx.lineWidth = Math.max(1.2, scale * 0.02)
  ctx.strokeRect(x0, yTop, x1 - x0, yBot - yTop)

  ctx.lineWidth = Math.max(0.8, scale * 0.012)
  ctx.beginPath()
  if (theme.attackLine) {
    ctx.moveTo(x0, yAtkHi)
    ctx.lineTo(x1, yAtkHi)
    ctx.moveTo(x0, yAtkLo)
    ctx.lineTo(x1, yAtkLo)
  }
  if (theme.zoneGrid) {
    ctx.moveTo(px(1.5), yTop)
    ctx.lineTo(px(1.5), yBot)
    ctx.moveTo(px(2.5), yTop)
    ctx.lineTo(px(2.5), yBot)
  }
  ctx.stroke()

  ctx.strokeStyle = theme.net
  ctx.lineWidth = Math.max(2.4, scale * 0.04)
  ctx.beginPath()
  ctx.moveTo(px(0.12), yNet)
  ctx.lineTo(px(3.88), yNet)
  ctx.stroke()
  ctx.strokeStyle = theme.netTape
  ctx.lineWidth = Math.max(1, scale * 0.012)
  ctx.beginPath()
  ctx.moveTo(px(0.12), yNet)
  ctx.lineTo(px(3.88), yNet)
  ctx.stroke()

  if (labels) {
    ctx.fillStyle = theme.label
    ctx.font = `${Math.max(10, scale * 0.16)}px Vazirmatn, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const lower: Record<string, [number, number]> = {
      "5": [1, 1],
      "6": [2, 1],
      "1": [3, 1],
      "7": [1, 2],
      "8": [2, 2],
      "9": [3, 2],
      "4": [1, 3],
      "3": [2, 3],
      "2": [3, 3],
    }
    for (const [zone, [x, y]] of Object.entries(lower)) {
      ctx.fillText(zone, px(x), py(y))
      ctx.fillText(zone, px(4 - x), py(7 - y))
    }
    ctx.fillStyle = theme.caption
    ctx.font = `${Math.max(11, scale * 0.15)}px Vazirmatn, sans-serif`
    ctx.fillText("فرود", px(2), py(6.85))
    ctx.fillText("حمله", px(2), py(0.15))
  }
  ctx.restore()
}

function kde(
  points: Pt[],
  bw: number,
): { grid: Float32Array; max: number; nx: number; ny: number } {
  const nx = 72
  const ny = 126
  const grid = new Float32Array(nx * ny)
  let max = 0
  for (let j = 0; j < ny; j++) {
    const y = ((j + 0.5) / ny) * 7
    for (let i = 0; i < nx; i++) {
      const x = ((i + 0.5) / nx) * 4
      let sum = 0
      for (const p of points) {
        const dx = (x - p.x) / bw
        const dy = (y - p.y) / bw
        const r2 = dx * dx + dy * dy
        if (r2 < 16) sum += Math.exp(-0.5 * r2)
      }
      grid[j * nx + i] = sum
      if (sum > max) max = sum
    }
  }
  return { grid, max, nx, ny }
}

function drawHeat(
  ctx: CanvasRenderingContext2D,
  attacks: Attack[],
  originX: number,
  originY: number,
  scale: number,
) {
  const points = attacks.map((a) => ({ x: a.ex, y: a.ey }))
  if (points.length === 0) return
  const bw = points.length < 12 ? 0.42 : 0.3
  const { grid, max, nx, ny } = kde(points, bw)
  if (max <= 0) return
  const off = document.createElement("canvas")
  off.width = nx
  off.height = ny
  const octx = off.getContext("2d")
  if (!octx) return
  const image = octx.createImageData(nx, ny)
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const t = grid[j * nx + i] / max
      if (t < 0.04) continue
      const clamped = Math.max(0, Math.min(1, t))
      const alpha = 0.18 + Math.pow(clamped, 0.7) * 0.72
      const pixel = ((ny - 1 - j) * nx + i) * 4
      image.data[pixel] = Math.round(255 - clamped * 40)
      image.data[pixel + 1] = Math.max(0, Math.round(150 - clamped * 120))
      image.data[pixel + 2] = Math.max(0, Math.round(40 - clamped * 30))
      image.data[pixel + 3] = Math.round(alpha * 255)
    }
  }
  octx.putImageData(image, 0, 0)
  const { px, py } = courtTransform(originX, originY, scale)
  ctx.save()
  ctx.beginPath()
  ctx.rect(px(0.35), py(6.7), px(3.65) - px(0.35), py(0.3) - py(6.7))
  ctx.clip()
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(off, px(0), py(7), 4 * scale, 7 * scale)
  ctx.restore()
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  alpha: number,
  width: number,
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const head = Math.min(11, Math.max(6, len * 0.08))
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2 - ux * head * 0.6, y2 - uy * head * 0.6)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - ux * head - uy * head * 0.45, y2 - uy * head + ux * head * 0.45)
  ctx.lineTo(x2 - ux * head + uy * head * 0.45, y2 - uy * head - ux * head * 0.45)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  attacks: Attack[],
  originX: number,
  originY: number,
  scale: number,
) {
  const { px, py } = courtTransform(originX, originY, scale)
  const alpha = Math.min(0.85, Math.max(0.18, 22 / Math.max(attacks.length, 1)))
  const width = Math.max(1, scale * 0.016)
  for (const attack of attacks) {
    const color = EVAL_COLOR[attack.evaluation] ?? "#f4f1ea"
    if (attack.mx != null && attack.my != null) {
      drawArrow(ctx, px(attack.sx), py(attack.sy), px(attack.mx), py(attack.my), color, alpha, width)
      drawArrow(ctx, px(attack.mx), py(attack.my), px(attack.ex), py(attack.ey), color, alpha, width)
    } else {
      drawArrow(ctx, px(attack.sx), py(attack.sy), px(attack.ex), py(attack.ey), color, alpha, width)
    }
  }
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  theme: CourtTheme,
  originX: number,
  originY: number,
  scale: number,
) {
  const { px, py } = courtTransform(originX, originY, scale)
  ctx.save()
  ctx.fillStyle = theme.label
  ctx.font = `${Math.max(10, scale * 0.16)}px Vazirmatn, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const lower: Record<string, [number, number]> = {
    "5": [1, 1],
    "6": [2, 1],
    "1": [3, 1],
    "7": [1, 2],
    "8": [2, 2],
    "9": [3, 2],
    "4": [1, 3],
    "3": [2, 3],
    "2": [3, 3],
  }
  for (const [zone, [x, y]] of Object.entries(lower)) {
    ctx.fillText(zone, px(x), py(y))
    ctx.fillText(zone, px(4 - x), py(7 - y))
  }
  ctx.fillStyle = theme.caption
  ctx.font = `${Math.max(11, scale * 0.15)}px Vazirmatn, sans-serif`
  ctx.fillText("فرود", px(2), py(6.85))
  ctx.fillText("حمله", px(2), py(0.15))
  ctx.restore()
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  theme: CourtTheme,
  attacks: Attack[],
  originX: number,
  originY: number,
  scale: number,
  mode: PlotMode,
  labels: boolean,
) {
  drawSurface(ctx, theme, originX, originY, scale, false)
  if (mode !== "lines") drawHeat(ctx, attacks, originX, originY, scale)
  drawSurface(ctx, theme, originX, originY, scale, false, true)
  if (labels) drawLabels(ctx, theme, originX, originY, scale)
  if (mode !== "heatmap") drawLines(ctx, attacks, originX, originY, scale)
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
  byRotation: boolean,
  themeId: string,
) {
  const theme = courtById(themeId)
  const design = byRotation ? DESIGN.rotation : DESIGN.single
  paintFrame(ctx, theme, design.w, design.h)
  ctx.fillStyle = theme.caption
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  if (!byRotation) {
    const scale = 86
    const originX = (design.w - 4 * scale) / 2
    const originY = 28
    drawPanel(ctx, theme, attacks, originX, originY, scale, mode, true)
    return
  }

  const scale = 46
  const cellW = 4 * scale
  const cellH = 7 * scale
  const gapX = 28
  const gapY = 36
  const gridW = cellW * 3 + gapX * 2
  const originX0 = (design.w - gridW) / 2
  const originY0 = 18
  ROTATION_ORDER.forEach((rotation, index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    const ox = originX0 + col * (cellW + gapX)
    const oy = originY0 + row * (cellH + gapY) + 22
    const subset = attacks.filter((attack) => attack.rotation === rotation)
    ctx.fillStyle = theme.id === "beach" ? "#243044" : "#f6f3ec"
    ctx.font = "15px Vazirmatn, sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(
      `چرخش ${rotation.toLocaleString("fa-IR")} · ${subset.length.toLocaleString("fa-IR")} حمله`,
      ox + cellW / 2,
      oy - 14,
    )
    drawPanel(ctx, theme, subset, ox, oy, scale, mode, false)
  })
}
