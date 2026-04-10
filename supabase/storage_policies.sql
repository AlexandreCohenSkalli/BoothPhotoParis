-- Storage policies for brand-assets bucket
-- Run this in Supabase > SQL Editor

-- Allow authenticated users to upload (INSERT)
create policy "Authenticated users can upload to brand-assets"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'brand-assets');

-- Allow authenticated users to update (overwrite)
create policy "Authenticated users can update brand-assets"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'brand-assets');

-- Allow anyone to read public files (SELECT)
create policy "Public read access for brand-assets"
  on storage.objects for select
  to public
  using (bucket_id = 'brand-assets');

-- Allow authenticated users to delete their files
create policy "Authenticated users can delete from brand-assets"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'brand-assets');
