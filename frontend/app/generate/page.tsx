import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import GenerateFlow from "@/components/generate/GenerateFlow"

export default async function GeneratePage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect("/login")

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Générer une présentation
          </h1>
          <p className="text-muted-foreground">
            Entrez le site internet d&apos;une marque — l&apos;IA s&apos;occupe du reste.
          </p>
        </div>
        <GenerateFlow />
      </div>
    </div>
  )
}
