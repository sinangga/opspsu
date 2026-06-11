"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, XCircle, Clock, BarChart3, 
  PieChart as PieChartIcon, CreditCard, FileText, Upload, Phone, Mail, Building2, MapPin,
  CheckCheck, ChevronDown, FileDown, Loader2, User, RefreshCcw, LogOut, Search, Eye
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/lib/nav";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PermohonanData, AdminUser } from "./types";
import { AdminAutoLogout } from "@/components/AdminAutoLogout";
import dynamic from "next/dynamic";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Add type definition for jspdf-autotable to avoid TS errors if needed
// Or just use @ts-ignore for the autotable call

const PieChart = dynamic(() => import("recharts").then((mod) => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((mod) => mod.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((mod) => mod.Cell), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), { ssr: false });
const LabelList = dynamic(() => import("recharts").then((mod) => mod.LabelList), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function AdminDashboard() {
  const [data, setData] = React.useState<PermohonanData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [user, setUser] = React.useState<AdminUser | null>(null);
  
  // Dialog states
  const [isAcceptOpen, setIsAcceptOpen] = React.useState(false);
  const [isRejectOpen, setIsRejectOpen] = React.useState(false);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isUploadQrOpen, setIsUploadQrOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<PermohonanData | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [qrFile, setQrFile] = React.useState<File | null>(null);
  const [virtualAccount, setVirtualAccount] = React.useState("");
  const [isEditPaymentMode, setIsEditPaymentMode] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [showAllItems, setShowAllItems] = React.useState(false);

  const router = useRouter();
  const supabase = createClient();

  const fetchRequests = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data: permohonan, error } = await supabase
        .from("permohonan_data")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setData((permohonan as PermohonanData[]) || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil data";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/admin/login");
        return;
      }
      setUser(user);
      fetchRequests();
    };
    checkUser();
  }, [router, fetchRequests, supabase]);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const dateString = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    
    // Header
    doc.setFontSize(18);
    doc.text("Laporan Bulanan Permohonan Data", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Stasiun Meteorologi Pangsuma BMKG`, 14, 30);
    doc.text(`Dicetak pada: ${dateString}`, 14, 36);
    
    // Stats Summary
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Ringkasan Statistik:", 14, 48);
    doc.setFontSize(10);
    doc.text(`Total Permohonan: ${data.length}`, 14, 54);
    doc.text(`Total Pendapatan: ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(totalRevenue)}`, 14, 60);
    
    const tableData = data.map(item => [
      new Date(item.created_at).toLocaleDateString('id-ID'),
      item.nama,
      item.keperluan,
      item.estimasi_biaya === 0 ? "Gratis" : item.estimasi_biaya.toLocaleString('id-ID'),
      item.status === 'completed' ? 'Selesai' : item.status === 'approved' ? 'Disetujui' : item.status === 'rejected' ? 'Ditolak' : 'Pending',
      item.status_bayar === 'paid' ? 'Lunas' : 'Belum Lunas'
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['Tanggal', 'Nama Pemohon', 'Keperluan', 'Biaya (Rp)', 'Status', 'Pembayaran']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      styles: { fontSize: 8 },
    });

    doc.save(`Laporan_BMKG_${now.getMonth() + 1}_${now.getFullYear()}.pdf`);
    toast.success("Laporan PDF berhasil di-generate");
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.refresh();
      router.push("/admin/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal logout";
      toast.error(message);
    }
  };

  const handleAccept = async () => {
    if (!selectedItem) return;
    setIsProcessing(true);
    try {
      // Call API to approve
      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedItem.id,
          estimasi_biaya: selectedItem.estimasi_biaya
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal memproses permohonan");
      }

      toast.success("Permohonan diterima dan email notifikasi dikirim");
      setIsAcceptOpen(false);
      
      // If payment is needed, offer to upload QR
      if (selectedItem.estimasi_biaya > 0) {
        setIsEditPaymentMode(true); // Always edit mode for new approvals
        setVirtualAccount("");
        setIsUploadQrOpen(true);
      } else {
        // If free, just refresh
        fetchRequests();
      }

    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memproses permohonan");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQrUpload = async () => {
    if (!selectedItem) return;
    if (!qrFile && !virtualAccount) {
      toast.error("Mohon upload QR Code atau isi Virtual Account");
      return;
    }

    setIsProcessing(true);
    try {
      let filePath = null;

      if (qrFile) {
        const fileExt = qrFile.name.split('.').pop();
        const fileName = `${selectedItem.id}_qr.${fileExt}`;
        filePath = `payments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("permohonan")
          .upload(filePath, qrFile, { upsert: true });

        if (uploadError) throw uploadError;
      }
      
      const response = await fetch('/api/admin/send-payment-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedItem.id,
          qr_code_url: filePath,
          virtual_account: virtualAccount || null
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal mengirim info pembayaran");

      toast.success("Informasi pembayaran berhasil dikirim ke pemohon");
      setIsUploadQrOpen(false);
      setQrFile(null);
      setVirtualAccount("");
      fetchRequests();
    } catch (error) {
       toast.error(error instanceof Error ? error.message : "Gagal upload info pembayaran");
       console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkipQr = () => {
    setIsUploadQrOpen(false);
    setQrFile(null);
    fetchRequests();
  };

  const handleReject = async () => {
    if (!selectedItem || !rejectReason) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    setIsProcessing(true);
    try {
      // Call API to reject
      const response = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedItem.id,
          reason: rejectReason,
          email: selectedItem.email,
          nama: selectedItem.nama
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal menolak permohonan");
      }

      toast.success("Permohonan ditolak dan email notifikasi dikirim");
      setIsRejectOpen(false);
      setRejectReason("");
      fetchRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menolak permohonan");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Gagal memperbarui status");
      }

      toast.success(`Status berhasil diperbarui menjadi ${newStatus === 'completed' ? 'Selesai' : 'Disetujui'}`);
      fetchRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui status");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredData = data.filter((item) => 
    item.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.keperluan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.whatsapp?.includes(searchTerm)
  );

  const getFileUrl = (path: string | null) => {
    if (!path) return "";
    const { data } = supabase.storage.from("permohonan").getPublicUrl(path);
    return data.publicUrl;
  };

  // Chart Data Preparation
  const paymentStats = React.useMemo(() => {
    const stats = {
      paid: data.filter(d => d.status_bayar === 'paid').length,
      pending: data.filter(d => d.status_bayar === 'pending').length,
      free: data.filter(d => d.status_bayar === 'free').length,
    };
    return [
      { name: 'Lunas', value: stats.paid, color: 'hsl(var(--chart-2))' }, // Greenish
      { name: 'Menunggu', value: stats.pending, color: 'hsl(var(--chart-1))' }, // Primary
      { name: 'Gratis', value: stats.free, color: 'hsl(var(--muted-foreground))' },
    ].filter(d => d.value > 0);
  }, [data]);

  const revenueStats = React.useMemo(() => {
    const revenue: Record<string, number> = {};
    const categoryColors: Record<string, string> = {
      'Penelitian': 'hsl(var(--chart-1))',
      'PKL': 'hsl(var(--chart-2))',
      'Klaim Asuransi': 'hsl(var(--chart-3))',
      'Umum': 'hsl(var(--chart-4))',
      'Lainnya': 'hsl(var(--chart-5))',
    };
    
    data.filter(d => d.status === 'approved' || d.status === 'completed').forEach(item => {
      revenue[item.keperluan] = (revenue[item.keperluan] || 0) + item.estimasi_biaya;
    });
    
    return Object.entries(revenue)
      .map(([name, value]) => ({ 
        name, 
        value,
        color: categoryColors[name] || `hsl(var(--chart-${(Math.abs(name.length) % 5) + 1}))`
      }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const categoryCountStats = React.useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach(item => {
      counts[item.keperluan] = (counts[item.keperluan] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const totalRevenue = React.useMemo(() => {
     return data
       .filter(d => d.status === 'approved' || d.status === 'completed')
       .reduce((acc, curr) => acc + curr.estimasi_biaya, 0);
  }, [data]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-500/15 text-green-600 border-green-500/20 hover:bg-green-500/25">Disetujui</Badge>;
      case 'rejected': return <Badge variant="destructive" className="bg-red-500/15 text-red-600 border-red-500/20 hover:bg-red-500/25">Ditolak</Badge>;
      case 'completed': return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/20 hover:bg-blue-500/25">Selesai</Badge>;
      default: return <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10">Pending</Badge>;
    }
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse font-medium">Memuat data dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 min-h-screen">
      <AdminAutoLogout />
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Admin Dashboard
          </h1>
          <div className="flex items-center text-sm text-muted-foreground">
            <div className="flex items-center bg-card px-2 py-1 rounded-md border">
              <User className="w-4 h-4 mr-2 text-primary" />
              <span className="font-medium mr-1">Admin:</span>
              <span className="text-foreground">{user?.email}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            Cetak Laporan
          </Button>
          <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

            {/* Main Data Table */}

            <Card>

              <CardHeader>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                  <CardTitle>Daftar Permohonan Data</CardTitle>

                  <div className="relative w-full md:w-80">

                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                    <Input

                      placeholder="Cari nama, keperluan, WA..."

                      className="pl-10 h-10"

                      value={searchTerm}

                      onChange={(e) => setSearchTerm(e.target.value)}

                    />

                  </div>

                </div>

              </CardHeader>

              <CardContent>

                <div className="border rounded-lg overflow-hidden">

                  <Table>

                    <TableHeader className="bg-muted/50">

                      <TableRow>

                        <TableHead>Tanggal</TableHead>

                        <TableHead>Pemohon</TableHead>

                        <TableHead>Keperluan</TableHead>

                        <TableHead>Biaya</TableHead>

                        <TableHead>Status</TableHead>

                        <TableHead>Berkas</TableHead>

                        <TableHead className="text-right">Aksi</TableHead>

                      </TableRow>

                    </TableHeader>

                    <TableBody>

                      {filteredData.length === 0 ? (

                        <TableRow>

                          <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">

                            Tidak ada data ditemukan.

                          </TableCell>

                        </TableRow>

                      ) : (

                        filteredData.map((item) => (

                          <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">

                            <TableCell className="text-xs">

                              <div className="flex flex-col">

                                <span className="font-semibold">{new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>

                                <span className="text-muted-foreground">{new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>

                              </div>

                            </TableCell>

                            <TableCell>

                              <div className="flex flex-col gap-1">

                                <span className="font-bold text-sm leading-tight">{item.nama}</span>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">

                                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {item.whatsapp || '-'}</span>

                                </div>

                                {item.universitas && (

                                   <span className="text-xs text-primary">{item.universitas}</span>

                                )}

                              </div>

                            </TableCell>

                            <TableCell>

                              <Badge variant="secondary" className="font-medium uppercase tracking-wider">

                                {item.keperluan}

                              </Badge>

                            </TableCell>

                            <TableCell>

                              <div className="flex flex-col">

                                <span className={`font-bold ${item.estimasi_biaya === 0 ? "text-green-600" : "text-foreground"}`}>

                                  {item.estimasi_biaya === 0 

                                    ? "Gratis" 

                                    : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(item.estimasi_biaya)}

                                </span>

                                {item.status_bayar === 'paid' && (

                                  <span className="text-xs text-green-600 flex items-center gap-1 font-medium"><CheckCircle2 className="w-3 h-3" /> Lunas</span>

                                )}

                              </div>

                            </TableCell>

                            <TableCell>

                              {getStatusBadge(item.status || 'pending')}

                            </TableCell>

                            <TableCell>

                              <div className="flex gap-2">

                                {item.ktp_url && (

                                  <Button size="icon" variant="outline" className="h-8 w-8" asChild title="KTP">

                                    <a href={getFileUrl(item.ktp_url)} target="_blank" rel="noopener noreferrer">

                                      <User className="w-4 h-4" />

                                    </a>

                                  </Button>

                                )}

                                {item.berkas_url && (

                                  <Button size="icon" variant="outline" className="h-8 w-8" asChild title="Berkas">

                                    <a href={getFileUrl(item.berkas_url)} target="_blank" rel="noopener noreferrer">

                                      <FileText className="w-4 h-4" />

                                    </a>

                                  </Button>

                                )}

                              </div>

                            </TableCell>

                            <TableCell className="text-right">

                               <div className="flex justify-end gap-1">

                                  <Button 

                                    variant="ghost" 

                                    size="icon" 

                                    className="h-8 w-8 text-muted-foreground"

                                    onClick={() => {

                                      setSelectedItem(item);

                                      setIsDetailOpen(true);

                                    }}

                                  >

                                    <Eye className="w-4 h-4" />

                                  </Button>

                                  

                                  {(item.status === 'pending' || !item.status) && (

                                    <>

                                      <Button 

                                        variant="ghost" 

                                        size="icon" 

                                        className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-50"

                                        onClick={() => {

                                          setSelectedItem(item);

                                          setIsAcceptOpen(true);

                                        }}

                                        title="Terima Permohonan"

                                      >

                                        <CheckCircle2 className="w-4 h-4" />

                                      </Button>

                                      <Button 

                                        variant="ghost" 

                                        size="icon" 

                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-red-50"

                                        onClick={() => {

                                          setSelectedItem(item);

                                          setIsRejectOpen(true);

                                        }}

                                        title="Tolak Permohonan"

                                      >

                                        <XCircle className="w-4 h-4" />

                                      </Button>

                                    </>

                                  )}

      

                                  {/* Upload QR Button for Approved & Paid requests */}

                                  {item.status === 'approved' && item.estimasi_biaya > 0 && (

                                     <Button 

                                        variant="ghost" 

                                        size="icon" 

                                        className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"

                                                                                onClick={() => {

                                                                                  setSelectedItem(item);

                                                                                  setVirtualAccount(item.virtual_account || "");

                                                                                  // If data exists, start in View Mode (false). If empty, start in Edit Mode (true).

                                                                                  setIsEditPaymentMode(!item.qr_code_url && !item.virtual_account);

                                                                                  setIsUploadQrOpen(true);

                                                                                }}

                                                                                title="Upload Bukti Tagihan/QR"

                                      >

                                        <Upload className="w-4 h-4" />

                                      </Button>

                                  )}

      

                                  {/* Toggle Completed Status */}

                                  {(item.status === 'approved' || item.status === 'completed') && (

                                     <Button 

                                        variant="ghost" 

                                        size="icon" 

                                        className={cn(

                                          "h-8 w-8 transition-colors",

                                          item.status === 'completed' 

                                            ? "text-blue-600 bg-blue-50 hover:bg-blue-100" 

                                            : "text-muted-foreground hover:text-blue-600 hover:bg-blue-50"

                                        )}

                                        onClick={() => handleStatusChange(item.id, item.status === 'completed' ? 'approved' : 'completed')}

                                        title={item.status === 'completed' ? "Kembalikan ke Proses" : "Tandai Selesai"}

                                        disabled={isProcessing}

                                      >

                                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}

                                      </Button>

                                  )}

                               </div>

                            </TableCell>

                          </TableRow>

                        ))

                      )}

                    </TableBody>

                  </Table>

                </div>

              </CardContent>

            </Card>

      

            {/* Stats Overview */}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

              {[

                { label: "Total Pendapatan (Est)", value: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(totalRevenue), icon: CreditCard, color: "text-emerald-500", bg: "bg-emerald-500/10" },

                { label: "Total Permohonan", value: data.length, icon: FileText, color: "text-primary", bg: "bg-primary/10" },

                { label: "Perlu Tindakan", value: data.filter(d => d.status === 'pending' || !d.status).length, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },

                { label: "Ditolak", value: data.filter(d => d.status === 'rejected').length, icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },

              ].map((stat, i) => (

                <Card key={i} className="overflow-hidden border-none shadow-sm bg-card">

                  <CardContent className="p-0">

                     <div className="flex items-stretch h-20">

                        <div className={`w-2 ${stat.bg.replace('/10', '')}`} />

                        <div className="flex-1 p-3 flex justify-between items-center">

                          <div>

                            <p className="text-xs font-semibold text-muted-foreground">{stat.label}</p>

                            <p className="text-xl font-bold">{stat.value}</p>

                          </div>

                          <div className={`p-2 rounded-full ${stat.bg}`}>

                            <stat.icon className={`w-5 h-5 ${stat.color}`} />

                          </div>

                       </div>

                     </div>

                  </CardContent>

                </Card>

              ))}

            </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <PieChartIcon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Status Pembayaran</CardTitle>
                <CardDescription>Distribusi pembayaran</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              {paymentStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentStats}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {paymentStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      align="center"
                      iconType="circle"
                      wrapperStyle={{ paddingTop: '20px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground italic text-sm">
                  Belum ada data pembayaran
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">Statistik Kategori</CardTitle>
                    <CardDescription>Total PNBP dan Jumlah Permohonan</CardDescription>
                  </div>
                </div>
                <div className="flex bg-muted p-1 rounded-md text-[10px] font-bold">
                  <span className="px-2 py-1 bg-background rounded shadow-sm">PNBP</span>
                  <span className="px-2 py-1 text-muted-foreground">VOLUME</span>
                </div>
             </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full pt-4">
              {revenueStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={revenueStats} 
                    layout="vertical" 
                    margin={{ left: 10, right: 80, top: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--muted)/0.4)" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={140} 
                      tick={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      cursor={{ fill: "hsl(var(--muted)/0.3)" }} 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const count = categoryCountStats.find(c => c.name === payload[0].payload.name)?.value || 0;
                          return (
                            <div className="bg-popover border border-border p-3 rounded-xl shadow-xl">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                                {payload[0].payload.name}
                              </p>
                              <div className="space-y-1">
                                <div className="flex justify-between gap-4">
                                  <span className="text-xs text-muted-foreground">Total PNBP:</span>
                                  <span className="text-xs font-bold text-primary">
                                    {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(payload[0].value as number)}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-xs text-muted-foreground">Total Data:</span>
                                  <span className="text-xs font-bold">{count} Permohonan</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[0, 4, 4, 0]} 
                      barSize={24}
                      background={{ fill: 'hsl(var(--muted)/0.2)', radius: [0, 4, 4, 0] }}
                    >
                      {revenueStats.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color} 
                        />
                      ))}
                      {/* @ts-expect-error - Recharts label component types can be tricky */}
                      <LabelList 
                        dataKey="value" 
                        position="right" 
                        formatter={(val: number) => val === 0 ? "Gratis" : `Rp ${(val/1000000).toFixed(1)}jt`}
                        style={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} 
                        offset={10}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground italic text-sm">
                  Belum ada pendapatan tercatat
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* All Dialogs */}
      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Permohonan</DialogTitle>
            <DialogDescription>
              Detail lengkap data permohonan yang diajukan.
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <User className="w-4 h-4" /> Informasi Pemohon
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-muted-foreground">Nama:</span>
                    <span className="col-span-2 font-medium">{selectedItem.nama}</span>
                    <span className="text-muted-foreground">Email:</span>
                    <span className="col-span-2">{selectedItem.email || '-'}</span>
                    <span className="text-muted-foreground">WhatsApp:</span>
                    <span className="col-span-2">{selectedItem.whatsapp || '-'}</span>
                    {selectedItem.universitas && (
                      <>
                        <span className="text-muted-foreground">Instansi:</span>
                        <span className="col-span-2">{selectedItem.universitas}</span>
                        <span className="text-muted-foreground">NIM/ID:</span>
                        <span className="col-span-2">{selectedItem.nim || '-'}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Detail Permintaan
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-muted-foreground">Keperluan:</span>
                    <span className="col-span-2">
                      <Badge variant="outline">{selectedItem.keperluan}</Badge>
                    </span>
                    
                    {(selectedItem.tanggal_mulai || selectedItem.tanggal_selesai) && (
                      <>
                        <span className="text-muted-foreground">Periode Data:</span>
                        <div className="col-span-2 flex flex-col gap-1">
                          <span className="font-medium">
                            {selectedItem.tanggal_mulai ? new Date(selectedItem.tanggal_mulai).toLocaleDateString('id-ID') : '?'} 
                            {' - '} 
                            {selectedItem.tanggal_selesai ? new Date(selectedItem.tanggal_selesai).toLocaleDateString('id-ID') : '?'}
                          </span>
                          {selectedItem.jumlah_hari && (
                            <Badge variant="secondary" className="w-fit text-[10px]">{selectedItem.jumlah_hari} Hari</Badge>
                          )}
                        </div>
                      </>
                    )}

                    <span className="text-muted-foreground">Keterangan:</span>
                    <span className="col-span-2 italic text-muted-foreground">{selectedItem.keterangan || '-'}</span>
                    <span className="text-muted-foreground">Estimasi Biaya:</span>
                    <span className="col-span-2 font-bold text-primary">
                      {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(selectedItem.estimasi_biaya)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Specific Fields based on Keperluan */}
                {(selectedItem.keperluan === 'Penelitian' || selectedItem.keperluan === 'PKL') && (
                   <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-lg space-y-3 border border-blue-100 dark:border-blue-900">
                    <h3 className="font-semibold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <Building2 className="w-4 h-4" /> Data Akademik
                    </h3>
                    <div className="grid grid-cols-1 gap-3 text-sm">
                      <div>
                        <span className="block text-muted-foreground text-xs mb-1">Judul Penelitian/Skripsi</span>
                        <p className="font-medium leading-relaxed">{selectedItem.judul_skripsi || '-'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="block text-muted-foreground text-xs mb-1">Dosen Pembimbing</span>
                          <p>{selectedItem.dosen_pembimbing || '-'}</p>
                        </div>
                        <div>
                           <span className="block text-muted-foreground text-xs mb-1">Kontak Dosen</span>
                           <p>{selectedItem.kontak_dosen || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedItem.keperluan === 'Klaim Asuransi' && (
                  <div className="bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-lg space-y-3 border border-amber-100 dark:border-amber-900">
                     <h3 className="font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <MapPin className="w-4 h-4" /> Data Kejadian
                    </h3>
                    <div className="text-sm space-y-2">
                       <div>
                          <span className="block text-muted-foreground text-xs mb-1">Lokasi Kejadian</span>
                          <p className="font-medium">{selectedItem.lokasi_kejadian || '-'}</p>
                        </div>
                         <div>
                          <span className="block text-muted-foreground text-xs mb-1">Waktu Kejadian</span>
                          <p className="font-medium">{selectedItem.keterangan || '-'}</p> 
                          {/* Note: In your schema, time often goes to keterangan or separate fields, verify if specific date fields exist */}
                        </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Berkas Lampiran</h3>
                  <div className="grid grid-cols-2 gap-3">
                     {selectedItem.ktp_url ? (
                        <a 
                          href={getFileUrl(selectedItem.ktp_url)} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted transition-colors"
                        >
                          <div className="p-2 bg-primary/10 text-primary rounded-md">
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate">KTP / Identitas</p>
                            <p className="text-xs text-muted-foreground">Klik untuk melihat</p>
                          </div>
                        </a>
                     ) : (
                       <div className="p-3 border border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-sm h-16">
                         Tidak ada KTP
                       </div>
                     )}

                     {selectedItem.berkas_url ? (
                        <a 
                          href={getFileUrl(selectedItem.berkas_url)} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted transition-colors"
                        >
                          <div className="p-2 bg-primary/10 text-primary rounded-md">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate">Berkas Pendukung</p>
                            <p className="text-xs text-muted-foreground">Klik untuk melihat</p>
                          </div>
                        </a>
                     ) : (
                       <div className="p-3 border border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-sm h-16">
                         Tidak ada Berkas
                       </div>
                     )}
                  </div>
                </div>

                {selectedItem.status === 'rejected' && (
                  <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg text-destructive text-sm">
                    <span className="font-bold block mb-1">Alasan Penolakan:</span>
                    {selectedItem.rejected_reason || '-'}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept Dialog */}
      <Dialog open={isAcceptOpen} onOpenChange={setIsAcceptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terima Permohonan?</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menerima permohonan ini? Email notifikasi akan dikirimkan ke pemohon.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
             {selectedItem && (
               <div className="bg-muted p-3 rounded-md text-sm">
                 <p><span className="font-semibold">Pemohon:</span> {selectedItem.nama}</p>
                 <p><span className="font-semibold">Keperluan:</span> {selectedItem.keperluan}</p>
                 <p className="mt-2"><span className="font-semibold">Biaya:</span> {selectedItem.estimasi_biaya === 0 ? "Gratis" : selectedItem.estimasi_biaya.toLocaleString("id-ID", {style:"currency", currency:"IDR"})}</p>
               </div>
             )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAcceptOpen(false)} disabled={isProcessing}>Batal</Button>
            <Button onClick={handleAccept} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white">
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Terima Permohonan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* Reject Dialog */}
       <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Permohonan</DialogTitle>
            <DialogDescription>
              Mohon berikan alasan penolakan. Informasi ini akan dikirimkan via email ke pemohon.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reason">Alasan Penolakan</Label>
              <Textarea 
                id="reason" 
                placeholder="Contoh: Berkas tidak lengkap, data tidak tersedia, dll..." 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)} disabled={isProcessing}>Batal</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessing || !rejectReason.trim()}>
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Tolak Permohonan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload QR Dialog */}
      <Dialog open={isUploadQrOpen} onOpenChange={setIsUploadQrOpen}>
        <DialogContent>
           <DialogHeader>
            <DialogTitle>Informasi Pembayaran</DialogTitle>
            <DialogDescription>
              {isEditPaymentMode 
                ? "Upload QR Code (QRIS) atau masukkan Virtual Account untuk dikirim ke pemohon." 
                : "Informasi pembayaran yang telah dikirim ke pemohon."}
            </DialogDescription>
          </DialogHeader>

          {!isEditPaymentMode && selectedItem ? (
             <div className="space-y-4 py-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-4 text-center">
                  {selectedItem.virtual_account ? (
                    <div>
                       <p className="text-xs text-muted-foreground font-semibold uppercase">Virtual Account</p>
                       <p className="text-xl font-bold font-mono tracking-wider text-primary mt-1">{selectedItem.virtual_account}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Tidak ada Virtual Account</p>
                  )}

                  <div className="border-t border-muted-foreground/20 my-2"></div>

                  {selectedItem.qr_code_url ? (
                     <div className="flex flex-col items-center">
                        <p className="text-xs text-muted-foreground font-semibold uppercase mb-2">QR Code / Tagihan</p>
                        <div className="relative w-48 h-48 border rounded-lg overflow-hidden bg-white">
                           <img 
                              src={getFileUrl(selectedItem.qr_code_url)} 
                              alt="QR Payment" 
                              className="w-full h-full object-contain"
                           />
                        </div>
                     </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Tidak ada QR Code uploaded</p>
                  )}
                </div>
             </div>
          ) : (
            <div className="space-y-4 py-4">
               <div className="space-y-2">
                  <Label htmlFor="virtual-account">Virtual Account (Opsional)</Label>
                  <Input 
                     id="virtual-account"
                     placeholder="Masukkan nomor VA atau rekening tujuan..."
                     value={virtualAccount}
                     onChange={(e) => setVirtualAccount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Isi jika pembayaran melalui transfer bank / VA.</p>
               </div>

               <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-muted"></div>
                  <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs font-bold">DAN / ATAU</span>
                  <div className="flex-grow border-t border-muted"></div>
               </div>

               <div className="space-y-2">
                  <Label htmlFor="qr-upload">File QR Code / Gambar Tagihan</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors relative">
                     <input 
                        type="file" 
                        id="qr-upload" 
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                     />
                     {qrFile ? (
                        <div className="flex flex-col items-center text-primary">
                          <CheckCircle2 className="w-8 h-8 mb-2" />
                          <span className="font-medium text-sm">{qrFile.name}</span>
                          <span className="text-xs text-muted-foreground">{(qrFile.size / 1024).toFixed(1)} KB</span>
                        </div>
                     ) : (
                        <>
                          <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                          <span className="text-sm font-medium">Klik untuk upload gambar</span>
                          <span className="text-xs text-muted-foreground mt-1">PNG, JPG, JPEG (Max 2MB)</span>
                        </>
                     )}
                  </div>
               </div>
            </div>
          )}

          <DialogFooter>
             {!isEditPaymentMode ? (
                <>
                   <Button variant="outline" onClick={() => setIsUploadQrOpen(false)}>Tutup</Button>
                   <Button onClick={() => setIsEditPaymentMode(true)}>Upload Ulang / Edit</Button>
                </>
             ) : (
               <>
                 <Button variant="ghost" onClick={handleSkipQr} disabled={isProcessing}>
                   {selectedItem && (selectedItem.qr_code_url || selectedItem.virtual_account) ? "Batal Edit" : "Lewati (Upload Nanti)"}
                 </Button>
                 <Button onClick={handleQrUpload} disabled={isProcessing || (!qrFile && !virtualAccount)}>
                   {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                   Kirim Info Pembayaran
                 </Button>
               </>
             )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
