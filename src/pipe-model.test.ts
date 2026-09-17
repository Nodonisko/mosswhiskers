import { expect, test } from "bun:test";
import {
  bulgeTableFor,
  fillBulgeTable,
  GULP_SOUND_LEAD,
  intakeGulpIndex,
  PIPE_BALL_COUNT,
  PIPE_BALL_SPEED,
} from "./pipe-model";

const BULGE_WIDTH = 26;
const BULGE_HEIGHT = 14;

/** The exact curve the lookup table replaces. */
function exactBulgeAt(along: number, length: number, elapsed: number) {
  const wrapped = ((elapsed * PIPE_BALL_SPEED) % length + length) % length;
  const spacing = length / PIPE_BALL_COUNT;
  let extra = 0;
  for (let ball = 0; ball < PIPE_BALL_COUNT; ball++) {
    const pos = (wrapped + ball * spacing) % length;
    let delta = Math.abs(along - pos);
    delta = Math.min(delta, length - delta);
    extra = Math.max(extra, Math.exp(-((delta / BULGE_WIDTH) ** 2)) * BULGE_HEIGHT);
  }
  return extra;
}

test("gulp index ticks each time a swallow reaches the intake", () => {
  const length = 1000;
  const period = length / PIPE_BALL_COUNT / PIPE_BALL_SPEED;
  expect(intakeGulpIndex(0, length, 0)).toBe(0);
  expect(intakeGulpIndex(period - 0.001, length, 0)).toBe(0);
  expect(intakeGulpIndex(period, length, 0)).toBe(1);
  expect(intakeGulpIndex(period * 2, length, 0)).toBe(2);
});

test("gulp sound leads the swallow peak", () => {
  const length = 1000;
  const period = length / PIPE_BALL_COUNT / PIPE_BALL_SPEED;
  expect(intakeGulpIndex(period - GULP_SOUND_LEAD, length)).toBe(1);
  expect(intakeGulpIndex(period - GULP_SOUND_LEAD - 0.001, length)).toBe(0);
});

test("the bulge table stays within a third of a texel of the exact curve", () => {
  const length = 2270.9;
  const bulge = bulgeTableFor(length);
  let worst = 0;
  for (let step = 0; step < 120; step++) {
    const elapsed = step * 0.0173;
    fillBulgeTable(bulge, length, elapsed);
    for (let along = 0; along <= length; along += 0.37) {
      const table = bulge[(along * 2) | 0]!;
      worst = Math.max(worst, Math.abs(exactBulgeAt(along, length, elapsed) - table));
    }
  }
  // The strip is painted at two world units per texel.
  expect(worst / 2).toBeLessThan(1 / 3);
});
