import { describe, expect, test } from "bun:test";
import { lakeContainsLocalPoint, lakePhaseFromSeed } from "./lake-shape";
import { LAKE_SEED } from "./world-config";

describe("lakeContainsLocalPoint", () => {
  const phase = lakePhaseFromSeed(LAKE_SEED);

  test("the center is water", () => {
    expect(lakeContainsLocalPoint(900, 520, phase, 0, 0)).toBe(true);
  });

  test("a far point is shore", () => {
    expect(lakeContainsLocalPoint(900, 520, phase, 2000, 0)).toBe(false);
  });

  test("padding expands the bank", () => {
    expect(lakeContainsLocalPoint(900, 520, phase, 460, 0, 0)).toBe(false);
    expect(lakeContainsLocalPoint(900, 520, phase, 460, 0, 80)).toBe(true);
  });
});
