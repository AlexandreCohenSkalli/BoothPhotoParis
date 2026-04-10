export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      brands: {
        Row: {
          id: string
          name: string
          client_type: string | null
          primary_color: string | null
          secondary_color: string | null
          style_keywords: string[] | null
          brand_notes: string | null
          logo_url: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          client_type?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          style_keywords?: string[] | null
          brand_notes?: string | null
          logo_url?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          client_type?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          style_keywords?: string[] | null
          brand_notes?: string | null
          logo_url?: string | null
          updated_at?: string
        }
      }
      generation_jobs: {
        Row: {
          id: string
          brand_id: string
          status: "pending" | "processing" | "completed" | "failed"
          image_count: number
          output_image_urls: string[] | null
          exported_pptx_url: string | null
          prompt_used: string | null
          error_message: string | null
          created_by: string
          created_at: string
          started_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          brand_id: string
          status?: "pending" | "processing" | "completed" | "failed"
          image_count?: number
          output_image_urls?: string[] | null
          exported_pptx_url?: string | null
          prompt_used?: string | null
          error_message?: string | null
          created_by: string
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
        Update: {
          status?: "pending" | "processing" | "completed" | "failed"
          output_image_urls?: string[] | null
          exported_pptx_url?: string | null
          prompt_used?: string | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenience type aliases
export type Brand = Database["public"]["Tables"]["brands"]["Row"]
export type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"]
export type BrandUpdate = Database["public"]["Tables"]["brands"]["Update"]
export type GenerationJob = Database["public"]["Tables"]["generation_jobs"]["Row"]
export type JobStatus = GenerationJob["status"]
