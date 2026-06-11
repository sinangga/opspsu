-- Menambahkan kolom untuk menyimpan informasi pembayaran
ALTER TABLE public.permohonan_data
  ADD COLUMN IF NOT EXISTS payment_qr_code_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS payment_virtual_number TEXT NULL,
  ADD COLUMN IF NOT EXISTS status_bayar TEXT NULL DEFAULT 'pending';

COMMENT ON COLUMN public.permohonan_data.payment_qr_code_url IS 'URL ke gambar QR code pembayaran.';
COMMENT ON COLUMN public.permohonan_data.payment_virtual_number IS 'Nomor virtual account untuk pembayaran.';
COMMENT ON COLUMN public.permohonan_data.status_bayar IS 'Status pembayaran (e.g., pending, paid, expired).';
