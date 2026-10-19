export type CourtTheme = {
  id: string
  name: string
  blurb: string
  surround: string
  floor: string
  front: string
  line: string
  net: string
  netTape: string
  label: string
  caption: string
  attackLine: boolean
  zoneGrid: boolean
  texture: "flat" | "wood" | "sand"
  frame: [string, string]
  swatch: [string, string]
}

export const COURT_THEMES: CourtTheme[] = [
  {
    id: "blue",
    name: "سالن آبی",
    blurb: "ترافیلکس آبی با خط ۳ متر",
    surround: "#14325c",
    floor: "#1b4f8c",
    front: "#2464ad",
    line: "rgba(255,255,255,0.94)",
    net: "#f7f9fc",
    netTape: "#1b2430",
    label: "rgba(255,255,255,0.32)",
    caption: "rgba(255,255,255,0.78)",
    attackLine: true,
    zoneGrid: true,
    texture: "flat",
    frame: ["#102033", "#0c1726"],
    swatch: ["#1b4f8c", "#f7f9fc"],
  },
  {
    id: "green",
    name: "سالن سبز",
    blurb: "زمین سالنی سبز",
    surround: "#143628",
    floor: "#1f6b45",
    front: "#278555",
    line: "rgba(255,255,255,0.94)",
    net: "#f7f9fc",
    netTape: "#1b2430",
    label: "rgba(255,255,255,0.32)",
    caption: "rgba(255,255,255,0.8)",
    attackLine: true,
    zoneGrid: true,
    texture: "flat",
    frame: ["#10241c", "#0c1c16"],
    swatch: ["#1f6b45", "#f4f7f2"],
  },
  {
    id: "red",
    name: "سالن قرمز",
    blurb: "زمین سالنی قرمز",
    surround: "#6a2424",
    floor: "#b4332a",
    front: "#c9483c",
    line: "rgba(255,255,255,0.94)",
    net: "#f7f9fc",
    netTape: "#2a1212",
    label: "rgba(255,255,255,0.34)",
    caption: "rgba(255,255,255,0.82)",
    attackLine: true,
    zoneGrid: true,
    texture: "flat",
    frame: ["#2a1214", "#1a0d10"],
    swatch: ["#b4332a", "#f7f1ea"],
  },
  {
    id: "wood",
    name: "پارکت",
    blurb: "سالن چوبی، خط تیره",
    surround: "#8d5a32",
    floor: "#c48945",
    front: "#d39a55",
    line: "rgba(42,28,16,0.88)",
    net: "#f6f1e8",
    netTape: "#2a2118",
    label: "rgba(42,28,16,0.38)",
    caption: "rgba(42,28,16,0.72)",
    attackLine: true,
    zoneGrid: true,
    texture: "wood",
    frame: ["#3a2618", "#24170f"],
    swatch: ["#c48945", "#2a2118"],
  },
  {
    id: "beach",
    name: "ساحلی",
    blurb: "شن، بدون خط ۳ متر",
    surround: "#d7b56a",
    floor: "#efd3a0",
    front: "#efd3a0",
    line: "#1d4e89",
    net: "#f8fbff",
    netTape: "#16325a",
    label: "rgba(29,78,137,0.45)",
    caption: "rgba(29,78,137,0.8)",
    attackLine: false,
    zoneGrid: false,
    texture: "sand",
    frame: ["#c9a15a", "#b8893e"],
    swatch: ["#efd3a0", "#1d4e89"],
  },
  {
    id: "night",
    name: "تخته تیره",
    blurb: "پس‌زمینه تیره برای نقشه حرارتی",
    surround: "#12151c",
    floor: "#1c212c",
    front: "#262c3a",
    line: "rgba(244,241,234,0.78)",
    net: "#f4f1ea",
    netTape: "#0c0e13",
    label: "rgba(244,241,234,0.28)",
    caption: "rgba(244,241,234,0.7)",
    attackLine: true,
    zoneGrid: true,
    texture: "flat",
    frame: ["#0e1016", "#08090d"],
    swatch: ["#1c212c", "#f2c14e"],
  },
]

export const DEFAULT_COURT = COURT_THEMES[0].id

export function courtById(id: string): CourtTheme {
  return COURT_THEMES.find((theme) => theme.id === id) ?? COURT_THEMES[0]
}
