"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Text } from "@react-three/drei";
import { CatmullRomCurve3, Vector3 } from "three";
import type { TrajectoryPoint } from "@/lib/computeTrajectory";
import type { PibalLevel } from "@/lib/parsePibal";
import { DEFAULT_TIME_STEP, STATION_INFO } from "@/lib/pibalDefaults";
import { Button } from "@/components/ui/button";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { X } from "lucide-react";

const SCALE = 0.02; // 1 unit = 50 meters
const SURFACE_OFFSET = 0.5;
const TRAJECTORY_RADIUS = 0.6;

const formatAltitude = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} km`;
  return `${value.toFixed(0)} m`;
};

const Marker = ({
  position,
  label,
  color,
}: {
  position: [number, number, number];
  label: string;
  color: string;
}) => (
  <group position={position}>
    <mesh>
      <sphereGeometry args={[2, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
    </mesh>
    <Html center distanceFactor={10} position={[0, 5, 0]} style={{ pointerEvents: 'none' }}>
      <span className="whitespace-nowrap rounded-full bg-slate-900/95 px-5 py-2 text-base font-black text-white shadow-2xl backdrop-blur-xl border-2 border-white/20">
        {label}
      </span>
    </Html>
  </group>
);

const PolarGrid = ({ size, maxDist }: { size: number; maxDist: number }) => {
  // Determine ring step based on max distance
  const step = maxDist > 10000 ? 5000 : maxDist > 5000 ? 2000 : maxDist > 2000 ? 1000 : 500;
  const rings = [];
  for (let r = step; r < maxDist * 1.5; r += step) rings.push(r);

  return (
    <group position={[0, 0.1, 0]}>
      {/* Floor Plane (Transparent) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[size, 64]} />
        <meshStandardMaterial color="#020617" transparent opacity={0.8} />
      </mesh>

      {/* Distance Rings */}
      {rings.map((r) => (
        <group key={r}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r * SCALE - 0.3, r * SCALE, 128]} />
            <meshBasicMaterial color="#1e293b" transparent opacity={0.6} />
          </mesh>
          <Text
            position={[r * SCALE, 0.2, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={10}
            color="#cbd5e1"
            anchorX="center"
            anchorY="bottom"
          >
            {formatAltitude(r)}
          </Text>
        </group>
      ))}

      {/* Cardinal Axes Lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size * 2, 0.4]} />
        <meshBasicMaterial color="#334155" transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[size * 2, 0.4]} />
        <meshBasicMaterial color="#334155" transparent opacity={0.5} />
      </mesh>

      {/* Cardinal Labels */}
      <Text position={[0, 0.5, size * 0.9]} rotation={[-Math.PI / 2, 0, 0]} fontSize={32} color="#f8fafc" fontWeight="black">N</Text>
      <Text position={[0, 0.5, -size * 0.9]} rotation={[-Math.PI / 2, 0, 0]} fontSize={32} color="#f8fafc" fontWeight="black">S</Text>
      <Text position={[size * 0.9, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={32} color="#f8fafc" fontWeight="black">E</Text>
      <Text position={[-size * 0.9, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={32} color="#f8fafc" fontWeight="black">W</Text>
    </group>
  );
};

const TimeMarkers = ({ 
  points, 
  selectedIdx, 
  onSelect 
}: { 
  points: TrajectoryPoint[]; 
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
}) => {
  return (
    <group>
      {points.map((p, i) => {
        if (i === 0) return null; // Skip start as it has its own marker
        
        const showLabel = i % 2 === 0 || i === points.length - 1;
        const isSelected = selectedIdx === i;
        
        return (
          <group key={i} position={[p.x * SCALE, p.z * SCALE + SURFACE_OFFSET, p.y * SCALE]}>
            <mesh 
              onClick={(e) => { e.stopPropagation(); onSelect(i); }}
              onPointerOver={() => (document.body.style.cursor = 'pointer')}
              onPointerOut={() => (document.body.style.cursor = 'auto')}
            >
              <sphereGeometry args={[isSelected ? 3.5 : 2.2, 16, 16]} />
              <meshStandardMaterial 
                color={isSelected ? "#facc15" : (showLabel ? "#22d3ee" : "#94a3b8")} 
                emissive={isSelected ? "#facc15" : (showLabel ? "#22d3ee" : "#000")}
                emissiveIntensity={isSelected ? 1.2 : (showLabel ? 0.8 : 0)}
                transparent 
                opacity={isSelected ? 1.0 : (showLabel ? 1.0 : 0.7)} 
              />
            </mesh>
            <Html center distanceFactor={5} style={{ pointerEvents: 'none' }} position={[0, 5, 0]}>
              <div className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${isSelected ? 'scale-125' : ''}`}>
                <div className={`flex flex-col items-center justify-center rounded-2xl border-2 px-4 py-2 shadow-[0_0_30px_rgba(0,0,0,0.6)] backdrop-blur-2xl ${isSelected ? 'border-yellow-400 bg-yellow-950/90' : (showLabel ? 'border-cyan-400 bg-cyan-950/90' : 'border-slate-400 bg-slate-900/95')}`}>
                  <span className={`text-2xl font-black leading-none ${isSelected ? 'text-yellow-200' : (showLabel ? 'text-cyan-200' : 'text-slate-100')}`}>
                    #{i}
                  </span>
                  {showLabel && !isSelected && (
                     <span className="mt-1.5 text-base font-black text-white whitespace-nowrap tracking-tight">
                       {Math.round(p.z)} m
                     </span>
                  )}
                </div>
                {/* Pointer arrow */}
                <div className={`h-3 w-3 rotate-45 border-r-2 border-b-2 ${isSelected ? 'border-yellow-400 bg-yellow-950/90' : (showLabel ? 'border-cyan-400 bg-cyan-950/90' : 'border-slate-400 bg-slate-900/95')}`} style={{ marginTop: '-8px' }} />
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

const AltitudeAxis = ({
  height,
  ticks,
  position,
}: {
  height: number;
  ticks: number[];
  position: [number, number, number];
}) => (
  <group position={position}>
    {/* Main Axis Line */}
    <mesh position={[0, height / 2, 0]}>
      <boxGeometry args={[0.5, height, 0.5]} />
      <meshStandardMaterial color="#475569" />
    </mesh>
    
    {/* Ticks and Labels */}
    {ticks.map((value) => {
      const y = value * SCALE + SURFACE_OFFSET;
      return (
        <group key={value}>
          <mesh position={[1.5, y, 0]}>
            <boxGeometry args={[3, 0.2, 0.2]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
          <Text
            position={[4, y, 0]}
            fontSize={10}
            color="#cbd5e1"
            anchorX="left"
            anchorY="middle"
          >
            {formatAltitude(value)}
          </Text>
        </group>
      );
    })}
    <Text position={[0, height + 5, 0]} fontSize={10} color="#e2e8f0" fontWeight="bold" anchorX="center">
      ALT (m)
    </Text>
  </group>
);

const SceneLighting = () => (
  <>
    <ambientLight intensity={1.2} />
    <directionalLight position={[50, 200, 100]} intensity={1.5} color="#ffffff" castShadow />
    <pointLight position={[-50, 100, -50]} intensity={0.5} color="#38bdf8" />
  </>
);

type PibalSceneProps = {
  points: TrajectoryPoint[];
  levels: PibalLevel[];
  selectedIdx: number | null;
  onSelect: (idx: number | null) => void;
};

export function PibalScene({ points, levels, selectedIdx, onSelect }: PibalSceneProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const { maxAltitude, maxHorizontal } = useMemo(() => {
    if (!points.length) return { maxAltitude: 0, maxHorizontal: 0 };
    let mAlt = 0;
    let mHoriz = 0;
    points.forEach((point) => {
      if (point.z > mAlt) mAlt = point.z;
      const horiz = Math.hypot(point.x, point.y);
      if (horiz > mHoriz) mHoriz = horiz;
    });
    return { maxAltitude: mAlt, maxHorizontal: mHoriz };
  }, [points]);

  // Adjust ground size to ensure everything fits comfortably
  const groundRadius = Math.max(5000, maxHorizontal * 1.1); 
  const groundSizeUnits = groundRadius * SCALE;
  
  const axisHeightMeters = Math.max(5000, Math.ceil((maxAltitude + 100) / 250) * 250);
  const axisTicks = useMemo(() => {
    const step = axisHeightMeters > 5000 ? 1000 : axisHeightMeters > 2000 ? 500 : 250;
    const values: number[] = [];
    for (let alt = step; alt <= axisHeightMeters; alt += step) values.push(alt);
    return values;
  }, [axisHeightMeters]);
  const axisHeightUnits = axisHeightMeters * SCALE + SURFACE_OFFSET;

  const linePoints = useMemo<[number, number, number][]>(() => {
    return points.map((point) => [
      point.x * SCALE,
      point.z * SCALE + SURFACE_OFFSET,
      point.y * SCALE,
    ]);
  }, [points]);

  const trajectoryCurve = useMemo(() => {
    if (linePoints.length < 2) return null;
    return new CatmullRomCurve3(linePoints.map(([x, y, z]) => new Vector3(x, y, z)));
  }, [linePoints]);

  const startPoint = linePoints[0];
  const endPoint = linePoints[linePoints.length - 1];
  const hasPath = Boolean(trajectoryCurve);

  const minDistance = 5;
  const maxDistance = Math.max(groundSizeUnits * 4, axisHeightUnits * 4, 500);

  const defaultTarget = useMemo<[number, number, number]>(() => [0, axisHeightUnits / 4, 0], [axisHeightUnits]);
  const defaultCamPos = useMemo<[number, number, number]>(() => [
    groundSizeUnits * 1.2 + 5,
    axisHeightUnits * 1.0 + 10,
    groundSizeUnits * 1.2 + 5,
  ], [groundSizeUnits, axisHeightUnits]);

  // Handle camera focus on selection
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (selectedIdx !== null) {
      const p = points[selectedIdx];
      const targetX = p.x * SCALE;
      const targetY = p.z * SCALE + SURFACE_OFFSET;
      const targetZ = p.y * SCALE;

      // Focus camera on the selected point
      controls.target.set(targetX, targetY, targetZ);
      // Position camera slightly offset from the point for a good view
      controls.object.position.set(targetX + 35, targetY + 20, targetZ + 35);
    } else {
      // Return to default view
      controls.target.set(...defaultTarget);
      controls.object.position.set(...defaultCamPos);
    }
    controls.update();
  }, [selectedIdx, points, defaultTarget, defaultCamPos]);

  const handleResetView = () => {
    onSelect(null);
  };

  const applyZoom = (direction: "in" | "out") => {
    const controls = controlsRef.current;
    if (!controls) return;
    const dollyScale = direction === "in" ? 0.8 : 1.25;
    if (typeof controls.dollyIn === "function" && typeof controls.dollyOut === "function") {
      if (direction === "in") controls.dollyIn(dollyScale);
      else controls.dollyOut(dollyScale);
      controls.update();
      return;
    }
    const manualVector = new Vector3();
    const { object, target } = controls;
    const scale = direction === "in" ? 0.85 : 1.15;
    manualVector.copy(object.position).sub(target).multiplyScalar(scale);
    object.position.copy(manualVector.add(target));
    controls.update();
  };

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-slate-900 via-[#0f172a] to-black shadow-inner">
      {hasPath ? (
        <div className="pointer-events-auto absolute left-4 top-4 z-10 hidden sm:block">
          <div className="rounded-xl bg-slate-950/60 px-4 py-3 text-xs text-slate-300 backdrop-blur-md border border-white/10 shadow-2xl">
            <p className="flex items-center gap-2 mb-1.5 font-bold text-cyan-400">
              <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
              Mode Navigasi Interaktif
            </p>
            <div className="space-y-1 opacity-80">
              <p>📍 Klik titik untuk zoom & detail data</p>
              <p>🖱️ Klik Kanan / 2 Jari untuk Geser (Pan)</p>
              <p>🔄 Klik Tengah / Drag untuk Putar</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Info Overlay (Fixed Bottom Left) */}
      {selectedIdx !== null && points[selectedIdx] && (
        <div className="pointer-events-auto absolute bottom-4 left-4 z-20 max-w-[320px] animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-white/20 bg-slate-950/80 p-6 shadow-[0_0_40px_rgba(0,0,0,0.7)] backdrop-blur-xl text-slate-100">
            <button 
              onClick={() => onSelect(null)}
              className="absolute right-3 top-3 rounded-full p-1.5 hover:bg-white/10 text-slate-400 transition-colors"
            >
              <X className="size-5" />
            </button>
            
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-black mb-0.5">
                Level #{selectedIdx} {selectedIdx === points.length - 1 ? '• FINAL' : ''}
              </p>
              <h4 className="text-xl font-black tracking-tight">
                {selectedIdx === points.length - 1 ? 'Ringkasan Penerbangan' : 'Info Pengamatan'}
              </h4>
            </div>

            <div className="grid gap-3 text-sm">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-slate-400 font-medium">Altitude</span>
                <span className="text-lg font-black text-cyan-300">{Math.round(points[selectedIdx].z)} m</span>
              </div>

              {selectedIdx === points.length - 1 && (
                <>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-slate-400 font-medium">Total Drift</span>
                    <span className="text-lg font-black text-orange-400">{Math.round(Math.hypot(points[selectedIdx].x, points[selectedIdx].y))} m</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-slate-400 font-medium">Durasi</span>
                    <span className="text-lg font-black text-blue-400">{Math.round(((points.length - 1) * DEFAULT_TIME_STEP) / 60)} menit</span>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-0.5 border-b border-white/5 pb-2">
                <span className="text-slate-400 font-medium text-[10px] uppercase tracking-wider">Koordinat</span>
                <span className="text-xs font-mono font-bold text-white">
                  {(STATION_INFO.latitude + (points[selectedIdx].y / 111320)).toFixed(5)}, 
                  {(STATION_INFO.longitude + (points[selectedIdx].x / (111320 * Math.cos(STATION_INFO.latitude * Math.PI / 180)))).toFixed(5)}
                </span>
              </div>

              {levels[selectedIdx - 1] && (
                <>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-slate-400 font-medium">Arah Angin</span>
                    <span className="text-lg font-black text-white">{levels[selectedIdx - 1].directionDeg}°</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Kecepatan</span>
                    <span className="text-lg font-black text-emerald-400">{levels[selectedIdx - 1].speedMps} m/s</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {hasPath ? (
        <div className="pointer-events-auto absolute right-4 top-4 z-10 flex flex-col gap-2">
          <Button size="sm" variant="secondary" className="bg-slate-800/80 text-white backdrop-blur hover:bg-slate-700 font-bold border border-white/10" onClick={handleResetView}>
            Reset View
          </Button>
          <div className="flex gap-2">
            <Button size="icon" variant="secondary" className="bg-slate-800/80 text-white backdrop-blur hover:bg-slate-700 border border-white/10" onClick={() => applyZoom("in")}>
              +
            </Button>
            <Button size="icon" variant="secondary" className="bg-slate-800/80 text-white backdrop-blur hover:bg-slate-700 border border-white/10" onClick={() => applyZoom("out")}>
              −
            </Button>
          </div>
        </div>
      ) : null}
      
      {!hasPath ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
          <p>Belum ada lintasan yang bisa digambar.</p>
          <p>Masukkan kode PIBAL lalu klik &ldquo;Generate Model&rdquo;.</p>
        </div>
      ) : null}

      <Canvas shadows camera={{ position: defaultCamPos, fov: 50, near: 0.1, far: 8000 }} onPointerMissed={() => onSelect(null)}>
        <color attach="background" args={["#020617"]} />
        <fog attach="fog" args={["#020617", maxDistance * 0.5, maxDistance * 2]} />
        <Suspense fallback={null}>
          <SceneLighting />
          
          <PolarGrid size={groundSizeUnits} maxDist={groundRadius} />
          
          <AltitudeAxis
            height={axisHeightUnits}
            ticks={axisTicks}
            position={[-groundSizeUnits - 10, 0, -groundSizeUnits - 10]}
          />

          {hasPath && trajectoryCurve ? (
            <>
              {/* Trajectory Tube */}
              <mesh castShadow receiveShadow>
                <tubeGeometry
                  args={[
                    trajectoryCurve,
                    Math.max(100, linePoints.length * 10),
                    TRAJECTORY_RADIUS,
                    24,
                    false,
                  ]}
                />
                <meshStandardMaterial 
                  color="#06b6d4" 
                  emissive="#0891b2" 
                  emissiveIntensity={0.8}
                  roughness={0.2}
                  metalness={0.8}
                />
              </mesh>
              
              {/* Time Markers */}
              <TimeMarkers 
                points={points} 
                selectedIdx={selectedIdx}
                onSelect={onSelect}
              />

              {/* Start/End Markers */}
              {startPoint ? <Marker position={startPoint} color="#3b82f6" label="START" /> : null}
              {endPoint ? (
                <Marker
                  position={endPoint}
                  color="#f97316"
                  label={`TOP • ${formatAltitude(points[points.length - 1]?.z ?? 0)}`}
                />
              ) : null}
            </>
          ) : null}

          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.05}
            enablePan={true}
            screenSpacePanning={true}
            panSpeed={1.2}
            rotateSpeed={1.0}
            enableZoom={true}
            minDistance={minDistance}
            maxDistance={maxDistance}
            maxPolarAngle={Math.PI / 2.1} 
            target={defaultTarget}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}