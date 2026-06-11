"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from 'leaflet';
import type { DivIconOptions, LatLngExpression } from 'leaflet';
import "leaflet/dist/leaflet.css";

type FirmRow = { latitude: number; longitude: number; acq_date?: string; brightness?: number; persistent?: boolean };
export default function Map({ center, rows }: { center: { lat: number; lng: number }; rows: FirmRow[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Build icons by age bucket: H (0), H-1 (1), H-2 (2), H-3+ (3)
  type AgeBucket = 0 | 1 | 2 | 3;
  const iconByAge: Record<AgeBucket, L.DivIcon> = {
    0: L.divIcon({
      className: 'hotspot-emoji age-0',
      html: '<span style="font-size:24px; filter: drop-shadow(0 0 3px #ff0000);">🔥</span>',
      iconSize: [24, 24], iconAnchor: [12, 12],
    }),
    1: L.divIcon({
      className: 'hotspot-emoji age-1',
      html: '<span style="font-size:22px; filter: drop-shadow(0 0 2px #ff4d4d);">🔥</span>',
      iconSize: [22, 22], iconAnchor: [11, 11],
    }),
    2: L.divIcon({
      className: 'hotspot-emoji age-2',
      html: '<span style="font-size:20px; opacity:0.9;">🔥</span>',
      iconSize: [20, 20], iconAnchor: [10, 10],
    }),
    3: L.divIcon({
      className: 'hotspot-emoji age-3',
      html: '<span style="font-size:18px; opacity:0.75;">🔥</span>',
      iconSize: [18, 18], iconAnchor: [9, 9],
    }),
  };

  const persistentWrap = (icon: L.DivIcon) => {
    const opts: DivIconOptions = {
      ...icon.options,
      className: `${icon.options.className ?? ''} persistent`,
    };
    const html = typeof icon.options.html === 'string' ? icon.options.html : '';
    opts.html = html.replace('<span', '<span style="outline: 2px solid rgba(255,0,0,0.4); border-radius: 6px; padding:1px;"');
    return L.divIcon(opts);
  };

  const todayUTC = new Date();
  const ymd = (d: Date) => d.toISOString().slice(0,10);
  return (
    <MapContainer
      center={[center.lat, center.lng] as LatLngExpression}
      zoom={5}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
      className="relative"
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {rows.map((r, i) => {
        // Parse date safely and compute age in days (UTC)
        const ds = String(r.acq_date || '').slice(0,10);
        let age = 0;
        try {
          const d = new Date(ds);
          const dStr = ymd(d);
          const tStr = ymd(todayUTC);
          const diffMs = new Date(tStr).getTime() - new Date(dStr).getTime();
          age = Math.max(0, Math.min(3, Math.floor(diffMs / 86400000)));
        } catch {}
        const bucket = Math.max(0, Math.min(3, age)) as AgeBucket;
        const baseIcon = iconByAge[bucket];
        const icon = r.persistent ? persistentWrap(baseIcon) : baseIcon;
        return (
          <Marker key={i} position={[r.latitude, r.longitude]} icon={icon}>
          <Popup>
            <div>
              <div><b>Date:</b> {r.acq_date}</div>
              <div><b>Lat:</b> {r.latitude}</div>
              <div><b>Lng:</b> {r.longitude}</div>
              <div><b>Brightness:</b> {r.brightness}</div>
              <div><b>Persistent:</b> {r.persistent ? 'Yes' : 'No'}</div>
              <div className="mt-2">
                <a
                  href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Buka di Google Maps
                </a>
              </div>
            </div>
          </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
