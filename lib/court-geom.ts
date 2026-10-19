import type { Attack, GroupMode } from "./types"

/**
 * Openvolley court: x in [0, 4], y in [0, 7].
 * Sidelines x = 0.5 and 3.5, baselines y = 0.5 and 6.5, net y = 3.5.
 * One unit is 3 metres. The attacker is always on the bottom (small y).
 * Canvas y grows downward, so py = oy + (7 - y) * scale.
 */

export const HEAT_BW = 0.15
export const HEAT_NX = 320
export const HEAT_NY = 560

const ROTATION_ORDER = [1, 6, 5, 4, 3, 2]

export type Panel = {
  label: string | null
  attacks: Attack[]
  summary: string
  ox: number
  oy: number
}

export type ChartLayout = {
  w: number
  h: number
  scale: number
  columns: number
  title: string
  panels: Panel[]
}

export function columnCount(_width: number, group: GroupMode): number {
  if (group === "court") return 1
  return 3
}

export function attackSummary(attacks: Attack[]): string {
  const attempts = attacks.length
  const kills = attacks.filter((attack) => attack.evaluation === "#").length
  const errors = attacks.filter((attack) => attack.evaluation === "=").length
  const blocks = attacks.filter((attack) => attack.evaluation === "/").length
  const efficiency = attempts === 0 ? 0 : (kills - errors - blocks) / attempts
  const success = attempts === 0 ? 0 : kills / attempts
  const count = attempts.toLocaleString("fa-IR")
  const percent = (ratio: number) => `${Math.round(ratio * 100).toLocaleString("fa-IR")}٪`
  return `${count} حمله | ${percent(efficiency)} کارایی | ${percent(success)} موفقیت`
}

export function attackCode(attack: Attack): string {
  const code = attack.attackCode?.trim()
  return code ? code : "NA"
}

export function panelsFor(attacks: Attack[], group: GroupMode): { label: string | null; attacks: Attack[] }[] {
  if (group === "court") return [{ label: null, attacks }]
  if (group === "rotation") {
    return ROTATION_ORDER.map((rotation) => ({
      label: `چرخش ${rotation.toLocaleString("fa-IR")}`,
      attacks: attacks.filter((attack) => attack.rotation === rotation),
    }))
  }
  const groups = new Map<string, Attack[]>()
  for (const attack of attacks) {
    const code = attackCode(attack)
    const list = groups.get(code)
    if (list) list.push(attack)
    else groups.set(code, [attack])
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "en", { numeric: true }))
    .map(([label, list]) => ({ label, attacks: list }))
}

export function buildLayout(
  attacks: Attack[],
  group: GroupMode,
  columns: number,
  title: string,
): ChartLayout {
  const source = panelsFor(attacks, group)
  const panels = source.length > 0 ? source : [{ label: null, attacks: [] }]
  const scale = group === "court" ? 68 : 42
  const cols = Math.min(Math.max(columns, 1), panels.length)
  const rows = Math.ceil(panels.length / cols)
  const labelH = group === "court" ? 0 : 22
  const footerH = 28
  const titleH = 40
  const gapX = 18
  const gapY = 20
  const padX = 18
  const padB = 12
  const cellW = 4 * scale
  const cellH = labelH + 7 * scale + footerH
  const gridW = cols * cellW + (cols - 1) * gapX
  const w = padX * 2 + gridW
  const h = titleH + rows * cellH + (rows - 1) * gapY + padB
  const originX0 = (w - gridW) / 2
  return {
    w,
    h,
    scale,
    columns: cols,
    title,
    panels: panels.map((panel, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      return {
        label: panel.label,
        attacks: panel.attacks,
        summary: attackSummary(panel.attacks),
        ox: originX0 + col * (cellW + gapX),
        oy: titleH + row * (cellH + gapY) + labelH,
      }
    }),
  }
}

export function designPoint(ox: number, oy: number, scale: number, x: number, y: number) {
  return {
    px: ox + x * scale,
    py: oy + (7 - y) * scale,
  }
}

export function splatDensity(points: { x: number; y: number }[], bw = HEAT_BW, nx = HEAT_NX, ny = HEAT_NY) {
  const grid = new Float32Array(nx * ny)
  if (points.length === 0 || bw <= 0) return grid
  const rMax = 3.5 * bw
  const rMax2 = rMax * rMax
  const bw2 = bw * bw
  for (const point of points) {
    const i0 = Math.max(0, Math.floor(((point.x - rMax) / 4) * nx))
    const i1 = Math.min(nx - 1, Math.ceil(((point.x + rMax) / 4) * nx))
    const j0 = Math.max(0, Math.floor(((point.y - rMax) / 7) * ny))
    const j1 = Math.min(ny - 1, Math.ceil(((point.y + rMax) / 7) * ny))
    for (let j = j0; j <= j1; j++) {
      const y = ((j + 0.5) / ny) * 7
      const dy = y - point.y
      for (let i = i0; i <= i1; i++) {
        const x = ((i + 0.5) / nx) * 4
        const dx = x - point.x
        const d2 = dx * dx + dy * dy
        if (d2 > rMax2) continue
        grid[j * nx + i] += Math.exp(-0.5 * (d2 / bw2))
      }
    }
  }
  return grid
}

export function hottest(grid: Float32Array, nx = HEAT_NX, ny = HEAT_NY) {
  let max = 0
  let bi = 0
  let bj = 0
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const value = grid[j * nx + i]
      if (value > max) {
        max = value
        bi = i
        bj = j
      }
    }
  }
  return {
    x: ((bi + 0.5) / nx) * 4,
    y: ((bj + 0.5) / ny) * 7,
    value: max,
  }
}

const HEAT_STOPS: Array<[number, number, number, number, number]> = [
  [0.035, 120, 230, 90, 0],
  [0.12, 70, 210, 60, 115],
  [0.28, 110, 215, 50, 155],
  [0.48, 230, 220, 45, 185],
  [0.66, 255, 196, 30, 210],
  [0.82, 245, 90, 24, 228],
  [1, 198, 16, 18, 242],
]

export function heatColor(t: number): [number, number, number, number] | null {
  if (t < HEAT_STOPS[0][0]) return null
  const clamped = Math.min(1, t)
  let index = 0
  while (index < HEAT_STOPS.length - 1 && HEAT_STOPS[index + 1][0] < clamped) index += 1
  const from = HEAT_STOPS[index]
  const to = HEAT_STOPS[Math.min(index + 1, HEAT_STOPS.length - 1)]
  const span = to[0] - from[0] || 1
  const mix = Math.max(0, Math.min(1, (clamped - from[0]) / span))
  const channel = (slot: number) => Math.round(from[slot] + (to[slot] - from[slot]) * mix)
  return [channel(1), channel(2), channel(3), channel(4)]
}
