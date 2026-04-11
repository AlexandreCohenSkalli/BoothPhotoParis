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
export async function generateImage(prompt: string, aspectRatio: "16:9" | "9:16" | "1:1" = "16:9"): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY
  if (!apiKey) throw new Error("GOOGLE_AI_STUDIO_API_KEY not set")

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio },
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
    // Vue 1 — cabine arrondie dans un vrai décor événementiel
    const venueStyle = brand.description
      ? `a luxurious event venue fitting the "${brand.brandName}" universe`
      : `an elegant Parisian event space with high ceilings, warm golden chandeliers, marble floors and floral arrangements`
    return [
      `Editorial photograph of a branded photo booth cabine at a real event for "${brand.brandName}".`,
      "The photo booth is a tall box with a large rounded-arch door opening on the front face. Vertical fabric curtains hanging inside the arch opening. Dispensing print slot on the side.",
      brand.primaryColor
        ? `Entire exterior wrapped in ${brand.primaryColor}, matte premium finish.`
        : "Exterior in a rich solid brand color, matte premium finish.",
      `"${brand.brandName}" logo badge on the front face.`,
      `Scene: ${venueStyle}. The booth stands centered on the venue floor. Rich atmospheric background — guests mingling in soft bokeh behind, warm uplighting on the booth. Elegant, aspirational mood.`,
      "FULL MACHINE IN FRAME — entire booth visible head to toe, floor contact visible. Camera pulled back wide. Cinematic editorial quality photography. No people inside the booth.",
    ].filter(Boolean).join(" ")
  } else {
    // Vue 2 — rendu SketchUp technique fidèle à l'image de référence Booth/Chanel
    return [
      `SketchUp 3D architectural render of a photo booth cabine branded for "${brand.brandName}". Style: technical product visualization, exact same aesthetic as a Booth Paris SketchUp export.`,
      "Structure: tall rectangular box, approximately 148 cm wide × 148 cm deep × 189 cm tall. Flat roof panel. Front face divided into left narrow panel (with dispensing slot and small screen showing photo strips) and right wider opening with hanging vertical fabric curtains. Right side panel has large brand wrap graphics.",
      brand.primaryColor
        ? `Panels in ${brand.primaryColor} with contrasting trim. Right side panel large brand graphic on ${brand.primaryColor} background.`
        : "Dark wood-tone panels with contrasting trim. Right side panel large brand graphic.",
      `"${brand.brandName}" brand name and logo large on the right side panel. Small "${brand.brandName}" badge on the front left panel.`,
      "Viewed from a 3/4 front-right perspective showing front face and right side. Light grey-green SketchUp ground plane visible, dimension annotation lines with measurements. Checkerboard or solid floor texture at base. Characteristic SketchUp flat ambient lighting, no shadows, technical drawing feel.",
      "FULL MACHINE IN FRAME — entire booth visible head to toe. Nothing cropped.",
    ].filter(Boolean).join(" ")
  }
}

/**
 * Zone 4 — Kiosk render (PORTRAIT 9:16)
 * Rectangular tower: logo+name header, 4 photo strips in 2×2 grid on screen, small camera above screen.
 */
export function promptKiosk(brand: BrandContext): string {
  return [
    `3D product render of a photobooth kiosk tower branded for "${brand.brandName}".`,
    "The kiosk is a tall slim freestanding rectangular column (much taller than wide). Exact structure from top to bottom: (1) flat square header box on top with brand logo and brand name large — like a lightbox sign; (2) small round camera lens mounted just below the header; (3) large vertical rectangular touchscreen display in the center of the column showing a 2×2 grid of four photo strip thumbnails; (4) thin horizontal print dispensing slot near the bottom.",
    "Open-air design — no curtains, no enclosure. Clean straight edges, slightly rounded outer corners.",
    brand.primaryColor
      ? `Exterior column panels in solid ${brand.primaryColor}, matte premium finish.`
      : "Exterior in matte dark premium finish.",
    `Brand logo and "${brand.brandName}" name prominently on the top header lightbox. Brand color accents on the column.`,
    "FULL MACHINE IN FRAME — entire kiosk visible from top of header to floor contact. Camera pulled back. Plain soft white or very light grey studio background, no room environment. Product studio render quality. No people.",
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
  cover_image_url: string | null
  cabine_top_url: string
  cabine_bottom_url: string
  kiosk_url: string
  goodies_top_url: string
  goodies_bottom_url: string
}> {
  // Cover = no AI image (Python uses brand logo + background color directly)
  const cabineTop    = await generateImage(promptCabine(brand, "top"),    "9:16")
  const cabineBottom = await generateImage(promptCabine(brand, "bottom"), "9:16")
  const kiosk        = await generateImage(promptKiosk(brand),             "9:16")
  const goodiesTop   = await generateImage(promptGoodies(brand, "top"),   "16:9")
  const goodiesBottom = await generateImage(promptGoodies(brand, "bottom"), "16:9")

  return {
    cover_image_url: null,
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
