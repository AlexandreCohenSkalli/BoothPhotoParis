"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { GenerationJob } from "@/types/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ClipboardList, Download, ImageIcon, Search, Trash2 } from "lucide-react"
import { formatDate } from "@/lib/utils"
import JobStatusBadge from "./JobStatusBadge"

interface JobWithBrand extends GenerationJob {
  brands: { name: string; logo_url: string | null } | null
}

export default function JobsPageClient({ jobs: initialJobs }: { jobs: JobWithBrand[] }) {
  const [jobs, setJobs] = useState<JobWithBrand[]>(initialJobs)
  const [search, setSearch] = useState("")
  const [deleting, setDeleting] = useState<Set<string>>(new Set())

  const filtered = jobs.filter((j) =>
    (j.brands?.name ?? "").toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette génération ?")) return
    setDeleting((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" })
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== id))
      } else {
        alert("Erreur lors de la suppression")
      }
    } finally {
      setDeleting((prev) => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historique</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {filtered.length} génération{filtered.length !== 1 ? "s" : ""}
            {search && ` · filtré sur "${search}"`}
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher une marque…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {jobs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucune génération pour l&apos;instant</p>
            <Button variant="outline" size="sm" asChild className="mt-4">
              <Link href="/generate">Lancer une génération</Link>
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Aucun résultat pour &quot;{search}&quot;</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <Card key={job.id} className="hover:border-gold/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Thumbnail strip */}
                  {job.output_image_urls && job.output_image_urls.length > 0 ? (
                    <div className="flex gap-1 shrink-0">
                      {job.output_image_urls.slice(0, 3).map((url, i) => (
                        <div key={i} className="w-14 h-10 rounded-md overflow-hidden border border-border relative">
                          <Image src={url} alt={`Image ${i + 1}`} fill className="object-cover" />
                        </div>
                      ))}
                      {job.output_image_urls.length > 3 && (
                        <div className="w-14 h-10 rounded-md border border-border flex items-center justify-center bg-muted">
                          <span className="text-xs text-muted-foreground">+{job.output_image_urls.length - 3}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-14 h-10 rounded-md border border-dashed border-border flex items-center justify-center bg-muted shrink-0">
                      <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">
                        {job.brands?.name ?? "Marque inconnue"}
                      </span>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(job.created_at)} · {job.image_count} image{job.image_count > 1 ? "s" : ""}
                    </p>
                    {job.error_message && (
                      <p className="text-xs text-red-400 mt-1 truncate">{job.error_message}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {job.exported_pptx_url && (
                      <Button variant="outline" size="sm" asChild className="gap-1.5 h-8 text-xs">
                        <a href={job.exported_pptx_url} download>
                          <Download className="w-3 h-3" /> PPTX
                        </a>
                      </Button>
                    )}
                    {job.status === "completed" && !job.exported_pptx_url && job.brand_id && (
                      <Button variant="outline" size="sm" asChild className="h-8 text-xs">
                        <Link href={`/generate?brand=${job.brand_id}&job=${job.id}`}>
                          Exporter
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                      onClick={() => handleDelete(job.id)}
                      disabled={deleting.has(job.id)}
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
