import path from "path";
import { promises as fs } from "fs";
import { fetchPrakiraanBatch } from "@/lib/bmkg";

export type CacheRecord = {
  dateKey: string;
  data: unknown;
  snapshotAt: "02:00Z" | "10:00Z";
  createdAt: number;
  expireAt: number;
  analysisDate?: string;
};

const CACHE_DIR = path.join(process.cwd(), "data", "prakiraan-cache");
const CACHE_FILE = path.join(CACHE_DIR, "latest.json");
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let inflight: Promise<CacheRecord> | null = null;
let memoryCache: CacheRecord | null = null;

function nowUtc(): Date {
  return new Date();
}

function formatYMDUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type SnapshotPoint = { dateKey: string; label: "02:00Z" | "10:00Z" };

function resolveSnapshotPoint(now: Date): SnapshotPoint {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const t2 = new Date(Date.UTC(y, m, d, 2, 0, 0, 0));
  const t10 = new Date(Date.UTC(y, m, d, 10, 0, 0, 0));

  if (now < t2) {
    const yest = new Date(Date.UTC(y, m, d));
    yest.setUTCDate(yest.getUTCDate() - 1);
    return { dateKey: formatYMDUTC(yest) + "@10", label: "10:00Z" };
  }
  if (now < t10) {
    return { dateKey: formatYMDUTC(new Date(Date.UTC(y, m, d))) + "@02", label: "02:00Z" };
  }
  return { dateKey: formatYMDUTC(new Date(Date.UTC(y, m, d))) + "@10", label: "10:00Z" };
}

function nextExpiry(now: Date): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const t2 = new Date(Date.UTC(y, m, d, 2, 0, 0, 0));
  const t10 = new Date(Date.UTC(y, m, d, 10, 0, 0, 0));
  if (now < t2) return t2;
  if (now < t10) return t10;
  const tomorrow2 = new Date(Date.UTC(y, m, d + 1, 2, 0, 0, 0));
  return tomorrow2;
}

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function readCacheFromDisk(): Promise<CacheRecord | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as CacheRecord;
    if (!parsed?.createdAt) {
      return null;
    }
    return parsed;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

async function writeCacheToDisk(record: CacheRecord): Promise<void> {
  await ensureCacheDir();
  await fs.writeFile(CACHE_FILE, JSON.stringify(record, null, 2), "utf-8");
}

async function captureSnapshot(): Promise<CacheRecord> {
  const now = nowUtc();
  const point = resolveSnapshotPoint(now);
  const data = await fetchPrakiraanBatch();

  let analysisDate: string | undefined;
  try {
    type Item = {
      data?: Array<{ cuaca?: Array<Array<{ analysis_date?: string }>> }>;
    };
    const arr: Item[] = Array.isArray(data) ? (data as unknown as Item[]) : [];
    const first = arr.find((v) => v?.data?.[0]?.cuaca?.[0]?.[0]?.analysis_date) ?? arr[0];
    analysisDate = first?.data?.[0]?.cuaca?.[0]?.[0]?.analysis_date;
  } catch {
    analysisDate = undefined;
  }

  const next = nextExpiry(now);
  const record: CacheRecord = {
    dateKey: point.dateKey,
    data,
    snapshotAt: point.label,
    createdAt: now.getTime(),
    expireAt: next.getTime() + 60_000,
    analysisDate,
  };

  await writeCacheToDisk(record);
  memoryCache = record;
  return record;
}

function isFresh(record: CacheRecord | null): record is CacheRecord {
  if (!record) return false;
  return Date.now() - record.createdAt < REFRESH_INTERVAL_MS;
}

export async function getCachedPrakiraanSnapshot(): Promise<CacheRecord> {
  // 1. Check Memory Cache
  if (isFresh(memoryCache)) {
    return memoryCache;
  }

  // 2. Check Disk Cache (and populate memory if found)
  const cached = await readCacheFromDisk();
  if (isFresh(cached)) {
    memoryCache = cached;
    return cached;
  }

  if (!inflight) {
    inflight = (async () => {
      try {
        return await captureSnapshot();
      } finally {
        inflight = null;
      }
    })();
  }

  try {
    return await inflight;
  } catch (err) {
    if (cached) {
      // Return stale cache if fetch fails
      return cached;
    }
    throw err;
  }
}
