"use client"

import Link from "next/link"
import { Brand } from "@/types/supabase"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowRight, Globe, FileDown, Wand2 } from "lucide-react"

interface Props {
  stats: { brandCount: number; jobCount: number }
  recentBrands: Pick<Brand, "id" | "name" | "logo_url" | "created_at">[]
}

export default function DashboardHome({ stats, recentBrands }: Props) {
  return (
    <div className="space-y-10 animate-fade-in max-w-3xl">

      {/* Hero */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gold uppercase tracking-widest">IA.Agent — Booth Photo Paris</p>
        <h1 className="text-4xl font-display font-bold text-foreground leading-tight">
          Générez une présentation<br />
          <span className="text-gold">en 60 secondes.</span>
        </h1>
        <p className="text-muted-foreground">
          Entrez le site d&apos;une marque — l&apos;IA récupère les couleurs, génère les visuels et produit le PPTX prêt à envoyer.
        </p>
      </div>

      {/* Main CTA */}
      <Button variant="gold" size="lg" asChild className="gap-2 text-base h-12 px-6">
        <Link href="/generate">
          <Sparkles className="w-5 h-5" />
          Nouvelle présentation
          <ArrowRight className="w-4 h-4" />
        </Link>
      </Button>

      {/* How it works */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Comment ça marche</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Globe, step: "1", label: "Site internet", desc: "Entrez le domaine de la marque" },
            { icon: Wand2, step: "2", label: "Génération IA", desc: "6 visuels créés automatiquement" },
            { icon: FileDown, step: "3", label: "Téléchargement", desc: "PPTX prêt à présenter" },
          ].map(({ icon: Icon, step, label, desc }) => (
            <div key={step} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-gold/20 text-gold text-[10px] font-bold flex items-center justify-center">
                  {step}
                </span>
                <Icon className="w-4 h-4 text-gold" />
              </div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      {(stats.brandCount > 0 || stats.jobCount > 0) && (
        <div className="flex gap-6 pt-2 border-t border-border">
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.brandCount}</p>
            <p className="text-xs text-muted-foreground">marque{stats.brandCount > 1 ? "s" : ""} enregistrée{stats.brandCount > 1 ? "s" : ""}</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.jobCount}</p>
            <p className="text-xs text-muted-foreground">présentation{stats.jobCount > 1 ? "s" : ""} générée{stats.jobCount > 1 ? "s" : ""}</p>
          </div>
          <div className="flex-1" />
          <Link href="/jobs" className="text-xs text-gold hover:text-gold-light self-center flex items-center gap-1 transition-colors">
            Voir l&apos;historique <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  )
}
