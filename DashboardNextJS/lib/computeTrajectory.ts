import { PibalLevel } from "./parsePibal";
import { DEFAULT_TIME_STEP } from "./pibalDefaults";

export type TrajectoryPoint = {
  x: number;
  y: number;
  z: number;
  time: number;
};

type TrajectoryOptions = {
  ascentRate: number;
  timeStep?: number;
};

const degToRad = (deg: number) => (deg * Math.PI) / 180;

export const computeTrajectory = (
  levels: PibalLevel[],
  options: TrajectoryOptions
): TrajectoryPoint[] => {
  const { ascentRate, timeStep = DEFAULT_TIME_STEP } = options;
  const points: TrajectoryPoint[] = [{ x: 0, y: 0, z: 0, time: 0 }];

  let x = 0;
  let y = 0;
  let z = 0;
  let elapsed = 0;

  levels.forEach((level) => {
    const dirRad = degToRad(level.directionDeg);
    const u = level.speedMps * Math.sin(dirRad);
    const v = level.speedMps * Math.cos(dirRad);
    const w = ascentRate;

    x += u * timeStep;
    y += v * timeStep;
    z += w * timeStep;
    elapsed += timeStep;

    points.push({
      x,
      y,
      z,
      time: elapsed,
    });
  });

  return points;
};
