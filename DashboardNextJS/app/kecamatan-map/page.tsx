"use client";

import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import kecamatanMap from "../../kecamatan_map.json";
import dynamic from 'next/dynamic';

export default function KecamatanMapPage() {
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    // Dynamic import inside useEffect
    import("leaflet").then((L) => {
      // Fix Leaflet marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });

      const newMap = L.map("map").setView([0.8, 112.5], 9);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(newMap);

      Object.entries(kecamatanMap).forEach(([name, info]: [string, any]) => {
        const marker = L.marker([info.lat, info.lon]).addTo(newMap);
        marker.bindPopup(`
          <div class="font-sans text-xs">
            <h3 class="font-bold text-sm mb-1">${name}</h3>
            <button 
              id="btn-${info.adm4}"
              class="bg-blue-500 text-white px-2 py-1 rounded"
            >
              Lihat Cuaca
            </button>
            <div id="data-${info.adm4}" class="mt-2 text-gray-700"></div>
          </div>
        `);
        marker.on('popupopen', () => {
            const btn = document.getElementById(`btn-${info.adm4}`);
            btn?.addEventListener('click', async () => {
                const container = document.getElementById(`data-${info.adm4}`);
                if (container) container.innerHTML = "Memuat...";
                try {
                    const res = await fetch(`/api/kecamatan/fetch?adm4=${info.adm4}`);
                    const data = await res.json();
                    const cuaca = data.data[0].cuaca[0][0];
                    if (container) {
                        container.innerHTML = `
                            <p>Suhu: ${cuaca.t}°C</p>
                            <p>Cuaca: ${cuaca.weather_desc}</p>
                        `;
                    }
                } catch(e) {
                    if (container) container.innerHTML = "Gagal memuat data.";
                }
            });
        });
      });
      setMapReady(true);
      return () => newMap.remove();
    });
  }, []);

  return <div id="map" className="w-full h-screen" />;
}
