// @ts-nocheck — legacy route, replaced by generate-pptx pipeline
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const brandSchema = z.object({
  name: z.string().min(1).max(100),
  client_type: z.string().optional(),
  primary_color: z.string().optional(),
  secondary_color: z.string().optional(),
  style_keywords: z.array(z.string()).optional(),
  brand_notes: z.string().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ brands: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = brandSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("brands")
    .insert({
      ...parsed.data,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ brand: data }, { status: 201 })
}
