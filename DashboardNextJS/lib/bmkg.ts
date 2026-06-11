export type CuacaEntry = {

  local_datetime: string;

  t: number; // temperature

  hu: number; // humidity

  wd: string; // wind direction

  ws: number; // wind speed

  weather_desc: string;

  analysis_date?: string;

};



type BMKGLokasi = {

  kecamatan: string;

  lat?: number | string;

  lon?: number | string;

};



export type BMKGResponse = {

  lokasi: BMKGLokasi;

  data: { lokasi?: BMKGLokasi; cuaca: CuacaEntry[][] }[];

};



const BASE = 'https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=61.06.';



export async function fetchPrakiraanBatch(): Promise<BMKGResponse[]> {

  const suffixes2_16 = Array.from({ length: 15 }, (_, i) => `${(i + 2).toString().padStart(2, '0')}.2001`);

  const suffixes18_23 = Array.from({ length: 6 }, (_, i) => `${(i + 18).toString().padStart(2, '0')}.2001`);

  const urls = [

    `${BASE}01.1001`,

    ...suffixes2_16.map((s) => BASE + s),

    `${BASE}17.1001`,

    ...suffixes18_23.map((s) => BASE + s),

  ];

  const resps = await Promise.all(

    urls.map((u) => fetch(u, { cache: 'no-store' }).then((r) => r.json()))

  );

  return resps as BMKGResponse[];

}



export function flattenFirstThreeGroups(cuaca: CuacaEntry[][]): CuacaEntry[] {

  const firstThree = cuaca.slice(0, 3);

  const flat = firstThree.flat();

  return flat.sort((a, b) => a.local_datetime.localeCompare(b.local_datetime));

}



export function computeEightSlots(entries: CuacaEntry[]) {

  const slice = entries.slice(0, 8);

  const suhu = slice.map((d) => d.t);

  const rh = slice.map((d) => d.hu);

  const arah = slice.map((d) => d.wd);

  const angin = slice.map((d) => d.ws);

  const cuaca = slice.map((d) => d.weather_desc);

  const waktu = slice.map((d) => d.local_datetime);

  const hours = slice.map((d) => new Date(d.local_datetime.replace(' ', 'T')).getHours().toString().padStart(2, '0'));

  const minMax = (arr: number[]) => `${Math.min(...arr)}-${Math.max(...arr)}`;

  const mode = (arr: string[]) => arr.sort((a, b) => arr.filter(v => v===a).length - arr.filter(v => v===b).length).pop() || '';

    return {

    waktu,

    cuaca,

    suhuRange: minMax(suhu),

    rhRange: `${minMax(rh)}%`,

    arah: mode(arah),

    anginMax: `${Math.round(Math.max(...angin))} Knot`,

    hours,

  };

}



export function rowsForKecamatan(batch: BMKGResponse[]): { header: string[]; rows: string[][] } | null {
  const byKec = new Map<string, BMKGResponse>();

  for (const r of batch) {
    const name = r?.lokasi?.kecamatan;
    const hasCuaca = Array.isArray(r?.data) && Array.isArray(r.data[0]?.cuaca);
    if (!name || !hasCuaca) continue;
    byKec.set(name, r);
  }

  const reference = Array.from(byKec.values()).find((entry) => Array.isArray(entry?.data?.[0]?.cuaca));
  if (!reference) {
    return null;
  }

  const hours = computeEightSlots(flattenFirstThreeGroups(reference.data[0].cuaca)).hours;
  const header = ['KECAMATAN', ...hours, 'SUHU', 'KELEMBAPAN', 'ANGIN', 'KECEPATAN'];

  const rows: string[][] = [];
  for (const [name, entry] of byKec.entries()) {
    if (!Array.isArray(entry.data[0]?.cuaca)) continue;
    const entries = flattenFirstThreeGroups(entry.data[0].cuaca);
    if (entries.length === 0) continue;
    const s = computeEightSlots(entries);
    const arahId = toIndoWind(s.arah);
    const suhuLabel = `${s.suhuRange}°C`;
    rows.push([name, ...s.cuaca, suhuLabel, s.rhRange, arahId, s.anginMax]);
  }

  if (rows.length === 0) {
    return null;
  }

  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'id-ID'));
  return { header, rows };
}



export function toIndoWind(dir: string): string {

  const map: Record<string,string> = {

    N: 'Utara', NE: 'Timur Laut', E: 'Timur', SE: 'Tenggara',

    S: 'Selatan', SW: 'Barat Daya', W: 'Barat', NW: 'Barat Laut',

  };

  return map[dir] || dir;

}

