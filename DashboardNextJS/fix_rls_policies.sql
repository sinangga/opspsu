-- Fix Storage RLS for 'permohonan' bucket
-- Allow authenticated users (Admins) to INSERT, UPDATE, and DELETE files
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'permohonan' );

CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'permohonan' );

CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'permohonan' );

-- Fix Table RLS for 'permohonan_data'
-- Allow authenticated users (Admins) to UPDATE permohonan_data
-- This acts as a fallback if the Service Role is not working as expected
CREATE POLICY "Authenticated users can update data"
ON public.permohonan_data FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Ensure public can still insert (for the form) - Re-affirming this exists
-- CREATE POLICY "Enable insert for all users" on public.permohonan_data for insert with check (true);
