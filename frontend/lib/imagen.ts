/**
 * Google Imagen — via Google AI Studio REST API
 * Docs: https://ai.google.dev/api/images
 */

export interface BrandContext {
  brandName: string
  primaryColor?: string
  secondaryColor?: string
  logoUrl?: string | null
  description?: string
}

/**
 * Generate a single image via Google Imagen.
 * Returns a base64 data URL — Python decodes it directly (no network download).
 */
export async function generateImage(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY
  if (!apiKey) throw new Error("GOOGLE_AI_STUDIO_API_KEY not set")

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: "16:9" },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    let googleMessage = errText
    try {
      const parsed = JSON.parse(errText)
      if (parsed?.error?.message) googleMessage = String(parsed.error.message)
    } catch {
      // keep raw text
    }

    // Make a few common Google errors more actionable.
    if (/only available on paid plans/i.test(googleMessage)) {
      throw new Error(
        `Google Imagen access error (${res.status}): ${googleMessage} (Go to https://ai.dev/projects to enable a paid plan / billing for your project.)`
      )
    }

    throw new Error(`Google Imagen error (${res.status}): ${googleMessage}`)
  }

  const json = await res.json()
  const pred = json.predictions?.[0]
  const b64: string | undefined =
    pred?.bytesBase64Encoded ??
    pred?.image?.bytesBase64Encoded ??
    pred?.imageBytes?.bytesBase64Encoded
  if (!b64) throw new Error("Google Imagen: no image returned")

  return `data:image/png;base64,${b64}`
}

// ─── Zone-specific prompts ────────────────────────────────────────────────────

function colorDesc(hex?: string, label = "brand color"): string {
  if (!hex) return ""
  return ` The ${label} is ${hex}.`
}

function base(brand: BrandContext): string {
  const colors = [
    brand.primaryColor && `primary brand color ${brand.primaryColor}`,
    brand.secondaryColor && `secondary color ${brand.secondaryColor}`,
  ].filter(Boolean).join(", ")

  return [
    `Brand: "${brand.brandName}".`,
    colors ? `Brand palette: ${colors}.` : "",
    brand.description ? `Brand identity: ${brand.description}.` : "",
    "Photorealistic render, editorial photography quality, ultra-detailed, 16:9.",
    "Environment designed and branded by Booth Photo Paris, the premium Parisian photobooth company.",
    "No people in the image.",
  ].filter(Boolean).join(" ")
}

/**
 * Zone 1 — Cover slide: hero shot of the full photobooth installation
 */
export function promptCover(brand: BrandContext): string {
  return [
    base(brand),
    `Hero shot of a premium photobooth installation for "${brand.brandName}".`,
    `Dark elegant backdrop with the "${brand.brandName}" logo prominently displayed.`,
    brand.primaryColor ? `Setup lit with the brand's primary color ${brand.primaryColor} uplighting.` : "Warm golden ambient uplighting.",
    "Wide establishing shot, luxury event venue, Parisian atmosphere.",
    "The photobooth is sleek, modern, and on-brand.",
  ].join(" ")
}

/**
 * Zone 2/3 — Cabine renders (top and bottom angles)
 */
export function promptCabine(brand: BrandContext, angle: "top" | "bottom"): string {
  const view = angle === "top"
    ? "front-facing exterior shot of the photobooth cabine with the door slightly open"
    : "three-quarter angle showing the side and front of the photobooth cabine"
  return [
    base(brand),
    `${view} for "${brand.brandName}".`,
    `The cabine exterior is wrapped in "${brand.brandName}" branding.`,
    brand.primaryColor ? `Main color: ${brand.primaryColor}.` : "",
    `The logo "${brand.brandName}" is printed on the front panel.`,
    "Soft studio lighting, luxury product photography style.",
  ].filter(Boolean).join(" ")
}

/**
 * Zone 4 — Kiosk render
 */
export function promptKiosk(brand: BrandContext): string {
  return [
    base(brand),
    `A freestanding photobooth kiosk branded for "${brand.brandName}".`,
    "Sleek open-air kiosk design with a large touchscreen and branded frame.",
    brand.primaryColor ? `Color scheme dominant: ${brand.primaryColor}.` : "",
    `"${brand.brandName}" logo on the top panel and side trim.`,
    "Luxury trade show / event venue context, soft directional lighting.",
  ].filter(Boolean).join(" ")
}

/**
 * Zone 5/6 — Goodies (top and bottom product rows)
 */
export function promptGoodies(brand: BrandContext, row: "top" | "bottom"): string {
  const items = row === "top"
    ? "branded photo prints, branded photo strips, and a luxe envelope"
    : "branded photo box, branded tote bag, and branded USB key"
  return [
    base(brand),
    `Flat lay product photography of ${items} for "${brand.brandName}".`,
    brand.primaryColor ? `Items use ${brand.primaryColor} as the primary brand color.` : "",
    `"${brand.brandName}" logo and name on each item.`,
    "White marble or dark velvet background, overhead shot, editorial luxury style.",
  ].filter(Boolean).join(" ")
}

/**
 * Generate all 6 zone images in parallel for a brand.
 * Returns an object matching the Python API's GenerateRequest fields.
 */
export async function generateAllZones(brand: BrandContext): Promise<{
  cover_image_url: string
  cabine_top_url: string
  cabine_bottom_url: string
  kiosk_url: string
  goodies_top_url: string
  goodies_bottom_url: string
}> {
  // Sequential by default: reduces bursty quota/rate-limit issues.
  const cover = await generateImage(promptCover(brand))
  const cabineTop = await generateImage(promptCabine(brand, "top"))
  const cabineBottom = await generateImage(promptCabine(brand, "bottom"))
  const kiosk = await generateImage(promptKiosk(brand))
  const goodiesTop = await generateImage(promptGoodies(brand, "top"))
  const goodiesBottom = await generateImage(promptGoodies(brand, "bottom"))

  return {
    cover_image_url: cover,
    cabine_top_url: cabineTop,
    cabine_bottom_url: cabineBottom,
    kiosk_url: kiosk,
    goodies_top_url: goodiesTop,
    goodies_bottom_url: goodiesBottom,
  }
}

// Legacy – kept for compatibility
export function buildBrandPrompt(params: {
  brandName: string
  styleKeywords?: string[]
  clientType?: string
  customSuffix?: string
}): string {
  return promptCover({ brandName: params.brandName })
}
