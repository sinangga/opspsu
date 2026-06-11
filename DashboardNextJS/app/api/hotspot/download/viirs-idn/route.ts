import { NextResponse } from 'next/server';

const BASE = 'https://nrt3.modaps.eosdis.nasa.gov/archive/FIRMS/noaa-21-viirs-c2/SouthEast_Asia/';

function yyyydoy(date: Date): { year: number; doy: string } {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 0);
  const diff = Math.floor((+date - start) / 86400000);
  const doy = String(diff).padStart(3, '0');
  return { year, doy };
}

async function fetchText(url: string, token?: string) {
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.text();
}

export async function GET() {
  try {
    const token = process.env.FIRMS_EARTHDATA_TOKEN;
    if (!token) return NextResponse.json({ error: 'Missing FIRMS_EARTHDATA_TOKEN' }, { status: 500 });

    const tried: string[] = [];
    let content: string | null = null;
    let filename = '';
    for (let back = 0; back < 3 && !content; back++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - back);
      const { year, doy } = yyyydoy(d);
      const candidates = [
        `J2_VIIRS_C2_SouthEast_Asia_VJ214IMGTDL_NRT_${year}${doy}.txt`,
        `S_VIIRS_C2_SouthEast_Asia_VJ114IMGTDL_NRT_${year}${doy}.txt`,
      ];
      for (const name of candidates) {
        const url = `${BASE}${name}`;
        tried.push(url);
        try {
          const txt = await fetchText(url, token);
          content = txt;
          filename = name.replace('.txt', '.csv');
          break;
        } catch {}
      }
    }

    if (!content) return NextResponse.json({ error: `No file found. Tried: ${tried.join(', ')}` }, { status: 404 });

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=${filename}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
