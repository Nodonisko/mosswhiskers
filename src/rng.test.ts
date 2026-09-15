import { describe, expect, test } from "bun:test";
import { seeded } from "./rng";

describe("seeded", () => {
  test("the same seed replays the same sequence", () => {
    const a = seeded(1987);
    const b = seeded(1987);
    const first = Array.from({ length: 8 }, () => a());
    const second = Array.from({ length: 8 }, () => b());
    expect(second).toEqual(first);
  });

  test("different seeds diverge", () => {
    expect(seeded(1)()).not.toBe(seeded(2)());
  });

  test("values stay in [0, 1)", () => {
    const random = seeded(42);
    for (let i = 0; i < 40; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
