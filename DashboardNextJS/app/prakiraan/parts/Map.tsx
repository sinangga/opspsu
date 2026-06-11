"use client";
import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { BMKGResponse, flattenFirstThreeGroups, computeEightSlots, toIndoWind } from "@/lib/bmkg";
import kecamatan from "@/KH_kecamatan_fix.json";

type Kec = { Kecamatan?: string; Latitude?: number; Longitude?: number };

type MarkerInfo = {
  key: string;
  name: string;
  position: [number, number];
  stats: Array<{ label: string; value: string }>;
  timeline: Array<{ key: string; date: string; time: string; weather: string; meta: string; icon?: string }>;
  color: string;
  icon?: string;
};

const fallbackCoords = new Map<string, { lat: number; lng: number }>();
const fallbackList: Kec[] = Array.isArray(kecamatan) ? (kecamatan as Kec[]) : [];
fallbackList.forEach((item) => {
  const name = item?.Kecamatan;
  const lat = typeof item?.Latitude === "number" ? item.Latitude : Number(item?.Latitude);
  const lng = typeof item?.Longitude === "number" ? item.Longitude : Number(item?.Longitude);
  if (!name || Number.isNaN(lat) || Number.isNaN(lng)) return;
  fallbackCoords.set(name.toLowerCase(), { lat, lng });
});

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

const toWibDate = (value: string) => new Date(`${value.replace(" ", "T")}+07:00`);

const formatTime = (value: string) => `${timeFormatter.format(toWibDate(value))} WIB`;

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Jakarta",
});

const formatDate = (value: string) => dateFormatter.format(toWibDate(value));

function parseCoord(value?: number | string | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function colorForWeather(weather: string) {
  const lower = weather.toLowerCase();
  if (/petir|thunder|badai/.test(lower)) return "#ea580c";
  if (/lebat/.test(lower)) return "#be123c";
  if (/hujan/.test(lower)) return "#2563eb";
  if (/cerah/.test(lower)) return "#f59e0b";
  if (/berawan/.test(lower)) return "#6b7280";
  return "#0f172a";
}

const iconCache = new Map<string, L.DivIcon>();

function getWeatherDivIcon(iconUrl: string | undefined, color: string) {
  const cacheKey = `${iconUrl ?? "none"}|${color}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const safeUrl = iconUrl ? iconUrl.replace(/"/g, "&quot;") : null;
  const html = `
    <div style="
      width: 46px;
      height: 46px;
      border-radius: 50%;
      border: 3px solid ${color};
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 12px rgba(15,23,42,0.25);
    ">
      ${
        safeUrl
          ? `<img src="${safeUrl}" alt="" style="width: 32px; height: 32px; object-fit: contain;" />`
          : `<span style="font-size: 11px; color: #0f172a;">N/A</span>`
      }
    </div>
  `;

  const icon = L.divIcon({
    html,
    className: "prakiraan-weather-icon",
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
  iconCache.set(cacheKey, icon);
  return icon;
}

export default function PrakiraanMap({ data }: { data: BMKGResponse[] | null }) {
  const center = { lat: -0.2, lng: 111.7 };
  const markers = useMemo<MarkerInfo[]>(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const entries: MarkerInfo[] = [];

    data.forEach((entry) => {
      const name = entry?.lokasi?.kecamatan;
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;

      const cuacaGroups = entry?.data?.[0]?.cuaca;
      if (!Array.isArray(cuacaGroups)) return;
      const flattened = flattenFirstThreeGroups(cuacaGroups);
      if (flattened.length === 0) return;

      const lat =
        parseCoord(entry?.lokasi?.lat) ??
        parseCoord(entry?.data?.[0]?.lokasi?.lat) ??
        fallbackCoords.get(key)?.lat ??
        null;
      const lng =
        parseCoord(entry?.lokasi?.lon) ??
        parseCoord(entry?.data?.[0]?.lokasi?.lon) ??
        fallbackCoords.get(key)?.lng ??
        null;
      if (lat === null || lng === null) return;

      const slots = computeEightSlots(flattened);
      const stats = [
        { label: "Rentang Suhu", value: `${slots.suhuRange}°C` },
        { label: "Rentang RH", value: slots.rhRange },
        { label: "Angin Dominan", value: toIndoWind(slots.arah) },
        { label: "Kecepatan Maks", value: slots.anginMax },
      ];

      const timeline = flattened.slice(0, 8).map((item) => {
        const speed = Number.isFinite(item.ws) ? Math.round(item.ws) : null;
        const windDir = item.wd ? toIndoWind(item.wd) : null;
        const windLabel =
          windDir && typeof speed === "number" ? `${windDir} ${speed} kt` : windDir ?? (typeof speed === "number" ? `${speed} kt` : null);
        const metaParts = [`${item.t}°C`, `RH ${item.hu}%`, windLabel ? `Angin ${windLabel}` : null].filter(Boolean);
        return {
          key: item.local_datetime,
          date: formatDate(item.local_datetime),
          time: formatTime(item.local_datetime),
          weather: item.weather_desc,
          meta: metaParts.join(" · "),
          icon: typeof (item as { image?: string })?.image === "string" ? (item as { image?: string }).image : undefined,
        };
      });

      const color = colorForWeather(slots.cuaca.at(0) ?? timeline.at(0)?.weather ?? "");
      const icon = timeline.find((t) => t.icon)?.icon;

      entries.push({
        key,
        name,
        position: [lat, lng],
        stats,
        timeline,
        color,
        icon,
      });
      seen.add(key);
    });

    return entries.sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
  }, [data]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={7}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
      className="relative"
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {markers.map((marker) => (
        <Marker key={marker.key} position={marker.position} icon={getWeatherDivIcon(marker.icon, marker.color)}>
          <Popup>
            <div style={{ minWidth: 260, maxWidth: 320 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{marker.name}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, fontSize: 11 }}>
                {marker.stats.map((stat) => (
                  <div key={stat.label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ color: "#4b5563" }}>{stat.label}</span>
                    <span style={{ fontWeight: 600 }}>{stat.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb", fontSize: 11, display: "flex", flexDirection: "column", gap: 6 }}>
                {marker.timeline.map((item) => (
                  <div key={item.key}>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{item.date}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: 600 }}>
                      <span>{item.time}</span>
                      <span>{item.weather}</span>
                    </div>
                    <div style={{ color: "#4b5563" }}>{item.meta}</div>
                  </div>
                ))}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
