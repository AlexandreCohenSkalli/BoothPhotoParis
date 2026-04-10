import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { generateBrandImages } from "@/lib/imagen"
import { z } from "zod"

const generateSchema = z.object({
  brand_id: z.string().uuid(),
  image_count: z.number().int().min(1).max(4).default(4),
  custom_prompt_suffix: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = generateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { brand_id, image_count, custom_prompt_suffix } = parsed.data

  // Fetch brand info
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brand_id)
    .single()

  if (brandError || !brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 })
  }

  // Create a pending job
  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .insert({
      brand_id,
      status: "pending",
      image_count,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 })

  // Trigger generation asynchronously (fire and forget)
  // The actual generation updates the job record when done
  processGenerationJob(brand, job.id, image_count, custom_prompt_suffix, supabase)

  return NextResponse.json({ job_id: job.id, status: "pending" }, { status: 202 })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processGenerationJob(brand: any, jobId: string, imageCount: number, customSuffix: string | undefined, supabase: any) {
  try {
    // Update to processing
    await supabase
      .from("generation_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", jobId)

    // Build Imagen prompt from brand profile
    const prompt = buildImagenPrompt(brand, customSuffix)

    // Generate images via Google Imagen 3
    const imageUrls = await generateBrandImages(prompt, imageCount)

    // Upload images to Supabase Storage
    const storedUrls: string[] = []
    for (let i = 0; i < imageUrls.length; i++) {
      const response = await fetch(imageUrls[i])
      const buffer = await response.arrayBuffer()
      const filePath = `generations/${jobId}/image_${i + 1}.png`

      const { error: uploadError } = await supabase.storage
        .from("brand-assets")
        .upload(filePath, buffer, { contentType: "image/png", upsert: true })

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from("brand-assets")
          .getPublicUrl(filePath)
        storedUrls.push(publicUrl)
      }
    }

    // Mark job as completed
    await supabase
      .from("generation_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        output_image_urls: storedUrls,
        prompt_used: prompt,
      })
      .eq("id", jobId)

  } catch (err) {
    console.error("Generation job failed:", err)
    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "Unknown error",
      })
      .eq("id", jobId)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildImagenPrompt(brand: any, customSuffix?: string): string {
  const keywords = Array.isArray(brand.style_keywords)
    ? brand.style_keywords.join(", ")
    : ""

  const base = [
    `Professional luxury photobooth setup at an upscale Parisian event`,
    `branded with "${brand.name}" logo prominently displayed`,
    `elegant backdrop, soft professional lighting`,
    keywords ? `style: ${keywords}` : "",
    `premium event photography aesthetic`,
    `high-end corporate or luxury celebration`,
    `photorealistic, high resolution, editorial quality`,
  ]
    .filter(Boolean)
    .join(", ")

  return customSuffix ? `${base}, ${customSuffix}` : base
}
