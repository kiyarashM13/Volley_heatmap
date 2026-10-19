export type Phase = "reception" | "transition" | "other"
export type Hit = "hard" | "tip" | "soft" | "other"
export type PlotMode = "heatmap" | "lines" | "both"
export type GroupMode = "code" | "rotation" | "court"
export type Skill = "attack" | "serve"

export type Attack = {
  team: string
  playerNumber: string
  playerName: string
  evaluation: string
  phase: Phase
  hit: Hit
  rotation: number | null
  setNumber: number | null
  attackCode: string | null
  startZone: string | null
  endZone: string | null
  located: "coordinate" | "zone"
  startMeasured: boolean
  endMeasured: boolean
  sx: number
  sy: number
  ex: number
  ey: number
  mx: number | null
  my: number | null
}

export type ScoutMatch = {
  id: string
  fileName: string
  homeTeam: string
  visitingTeam: string
  homeSets: number | null
  visitingSets: number | null
  unplotted: number
  attacks: Attack[]
  serves: Attack[]
}

export type Filters = {
  phases: Record<Phase, boolean>
  hits: Record<Hit, boolean>
  player: string
  group: GroupMode
  mode: PlotMode
}
