/**
 * GET /api/brandfetch?domain=chanel.com
 * Fetches brand identity (logo, colors, name) from Brandfetch API
 * Docs: https://docs.brandfetch.com/reference/get-brand
 */
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")
  if (!domain) {
    return NextResponse.json({ error: "Missing domain" }, { status: 400 })
  }

  const apiKey = process.env.BRANDFETCH_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "BRANDFETCH_KEY not configured" }, { status: 500 })
  }

  // Clean domain
  const cleanDomain = domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]

  try {
    const res = await fetch(`https://api.brandfetch.io/v2/brands/${cleanDomain}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 3600 }, // cache 1h
    })

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: "Brand not found for this domain" }, { status: 404 })
      }
      return NextResponse.json({ error: `Brandfetch error: ${res.status}` }, { status: 502 })
    }

    const data = await res.json()

    // Extract the best logo (prefer SVG, then PNG with transparent bg)
    const logos: Array<{ url: string; type: string; format: string; width?: number }> = []
    for (const logoSet of data.logos ?? []) {
      for (const format of logoSet.formats ?? []) {
        logos.push({
          url: format.src,
          type: logoSet.type, // "icon" | "logo" | "symbol"
          format: format.format, // "svg" | "png"
          width: format.width,
        })
      }
    }

    // Prefer dark-theme PNG logo (visible on light backgrounds), then dark SVG, then any PNG, then fallback
    const bestLogo =
      logos.find((l) => l.format === "png" && l.type === "logo" && l.url?.includes("/dark/")) ??
      logos.find((l) => l.format === "svg" && l.type === "logo" && l.url?.includes("/dark/")) ??
      logos.find((l) => l.format === "png" && l.type === "logo") ??
      logos.find((l) => l.format === "jpeg" && l.type === "icon") ??
      logos.find((l) => l.format === "png") ??
      logos[0]

    // Extract primary and secondary colors
    const colors = (data.colors ?? []).map((c: { hex: string; type: string }) => ({
      hex: c.hex,
      type: c.type,
    }))

    // Helper: skip near-white or near-transparent colors for primary
    const isUsableAsPrimary = (hex: string) => {
      const h = hex.replace("#", "").toLowerCase()
      if (h.length !== 6) return false
      const r = parseInt(h.slice(0, 2), 16)
      const g = parseInt(h.slice(2, 4), 16)
      const b = parseInt(h.slice(4, 6), 16)
      const luminance = (r + g + b) / 3
      return luminance < 230 // exclude near-white (#E5E5E5 = 229 → excluded)
    }

    const primaryColor =
      colors.find((c: { hex: string; type: string }) => c.type === "dark" && isUsableAsPrimary(c.hex))?.hex ??
      colors.find((c: { hex: string; type: string }) => c.type === "dominant" && isUsableAsPrimary(c.hex))?.hex ??
      colors.find((c: { hex: string; type: string }) => c.type === "brand" && isUsableAsPrimary(c.hex))?.hex ??
      colors.find((c: { hex: string; type: string }) => isUsableAsPrimary(c.hex))?.hex ??
      colors[0]?.hex ??
      "#000000"

    const secondaryColor =
      colors.find((c: { hex: string; type: string }) => c.type === "light")?.hex ??
      colors.find((c: { hex: string; type: string }) => c.type === "accent")?.hex ??
      colors.find((c: { hex: string; type: string }) => c.hex !== primaryColor)?.hex ??
      "#ffffff"

    return NextResponse.json({
      name: data.name ?? cleanDomain,
      domain: cleanDomain,
      description: data.description ?? "",
      logo_url: bestLogo?.url ?? null,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      all_colors: colors,
      all_logos: logos,
    })
  } catch (err) {
    console.error("Brandfetch error:", err)
    return NextResponse.json({ error: "Failed to fetch brand data" }, { status: 500 })
  }
}
