// @ts-nocheck — legacy route, replaced by generate-pptx pipeline
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: job, error } = await supabase
    .from("generation_jobs")
    .select(`*, brands ( name, logo_url )`)
    .eq("id", params.id)
    .single()

  if (error) return NextResponse.json({ error: "Job not found" }, { status: 404 })
  return NextResponse.json({ job })
}
