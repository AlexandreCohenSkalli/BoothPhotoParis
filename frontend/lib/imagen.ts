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
    "Clean 3D architectural product render, white or very light grey background, sharp and professional, 16:9.",
    "Designed and branded by Booth Photo Paris, the premium Parisian photobooth company.",
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
 * Zone 2/3 — Cabine renders
 *
 * TWO DISTINCT MODELS:
 *
 * MODEL 1 (top / Freeform 25) — "Cabine Arrondie" — Roland Garros style:
 *   - Rounded outer corners on all edges (large radius)
 *   - Large ROUNDED arch door opening on the front face (arch is smooth and wide)
 *   - Vertical fabric curtains hanging inside the arch, slightly parted
 *   - Photo print dispensing slot on the left panel (horizontal rectangle)
 *   - Brand logo circle/badge on the top-left of front face
 *   - Exterior fully wrapped in brand color, matte finish
 *   - Photorealistic render, slight 3/4 front angle, outdoor or neutral background
 *
 * MODEL 2 (bottom / Freeform 24) — "Cabine Carrée" — QVEMA/SketchUp style:
 *   - Perfectly rectangular box, sharp 90° corners, no rounding
 *   - Dimensions: exactly 148 cm wide × 148 cm deep × 189 cm tall
 *   - Front face has a rectangular (not rounded) or slightly arched opening
 *   - Vertical fabric curtains inside, photo print slot at bottom front
 *   - Exterior branded wrap on side panel with brand name/logo large
 *   - SketchUp-style technical render with dimension annotation lines
 */
export function promptCabine(brand: BrandContext, angle: "top" | "bottom"): string {
  if (angle === "top") {
    // Model 1: rounded cabine, photorealistic, Roland Garros style
    return [
      `Photorealistic 3D product render of a photobooth cabine (Model: "Cabine Arrondie") branded for "${brand.brandName}".`,
      "The cabine has a ROUNDED box shape with large-radius rounded corners on all outer edges — like a rounded rectangle in 3D, similar to a modern photo booth.",
      "Front face has one large smooth ROUNDED ARCH door opening (wide, tall, fully rounded top). Inside the arch: vertical fabric curtains hanging from a top rail, slightly parted to reveal dark interior.",
      "Left panel has a small horizontal photo print dispensing slot near the middle.",
      brand.primaryColor
        ? `Entire exterior wrapped in solid brand color ${brand.primaryColor}, matte finish.`
        : "Exterior wrapped in matte solid-color panels.",
      `"${brand.brandName}" logo as a circular badge printed on the top-left of the front face.`,
      "Slight 3/4 front-left angle view. Outdoor or clean neutral background. Bright even lighting. Photorealistic render quality. No people.",
    ].filter(Boolean).join(" ")
  } else {
    // Model 2: squared cabine, SketchUp technical render, QVEMA style
    return [
      `SketchUp-style 3D technical render of a photobooth cabine (Model: "Cabine Carrée") branded for "${brand.brandName}".`,
      "The cabine is a PERFECTLY RECTANGULAR box with sharp 90° corners — no rounding. Dimensions: exactly 148 cm wide × 148 cm deep × 189.3 cm tall.",
      "Front face divided into two sections: left narrow panel (with print dispensing slot), right wider section with curtained opening.",
      "Vertical fabric curtains hang inside the opening. Top of the cabine has a flat roof panel.",
      brand.primaryColor
        ? `Side panel fully wrapped with brand imagery on a ${brand.primaryColor} background.`
        : "Side panel wrapped with brand imagery on a dark background.",
      `"${brand.brandName}" brand name in large bold text on the side panel.`,
      "3/4 perspective view showing front-left and right side. Dimension annotation lines with labels: 148.0 cm width, 148.0 cm depth, 189.3 cm height.",
      "Clean white or very light grey background. SketchUp architectural visualization style — flat colors, sharp edges, technical drawing aesthetic, no photorealistic lighting.",
    ].filter(Boolean).join(" ")
  }
}

/**
 * Zone 4 — Kiosk render
 *
 * The Booth kiosk is a tall slim open-air cabinet (portrait orientation):
 * - Flat cabinet, portrait format, slightly rounded outer corners (not sharp 90°)
 * - TOP section: branded header panel with brand logo/name prominently displayed
 * - MIDDLE section: large touchscreen showing a 2×2 grid of photo strips
 * - Above screen: small camera lens visible
 * - SIDE: thin horizontal print dispensing slot on the right side panel
 * - Open-air — no curtains, no enclosure
 * - Rendered in an atmospheric context matching the brand (outdoor/indoor venue)
 * - Elegant, sleek, premium feel — NOT a simple colored box with harsh square edges
 */
export function promptKiosk(brand: BrandContext): string {
  return [
    `Photorealistic 3D product render of an open-air photobooth kiosk branded for "${brand.brandName}".`,
    "The kiosk is a tall slim freestanding cabinet in portrait format with slightly rounded outer corners.",
    "Structure: branded header panel at top with logo/name, large central screen showing a 2×2 grid of photo strips in the middle section, small camera lens above the screen, thin horizontal print slot on the right side.",
    "Open-air design — no curtains, no enclosed box. Sleek and modern, premium finish.",
    brand.primaryColor
      ? `Cabinet exterior in brand color ${brand.primaryColor} with elegant matte finish and subtle brand detailing.`
      : "Cabinet in sleek matte dark finish.",
    `"${brand.brandName}" name and logo large on the top header panel.`,
    "Slight 3/4 front angle. Beautiful atmospheric background context matching the brand identity — elegant venue, warm ambient lighting, premium event atmosphere. No harsh studio background.",
    "Photorealistic render quality, cinematic lighting, sharp and polished — NOT a flat colored box.",
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
