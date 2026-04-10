/**
 * POST /api/generate-pptx
 *
 * All-in-one endpoint:
 * 1. Accepts brand data (from Brandfetch or manually entered)
 * 2. Generates 6 zone images via Google Imagen (AI Studio)
 * 3. Sends images + brand info to Python API
 * 4. Returns the generated .pptx file as a download
 */
export const maxDuration = 300 // 5 min — sequential image gen + retries
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateAllZones, BrandContext } from "@/lib/imagen"
import { z } from "zod"

const schema = z.object({
  brand_name: z.string().min(1),
  website: z.string().optional(),
  primary_color: z.string().optional(),
  secondary_color: z.string().optional(),
  logo_url: z.string().optional().nullable(),
  description: z.string().optional(),
  zones: z
    .object({
      cover_image_url: z.string().min(1),
      cabine_top_url: z.string().min(1),
      cabine_bottom_url: z.string().min(1),
      kiosk_url: z.string().min(1),
      goodies_top_url: z.string().min(1),
      goodies_bottom_url: z.string().min(1),
    })
    .optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { brand_name, website, primary_color, secondary_color, logo_url, description, zones: zonesFromClient } = parsed.data

  const brandContext: BrandContext = {
    brandName: brand_name,
    primaryColor: primary_color,
    secondaryColor: secondary_color,
    logoUrl: logo_url,
    description,
  }

  // Step 1: Generate images unless already provided (preview flow)
  let zones: Awaited<ReturnType<typeof generateAllZones>>
  if (zonesFromClient) {
    zones = zonesFromClient
  } else {
    try {
      zones = await generateAllZones(brandContext)
    } catch (err) {
      console.error("Image generation error:", err)
      const detail = err instanceof Error ? err.message : String(err)
      return NextResponse.json(
        { error: "Image generation failed", detail },
        { status: 500 }
      )
    }
  }

  // Step 2: Call Python API to inject images into PPTX
  const pythonApiUrl = process.env.PYTHON_API_URL ?? "http://localhost:8000"

  let pptxBuffer: ArrayBuffer
  try {
    const pyRes = await fetch(`${pythonApiUrl}/generate-presentation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand_name,
        website: website ?? null,
        ...zones,
      }),
    })

    if (!pyRes.ok) {
      const errText = await pyRes.text()
      throw new Error(`Python API error ${pyRes.status}: ${errText}`)
    }

    pptxBuffer = await pyRes.arrayBuffer()
  } catch (err) {
    console.error("Python API error:", err)
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "PPTX generation failed", detail },
      { status: 500 }
    )
  }

  // Step 3: Return the PPTX file
  const filename = `${brand_name.replace(/\s+/g, "_")}_x_Booth.pptx`
  return new NextResponse(pptxBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
