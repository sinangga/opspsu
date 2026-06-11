-- Add date columns to permohonan_data
ALTER TABLE public.permohonan_data
ADD COLUMN IF NOT EXISTS tanggal_mulai DATE NULL,
ADD COLUMN IF NOT EXISTS tanggal_selesai DATE NULL;

COMMENT ON COLUMN public.permohonan_data.tanggal_mulai IS 'Tanggal mulai data yang dimohon';
COMMENT ON COLUMN public.permohonan_data.tanggal_selesai IS 'Tanggal selesai data yang dimohon';
