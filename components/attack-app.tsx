"use client"

import { Download, Trash2, Upload } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { CourtCanvas } from "@/components/court-canvas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { COURT_THEMES, DEFAULT_COURT, courtById } from "@/lib/courts"
import { bytesToBlob, canvasToJpeg, downloadBlob, jpegBytesToPdf } from "@/lib/pdf"
import type { Attack, Filters, Hit, Phase, PlotMode, ScoutMatch } from "@/lib/types"

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

const PLOTS: { id: PlotMode; label: string }[] = [
  { id: "both", label: "هر دو" },
  { id: "heatmap", label: "نقشه حرارتی" },
  { id: "lines", label: "خطوط" },
]

const EVAL_LEGEND = [
  { code: "#", label: "امتیاز", color: "#f2c14e" },
  { code: "+", label: "مثبت", color: "#7dcea0" },
  { code: "!", label: "معمولی", color: "#85c1e9" },
  { code: "-", label: "ضعیف", color: "#d5d8dc" },
  { code: "/", label: "بلاک", color: "#5dade2" },
  { code: "=", label: "خطا", color: "#e85d4c" },
]

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
    byRotation: false,
    mode: "both",
  })
  const [themeId, setThemeId] = useState(DEFAULT_COURT)

  const teams = useMemo(() => {
    const counts = new Map<string, number>()
    for (const match of matches) {
      for (const attack of match.attacks) {
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
  }, [matches])

  const team = teams.some(([name]) => name === teamChoice) ? teamChoice : (teams[0]?.[0] ?? "")

  const players = useMemo(() => {
    const map = new Map<string, { key: string; number: string; name: string; count: number }>()
    for (const match of matches) {
      for (const attack of match.attacks) {
        if (attack.team !== team) continue
        const key = playerKey(attack)
        const existing = map.get(key)
        if (existing) existing.count += 1
        else map.set(key, { key, number: attack.playerNumber, name: attack.playerName, count: 1 })
      }
    }
    return [...map.values()].sort((a, b) => Number(a.number) - Number(b.number) || a.name.localeCompare(b.name))
  }, [matches, team])

  const player = players.some((item) => item.key === filters.player) ? filters.player : "all"

  const visible = useMemo(() => {
    return matches.flatMap((match) =>
      match.attacks.filter(
        (attack) =>
          attack.team === team &&
          filters.phases[attack.phase] &&
          filters.hits[attack.hit] &&
          (player === "all" || playerKey(attack) === player),
      ),
    )
  }, [matches, team, filters, player])

  const stats = useMemo(() => {
    const kills = visible.filter((attack) => attack.evaluation === "#").length
    const errors = visible.filter((attack) => attack.evaluation === "=").length
    const blocks = visible.filter((attack) => attack.evaluation === "/").length
    const attempts = visible.length
    const efficiency = attempts === 0 ? 0 : (kills - errors - blocks) / attempts
    return { attempts, kills, errors, blocks, efficiency }
  }, [visible])

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
              <h1 className="text-2xl font-semibold tracking-tight">جهت حمله</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                مسیر و تراکم فرود اسپک را از فایل DataVolley ببینید. مدل زمین را عوض کنید؛ مختصات همان فایل می‌ماند.
              </p>
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
                <SelectValue placeholder="بعد از باز کردن فایل" />
              </SelectTrigger>
              <SelectContent>
                {teams.map(([name, count]) => (
                  <SelectItem key={name} value={name}>
                    {name} ({fa(count)})
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
                <SelectValue placeholder="همه" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه بازیکن‌ها</SelectItem>
                {players.map((player) => (
                  <SelectItem key={player.key} value={player.key}>
                    {playerLabel(player.number, player.name)} ({fa(player.count)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <section>
            <p className="text-sm font-medium">مدل زمین</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              ظاهر نمودار عوض می‌شود. ساحلی خط ۳ متر ندارد؛ بقیه سالنی‌اند.
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
            <p className="text-sm font-medium">نمودار</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLOTS.map((plot) => (
                <Button
                  key={plot.id}
                  type="button"
                  size="sm"
                  variant={filters.mode === plot.id ? "default" : "outline"}
                  onClick={() => setFilters((current) => ({ ...current, mode: plot.id }))}
                >
                  {plot.label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={filters.byRotation ? "default" : "outline"}
                aria-pressed={filters.byRotation}
                onClick={() => setFilters((current) => ({ ...current, byRotation: !current.byRotation }))}
              >
                جدا بر اساس چرخش
              </Button>
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
            <Stat label="حمله" value={fa(stats.attempts)} />
            <Stat label="امتیاز" value={fa(stats.kills)} />
            <Stat label="خطا" value={fa(stats.errors)} />
            <Stat label="بلاک" value={fa(stats.blocks)} />
            <Stat
              label="کارایی"
              value={fa(stats.efficiency, 3)}
              hint="(امتیاز − خطا − بلاک) / حمله"
              className="col-span-2 sm:col-span-1"
            />
          </div>

          <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-medium">جهت‌های حمله</h2>
                <p className="text-xs text-muted-foreground">
                  {theme.name}
                  {team ? ` · ${team}` : ""}
                  {filters.byRotation ? " · شش چرخش ستر" : ""}
                </p>
              </div>
              <Badge variant="outline">{fa(visible.length)} ضربه روی نمودار</Badge>
            </div>
            {matches.length === 0 ? (
              <p className="mb-3 text-sm text-muted-foreground">
                هنوز فایلی باز نشده. مدل زمین را همین حالا عوض کنید، یا بازی اوکراین – رومانی را بارگذاری کنید.
              </p>
            ) : visible.length === 0 ? (
              <p className="mb-3 text-sm text-muted-foreground">با این فیلتر حمله‌ای نمانده. یکی از فازها یا نوع ضربه‌ها را روشن کنید.</p>
            ) : null}
            <CourtCanvas
              ref={canvasRef}
              attacks={visible}
              mode={filters.mode}
              byRotation={filters.byRotation}
              themeId={themeId}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {filters.mode !== "heatmap"
                ? EVAL_LEGEND.map((item) => (
                    <span key={item.code} className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ background: item.color }} />
                      {item.label}
                    </span>
                  ))
                : null}
              {filters.mode !== "lines" ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-16 rounded-full bg-gradient-to-l from-red-700 via-orange-500 to-amber-200" />
                  تراکم فرود
                </span>
              ) : null}
            </div>
            {zoneFallback ? (
              <p className="mt-2 text-xs text-muted-foreground">
                چند ضربه مختصات قابل‌اعتماد نداشتند و از روی ناحیهٔ زمین رسم شدند.
              </p>
            ) : null}
          </section>
        </main>
      </div>
    </div>
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
