"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Brand } from "@/types/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save, X, Plus } from "lucide-react"
import Link from "next/link"
import LogoUploader from "./LogoUploader"

const schema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100),
  client_type: z.string().optional(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Format hex invalide").optional().or(z.literal("")),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Format hex invalide").optional().or(z.literal("")),
  brand_notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  brand?: Brand
  mode: "create" | "edit"
}

export default function BrandForm({ brand, mode }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [keywords, setKeywords] = useState<string[]>(brand?.style_keywords ?? [])
  const [keywordInput, setKeywordInput] = useState("")
  const [logoUrl, setLogoUrl] = useState<string | null>(brand?.logo_url ?? null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: brand?.name ?? "",
      client_type: brand?.client_type ?? "",
      primary_color: brand?.primary_color ?? "",
      secondary_color: brand?.secondary_color ?? "",
      brand_notes: brand?.brand_notes ?? "",
    },
  })

  function addKeyword() {
    const kw = keywordInput.trim()
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw])
    }
    setKeywordInput("")
  }

  function removeKeyword(kw: string) {
    setKeywords(keywords.filter((k) => k !== kw))
  }

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const payload = {
        ...values,
        style_keywords: keywords,
        logo_url: logoUrl,
        primary_color: values.primary_color || null,
        secondary_color: values.secondary_color || null,
      }

      const url = mode === "create" ? "/api/brands" : `/api/brands/${brand!.id}`
      const method = mode === "create" ? "POST" : "PATCH"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Erreur serveur")
      }

      const data = await res.json()
      toast({
        title: mode === "create" ? "Marque créée !" : "Marque mise à jour",
        variant: "success" as any,
      })
      router.push(`/brands/${data.brand.id}`)
      router.refresh()
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
        <Link href="/brands">
          <ArrowLeft className="w-4 h-4" />
          Retour aux marques
        </Link>
      </Button>

      <h1 className="text-2xl font-bold text-foreground">
        {mode === "create" ? "Nouvelle marque" : `Modifier — ${brand?.name}`}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identité</CardTitle>
            <CardDescription>Informations de base de la marque cliente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom de la marque *</Label>
              <Input id="name" placeholder="Ex: Louis Vuitton" {...register("name")} />
              {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client_type">Type de client</Label>
              <Input id="client_type" placeholder="Ex: Luxe, Corporate, Mariage..." {...register("client_type")} />
            </div>
          </CardContent>
        </Card>

        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logo</CardTitle>
            <CardDescription>PNG ou SVG, fond transparent recommandé</CardDescription>
          </CardHeader>
          <CardContent>
            <LogoUploader
              brandId={brand?.id}
              currentLogoUrl={logoUrl}
              onUpload={(url) => setLogoUrl(url)}
            />
          </CardContent>
        </Card>

        {/* Visual identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identité visuelle</CardTitle>
            <CardDescription>Couleurs et mots-clés qui guideront la génération IA</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="primary_color">Couleur principale</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    placeholder="#D4AF37"
                    {...register("primary_color")}
                    className="flex-1"
                  />
                </div>
                {errors.primary_color && (
                  <p className="text-xs text-red-400">{errors.primary_color.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="secondary_color">Couleur secondaire</Label>
                <Input
                  id="secondary_color"
                  placeholder="#FFFFFF"
                  {...register("secondary_color")}
                />
              </div>
            </div>

            {/* Keywords */}
            <div className="space-y-1.5">
              <Label>Mots-clés de style</Label>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="Ex: luxe, minimaliste, noir & blanc..."
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addKeyword}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-gold/15 text-gold border border-gold/25"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        className="hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
            <CardDescription>Contexte ou instructions spécifiques pour la génération</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Ex: Evénement de lancement, ambiance sombre et feutrée, pas de personnes dans les images..."
              {...register("brand_notes")}
              rows={4}
            />
          </CardContent>
        </Card>

        <Button type="submit" variant="gold" disabled={saving} className="gap-2 w-full">
          <Save className="w-4 h-4" />
          {saving ? "Enregistrement..." : mode === "create" ? "Créer la marque" : "Sauvegarder les modifications"}
        </Button>
      </form>
    </div>
  )
}
