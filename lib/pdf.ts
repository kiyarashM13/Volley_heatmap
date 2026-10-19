export function bytesToBlob(bytes: Uint8Array, type: string) {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new Blob([copy], { type })
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export function jpegBytesToPdf(jpeg: Uint8Array, imgW: number, imgH: number): Blob {
  const landscape = imgW >= imgH
  const pageW = landscape ? 842 : 595
  const pageH = landscape ? 595 : 842
  const margin = 28
  const scale = Math.min((pageW - margin * 2) / imgW, (pageH - margin * 2) / imgH)
  const drawW = imgW * scale
  const drawH = imgH * scale
  const x = (pageW - drawW) / 2
  const y = (pageH - drawH) / 2
  const content = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`
  const encoder = new TextEncoder()
  const contentBytes = encoder.encode(content)

  const objects: Uint8Array[] = []
  const push = (body: string | Uint8Array) => {
    objects.push(typeof body === "string" ? encoder.encode(body) : body)
  }

  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n`,
  )
  push(
    `4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${content}endstream\nendobj\n`,
  )
  const imageHead = encoder.encode(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  )
  const imageTail = encoder.encode("\nendstream\nendobj\n")
  objects.push(concat([imageHead, jpeg, imageTail]))

  const header = encoder.encode("%PDF-1.4\n")
  const chunks: Uint8Array[] = [header]
  const offsets: number[] = [0]
  let cursor = header.length
  for (const object of objects) {
    offsets.push(cursor)
    chunks.push(object)
    cursor += object.length
  }
  const xrefStart = cursor
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i++) {
    xref += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  chunks.push(encoder.encode(xref))
  const bytes = concat(chunks)
  return bytesToBlob(bytes, "application/pdf")
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92))
  if (!blob) throw new Error("jpeg")
  return new Uint8Array(await blob.arrayBuffer())
}
