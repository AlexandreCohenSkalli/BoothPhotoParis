-- ============================================================
-- Booth Dashboard — Supabase SQL Schema
-- Coller dans l'éditeur SQL de Supabase (Database > SQL Editor)
-- ============================================================

-- Extension UUID
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────
-- Table: brands
-- ────────────────────────────────────────────
create table if not exists brands (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  client_type   text,
  primary_color text,              -- format hex: #D4AF37
  secondary_color text,
  style_keywords text[],           -- array de mots-clés
  brand_notes   text,
  logo_url      text,              -- URL publique Supabase Storage
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index de recherche
create index if not exists brands_name_idx on brands(name);
create index if not exists brands_created_by_idx on brands(created_by);

-- ────────────────────────────────────────────
-- Table: generation_jobs
-- ────────────────────────────────────────────
create type job_status as enum ('pending', 'processing', 'completed', 'failed');

create table if not exists generation_jobs (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references brands(id) on delete cascade,
  status              job_status not null default 'pending',
  image_count         int not null default 4,
  output_image_urls   text[],          -- URLs des images générées (Supabase Storage)
  exported_pptx_url   text,            -- URL du PPTX final exporté
  prompt_used         text,            -- Prompt Imagen envoyé
  error_message       text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  completed_at        timestamptz
);

create index if not exists jobs_brand_id_idx on generation_jobs(brand_id);
create index if not exists jobs_status_idx on generation_jobs(status);
create index if not exists jobs_created_at_idx on generation_jobs(created_at desc);

-- ────────────────────────────────────────────
-- RLS (Row Level Security)
-- Seuls les utilisateurs authentifiés accèdent
-- ────────────────────────────────────────────
alter table brands enable row level security;
alter table generation_jobs enable row level security;

-- Politique : lecture pour tous les users authentifiés
create policy "Authenticated users can read brands"
  on brands for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert brands"
  on brands for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update brands"
  on brands for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can delete brands"
  on brands for delete
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read jobs"
  on generation_jobs for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert jobs"
  on generation_jobs for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update jobs"
  on generation_jobs for update
  using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────
-- Trigger: updated_at auto-update
-- ────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger brands_updated_at
  before update on brands
  for each row execute function update_updated_at();
