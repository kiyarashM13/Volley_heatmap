import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { runParser } from "@/lib/run-parser"

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "فایلی انتخاب نشده." }, { status: 400 })
  }
  if (file.size > 20 * 1024 * 1024) {
    return Response.json({ error: "حجم فایل بیشتر از ۲۰ مگابایت است." }, { status: 400 })
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "dvw-"))
  const dest = path.join(dir, "match.dvw")
  try {
    await writeFile(dest, Buffer.from(await file.arrayBuffer()))
    const match = await runParser([dest, file.name])
    return Response.json(match)
  } catch (error) {
    const detail = error instanceof Error ? error.message : "خواندن فایل ناموفق بود"
    return Response.json(
      { error: "این فایل به‌عنوان اسکاوت DataVolley خوانده نشد.", detail: detail.slice(0, 500) },
      { status: 422 },
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
