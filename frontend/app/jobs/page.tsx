import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import JobsPageClient from "@/components/jobs/JobsPageClient"

export default async function JobsPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect("/login")

  const { data: jobs } = await supabase
    .from("generation_jobs")
    .select(`
      *,
      brands ( name, logo_url )
    `)
    .order("created_at", { ascending: false })
    .limit(50)

  return <JobsPageClient jobs={jobs ?? []} />
}
