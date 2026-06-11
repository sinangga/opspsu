"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { supabase } from "@/lib/supabase";

const SERVICES = [
  { id: "konsultasi", label: "Konsultasi Meteorologi", price: 3750000 },
  { id: "banjir", label: "Klaim Asuransi - Banjir", price: 175000 },
  { id: "petir", label: "Klaim Asuransi - Petir", price: 185000 },
  { id: "nol_rupiah", label: "Data Nol Rupiah", price: 0 },
];

export function PermohonanDataForm() {
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [currentTicketId, setCurrentTicketId] = React.useState<string | null>(null);
  const [ktpFileName, setKtpFileName] = React.useState<string | null>(null);
  const [berkasFileName, setBerkasFileName] = React.useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = React.useState<string>("");
  const [days, setDays] = React.useState<number>(1);
  // Date states
  const [tanggalMulai, setTanggalMulai] = React.useState<string>("");
  const [tanggalSelesai, setTanggalSelesai] = React.useState<string>("");

  const formRef = React.useRef<HTMLFormElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, setFileName: (name: string | null) => void) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
    } else {
      setFileName(null);
    }
  };

  // Calculate days difference if dates change
  React.useEffect(() => {
    if (tanggalMulai && tanggalSelesai) {
      const start = new Date(tanggalMulai);
      const end = new Date(tanggalSelesai);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include start date
      if (!isNaN(diffDays) && diffDays > 0) {
        setDays(diffDays);
      }
    }
  }, [tanggalMulai, tanggalSelesai]);

  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const formatCurrency = (amount: number) => {
    if (amount === 0) return "Gratis (Syarat & Ketentuan Berlaku)";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const selectedService = SERVICES.find((s) => s.id === selectedServiceId);
  const isDynamicCost = selectedServiceId === "banjir" || selectedServiceId === "petir";
  const totalCost = selectedService 
    ? (isDynamicCost ? selectedService.price * days : selectedService.price)
    : 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    const nama = formData.get("nama") as string;
    const email = formData.get("email") as string;
    const whatsapp = formData.get("whatsapp") as string;
    const keperluan = selectedService?.label || (formData.get("keperluan") as string);
    const keterangan = formData.get("keterangan") as string;
    
    // Additional fields
    const universitas = formData.get("universitas") as string;
    const nim = formData.get("nim") as string;
    const dosen_pembimbing = formData.get("dosen") as string;
    const kontak_dosen = formData.get("kontak_dosen") as string;
    const judul_skripsi = formData.get("judul_skripsi") as string;
    const jumlah_hari = formData.get("jumlah_hari") ? parseInt(formData.get("jumlah_hari") as string) : days;
    const lokasi_kejadian = formData.get("lokasi_kejadian") as string;
    const tanggal_mulai = formData.get("tanggal_mulai") as string;
    const tanggal_selesai = formData.get("tanggal_selesai") as string;

    const ktpFile = formData.get("ktp") as File;
    const berkasFile = formData.get("berkas") as File;

    // Validation
    if (!selectedServiceId) {
        toast.error("Pilih keperluan data terlebih dahulu");
        setLoading(false);
        return;
    }

    if (!ktpFile || ktpFile.size === 0) {
      toast.error("Wajib upload scan KTP");
      setLoading(false);
      return;
    }
    if (ktpFile.size > MAX_FILE_SIZE) {
      toast.error("Ukuran file KTP maksimal 5MB");
      setLoading(false);
      return;
    }
    if (berkasFile && berkasFile.size > MAX_FILE_SIZE) {
      toast.error("Ukuran file Berkas maksimal 5MB");
      setLoading(false);
      return;
    }

    try {
      let ktpPath = null;
      let berkasPath = null;

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");

      // 1. Upload KTP to Supabase (Client-side)
      const ktpExt = ktpFile.name.split(".").pop();
      const ktpName = `${generateUUID()}.${ktpExt}`;
      const ktpStoragePath = `ktp/${year}/${month}/${ktpName}`;

      console.log("Attempting KTP upload to:", ktpStoragePath);

      const { data: ktpData, error: ktpError } = await supabase.storage
        .from("permohonan")
        .upload(ktpStoragePath, ktpFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (ktpError) {
        console.error("KTP Upload Error Details:", ktpError);
        throw new Error("Gagal upload KTP: " + ktpError.message);
      }
      ktpPath = ktpData.path;

      // 2. Upload Berkas to Supabase (Client-side)
      if (berkasFile && berkasFile.size > 0) {
        const berkasExt = berkasFile.name.split(".").pop();
        const berkasName = `${generateUUID()}.${berkasExt}`;
        const berkasStoragePath = `berkas/${year}/${month}/${berkasName}`;

        const { data: berkasData, error: berkasError } = await supabase.storage
          .from("permohonan")
          .upload(berkasStoragePath, berkasFile, {
             cacheControl: "3600",
             upsert: false,
          });

        if (berkasError) {
          console.error("Berkas Upload Error Details:", berkasError);
          throw new Error("Gagal upload Berkas: " + berkasError.message);
        }
        berkasPath = berkasData.path;
      }

      // 3. Submit Metadata to API
      const payload = {
        nama,
        email,
        whatsapp,
        keperluan,
        keterangan,
        ktp_path: ktpPath,
        berkas_path: berkasPath,
        universitas,
        nim,
        dosen_pembimbing,
        kontak_dosen,
        judul_skripsi,
        jumlah_hari,
        lokasi_kejadian,
        tanggal_mulai,
        tanggal_selesai,
        estimasi_biaya: totalCost,
      };

      const response = await fetch("/api/permohonan-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Server Error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      const ticketId = data.ticketId;
      setCurrentTicketId(ticketId);
      toast.success("Permohonan berhasil dikirim!");
      
      // Reset form
      if (formRef.current) {
        formRef.current.reset();
      }
      setKtpFileName(null);
      setBerkasFileName(null);
      setSelectedServiceId("");
      setDays(1);
      setTanggalMulai("");
      setTanggalSelesai("");
      
      // Show success popup
      setSubmitted(true);
    } catch (error) {
      console.error("Form Submission Error:", error);
      let message = error instanceof Error ? error.message : "Gagal mengirim permohonan";
      
      if (message === "Load failed" || message === "Failed to fetch") {
        message = "Gagal terhubung ke server. Periksa koneksi internet Anda, AdBlocker, atau pastikan server sudah berjalan.";
      }
      
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Dialog open={submitted} onOpenChange={setSubmitted}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="flex flex-col items-center text-center space-y-4 pt-4">
            <div className="rounded-full bg-green-500/20 p-4">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-green-700">Berhasil Dikirim!</DialogTitle>
            <DialogDescription className="text-base">
              Permohonan data Anda telah kami terima. Simpan nomor tiket di bawah ini untuk melacak status permohonan Anda.
            </DialogDescription>
          </DialogHeader>
          
          {currentTicketId && (
            <div className="bg-muted p-4 rounded-xl border border-dashed flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Nomor Tiket Anda</p>
              <p className="text-3xl font-black text-primary tracking-widest">
                {currentTicketId?.toUpperCase()}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button 
              onClick={() => {
                if (currentTicketId) {
                  window.location.href = `/tracking?ticket=${currentTicketId}`;
                }
              }}
              className="bg-primary hover:bg-primary/90 text-white transition-colors"
            >
              Lacak Status Sekarang
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button 
              variant="ghost"
              onClick={() => setSubmitted(false)}
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Form Permohonan Data</CardTitle>
          <CardDescription>
            Silakan isi formulir berikut untuk mengajukan permohonan data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama Lengkap</Label>
            <Input id="nama" name="nama" placeholder="Masukkan nama lengkap anda" required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email (Opsional)</Label>
              <Input id="email" name="email" type="email" placeholder="contoh@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">No. WhatsApp (Opsional)</Label>
              <Input id="whatsapp" name="whatsapp" type="tel" placeholder="08xxxxxxxxxx" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keperluan">Layanan / Keperluan Data</Label>
            <Select 
              name="keperluan" 
              value={selectedServiceId} 
              onValueChange={setSelectedServiceId} 
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih layanan..." />
              </SelectTrigger>
              <SelectContent>
                {SERVICES.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection for relevant services */}
          {selectedServiceId && selectedServiceId !== "nol_rupiah" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
               <div className="space-y-2">
                 <Label htmlFor="tanggal_mulai">Tanggal Mulai Data</Label>
                 <Input 
                    type="date" 
                    id="tanggal_mulai" 
                    name="tanggal_mulai" 
                    value={tanggalMulai}
                    onChange={(e) => setTanggalMulai(e.target.value)}
                    required
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="tanggal_selesai">Tanggal Selesai Data</Label>
                 <Input 
                    type="date" 
                    id="tanggal_selesai" 
                    name="tanggal_selesai" 
                    value={tanggalSelesai}
                    onChange={(e) => setTanggalSelesai(e.target.value)}
                    required
                 />
               </div>
            </div>
          )}

          {selectedService && (
            <div className="p-4 rounded-md bg-muted/50 border border-muted-foreground/20">
              <div className="flex justify-between items-center">
                <span className="font-medium">Estimasi Biaya:</span>
                <span className={`font-bold ${totalCost === 0 ? "text-green-600" : "text-primary"}`}>
                  {formatCurrency(totalCost)}
                </span>
              </div>
              {isDynamicCost && (
                <p className="text-xs text-muted-foreground mt-1">
                  *Biaya dihitung per hari ({formatCurrency(selectedService.price)} x {days} hari)
                </p>
              )}
            </div>
          )}

          {/* Conditional Fields for Nol Rupiah */}
          {selectedServiceId === "nol_rupiah" && (
            <div className="space-y-4 border-l-2 border-primary/50 pl-4 py-2 bg-primary/5 rounded-r-md">
               <h3 className="font-semibold text-sm text-primary">Data Mahasiswa (Nol Rupiah)</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="universitas">Universitas</Label>
                    <Input id="universitas" name="universitas" placeholder="Nama Universitas" required />
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="nim">NIM</Label>
                    <Input id="nim" name="nim" placeholder="Nomor Induk Mahasiswa" required />
                 </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="dosen">Dosen Pembimbing</Label>
                    <Input id="dosen" name="dosen" placeholder="Nama Dosen Pembimbing" required />
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="kontak_dosen">Kontak Dosen</Label>
                    <Input id="kontak_dosen" name="kontak_dosen" placeholder="No. HP / Email Dosen" required />
                 </div>
               </div>
               <div className="space-y-2">
                  <Label htmlFor="judul_skripsi">Judul Skripsi</Label>
                  <Input id="judul_skripsi" name="judul_skripsi" placeholder="Judul Skripsi / Penelitian" required />
               </div>
            </div>
          )}

          {/* Conditional Fields for Banjir & Petir */}
          {(selectedServiceId === "banjir" || selectedServiceId === "petir") && (
            <div key={selectedServiceId} className="space-y-4 border-l-2 border-orange-500/50 pl-4 py-2 bg-orange-500/5 rounded-r-md">
              <h3 className="font-semibold text-sm text-orange-700">Detail Kejadian ({selectedService?.label.replace('Klaim Asuransi - ', '')})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="jumlah_hari">Jumlah Hari</Label>
                    <Input 
                      id="jumlah_hari" 
                      name="jumlah_hari" 
                      type="number" 
                      min="1" 
                      placeholder="Contoh: 1" 
                      required 
                      value={days}
                      onChange={(e) => setDays(parseInt(e.target.value) || 0)}
                    />
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="lokasi_kejadian">Lokasi Kejadian</Label>
                    <Input id="lokasi_kejadian" name="lokasi_kejadian" placeholder="Alamat lengkap kejadian" required />
                 </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="keterangan">Keterangan Tambahan (Opsional)</Label>
            <textarea
              id="keterangan"
              name="keterangan"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Tambahkan keterangan detail lainnya..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ktp">Upload KTP <span className="text-red-500">*</span></Label>
            <div className="flex items-center justify-center w-full">
              <Label
                htmlFor="ktp"
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  ktpFileName ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className={`w-8 h-8 mb-2 ${ktpFileName ? "text-primary" : "text-muted-foreground"}`} />
                  {ktpFileName ? (
                    <p className="text-sm font-medium text-primary text-center px-2 truncate max-w-xs">{ktpFileName}</p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold">Klik untuk upload</span> atau drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">PDF, JPG, PNG (Max 5MB)</p>
                    </>
                  )}
                </div>
                <Input
                  id="ktp"
                  name="ktp"
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                  onChange={(e) => handleFileChange(e, setKtpFileName)}
                />
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="berkas">Berkas Pendukung (Opsional)</Label>
            <div className="flex items-center justify-center w-full">
               <Label
                htmlFor="berkas"
                className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  berkasFileName ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                   {berkasFileName ? (
                    <p className="text-sm font-medium text-primary text-center px-2 truncate max-w-xs">{berkasFileName}</p>
                   ) : (
                     <p className="text-sm text-muted-foreground">Klik untuk upload berkas pendukung</p>
                   )}
                </div>
                <Input
                  id="berkas"
                  name="berkas"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.zip"
                  onChange={(e) => handleFileChange(e, setBerkasFileName)}
                />
              </Label>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengirim...
              </>
            ) : (
              "Kirim Permohonan"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
    </>
  );
}