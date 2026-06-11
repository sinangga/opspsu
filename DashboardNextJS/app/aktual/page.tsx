"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type AviationResp = Record<string, { icao_code: string; data_text: string }[]>;

const BASE = "https://web-aviation.bmkg.go.id/api/v1";
const TOKEN = process.env.NEXT_PUBLIC_AKTUAL_API_TOKEN;
const ICAO = "WIOP";
const SOURCES_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export default function AktualPage() {
  const [metar, setMetar] = useState<string>("Loading...");
  const [speci, setSpeci] = useState<string>("Loading...");
  const [tafor, setTafor] = useState<string>("Loading...");
  const [error, setError] = useState<string | null>(null);
  const [satelitUrl, setSatelitUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!TOKEN) {
      setError("API Token is missing. Please check your environment variables.");
      setMetar("Error");
      setSpeci("Error");
      setTafor("Error");
      return;
    }
    const headers: HeadersInit = { Authorization: TOKEN };
    const get = (path: string) =>
      fetch(`${BASE}/${path}/${ICAO}`, { headers }).then((r) => r.json() as Promise<AviationResp>);
    Promise.allSettled([get("metar"), get("speci"), get("taf")])
      .then((res) => {
        const [m, s, t] = res;
        if (m.status === "fulfilled") {
          const list = m.value[ICAO] || [];
          if (list.length > 0) setMetar(list[0].data_text);
          else setMetar("No METAR data");
        } else setMetar("No METAR data");
        if (s.status === "fulfilled") {
          const list = s.value[ICAO] || [];
          if (list.length > 0) setSpeci(list[0].data_text);
          else setSpeci("No SPECi data");
        } else setSpeci("No SPECi data");
        if (t.status === "fulfilled") {
          const list = t.value[ICAO] || [];
          if (list.length > 0) setTafor(list[0].data_text);
          else setTafor("No TAFOR data");
        } else setTafor("No TAFOR data");
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const loadSources = () =>
      fetch("/api/aktual-sources", { cache: "no-store" })
        .then((res) => res.json())
        .then((payload: { satelitUrl?: string | null }) => {
          if (!alive) return;
          if (payload?.satelitUrl) {
            setSatelitUrl(payload.satelitUrl);
          } else {
            setSatelitUrl(null);
          }
        })
        .catch(() => {
          if (!alive) return;
          setSatelitUrl(null);
        });

    loadSources();
    timer = setInterval(loadSources, SOURCES_REFRESH_MS);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Aktual</h1>
      <div className="space-y-6">
        {error && <div className="text-red-600">Error: {error}</div>}
        <section className="space-y-2">
          <div className="font-medium">Bandar Udara Pangsuma Kapuas Hulu (WIOP)</div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="border rounded p-3">
              <div className="text-sm text-muted-foreground mb-1">METAR</div>
              <div className="font-mono text-sm break-words">{metar}</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-sm text-muted-foreground mb-1">SPECi</div>
              <div className="font-mono text-sm break-words">{speci}</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-sm text-muted-foreground mb-1">TAFOR</div>
              <div className="font-mono text-sm break-words">{tafor}</div>
            </div>
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="text-xl font-medium">Satelit</h2>
          {satelitUrl ? (
            <Image src={satelitUrl} alt="Satelit" width={1080} height={1080} className="h-auto w-full" priority />
          ) : (
            <div className="text-sm text-muted-foreground">Memuat gambar satelit…</div>
          )}
        </section>
      </div>
    </div>
  );
}
