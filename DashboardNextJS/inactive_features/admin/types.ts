export interface PermohonanData {
  id: string;
  created_at: string;
  nama: string;
  email: string | null;
  whatsapp: string | null;
  keperluan: string;
  keterangan: string | null;
  ktp_url: string | null;
  berkas_url: string | null;
  universitas: string | null;
  nim: string | null;
  dosen_pembimbing: string | null;
  kontak_dosen: string | null;
  judul_skripsi: string | null;
  jumlah_hari: number | null;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  lokasi_kejadian: string | null;
  estimasi_biaya: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  status_bayar: 'pending' | 'paid' | 'expired' | 'free';
  qr_code_url: string | null;
  virtual_account: string | null;
  rejected_reason: string | null;
}

export interface AdminUser {
  id: string;
  email?: string;
}
