import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import DashboardHome from "@/components/dashboard/DashboardHome"

export default async function Home() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  // Fetch summary stats
  const [{ count: brandCount }, { count: jobCount }] = await Promise.all([
    supabase.from("brands").select("*", { count: "exact", head: true }),
    supabase
      .from("generation_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
  ])

  // Recent brands
  const { data: recentBrands } = await supabase
    .from("brands")
    .select("id, name, logo_url, created_at")
    .order("created_at", { ascending: false })
    .limit(5)

  return (
    <DashboardHome
      stats={{ brandCount: brandCount ?? 0, jobCount: jobCount ?? 0 }}
      recentBrands={recentBrands ?? []}
    />
  )
}
