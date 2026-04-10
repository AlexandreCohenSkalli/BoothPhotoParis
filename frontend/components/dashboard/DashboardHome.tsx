"use client"

import Link from "next/link"
import Image from "next/image"
import { Brand } from "@/types/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, Sparkles, CheckCircle2, ArrowRight, Plus } from "lucide-react"
import { formatDateShort } from "@/lib/utils"

interface Props {
  stats: { brandCount: number; jobCount: number }
  recentBrands: Pick<Brand, "id" | "name" | "logo_url" | "created_at">[]
}

export default function DashboardHome({ stats, recentBrands }: Props) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-gold-gradient">
          Booth Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Génération de visuels et présentations de marque
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-gold/20 hover:border-gold/40 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-widest mb-1">Marques</p>
                <p className="text-3xl font-bold text-foreground">{stats.brandCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-gold" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-widest mb-1">Générations</p>
                <p className="text-3xl font-bold text-foreground">{stats.jobCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Button variant="gold" asChild className="gap-2">
          <Link href="/generate">
            <Sparkles className="w-4 h-4" />
            Nouvelle génération
          </Link>
        </Button>
        <Button variant="outline" asChild className="gap-2">
          <Link href="/brands/new">
            <Plus className="w-4 h-4" />
            Nouvelle marque
          </Link>
        </Button>
      </div>

      {/* Recent brands */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Marques récentes</h2>
          <Link href="/brands" className="text-xs text-gold hover:text-gold-light flex items-center gap-1 transition-colors">
            Voir toutes <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recentBrands.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">Aucune marque pour l&apos;instant</p>
              <Button variant="outline" size="sm" asChild className="mt-4">
                <Link href="/brands/new">Créer une marque</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentBrands.map((brand) => (
              <Link key={brand.id} href={`/brands/${brand.id}`}>
                <Card className="hover:border-gold/30 transition-all duration-200 cursor-pointer">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                        {brand.logo_url ? (
                          <Image
                            src={brand.logo_url}
                            alt={brand.name}
                            width={32}
                            height={32}
                            className="object-contain"
                          />
                        ) : (
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{brand.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDateShort(brand.created_at)}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
