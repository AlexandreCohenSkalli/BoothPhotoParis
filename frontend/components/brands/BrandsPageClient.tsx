"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Brand } from "@/types/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Building2, Plus, Search, ArrowRight, Sparkles } from "lucide-react"
import { formatDateShort } from "@/lib/utils"

interface Props {
  initialBrands: Brand[]
}

export default function BrandsPageClient({ initialBrands }: Props) {
  const [search, setSearch] = useState("")

  const filtered = initialBrands.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.client_type?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marques</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {initialBrands.length} marque{initialBrands.length !== 1 ? "s" : ""} enregistrée{initialBrands.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="gold" asChild className="gap-2">
          <Link href="/brands/new">
            <Plus className="w-4 h-4" />
            Nouvelle marque
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une marque..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground text-sm">
              {search ? "Aucun résultat pour cette recherche" : "Aucune marque pour l'instant"}
            </p>
            {!search && (
              <Button variant="outline" size="sm" asChild className="mt-4">
                <Link href="/brands/new">Créer la première marque</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>
      )}
    </div>
  )
}

function BrandCard({ brand }: { brand: Brand }) {
  return (
    <Card className="group hover:border-gold/30 transition-all duration-200">
      <CardContent className="p-5 space-y-4">
        {/* Logo + Name */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
            {brand.logo_url ? (
              <Image
                src={brand.logo_url}
                alt={brand.name}
                width={48}
                height={48}
                className="object-contain p-1"
              />
            ) : (
              <Building2 className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate text-sm">{brand.name}</h3>
            {brand.client_type && (
              <p className="text-xs text-muted-foreground mt-0.5">{brand.client_type}</p>
            )}
          </div>
          {brand.primary_color && (
            <div
              className="w-4 h-4 rounded-full shrink-0 border border-border mt-0.5"
              style={{ backgroundColor: brand.primary_color }}
              title={brand.primary_color}
            />
          )}
        </div>

        {/* Keywords */}
        {brand.style_keywords && brand.style_keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {brand.style_keywords.slice(0, 3).map((kw) => (
              <Badge key={kw} variant="outline" className="text-[10px] px-2 py-0">
                {kw}
              </Badge>
            ))}
            {brand.style_keywords.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-2 py-0 text-muted-foreground">
                +{brand.style_keywords.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">{formatDateShort(brand.created_at)}</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="h-7 px-2 gap-1 text-xs">
              <Link href={`/generate?brand=${brand.id}`}>
                <Sparkles className="w-3 h-3" />
                Générer
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="h-7 px-2 gap-1 text-xs">
              <Link href={`/brands/${brand.id}`}>
                Voir
                <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
