export type FirmRow = {
  acq_date: string;
  latitude: number;
  longitude: number;
  brightness: number;
  persistent?: boolean;
};

export async function fetchFirmsJSON(url: string): Promise<unknown[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);
  const data = await res.json();
  // Country/area JSON endpoints return an array of objects
  return Array.isArray(data) ? data : [];
}

export function gridAndPersist(rows: FirmRow[], latGrid = 0.09, lonGrid = 0.09) {
  const toBin = (v: number, g: number) => Math.floor(v / g) * g;
  const byBin = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = `${toBin(r.latitude, latGrid)},${toBin(r.longitude, lonGrid)}`;
    const set = byBin.get(key) || new Set<string>();
    set.add(r.acq_date.split('T')[0]);
    byBin.set(key, set);
  }
  const persistent = new Set(Array.from(byBin.entries()).filter(([, s]) => s.size >= 3).map(([k]) => k));
  return rows.map((r) => {
    const key = `${toBin(r.latitude, latGrid)},${toBin(r.longitude, lonGrid)}`;
    return { ...r, persistent: persistent.has(key) } as FirmRow & { persistent: boolean };
  });
}

// Convert FIRMS JSON rows to FirmRow and annotate persistence
export function gridAndPersistFromJSON(json: unknown[], latGrid = 0.09, lonGrid = 0.09): FirmRow[] {
  const getNum = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN);
  const getStr = (v: unknown): string => (v == null ? '' : String(v));
  const pick = (rec: Record<string, unknown>, keys: string[]): unknown => {
    for (const k of keys) if (k in rec) return rec[k];
    return undefined;
  };
  const rows: FirmRow[] = json
    .map((o) => {
      if (o === null || typeof o !== 'object') return null;
      const rec = o as Record<string, unknown>;
      // Try common fields for VIIRS/MODIS; fall back safely
      const acq_date = getStr(pick(rec, ['acq_date', 'acq_datetime', 'acq_time']));
      const latitude = getNum(pick(rec, ['latitude', 'lat', 'y']));
      const longitude = getNum(pick(rec, ['longitude', 'lon', 'x']));
      const brightness = getNum(pick(rec, ['brightness', 'brightness_ti4', 'brightness_ti5', 'bright_ti4', 'bright_ti5', 'frp']));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !acq_date) return null;
      return { acq_date, latitude, longitude, brightness } as FirmRow;
    })
    .filter(Boolean) as FirmRow[];

  return gridAndPersist(rows, latGrid, lonGrid);
}
