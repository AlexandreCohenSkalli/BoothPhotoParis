import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { BrandContext, generateAllZones } from "@/lib/imagen"

export const maxDuration = 300 // 5 min — 6 images séquentielles via Google Imagen

const schema = z.object({
  brand_name: z.string().min(1),
  website: z.string().optional(),
  primary_color: z.string().optional(),
  secondary_color: z.string().optional(),
  logo_url: z.string().optional().nullable(),
  description: z.string().optional(),
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

  const { brand_name, primary_color, secondary_color, logo_url, description } = parsed.data

  const brandContext: BrandContext = {
    brandName: brand_name,
    primaryColor: primary_color,
    secondaryColor: secondary_color,
    logoUrl: logo_url,
    description,
  }

  try {
    const zones = await generateAllZones(brandContext)
    return NextResponse.json(zones)
  } catch (err) {
    console.error("Image generation error:", err)
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "Image generation failed", detail },
      { status: 500 }
    )
  }
}
