import path from "path";
import { promises as fs } from "fs";
import type { BMKGResponse } from "@/lib/bmkg";
import { fetchPrakiraanBatch } from "@/lib/bmkg";

type AggregateData = Record<string, Record<string, BMKGResponse>>;

const DEFAULT_FILES = ["agg.json", "kapuas_hulu.json"];
const CACHE_TTL_MS = 2 * 60 * 1000;

let cache: { data: AggregateData; ts: number } | null = null;

function resolveCandidatePaths(): string[] {
  const envPath = process.env.KAPUAS_HULU_AGGREGATE_PATH;
  const base = DEFAULT_FILES.map((file) => path.join(process.cwd(), file));
  if (!envPath) {
    return base;
  }
  const envAbs = path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath);
  return [envAbs, ...base.filter((p) => p !== envAbs)];
}

async function readAggregateFromDisk(): Promise<AggregateData> {
  const errors: { candidate: string; err: unknown }[] = [];
  for (const candidate of resolveCandidatePaths()) {
    try {
      const raw = await fs.readFile(candidate, "utf-8");
      console.info("[aggregate] loaded", candidate);
      return JSON.parse(raw) as AggregateData;
    } catch (err) {
      errors.push({ candidate, err });
    }
  }
  const details = errors
    .map(({ candidate, err }) => `${candidate}: ${(err as Error)?.message || err}`)
    .join("; ");
  throw new Error(`Aggregate JSON not found. Tried: ${details}`);
}

function toAggregateStructure(batch: BMKGResponse[]): AggregateData {
  const kabupaten = "Kapuas Hulu";
  const map: Record<string, BMKGResponse> = {};
  for (const item of batch) {
    const name = String(item?.lokasi?.kecamatan || "").trim() || "Unknown";
    map[name] = item;
  }
  return { [kabupaten]: map };
}

export async function loadAggregate(opts?: { forceReload?: boolean }): Promise<AggregateData> {
  const forceReload = opts?.forceReload === true;
  const now = Date.now();

  if (!forceReload && cache && now - cache.ts < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const data = await readAggregateFromDisk();
    cache = { data, ts: now };
    return data;
  } catch (err) {
    console.warn("[aggregate] failed to read local aggregate JSON:", err);
    try {
      const batch = await fetchPrakiraanBatch();
      const fallback = toAggregateStructure(batch);
      cache = { data: fallback, ts: now };
      return fallback;
    } catch (networkErr) {
      console.error("[aggregate] network fallback failed:", networkErr);
      if (cache) {
        return cache.data;
      }
      const empty: AggregateData = { "Kapuas Hulu": {} as Record<string, BMKGResponse> };
      cache = { data: empty, ts: now };
      return empty;
    }
  }
}

export async function loadForecastArray(opts?: { forceReload?: boolean }): Promise<BMKGResponse[]> {
  const aggregate = await loadAggregate(opts);
  const kapuasHulu = aggregate["Kapuas Hulu"] || {};
  return Object.values(kapuasHulu);
}
