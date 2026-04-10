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
        primary_color: primary_color ?? null,
        logo_url: logo_url ?? null,
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

  // Step 3: Save to Supabase (upsert brand + upload PPTX + log job)
  // Non-blocking: failures here never prevent the user from getting their file.
  let exportedPptxUrl: string | null = null
  try {
    // 3a. Get or create brand by name
    let brandId: string | null = null
    const { data: existingBrand } = await supabase
      .from("brands")
      .select("id")
      .ilike("name", brand_name)
      .maybeSingle()

    if (existingBrand?.id) {
      brandId = existingBrand.id
      // Update colors/logo if we have fresher data
      await supabase.from("brands").update({
        ...(primary_color ? { primary_color } : {}),
        ...(secondary_color ? { secondary_color } : {}),
        ...(logo_url ? { logo_url } : {}),
        ...(description ? { brand_notes: description } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", brandId)
    } else {
      const { data: newBrand } = await supabase
        .from("brands")
        .insert({
          name: brand_name,
          logo_url: logo_url ?? null,
          primary_color: primary_color ?? null,
          secondary_color: secondary_color ?? null,
          brand_notes: description ?? null,
          created_by: session.user.id,
        })
        .select("id")
        .single()
      brandId = newBrand?.id ?? null
    }

    // 3b. Upload PPTX to Storage: exports/{brand_id}/{timestamp}.pptx
    const timestamp = Date.now()
    const storagePath = `exports/${brandId ?? brand_name.replace(/\s+/g, "_")}/${timestamp}.pptx`
    const { error: uploadError } = await supabase.storage
      .from("brand-assets")
      .upload(storagePath, pptxBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        upsert: true,
      })

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from("brand-assets")
        .getPublicUrl(storagePath)
      exportedPptxUrl = publicUrl
    }

    // 3c. Insert generation_jobs record
    if (brandId) {
      await supabase.from("generation_jobs").insert({
        brand_id: brandId,
        status: "completed",
        image_count: 6,
        output_image_urls: [
          zones.cover_image_url.startsWith("data:") ? null : zones.cover_image_url,
          zones.cabine_top_url.startsWith("data:") ? null : zones.cabine_top_url,
          zones.kiosk_url.startsWith("data:") ? null : zones.kiosk_url,
          zones.goodies_top_url.startsWith("data:") ? null : zones.goodies_top_url,
          zones.goodies_bottom_url.startsWith("data:") ? null : zones.goodies_bottom_url,
        ].filter(Boolean) as string[],
        exported_pptx_url: exportedPptxUrl,
        created_by: session.user.id,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
    }
  } catch (saveErr) {
    // Log but don't fail — user still gets their PPTX
    console.error("Supabase save error (non-blocking):", saveErr)
  }

  // Step 4: Return the PPTX file
  const filename = `${brand_name.replace(/\s+/g, "_")}_x_Booth.pptx`
  return new NextResponse(pptxBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...(exportedPptxUrl ? { "X-Pptx-Storage-Url": exportedPptxUrl } : {}),
    },
  })
}
