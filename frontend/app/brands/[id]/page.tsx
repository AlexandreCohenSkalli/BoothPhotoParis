import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import BrandDetailClient from "@/components/brands/BrandDetailClient"

interface Props {
  params: { id: string }
}

export default async function BrandDetailPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect("/login")

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", params.id)
    .single()

  if (!brand) notFound()

  const { data: jobs } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("brand_id", params.id)
    .order("created_at", { ascending: false })
    .limit(10)

  return <BrandDetailClient brand={brand} jobs={jobs ?? []} />
}
