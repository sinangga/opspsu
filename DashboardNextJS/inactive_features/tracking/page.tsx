"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Loader2, Clock, CheckCircle2, XCircle, FileText, 
  MapPin, Calendar, CreditCard, ChevronRight, Ticket
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const ticketParam = searchParams.get("ticket");
  
  const [ticketId, setTicketId] = React.useState(ticketParam || "");
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<any>(null);

  const handleTrack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ticketId.trim()) {
      toast.error("Silakan masukkan nomor tiket permohonan");
      return;
    }

    setLoading(true);
    setData(null);

    try {
      const response = await fetch(`/api/tracking/${ticketId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal melacak permohonan");
      }

      setData(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tiket tidak ditemukan");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (ticketParam) {
      handleTrack();
    }
  }, [ticketParam]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'approved': return { label: 'Disetujui', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', step: 2 };
      case 'rejected': return { label: 'Ditolak', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', step: 2 };
      case 'completed': return { label: 'Selesai', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', step: 3 };
      default: return { label: 'Menunggu Antrean', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', step: 1 };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-primary/10 rounded-2xl text-primary mb-2">
            <Ticket className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Lacak Permohonan Data</h1>
          <p className="text-slate-500">Masukkan nomor tiket untuk melihat status terbaru permohonan Anda</p>
        </div>

        {/* Search Box */}
        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden">
          <CardContent className="p-2">
            <form onSubmit={handleTrack} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input 
                  placeholder="Masukkan Nomor Tiket (Contoh: 8A2B...)" 
                  className="h-14 pl-12 border-none bg-transparent text-lg focus-visible:ring-0"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                />
              </div>
              <Button type="submit" size="lg" className="h-14 px-8 rounded-xl font-bold" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Lacak"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results Area */}
        {data ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Status Timeline */}
            <Card className="border-none shadow-md">
              <CardContent className="pt-8 pb-10">
                <div className="relative flex justify-between max-w-md mx-auto">
                  {/* Progress Line */}
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-100 -z-0" />
                  <div 
                    className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-1000 -z-0" 
                    style={{ width: `${((getStatusInfo(data.status).step - 1) / 2) * 100}%` }}
                  />
                  
                  {[
                    { label: 'Diajukan', icon: FileText, step: 1 },
                    { label: 'Proses/Verifikasi', icon: Clock, step: 2 },
                    { label: 'Selesai', icon: CheckCircle2, step: 3 }
                  ].map((s, i) => {
                    const isActive = getStatusInfo(data.status).step >= s.step;
                    const isRejected = data.status === 'rejected' && s.step === 2;
                    
                    return (
                      <div key={i} className="relative z-10 flex flex-col items-center gap-2">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-colors duration-500",
                          isRejected ? "bg-red-500 text-white" :
                          isActive ? "bg-primary text-white" : "bg-slate-200 text-slate-400"
                        )}>
                          <s.icon className="w-5 h-5" />
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider",
                          isActive ? "text-slate-900" : "text-slate-400"
                        )}>{isRejected ? 'Ditolak' : s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Detail Info */}
              <Card className="border-none shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Detail Permohonan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                      <Ticket className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Nomor Tiket</p>
                      <p className="font-bold text-slate-900">#{data.no_tiket || data.id}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Tanggal Pengajuan</p>
                      <p className="font-bold text-slate-900">
                        {new Date(data.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Keperluan</p>
                      <p className="font-bold text-slate-900">{data.keperluan}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status Info */}
              <Card className={cn("border shadow-md", getStatusInfo(data.status).bg, getStatusInfo(data.status).border)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Status Saat Ini</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                     <div className={cn("p-3 rounded-2xl", getStatusInfo(data.status).bg, "border border-white/50 shadow-sm")}>
                        {React.createElement(getStatusInfo(data.status).icon, { className: cn("w-8 h-8", getStatusInfo(data.status).color) })}
                     </div>
                     <div>
                        <p className={cn("text-xl font-black", getStatusInfo(data.status).color)}>
                          {getStatusInfo(data.status).label.toUpperCase()}
                        </p>
                        <p className="text-xs text-slate-500">Update terakhir: {new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} WIB</p>
                     </div>
                  </div>
                  
                  <div className="pt-2">
                    {data.status === 'pending' && (
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Permohonan Anda sedang dalam antrean verifikasi petugas. Mohon cek email secara berkala.
                      </p>
                    )}
                    {data.status === 'approved' && (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600 leading-relaxed">
                          Permohonan telah disetujui. 
                          {data.estimasi_biaya > 0 ? " Silakan lakukan pembayaran sesuai instruksi yang dikirim ke email/WA Anda." : " Data sedang disiapkan oleh petugas."}
                        </p>
                        {data.estimasi_biaya > 0 && (
                          <div className="p-3 bg-white/60 rounded-xl border border-white">
                            <p className="text-xs text-slate-400 mb-1">Total PNBP:</p>
                            <p className="text-lg font-bold text-primary">
                              {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(data.estimasi_biaya)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {data.status === 'rejected' && (
                      <div className="p-4 bg-white/60 rounded-xl border border-white">
                        <p className="text-xs text-red-400 mb-1 font-bold">ALASAN PENOLAKAN:</p>
                        <p className="text-sm text-red-700 italic">"{data.rejected_reason || 'Berkas tidak memenuhi kriteria.'}"</p>
                      </div>
                    )}
                    {data.status === 'completed' && (
                      <p className="text-sm text-blue-700 leading-relaxed font-medium">
                        Layanan telah selesai. Data telah dikirimkan ke kontak yang Anda berikan. Terima kasih!
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : !loading && ticketParam ? (
          <div className="text-center p-12 bg-white rounded-3xl shadow-sm">
             <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
             <h3 className="text-xl font-bold text-slate-900">Tiket Tidak Ditemukan</h3>
             <p className="text-slate-500">Pastikan nomor tiket yang Anda masukkan benar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60">
             {[
               { label: 'Cek Status', desc: 'Pantau proses verifikasi' },
               { label: 'Info PNBP', desc: 'Lihat rincian biaya' },
               { label: 'Ambil Data', desc: 'Konfirmasi pengiriman' }
             ].map((f, i) => (
               <Card key={i} className="border-dashed bg-transparent">
                 <CardContent className="p-6 text-center">
                   <p className="font-bold text-slate-400">{f.label}</p>
                   <p className="text-xs text-slate-300">{f.desc}</p>
                 </CardContent>
               </Card>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}
