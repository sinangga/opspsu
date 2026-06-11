"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { gridAndPersist } from "@/lib/firms";
import { Loader2, Download, Zap, BarChart3, Flame } from "lucide-react";

const Map = dynamic(() => import("./parts/Map"), { ssr: false });

// Data is fetched server-side from FIRMS nrt3 archive via /api/hotspot/latest

type FirmRow = { latitude: number; longitude: number; acq_date: string; brightness: number; persistent?: boolean };

export default function HotspotPage() {
  const [rows, setRows] = useState<FirmRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/hotspot/latest')
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(gridAndPersist)
      .then(setRows)
      .catch((e) => setError(String(e)));
  }, []);

  const center = useMemo(() => {
    if (!rows || rows.length === 0) return { lat: -2, lng: 114 };
    const lat = rows.reduce((sum, row) => sum + row.latitude, 0) / rows.length;
    const lng = rows.reduce((sum, row) => sum + row.longitude, 0) / rows.length;
    return { lat, lng };
  }, [rows]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const total = rows.length;
    const persistent = rows.filter(r => r.persistent).length;
    // infer unique dates in current set
    const dates = Array.from(new Set(rows.map(r => r.acq_date.split('T')[0] || r.acq_date)));
    return { total, persistent, days: dates.length };
  }, [rows]);

  const aiSummary = useMemo(() => {
    if (!rows) return '';
    const total = rows.length;
    const persistent = rows.filter(r => r.persistent).length;
    const dates = Array.from(new Set(rows.map(r => (r.acq_date || '').split('T')[0] || r.acq_date))).filter(Boolean);
    const days = dates.length;

    const pick = (list: FirmRow[], n: number) => list
      .slice()
      .sort((a, b) => (b.brightness ?? 0) - (a.brightness ?? 0))
      .slice(0, n)
      .map(p => `${p.latitude.toFixed(2)}, ${p.longitude.toFixed(2)}`);

    const reps = persistent > 0
      ? pick(rows.filter(r => r.persistent), 3)
      : pick(rows, 3);

    const lokasi = reps.length ? reps.join('; ') : '-';

    return `Dalam ${days} hari terakhir di Kalimantan Barat, terdeteksi ${total} hotspot, dengan ${persistent} di antaranya bersifat persistent (muncul ≥3 hari pada grid yang sama). ` +
           `Contoh lokasi yang menonjol: ${lokasi}.`;
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hotspot Monitoring System</h1>
        <p className="text-sm text-muted-foreground">Data FIRMS 3 hari terakhir dengan penanda persistensi ({'>='}3 hari pada grid yang sama).</p>
      </div>
      {error && <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm">Gagal mengambil data: {error}</div>}
      {!rows ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium animate-pulse">Menghubungkan ke FIRMS NASA...</p>
        </div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <Flame className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Hotspot</div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Zap className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Persistent</div>
                  <div className="text-2xl font-bold">{stats.persistent}</div>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rentang Hari</div>
                  <div className="text-2xl font-bold">{stats.days} hari</div>
                </div>
              </div>
            </div>
          )}
          {aiSummary && (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              <div className="font-medium text-foreground mb-1">Ringkasan AI</div>
              <p>{aiSummary}</p>
            </div>
          )}
          <div className="h-[520px] overflow-hidden rounded-lg border bg-card">
            <Map center={center} rows={rows} />
          </div>
          <div className="flex justify-end">
            <a
              href="/api/hotspot/download/viirs-idn"
              className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors shadow-sm"
              download
            >
              <Download className="w-4 h-4" />
              Download VIIRS CSV (SEA latest)
            </a>
          </div>
        </>
      )}
    </div>
  );
}
