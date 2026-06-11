-- Menambahkan kolom-kolom baru untuk mengakomodasi data dari form permohonan yang lebih detail.
-- Kolom-kolom ini bersifat opsional (NULLABLE) karena hanya diisi berdasarkan jenis layanan yang dipilih.

ALTER TABLE public.permohonan_data
  -- Kolom untuk layanan "Data Nol Rupiah"
  ADD COLUMN IF NOT EXISTS universitas TEXT NULL,
  ADD COLUMN IF NOT EXISTS nim TEXT NULL,
  ADD COLUMN IF NOT EXISTS dosen_pembimbing TEXT NULL,
  ADD COLUMN IF NOT EXISTS kontak_dosen TEXT NULL,
  ADD COLUMN IF NOT EXISTS judul_skripsi TEXT NULL,

  -- Kolom untuk layanan "Klaim Asuransi" (Banjir/Petir)
  ADD COLUMN IF NOT EXISTS jumlah_hari INTEGER NULL,
  ADD COLUMN IF NOT EXISTS lokasi_kejadian TEXT NULL;

-- Menambahkan kolom untuk menyimpan estimasi harga (opsional, tapi bagus untuk referensi)
ALTER TABLE public.permohonan_data
  ADD COLUMN IF NOT EXISTS estimasi_biaya BIGINT NULL;

COMMENT ON COLUMN public.permohonan_data.universitas IS 'Nama universitas untuk pemohon layanan Data Nol Rupiah.';
COMMENT ON COLUMN public.permohonan_data.nim IS 'Nomor Induk Mahasiswa untuk pemohon layanan Data Nol Rupiah.';
COMMENT ON COLUMN public.permohonan_data.dosen_pembimbing IS 'Nama dosen pembimbing untuk pemohon layanan Data Nol Rupiah.';
COMMENT ON COLUMN public.permohonan_data.kontak_dosen IS 'Informasi kontak dosen pembimbing (No. HP atau Email).';
COMMENT ON COLUMN public.permohonan_data.judul_skripsi IS 'Judul skripsi atau penelitian untuk layanan Data Nol Rupiah.';
COMMENT ON COLUMN public.permohonan_data.jumlah_hari IS 'Jumlah hari kejadian untuk klaim asuransi.';
COMMENT ON COLUMN public.permohonan_data.lokasi_kejadian IS 'Alamat atau lokasi detail kejadian untuk klaim asuransi.';
COMMENT ON COLUMN public.permohonan_data.estimasi_biaya IS 'Estimasi biaya layanan yang tercatat saat permohonan dibuat.';
