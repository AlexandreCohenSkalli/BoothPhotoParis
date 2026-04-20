/**
 * Google Imagen + Gemini 2.0 Flash Image Generation — via Google AI Studio REST API
 * Docs: https://ai.google.dev/api/images
 */
import { readFileSync } from "fs"
import { join } from "path"

export interface BrandContext {
  brandName: string
  primaryColor?: string
  secondaryColor?: string
  logoUrl?: string | null
  description?: string
  secteur?: string          // ex: "Luxe", "Mode & Fashion", "Tech & Innovation"...
  venuePrompt?: string      // prompt libre pour l'environnement (cabine ronde + kiosk)
  kioskPhotoPrompt?: string  // prompt libre pour les 4 photos affichées sur l'écran du kiosk
}

/**
 * Generate a single image via Google Imagen.
 * Returns a base64 data URL — Python decodes it directly (no network download).
 */
export async function generateImage(prompt: string, aspectRatio: "16:9" | "9:16" | "1:1" = "16:9"): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY
  if (!apiKey) throw new Error("GOOGLE_AI_STUDIO_API_KEY not set")

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${encodeURIComponent(apiKey)}`

  const MAX_RETRIES = 4
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(2 ** attempt * 1500, 20000) // 3s, 6s, 12s, 20s
      console.warn(`Imagen retry ${attempt}/${MAX_RETRIES} in ${delay}ms`)
      await new Promise((r) => setTimeout(r, delay))
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio },
      }),
    })

    if (res.ok) {
      const json = await res.json()
      const pred = json.predictions?.[0]
      const b64: string | undefined =
        pred?.bytesBase64Encoded ??
        pred?.image?.bytesBase64Encoded ??
        pred?.imageBytes?.bytesBase64Encoded
      if (!b64) throw new Error("Google Imagen: no image returned")
      return `data:image/png;base64,${b64}`
    }

    if (res.status === 503 || res.status === 429) {
      const errText = await res.text()
      let msg = errText
      try { const p = JSON.parse(errText); if (p?.error?.message) msg = p.error.message } catch {}
      lastError = new Error(`Gemini image generation error (${res.status}): ${msg}`)
      continue // retry
    }

    const errText = await res.text()
    let googleMessage = errText
    try {
      const parsed = JSON.parse(errText)
      if (parsed?.error?.message) googleMessage = String(parsed.error.message)
    } catch { /* keep raw text */ }
    if (/only available on paid plans/i.test(googleMessage)) {
      throw new Error(`Google Imagen access error (${res.status}): ${googleMessage} (Go to https://ai.dev/projects to enable billing.)`)
    }
    throw new Error(`Google Imagen error (${res.status}): ${googleMessage}`)
  }

  throw lastError ?? new Error("Google Imagen: max retries exceeded")
}

/**
 * Generate an image from a reference image + text prompt via Gemini 2.0 Flash.
 * The reference image is read from /public/ on the filesystem.
 * Returns a base64 data URL.
 */
export async function generateImageFromReference(
  referenceImagePath: string, // absolute path to the reference JPEG
  prompt: string,
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:5" | "3:4" = "16:9"
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY
  if (!apiKey) throw new Error("GOOGLE_AI_STUDIO_API_KEY not set")

  // Read reference image as base64
  const imageBuffer = readFileSync(referenceImagePath)
  const imageBase64 = imageBuffer.toString("base64")

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`

  const MAX_RETRIES = 4
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(2 ** attempt * 1500, 20000)
      console.warn(`Gemini image-to-image retry ${attempt}/${MAX_RETRIES} in ${delay}ms`)
      await new Promise((r) => setTimeout(r, delay))
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      let googleMessage = errText
      try {
        const parsed = JSON.parse(errText)
        if (parsed?.error?.message) googleMessage = String(parsed.error.message)
      } catch { /* keep raw */ }
      lastError = new Error(`Gemini image generation error (${res.status}): ${googleMessage}`)
      if (res.status === 503 || res.status === 429) continue // retry
      throw lastError
    }

    const json = await res.json()
    // Response parts: find the image part
    const candidate = json.candidates?.[0]
    const finishReason = candidate?.finishReason ?? "UNKNOWN"
    const parts: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> =
      candidate?.content?.parts ?? []
    const imgPart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"))
    if (!imgPart?.inlineData) {
      const textPart = parts.find((p) => p.text)?.text ?? ""
      const safetyRatings = JSON.stringify(candidate?.safetyRatings ?? [])
      throw new Error(`Gemini: no image returned (finishReason=${finishReason}, text="${textPart.slice(0, 200)}", safety=${safetyRatings})`)
    }

    return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`
  } // end for

  throw lastError ?? new Error("Gemini: max retries exceeded")
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
  // Combine description + secteur + brandName for keyword matching
  const s = [brand.secteur ?? "", brand.description ?? "", brand.brandName ?? ""].join(" ").toLowerCase()

  // Brand-specific venues
  if (s.includes("chanel"))
    return "an elegant Chanel flagship boutique with black and white decor, camellia flowers and gold accents"
  if (s.includes("dior"))
    return "a luxurious Dior beauty boutique with soft pink and cream marble interiors, elegant glass display cases and warm golden lighting"
  if (s.includes("netflix"))
    return "a Netflix premiere event with a bold red carpet, large Netflix logo backdrop, dramatic spotlights and an excited crowd in bokeh"
  if (s.includes("spotify"))
    return "a Spotify Wrapped launch party with colorful LED installations, music visualizer walls and a vibrant crowd"
  if (s.includes("nike"))
    return "a Nike flagship store with dramatic black walls, spotlit sneaker displays and an athletic crowd in bokeh"
  if (s.includes("apple"))
    return "an Apple Store launch event with clean white minimalist interiors, glass tables and dramatic product spotlights"
  if (s.includes("louis vuitton") || s.includes("lv"))
    return "a Louis Vuitton flagship store with monogram decor, gilded fixtures and elegant Parisian atmosphere"
  if (s.includes("hermès") || s.includes("hermes"))
    return "a Hermès boutique with warm orange decor, premium leather goods on display and refined Parisian lighting"

  // Water / mineral water brands (check BEFORE generic food/drink to avoid false positives)
  if (s.includes("evian") || s.includes("volvic") || s.includes("perrier") || s.includes("vittel") || s.includes("badoit") ||
      s.includes("mineral water") || s.includes("spring water") || s.includes("eau minérale") || s.includes("eau naturelle") ||
      s.includes("natural mineral water") || s.includes("french alps") || s.includes("eaux") ||
      (/\bwater\b/.test(s) && (s.includes("mineral") || s.includes("spring") || s.includes("natural") || s.includes("alps"))))
    return "a bright outdoor alpine festival with snow-capped mountain peaks, fresh blue sky, crystal-clear spring water flowing, lush green Alp meadows and a joyful active crowd in bokeh"

  if (s.includes("luxe") || s.includes("luxury") || s.includes("haute couture") || s.includes("maison"))
    return "an opulent palace ballroom with marble floors, gilded mirrors, crystal chandeliers and lush floral arrangements"
  if (s.includes("beaut") || s.includes("cosmetic") || s.includes("skincare") || s.includes("parfum") || s.includes("fragrance"))
    return "a sleek cosmetics launch event space with white walls, pastel florals, warm spotlights and beauty editorial props"
  if (s.includes("mode") || s.includes("fashion") || s.includes("apparel") || s.includes("clothing") || s.includes("textile") || s.includes("wear"))
    return "a high-fashion runway or Parisian atelier loft with exposed brick, dramatic lighting and clothes racks in soft bokeh"
  if (s.includes("tech") || s.includes("software") || s.includes("digital") || s.includes("saas") || s.includes("startup") || s.includes("cloud"))
    return "a futuristic tech conference hall with LED walls, cool blue and purple uplighting and a sleek industrial feel"
  // Use word boundary for 'car' to avoid false positive on 'carbon', 'scar', 'cartoon'
  if (s.includes("automobile") || s.includes("voiture") || /\bcar\b/.test(s) || s.includes("moteur") || /\bmotor\b/.test(s) || s.includes("vehicle") || s.includes(" auto ") || s.includes("automotive"))
    return "a sleek automotive showroom with polished concrete floors, dramatic spotlights and a hero car on a rotating platform in bokeh"
  if (s.includes("corporate") || s.includes("consulting") || s.includes("finance") || s.includes("bank") || s.includes("insurance") || s.includes("assur"))
    return "a modern corporate event venue with clean architectural lines, neutral tones, blue accent lighting and branded signage"
  if (s.includes("mariage") || s.includes("wedding") || s.includes("événem") || s.includes("event planning"))
    return "an enchanted outdoor wedding reception with fairy lights, lush rose garlands, draped white fabric and candlelit tables"
  if (s.includes("art") || s.includes("culture") || s.includes("museum") || s.includes("galerie") || s.includes("gallery") || s.includes("musée"))
    return "a contemporary art gallery with white walls, track lighting and sculptural installations in soft bokeh"
  if (s.includes("food") || s.includes("restaurant") || s.includes("boisson") || s.includes("beverage") || s.includes("drink") || s.includes("wine") || s.includes("champagne") || /\bwater\b/.test(s) || s.includes("eau"))
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
 * Returns a short description of what iconic brand products / visuals to show
 * in the three photo-strip slots of the cabine carrée, tailored to the brand's sector.
 */
function secteurSlotContent(brand: BrandContext): string {
  const s = [brand.secteur ?? "", brand.description ?? "", brand.brandName ?? ""].join(" ").toLowerCase()

  if (s.includes("chanel")) return "iconic Chanel N°5 perfume bottles, a Chanel quilted handbag, and the Chanel double-C logo against a black background"
  if (s.includes("dior")) return "iconic Dior Sauvage fragrance bottle, a Lady Dior bag, and a Dior fashion runway look"
  if (s.includes("netflix")) return "iconic Netflix movie and series posters (Stranger Things, Squid Game, Wednesday) displayed as film stills"
  if (s.includes("spotify")) return "Spotify Wrapped colorful cards, album cover art collage, and music waveform visuals"
  if (s.includes("apple")) return "sleek Apple products — iPhone, MacBook, AirPods — on a clean white background"
  if (s.includes("nike")) return "iconic Nike sneakers (Air Jordan, Air Max), a running athlete silhouette, and the Nike swoosh"
  if (s.includes("louis vuitton") || s.includes("lv")) return "Louis Vuitton monogram bags, leather goods, and runway fashion looks"
  if (s.includes("hermès") || s.includes("hermes")) return "Hermès Birkin bag, silk scarves, and equestrian leather goods on a warm background"
  if (s.includes("rolex")) return "close-up of a Rolex Submariner, Daytona, and Datejust watches on dark velvet"

  if (s.includes("luxe") || s.includes("luxury") || s.includes("haute couture") || s.includes("maison"))
    return `iconic ${brand.brandName} luxury products — signature bags, perfumes, or jewelry — in editorial photography style`
  if (s.includes("beauty") || s.includes("beaut") || s.includes("cosmetic") || s.includes("skincare") || s.includes("parfum") || s.includes("fragrance"))
    return `${brand.brandName} hero fragrance or skincare bottles, a flat-lay of cosmetics, and a beauty campaign visual`
  if (s.includes("mode") || s.includes("fashion") || s.includes("apparel") || s.includes("clothing") || s.includes("wear"))
    return `${brand.brandName} signature clothing pieces, runway look, and accessories in editorial style`
  if (s.includes("tech") || s.includes("software") || s.includes("digital") || s.includes("saas") || s.includes("startup"))
    return `${brand.brandName} app interface screenshot, a product hero shot, and a team collaboration visual`
  if (s.includes("auto") || s.includes("voiture") || s.includes("car") || s.includes("motor") || s.includes("vehicle"))
    return `${brand.brandName} hero car model in dramatic studio lighting, dashboard close-up, and outdoor action shot`
  if (s.includes("food") || s.includes("restaurant") || s.includes("boisson") || s.includes("beverage") || s.includes("drink") || s.includes("wine") || s.includes("champagne"))
    return `${brand.brandName} signature dish or drink, ingredient flat-lay, and a restaurant or venue atmosphere shot`
  if (s.includes("music") || s.includes("streaming") || s.includes("entertainment") || s.includes("media") || s.includes("film") || s.includes("tv"))
    return `${brand.brandName} iconic show or album covers, a concert atmosphere, and a talent portrait`
  if (s.includes("sport") || s.includes("fitness") || s.includes("athletic") || s.includes("running"))
    return `${brand.brandName} athletic gear, an action sports shot, and athlete portrait`
  if (s.includes("finance") || s.includes("bank") || s.includes("insurance") || s.includes("corporate") || s.includes("consulting"))
    return `${brand.brandName} brand visuals — a city skyline at night, a handshake close-up, and the company logo on signage`

  return `${brand.brandName} iconic product or service visual, a brand lifestyle shot, and the company logo on a clean background`
}

/**
 * Zone 2/3 — Cabine renders (image-to-image via Gemini 2.0 Flash)
 *
 * MODEL 1 (top / Freeform 25) — "Cabine Arrondie" — ref: modeleclassiquerond.jpeg
 * MODEL 2 (bottom / Freeform 24) — "Cabine Carrée" — ref: modeleclassiquecarre.jpeg
 */

/** Prompt for Freeform 25 — cabine arrondie */
export function promptCabineRonde(brand: BrandContext): string {
  const colorLine = brand.primaryColor
    ? `The entire exterior of the booth must use the brand's primary color ${brand.primaryColor}${brand.secondaryColor ? ` with secondary color ${brand.secondaryColor} as accent` : ""} as the main wrap color, perfectly smooth and matte.`
    : ""
  return [
    `This is a reference photo of a Booth Paris rounded photo booth. Recreate this exact photo booth in the exact same style, 3/4 angle, lighting, and composition,`,
    `but fully re-branded for the company "${brand.brandName}". Output image must be portrait 4:5 aspect ratio.`,
    colorLine,
    `Replace any logo, text, or branding on the machine with the "${brand.brandName}" name and logo, large and clearly visible.`,
    brand.description ? `Brand identity: ${brand.description}.` : "",
    brand.secteur ? `Industry: ${brand.secteur}.` : "",
    `The booth is photographed at a real ${brand.venuePrompt ?? secteurVenue(brand)}. Guests in soft bokeh behind.`,
    "Keep the exact same machine shape, rounded corners, arch opening, and curtains as in the reference image.",
    "Full machine in frame — head to toe visible, nothing cropped. No people inside the booth.",
  ].filter(Boolean).join(" ")
}

/** Prompt for Freeform 24 — cabine carrée (surgical edit: right panel + 3 left slots only) */
export function promptCabineCarree(brand: BrandContext): string {
  const slotContent = secteurSlotContent(brand)
  const colorLine = brand.primaryColor
    ? `Use the brand's primary color ${brand.primaryColor} as the background for the right panel branding area.`
    : "Keep the existing panel color."

  return [
    `This is a reference photo of a square Booth Paris photo booth (cabine carrée). Output image must be square 1:1 aspect ratio.`,
    `Make only two surgical changes — do NOT modify anything else in the image:`,

    `CHANGE 1 — Large textured right-side panel:`,
    `On the right face of the booth, there is a large white textured rectangular panel in perspective.`,
    `Keep its exact shape, size, perspective, and position in the image.`,
    `Replace only its surface with a clean solid branded wrap for "${brand.brandName}":`,
    colorLine,
    `Add the "${brand.brandName}" brand name in large clean typography and the brand logo, centered on the panel.`,
    `The result must look like a premium branded vinyl wrap — perfectly smooth, matte, no texture, no pattern.`,

    `CHANGE 2 — Three white photo-strip rectangles on the left:`,
    `On the left column of the booth there are three small vertical white rectangles (photo strip slots).`,
    `Replace the content of each rectangle with a distinct photographic image related to "${brand.brandName}":`,
    `Slot 1: ${slotContent.split(",")[0] ?? `${brand.brandName} iconic product`}.`,
    `Slot 2: ${slotContent.split(",")[1] ?? `${brand.brandName} lifestyle visual`}.`,
    `Slot 3: ${slotContent.split(",")[2] ?? `${brand.brandName} brand visual`}.`,
    `Each slot image must be a real editorial photo, sharp, no text overlay.`,

    `Keep everything else in the image exactly as it is: the booth structure, the floor, the background, the lighting, the shadows, the camera angle, and all other elements.`,
    brand.description ? `Brand context: ${brand.description}.` : "",
  ].filter(Boolean).join(" ")
}

/** Returns the absolute filesystem path to a reference image in /public. */
function refImagePath(filename: string): string {
  return join(process.cwd(), "public", filename)
}

/**
/** Imagen text-to-image fallback prompt for cabine ronde */
function promptCabineRondeFallback(brand: BrandContext): string {
  const venue = secteurVenue(brand)
  return [
    `Editorial photograph of a premium rounded photo booth at ${venue}.`,
    `The booth has heavily rounded corners, a large arch opening with short curtains, a padded bench inside, and a print dispensing slot on the front panel.`,
    brand.primaryColor ? `Entire exterior wrapped in solid ${brand.primaryColor}, matte premium finish.` : "Exterior in a rich solid dark color, matte premium finish.",
    `Brand name "${brand.brandName}" printed large on the side panel. Brand logo visible on the front.`,
    `3/4 angle, guests in soft bokeh behind, warm uplighting. Full machine in frame, nothing cropped. No people inside.`,
    brand.description ? `Brand: ${brand.description}.` : "",
  ].filter(Boolean).join(" ")
}

/** Imagen text-to-image fallback prompt for cabine carrée */
function promptCabineCarreeFallback(brand: BrandContext): string {
  const slotContent = secteurSlotContent(brand)
  return [
    `SketchUp-style 3D technical render of a square photo booth (148cm × 148cm × 189cm) branded for "${brand.brandName}".`,
    `Rectangular box, sharp corners, flat roof. Front face has a rectangular opening with vertical curtains. Left narrow panel has a print slot. Right side panel has a large branded graphic.`,
    brand.primaryColor ? `Panels in ${brand.primaryColor}. Right side panel shows "${brand.brandName}" name and logo large on ${brand.primaryColor} background.` : `Dark panels with "${brand.brandName}" name and logo large on the right side panel.`,
    `Three small vertical photo strip rectangles on the left column showing: ${slotContent.split(",").slice(0,3).join(",")}.`,
    `Light grey SketchUp ground plane, technical render style, 3/4 front-right perspective. Full machine in frame, nothing cropped.`,
  ].filter(Boolean).join(" ")
}

/** Imagen text-to-image fallback prompt for kiosk */
function promptKioskFallback(brand: BrandContext): string {
  const venue = secteurVenue(brand)
  const photos = kioskPhotoContent(brand)
  return [
    `Editorial photograph of a freestanding photobooth kiosk tower for "${brand.brandName}" placed in ${venue}.`,
    `The kiosk is a tall slim rectangular column. Top header panel shows "${brand.brandName}" brand name large. Below the header is a thin black camera flash bar. Center has a large vertical screen showing ${photos}. Bottom has a print dispensing slot.`,
    brand.primaryColor ? `Exterior in solid ${brand.primaryColor}, matte premium finish.` : "Exterior in matte dark premium finish.",
    `Full machine in frame top to floor, portrait orientation, soft bokeh background, editorial lighting. No people.`,
    brand.description ? `Brand: ${brand.description}.` : "",
  ].filter(Boolean).join(" ")
}

/**
 * Generate a cabine image using the reference photo + Gemini image-to-image.
 * Automatically falls back to Imagen text-to-image if Gemini refuses (IMAGE_OTHER).
 */
export async function generateCabine(
  brand: BrandContext,
  model: "ronde" | "carree"
): Promise<string> {
  const refFile = model === "ronde" ? "ref-cabine-ronde.jpeg" : "ref-cabine-carree.jpeg"
  const prompt = model === "ronde" ? promptCabineRonde(brand) : promptCabineCarree(brand)
  const aspectRatio = model === "ronde" ? "4:5" : "1:1"
  try {
    return await generateImageFromReference(refImagePath(refFile), prompt, aspectRatio)
  } catch (err) {
    console.warn(`Gemini cabine ${model} refused, retrying with simplified prompt:`, err)
    // Retry with minimal prompt — no brand-specific details that trigger content policy
    const simple = [
      `Restyle this photo booth for a brand called "${brand.brandName}".`,
      model === "ronde"
        ? `Keep the exact same rounded booth shape, arch opening, curtains, bench, and 3/4 angle.`
        : `Keep the exact same square booth shape, structure, and perspective.`,
      brand.primaryColor ? `Change the exterior color to ${brand.primaryColor}.` : "",
      `Replace any text or logo with "${brand.brandName}". Keep everything else identical.`,
    ].filter(Boolean).join(" ")
    return generateImageFromReference(refImagePath(refFile), simple, aspectRatio)
  }
}

/**
 * Zone 4 — Kiosk (image-to-image via Gemini 2.5 Flash)
 * Reference: ref-kiosk.jpeg (Jimmy Fairly kiosk)
 * Freeform 8: 5.78" x 9.71" ≈ 9:16 portrait
 */

/** Returns the 4 photo content descriptions shown on the kiosk screen.
 * Always shows natural photobooth-style photos of real people — like guests actually using the booth. */
function kioskPhotoContent(brand: BrandContext): string {
  const s = [brand.secteur ?? "", brand.description ?? "", brand.brandName ?? ""].join(" ").toLowerCase()

  // Luxury / fashion — elegant but still candid
  if (s.includes("luxe") || s.includes("luxury") || s.includes("haute couture") || s.includes("maison") ||
      s.includes("chanel") || s.includes("dior") || s.includes("hermes") || s.includes("hermès") ||
      s.includes("louis vuitton") || s.includes("lv"))
    return `4 candid photobooth photos of two elegantly dressed women smiling and laughing together, natural joyful expressions, white photo strip template frame with "${brand.brandName}" text at the bottom`

  // Sport / energy
  if (s.includes("sport") || s.includes("fitness") || s.includes("athletic") || s.includes("running") || s.includes("nike") || s.includes("adidas"))
    return `4 fun photobooth photos of two friends in sporty casual outfits, big smiles and playful poses, clean white photo strip template with "${brand.brandName}" at the bottom`

  // Entertainment / music
  if (s.includes("music") || s.includes("streaming") || s.includes("entertainment") || s.includes("media") || s.includes("film") || s.includes("tv") || s.includes("netflix") || s.includes("spotify"))
    return `4 fun photobooth photos of two young friends laughing and making silly faces, vibrant photo strip template with "${brand.brandName}" at the bottom`

  // Water / mineral water brands
  if (s.includes("evian") || s.includes("volvic") || s.includes("perrier") || s.includes("vittel") || s.includes("badoit") ||
      s.includes("mineral water") || s.includes("spring water") || s.includes("natural mineral water") || s.includes("french alps") ||
      (/\bwater\b/.test(s) && (s.includes("mineral") || s.includes("spring") || s.includes("alps"))))
    return `4 fresh photobooth photos of two smiling young friends at a summer outdoor event, each holding a ${brand.brandName} water bottle, laughing and posing in a fun natural way, light blue photo strip template with "${brand.brandName}" at the bottom`

  // Food & drinks
  if (s.includes("food") || s.includes("restaurant") || s.includes("boisson") || s.includes("beverage") || s.includes("drink") || s.includes("wine") || s.includes("champagne") || /\bwater\b/.test(s) || s.includes("eau"))
    return `4 joyful photobooth photos of two friends clinking glasses and smiling, warm-toned photo strip template with "${brand.brandName}" at the bottom`

  // Default — universal photobooth vibe
  return `4 natural photobooth photos of two smiling friends making fun poses together, classic white photo strip template frame with "${brand.brandName}" text at the bottom`
}

export function promptKiosk(brand: BrandContext): string {
  const venue = secteurVenue(brand)
  const photos = kioskPhotoContent(brand)
  const exteriorColor = brand.primaryColor
    ? `${brand.primaryColor} matte finish`
    : `dark matte black finish`
  const headerBg = brand.primaryColor
    ? `${brand.primaryColor} background`
    : `dark background`

  return [
    `Restyle the photobooth kiosk in this reference image for the brand "${brand.brandName}". Keep only the kiosk shape and physical structure. Output: portrait 9:16.`,

    `TOP HEADER: replace existing brand name with "${brand.brandName}" in official brand typography, on a ${headerBg}.`,
    `FLASH BAR: the thin horizontal bar just below the header is a camera flash unit — keep it solid BLACK, no text.`,
    `MACHINE BODY: repaint the entire exterior in ${exteriorColor}. CRITICAL — erase EVERY occurrence of the text "Jimmy Fairly" on the machine: top header, bottom footer strip, side panels, anywhere. Replace every instance with "${brand.brandName}" in clean brand typography. No trace of "Jimmy Fairly" must remain anywhere on the kiosk.`,
    `BOTTOM FOOTER: the strip at the very base of the kiosk that reads "Jimmy Fairly" must be fully replaced with "${brand.brandName}" in large, centered, clean typography.`,
    `SCREEN PANEL: IMPORTANT — the reference screen shows people trying on eyeglasses. Completely erase this content and replace it entirely with: a 2×2 grid of ${brand.kioskPhotoPrompt ?? photos}. At the bottom of the screen grid, show "${brand.brandName}" in a clean white photo strip template. Do NOT show any glasses, eyewear, or optician content.`,
    `BACKGROUND: place the kiosk in ${brand.venuePrompt ?? venue}, realistic lighting, soft bokeh. The background must look like ${brand.venuePrompt ?? venue}. Do NOT use a store interior or showroom unrelated to the brand.`,

    `Keep the full kiosk in frame (top to floor). Editorial product photography.`,
    brand.description ? `Brand: ${brand.description}.` : "",
  ].filter(Boolean).join(" ")
}

/** Generate kiosk image using Jimmy Fairly reference + Gemini image-to-image.
 * On refusal, retries with a minimal prompt to avoid content policy triggers while keeping the reference shape. */
export async function generateKiosk(brand: BrandContext): Promise<string> {
  try {
    return await generateImageFromReference(refImagePath("ref-kiosk.jpeg"), promptKiosk(brand), "9:16")
  } catch (err) {
    console.warn("Gemini kiosk refused, retrying with simplified prompt:", err)
    const simple = [
      `Using this reference image for the kiosk SHAPE ONLY, create a photobooth kiosk for brand "${brand.brandName}".`,
      `DO NOT keep: the store background, the glasses/eyewear products, the "Jimmy Fairly" text anywhere (top, bottom, sides), or the people wearing glasses in the screen photos.`,
      `REPLACE WITH: background = ${brand.venuePrompt ?? secteurVenue(brand)}. Screen = 4 photos of ${brand.kioskPhotoPrompt ?? "two happy people smiling and posing"}. All text on the kiosk = "${brand.brandName}" only — header AND bottom footer strip.`,
      brand.primaryColor ? `Machine exterior color: ${brand.primaryColor}.` : "",
      `Keep only the kiosk shape and proportions from the reference.`,
    ].filter(Boolean).join(" ")
    return generateImageFromReference(refImagePath("ref-kiosk.jpeg"), simple, "9:16")
  }
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
 * Generate all zone images for a brand.
 * Cabines: Gemini image-to-image from reference photos.
 * Kiosk + goodies: Imagen text-to-image.
 * Returns an object matching the Python API's GenerateRequest fields.
 */
export async function generateAllZones(brand: BrandContext): Promise<{
  cover_image_url: string | null
  cabine_ronde_url: string
  cabine_carree_url: string
  kiosk_url: string
  goodies_top_url: string
  goodies_bottom_url: string
}> {
  // Run all generations in parallel
  const [cabineRonde, cabineCarree, kiosk, goodiesTop, goodiesBottom] = await Promise.all([
    generateCabine(brand, "ronde"),
    generateCabine(brand, "carree"),
    generateKiosk(brand),
    generateImage(promptGoodies(brand, "top"), "16:9"),
    generateImage(promptGoodies(brand, "bottom"), "16:9"),
  ])

  return {
    cover_image_url: null,
    cabine_ronde_url: cabineRonde,
    cabine_carree_url: cabineCarree,
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
