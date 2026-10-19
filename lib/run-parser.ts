import { spawn } from "node:child_process"
import path from "node:path"

import type { ScoutMatch } from "@/lib/types"

export async function runParser(args: string[]): Promise<Omit<ScoutMatch, "id">> {
  const script = path.join(process.cwd(), "parser", "export_match.py")
  const child = spawn("python3", [script, ...args], {
    env: { ...process.env, PYTHONWARNINGS: "ignore" },
  })

  const stdout: Buffer[] = []
  const stderr: Buffer[] = []
  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk))
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk))

  const code = await new Promise<number>((resolve, reject) => {
    child.on("error", reject)
    child.on("close", (status) => resolve(status ?? 1))
  })

  const out = Buffer.concat(stdout).toString("utf8").trim()
  const err = Buffer.concat(stderr).toString("utf8").trim()
  if (code !== 0) {
    throw new Error(err || out || "خواندن فایل ناموفق بود")
  }
  return JSON.parse(out) as Omit<ScoutMatch, "id">
}
