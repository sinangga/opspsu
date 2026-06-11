import { NextRequest, NextResponse } from "next/server";

const BASE = 'https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=';

type ForecastLocation = {
  adm4?: string;
  desa?: string;
  kecamatan?: string;
  [key: string]: unknown;
};

type ForecastPayload = {
  lokasi?: ForecastLocation;
};

function buildAdm4Range(adm3: string) {
  // adm3 like 61.06.01
  const list: string[] = [];
  for (let n = 1001; n <= 1100; n++) {
    list.push(`${adm3}.${n}`);
  }
  return list;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adm3 = searchParams.get('adm3');
    if (!adm3 || !/^\d{2}\.\d{2}\.\d{2}$/.test(adm3)) {
      return NextResponse.json({ error: 'Invalid adm3. Expected format 61.06.XX' }, { status: 400 });
    }
    const adm4s = buildAdm4Range(adm3);
    const urls = adm4s.map((a) => `${BASE}${encodeURIComponent(a)}`);
    const results = await Promise.allSettled(
      urls.map((u) => fetch(u, { cache: 'no-store' }).then(async (r) => ({ ok: r.ok, status: r.status, json: r.ok ? await r.json() : null })))
    );
    const found: Array<{ adm4: string; url: string; desa?: string; kecamatan?: string; lokasi?: ForecastLocation }> = [];
    results.forEach((res, idx) => {
      if (res.status === 'fulfilled' && res.value?.ok && res.value.json) {
        const payload = res.value.json as ForecastPayload;
        const adm4 = payload?.lokasi?.adm4;
        if (adm4) {
          const lokasi = payload.lokasi;
          found.push({ adm4, url: urls[idx], desa: lokasi?.desa, kecamatan: lokasi?.kecamatan, lokasi });
        }
      }
    });
    return NextResponse.json({ adm3, count: found.length, found });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
