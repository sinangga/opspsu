"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { 
  type BMKGResponse, 
  flattenFirstThreeGroups, 
  computeEightSlots, 
  toIndoWind 
} from "@/lib/bmkg";
import Infografis from "@/components/infografis/Infografis";
import { X } from "lucide-react";

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

function buildPeriodMeta(entries: any[]) {
  if (!entries.length) return { fullLabel: "Periode" };
  const endIndex = Math.min(entries.length - 1, 7);
  const start = toWibDate(entries[0].local_datetime);
  const end = toWibDate(entries[endIndex].local_datetime);
  const startDate = dateFormatter.format(start);
  const endDate = dateFormatter.format(end);
  const startTime = timeFormatter.format(start);
  const endTime = timeFormatter.format(end);
  if (startDate === endDate) {
    return { fullLabel: `${weekdayFormatter.format(start)}, ${startDate} ${startTime}-${endTime} WIB` };
  }
  return { fullLabel: `${weekdayFormatter.format(start)}, ${startDate} ${startTime} - ${weekdayFormatter.format(end)}, ${endDate} ${endTime} WIB` };
}

export default function ARWeatherPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [heading, setHeading] = useState(0);
  const [data, setData] = useState<BMKGResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedKec, setSelectedKec] = useState<string | null>(null);

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
      // @ts-ignore
      if (typeof DeviceOrientationEvent.requestPermission !== 'function') {
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

  // 4. Data Infografis untuk Kecamatan Terpilih
  const infoProps = useMemo(() => {
    if (!selectedKec || data.length === 0) return null;
    const entry = data.find(d => d.lokasi.kecamatan?.toLowerCase().includes(selectedKec.toLowerCase()));
    if (!entry || !entry.data?.[0]?.cuaca) return null;

    const allEntries = flattenFirstThreeGroups(entry.data[0].cuaca);
    const period1 = allEntries.slice(0, 8);
    const s = computeEightSlots(period1);
    const meta = buildPeriodMeta(period1);

    return {
      title: `Prakiraan Cuaca Kecamatan ${entry.lokasi.kecamatan}`,
      dateLabel: meta.fullLabel,
      hours: s.hours,
      rows: [{
        kecamatan: entry.lokasi.kecamatan,
        cuaca: s.cuaca,
        suhu: s.suhuRange + "°C",
        rh: s.rhRange,
        arah: toIndoWind(s.arah),
        angin: s.anginMax,
        icons: new Array(8).fill(null)
      }]
    };
  }, [selectedKec, data]);

  // Fungsi hitung posisi horizontal elemen berdasarkan arah HP
  const getXPosition = (targetAngle: number) => {
    let diff = targetAngle - heading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const offset = (diff / 45) * 50; 
    return `${50 + offset}%`;
  };

  const isVisible = (targetAngle: number) => {
    let diff = targetAngle - heading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return Math.abs(diff) < 45; 
  };

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
              onClick={() => setSelectedKec(loc.name)}
              style={{
                position: "absolute",
                left: getXPosition(loc.angle),
                top: "40%",
                transform: "translateX(-50%) translateY(-50%)",
                transition: "left 0.1s ease-out",
                pointerEvents: "auto", // Enable clicks
                cursor: "pointer"
              }}
              className="bg-black/40 backdrop-blur-xl border border-white/30 p-4 rounded-3xl min-w-[180px] shadow-2xl animate-in fade-in zoom-in duration-300 active:scale-95 transition-transform"
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
              <div className="mt-2 text-[8px] text-center text-cyan-400/60 font-bold uppercase tracking-widest">Klik untuk Detail</div>
            </div>
          );
        })}
      </div>

      {/* Infographic Modal Overlay */}
      {selectedKec && infoProps && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-y-auto">
          <button 
            onClick={() => setSelectedKec(null)}
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-[60]"
          >
            <X size={28} />
          </button>
          
          <div className="w-full max-w-4xl scale-[0.6] sm:scale-[0.8] md:scale-100 origin-center transition-all duration-500 animate-in fade-in slide-in-from-bottom-10">
            <Infografis {...infoProps} />
          </div>
          
          <p className="mt-4 text-sm text-white/50 animate-pulse font-medium">Klik tanda X untuk kembali ke Kamera AR</p>
        </div>
      )}

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
