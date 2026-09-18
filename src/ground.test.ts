import { describe, expect, test } from "bun:test";
import {
  farmPlotGround,
  groundKindAt,
  GROUND_KINDS,
  GROUND_TILE,
  parseGroundMarks,
  groundPixel,
  sampleGround,
  brushRadius,
  brushWorldSize,
  makeDisk,
} from "./ground";
import { FARM, FARM_CARROTS, FARM_SHED } from "./world-config";
import { WORLD_GROUND } from "./world-props";

describe("ground marks", () => {
  test("Hopsk's field is ordinary furrow stamps under every carrot", () => {
    const marks = farmPlotGround();
    expect(marks.length).toBeGreaterThan(20);
    expect(marks.every((mark) => mark.kind === "furrow" && mark.r === brushRadius(1))).toBe(true);
    expect(WORLD_GROUND).toEqual(marks);
    for (const crop of FARM_CARROTS) {
      expect(groundKindAt(marks, crop.x, crop.y)).toBe("furrow");
    }
    expect(groundKindAt(marks, FARM.x, FARM.y)).toBe("furrow");
    expect(groundKindAt(marks, FARM_SHED.x, FARM_SHED.y)).toBeUndefined();
  });

  test("brush sizes are circles matching the preview", () => {
    expect(brushRadius(1)).toBe(GROUND_TILE);
    expect(brushRadius(2)).toBe(GROUND_TILE * 2);
    expect(brushRadius(3)).toBe(GROUND_TILE * 3);
    expect(brushWorldSize(2)).toBeGreaterThan(brushRadius(2) * 2);
  });

  test("each ground kind paints a distinct dirt color", () => {
    const samples = GROUND_KINDS.map((kind) => groundPixel(kind, FARM.x, FARM.y).join(","));
    expect(new Set(samples).size).toBe(GROUND_KINDS.length);
    const [r, g, b, a] = groundPixel("furrow", FARM.x, FARM.y);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(a).toBeGreaterThan(100);
  });

  test("a brush stamp is one circle, not a cluster of tiles", () => {
    const radius = brushRadius(1);
    const stamp = [{ kind: "dirt" as const, x: 0, y: 0, r: radius }];
    expect(sampleGround(stamp, 0, 0)).toEqual({ kind: "dirt", alpha: 1 });
    expect(sampleGround(stamp, radius * 0.4, 0)?.alpha).toBe(1);
    expect(sampleGround(stamp, radius * 2.2, 0)).toBeUndefined();
    expect(sampleGround(stamp, radius * 0.5, 0)?.kind).toBe("dirt");
    expect(sampleGround(stamp, radius * 1.4, radius * 1.4)).toBeUndefined();

    const fringe = sampleGround(stamp, radius, 0);
    expect(fringe?.kind).toBe("dirt");
    expect(fringe?.alpha).toBeGreaterThan(0.4);
    expect(fringe?.alpha).toBeLessThan(1);

    const outerFringe = sampleGround(stamp, radius * 1.4, 0);
    expect(outerFringe?.kind).toBe("dirt");
    expect(outerFringe?.alpha).toBeGreaterThan(0.02);
    expect(outerFringe!.alpha).toBeLessThan(fringe!.alpha * 0.4);
  });

  test("later stamps replace earlier ones, and erase punches a matching circle", () => {
    const field = farmPlotGround();
    const painted = [
      ...field,
      { kind: "moss" as const, x: FARM.x, y: FARM.y, r: 30 },
    ];
    expect(groundKindAt(painted, FARM.x, FARM.y)).toBe("moss");
    expect(groundKindAt(painted, FARM.x + 80, FARM.y)).toBe("furrow");
    const erased = [
      ...painted,
      { kind: "erase" as const, x: FARM.x, y: FARM.y, r: 20 },
    ];
    expect(groundKindAt(erased, FARM.x, FARM.y)).toBeUndefined();
    expect(groundKindAt(erased, FARM.x + 80, FARM.y)).toBe("furrow");
  });

  test("parseGroundMarks keeps disks and old tiles, and drops junk", () => {
    expect(parseGroundMarks([
      { x: 12, y: 8, r: 24, kind: "moss" },
      { tx: 2, ty: 3, kind: "mud" },
      { kind: "dirt" },
      { x: 1, y: 2, kind: "water", r: 9 },
    ])).toEqual([
      { x: 12, y: 8, r: 24, kind: "moss" },
      { x: 60, y: 84, r: 24, kind: "mud" },
    ]);
  });

  test("thin washes keep their opacity and stack", () => {
    const wash = [makeDisk(0, 0, 24, "dirt", 0.4)];
    expect(sampleGround(wash, 0, 0)).toEqual({ kind: "dirt", alpha: 0.4 });
    const stacked = [...wash, makeDisk(0, 0, 24, "dirt", 0.4)];
    expect(sampleGround(stacked, 0, 0)?.alpha).toBeCloseTo(0.64);
  });

  test("softness stretches the fade, hardness keeps a tight rim", () => {
    const radius = brushRadius(1);
    const hard = [makeDisk(0, 0, radius, "dirt", 1, 0)];
    const soft = [makeDisk(0, 0, radius, "dirt", 1, 1)];
    expect(sampleGround(hard, radius * 0.5, 0)?.alpha).toBe(1);
    expect(sampleGround(hard, radius * 1.2, 0)).toBeUndefined();
    expect(sampleGround(soft, radius * 1.2, 0)?.alpha).toBeGreaterThan(0.05);
    expect(sampleGround(soft, radius * 1.95, 0)).toBeUndefined();
    expect(brushWorldSize(1, 1)).toBeGreaterThan(brushWorldSize(1, 0));
  });

  test("parseGroundMarks keeps opacity and softness", () => {
    expect(parseGroundMarks([
      { x: 12, y: 8, r: 24, kind: "moss", opacity: 0.4, softness: 0.2 },
    ])).toEqual([
      { x: 12, y: 8, r: 24, kind: "moss", opacity: 0.4, softness: 0.2 },
    ]);
  });
});
