-- Create table for Permohonan Data
create table if not exists public.permohonan_data (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  nama text not null,
  keperluan text not null,
  ktp_url text,
  berkas_url text
);

-- Enable RLS (Row Level Security) - Optional but recommended
alter table public.permohonan_data enable row level security;

-- Create policy to allow public insert (for the form)
create policy "Enable insert for all users" on public.permohonan_data
  for insert with check (true);

-- Create policy to allow public read (if needed, or restrict to admin)
-- create policy "Enable read for all users" on public.permohonan_data for select using (true);


-- Storage Setup
-- You need to create a bucket named 'permohonan' in Supabase Storage.
-- This SQL might not create the bucket directly depending on permissions, usually done via Dashboard.
-- However, if you have the storage extension enabled:

insert into storage.buckets (id, name, public)
values ('permohonan', 'permohonan', true)
on conflict (id) do nothing;

-- Storage Policies
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'permohonan' );

create policy "Public Upload"
  on storage.objects for insert
  with check ( bucket_id = 'permohonan' );
