import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export async function GET() {
  try {
    const { stdout } = await execFileAsync("git", ["archive", "--format=zip", "HEAD"], {
      cwd: process.cwd(),
      encoding: "buffer",
      maxBuffer: 20 * 1024 * 1024,
    })
    const bytes = stdout instanceof Uint8Array ? stdout : new Uint8Array(Buffer.from(stdout))
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="attack-heatmap.zip"',
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "zip"
    return Response.json({ error: "زیپ ساخته نشد.", detail: detail.slice(0, 500) }, { status: 500 })
  }
}
