-- Add virtual_account column for payment
ALTER TABLE public.permohonan_data
ADD COLUMN IF NOT EXISTS virtual_account TEXT NULL;
