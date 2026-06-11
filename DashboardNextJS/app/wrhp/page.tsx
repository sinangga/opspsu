"use client";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NextImage from "next/image";
import { buildStreamlinePairs, formatDatePart, type StreamlineImage } from "@/lib/wrhp/utils";

type SegmentKey = "west" | "central" | "east";

const SEGMENT_KEYS: SegmentKey[] = ["west", "central", "east"];

const SEGMENT_META: Record<
  SegmentKey,
  {
    label: string;
    summary: string;
    impact: string;
  }
> = {
  west: {
    label: "Barat (Sumatra – Laut Cina Selatan)",
    summary: "Menggambarkan intrusi monsun Asia atau seruak barat-laut yang membawa kelembapan ke Kalimantan Barat.",
    impact: "intrusi monsun Asia dari Laut Cina Selatan menuju Kalimantan Barat",
  },
  central: {
    label: "Tengah (Kalimantan – Sulawesi)",
    summary: "Menunjukkan belokan garis aliran di atas khatulistiwa yang sering berasosiasi dengan zona konvergensi lokal Kalimantan–Sulawesi.",
    impact: "konvergensi khatulistiwa di atas Kalimantan dan Sulawesi",
  },
  east: {
    label: "Timur (Papua – Pasifik Barat)",
    summary: "Menandakan dominasi aliran timuran dari Pasifik Barat yang bisa mengalir balik ke wilayah Indonesia bagian tengah.",
    impact: "pengaruh aliran timuran dari Pasifik Barat",
  },
};

type StreamlinePatternId =
  | "shearline"
  | "itcz"
  | "trough"
  | "low"
  | "high"
  | "ridge"
  | "wave"
  | "monsoon"
  | "jet";

type StreamlineFeatureSet = {
  rawText: string;
  keywords: string[];
  patterns: StreamlinePatternId[];
};

const STREAMLINE_OCR_LANG = "eng";
const STREAMLINE_OCR_KEYWORD_LIMIT = 6;

type TesseractWorkerSource = {
  label: string;
  workerPath: string;
  corePath: string;
  langPath: string;
};

const STREAMLINE_TESSERACT_SOURCES: TesseractWorkerSource[] = [
  {
    label: "local",
    workerPath: "/vendor/tesseract/worker.min.js",
    corePath: "/vendor/tesseract",
    langPath: "/vendor/tesseract/lang",
  },
  {
    label: "cdn",
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@6/dist",
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
  },
];
const STREAMLINE_PATTERN_RULES: Array<{
  id: StreamlinePatternId;
  label: string;
  keywords: string[];
  description: string;
}> = [
  {
    id: "shearline",
    label: "Shearline",
    keywords: ["SHEAR", "SHEARLINE"],
    description: "belokan angin tajam yang memicu konvergensi lokal dan potensi cuaca aktif.",
  },
  {
    id: "itcz",
    label: "ITCZ / Konvergensi",
    keywords: ["ITCZ", "KONVERGEN", "CONVERGENCE", "CONFLUENCE"],
    description: "zona konvergensi ekuatorial yang meningkatkan curah hujan dan tutupan awan.",
  },
  {
    id: "trough",
    label: "Trog / Trough",
    keywords: ["TROUGH", "TROG", "TROUG"],
    description: "perpanjangan tekanan rendah yang sering membawa shearline dan belokan angin tajam.",
  },
  {
    id: "low",
    label: "Pusat Tekanan Rendah",
    keywords: ["LOW", "LPA", "LLCC", "CYCLONE"],
    description: "sirkulasi siklonik yang dapat memperkuat konvergensi permukaan.",
  },
  {
    id: "high",
    label: "Pusat Tekanan Tinggi",
    keywords: ["HIGH", "HPA", "ANTICYCLONE"],
    description: "sirkulasi anticiklonik yang biasanya membawa kondisi lebih stabil.",
  },
  {
    id: "ridge",
    label: "Ridge",
    keywords: ["RIDGE"],
    description: "pemanjangan tekanan tinggi yang dapat menekan pertumbuhan awan.",
  },
  {
    id: "wave",
    label: "Easterly Wave",
    keywords: ["WAVE", "EASTERLY WAVE"],
    description: "gangguan gelombang timuran yang memicu awan konvektif bergerak ke barat.",
  },
  {
    id: "monsoon",
    label: "Monsoon Surge",
    keywords: ["MONSOON", "SURGE"],
    description: "hembusan monsun kuat yang membawa kelembapan signifikan.",
  },
  {
    id: "jet",
    label: "Jet / Speed Line",
    keywords: ["JET", "SPEED LINE", "ACCEL"],
    description: "koridor angin kencang yang dapat mengindikasikan shear vertikal kuat.",
  },
];

const STREAMLINE_PATTERN_LOOKUP = STREAMLINE_PATTERN_RULES.reduce<Record<StreamlinePatternId, (typeof STREAMLINE_PATTERN_RULES)[number]>>((acc, rule) => {
  acc[rule.id] = rule;
  return acc;
}, {} as Record<StreamlinePatternId, (typeof STREAMLINE_PATTERN_RULES)[number]>);

type StreamAnalysis = {
  slot: StreamlineImage["slot"];
  label: string;
  densities: Record<SegmentKey, number>;
  darkness: number;
  features: StreamlineFeatureSet | null;
};

type AnalysisStatus = "pending" | "ready" | "error";

async function analyzeStreamlineImage(image: StreamlineImage, signal: AbortSignal): Promise<StreamAnalysis> {
  const response = await fetch(image.remoteUrl, { cache: "no-store", mode: "cors", signal });
  if (!response.ok) {
    throw new Error(`Gagal mengambil citra ${image.remoteUrl}: ${response.status}`);
  }
  const blob = await response.blob();
  const imgElement = await blobToImage(blob);
  const canvas = document.createElement("canvas");
  const width = imgElement.naturalWidth || imgElement.width;
  const height = imgElement.naturalHeight || imgElement.height;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Tidak bisa membuat context canvas 2D");
  }
  ctx.drawImage(imgElement, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);

  const totals: Record<SegmentKey, number> = { west: 0, central: 0, east: 0 };
  const darkCounts: Record<SegmentKey, number> = { west: 0, central: 0, east: 0 };
  let totalSamples = 0;
  let darkSamples = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 400)); // subsample untuk efisiensi

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha < 32) continue;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = (r + g + b) / 3;
      const segIndex = Math.min(2, Math.floor((x / width) * 3));
      const key: SegmentKey = SEGMENT_KEYS[segIndex];
      totals[key] += 1;
      totalSamples += 1;
      if (brightness < 200) {
        darkCounts[key] += 1;
        darkSamples += 1;
      }
    }
  }

  const densities: Record<SegmentKey, number> = {
    west: darkCounts.west / Math.max(1, totals.west),
    central: darkCounts.central / Math.max(1, totals.central),
    east: darkCounts.east / Math.max(1, totals.east),
  };

  const darkness = darkSamples / Math.max(1, totalSamples);
  const ocrText = await recognizeStreamlineText(canvas);
  const features = buildStreamlineFeatures(ocrText);

  return {
    slot: image.slot,
    label: image.label,
    densities,
    darkness,
    features,
  };
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const element = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gagal memuat citra streamline"));
      img.src = objectUrl;
    });
    return element;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type TesseractWorker = Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>;
let tesseractWorkerPromise: Promise<TesseractWorker | null> | null = null;
let tesseractOcrMutex: Promise<void> = Promise.resolve();

function enqueueTesseractJob<T>(task: () => Promise<T>): Promise<T> {
  const runner = () => task();
  const nextJob = tesseractOcrMutex.then(runner, runner);
  tesseractOcrMutex = nextJob.then(
    () => undefined,
    () => undefined,
  );
  return nextJob;
}

async function getTesseractWorker(): Promise<TesseractWorker | null> {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = createStreamlineWorker();
  }
  return tesseractWorkerPromise;
}

async function createStreamlineWorker(): Promise<TesseractWorker | null> {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const { createWorker } = await import("tesseract.js");
    for (const source of STREAMLINE_TESSERACT_SOURCES) {
      try {
        const worker = await createWorker(STREAMLINE_OCR_LANG, 1, {
          workerPath: source.workerPath,
          corePath: source.corePath,
          langPath: source.langPath,
          workerBlobURL: false,
        });
        return worker;
      } catch (err) {
        console.warn(`Gagal membuat worker Tesseract (${source.label})`, err);
      }
    }
  } catch (err) {
    console.warn("Gagal mengimpor Tesseract.js", err);
  }
  return null;
}

async function recognizeStreamlineText(canvas: HTMLCanvasElement): Promise<string> {
  try {
    const worker = await getTesseractWorker();
    if (!worker) {
      return "";
    }
    return await enqueueTesseractJob(async () => {
      const dataUrl = canvas.toDataURL("image/png");
      await worker.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/() ",
        user_defined_dpi: "150",
      });
      const result = await worker.recognize(dataUrl);
      return result?.data?.text ?? "";
    });
  } catch (err) {
    console.warn("Gagal menjalankan OCR streamline", err);
    return "";
  }
}

function buildStreamlineFeatures(text: string): StreamlineFeatureSet | null {
  const cleaned = text?.trim();
  if (!cleaned) {
    return null;
  }
  const normalized = cleaned.toUpperCase();
  const keywords = extractOcrKeywords(normalized);
  const patterns = detectStreamlinePatterns(normalized);
  return {
    rawText: cleaned,
    keywords,
    patterns,
  };
}

function extractOcrKeywords(normalized: string): string[] {
  const counts = new Map<string, number>();
  const tokens = normalized
    .replace(/[^A-Z0-9\s/()-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !/^\d+$/.test(word));

  tokens.forEach((token) => {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, STREAMLINE_OCR_KEYWORD_LIMIT)
    .map(([word]) => word);
}

function detectStreamlinePatterns(normalized: string): StreamlinePatternId[] {
  if (!normalized) return [];
  const hits: StreamlinePatternId[] = [];
  for (const rule of STREAMLINE_PATTERN_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      hits.push(rule.id);
    }
  }
  return hits;
}

function sigwxUrl(date: Date, hourBlock: string) {
  const { y, m, d } = formatDatePart(date);
  return `https://aviation.bmkg.go.id/shared/sigwx/${y}/${m}/sigwx_${y}${m}${d}${hourBlock}.jpeg`;
}

export default function WRHPPage() {
  const [streamAnalyses, setStreamAnalyses] = useState<StreamAnalysis[] | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("pending");
  const [imageErrors, setImageErrors] = useState<Record<StreamlineImage["slot"], boolean>>({ A: false, B: false });
  const streamImages = useMemo(() => buildStreamlinePairs(new Date()), []);

  useEffect(() => {
    setImageErrors({ A: false, B: false });
  }, [streamImages]);

  const markImageError = (slot: StreamlineImage["slot"]) => {
    setImageErrors((prev) => ({ ...prev, [slot]: true }));
  };

  const clearImageError = (slot: StreamlineImage["slot"]) => {
    setImageErrors((prev) => ({ ...prev, [slot]: false }));
  };

  useEffect(() => {
    let cancelled = false;
    const controllers: AbortController[] = [];
    setAnalysisStatus("pending");
    setStreamAnalyses(null);

    const analyzeBatch = async (images: StreamlineImage[]): Promise<StreamAnalysis[]> => {
      if (!images.length) return [];
      const localControllers = images.map(() => {
        const controller = new AbortController();
        controllers.push(controller);
        return controller;
      });
      const results = await Promise.allSettled(
        images.map((image, index) => analyzeStreamlineImage(image, localControllers[index].signal)),
      );
      const successes: StreamAnalysis[] = [];
      results.forEach((result, index) => {
        const image = images[index];
        if (result.status === "fulfilled") {
          successes.push(result.value);
        } else {
          console.warn(`Gagal menganalisis streamline slot ${image.slot}`, result.reason);
        }
      });
      return successes;
    };

    async function run() {
      let successes = await analyzeBatch(streamImages);

      if (cancelled) {
        return;
      }

      if (successes.length === 0 && streamImages.length > 1) {
        console.warn("Slot utama gagal, mencoba fallback ke slot sekunder");
        const fallbackResults = await analyzeBatch(streamImages.slice(1));
        if (cancelled) {
          return;
        }
        if (fallbackResults.length > 0) {
          successes = fallbackResults;
        }
      }

      if (cancelled) {
        return;
      }

      if (successes.length === 0) {
        console.warn("Semua analisis streamline gagal setelah fallback");
        setStreamAnalyses(null);
        setAnalysisStatus("error");
      } else {
        setStreamAnalyses(successes);
        setAnalysisStatus("ready");
      }
    }

    run();

    return () => {
      cancelled = true;
      controllers.forEach((controller) => controller.abort());
    };
  }, [streamImages]);

  const now = new Date();
  const sigwxImages = [
    { label: "A", url: sigwxUrl(now, "0000") },
    { label: "B", url: sigwxUrl(now, "0600") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Angin dan RASON</h1>
        <p className="text-sm text-muted-foreground">Produk streamline, SIGWX medium, dan monitoring radiosonde untuk navigasi penerbangan dan analisis angin.</p>
      </div>
      <Tabs defaultValue="streamline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="streamline">Analisis Streamline</TabsTrigger>
          <TabsTrigger value="sigwx">SIGWX MED</TabsTrigger>
          <TabsTrigger value="rason">RASON</TabsTrigger>
        </TabsList>
        <TabsContent value="streamline" className="space-y-4">
          <AiStreamlineSummary analyses={streamAnalyses} status={analysisStatus} />
          {streamImages.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {streamImages.map((item) => (
                <div key={item.slot} className="rounded-lg border bg-card p-3">
                  <div className="text-sm text-muted-foreground mb-2">Gambar {item.slot} · {item.label}</div>
                  {imageErrors[item.slot] ? (
                    <div className="flex h-[200px] items-center justify-center rounded bg-muted text-sm text-muted-foreground text-center px-4">
                      Analisis belum tersedia, coba kembali nanti.
                    </div>
                  ) : (
                    <NextImage
                      src={item.remoteUrl}
                      alt={`Streamline ${item.label}`}
                      width={1024}
                      height={768}
                      className="w-full h-auto rounded"
                      onError={() => markImageError(item.slot)}
                      onLoadingComplete={() => clearImageError(item.slot)}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Menunggu citra streamline terbaru…</div>
          )}
        </TabsContent>
        <TabsContent value="sigwx" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {sigwxImages.map((item) => (
              <div key={item.label} className="rounded-lg border bg-card p-3">
                <div className="text-sm text-muted-foreground mb-2">Zona {item.label}</div>
                <NextImage src={item.url} alt={`SIGWX ${item.label}`} width={1024} height={768} className="w-full h-auto rounded" />
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="rason" className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground mb-2">
              Embed RASON diblokir oleh kebijakan keamanan situs sumber.
            </div>
            <a
              href="https://aviation.bmkg.go.id/monitoring_rason/index"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
            >
              Buka Monitoring RASON
            </a>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AiStreamlineSummary({
  analyses,
  status,
}: {
  analyses: StreamAnalysis[] | null;
  status: AnalysisStatus;
}) {
  if (status === "pending") {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        Memproses citra streamline untuk ringkasan otomatis…
      </div>
    );
  }

  if (status !== "ready" || !analyses || analyses.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="text-sm font-semibold">Ringkasan AI Streamline 3000 ft</div>
        <p className="text-sm text-muted-foreground">
          Analisis otomatis tidak tersedia. Coba muat ulang atau interpretasikan langsung peta 00 dan 12 UTC.
        </p>
        <p className="text-xs text-muted-foreground">
          Fokuskan penelaahan pada tiga sektor utama: {SEGMENT_META.west.label}, {SEGMENT_META.central.label}, dan {SEGMENT_META.east.label}.
        </p>
      </div>
    );
  }

  const insightItems = analyses.map((analysis) => describeStreamAnalysis(analysis));
  const chronological = [...analyses].reverse();
  const trend = describeTrend(chronological);
  const trendRangeLabel =
    chronological.length >= 2
      ? `${chronological[0].label} → ${chronological[chronological.length - 1].label}`
      : `${chronological[0]?.label ?? "00 UTC"}`;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="text-sm font-semibold">Ringkasan AI Streamline 3000 ft</div>
      <p className="text-xs text-muted-foreground">
        Disusun dengan heuristik densitas garis pada citra ECMWF 3000 ft; gunakan tetap bersama diagnosis sinoptik manual.
      </p>
      <ul className="space-y-2 text-sm text-foreground">
        {insightItems.map((item) => (
          <li key={item.label}>
            <span className="font-medium">{item.label}</span> {item.text}
          </li>
        ))}
        {trend ? (
          <li>
            <span className="font-medium">Perubahan {trendRangeLabel}</span> {trend}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function describeStreamAnalysis(analysis: StreamAnalysis) {
  const sorted = (Object.entries(analysis.densities) as [SegmentKey, number][]).sort((a, b) => b[1] - a[1]);
  const [primaryKey, primaryValue] = sorted[0];
  const secondary = sorted[1];
  const primaryMeta = SEGMENT_META[primaryKey];
  const secondaryMeta = secondary ? SEGMENT_META[secondary[0]] : null;
  const primaryDescriptor = capitalize(densityDescriptor(primaryValue));
  const localTime = labelToLocalTime(analysis.label);

  let sentence = `(${localTime}) ${primaryDescriptor} di sektor ${primaryMeta.label} (${formatDensity(primaryValue)}). ${primaryMeta.summary}`;
  if (secondary && secondary[0] !== primaryKey && secondary[1] > 0) {
    sentence += ` Dukungan sekunder ${densityDescriptor(secondary[1])} di ${secondaryMeta?.label} (${formatDensity(secondary[1])}).`;
  }
  sentence += ` Kepadatan garis total berkategori ${densityDescriptor(analysis.darkness)} (${formatDensity(analysis.darkness)}).`;

  const patternSentence = describePatternSignals(analysis);
  if (patternSentence) {
    sentence += ` ${patternSentence}`;
  }

  if (analysis.features?.keywords?.length) {
    sentence += ` Kata kunci OCR: ${analysis.features.keywords.join(", ")}.`;
  }

  return { label: `Slot ${analysis.slot} (${analysis.label})`, text: sentence };
}

function describeTrend(analyses: StreamAnalysis[]): string | null {
  if (analyses.length < 2) return null;
  const [first, second] = analyses;
  const deltas = SEGMENT_KEYS.map((key) => ({
    key,
    delta: second.densities[key] - first.densities[key],
  })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const main = deltas[0];
  if (!main || Math.abs(main.delta) < 0.005) {
    const overallDelta = second.darkness - first.darkness;
    if (Math.abs(overallDelta) < 0.005) {
      return "pola garis relatif stabil tanpa perubahan densitas besar.";
    }
    return `kepadatannya relatif stabil per sektor, namun total garis ${overallDelta > 0 ? "sedikit lebih rapat" : "sedikit lebih renggang"} (${formatDelta(overallDelta)}).`;
  }
  const meta = SEGMENT_META[main.key];
  const directionWord = main.delta > 0 ? "meningkat" : "menurun";
  const effectWord = main.delta > 0 ? "menguatkan" : "melemahkan";
  const darknessDelta = second.darkness - first.darkness;
  let sentence = `sektor ${meta.label} ${directionWord} ${formatDelta(main.delta)}, ${effectWord} ${meta.impact}.`;
  if (Math.abs(darknessDelta) >= 0.005) {
    sentence += ` Kepadatan garis total ${darknessDelta > 0 ? "bertambah" : "berkurang"} ${formatDelta(darknessDelta)}.`;
  }
  return sentence;
}

function describePatternSignals(analysis: StreamAnalysis): string | null {
  const features = analysis.features;
  if (!features || features.patterns.length === 0) {
    return null;
  }
  const labels = features.patterns.map((id) => STREAMLINE_PATTERN_LOOKUP[id].label);
  const primary = STREAMLINE_PATTERN_LOOKUP[features.patterns[0]];
  const labelText = formatList(labels);
  return `OCR menandai ${labelText} yang mengindikasikan ${primary.description}`;
}

function densityDescriptor(value: number): string {
  if (value >= 0.09) return "sangat padat";
  if (value >= 0.06) return "padat";
  if (value >= 0.035) return "moderat";
  if (value >= 0.02) return "ringan";
  return "sangat ringan";
}

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDensity(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function formatList(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} dan ${values[1]}`;
  const last = values[values.length - 1];
  return `${values.slice(0, -1).join(", ")}, dan ${last}`;
}

function labelToLocalTime(label: string): string {
  const match = label.match(/^(\d{2})/);
  if (!match) return label;
  const hour = Number.parseInt(match[1], 10);
  const localHour = (hour + 7) % 24;
  return `${String(localHour).padStart(2, "0")}:00 WIB`;
}
