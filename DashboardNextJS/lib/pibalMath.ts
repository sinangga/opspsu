export type PibalReading = {
  minute: number;
  azimuth: number; // Degrees (0-360)
  elevation: number; // Degrees (-90 to 90)
};

export type WindData = {
  minute: number;
  height: number; // meters
  speed: number; // knots
  direction: number; // degrees
};

const MPS_TO_KNOTS = 1.94384;

/**
 * Calculates wind data from balloon trajectory.
 * @param readings List of readings (minute, azimuth, elevation)
 * @param ascentRate Ascent rate in meters/minute (Note: PibalForm uses m/s, usually 300m/min or 5m/s)
 *                   If passed in m/s, multiply by 60 before calling or adjust math.
 *                   Standard default is 300 m/min (5 m/s).
 */
export const calculateWindProfile = (
  readings: PibalReading[],
  ascentRateMps: number
): WindData[] => {
  // Sort by minute
  const sorted = [...readings].sort((a, b) => a.minute - b.minute);
  
  const results: WindData[] = [];

  // Previous position (Start at 0,0,0)
  let prevX = 0;
  let prevY = 0;
  let prevTime = 0; // minutes

  for (const reading of sorted) {
    // Skip minute 0 (Release point)
    if (reading.minute <= 0) continue;

    const t = reading.minute; // minutes
    const dt = (t - prevTime) * 60; // seconds (Time difference in seconds) 
    
    if (dt <= 0) continue;

    // Height at time t
    const z = ascentRateMps * t * 60; // meters

    // Horizontal distance (projection)
    // D = z / tan(elevation)
    // Elevation is in degrees.
    // If Elev -> 90 (Zenith), tan -> Inf, D -> 0.
    // If Elev -> 0 (Horizon), tan -> 0, D -> Inf.
    
    let elevDeg = reading.elevation;
    // Clamp elevation to avoid singularities
    if (elevDeg < 0.1) elevDeg = 0.1; // Avoid horizon div/0
    if (elevDeg > 89.9) elevDeg = 89.9; // Avoid zenith tan singularity

    const elevRad = (elevDeg * Math.PI) / 180;
    const azRad = (reading.azimuth * Math.PI) / 180;

    // Distance on ground
    // Standard Pibal: cot(elev) = 1/tan(elev)
    const D = z / Math.tan(elevRad);

    // Position (North = Y, East = X)
    // Azimuth 0 = North, 90 = East
    // x = D * sin(az)
    // y = D * cos(az)
    const x = D * Math.sin(azRad);
    const y = D * Math.cos(azRad);

    // Velocity vector of balloon (which equals wind vector)
    const vx = (x - prevX) / dt; // m/s
    const vy = (y - prevY) / dt; // m/s

    // Wind Speed
    const speedMps = Math.sqrt(vx * vx + vy * vy);
    const speedKnots = speedMps * MPS_TO_KNOTS;

    // Wind Direction (Coming From)
    // Balloon Move Direction = atan2(vy, vx)
    // Wind From = Move Dir + 180
    // Math atan2(y,x) is angle from East.
    // But we used x=sin, y=cos (North based).
    // So atan2(x, y) gives angle from North (Y-axis)? 
    // atan2(x, y) in JS is atan2(y, x).
    // Let's use standard:
    // Angle from North CW = atan2(x, y)
    // JS Math.atan2(y, x) returns angle from X-axis CCW.
    // Our X is East. Y is North.
    // theta = atan2(x, y) -> (sin, cos) -> tan = x/y = sin/cos.
    // atan2(x, y) gives the angle relative to Y axis (North).
    // If x>0, y>0 (NE): atan2(+, +) -> 0..PI/2.
    // Correct.
    
    const moveDirRad = Math.atan2(x - prevX, y - prevY);
    let moveDirDeg = moveDirRad * (180 / Math.PI);
    if (moveDirDeg < 0) moveDirDeg += 360;

    // Wind Coming From = Moving Towards + 180
    const windDir = (moveDirDeg + 180) % 360;

    results.push({
      minute: t,
      height: z,
      speed: Math.round(speedKnots),
      direction: Math.round(windDir),
    });

    prevX = x;
    prevY = y;
    prevTime = t;
  }

  return results;
};

export const encodePibal = (data: WindData[]): string => {
  if (data.length === 0) return "";
  
  return data.map(d => {
    let dd = Math.round(d.direction / 10);
    let fff = Math.round(d.speed);

    if (dd === 0) dd = 36; // 360 degrees
    if (dd > 36) dd = dd % 36; // Safety

    // Handle high speeds (>99 knots)
    if (fff > 99) {
      dd += 50;
      fff -= 100;
    }
    
    // Safety clamp
    if (fff > 199) fff = 199; 

    const ddStr = dd.toString().padStart(2, '0');
    const fffStr = fff.toString().padStart(3, '0');
    
    // Format: MM ddfff (Minute = ddfff)
    // Or just ddfff per line
    return `${d.minute.toFixed(2)}' = ${ddStr}${fffStr}`;
  }).join('\n');
};