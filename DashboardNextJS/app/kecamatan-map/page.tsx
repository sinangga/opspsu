"use client";

import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import kecamatanMap from "../../kecamatan_map.json";

export default function KecamatanMapPage() {
  const [map, setMap] = useState<L.Map | null>(null);

  useEffect(() => {
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
        <div class="font-sans">
          <h3 class="font-bold text-sm">${name}</h3>
          <button 
            onclick="window.location.href='/api/kecamatan/fetch?adm4=${info.adm4}'" 
            class="bg-blue-500 text-white text-xs px-2 py-1 rounded mt-2"
          >
            Lihat Cuaca
          </button>
        </div>
      `);
    });

    setMap(newMap);
    return () => newMap.remove();
  }, []);

  return <div id="map" className="w-full h-screen" />;
}
