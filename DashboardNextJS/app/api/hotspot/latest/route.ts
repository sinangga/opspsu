import { NextResponse } from 'next/server';

const BASE = 'https://nrt3.modaps.eosdis.nasa.gov/archive/FIRMS/noaa-21-viirs-c2/SouthEast_Asia/';
// Borneo-wide bounding box (all Kalimantan)
const BBOX = { lonMin: 108.0, latMin: -4.5, lonMax: 118.0, latMax: 7.5 };

async function fetchText(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0,200)}`);
  }
  return res.text();
}

function yyyydoy(date: Date): { year: number; doy: string } {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 0);
  const diff = Math.floor((+date - start) / 86400000);
  const doy = String(diff).padStart(3, '0');
  return { year, doy };
}

type FirmRow = { acq_date: string; latitude: number; longitude: number; brightness?: number };

function parseCsv(csv: string): FirmRow[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  const idx = (k: string) => header.findIndex(h => h.trim() === k);
  const iLat = idx('latitude');
  const iLon = idx('longitude');
  const iDate = idx('acq_date') !== -1 ? idx('acq_date') : idx('acq_datetime');
  const iBright = idx('brightness') !== -1 ? idx('brightness') : (idx('brightness_ti4') !== -1 ? idx('brightness_ti4') : idx('bright_ti4'));
  const rows: FirmRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i].split(',');
    const lat = parseFloat(a[iLat]);
    const lon = parseFloat(a[iLon]);
    const date = a[iDate];
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !date) continue;
    const brightness = iBright !== -1 ? parseFloat(a[iBright]) : undefined;
    rows.push({ acq_date: date, latitude: lat, longitude: lon, brightness });
  }
  return rows;
}

function inBbox(lat: number, lon: number) {
  return lon >= BBOX.lonMin && lon <= BBOX.lonMax && lat >= BBOX.latMin && lat <= BBOX.latMax;
}

export async function GET() {
  try {
    const token = process.env.FIRMS_EARTHDATA_TOKEN;
    if (!token) return NextResponse.json({ error: 'Missing FIRMS_EARTHDATA_TOKEN' }, { status: 500 });

    // Aggregate last 3 days from both NOAA-21 (J2) and SNPP (S) when available
    const tried: string[] = [];
    const collected: FirmRow[] = [];
    for (let back = 0; back < 3; back++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - back);
      const { year, doy } = yyyydoy(d);
      const candidates = [
        `J2_VIIRS_C2_SouthEast_Asia_VJ214IMGTDL_NRT_${year}${doy}.txt`, // NOAA-21 (JPSS-2)
        `S_VIIRS_C2_SouthEast_Asia_VJ114IMGTDL_NRT_${year}${doy}.txt`,   // SNPP
      ];
      for (const name of candidates) {
        const url = `${BASE}${name}`;
        tried.push(url);
        try {
          const csv = await fetchText(url, token);
          const all = parseCsv(csv);
          const filtered = all.filter(r => inBbox(r.latitude, r.longitude));
          collected.push(...filtered);
        } catch {
          // continue to next candidate
        }
      }
    }
    if (collected.length > 0) {
      return NextResponse.json(collected);
    }
    return NextResponse.json({ error: `No CSV found for last 3 days. Tried: ${tried.join(', ')}` }, { status: 500 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
