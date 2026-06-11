"use client";
import { useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function utcAlignedStart() {
  const now = new Date();
  const utc = new Date(now.toISOString());
  // IFS products typically available with latency; align to previous 3-hour slot minus 3h to avoid 404
  const h = utc.getUTCHours();
  const rem = h % 3;
  // Base slot at previous multiple of 3
  utc.setUTCHours(h - rem, 0, 0, 0);
  // Shift back one slot to ensure file exists (e.g., if it's exactly on edge or not yet published)
  utc.setUTCHours(utc.getUTCHours() - 3);
  return utc;
}

function fmt(dt: Date) {
  const y = String(dt.getUTCFullYear());
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  const H = String(dt.getUTCHours()).padStart(2, "0");
  return { y, m, d, H };
}

function addHours(dt: Date, h: number) {
  const c = new Date(dt.getTime());
  c.setUTCHours(c.getUTCHours() + h);
  return c;
}

function localHourLabel(dt: Date, offsetHours = 7) {
  const c = new Date(dt.getTime());
  c.setUTCHours(c.getUTCHours() + offsetHours);
  return String(c.getHours()).padStart(2, "0");
}

function extractUtcHourFromUrl(url: string): string | null {
  // Expect suffix _YYYYMMDDHH0000.png
  const m = url.match(/_(\d{10})0000\.png$/);
  if (!m) return null;
  return m[1].slice(-2);
}

type TimeFmt = ReturnType<typeof fmt>;
const MODEL_BUILDERS: Record<"IFS" | "WRF", (t: TimeFmt) => string> = {
  IFS: (t) => `https://web-meteo.bmkg.go.id//media/data/bmkg/mfy/ecmwf/prakiraan/Backup/RAIN/rainrate_ifs0p125_sfc_${t.y}${t.m}${t.d}${t.H}0000.png`,
  WRF: (t) => `https://web-meteo.bmkg.go.id//media/data/bmkg/mfy/wrf/prakiraan/RAIN/rainrate_wrf10km_sfc_${t.y}${t.m}${t.d}${t.H}0000.png`,
};

type ModelKey = keyof typeof MODEL_BUILDERS;

export default function RainratePage() {
  const base = useMemo(() => utcAlignedStart(), []);
  const slots = useMemo(() => Array.from({ length: 8 }, (_, i) => addHours(base, i * 3)), [base]);
  const timesFmt = useMemo(() => slots.map((s) => fmt(s)), [slots]);
  const labelsLocal = useMemo(() => slots.map((s) => localHourLabel(s)), [slots]);
  const [model, setModel] = useState<ModelKey>("IFS");
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  function scrollTo(idx: number) {
    const total = timesFmt.length;
    const wrapped = (idx + total) % total; // loop
    setIndex(wrapped);
    const track = trackRef.current;
    if (track) {
      const slide = track.children.item(wrapped) as HTMLElement | null;
      if (slide) slide.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rainrate Forecast</h1>
        <p className="text-sm text-muted-foreground">Estimasi intensitas hujan 3-jam sekali dari model IFS dan WRF.</p>
      </div>
      <Tabs value={model} onValueChange={(value) => setModel(value as ModelKey)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="IFS">IFS</TabsTrigger>
          <TabsTrigger value="WRF">WRF</TabsTrigger>
        </TabsList>
        {(Object.entries(MODEL_BUILDERS) as [ModelKey, (t: TimeFmt) => string][])?.map(([key, builder]) => (
          <TabsContent key={key} value={key} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <button
                className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                onClick={() => scrollTo(index - 1)}
              >
                Prev
              </button>
              <div className="text-sm text-muted-foreground">
                {(() => {
                  const url = builder(timesFmt[index]);
                  const hh = extractUtcHourFromUrl(url) ?? labelsLocal[index];
                  return `${key} • Jam ${hh} UTC`;
                })()}
              </div>
              <button
                className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                onClick={() => scrollTo(index + 1)}
              >
                Next
              </button>
            </div>
            <div className="max-w-screen-xl mx-auto w-full">
              <div
                ref={trackRef}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-pl-4 pr-4 max-w-full swipe-hint"
                onScroll={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  const children = Array.from(el.children) as HTMLElement[];
                  let bestIdx = 0;
                  let bestDist = Infinity;
                  const viewportCenter = el.getBoundingClientRect().left + el.clientWidth / 2;
                  children.forEach((child, i) => {
                    const rect = child.getBoundingClientRect();
                    const center = rect.left + rect.width / 2;
                    const dist = Math.abs(center - viewportCenter);
                    if (dist < bestDist) {
                      bestDist = dist;
                      bestIdx = i;
                    }
                  });
                  setIndex(bestIdx);
                }}
              >
              {timesFmt.map((time, idx) => (
                <div key={`${key}-${idx}`} className="shrink-0 w-full sm:w-[520px] md:w-[640px] lg:w-[900px] xl:w-[960px] snap-center">
                  <img
                    src={builder(time)}
                    alt={`Rainrate ${key} Jam ${extractUtcHourFromUrl(builder(time)) ?? labelsLocal[idx]} UTC`}
                    width={1024}
                    height={768}
                    className="w-full h-auto rounded-xl border object-contain"
                  />
                </div>
              ))}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              {timesFmt.map((_, i) => (
                <button
                  key={`dot-${i}`}
                  aria-label={`Ke slide ${i + 1}`}
                  onClick={() => scrollTo(i)}
                  className={`size-2 rounded-full ${i === index ? "bg-foreground" : "bg-muted"}`}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
