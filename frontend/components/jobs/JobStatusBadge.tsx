"use client"

import { Badge } from "@/components/ui/badge"
import { JobStatus } from "@/types/supabase"
import { Loader2 } from "lucide-react"

const config: Record<JobStatus, { label: string; variant: "success" | "error" | "processing" | "warning" | "outline" }> = {
  completed: { label: "Terminé", variant: "success" },
  failed: { label: "Échoué", variant: "error" },
  processing: { label: "En cours", variant: "processing" },
  pending: { label: "En attente", variant: "warning" },
}

export default function JobStatusBadge({ status }: { status: JobStatus }) {
  const { label, variant } = config[status]
  return (
    <Badge variant={variant} className="gap-1">
      {status === "processing" && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {label}
    </Badge>
  )
}
