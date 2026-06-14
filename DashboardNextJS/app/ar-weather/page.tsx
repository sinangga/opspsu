"use client";

import { useEffect, useRef, useState } from "react";
import { BMKGResponse } from "@/lib/bmkg";

export default function ARWeatherPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [heading, setHeading] = useState(0);
  const [data, setData] = useState<BMKGResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 1. Setup Kamera
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Gagal akses kamera:", err);
        setError("Gagal akses kamera. Pastikan memberikan izin kamera dan gunakan HTTPS.");
      }
    }
    setupCamera();
  }, []);

  // 2. Setup Sensor Kompas
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // @ts-ignore (Support for iOS)
      const compass = e.webkitCompassHeading || (360 - (e.alpha || 0));
      if (compass !== undefined) {
        setHeading(compass);
      }
    };

    if (typeof window !== "undefined") {
      // For iOS, need to request permission for DeviceOrientation
      // @ts-ignore
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // This usually needs to be triggered by a user gesture
      } else {
        window.addEventListener("deviceorientation", handleOrientation);
      }
    }
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, []);

  const requestIOSPermission = () => {
    // @ts-ignore
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // @ts-ignore
      DeviceOrientationEvent.requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            window.addEventListener("deviceorientation", (e) => {
              // @ts-ignore
              const compass = e.webkitCompassHeading || (360 - (e.alpha || 0));
              setHeading(compass);
            });
          }
        })
        .catch(console.error);
    }
  };

  // 3. Ambil Data Cuaca
  useEffect(() => {
    fetch("/api/prakiraan-snapshot")
      .then(res => res.json())
      .then(payload => {
        if (payload.data) setData(payload.data);
        else if (Array.isArray(payload)) setData(payload);
      })
      .catch(err => {
        console.error("Gagal ambil data cuaca:", err);
      });
  }, []);

  // Fungsi hitung posisi horizontal elemen berdasarkan arah HP
  const getXPosition = (targetAngle: number) => {
    let diff = targetAngle - heading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    // We'll use percentage for better responsiveness
    // 50% is center. Let's say 90 degrees field of view.
    // So 45 degrees diff = 0% or 100%
    const offset = (diff / 45) * 50; 
    return `${50 + offset}%`;
  };

  const isVisible = (targetAngle: number) => {
    let diff = targetAngle - heading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return Math.abs(diff) < 45; // Only show if within 45 degrees of center
  };

  // Titik Koordinat Sederhana (Contoh: Utara, Selatan, dsb)
  const locations = [
    { name: "Putussibau Utara", angle: 0 },
    { name: "Putussibau Selatan", angle: 180 },
    { name: "Bika", angle: 225 },
    { name: "Kalis", angle: 135 },
    { name: "Mentebah", angle: 150 },
    { name: "Bunut Hulu", angle: 200 },
    { name: "Boyan Tanjung", angle: 240 },
    { name: "Embaloh Hulu", angle: 330 },
  ];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans text-white">
      {/* Background Kamera */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="absolute inset-0 w-full h-full object-cover opacity-80"
      />

      {/* Overlay UI */}
      <div className="absolute top-10 left-0 right-0 text-center pointer-events-none">
        <h1 className="text-xl font-bold drop-shadow-lg shadow-black">AR WEATHER PANGSUMA</h1>
        <p className="text-sm opacity-80 bg-black/30 inline-block px-3 py-1 rounded-full mt-2">
          Arah: {Math.round(heading)}°
        </p>
      </div>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-black/60">
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      )}

      {/* Permission Button for iOS */}
      <div className="absolute bottom-24 left-0 right-0 flex justify-center">
        <button 
          onClick={requestIOSPermission}
          className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-lg text-xs"
        >
          Minta Izin Sensor (iOS)
        </button>
      </div>

      {/* Floating Weather Cards */}
      <div className="absolute inset-0 pointer-events-none">
        {locations.map((loc) => {
          const weather = data.find(d => d.lokasi.kecamatan?.toLowerCase().includes(loc.name.toLowerCase()));
          const currentCuaca = weather?.data[0]?.cuaca[0]?.[0];
          
          if (!isVisible(loc.angle)) return null;

          return (
            <div
              key={loc.name}
              style={{
                position: "absolute",
                left: getXPosition(loc.angle),
                top: "40%",
                transform: "translateX(-50%) translateY(-50%)",
                transition: "left 0.1s ease-out",
              }}
              className="bg-black/40 backdrop-blur-xl border border-white/30 p-4 rounded-3xl min-w-[180px] shadow-2xl animate-in fade-in zoom-in duration-300"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 mb-2">{loc.name}</div>
              <div className="flex items-end gap-2 mb-1">
                <div className="text-4xl font-bold leading-none">{currentCuaca?.t ?? "--"}</div>
                <div className="text-xl font-medium text-cyan-200 pb-1">°C</div>
              </div>
              <div className="text-sm font-semibold text-white/90">{currentCuaca?.weather_desc ?? "Memuat..."}</div>
              <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center text-[10px] font-medium opacity-80">
                <span>💨 {currentCuaca?.ws ?? "0"} kt</span>
                <span>🧭 {currentCuaca?.wd ?? "-"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compass Bar */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center h-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
        <div className="relative w-full max-w-xs h-full flex items-center justify-around text-xs font-black tracking-widest">
            {['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'].map((label, i) => {
                const angle = i * 45;
                let diff = angle - heading;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                
                const opacity = Math.max(0, 1 - Math.abs(diff) / 90);
                return (
                    <span key={label} style={{ opacity, transform: `translateX(${diff * 2}px)` }} className={label === 'U' ? 'text-red-500' : 'text-white'}>
                        {label}
                    </span>
                );
            })}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-cyan-500 shadow-[0_0_8px_cyan]"></div>
        </div>
      </div>
    </div>
  );
}
