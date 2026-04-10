/**
 * fal.ai — Flux Pro image generation
 * Docs: https://fal.ai/models/fal-ai/flux-pro
 */

const FAL_API_URL = "https://fal.run/fal-ai/flux-pro"

export interface BrandContext {
  brandName: string
  primaryColor?: string   // hex e.g. "#D4AF37"
  secondaryColor?: string
  logoUrl?: string | null
  description?: string
}

interface FalImage {
  url: string
  width: number
  height: number
  content_type: string
}

interface FalResponse {
  images: FalImage[]
  seed?: number
}

/**
 * Generate a single image via fal.ai Flux Pro.
 */
export async function generateImage(prompt: string): Promise<string> {
  const apiKey = process.env.FAL_KEY
  if (!apiKey) throw new Error("FAL_KEY is not set")

  const response = await fetch(FAL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      num_images: 1,
      image_size: "landscape_16_9",
      num_inference_steps: 28,
      guidance_scale: 3.5,
      safety_tolerance: "2",
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`fal.ai error ${response.status}: ${error}`)
  }

  const data: FalResponse = await response.json()
  if (!data.images?.length) throw new Error("fal.ai returned no images")
  return data.images[0].url
}

/**
 * Generate multiple images in parallel via fal.ai Flux Pro.
 */
export async function generateBrandImages(prompt: string, count: number = 4): Promise<string[]> {
  const promises = Array.from({ length: count }, () => generateImage(prompt))
  return Promise.all(promises)
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
  const [cover, cabineTop, cabineBottom, kiosk, goodiesTop, goodiesBottom] =
    await Promise.all([
      generateImage(promptCover(brand)),
      generateImage(promptCabine(brand, "top")),
      generateImage(promptCabine(brand, "bottom")),
      generateImage(promptKiosk(brand)),
      generateImage(promptGoodies(brand, "top")),
      generateImage(promptGoodies(brand, "bottom")),
    ])

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
