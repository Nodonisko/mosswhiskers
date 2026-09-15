import { describe, expect, test } from "bun:test";
import { lakeContainsLocalPoint, lakePhaseFromSeed } from "./lake-shape";
import { pondBasinContains } from "./pond-shape";
import { createWalkable, createWorldLayout, isBernieWoods } from "./world";
import {
  BERNIE_HUT,
  BERNIE_POND_HEIGHT,
  BERNIE_POND_SEED,
  BERNIE_POND_WIDTH,
  BERNIE_POND_X,
  BERNIE_POND_Y,
  berniePathPoints,
  LAKE_HEIGHT,
  LAKE_SEED,
  LAKE_WIDTH,
  LAKE_X,
  LAKE_Y,
  MAILBOX,
  MAP_WIDTH,
  PIER_X,
  PIER_Y,
} from "./world-config";

describe("createWorldLayout", () => {
  test("the same seed produces the same props, mice, and fish", () => {
    const a = createWorldLayout();
    const b = createWorldLayout();
    expect(a.props).toEqual(b.props);
    expect(a.mice).toEqual(b.mice);
    expect(a.fish).toEqual(b.fish);
    expect(a.trunks).toEqual(b.trunks);
    expect(a.interactables).toEqual(b.interactables);
    expect(a.mice.length).toBeGreaterThan(0);
    expect(a.fish.map((fish) => fish.id)).toEqual([
      "fish-pike",
      "fish-perch",
      "fish-bluegill",
      "fish-pike-2",
      "fish-perch-2",
      "fish-bluegill-2",
    ]);
    expect(a.interactables).toEqual([{ id: "mailbox", kind: "mailbox", x: MAILBOX.x, y: MAILBOX.y }]);
  });

  test("lake fish stay in the water", () => {
    const layout = createWorldLayout();
    const phase = lakePhaseFromSeed(LAKE_SEED);
    expect(layout.fish).toHaveLength(6);
    for (const fish of layout.fish) {
      for (let i = 0; i < 24; i++) {
        const t = (i / 24) * Math.PI * 2;
        const x = fish.originX + Math.cos(t) * fish.radiusX;
        const y = fish.originY + Math.sin(t) * fish.radiusY;
        expect(lakeContainsLocalPoint(LAKE_WIDTH, LAKE_HEIGHT, phase, x - LAKE_X, y - LAKE_Y, -12)).toBe(true);
      }
    }
  });

  test("mice have stable ids a host can address", () => {
    const layout = createWorldLayout();
    const ids = layout.mice.map((mouse) => mouse.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("mouse-"))).toBe(true);
  });

  test("Bernie woods has a hut, sick trees, and no prey or undergrowth", () => {
    const layout = createWorldLayout();
    const hut = layout.props.find((prop) => prop.kind === "hut");
    expect(hut).toEqual(expect.objectContaining({ x: BERNIE_HUT.x, y: BERNIE_HUT.y }));

    const inWoods = layout.props.filter((prop) => isBernieWoods(prop.x, prop.y));
    expect(inWoods.some((prop) => prop.kind === "hut")).toBe(true);
    expect(inWoods.filter((prop) => prop.kind === "pine" || prop.kind === "oak").length).toBeGreaterThan(8);
    expect(inWoods.every((prop) => prop.kind === "hut" || ((prop.kind === "pine" || prop.kind === "oak") && prop.sick))).toBe(true);
    expect(inWoods.filter((prop) => prop.kind === "pine" || prop.kind === "oak").every((tree) => (
      Math.hypot(tree.x - BERNIE_HUT.x, tree.y - BERNIE_HUT.y) >= 200
    ))).toBe(true);
    expect(inWoods.some((prop) => prop.kind === "flowers" || prop.kind === "bush" || prop.kind === "log" || prop.kind === "stone")).toBe(false);

    expect(layout.mice.every((mouse) => !isBernieWoods(mouse.originX, mouse.originY))).toBe(true);
    expect(layout.fish.every((fish) => !isBernieWoods(fish.originX, fish.originY))).toBe(true);
    expect(MAP_WIDTH / 2 + BERNIE_HUT.x).toBeGreaterThan(400);
  });

  test("Bernie hut sits west of the pond and the trail does not cross the basin", () => {
    const phase = lakePhaseFromSeed(BERNIE_POND_SEED);
    const inBasin = (x: number, y: number) => pondBasinContains(
      BERNIE_POND_WIDTH,
      BERNIE_POND_HEIGHT,
      phase,
      x - BERNIE_POND_X,
      y - BERNIE_POND_Y,
    );
    expect(inBasin(BERNIE_HUT.x, BERNIE_HUT.y)).toBe(false);
    expect(BERNIE_HUT.x).toBeLessThan(BERNIE_POND_X);
    for (const [x, y] of berniePathPoints()) {
      expect(inBasin(x, y)).toBe(false);
    }
  });
});

describe("createWalkable", () => {
  const walkable = createWalkable(createWorldLayout().trunks);

  test("the colony spawn is walkable", () => {
    expect(walkable(0, -5)).toBe(true);
  });

  test("the lake interior is blocked except on the pier", () => {
    expect(walkable(LAKE_X, LAKE_Y)).toBe(false);
    expect(walkable(PIER_X, PIER_Y)).toBe(true);
  });

  test("Bernie pond water is blocked but the dried mud is walkable", () => {
    expect(walkable(BERNIE_POND_X, BERNIE_POND_Y)).toBe(false);
    expect(walkable(BERNIE_POND_X + BERNIE_POND_WIDTH * 0.32, BERNIE_POND_Y)).toBe(true);
  });

  test("Bernie hut blocks the doorway footprint", () => {
    expect(walkable(BERNIE_HUT.x, BERNIE_HUT.y)).toBe(false);
  });
});
