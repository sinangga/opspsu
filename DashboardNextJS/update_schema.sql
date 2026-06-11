-- Add new columns to permohonan_data table
ALTER TABLE public.permohonan_data
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS whatsapp text,
ADD COLUMN IF NOT EXISTS keterangan text;

-- Verify the bucket exists (idempotent)
insert into storage.buckets (id, name, public)
values ('permohonan', 'permohonan', true)
on conflict (id) do nothing;

-- Ensure public upload policy exists (idempotent-ish, better to check in dashboard but this helps)
-- Note: Re-running 'create policy' might fail if it exists, but for a setup script it's okay to show intent.
-- If policies are missing:
-- create policy "Public Upload" on storage.objects for insert with check ( bucket_id = 'permohonan' );
