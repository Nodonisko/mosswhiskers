import { lakeContainsLocalPoint } from "./lake-shape";

/** Remaining water occupies the inner fraction of the dried basin. Cats walk the mud. */
export const POND_PUDDLE_RATIO = 0.38;

export function pondBasinContains(
  width: number,
  height: number,
  phase: number,
  localX: number,
  localY: number,
  padding = 0,
) {
  return lakeContainsLocalPoint(width, height, phase, localX, localY, padding);
}

export function pondPuddleContains(
  width: number,
  height: number,
  phase: number,
  localX: number,
  localY: number,
  padding = 0,
) {
  return lakeContainsLocalPoint(
    width * POND_PUDDLE_RATIO,
    height * POND_PUDDLE_RATIO,
    phase,
    localX,
    localY,
    padding,
  );
}

/** Walkable mud ringing the remaining water. */
export function onPuddleShore(
  width: number,
  height: number,
  phase: number,
  localX: number,
  localY: number,
  band = 64,
) {
  if (pondPuddleContains(width, height, phase, localX, localY)) return false;
  return pondPuddleContains(width, height, phase, localX, localY, band);
}
