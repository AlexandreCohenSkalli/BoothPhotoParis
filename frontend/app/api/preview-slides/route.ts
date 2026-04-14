/**
 * POST /api/preview-slides
 * Proxies to Python /preview-slides — returns PNG thumbnails of each slide (no AI generation).
 * Local dev only.
 */
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const pythonApiUrl = process.env.PYTHON_API_URL ?? "http://localhost:8000"

  try {
    const pyRes = await fetch(`${pythonApiUrl}/preview-slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!pyRes.ok) {
      const errText = await pyRes.text()
      return NextResponse.json(
        { error: `Preview failed: ${errText}` },
        { status: pyRes.status }
      )
    }

    const data = await pyRes.json()
    return NextResponse.json(data)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
