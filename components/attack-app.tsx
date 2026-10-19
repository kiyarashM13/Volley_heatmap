"use client"

import { Download, Trash2, Upload } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { CourtCanvas } from "@/components/court-canvas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { COURT_THEMES, DEFAULT_COURT, courtById } from "@/lib/courts"
import { bytesToBlob, canvasToJpeg, downloadBlob, jpegBytesToPdf } from "@/lib/pdf"
import type { Attack, Filters, GroupMode, Hit, Phase, PlotMode, ScoutMatch, Skill } from "@/lib/types"

const PHASES: { id: Phase; label: string }[] = [
  { id: "reception", label: "بعد از دریافت" },
  { id: "transition", label: "ترنزیشن" },
  { id: "other", label: "نامشخص" },
]

const HITS: { id: Hit; label: string }[] = [
  { id: "hard", label: "اسپک قوی" },
  { id: "tip", label: "تیپ" },
  { id: "soft", label: "نرم" },
  { id: "other", label: "سایر" },
]

const ZONE_ORDER = ["4", "3", "2", "1", "6", "5", "7", "8", "9"]
const SERVE_ZONE_ORDER = ["1", "6", "5", "7", "8", "9", "4", "3", "2"]
const ROTATION_ORDER = [1, 6, 5, 4, 3, 2]

const PLOTS: { id: PlotMode; label: string; hint: string }[] = [
  { id: "heatmap", label: "هیت مپ", hint: "فقط محل فرود. نقطهٔ سبز یعنی امتیاز." },
  { id: "lines", label: "جهت", hint: "فقط مسیر. خط سبز یعنی امتیاز." },
  { id: "both", label: "هیت مپ + جهت", hint: "محل فرود و مسیر با هم. خط سبز یعنی امتیاز." },
]

const GROUPS: Record<Skill, { id: GroupMode; label: string }[]> = {
  attack: [
    { id: "code", label: "ترکیب حمله" },
    { id: "rotation", label: "چرخش" },
    { id: "court", label: "یک زمین" },
  ],
  serve: [
    { id: "code", label: "نوع سرویس" },
    { id: "rotation", label: "چرخش" },
    { id: "court", label: "یک زمین" },
  ],
}

function fa(value: number, digits = 0) {
  return value.toLocaleString("fa-IR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

function playerKey(attack: Attack) {
  return `${attack.playerNumber}|${attack.playerName}`
}

function playerLabel(number: string, name: string) {
  if (name && number) return `${number} ${name}`
  return name || number || "بدون نام"
}

function eventsOf(match: ScoutMatch, skill: Skill) {
  return skill === "serve" ? match.serves : match.attacks
}

function numberMatches(value: number | null, selected: number[]) {
  if (selected.length === 0) return true
  return value != null && selected.includes(value)
}

function zoneMatches(attack: Attack, zones: string[]) {
  if (zones.length === 0) return true
  return zones.includes(attack.startZone ?? "")
}

function codeMatches(attack: Attack, query: string) {
  const needle = query.trim().toUpperCase()
  if (!needle) return true
  return (attack.attackCode?.trim() || "NA").toUpperCase().includes(needle)
}

function chartNote(skill: Skill, filters: Filters) {
  const parts: string[] = []
  if (filters.sets.length > 0) {
    parts.push(`ست ${filters.sets.map((set) => set.toLocaleString("fa-IR")).join("، ")}`)
  }
  if (filters.rotations.length > 0) {
    parts.push(`چرخش ${filters.rotations.map((rotation) => rotation.toLocaleString("fa-IR")).join("، ")}`)
  }
  const zones = skill === "serve" ? filters.serveZones : filters.startZones
  if (zones.length > 0) {
    parts.push(`منطقه ${zones.map((zone) => Number(zone).toLocaleString("fa-IR")).join("، ")}`)
  }
  if (skill === "attack") {
    const code = filters.codeQuery.trim().toUpperCase()
    if (code) parts.push(code)
  }
  return parts.join(" · ")
}

export function AttackApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [matches, setMatches] = useState<ScoutMatch[]>([])
  const [teamChoice, setTeamChoice] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    phases: { reception: true, transition: true, other: true },
    hits: { hard: true, tip: true, soft: true, other: true },
    player: "all",
    sets: [],
    rotations: [],
    startZones: [],
    serveZones: [],
    codeQuery: "",
    group: "code",
    mode: "both",
  })
  const [themeId, setThemeId] = useState(DEFAULT_COURT)
  const [skill, setSkill] = useState<Skill>("attack")

  const teams = useMemo(() => {
    const counts = new Map<string, number>()
    for (const match of matches) {
      for (const attack of eventsOf(match, skill)) {
        if (!attack.team) continue
        counts.set(attack.team, (counts.get(attack.team) ?? 0) + 1)
      }
    }
    const home = matches[0]?.homeTeam
    return [...counts.entries()].sort((a, b) => {
      if (a[0] === home) return -1
      if (b[0] === home) return 1
      return a[0].localeCompare(b[0])
    })
  }, [matches, skill])

  const team = teams.some(([name]) => name === teamChoice) ? teamChoice : (teams[0]?.[0] ?? "")

  const players = useMemo(() => {
    const map = new Map<string, { key: string; number: string; name: string; count: number }>()
    for (const match of matches) {
      for (const attack of eventsOf(match, skill)) {
        if (attack.team !== team) continue
        if (!numberMatches(attack.setNumber, filters.sets)) continue
        if (!numberMatches(attack.rotation, filters.rotations)) continue
        if (skill === "attack" && !zoneMatches(attack, filters.startZones)) continue
        if (skill === "serve" && !zoneMatches(attack, filters.serveZones)) continue
        if (skill === "attack" && !codeMatches(attack, filters.codeQuery)) continue
        const key = playerKey(attack)
        const existing = map.get(key)
        if (existing) existing.count += 1
        else map.set(key, { key, number: attack.playerNumber, name: attack.playerName, count: 1 })
      }
    }
    return [...map.values()].sort((a, b) => Number(a.number) - Number(b.number) || a.name.localeCompare(b.name))
  }, [matches, team, skill, filters.sets, filters.rotations, filters.startZones, filters.serveZones, filters.codeQuery])

  const player = players.some((item) => item.key === filters.player) ? filters.player : "all"
  const selectedPlayer = players.find((item) => item.key === player)
  const chartTitle = selectedPlayer
    ? `#${selectedPlayer.number} - ${selectedPlayer.name || selectedPlayer.number}`
    : team || (skill === "serve" ? "سرویس" : "جهت حمله")

  const scoped = useMemo(() => {
    return matches.flatMap((match) =>
      eventsOf(match, skill).filter(
        (attack) =>
          attack.team === team &&
          (skill === "serve" || filters.phases[attack.phase]) &&
          (skill === "serve" || filters.hits[attack.hit]) &&
          (player === "all" || playerKey(attack) === player),
      ),
    )
  }, [matches, team, filters.phases, filters.hits, player, skill])

  const setChoices = useMemo(() => {
    const counts = new Map<number, number>()
    for (const attack of scoped) {
      if (attack.setNumber == null) continue
      counts.set(attack.setNumber, (counts.get(attack.setNumber) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([set, count]) => ({ set, count }))
  }, [scoped])

  const rotationChoices = useMemo(() => {
    const counts = new Map<number, number>()
    for (const attack of scoped) {
      if (!numberMatches(attack.setNumber, filters.sets)) continue
      if (attack.rotation == null) continue
      counts.set(attack.rotation, (counts.get(attack.rotation) ?? 0) + 1)
    }
    return ROTATION_ORDER.filter((rotation) => counts.has(rotation) || filters.rotations.includes(rotation)).map(
      (rotation) => ({ rotation, count: counts.get(rotation) ?? 0 }),
    )
  }, [scoped, filters.sets, filters.rotations])

  const activeZones = skill === "serve" ? filters.serveZones : filters.startZones

  const zoneChoices = useMemo(() => {
    const order = skill === "serve" ? SERVE_ZONE_ORDER : ZONE_ORDER
    const counts = new Map<string, number>()
    for (const attack of scoped) {
      if (!numberMatches(attack.setNumber, filters.sets)) continue
      if (!numberMatches(attack.rotation, filters.rotations)) continue
      if (!attack.startZone) continue
      counts.set(attack.startZone, (counts.get(attack.startZone) ?? 0) + 1)
    }
    return order.filter((zone) => counts.has(zone) || activeZones.includes(zone)).map((zone) => ({
      zone,
      count: counts.get(zone) ?? 0,
    }))
  }, [scoped, skill, filters.sets, filters.rotations, activeZones])

  const codeChoices = useMemo(() => {
    const counts = new Map<string, number>()
    for (const attack of scoped) {
      if (!numberMatches(attack.setNumber, filters.sets)) continue
      if (!numberMatches(attack.rotation, filters.rotations)) continue
      if (!zoneMatches(attack, filters.startZones)) continue
      const code = attack.attackCode?.trim() || "NA"
      counts.set(code, (counts.get(code) ?? 0) + 1)
    }
    const query = filters.codeQuery.trim().toUpperCase()
    return [...counts.entries()]
      .filter(([code]) => !query || code.toUpperCase().includes(query))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en", { numeric: true }))
      .map(([code, count]) => ({ code, count }))
  }, [scoped, filters.sets, filters.rotations, filters.startZones, filters.codeQuery])

  const visible = useMemo(() => {
    return scoped.filter(
      (attack) =>
        numberMatches(attack.setNumber, filters.sets) &&
        numberMatches(attack.rotation, filters.rotations) &&
        zoneMatches(attack, activeZones) &&
        (skill === "serve" || codeMatches(attack, filters.codeQuery)),
    )
  }, [scoped, skill, filters.sets, filters.rotations, activeZones, filters.codeQuery])

  const note = chartNote(skill, filters)

  const stats = useMemo(() => {
    const kills = visible.filter((attack) => attack.evaluation === "#").length
    const errors = visible.filter((attack) => attack.evaluation === "=").length
    const blocks = visible.filter((attack) => attack.evaluation === "/").length
    const attempts = visible.length
    const efficiency =
      attempts === 0 ? 0 : skill === "serve" ? (kills - errors) / attempts : (kills - errors - blocks) / attempts
    const success = attempts === 0 ? 0 : kills / attempts
    return { attempts, kills, errors, blocks, efficiency, success }
  }, [visible, skill])

  const scoreLine = useMemo(() => {
    const home = matches.find((match) => match.homeTeam === team || match.visitingTeam === team)
    if (!home) return null
    const sets =
      home.homeSets != null && home.visitingSets != null
        ? `${fa(home.homeSets)}–${fa(home.visitingSets)}`
        : null
    return { home: home.homeTeam, away: home.visitingTeam, sets }
  }, [matches, team])

  async function addFiles(files: File[]) {
    const accepted = files.filter((file) => file.name.toLowerCase().endsWith(".dvw"))
    if (accepted.length === 0) {
      setError("فقط فایل .dvw از DataVolley یا VolleyStation خوانده می‌شود.")
      return
    }
    setError(null)
    for (let index = 0; index < accepted.length; index++) {
      const file = accepted[index]
      setBusy(`در حال خواندن ${fa(index + 1)} از ${fa(accepted.length)}`)
      const body = new FormData()
      body.set("file", file)
      const response = await fetch("/api/parse", { method: "POST", body })
      const payload = (await response.json()) as ScoutMatch & { error?: string; detail?: string }
      if (!response.ok) {
        setError(payload.detail ? `${payload.error} ${payload.detail}` : payload.error || "خواندن فایل ناموفق بود")
        continue
      }
      setMatches((current) => [
        ...current,
        { ...payload, id: crypto.randomUUID() },
      ])
    }
    setBusy(null)
  }

  async function loadSample() {
    setError(null)
    setBusy("در حال باز کردن بازی نمونه")
    const response = await fetch("/api/sample")
    const payload = (await response.json()) as ScoutMatch & { error?: string; detail?: string }
    setBusy(null)
    if (!response.ok) {
      setError(payload.detail ? `${payload.error} ${payload.detail}` : payload.error || "بازی نمونه باز نشد")
      return
    }
    setMatches((current) => {
      if (current.some((match) => match.fileName === payload.fileName)) return current
      return [...current, { ...payload, id: crypto.randomUUID() }]
    })
  }

  async function download(kind: "png" | "jpeg" | "pdf") {
    const canvas = canvasRef.current
    if (!canvas) return
    const theme = courtById(themeId).id
    const base = `${team || "attacks"}-${theme}`.replace(/\s+/g, "-")
    if (kind === "png") {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
      if (blob) downloadBlob(blob, `${base}.png`)
      return
    }
    const jpeg = await canvasToJpeg(canvas)
    if (kind === "jpeg") {
      downloadBlob(bytesToBlob(jpeg, "image/jpeg"), `${base}.jpg`)
      return
    }
    downloadBlob(jpegBytesToPdf(jpeg, canvas.width, canvas.height), `${base}.pdf`)
  }

  const theme = courtById(themeId)
  const zoneFallback = visible.some((attack) => attack.located === "zone")

  return (
    <div className="min-h-svh">
      <header className="border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
          <p className="text-xs tracking-wide text-primary">اسکاوت والیبال</p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {skill === "serve" ? "جهت سرویس" : "جهت حمله"}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                نقطهٔ فرود و مسیر هر ضربه، و جای سرویس تا فرود آن، از مختصات فایل خوانده می‌شود.
              </p>
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" variant={skill === "attack" ? "default" : "outline"} onClick={() => setSkill("attack")}>
                  حمله
                </Button>
                <Button type="button" size="sm" variant={skill === "serve" ? "default" : "outline"} onClick={() => setSkill("serve")}>
                  سرویس
                </Button>
              </div>
            </div>
            {scoreLine ? (
              <p className="text-sm text-muted-foreground">
                {scoreLine.home}
                {scoreLine.sets ? ` ${scoreLine.sets} ` : " – "}
                {scoreLine.away}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5 lg:sticky lg:top-4 lg:max-h-[calc(100svh-2rem)] lg:overflow-auto lg:pe-1">
          <section
            className={`rounded-2xl border border-dashed p-4 transition-colors ${dragOver ? "border-primary bg-primary/10" : "border-border bg-card"}`}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)
              void addFiles([...event.dataTransfer.files])
            }}
          >
            <p className="text-sm font-medium">فایل اسکاوت</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              یک یا چند فایل <span dir="ltr">.dvw</span> را اینجا رها کنید.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
                <Upload />
                انتخاب فایل
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void loadSample()} disabled={busy !== null}>
                اوکراین – رومانی
              </Button>
            </div>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept=".dvw"
              multiple
              onChange={(event) => {
                const list = event.target.files
                if (list) void addFiles([...list])
                event.target.value = ""
              }}
            />
            {busy ? <p className="mt-3 text-xs text-primary">{busy}</p> : null}
            {error ? <p className="mt-3 text-xs leading-5 text-destructive">{error}</p> : null}
            {matches.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {matches.map((match) => (
                  <li key={match.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-2 py-1.5">
                    <span className="truncate text-xs" dir="ltr">
                      {match.fileName}
                    </span>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label="حذف فایل"
                      onClick={() => setMatches((current) => current.filter((item) => item.id !== match.id))}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="team">
              تیم
            </label>
            <Select
              value={team || null}
              onValueChange={(value) => {
                if (!value) return
                setTeamChoice(value)
                setFilters((current) => ({ ...current, player: "all" }))
              }}
            >
              <SelectTrigger id="team" className="w-full">
                <SelectValue>
                  {(value) => (value ? <span dir="ltr">{value}</span> : "بعد از باز کردن فایل")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {teams.map(([name, count]) => (
                  <SelectItem key={name} value={name}>
                    <span dir="ltr">{name}</span> ({fa(count)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="text-sm font-medium" htmlFor="player">
              بازیکن
            </label>
            <Select
              value={player}
              onValueChange={(value) => {
                if (!value) return
                setFilters((current) => ({ ...current, player: value }))
              }}
            >
              <SelectTrigger id="player" className="w-full">
                <SelectValue>
                  {(value) => {
                    const found = players.find((item) => item.key === value)
                    if (!found) return "همه بازیکن‌ها"
                    return <span dir="ltr">{playerLabel(found.number, found.name)}</span>
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه بازیکن‌ها</SelectItem>
                {players.map((player) => (
                  <SelectItem key={player.key} value={player.key}>
                    <span dir="ltr">{playerLabel(player.number, player.name)}</span> ({fa(player.count)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {setChoices.length > 0 ? (
            <ChoiceRow
              label="ست"
              selected={filters.sets.map(String)}
              choices={setChoices.map((item) => ({ id: String(item.set), text: fa(item.set), count: item.count }))}
              dataAttr="data-set"
              onChange={(next) => setFilters((current) => ({ ...current, sets: next.map(Number) }))}
            />
          ) : null}

          {rotationChoices.length > 0 ? (
            <ChoiceRow
              label="چرخش"
              hint="با ست، منطقه و کد جمع می‌شود. چیدمان شش‌زمین جداست."
              selected={filters.rotations.map(String)}
              choices={rotationChoices.map((item) => ({
                id: String(item.rotation),
                text: fa(item.rotation),
                count: item.count,
              }))}
              dataAttr="data-rotation"
              onChange={(next) => setFilters((current) => ({ ...current, rotations: next.map(Number) }))}
            />
          ) : null}

          {skill === "attack" ? (
          <>
          <ChoiceRow
            label="منطقه شروع"
            hint="جدا از کد حمله است و با اسم بازیکن جمع می‌شود."
            selected={filters.startZones}
            choices={zoneChoices.map((item) => ({ id: item.zone, text: fa(Number(item.zone)), count: item.count }))}
            dataAttr="data-zone"
            onChange={(next) => setFilters((current) => ({ ...current, startZones: next }))}
          />

          <section>
            <label className="text-sm font-medium" htmlFor="attack-code">
              کد حمله
            </label>
            <Input
              id="attack-code"
              dir="ltr"
              className="mt-2 font-medium"
              value={filters.codeQuery}
              placeholder="X5"
              onChange={(event) =>
                setFilters((current) => ({ ...current, codeQuery: event.target.value.toUpperCase() }))
              }
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {codeChoices.map((item) => {
                const on = filters.codeQuery.trim().toUpperCase() === item.code
                return (
                  <Button
                    key={item.code}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    data-code={item.code}
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        codeQuery: current.codeQuery.trim().toUpperCase() === item.code ? "" : item.code,
                      }))
                    }
                  >
                    <span dir="ltr">{item.code}</span>
                    <span className="text-[11px] opacity-80">({fa(item.count)})</span>
                  </Button>
                )
              })}
            </div>
          </section>

          <section>
            <p className="text-sm font-medium">فاز حمله</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PHASES.map((phase) => (
                <Button
                  key={phase.id}
                  type="button"
                  size="sm"
                  variant={filters.phases[phase.id] ? "default" : "outline"}
                  aria-pressed={filters.phases[phase.id]}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      phases: { ...current.phases, [phase.id]: !current.phases[phase.id] },
                    }))
                  }
                >
                  {phase.label}
                </Button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-sm font-medium">نوع ضربه</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {HITS.map((hit) => (
                <Button
                  key={hit.id}
                  type="button"
                  size="sm"
                  variant={filters.hits[hit.id] ? "default" : "outline"}
                  aria-pressed={filters.hits[hit.id]}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      hits: { ...current.hits, [hit.id]: !current.hits[hit.id] },
                    }))
                  }
                >
                  {hit.label}
                </Button>
              ))}
            </div>
          </section>
          </>
          ) : (
            <>
              <ChoiceRow
                label="منطقه شروع"
                hint="جایی که سرویس زده شده، معمولاً ۱، ۶ یا ۵."
                selected={filters.serveZones}
                choices={zoneChoices.map((item) => ({ id: item.zone, text: fa(Number(item.zone)), count: item.count }))}
                dataAttr="data-serve-zone"
                onChange={(next) => setFilters((current) => ({ ...current, serveZones: next }))}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                نقطهٔ پشت خط، جایی است که سرویس زده شده. رنگ روی محل فرود توپ در زمین حریف است. خط سبز یعنی ایس.
              </p>
            </>
          )}

          <section>
            <p className="text-sm font-medium">مدل زمین</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              برگ مربی برای خواندن فرود است. عوض کردن رنگ، جای خط و نقطه را جابه‌جا نمی‌کند.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {COURT_THEMES.map((item) => {
                const selected = item.id === themeId
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setThemeId(item.id)}
                    className={`rounded-xl border p-2 text-start transition-colors ${selected ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted"}`}
                  >
                    <span
                      className="mb-2 block h-8 overflow-hidden rounded-md border border-black/10"
                      style={{
                        background: `linear-gradient(180deg, ${item.swatch[0]} 0 42%, ${item.swatch[1]} 42% 46%, ${item.swatch[0]} 46% 100%)`,
                      }}
                    />
                    <span className="block text-sm font-medium">{item.name}</span>
                    <span className="block text-[11px] leading-4 text-muted-foreground">{item.blurb}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <p className="text-sm font-medium">چیدمان</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {GROUPS[skill].map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant={filters.group === item.id ? "default" : "outline"}
                  aria-pressed={filters.group === item.id}
                  onClick={() => setFilters((current) => ({ ...current, group: item.id }))}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </section>

          <section className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => void download("png")} disabled={matches.length === 0}>
              <Download />
              PNG
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => void download("jpeg")} disabled={matches.length === 0}>
              JPEG
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => void download("pdf")} disabled={matches.length === 0}>
              PDF
            </Button>
          </section>
        </aside>

        <main className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label={skill === "serve" ? "سرویس" : "حمله"} value={fa(stats.attempts)} />
            <Stat label={skill === "serve" ? "ایس" : "امتیاز"} value={fa(stats.kills)} />
            <Stat label="خطا" value={fa(stats.errors)} />
            {skill === "serve" ? (
              <Stat label="موفقیت" value={fa(stats.success, 3)} hint="ایس / سرویس" />
            ) : (
              <Stat label="بلاک" value={fa(stats.blocks)} />
            )}
            <Stat
              label="کارایی"
              value={fa(stats.efficiency, 3)}
              hint={skill === "serve" ? "(ایس − خطا) / سرویس" : "(امتیاز − خطا − بلاک) / حمله"}
              className="col-span-2 sm:col-span-1"
            />
          </div>

          <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-medium">{skill === "serve" ? "جهت سرویس" : "جهت‌های حمله"}</h2>
                <p className="text-xs text-muted-foreground">
                  {theme.name}
                  {team ? ` · ${team}` : ""}
                  {filters.group === "code"
                    ? skill === "serve"
                      ? " · هر خانه یک نوع سرویس"
                      : " · هر خانه یک ترکیب"
                    : filters.group === "rotation"
                      ? " · شش چرخش"
                      : " · همه روی یک زمین"}
                  {note ? ` · ${note}` : ""}
                </p>
              </div>
              <Badge variant="outline">{fa(visible.length)} {skill === "serve" ? "سرویس روی نمودار" : "ضربه روی نمودار"}</Badge>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {PLOTS.map((plot) => (
                <Button
                  key={plot.id}
                  type="button"
                  size="sm"
                  variant={filters.mode === plot.id ? "default" : "outline"}
                  aria-pressed={filters.mode === plot.id}
                  onClick={() => setFilters((current) => ({ ...current, mode: plot.id }))}
                >
                  {plot.label}
                </Button>
              ))}
              <span className="text-xs text-muted-foreground">
                {PLOTS.find((plot) => plot.id === filters.mode)?.hint}
              </span>
            </div>
            {matches.length === 0 ? (
              <p className="mb-3 text-sm text-muted-foreground">
                هنوز فایلی باز نشده. مدل زمین را همین حالا عوض کنید، یا بازی اوکراین – رومانی را بارگذاری کنید.
              </p>
            ) : visible.length === 0 ? (
              <p className="mb-3 text-sm text-muted-foreground">
                {skill === "serve"
                  ? "برای این تیم سرویسِ قابل‌رسمی نمانده."
                  : "با این فیلتر حمله‌ای نمانده. یکی از فازها یا نوع ضربه‌ها را روشن کنید."}
              </p>
            ) : null}
            <CourtCanvas
              ref={canvasRef}
              attacks={visible}
              mode={filters.mode}
              group={filters.group}
              themeId={themeId}
              title={chartTitle}
              skill={skill}
              note={note}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {filters.mode === "heatmap" ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#e10600]" />
                  {skill === "serve" ? "جای سرویس" : "محل ضربه"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-neutral-800" />
                  {skill === "serve" ? "شروع و فرود" : "ضربه و فرود"}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[#128a3a]" />
                {skill === "serve" ? "ایس" : "امتیاز"}
              </span>
              {filters.mode !== "heatmap" ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-6 bg-neutral-500" />
                  {skill === "serve" ? "مسیر سرویس" : "مسیر ضربه"}
                </span>
              ) : null}
              {filters.mode !== "heatmap" ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-6 bg-[#128a3a]" />
                  {skill === "serve" ? "سرویس امتیاز" : "ضربهٔ امتیاز"}
                </span>
              ) : null}
              <span>
                {skill === "serve"
                  ? "کارایی = (ایس − خطا) / سرویس، موفقیت = ایس / سرویس"
                  : "کارایی = (امتیاز − خطا − بلاک) / حمله، موفقیت = امتیاز / حمله"}
              </span>
              {filters.mode !== "lines" ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-2 w-16 rounded-full"
                    style={{ background: "linear-gradient(90deg, #46d24a, #ffe14a 55%, #d01212)" }}
                  />
                  تراکم فرود، سبز کم و قرمز زیاد
                </span>
              ) : null}
            </div>
            {zoneFallback ? (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {skill === "serve"
                  ? "سرویس نقطه‌چین مختصات فرود نداشت و وسط همان منطقه، آن‌طرف تور، گذاشته شده. داخل نقشهٔ حرارتی نیست."
                  : "ضربهٔ نقطه‌چین مختصات فرود نداشت و وسط همان منطقه گذاشته شده. داخل نقشهٔ حرارتی نیست تا جای توپ جابه‌جا دیده نشود."}
              </p>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  )
}

function ChoiceRow({
  label,
  hint,
  selected,
  choices,
  dataAttr,
  onChange,
}: {
  label: string
  hint?: string
  selected: string[]
  choices: { id: string; text: string; count: number }[]
  dataAttr: "data-set" | "data-rotation" | "data-zone" | "data-serve-zone"
  onChange: (next: string[]) => void
}) {
  return (
    <section>
      <p className="text-sm font-medium">{label}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={selected.length === 0 ? "default" : "outline"}
          aria-pressed={selected.length === 0}
          onClick={() => onChange([])}
        >
          همه
        </Button>
        {choices.map((item) => {
          const on = selected.includes(item.id)
          return (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={on ? "default" : "outline"}
              aria-pressed={on}
              {...{ [dataAttr]: item.id }}
              onClick={() => {
                if (selected.length === 0) {
                  onChange([item.id])
                  return
                }
                onChange(on ? selected.filter((id) => id !== item.id) : [...selected, item.id])
              }}
            >
              {item.text}
              <span className="text-[11px] opacity-80">({fa(item.count)})</span>
            </Button>
          )
        })}
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: string
  hint?: string
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-border bg-card px-3 py-2 ${className ?? ""}`} title={hint}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
