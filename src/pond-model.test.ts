import { describe, expect, test } from "bun:test";
import { lakePhaseFromSeed } from "./lake-shape";
import { pondBasinContains, pondPuddleContains } from "./pond-shape";
import { BERNIE_POND_HEIGHT, BERNIE_POND_SEED, BERNIE_POND_WIDTH } from "./world-config";

describe("dried pond contains", () => {
  const phase = lakePhaseFromSeed(BERNIE_POND_SEED);
  const width = BERNIE_POND_WIDTH;
  const height = BERNIE_POND_HEIGHT;

  test("the center is remaining puddle", () => {
    expect(pondPuddleContains(width, height, phase, 0, 0)).toBe(true);
    expect(pondBasinContains(width, height, phase, 0, 0)).toBe(true);
  });

  test("a mid-radius point is mud, not water", () => {
    const x = width * 0.28;
    expect(pondBasinContains(width, height, phase, x, 0)).toBe(true);
    expect(pondPuddleContains(width, height, phase, x, 0)).toBe(false);
  });

  test("a far point is outside the basin", () => {
    expect(pondBasinContains(width, height, phase, 2000, 0)).toBe(false);
    expect(pondPuddleContains(width, height, phase, 2000, 0)).toBe(false);
  });
});
