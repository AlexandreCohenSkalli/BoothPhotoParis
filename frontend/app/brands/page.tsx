import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import BrandsPageClient from "@/components/brands/BrandsPageClient"

export default async function BrandsPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect("/login")

  const { data: brands } = await supabase
    .from("brands")
    .select("*")
    .order("created_at", { ascending: false })

  return <BrandsPageClient initialBrands={brands ?? []} />
}
