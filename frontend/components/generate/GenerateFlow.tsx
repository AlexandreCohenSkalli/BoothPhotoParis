"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2, Search, Sparkles, Download, CheckCircle2,
  Globe, Palette, RefreshCw, ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"

interface BrandData {
  name: string
  domain: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  description: string
}

type Step = "input" | "preview" | "generating" | "done"

type Zones = {
  cover_image_url: string | null
  cabine_top_url: string
  cabine_bottom_url: string
  kiosk_url: string
  goodies_top_url: string
  goodies_bottom_url: string
}

const ZONE_LABELS = [
  "Cabine — vue 1",
  "Cabine — vue 2",
  "Kiosk",
  "Goodies — rangée 1",
  "Goodies — rangée 2",
]

export default function GenerateFlow() {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>("input")
  const [domain, setDomain] = useState("")
  const [lookingUp, setLookingUp] = useState(false)
  const [brand, setBrand] = useState<BrandData | null>(null)
  const [generatingZone, setGeneratingZone] = useState(0)
  const [zones, setZones] = useState<Zones | null>(null)
  const [pptxUrl, setPptxUrl] = useState<string | null>(null)
  const [pptxFilename, setPptxFilename] = useState("")
  const [coverStyle, setCoverStyle] = useState<"brand" | "split" | "minimal">("brand")
  const [stripStyle, setStripStyle] = useState<"primary" | "secondary" | "none">("none")

  async function handleLookup() {
    if (!domain.trim()) return
    setLookingUp(true)
    try {
      const res = await fetch(`/api/brandfetch?domain=${encodeURIComponent(domain.trim())}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Brand not found")
      }
      const data = await res.json()
      setBrand(data)
      setStep("preview")
    } catch (err) {
      toast({
        title: "Marque introuvable",
        description: String(err),
        variant: "destructive",
      })
    } finally {
      setLookingUp(false)
    }
  }

  async function handleGenerate() {
    if (!brand) return
    setStep("generating")
    setGeneratingZone(0)

    // Simulate progress through zones
    const progressInterval = setInterval(() => {
      setGeneratingZone((z) => Math.min(z + 1, ZONE_LABELS.length - 1))
    }, 2500) // ~2.5s par zone (Google Imagen 3, parallèle)

    try {
      // 1) Generate images (so we can preview)
      const imgRes = await fetch("/api/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brand.name,
          website: brand.domain,
          primary_color: brand.primary_color,
          secondary_color: brand.secondary_color,
          logo_url: brand.logo_url,
          description: brand.description,
        }),
      })

      if (!imgRes.ok) {
        const err = await imgRes.json().catch(() => ({} as any))
        throw new Error(err.detail ?? err.error ?? "Génération des images échouée")
      }

      const zones = (await imgRes.json()) as Zones
      setZones(zones)
      setStep("preview")

      clearInterval(progressInterval)
      return
    } catch (err) {
      clearInterval(progressInterval)
      toast({
        title: "Erreur de génération",
        description: String(err),
        variant: "destructive",
      })
      setStep("preview")
    }
  }

  async function handleExportPptx() {
    if (!brand || !zones) return
    setStep("generating")
    setGeneratingZone(ZONE_LABELS.length - 1)
    try {
      const res = await fetch("/api/generate-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brand.name,
          website: brand.domain,
          primary_color: brand.primary_color,
          secondary_color: brand.secondary_color,
          logo_url: brand.logo_url,
          description: brand.description,
          cover_style: coverStyle,
          strip_style: stripStyle,
          zones,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any))
        throw new Error(err.detail ?? err.error ?? "Export PPTX échoué")
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const filename = `${brand.name.replace(/\s+/g, "_")}_x_Booth.pptx`
      setPptxUrl(url)
      setPptxFilename(filename)
      setGeneratingZone(ZONE_LABELS.length)
      setStep("done")
    } catch (err) {
      toast({
        title: "Erreur d'export",
        description: String(err),
        variant: "destructive",
      })
      setStep("preview")
    }
  }

  function handleDownload() {
    if (!pptxUrl) return
    const a = document.createElement("a")
    a.href = pptxUrl
    a.download = pptxFilename
    a.click()
  }

  function handleReset() {
    setStep("input")
    setDomain("")
    setBrand(null)
    setPptxUrl(null)
    setZones(null)
    setGeneratingZone(0)
    setCoverStyle("brand")
    setStripStyle("none")
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* ── Step 1: Domain input ── */}
      {step === "input" && (
        <Card className="border-border">
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-display font-semibold text-foreground">
                Site internet de la marque
              </h2>
              <p className="text-sm text-muted-foreground">
                Entrez le domaine et le système récupère automatiquement logo, couleurs et identité visuelle.
              </p>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="ex: chanel.com, dior.com, balenciaga.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  disabled={lookingUp}
                />
              </div>
              <Button
                variant="gold"
                onClick={handleLookup}
                disabled={lookingUp || !domain.trim()}
                className="gap-2 shrink-0"
              >
                {lookingUp ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {lookingUp ? "Recherche..." : "Rechercher"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Brand preview ── */}
      {step === "preview" && brand && (
        <div className="space-y-4">
          <Card className="border-border overflow-hidden">
            <div
              className="h-2"
              style={{ backgroundColor: brand.primary_color }}
            />
            <CardContent className="pt-5 space-y-5">
              <div className="flex items-center gap-4">
                {brand.logo_url ? (
                  <div className="w-16 h-16 rounded-lg bg-white flex items-center justify-center p-2 shrink-0">
                    <Image
                      src={brand.logo_url}
                      alt={brand.name}
                      width={56}
                      height={56}
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <span className="text-2xl font-bold text-muted-foreground">
                      {brand.name[0]}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-display font-bold text-foreground truncate">
                    {brand.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{brand.domain}</p>
                </div>
              </div>

              {brand.description && (
                <p className="text-sm text-muted-foreground">{brand.description}</p>
              )}

              <div className="flex items-center gap-3">
                <Palette className="w-4 h-4 text-muted-foreground" />
                <div className="flex gap-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-full border border-border"
                      style={{ backgroundColor: brand.primary_color }}
                    />
                    <span className="text-xs text-muted-foreground font-mono">
                      {brand.primary_color}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-full border border-border"
                      style={{ backgroundColor: brand.secondary_color }}
                    />
                    <span className="text-xs text-muted-foreground font-mono">
                      {brand.secondary_color}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Cover style picker ── */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Style de couverture
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {(["brand", "split", "minimal"] as const).map((style) => {
                    const primary   = brand.primary_color  || "#111111"
                    const secondary = brand.secondary_color || "#F5F3EE"
                    const logo      = brand.logo_url
                    // luminance check for text contrast
                    const isDark = (hex: string) => {
                      const c = hex.replace("#","")
                      if (c.length !== 6) return true
                      const [r,g,b] = [0,2,4].map(i => parseInt(c.slice(i,i+2),16))
                      return (0.299*r + 0.587*g + 0.114*b)/255 < 0.55
                    }
                    const onPrimary   = isDark(primary)   ? "#FFFFFF" : "#111111"
                    const lightBg     = isDark(secondary) ? "#F5F3EE" : secondary
                    const onLight     = isDark(lightBg)   ? "#FFFFFF" : "#111111"

                    return (
                      <button
                        key={style}
                        onClick={() => setCoverStyle(style)}
                        className={cn(
                          "flex flex-col gap-2 p-2 rounded-xl border-2 transition-all focus:outline-none",
                          coverStyle === style
                            ? "border-gold shadow-md scale-[1.02]"
                            : "border-border hover:border-muted-foreground/40"
                        )}
                      >
                        {/* ── Aperçu 16:9 ── */}
                        <div
                          className="relative w-full overflow-hidden rounded-md"
                          style={{ aspectRatio: "16/9" }}
                        >
                          {/* STYLE A — plein fond */}
                          {style === "brand" && (
                            <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: primary }}>
                              {/* top label */}
                              <div className="flex justify-end px-[6%] pt-[8%]">
                                <div className="h-[3%] w-[25%] rounded-full opacity-40" style={{ backgroundColor: onPrimary }} />
                              </div>
                              {/* logo centré */}
                              <div className="flex-1 flex items-center justify-center">
                                {logo ? (
                                  <img src={logo} alt="" className="max-w-[38%] max-h-[42%] object-contain" style={{ filter: onPrimary === "#FFFFFF" ? "brightness(0) invert(1)" : "none" }} />
                                ) : (
                                  <div className="w-[30%] h-[30%] rounded" style={{ backgroundColor: onPrimary, opacity: 0.25 }} />
                                )}
                              </div>
                              {/* ligne fine */}
                              <div className="mx-[10%] mb-[12%]" style={{ height: 1, backgroundColor: onPrimary, opacity: 0.3 }} />
                              {/* texte bas */}
                              <div className="px-[8%] pb-[8%] space-y-[3%]">
                                <div className="h-[5%] w-[44%] rounded-full opacity-40" style={{ backgroundColor: onPrimary }} />
                                <div className="h-[3%] w-[62%] rounded-full opacity-25" style={{ backgroundColor: onPrimary }} />
                              </div>
                            </div>
                          )}

                          {/* STYLE B — split vertical */}
                          {style === "split" && (
                            <div className="absolute inset-0 flex" style={{ backgroundColor: lightBg }}>
                              {/* Bande gauche */}
                              <div className="h-full flex flex-col items-center justify-center" style={{ width: "42%", backgroundColor: primary }}>
                                {logo ? (
                                  <img src={logo} alt="" className="max-w-[62%] max-h-[38%] object-contain" style={{ filter: onPrimary === "#FFFFFF" ? "brightness(0) invert(1)" : "none" }} />
                                ) : (
                                  <div className="w-[40%] h-[28%] rounded" style={{ backgroundColor: onPrimary, opacity: 0.3 }} />
                                )}
                                {/* ligne déco bas */}
                                <div className="absolute bottom-[12%]" style={{ left: "4%", width: "32%", height: 1, backgroundColor: onPrimary, opacity: 0.35 }} />
                              </div>
                              {/* Zone droite */}
                              <div className="flex-1 flex flex-col justify-center px-[8%] gap-[6%]">
                                <div className="h-[9%] w-[75%] rounded-full" style={{ backgroundColor: onLight, opacity: 0.8 }} />
                                <div className="h-[5%] w-[55%] rounded-full" style={{ backgroundColor: onLight, opacity: 0.4 }} />
                                <div className="h-[3%] w-[80%] rounded-full" style={{ backgroundColor: onLight, opacity: 0.25 }} />
                              </div>
                            </div>
                          )}

                          {/* STYLE C — minimal barre bas */}
                          {style === "minimal" && (
                            <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: lightBg }}>
                              {/* label haut */}
                              <div className="px-[8%] pt-[7%]">
                                <div className="h-[4%] w-[28%] rounded-full" style={{ backgroundColor: onLight, opacity: 0.3 }} />
                              </div>
                              {/* logo centré dans zone haute (72%) */}
                              <div className="flex-1 flex items-center justify-center" style={{ maxHeight: "64%" }}>
                                {logo ? (
                                  <img src={logo} alt="" className="max-w-[35%] max-h-[55%] object-contain" />
                                ) : (
                                  <div className="w-[28%] h-[28%] rounded" style={{ backgroundColor: onLight, opacity: 0.2 }} />
                                )}
                              </div>
                              {/* barre primaire bas */}
                              <div className="flex flex-col justify-center px-[8%] gap-[5%]" style={{ height: "28%", backgroundColor: primary }}>
                                <div className="h-[14%] w-[48%] rounded-full" style={{ backgroundColor: onPrimary, opacity: 0.8 }} />
                                <div className="h-[9%] w-[70%] rounded-full" style={{ backgroundColor: onPrimary, opacity: 0.4 }} />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Label sous l'aperçu */}
                        <p className={cn(
                          "text-[11px] font-medium text-center leading-tight transition-colors",
                          coverStyle === style ? "text-gold" : "text-muted-foreground"
                        )}>
                          {style === "brand" ? "Plein fond" : style === "split" ? "Bandeau" : "Minimal"}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Strip style picker ── */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Contour bandes photo
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: "none"      as const, label: "Aucun",      desc: "Chanel (défaut)" },
                    { value: "primary"   as const, label: "Primaire",   desc: "Épais, couleur marque" },
                    { value: "secondary" as const, label: "Secondaire", desc: "Fin, couleur secondaire" },
                  ]).map((opt) => {
                    const color = opt.value === "primary"
                      ? (brand.primary_color || "#111111")
                      : opt.value === "secondary"
                        ? (brand.secondary_color || "#F5F3EE")
                        : "transparent"
                    const borderW = opt.value === "primary" ? 3 : opt.value === "secondary" ? 1.5 : 0
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setStripStyle(opt.value)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all focus:outline-none",
                          stripStyle === opt.value
                            ? "border-gold shadow-md scale-[1.02]"
                            : "border-border hover:border-muted-foreground/40"
                        )}
                      >
                        {/* Mini aperçu bande photo */}
                        <div
                          className="w-10 rounded overflow-hidden bg-muted"
                          style={{
                            aspectRatio: "9/16",
                            outline: borderW > 0 ? `${borderW}px solid ${color}` : "none",
                            outlineOffset: "-1px",
                          }}
                        >
                          {/* Simulation de 4 photos */}
                          <div className="w-full h-full grid grid-cols-2 gap-[1px] p-[2px] bg-black">
                            {[0,1,2,3].map(i => (
                              <div key={i} className="bg-muted-foreground/30 rounded-[1px]" />
                            ))}
                          </div>
                        </div>
                        <p className={cn(
                          "text-[11px] font-medium text-center leading-tight transition-colors",
                          stripStyle === opt.value ? "text-gold" : "text-muted-foreground"
                        )}>
                          {opt.label}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Zones à générer
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {ZONE_LABELS.map((label) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3 h-3 text-gold shrink-0" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {zones && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Aperçu des visuels générés
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        { key: "cabine_top_url",    label: ZONE_LABELS[0], src: zones.cabine_top_url,    portrait: true },
                        { key: "cabine_bottom_url", label: ZONE_LABELS[1], src: zones.cabine_bottom_url, portrait: true },
                        { key: "kiosk_url",         label: ZONE_LABELS[2], src: zones.kiosk_url,         portrait: true },
                        { key: "goodies_top_url",   label: ZONE_LABELS[3], src: zones.goodies_top_url,   portrait: false },
                        { key: "goodies_bottom_url",label: ZONE_LABELS[4], src: zones.goodies_bottom_url,portrait: false },
                      ] as { key: string; label: string; src: string; portrait: boolean }[]
                    ).map((item) => (
                      <div key={item.key} className="space-y-1">
                        <div className={`relative w-full overflow-hidden rounded-lg border border-border bg-muted ${item.portrait ? "aspect-[9/16]" : "aspect-video"}`}>
                          <Image
                            src={item.src}
                            alt={item.label}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Changer
            </Button>
            <Button
              variant="gold"
              onClick={zones ? handleExportPptx : handleGenerate}
              className="flex-1 gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {zones ? `Exporter le PPTX pour ${brand.name}` : `Générer les visuels pour ${brand.name}`}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Generating ── */}
      {step === "generating" && (
        <Card className="border-border">
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-gold animate-pulse" />
                </div>
              </div>
              <h3 className="font-display text-lg font-semibold">
                Génération en cours…
              </h3>
              <p className="text-sm text-muted-foreground">
                L&apos;IA génère {ZONE_LABELS.length} visuels personnalisés pour {brand?.name}
              </p>
            </div>

            <div className="space-y-2">
              {ZONE_LABELS.map((label, i) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all",
                    i < generatingZone
                      ? "bg-gold/20"
                      : i === generatingZone
                      ? "bg-gold/10"
                      : "bg-muted"
                  )}>
                    {i < generatingZone ? (
                      <CheckCircle2 className="w-3 h-3 text-gold" />
                    ) : i === generatingZone ? (
                      <Loader2 className="w-3 h-3 text-gold animate-spin" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <span className={cn(
                    "text-sm transition-colors",
                    i <= generatingZone ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              ⏱ ~30 secondes — ne ferme pas cet onglet
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Done ── */}
      {step === "done" && brand && (
        <Card className="border-border">
          <CardContent className="pt-8 pb-8 space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-xl font-bold">Présentation prête !</h3>
              <p className="text-sm text-muted-foreground">
                Le PPTX a été généré avec les visuels {brand.name}.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button variant="gold" onClick={handleDownload} className="gap-2">
                <Download className="w-4 h-4" />
                Télécharger {brand.name} x Booth.pptx
              </Button>
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Générer pour une autre marque
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
