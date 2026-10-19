import { runParser } from "@/lib/run-parser"

export async function GET() {
  try {
    const match = await runParser(["--sample"])
    return Response.json(match)
  } catch (error) {
    const detail = error instanceof Error ? error.message : "نمونه باز نشد"
    return Response.json({ error: "بازی نمونه باز نشد.", detail: detail.slice(0, 500) }, { status: 500 })
  }
}
