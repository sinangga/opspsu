"use client";



import { useEffect, useMemo, useState } from "react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import {

    type BMKGResponse,

    type CuacaEntry,

    computeEightSlots,

    flattenFirstThreeGroups,

    rowsForKecamatan,

    toIndoWind,

  } from "@/lib/bmkg";

import dynamic from "next/dynamic";

import Image from "next/image";

import Infografis from "@/components/infografis/Infografis";

import { toPng } from "html-to-image";



const Map = dynamic(() => import("./parts/Map"), { ssr: false });



const INFOGRAPHIC_WIDTH = 1200;

// Match Infografis.tsx canvas for 1:1 PNG sizing
const INFOGRAPHIC_HEIGHT = 1500;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes



const dateFormatter = new Intl.DateTimeFormat("id-ID", {

  day: "2-digit",

  month: "short",

  year: "numeric",

  timeZone: "Asia/Jakarta",

});

const timeFormatter = new Intl.DateTimeFormat("id-ID", {

  hour: "2-digit",

  minute: "2-digit",

  timeZone: "Asia/Jakarta",

});

const weekdayFormatter = new Intl.DateTimeFormat("id-ID", {

  weekday: "long",

  timeZone: "Asia/Jakarta",

});



const toWibDate = (value: string) => new Date(`${value.replace(" ", "T")}+07:00`);



function buildPeriodMeta(entries: CuacaEntry[]) {

  if (!entries.length) {

    return {

      tabLabel: "Periode",

      fullLabel: "Periode",

    };

  }

  const endIndex = Math.min(entries.length - 1, 7);

  const start = toWibDate(entries[0].local_datetime);

  const end = toWibDate(entries[endIndex].local_datetime);



  const startDate = dateFormatter.format(start);

  const endDate = dateFormatter.format(end);

  const startTime = timeFormatter.format(start);

  const endTime = timeFormatter.format(end);



  if (startDate === endDate) {

    return {

      tabLabel: `${startDate} ${startTime}-${endTime} WIB`,

      fullLabel: `${weekdayFormatter.format(start)}, ${startDate} ${startTime}-${endTime} WIB`,

    };

  }



  return {

    tabLabel: `${startDate} ${startTime} - ${endDate} ${endTime} WIB`,

    fullLabel: `${weekdayFormatter.format(start)}, ${startDate} ${startTime} - ${weekdayFormatter.format(end)}, ${endDate} ${endTime} WIB`,

  };

}



export default function PrakiraanPage() {



  const [data, setData] = useState<BMKGResponse[] | null>(null);



  const [error, setError] = useState<string | null>(null);







  useEffect(() => {



    let alive = true;



    // Allow both browser (number) and Node (Timeout) interval IDs



    let timer: number | ReturnType<typeof setInterval> | null = null;







    const load = () => {



      if (!alive) return;



      setError(null);



      fetch("/api/prakiraan-snapshot", { cache: "no-store" })



        .then((r) => r.json())



        .then((payload) => {



          if (!alive) return;



          if (payload?.data) {



            setData(payload.data as BMKGResponse[]);



          } else if (Array.isArray(payload)) {



            setData(payload as BMKGResponse[]);



          } else if (payload?.error) {



            setError(String(payload.error));



          }



        })



        .catch((e) => {



          if (!alive) return;



          setError(String(e));



        });



    };

    const handleFocus = () => load();

    load();

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
      timer = window.setInterval(load, REFRESH_INTERVAL_MS);
    } else {
      timer = setInterval(load, REFRESH_INTERVAL_MS);
    }

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, []);



  const table1 = useMemo(() => (data ? rowsForKecamatan(data) : null), [data]);



  const table2 = useMemo(() => {
    if (!data || data.length === 0) return null;

    const entries: Array<[string, BMKGResponse]> = [];
    data.forEach((r) => {
      const key = r?.lokasi?.kecamatan;
      const hasCuaca = Array.isArray(r?.data) && Array.isArray(r.data[0]?.cuaca);
      if (typeof key === "string" && key.length > 0 && hasCuaca) {
        entries.push([key, r]);
      }
    });

    if (entries.length === 0) return null;

    const reference = entries.map(([, entry]) => entry).find((entry) => Array.isArray(entry?.data?.[0]?.cuaca));
    if (!reference) return null;

    const header = [
      "KECAMATAN",
      ...computeEightSlots(flattenFirstThreeGroups(reference.data[0].cuaca).slice(8)).hours,
      "SUHU",
      "KELEMBAPAN",
      "ANGIN",
      "KECEPATAN",
    ];

    const rows: string[][] = [];
    for (const [k, entSrc] of entries) {
      if (!entSrc?.data?.[0]?.cuaca) continue;
      const entries = flattenFirstThreeGroups(entSrc.data[0].cuaca).slice(8);
      if (entries.length === 0) continue;
      const s = computeEightSlots(entries);
      rows.push([k, ...s.cuaca, `${s.suhuRange}°C`, s.rhRange, s.arah, s.anginMax]);
    }

    if (rows.length === 0) return null;
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0]), "id-ID"));
    return { header, rows };
  }, [data]);



  const periodEntries1 = useMemo(() => {

    if (!data?.[0]?.data?.[0]?.cuaca) return [] as CuacaEntry[];

    return flattenFirstThreeGroups(data[0].data[0].cuaca).slice(0, 8);

  }, [data]);



  const periodEntries2 = useMemo(() => {

    if (!data?.[0]?.data?.[0]?.cuaca) return [] as CuacaEntry[];

    return flattenFirstThreeGroups(data[0].data[0].cuaca).slice(8, 16);

  }, [data]);



  const period1Meta = useMemo(() => buildPeriodMeta(periodEntries1), [periodEntries1]);

  const period2Meta = useMemo(() => buildPeriodMeta(periodEntries2), [periodEntries2]);



  const infographicRows1 = useMemo(

    () =>

      table1?.rows.map((r) => ({

        kecamatan: String(r[0]),

        cuaca: r.slice(1, 9).map(String),

        icons: new Array(8).fill(null),

        suhu: String(r[9]),

        rh: String(r[10]),

        arah: toIndoWind(String(r[11])),

        angin: String(r[12]),

      })) ?? [],

    [table1]

  );



  const infographicRows2 = useMemo(

    () =>

      table2?.rows.map((r) => ({

        kecamatan: String(r[0]),

        cuaca: r.slice(1, 9).map(String),

        icons: new Array(8).fill(null),

        suhu: String(r[9]),

        rh: String(r[10]),

        arah: toIndoWind(String(r[11])),

        angin: String(r[12]),

      })) ?? [],

    [table2]

  );



  const captureKey1 = useMemo(() => {

    if (!table1) return "";

    return JSON.stringify({ header: table1.header, rows: table1.rows, label: period1Meta.fullLabel });

  }, [table1, period1Meta.fullLabel]);



  const captureKey2 = useMemo(() => {

    if (!table2) return "";

    return JSON.stringify({ header: table2.header, rows: table2.rows, label: period2Meta.fullLabel });

  }, [table2, period2Meta.fullLabel]);



  // Removed auto PNG generation; using on-demand download button



  if (error) return <div>Error: {error}</div>;

  if (!data || !table1 || !table2) return <div>Loading...</div>;



  return (

    <div className="space-y-6">

      <div className="flex items-center gap-4">

        <Image src="/bmkg.png" alt="BMKG" width={60} height={60} />

        <div>

          <div className="text-lg font-semibold leading-tight">BMKG - Stasiun Meteorologi Pangsuma Kapuas Hulu</div>

          <div className="text-sm text-muted-foreground">Prakiraan Cuaca Kabupaten Kapuas Hulu</div>

        </div>

      </div>

      <Tabs defaultValue="periode1">

        <TabsList>

          <TabsTrigger value="periode1">{period1Meta.tabLabel}</TabsTrigger>

          <TabsTrigger value="periode2">{period2Meta.tabLabel}</TabsTrigger>

          <TabsTrigger value="map">Peta Interaktif</TabsTrigger>

        </TabsList>

        <TabsContent value="periode1" className="space-y-4">

          <AiSummary header={table1.header} rows={table1.rows} title={`Ringkasan AI | ${period1Meta.fullLabel}`} />

          {/* Hidden HTML solely for PNG capture */}
          <div id="infografis-visible-periode1" style={{ position: 'absolute', left: -10000, top: 0, width: 0, height: 0, overflow: 'hidden' }} aria-hidden>
            <Infografis
              title="Prakiraan Cuaca Kabupaten Kapuas Hulu"
              dateLabel={period1Meta.fullLabel}
              hours={table1.header.slice(1, 9)}
              rows={infographicRows1}
            />
          </div>

          <AutoPngFromVisible targetVisibleId="infografis-visible-periode1" depsKey={captureKey1} />

        </TabsContent>

        <TabsContent value="periode2" className="space-y-4">

          <AiSummary header={table2.header} rows={table2.rows} title={`Ringkasan AI | ${period2Meta.fullLabel}`} />

          {/* Hidden HTML solely for PNG capture */}
          <div id="infografis-visible-periode2" style={{ position: 'absolute', left: -10000, top: 0, width: 0, height: 0, overflow: 'hidden' }} aria-hidden>
            <Infografis
              title="Prakiraan Cuaca Kabupaten Kapuas Hulu"
              dateLabel={period2Meta.fullLabel}
              hours={table2.header.slice(1, 9)}
              rows={infographicRows2}
            />
          </div>

          <AutoPngFromVisible targetVisibleId="infografis-visible-periode2" depsKey={captureKey2} />

        </TabsContent>

        <TabsContent value="map">

          <div className="h-[600px]">

            <Map data={data} />

          </div>

        </TabsContent>

      </Tabs>

      {/* snapshot banner removed */}

    </div>

  );

}



function AiSummary({ rows, title }: { header: string[]; rows: (string | number)[][]; title: string }) {

  const temps: number[] = [];

  const rhs: number[] = [];

  const winds: number[] = [];

  const windDirs: string[] = [];

  const weatherAll: string[] = [];

  const rainyKec: Set<string> = new Set();

  const thunderKec: Set<string> = new Set();



  rows.forEach((r) => {

    const kec = String(r[0]);

    const cuaca = r.slice(1, 9).map(String);

    const suhu = String(r[9]);

    const rh = String(r[10]);

    const arah = String(r[11]);

    const angin = String(r[12]);

    const [tmin, tmax] = suhu.replace('C', '').split('-').map(parseFloat);

    const [rmin, rmax] = rh.replace('%', '').split('-').map(parseFloat);

    if (!Number.isNaN(tmin)) temps.push(tmin);

    if (!Number.isNaN(tmax)) temps.push(tmax);

    if (!Number.isNaN(rmin)) rhs.push(rmin);

    if (!Number.isNaN(rmax)) rhs.push(rmax);

    const vmax = parseFloat(angin);

    if (!Number.isNaN(vmax)) winds.push(vmax);

    if (arah) windDirs.push(arah);

    cuaca.forEach((w) => {

      weatherAll.push(w);

      if (/(Hujan Ringan|Hujan Sedang|Hujan Lebat)/i.test(w)) rainyKec.add(kec);

      if (/(Hujan Petir|Petir)/i.test(w)) thunderKec.add(kec);

    });

  });



  const minTemp = temps.length ? Math.min(...temps) : undefined;

  const maxTemp = temps.length ? Math.max(...temps) : undefined;

  const avgTemp = temps.length ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : undefined;

  const minRH = rhs.length ? Math.min(...rhs) : undefined;

  const maxRH = rhs.length ? Math.max(...rhs) : undefined;

  const avgRH = rhs.length ? Math.round((rhs.reduce((a, b) => a + b, 0) / rhs.length) * 10) / 10 : undefined;

  const peakWind = winds.length ? Math.max(...winds) : undefined;

  const dirModeRaw = windDirs.length

    ? windDirs.sort((a, b) => windDirs.filter((v) => v === a).length - windDirs.filter((v) => v === b).length).pop()

    : undefined;

  const dirMode = dirModeRaw ? toIndoWind(dirModeRaw) : undefined;

  const overallWeather = weatherAll.length

    ? weatherAll.sort((a, b) => weatherAll.filter((v) => v === a).length - weatherAll.filter((v) => v === b).length).pop()

    : undefined;



  const rainy = Array.from(rainyKec).sort();

  const thunder = Array.from(thunderKec).sort();



  const overview = `Secara umum, cuaca cenderung ${overallWeather ?? "berawan"}. 

Suhu terasa di kisaran ${minTemp ?? "-"}–${maxTemp ?? "-"}°C (rata-rata sekitar ${avgTemp ?? "-"}°C), dengan kelembapan ${minRH ?? "-"}–${maxRH ?? "-"}% (rata-rata ${avgRH ?? "-"}%). 

Angin dominan dari arah ${dirMode ?? "-"} dengan hembusan terkuat sekitar ${peakWind ?? "-"} knot.`;



  const rainLine = rainy.length
    ? `Wilayah yang berpeluang hujan: ${rainy.join(", ")}.`
    : `Peluang hujan tidak terlalu menonjol di banyak kecamatan.`;

  const thLine = thunder.length
    ? `Potensi petir terutama di: ${thunder.join(", ")}.`
    : `Potensi petir secara umum rendah.`;



  return (

    <div className="rounded-xl border bg-card p-4 shadow-sm">

      <div className="font-semibold mb-2">{title}</div>

      <div className="whitespace-pre-line text-sm text-muted-foreground">

        {overview}

        {"\n"}

        {rainLine}

        {"\n"}

        {thLine}

      </div>

    </div>

  );

}



function ensureImageLoaded(src: string) {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined") return resolve();
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function AutoPngFromVisible({ targetVisibleId, depsKey }: { targetVisibleId: string; depsKey: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!depsKey) { setSrc(null); return; }
    let cancelled = false;
    // Fresh, minimal capture: prepare images in place, then capture the visible node 1:1
    const run = async () => {
      const node = document.getElementById(targetVisibleId);
      if (!node) return;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      // Prepare images in place on the visible node (same-origin public assets recommended)
      const imgs = Array.from(node.querySelectorAll('img')) as HTMLImageElement[];
      const inlineImage = async (img: HTMLImageElement) => {
        const raw = img.getAttribute('src');
        if (!raw) return;
        try {
          const absolute = raw.startsWith('http') ? raw : new URL(raw, window.location.href).toString();
          const urlWithCb = absolute + (absolute.includes('?') ? '&' : '?') + 'cb=' + Date.now();
          const res = await fetch(urlWithCb, { cache: 'no-store', mode: 'cors' });
          if (!res.ok) throw new Error('fetch failed');
          const blob = await res.blob();
          const dataUrl = await blobToDataUrl(blob);
          img.setAttribute('src', dataUrl);
          img.setAttribute('crossorigin', 'anonymous');
          await ensureImageLoaded(dataUrl);
        } catch {
          // Retry once with original URL
          try {
            await ensureImageLoaded(raw);
            img.setAttribute('crossorigin', 'anonymous');
          } catch {}
        }
      };
      // Inline all images
      await Promise.all(imgs.map(inlineImage));
      const target = node.querySelector(':scope > *') as HTMLElement | null;
      const prev = target ? { w: target.style.width, h: target.style.height } : null;
      if (target) { target.style.width = `${INFOGRAPHIC_WIDTH}px`; target.style.height = `${INFOGRAPHIC_HEIGHT}px`; }
      try {
        const dataUrl = await toPng(target ?? node, { cacheBust: true, pixelRatio: 2, backgroundColor: '#ffffff' });
        if (!cancelled) setSrc(dataUrl);
      } finally {
        if (target && prev) { target.style.width = prev.w; target.style.height = prev.h; }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [targetVisibleId, depsKey]);
  if (!src) return null;
  return <img src={src} alt="Infografis PNG" className="w-full h-auto rounded-xl border" />;
}


