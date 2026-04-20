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

    // Best icon/symbol (the standalone mark — e.g. the Netflix “N”, the Apple apple)
    const bestIcon =
      logos.find((l) => l.format === "png" && l.type === "icon") ??
      logos.find((l) => l.format === "svg" && l.type === "icon") ??
      logos.find((l) => l.format === "png" && l.type === "symbol") ??
      logos.find((l) => l.type === "icon") ??
      logos.find((l) => l.type === "symbol") ??
      null

    // Extract primary and secondary colors
    const colors = (data.colors ?? []).map((c: { hex: string; type: string }) => ({
      hex: c.hex,
      type: c.type,
    }))

    // Helper: compute HSL saturation of a hex color (0–1)
    const hexSaturation = (hex: string): number => {
      const h = hex.replace("#", "").toLowerCase()
      if (h.length !== 6) return 0
      const r = parseInt(h.slice(0, 2), 16) / 255
      const g = parseInt(h.slice(2, 4), 16) / 255
      const b = parseInt(h.slice(4, 6), 16) / 255
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const l = (max + min) / 2
      if (max === min) return 0
      return (max - min) / (1 - Math.abs(2 * l - 1))
    }

    // Helper: skip near-white or near-transparent colors for primary
    const isUsableAsPrimary = (hex: string) => {
      const h = hex.replace("#", "").toLowerCase()
      if (h.length !== 6) return false
      const r = parseInt(h.slice(0, 2), 16)
      const g = parseInt(h.slice(2, 4), 16)
      const b = parseInt(h.slice(4, 6), 16)
      const luminance = (r + g + b) / 3
      return luminance < 230 // exclude near-white
    }

    // Known-brand color overrides: Brandfetch sometimes returns generic dark/neutral colors
    // for brands whose real identity color is well-known. Override when confident.
    const knownColors: Record<string, { primary: string; secondary?: string }> = {
      "evian.com":      { primary: "#00A0DC", secondary: "#ffffff" },
      "volvic.fr":      { primary: "#005B96", secondary: "#ffffff" },
      "perrier.com":    { primary: "#00833D", secondary: "#ffffff" },
      "vittel.com":     { primary: "#009A44", secondary: "#ffffff" },
      "redbull.com":    { primary: "#CC1E10", secondary: "#FFC906" },
      "heineken.com":   { primary: "#007A33", secondary: "#ffffff" },
      "corona.com":     { primary: "#F2A900", secondary: "#003087" },
      "orangina.com":   { primary: "#F7941D", secondary: "#ffffff" },
    }
    const knownOverride = knownColors[cleanDomain]

    // Prefer the most chromatic (saturated) usable color — avoids picking generic dark/gray
    // Use a looser luminance filter (< 245) for the chromaticity check to catch light brand colors
    const isChromatic = (hex: string): boolean => {
      const h = hex.replace("#", "").toLowerCase()
      if (h.length !== 6) return false
      const r = parseInt(h.slice(0, 2), 16)
      const g = parseInt(h.slice(2, 4), 16)
      const b = parseInt(h.slice(4, 6), 16)
      return (r + g + b) / 3 < 245 // exclude pure white only
    }
    const usableColors = colors.filter((c: { hex: string; type: string }) => isChromatic(c.hex))
    const mostChromatic = usableColors.sort((a: { hex: string }, b: { hex: string }) =>
      hexSaturation(b.hex) - hexSaturation(a.hex)
    )[0]

    const primaryColor =
      (mostChromatic && hexSaturation(mostChromatic.hex) > 0.15 ? mostChromatic.hex : null) ??
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
      logo_icon_url: bestIcon?.url ?? null,
      primary_color: knownOverride?.primary ?? primaryColor,
      secondary_color: knownOverride?.secondary ?? secondaryColor,
      all_colors: colors,
      all_logos: logos,
    })
  } catch (err) {
    console.error("Brandfetch error:", err)
    return NextResponse.json({ error: "Failed to fetch brand data" }, { status: 500 })
  }
}
