import { DEFAULT_TIME_STEP } from "./pibalDefaults";

export type PibalLevel = {
  minute: number;
  directionDeg: number;
  speedMps: number;
};

const SLASH_FORMAT = /^(\d{2,3})\/(\d{2,3})$/;
const PART_HEADER = /^PP[A-D][A-D]$/; 
const FIVE_DIGIT_GROUP = /^\d{5}$/;

const KNOTS_TO_MPS = 0.514444;
const MINUTES_PER_STEP = DEFAULT_TIME_STEP / 60;

/**
 * Decodes a wind group with Heuristic for Local vs WMO format.
 * 
 * WMO Standard: ddfff (2-dir, 3-speed)
 * Local Hybrid: dddff (3-dir, 2-speed)
 */
const parseWindGroup = (token: string): { dir: number, speed: number } | null => {
  if (SLASH_FORMAT.test(token)) {
    const match = token.match(SLASH_FORMAT);
    if (!match) return null;
    const d = parseInt(match[1], 10);
    const s = parseInt(match[2], 10);
    return { dir: d > 36 ? d : d * 10, speed: s };
  } 
  
  if (FIVE_DIGIT_GROUP.test(token)) {
    const val = parseInt(token, 10);
    if (val === 77999) return null;

    // --- HEURISTIC ANALYSIS ---
    
    // 1. Try WMO Standard (ddfff)
    const wmoDirPart = Math.floor(val / 1000);
    const wmoSpeedPart = val % 1000;
    
    let wmoDir = wmoDirPart * 10;
    let wmoSpeed = wmoSpeedPart;

    if (wmoDirPart > 50 && wmoDirPart <= 86) {
      wmoDir = (wmoDirPart - 50) * 10;
      wmoSpeed = wmoSpeedPart + 100;
    }

    // 2. Try Local Format (dddff) - 3 digits direction, 2 digits speed
    const locDir = Math.floor(val / 100);
    const locSpeed = val % 100;

    // Decision Logic:
    // If WMO speed is insane (> 150 knots) AND local direction is valid (<= 360),
    // it's almost certainly the local dddff format.
    if (wmoSpeed > 150 && locDir <= 360) {
      return { dir: locDir, speed: locSpeed };
    }

    // Otherwise, if WMO direction is valid, use WMO
    if (wmoDirPart <= 86) {
      return { dir: wmoDir, speed: wmoSpeed };
    }
    
    // Fallback to local if WMO is totally invalid (> 86) but local is valid
    if (locDir <= 360) {
        return { dir: locDir, speed: locSpeed };
    }
  }

  return null;
};

export const parsePibal = (raw: string): PibalLevel[] => {
  const tokens = raw
    .replace(/=/g, " ")
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter(Boolean);

  const levels: PibalLevel[] = [];
  let isKnots = false; 
  let skipCounter = 0; 
  let parsingAllowed = true; 

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === "NIL") break;

    if (PART_HEADER.test(token)) {
      const section = token.charAt(3);
      // For development, we allow PPBB if they look like wind groups 
      // but we filter out the '9xxxx' markers inside parseWindGroup or here.
      parsingAllowed = true; 
      skipCounter = 2; 
      continue;
    }

    if (skipCounter > 0) {
      if (skipCounter === 2 && FIVE_DIGIT_GROUP.test(token)) {
        const val = parseInt(token, 10);
        isKnots = Math.floor(val / 1000) > 50; 
      }
      skipCounter--;
      continue;
    }

    // Filter Height Markers (9xxxx) explicitly for Part B
    if (FIVE_DIGIT_GROUP.test(token) && token.startsWith('9')) {
        continue;
    }

    if (parsingAllowed) {
        const wind = parseWindGroup(token);
        if (wind) {
            levels.push({
                minute: levels.length * MINUTES_PER_STEP,
                directionDeg: wind.dir,
                speedMps: isKnots ? wind.speed * KNOTS_TO_MPS : wind.speed
            });
        }
    }
  }

  return levels;
};
