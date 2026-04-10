"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Sparkles, ChevronRight, Download, CheckCircle2,
  Loader2, Building2, ImageIcon, X
} from "lucide-react"
import { cn } from "@/lib/utils"

interface BrandOption {
  id: string
  name: string
  logo_url: string | null
  style_keywords: string[] | null
  primary_color: string | null
}

interface Props {
  brands: BrandOption[]
}

type Step = "select-brand" | "configure" | "generating" | "select-images" | "export"

export default function GeneratePageClient({ brands }: Props) {
  const searchParams = useSearchParams()
  const preselectedBrandId = searchParams.get("brand")
  const { toast } = useToast()

  const [step, setStep] = useState<Step>("select-brand")
  const [selectedBrandId, setSelectedBrandId] = useState<string>(preselectedBrandId ?? "")
  const [imageCount, setImageCount] = useState(4)
  const [customPrompt, setCustomPrompt] = useState("")
  const [jobId, setJobId] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [selectedImageIndices, setSelectedImageIndices] = useState<number[]>([])
  const [exporting, setExporting] = useState(false)
  const [pollCount, setPollCount] = useState(0)

  const selectedBrand = brands.find((b) => b.id === selectedBrandId)

  // Auto-advance if preselected brand
  useEffect(() => {
    if (preselectedBrandId && brands.find((b) => b.id === preselectedBrandId)) {
      setStep("configure")
    }
  }, [preselectedBrandId, brands])

  // Poll for job status when generating
  useEffect(() => {
    if (step !== "generating" || !jobId) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate/${jobId}`)
        const { job } = await res.json()

        setPollCount((c) => c + 1)

        if (job.status === "completed") {
          clearInterval(interval)
          setGeneratedImages(job.output_image_urls ?? [])
          setSelectedImageIndices(job.output_image_urls?.map((_: string, i: number) => i) ?? [])
          setStep("select-images")
        } else if (job.status === "failed") {
          clearInterval(interval)
          toast({
            title: "Génération échouée",
            description: job.error_message ?? "Erreur inconnue",
            variant: "destructive",
          })
          setStep("configure")
        }
      } catch {
        // Network error, keep polling
      }
    }, 2500)

    return () => clearInterval(interval)
  }, [step, jobId, toast])

  async function handleGenerate() {
    if (!selectedBrandId) return
    setStep("generating")
    setPollCount(0)

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: selectedBrandId,
          image_count: imageCount,
          custom_prompt_suffix: customPrompt || undefined,
        }),
      })

      if (!res.ok) throw new Error("Erreur lors du démarrage")
      const { job_id } = await res.json()
      setJobId(job_id)
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur réseau",
        variant: "destructive",
      })
      setStep("configure")
    }
  }

  function toggleImageSelection(index: number) {
    setSelectedImageIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    )
  }

  async function handleExport() {
    if (!selectedBrand || !jobId || selectedImageIndices.length === 0) return
    setExporting(true)

    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: selectedBrandId,
          job_id: jobId,
          selected_image_indices: selectedImageIndices,
        }),
      })

      if (!res.ok) throw new Error("Erreur lors de l'export")

      // Trigger download
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${selectedBrand.name.replace(/\s+/g, "_")}_presentation.pptx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setStep("export")
      toast({ title: "Présentation générée !", variant: "success" as any })
    } catch (err) {
      toast({
        title: "Erreur export",
        description: err instanceof Error ? err.message : "Erreur réseau",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Générer une présentation</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Créez des visuels IA et exportez la présentation Booth Photo Paris pour votre client
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {(["select-brand", "configure", "generating", "select-images", "export"] as Step[]).map(
          (s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
              <div
                className={cn(
                  "text-xs px-2 py-1 rounded-full transition-all",
                  step === s
                    ? "bg-gold/20 text-gold border border-gold/30 font-medium"
                    : ["completed"].includes(s)
                    ? "text-muted-foreground/40"
                    : "text-muted-foreground/40"
                )}
              >
                {
                  {
                    "select-brand": "Marque",
                    configure: "Paramètres",
                    generating: "Génération",
                    "select-images": "Sélection",
                    export: "Export",
                  }[s]
                }
              </div>
            </div>
          )
        )}
      </div>

      {/* ── Step 1: Select brand ─────────────────────── */}
      {step === "select-brand" && (
        <div className="space-y-4">
          <h2 className="font-medium text-foreground">Choisissez une marque</h2>
          {brands.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground text-sm">
                  Aucune marque enregistrée.{" "}
                  <a href="/brands/new" className="text-gold hover:underline">Créer une marque</a>
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => { setSelectedBrandId(brand.id); setStep("configure") }}
                  className={cn(
                    "text-left p-4 rounded-xl border transition-all duration-200",
                    selectedBrandId === brand.id
                      ? "border-gold/50 bg-gold/5"
                      : "border-border hover:border-gold/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden">
                      {brand.logo_url ? (
                        <Image src={brand.logo_url} alt={brand.name} width={40} height={40} className="object-contain p-1" />
                      ) : (
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{brand.name}</p>
                      {brand.primary_color && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: brand.primary_color }} />
                          <span className="text-xs text-muted-foreground">{brand.primary_color}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Configure ──────────────────────────── */}
      {step === "configure" && selectedBrand && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-gold/20 bg-gold/5">
            <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden">
              {selectedBrand.logo_url ? (
                <Image src={selectedBrand.logo_url} alt={selectedBrand.name} width={40} height={40} className="object-contain p-1" />
              ) : (
                <Building2 className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">{selectedBrand.name}</p>
              {selectedBrand.style_keywords?.length ? (
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  {selectedBrand.style_keywords.slice(0, 3).map((kw) => (
                    <Badge key={kw} variant="gold" className="text-[10px] px-1.5 py-0">{kw}</Badge>
                  ))}
                </div>
              ) : null}
            </div>
            <button onClick={() => setStep("select-brand")} className="ml-auto text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <Label>Nombre d&apos;images à générer</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setImageCount(n)}
                  className={cn(
                    "w-10 h-10 rounded-lg border text-sm font-medium transition-all",
                    imageCount === n
                      ? "border-gold/50 bg-gold/10 text-gold"
                      : "border-border hover:border-gold/30"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-prompt">
              Instructions supplémentaires <span className="text-muted-foreground font-normal">(optionnel)</span>
            </Label>
            <Input
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Ex: fond blanc, ambiance outdoor, soirée de gala..."
            />
          </div>

          <Button variant="gold" onClick={handleGenerate} className="w-full gap-2">
            <Sparkles className="w-4 h-4" />
            Lancer la génération ({imageCount} image{imageCount > 1 ? "s" : ""})
          </Button>
        </div>
      )}

      {/* ── Step 3: Generating ──────────────────────────── */}
      {step === "generating" && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-6 text-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-gold/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-gold" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-gold/40 border-t-gold animate-spin" />
            </div>
            <div>
              <p className="text-lg font-semibold">Génération en cours...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Google Imagen 3 crée vos visuels pour{" "}
                <span className="text-gold">{selectedBrand?.name}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {pollCount * 2.5}s écoulées · ~30-60s au total
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Select images ──────────────────────── */}
      {step === "select-images" && generatedImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-foreground">
              Sélectionnez les images à inclure dans la présentation
            </h2>
            <span className="text-xs text-muted-foreground">
              {selectedImageIndices.length}/{generatedImages.length} sélectionnées
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {generatedImages.map((url, i) => (
              <button
                key={i}
                onClick={() => toggleImageSelection(i)}
                className={cn(
                  "relative aspect-video rounded-xl overflow-hidden border-2 transition-all duration-200",
                  selectedImageIndices.includes(i)
                    ? "border-gold/70 ring-2 ring-gold/20"
                    : "border-border hover:border-gold/30"
                )}
              >
                <Image src={url} alt={`Generated ${i + 1}`} fill className="object-cover" />
                {selectedImageIndices.includes(i) && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gold flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-black" />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                  Image {i + 1}
                </div>
              </button>
            ))}
          </div>

          <Button
            variant="gold"
            onClick={handleExport}
            disabled={selectedImageIndices.length === 0 || exporting}
            className="w-full gap-2"
          >
            {exporting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Génération PPTX...</>
            ) : (
              <><Download className="w-4 h-4" /> Exporter la présentation (.pptx)</>
            )}
          </Button>
        </div>
      )}

      {/* ── Step 5: Export done ──────────────────────────── */}
      {step === "export" && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <div>
              <p className="text-lg font-semibold text-foreground">Présentation téléchargée !</p>
              <p className="text-sm text-muted-foreground mt-1">
                Les visuels ont été injectés dans la présentation Booth Photo Paris
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("select-brand")
                  setSelectedBrandId("")
                  setJobId(null)
                  setGeneratedImages([])
                  setSelectedImageIndices([])
                  setCustomPrompt("")
                  setImageCount(4)
                }}
              >
                Nouvelle génération
              </Button>
              <Button variant="gold" asChild>
                <a href="/jobs">Voir l&apos;historique</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
