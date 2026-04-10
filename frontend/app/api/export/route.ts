// @ts-nocheck — legacy route, replaced by generate-pptx pipeline
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const exportSchema = z.object({
  brand_id: z.string().uuid(),
  job_id: z.string().uuid(),
  selected_image_indices: z.array(z.number()).min(1).max(4),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = exportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { brand_id, job_id, selected_image_indices } = parsed.data

  // Fetch brand and job data
  const [{ data: brand }, { data: job }] = await Promise.all([
    supabase.from("brands").select("*").eq("id", brand_id).single(),
    supabase.from("generation_jobs").select("*").eq("id", job_id).single(),
  ])

  if (!brand || !job) {
    return NextResponse.json({ error: "Brand or job not found" }, { status: 404 })
  }

  if (job.status !== "completed" || !job.output_image_urls?.length) {
    return NextResponse.json({ error: "Job not completed or no images available" }, { status: 400 })
  }

  // Get the base presentation from Supabase Storage
  const { data: pptxFile, error: pptxError } = await supabase.storage
    .from("brand-assets")
    .download("templates/base-presentation.pptx")

  if (pptxError || !pptxFile) {
    return NextResponse.json({ error: "Base presentation not found in storage" }, { status: 404 })
  }

  // Call Python API for PPTX manipulation
  const pythonApiUrl = process.env.PYTHON_API_URL
  if (!pythonApiUrl) {
    return NextResponse.json({ error: "Python API not configured" }, { status: 500 })
  }

  const selectedImages = selected_image_indices.map(
    (i) => job.output_image_urls[i]
  )

  const formData = new FormData()
  formData.append("pptx_file", pptxFile, "base-presentation.pptx")
  formData.append("brand_name", brand.name)
  formData.append("logo_url", brand.logo_url ?? "")
  formData.append("image_urls", JSON.stringify(selectedImages))
  formData.append("primary_color", brand.primary_color ?? "")

  const pptxResponse = await fetch(`${pythonApiUrl}/generate-presentation`, {
    method: "POST",
    body: formData,
  })

  if (!pptxResponse.ok) {
    const errText = await pptxResponse.text()
    return NextResponse.json({ error: `PPTX generation failed: ${errText}` }, { status: 500 })
  }

  const pptxBuffer = await pptxResponse.arrayBuffer()

  // Store the generated PPTX
  const filename = `exports/${brand_id}/${job_id}_${Date.now()}.pptx`
  await supabase.storage
    .from("brand-assets")
    .upload(filename, pptxBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      upsert: true,
    })

  const { data: { publicUrl } } = supabase.storage
    .from("brand-assets")
    .getPublicUrl(filename)

  // Update job record with export URL
  await supabase
    .from("generation_jobs")
    .update({ exported_pptx_url: publicUrl })
    .eq("id", job_id)

  // Return the PPTX as a download
  return new NextResponse(pptxBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${brand.name.replace(/\s+/g, "_")}_presentation.pptx"`,
    },
  })
}
