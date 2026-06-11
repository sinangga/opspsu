-- Add status and payment related columns to permohonan_data

ALTER TABLE public.permohonan_data
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, completed
ADD COLUMN IF NOT EXISTS qr_code_url TEXT NULL,
ADD COLUMN IF NOT EXISTS rejected_reason TEXT NULL,
ADD COLUMN IF NOT EXISTS admin_notes TEXT NULL;

-- Create index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_permohonan_status ON public.permohonan_data(status);

-- Update RLS policies if necessary (assuming public/authenticated access needs to be checked)
-- For now, relying on existing policies
