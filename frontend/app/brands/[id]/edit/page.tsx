import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import BrandForm from "@/components/brands/BrandForm"

interface Props {
  params: { id: string }
}

export default async function EditBrandPage({ params }: Props) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect("/login")

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", params.id)
    .single()

  if (!brand) notFound()

  return <BrandForm brand={brand} mode="edit" />
}
