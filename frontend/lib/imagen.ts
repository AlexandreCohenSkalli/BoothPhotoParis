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
  secteur?: string          // ex: "Luxe", "Mode & Fashion", "Tech & Innovation"...
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
    brand.secteur ? `Industry sector: ${brand.secteur}.` : "",
    "Clean 3D architectural product render, white or very light grey background, sharp and professional, 16:9.",
    "Designed and branded by Booth Photo Paris, the premium Parisian photobooth company.",
    "No people in the image.",
  ].filter(Boolean).join(" ")
}

/** Return a venue / atmosphere description tuned to the brand's sector. */
function secteurVenue(brand: BrandContext): string {
  // Combine description + secteur for keyword matching — description from Brandfetch
  // is usually rich enough (e.g. "Luxury fashion house", "Global tech company", etc.)
  const s = [brand.secteur ?? "", brand.description ?? ""].join(" ").toLowerCase()

  if (s.includes("luxe") || s.includes("luxury") || s.includes("haute couture") || s.includes("maison"))
    return "an opulent palace ballroom with marble floors, gilded mirrors, crystal chandeliers and lush floral arrangements"
  if (s.includes("beaut") || s.includes("cosmetic") || s.includes("skincare") || s.includes("parfum") || s.includes("fragrance"))
    return "a sleek cosmetics launch event space with white walls, pastel florals, warm spotlights and beauty editorial props"
  if (s.includes("mode") || s.includes("fashion") || s.includes("apparel") || s.includes("clothing") || s.includes("textile") || s.includes("wear"))
    return "a high-fashion runway or Parisian atelier loft with exposed brick, dramatic lighting and clothes racks in soft bokeh"
  if (s.includes("tech") || s.includes("software") || s.includes("digital") || s.includes("saas") || s.includes("startup") || s.includes("cloud"))
    return "a futuristic tech conference hall with LED walls, cool blue and purple uplighting and a sleek industrial feel"
  if (s.includes("auto") || s.includes("voiture") || s.includes("car") || s.includes("moteur") || s.includes("motor") || s.includes("vehicle"))
    return "a sleek automotive showroom with polished concrete floors, dramatic spotlights and a hero car on a rotating platform in bokeh"
  if (s.includes("corporate") || s.includes("consulting") || s.includes("finance") || s.includes("bank") || s.includes("insurance") || s.includes("assur"))
    return "a modern corporate event venue with clean architectural lines, neutral tones, blue accent lighting and branded signage"
  if (s.includes("mariage") || s.includes("wedding") || s.includes("événem") || s.includes("event planning"))
    return "an enchanted outdoor wedding reception with fairy lights, lush rose garlands, draped white fabric and candlelit tables"
  if (s.includes("art") || s.includes("culture") || s.includes("museum") || s.includes("galerie") || s.includes("gallery") || s.includes("musée"))
    return "a contemporary art gallery with white walls, track lighting and sculptural installations in soft bokeh"
  if (s.includes("food") || s.includes("restaurant") || s.includes("boisson") || s.includes("beverage") || s.includes("drink") || s.includes("wine") || s.includes("champagne"))
    return "a chic restaurant launch or rooftop cocktail party with warm Edison lights, wooden decor and artisan food displays"
  if (s.includes("sport") || s.includes("fitness") || s.includes("athletic") || s.includes("footwear") || s.includes("running"))
    return "a dynamic sports arena or exclusive athletic brand activation space with bold lighting and energetic crowd in bokeh"
  if (s.includes("retail") || s.includes("boutique") || s.includes("store") || s.includes("shop") || s.includes("commerce"))
    return "a luxury flagship store opening with sleek wall displays, spotlit product shelves and a stylish crowd in bokeh"
  if (s.includes("media") || s.includes("entertainment") || s.includes("music") || s.includes("streaming") || s.includes("film") || s.includes("tv"))
    return "a glamorous entertainment industry event with a red carpet, dramatic uplighting, press photographers in bokeh and a stage backdrop"
  return "an elegant Parisian event space with high ceilings, warm golden chandeliers, marble floors and floral arrangements"
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
 * MODEL 1 (top / Freeform 25) — "Cabine Arrondie" — Dior/Roland Garros style:
 *   - Wide and deep body — almost cubic, wider than it looks tall
 *   - Large rounded arch opening (not full height) — SHORT curtains, padded bench/seat visible at the bottom
 *   - Heavily rounded outer corners on ALL edges and faces (large corner radius)
 *   - Exterior fully wrapped in solid brand color, matte premium finish
 *   - Brand logo vertical on left face + large brand name on right side panel
 *   - Photo print dispensing slot on the front left panel
 *   - 3/4 front-left angle showing front arch face AND right side panel
 *   - Real event atmosphere behind (bokeh)
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
    // Vue 1 — Cabine arrondie style Dior : large, profonde, coins arrondis, siège visible
    const venueStyle = secteurVenue(brand)
    return [
      `High-end editorial photograph of a luxury branded photo booth at a real event for "${brand.brandName}".`,
      "The photo booth is a large wide box — wider and deeper than a standard cabine, almost cubic proportions.",
      "ALL outer corners and edges are heavily rounded with a large radius, giving a soft premium look on every face.",
      "Front face has a tall rounded arch opening (not as tall as the full machine height). SHORT fabric curtains hang inside the arch — they stop mid-way, clearly showing a padded bench/seat at the bottom inside the booth.",
      "Front left panel has a horizontal print dispensing slot and a small camera lens.",
      brand.primaryColor
        ? `Entire exterior — all faces — wrapped in solid ${brand.primaryColor}, matte premium finish.`
        : "Entire exterior in a rich solid brand color, matte premium finish.",
      `Brand logo printed vertically large on the left side face. Brand name "${brand.brandName}" printed large on the right side panel.`,
      `Camera at 3/4 angle showing the arch front face and the right side panel simultaneously.`,
      `Scene: ${venueStyle}. The booth stands on the venue floor, guests in soft bokeh behind, warm uplighting. Elegant aspirational atmosphere.`,
      "FULL MACHINE IN FRAME — entire booth head to toe, floor contact visible. Nothing cropped. No people inside the booth.",
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
