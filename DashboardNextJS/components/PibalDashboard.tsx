"use client";

import { useState } from "react";
import { parsePibal, type PibalLevel } from "@/lib/parsePibal";
import { computeTrajectory, type TrajectoryPoint } from "@/lib/computeTrajectory";
import { STATION_INFO } from "@/lib/pibalDefaults";
import { PibalForm, type PibalFormValues } from "@/components/PibalForm";
import { PibalScene } from "@/components/PibalScene";

const buildInitialModel = (code: string, ascentRate: number) => {
  const initialLevels = parsePibal(code);
  return {
    levels: initialLevels,
    trajectory: computeTrajectory(initialLevels, { ascentRate }),
  };
};

const formatNumber = (value: number, fraction = 1) =>
  value.toLocaleString("id-ID", { maximumFractionDigits: fraction, minimumFractionDigits: fraction });

type PibalDashboardProps = {
  defaultCode: string;
  defaultAscentRate: number;
};

export function PibalDashboard({ defaultCode, defaultAscentRate }: PibalDashboardProps) {
  const [{ levels, trajectory }, setModel] = useState<{
    levels: PibalLevel[];
    trajectory: TrajectoryPoint[];
  }>(() => buildInitialModel(defaultCode, defaultAscentRate));
  const [ascentRate, setAscentRate] = useState(defaultAscentRate);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const handleGenerate = (values: PibalFormValues) => {
    const parsedLevels = parsePibal(values.code);
    if (!parsedLevels.length) {
      setFormError("Kode belum memuat pasangan arah/kecepatan yang valid.");
      return;
    }

    const sanitizedRate = values.ascentRate > 0 ? values.ascentRate : defaultAscentRate;
    setFormError(null);
    setAscentRate(sanitizedRate);
    setSelectedIdx(null);
    setModel({
      levels: parsedLevels,
      trajectory: computeTrajectory(parsedLevels, { ascentRate: sanitizedRate }),
    });
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-6 text-slate-100 shadow-2xl shadow-slate-900/50">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Pibal 3D-Plot</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">3D Trajectory Modeling untuk Balon Pilot</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300">
          Aplikasi ini memvisualisasikan kode PIBAL ala BMKG menjadi lintasan 3D interaktif menggunakan React Three Fiber. Model fisika menggunakan laju kenaikan konstan dan integrasi vektor angin tiap 60 detik agar konsisten dengan prosedur BMKG Pangsuma ({STATION_INFO.latitude.toFixed(4)}°, {STATION_INFO.longitude.toFixed(4)}°).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px,1fr] xl:grid-cols-[420px,1fr]">
        <PibalForm
          defaultCode={defaultCode}
          defaultAscentRate={defaultAscentRate}
          lastLevelCount={levels.length}
          error={formError}
          onGenerate={handleGenerate}
        />

        <div className="space-y-5">
          <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
              <div>
                <h3 className="text-lg font-semibold">Visualisasi Trajektori 3D</h3>
                <p className="text-sm text-muted-foreground">
                  Grid referensi + sumbu ketinggian &middot; Orbit controls penuh &middot; Garis lintasan tubular
                </p>
              </div>
              <div className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
                Ascent: {formatNumber(ascentRate, 1)} m/s
              </div>
            </div>
            <PibalScene points={trajectory} levels={levels} selectedIdx={selectedIdx} onSelect={setSelectedIdx} />
          </div>
        </div>
      </div>
    </div>
  );
}
