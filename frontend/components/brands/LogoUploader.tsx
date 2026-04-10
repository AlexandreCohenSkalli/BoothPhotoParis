"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Upload, X, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  brandId?: string
  currentLogoUrl: string | null
  onUpload: (url: string) => void
}

export default function LogoUploader({ brandId, currentLogoUrl, onUpload }: Props) {
  const { toast } = useToast()
  const [preview, setPreview] = useState<string | null>(currentLogoUrl)
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      // Local preview immediately
      const objectUrl = URL.createObjectURL(file)
      setPreview(objectUrl)

      if (!brandId) {
        // In create mode, store the file locally and upload after brand creation
        // For now, keep as data URL
        const reader = new FileReader()
        reader.onload = () => {
          // We'll pass a blob URL; the parent handles upload after save
          onUpload(reader.result as string)
        }
        reader.readAsDataURL(file)
        return
      }

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("brand_id", brandId)

        const res = await fetch("/api/upload/logo", { method: "POST", body: formData })
        if (!res.ok) throw new Error("Upload échoué")

        const { url } = await res.json()
        onUpload(url)
        toast({ title: "Logo uploadé", variant: "success" as any })
      } catch {
        toast({ title: "Erreur upload", description: "Réessayez", variant: "destructive" })
        setPreview(currentLogoUrl)
      } finally {
        setUploading(false)
      }
    },
    [brandId, currentLogoUrl, onUpload, toast]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".svg", ".webp"] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  })

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative w-32 h-32 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden group">
          <Image
            src={preview}
            alt="Logo preview"
            fill
            className="object-contain p-3"
          />
          <button
            type="button"
            onClick={() => { setPreview(null); onUpload("") }}
            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : null}

      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200",
          isDragActive
            ? "border-gold/60 bg-gold/5"
            : "border-border hover:border-gold/30 hover:bg-accent/30"
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
            <p className="text-sm text-muted-foreground">Upload en cours...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {isDragActive ? (
              <Upload className="w-8 h-8 text-gold" />
            ) : (
              <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
            )}
            <p className="text-sm text-muted-foreground">
              {isDragActive ? "Déposer ici" : "Glisser-déposer ou cliquer pour choisir"}
            </p>
            <p className="text-xs text-muted-foreground/60">PNG, SVG, JPG — max 5 Mo</p>
          </div>
        )}
      </div>
    </div>
  )
}
