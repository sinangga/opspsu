"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Smartphone, Play, Square, Calculator, Settings2, Power, PowerOff } from "lucide-react";
import { calculateWindProfile, encodePibal, type PibalReading, type WindData } from "@/lib/pibalMath";
import { toast } from "sonner";

export default function KawanPibalClient() {
  // --- State ---
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isSensorEnabled, setIsSensorEnabled] = useState<boolean>(false);
  
  // Recording State
  const [status, setStatus] = useState<'idle' | 'recording'>('idle');
  
  const [startTime, setStartTime] = useState<number | null>(null);
  
  // Sensors
  const [azimuth, setAzimuth] = useState<number>(0);
  const [elevation, setElevation] = useState<number>(0);
  
  // Configuration
  const [firstReadingSeconds, setFirstReadingSeconds] = useState<string>("15");
  const [azimuthOffset, setAzimuthOffset] = useState<string>("0");
  
  // Data
  const [readings, setReadings] = useState<PibalReading[]>([]);
  const readingsRef = useRef<PibalReading[]>([]);
  
  const [results, setResults] = useState<WindData[]>([]);
  const [encodedData, setEncodedData] = useState<string>("");

  // Timer Display
  const [elapsed, setElapsed] = useState<number>(0);
  const [nextCaptureDisplay, setNextCaptureDisplay] = useState<number>(15);
  
  // Refs for Logic
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const nextTargetTimeRef = useRef<number>(15); // Seconds from start
  const lastBeepSecondRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const latestSensorRef = useRef<{ az: number, el: number }>({ az: 0, el: 0 });
  const lastUIUpdateRef = useRef<number>(0);

  // --- Audio ---
  const initAudio = () => {
    if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
            audioContextRef.current = new AudioContext();
            // Warm-up
            const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current.destination);
            source.start(0);
        }
    } else if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }
  };

  const playSound = (type: 'warning' | 'success') => {
    try {
        if (!audioContextRef.current) initAudio();
        const ctx = audioContextRef.current;
        if (!ctx) return;
        
        if (ctx.state === 'suspended') ctx.resume();

        const t = ctx.currentTime;
        
        if (type === 'warning') {
            // Beep (Triangle)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = "triangle";
            osc.frequency.setValueAtTime(600, t); 
            
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.5, t + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            
            osc.start(t);
            osc.stop(t + 0.3);
        } else {
            // Cling (Bell)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = "sine";
            osc.frequency.setValueAtTime(1500, t); 
            
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.5, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
            
            osc.start(t);
            osc.stop(t + 1.5);
        }
    } catch (e) {
        console.error("Audio error", e);
    }
  };

  // --- Effects ---

  // Handle Orientation
  const handleOrientation = (event: DeviceOrientationEvent) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evt = event as any;
    
    let compass = 0;
    let rawAzimuth = 0;

    // Prioritize Webkit (iOS)
    if (typeof evt.webkitCompassHeading === 'number') {
      rawAzimuth = evt.webkitCompassHeading;
    } 
    // Android Absolute
    else if (evt.absolute && evt.alpha !== null) {
      rawAzimuth = (360 - evt.alpha) % 360;
    }
    // Fallback (Might be relative, but best we can do without absolute)
    else if (evt.alpha !== null) {
      rawAzimuth = (360 - evt.alpha) % 360;
    }

    // Apply user offset
    const offset = parseFloat(azimuthOffset) || 0;
    compass = (rawAzimuth + offset) % 360;
    if (compass < 0) compass += 360;

    // Elevation Calculation
    const b = event.beta; 
    let elev = b || 0;
    
    if (elev > 90) {
        elev = 180 - elev;
    }
    
    if (elev < 0) elev = 0;
    
    // Update Ref for Timer Access (Always instant)
    latestSensorRef.current = { az: compass, el: elev };

    // Throttle UI Updates (~15 FPS)
    const now = Date.now();
    if (now - lastUIUpdateRef.current > 66) { // ~15 FPS
        setAzimuth(compass);
        setElevation(elev);
        lastUIUpdateRef.current = now;
    }
  };

  useEffect(() => {
    // Only listen if permission granted AND sensor is manually enabled
    if (hasPermission && isSensorEnabled) {
      // Try to use absolute orientation event for Android Chrome if available
      if ('ondeviceorientationabsolute' in window) {
         window.addEventListener("deviceorientationabsolute" as any, handleOrientation);
      } else {
         window.addEventListener("deviceorientation", handleOrientation);
      }
    }
    return () => {
      if ('ondeviceorientationabsolute' in window) {
         window.removeEventListener("deviceorientationabsolute" as any, handleOrientation);
      } else {
         window.removeEventListener("deviceorientation", handleOrientation);
      }
    };
  }, [hasPermission, isSensorEnabled, azimuthOffset]); // Add azimuthOffset dependency to re-bind if needed, actually handleOrientation closes over state so we might need refs or effect dep. 
  // Wait, handleOrientation uses azimuthOffset state? Yes. 
  // Optimization: use a ref for azimuthOffset inside handleOrientation or include it in dependency.
  // Including it in dependency will re-add listener on input change which is fine.

  // Main Recording Timer
  useEffect(() => {
    if (status === 'recording' && startTime) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const diff = (now - startTime) / 1000;
        setElapsed(diff);
        
        const target = nextTargetTimeRef.current;
        const timeToNext = target - diff;
        setNextCaptureDisplay(timeToNext);

        // Warning Beeps (5, 4, 3, 2, 1)
        const roundedSec = Math.ceil(timeToNext);
        if (roundedSec <= 5 && roundedSec >= 1) {
            if (lastBeepSecondRef.current !== roundedSec) {
                playSound('warning');
                lastBeepSecondRef.current = roundedSec;
            }
        } else {
            if (timeToNext > 6) lastBeepSecondRef.current = null;
        }

        // Capture Logic
        if (diff >= target) {
             captureReading(target / 60);
             nextTargetTimeRef.current += 60; // Next target is +60s
        }

      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, startTime]); 

  // Real-time calculation when readings update
  useEffect(() => {
    if (readings.length > 0) {
        handleCalculate();
    }
  }, [readings]);

  // --- Actions ---

  const requestPermission = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          setHasPermission(true);
          setIsSensorEnabled(true); // Auto-enable on grant
        } else {
          toast.error("Izin akses sensor ditolak.");
        }
      } catch (error) {
        console.error(error);
        toast.error("Gagal meminta izin sensor.");
      }
    } else {
      setHasPermission(true);
      setIsSensorEnabled(true); // Auto-enable on grant
    }
  };

  const toggleSensor = () => {
      if (status === 'recording') {
          toast.warning("Sensor tidak bisa dimatikan saat merekam.");
          return;
      }
      setIsSensorEnabled(!isSensorEnabled);
  };

  const startRecording = () => {
    if (!hasPermission) {
      requestPermission();
      return;
    }
    
    // Unlock Audio Context immediately
    initAudio();
    
    setReadings([]);
    readingsRef.current = [];
    setResults([]);
    setEncodedData("");
    
    setStartTime(Date.now());
    
    // Force enable sensor
    setIsSensorEnabled(true);
    
    const first = parseInt(firstReadingSeconds) || 15;
    nextTargetTimeRef.current = first;
    lastBeepSecondRef.current = null;
    
    setStatus('recording');
    toast.success("Perekaman dimulai! Lepas balon.");
    
    // Start sound
    playSound('success');
    
    // Request Wake Lock
    if ('wakeLock' in navigator) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (navigator as any).wakeLock.request('screen').then((lock: any) => {
                wakeLockRef.current = lock;
            });
        } catch (err) {
            console.error(err);
        }
    }
  };

  const stopRecording = () => {
    setStatus('idle');
    setStartTime(null);
    
    // Release Wake Lock
    if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
    }

    toast.info("Perekaman selesai.");
  };

  const captureReading = (minute: number) => {
    // Read from Ref to get latest sensor data inside timer closure
    const current = latestSensorRef.current;
    
    const newReading: PibalReading = {
        minute,
        azimuth: parseFloat(current.az.toFixed(1)),
        elevation: parseFloat(current.el.toFixed(1))
    };
    
    // Update Ref
    readingsRef.current.push(newReading);
    // Update State (Force Re-render)
    setReadings([...readingsRef.current]);
    
    toast.success(`Data menit ke-${minute.toFixed(2)} tersimpan.`);
    playSound('success'); 
  };
  
  const handleCalculate = () => {
      const rate = 5; // Default 5 m/s fixed
      const res = calculateWindProfile(readings, rate);
      setResults(res);
      const code = encodePibal(res);
      setEncodedData(code);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Kawan Pibal</h2>
                <p className="text-muted-foreground">Asisten pencatatan dan penyandian Pilot Balloon.</p>
            </div>
            <div className="flex gap-2">
                 {!hasPermission ? (
                    <Button onClick={requestPermission} variant="outline">
                        <Smartphone className="mr-2 h-4 w-4" />
                        Izinkan Sensor
                    </Button>
                 ) : (
                    <Button 
                        onClick={toggleSensor} 
                        variant={isSensorEnabled ? "default" : "secondary"}
                        className={isSensorEnabled ? "bg-green-600 hover:bg-green-700" : ""}
                        disabled={status === 'recording'}
                    >
                        {isSensorEnabled ? <Power className="mr-2 h-4 w-4" /> : <PowerOff className="mr-2 h-4 w-4" />}
                        Sensor: {isSensorEnabled ? "ON" : "OFF"}
                    </Button>
                 )}
            </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             {/* Configuration */}
             <Card className="col-span-1 border-border/60">
                <CardHeader className="py-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Settings2 className="h-4 w-4" />
                        Konfigurasi
                    </CardTitle>
                </CardHeader>
                <CardContent className="pb-4 space-y-4">
                     <div className="space-y-2">
                        <Label>Detik Pembacaan Pertama</Label>
                        <Input 
                            type="number" 
                            value={firstReadingSeconds} 
                            onChange={(e) => setFirstReadingSeconds(e.target.value)}
                            placeholder="15" 
                            className="h-9"
                            disabled={status !== 'idle'}
                        />
                        <p className="text-[10px] text-muted-foreground">Otomatis tiap 60 detik setelahnya.</p>
                    </div>
                     <div className="space-y-2">
                        <Label>Offset Azimuth (°)</Label>
                        <Input 
                            type="number" 
                            value={azimuthOffset} 
                            onChange={(e) => setAzimuthOffset(e.target.value)}
                            placeholder="0" 
                            className="h-9"
                        />
                        <p className="text-[10px] text-muted-foreground">Koreksi jika kompas tidak akurat (+/-).</p>
                    </div>
                </CardContent>
            </Card>

            {/* Sensor Live View */}
            <Card className={`col-span-1 md:col-span-1 lg:col-span-2 border-primary/20 shadow-sm transition-colors duration-500 
                ${nextCaptureDisplay <= 5 && status === 'recording' ? 'bg-red-500/10 border-red-500' : ''}`}>
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                         <div>
                            <CardTitle className="flex items-center gap-2">
                                <Smartphone className="h-5 w-5 text-primary" />
                                Live Sensor
                            </CardTitle>
                            <CardDescription>Arahkan HP ke balon.</CardDescription>
                         </div>
                         
                         {status === 'recording' && (
                             <div className="text-right">
                                <div className="text-xs text-muted-foreground">Countdown</div>
                                <div className={`text-4xl font-mono font-bold leading-none ${nextCaptureDisplay <= 5 ? 'text-red-500 animate-pulse' : 'text-primary'}`}>
                                    {nextCaptureDisplay.toFixed(1)}
                                </div>
                             </div>
                         )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="rounded-xl bg-muted/50 p-4">
                            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Azimuth</div>
                            <div className="text-4xl font-mono font-bold text-primary">
                                {isSensorEnabled ? azimuth.toFixed(1) + "°" : "--"}
                            </div>
                        </div>
                        <div className="rounded-xl bg-muted/50 p-4">
                            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Elevasi</div>
                            <div className="text-4xl font-mono font-bold text-primary">
                                {isSensorEnabled ? elevation.toFixed(1) + "°" : "--"}
                            </div>
                        </div>
                    </div>
                    
                    {status === 'recording' && (
                        <div className="text-center">
                             <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                Total Waktu: {formatTime(elapsed)}
                             </span>
                        </div>
                    )}

                    <div className="flex gap-3">
                        {status === 'idle' ? (
                            <Button className="w-full" size="lg" onClick={startRecording} disabled={!hasPermission}>
                                <Play className="mr-2 h-4 w-4" /> Mulai
                            </Button>
                        ) : (
                            <Button className="w-full" variant="destructive" size="lg" onClick={stopRecording}>
                                <Square className="mr-2 h-4 w-4" /> Stop
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            <Card className="col-span-1 md:col-span-2 lg:col-span-3">
                 <Tabs defaultValue="combined" className="w-full">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                             <CardTitle>Data Pengamatan</CardTitle>
                             <CardDescription>Detail pembacaan dan hasil perhitungan angin.</CardDescription>
                        </div>
                        <TabsList>
                            <TabsTrigger value="combined">Tabel Data</TabsTrigger>
                            <TabsTrigger value="code">Sandi PIBAL</TabsTrigger>
                        </TabsList>
                    </CardHeader>
                    
                    <CardContent>
                        <TabsContent value="combined" className="mt-0">
                            <ScrollArea className="h-[400px] w-full rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[60px]">No</TableHead>
                                            <TableHead>Azimut (°)</TableHead>
                                            <TableHead>Elevasi (°)</TableHead>
                                            <TableHead>Tinggi (m)</TableHead>
                                            <TableHead>Arah (°)</TableHead>
                                            <TableHead>Kec. (kt)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {readings.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground h-24">Belum ada data.</TableCell>
                                            </TableRow>
                                        ) : (
                                            readings.map((r, idx) => {
                                                const res = results[idx];
                                                return (
                                                    <TableRow key={r.minute}>
                                                        <TableCell className="font-medium">#{idx + 1}</TableCell>
                                                        <TableCell>{r.azimuth}</TableCell>
                                                        <TableCell>{r.elevation}</TableCell>
                                                        <TableCell>{res ? Math.round(res.height) : "-"}</TableCell>
                                                        <TableCell>{res ? res.direction : "-"}</TableCell>
                                                        <TableCell>{res ? res.speed : "-"}</TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </TabsContent>
                        
                         <TabsContent value="code" className="mt-0 space-y-4">
                            <div className="rounded-md bg-muted p-4 font-mono text-sm whitespace-pre-wrap min-h-[150px]">
                                {encodedData || "Data sandi akan muncul di sini..."}
                            </div>
                            <Button onClick={handleCalculate} variant="secondary">
                                <Calculator className="mr-2 h-4 w-4" /> Regenerate Code
                            </Button>
                        </TabsContent>
                    </CardContent>
                 </Tabs>
            </Card>
        </div>
    </div>
  );
}