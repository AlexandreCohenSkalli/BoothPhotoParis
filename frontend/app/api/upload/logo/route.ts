import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const brandId = formData.get("brand_id") as string | null

  if (!file || !brandId) {
    return NextResponse.json({ error: "Missing file or brand_id" }, { status: 400 })
  }

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are accepted" }, { status: 400 })
  }

  // max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File exceeds 5MB limit" }, { status: 400 })
  }

  const ext = file.name.split(".").pop()
  const filePath = `logos/${brandId}/logo.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("brand-assets")
    .upload(filePath, file, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from("brand-assets")
    .getPublicUrl(filePath)

  // Update brand record
  await supabase
    .from("brands")
    .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", brandId)

  return NextResponse.json({ url: publicUrl })
}
