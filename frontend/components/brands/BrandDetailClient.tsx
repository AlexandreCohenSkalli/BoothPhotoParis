"use client"

import Image from "next/image"
import Link from "next/link"
import { Brand, GenerationJob } from "@/types/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Sparkles, Edit2, Building2, Calendar, Tag } from "lucide-react"
import { formatDate } from "@/lib/utils"
import JobStatusBadge from "@/components/jobs/JobStatusBadge"

interface Props {
  brand: Brand
  jobs: GenerationJob[]
}

export default function BrandDetailClient({ brand, jobs }: Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
        <Link href="/brands"><ArrowLeft className="w-4 h-4" /> Retour</Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center overflow-hidden">
            {brand.logo_url ? (
              <Image src={brand.logo_url} alt={brand.name} width={64} height={64} className="object-contain p-1" />
            ) : (
              <Building2 className="w-7 h-7 text-muted-foreground" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{brand.name}</h1>
            {brand.client_type && (
              <p className="text-muted-foreground text-sm mt-0.5">{brand.client_type}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link href={`/brands/${brand.id}/edit`}>
              <Edit2 className="w-3.5 h-3.5" /> Modifier
            </Link>
          </Button>
          <Button variant="gold" size="sm" asChild className="gap-2">
            <Link href={`/generate?brand=${brand.id}`}>
              <Sparkles className="w-3.5 h-3.5" /> Générer
            </Link>
          </Button>
        </div>
      </div>

      {/* Brand details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="w-3.5 h-3.5" /> Identité visuelle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {brand.primary_color && (
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full border border-border"
                  style={{ backgroundColor: brand.primary_color }}
                />
                <span className="text-sm text-foreground">{brand.primary_color}</span>
                <span className="text-xs text-muted-foreground">Principale</span>
              </div>
            )}
            {brand.secondary_color && (
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full border border-border"
                  style={{ backgroundColor: brand.secondary_color }}
                />
                <span className="text-sm text-foreground">{brand.secondary_color}</span>
                <span className="text-xs text-muted-foreground">Secondaire</span>
              </div>
            )}
            {brand.style_keywords && brand.style_keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {brand.style_keywords.map((kw) => (
                  <Badge key={kw} variant="gold" className="text-xs">{kw}</Badge>
                ))}
              </div>
            )}
            {!brand.primary_color && !brand.style_keywords?.length && (
              <p className="text-sm text-muted-foreground">Aucune info visuelle renseignée</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Informations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Créée le</span>
              <span className="text-foreground">{formatDate(brand.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Générations</span>
              <span className="text-foreground">{jobs.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {brand.brand_notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-wrap">{brand.brand_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Jobs history */}
      <div>
        <h2 className="text-base font-semibold mb-3">Historique des générations</h2>
        {jobs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <Sparkles className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune génération pour cette marque</p>
              <Button variant="outline" size="sm" asChild className="mt-3">
                <Link href={`/generate?brand=${brand.id}`}>Lancer une génération</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <Card key={job.id} className="hover:border-gold/20 transition-colors">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <JobStatusBadge status={job.status} />
                      <span className="text-sm text-muted-foreground">{formatDate(job.created_at)}</span>
                      <span className="text-xs text-muted-foreground">{job.image_count} image{job.image_count > 1 ? "s" : ""}</span>
                    </div>
                    {job.exported_pptx_url && (
                      <a
                        href={job.exported_pptx_url}
                        download
                        className="text-xs text-gold hover:text-gold-light transition-colors"
                      >
                        Télécharger PPTX
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
