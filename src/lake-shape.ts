import { seeded } from "./rng";

export function lakePhaseFromSeed(seed: number) {
  return seeded(seed)() * Math.PI * 2;
}

export function lakeShoreRadius(angle: number, phase: number) {
  return 0.855 + Math.sin(angle * 3 + phase) * 0.055
    + Math.sin(angle * 5 - 0.8) * 0.024
    + Math.cos(angle * 2 + 0.4) * 0.033
    + Math.sin(angle * 9 + 1.1) * 0.009;
}

/** Coordinates are relative to the lake center; positive padding includes the bank. */
export function lakeContainsLocalPoint(
  width: number,
  height: number,
  phase: number,
  localX: number,
  localY: number,
  padding = 0,
) {
  const distance = Math.hypot(localX, localY);
  if (distance === 0) return true;
  const nx = localX / (width / 2);
  const ny = localY / (height / 2);
  const ratio = Math.hypot(nx, ny) / lakeShoreRadius(Math.atan2(ny, nx), phase);
  return distance <= distance / ratio + padding;
}
