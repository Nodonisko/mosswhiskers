import { describe, expect, test } from "bun:test";
import { lakeContainsLocalPoint, lakePhaseFromSeed } from "./lake-shape";
import { pondBasinContains } from "./pond-shape";
import { createWalkable, createWorldLayout, createLockedProps, inDataCenterClearing } from "./world";
import {
  BERNIE,
  BERNIE_HUT,
  BERNIE_PATH_APPROACH_Y,
  BERNIE_PATH_JOIN_X,
  BERNIE_POND_HEIGHT,
  BERNIE_POND_SEED,
  BERNIE_POND_WIDTH,
  BERNIE_POND_X,
  BERNIE_POND_Y,
  berniePathPoints,
  CAT_SCALE,
  DATA_CENTER,
  DATA_CENTER_SCALE,
  dataCenterPathPoints,
  GRETA,
  FARM,
  FARM_CARROTS,
  FARM_SHED,
  INTAKE,
  INTAKE_PIPE_END,
  intakePipePoints,
  LAKE_HEIGHT,
  LAKE_SEED,
  LAKE_WIDTH,
  LAKE_X,
  LAKE_Y,
  MAP_HEIGHT,
  MAP_WIDTH,
  mainPathY,
  nearIntakeRim,
  PIER_X,
  PIER_Y,
  RABBIT,
  SAM,
  southPathX,
  UNIQUE_NPC_KINDS,
  WOLFENBERG,
  TREE_TRUNK_HITBOX,
  isAuthorableWorldKind,
  isUniqueNpcKind,
} from "./world-config";
import { WORLD_MODEL_SIZES } from "./world-models";
import { WORLD_PROPS } from "./world-props";

describe("createWorldLayout", () => {
  test("landmarks stay in code while vegetation and NPCs come from authored props", () => {
    expect(WORLD_PROPS.every((prop) => isAuthorableWorldKind(prop.kind))).toBe(true);
    expect(createLockedProps().every((prop) => !isUniqueNpcKind(prop.kind))).toBe(true);
    const layout = createWorldLayout();
    expect(layout.props.filter((prop) => prop.kind === "bernie")).toHaveLength(1);
    expect(layout.props.filter((prop) => prop.kind === "sam")).toHaveLength(1);
    expect(layout.props.filter((prop) => prop.kind === "rabbit")).toHaveLength(1);
    expect(layout.props.filter((prop) => prop.kind === "greta")).toHaveLength(1);
    expect(layout.props.filter((prop) => prop.kind === "wolfenberg")).toHaveLength(1);
    expect(layout.props.filter((prop) => prop.kind === "hut")).toHaveLength(1);
    expect(layout.props.filter((prop) => prop.kind === "lamp")).toHaveLength(2);
    expect(layout.props.filter((prop) => prop.kind === "carrot").length).toBeGreaterThan(0);
    expect(createLockedProps().every((prop) => prop.kind !== "lamp")).toBe(true);
  });

  test("lake fish stay in the water", () => {
    const layout = createWorldLayout();
    const phase = lakePhaseFromSeed(LAKE_SEED);
    expect(layout.fish).toHaveLength(8);
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

  test("the path in front of Bernie's hut stays clear of trees", () => {
    const layout = createWorldLayout();
    const blocking = layout.props.filter((prop) => (
      (prop.kind === "pine" || prop.kind === "oak")
      && prop.y < BERNIE_HUT.y - 20
      && prop.y > BERNIE_PATH_APPROACH_Y + 40
      && Math.abs(prop.x - BERNIE_HUT.x) < 58
    ));
    expect(blocking).toEqual([]);
  });

  test("Bernie's trail meets the main road", () => {
    const points = berniePathPoints();
    expect(points.length).toBeGreaterThan(8);
    const [startX, startY] = points[0]!;
    expect(Math.abs(startY - mainPathY(startX))).toBeLessThan(8);
    expect(BERNIE_PATH_JOIN_X - BERNIE_HUT.x).toBeGreaterThan(600);
    expect(BERNIE_PATH_JOIN_X - BERNIE_HUT.x).toBeLessThan(900);
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

  test("the northeast campus has a data center with a clear yard", () => {
    const layout = createWorldLayout();
    const hall = layout.props.find((prop) => prop.kind === "datacenter");
    expect(hall).toEqual(expect.objectContaining({
      x: DATA_CENTER.x,
      y: DATA_CENTER.y,
      scale: DATA_CENTER_SCALE,
    }));
    const [nativeW, nativeH] = WORLD_MODEL_SIZES.datacenter;
    expect(MAP_WIDTH / 2 - (DATA_CENTER.x + nativeW * DATA_CENTER_SCALE / 2)).toBeGreaterThan(180);
    expect(MAP_HEIGHT / 2 - (DATA_CENTER.y + nativeH * DATA_CENTER_SCALE)).toBeGreaterThan(80);
    const blocking = layout.props.filter((prop) => (
      (prop.kind === "pine" || prop.kind === "oak")
      && inDataCenterClearing(prop.x, prop.y)
    ));
    expect(blocking).toEqual([]);
    expect(layout.mice.every((mouse) => !inDataCenterClearing(mouse.originX, mouse.originY))).toBe(true);
    const driveway = layout.props.filter((prop) => (
      (prop.kind === "pine" || prop.kind === "oak")
      && Math.abs(prop.x - DATA_CENTER.x) < 48
      && prop.y < DATA_CENTER.y
      && prop.y > DATA_CENTER.y - 240
    ));
    expect(driveway).toEqual([]);
    expect(dataCenterPathPoints().length).toBeGreaterThan(8);
    const racks = layout.props.filter((prop) => prop.kind === "racks");
    expect(racks.length).toBe(3);
    expect(racks.every((rack) => rack.y > DATA_CENTER.y)).toBe(true);
    expect(layout.props.find((prop) => prop.kind === "sam")).toEqual(expect.objectContaining({
      x: SAM.x,
      y: SAM.y,
      scale: CAT_SCALE,
    }));
    expect(SAM.y).toBeLessThan(DATA_CENTER.y);
    expect(SAM.x).toBeGreaterThan(DATA_CENTER.x);
  });

  test("an intake pipe runs from Bernie's puddle to the data center", () => {
    const route = intakePipePoints();
    expect(route[0]).toEqual([BERNIE_POND_X, BERNIE_POND_Y]);
    expect(route.at(-1)).toEqual([INTAKE_PIPE_END.x, INTAKE_PIPE_END.y]);
    expect(INTAKE_PIPE_END.x).toBeGreaterThan(DATA_CENTER.x - WORLD_MODEL_SIZES.datacenter[0] * DATA_CENTER_SCALE / 2 + 80);
    expect(route.length).toBeGreaterThan(40);
    const layout = createWorldLayout();
    const blocking = layout.props.filter((prop) => (
      (prop.kind === "pine" || prop.kind === "oak")
      && route.some(([x, y]) => Math.hypot(prop.x - x, prop.y - y) < 28)
    ));
    expect(blocking).toEqual([]);
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

  test("the pond intake stand is walkable next to the remaining puddle", () => {
    expect(walkable(INTAKE.x, INTAKE.y)).toBe(true);
    expect(walkable(BERNIE_POND_X, BERNIE_POND_Y)).toBe(false);
    expect(walkable(BERNIE_POND_X + BERNIE_POND_WIDTH * 0.32, BERNIE_POND_Y)).toBe(true);
    expect(nearIntakeRim(INTAKE.x, INTAKE.y)).toBe(true);
    expect(nearIntakeRim(BERNIE_POND_X, BERNIE_POND_Y)).toBe(false);
    expect(nearIntakeRim(0, -5)).toBe(false);
    let shore = false;
    for (let dy = 70; dy <= 140; dy += 4) {
      if (nearIntakeRim(BERNIE_POND_X, BERNIE_POND_Y - dy)) shore = true;
    }
    expect(shore).toBe(true);
  });

  test("Bernie hut blocks the doorway footprint", () => {
    expect(walkable(BERNIE_HUT.x, BERNIE_HUT.y)).toBe(false);
  });

  test("Mosswhisker's den blocks its doorway but spawn stays clear", () => {
    expect(walkable(0, 46)).toBe(false);
    expect(walkable(0, -5)).toBe(true);
  });

  test("Bernie blocks a small standing footprint", () => {
    expect(walkable(BERNIE.x, BERNIE.y)).toBe(false);
  });

  test("the data center blocks its hall but the gate stay is walkable", () => {
    expect(walkable(DATA_CENTER.x, DATA_CENTER.y)).toBe(false);
    expect(walkable(DATA_CENTER.x, DATA_CENTER.y + 80)).toBe(false);
    expect(walkable(DATA_CENTER.x, DATA_CENTER.y - 70)).toBe(true);
  });

  test("Sam Catman blocks a small standing footprint in front of the hall", () => {
    expect(walkable(SAM.x, SAM.y)).toBe(false);
    expect(walkable(SAM.x, DATA_CENTER.y - 70)).toBe(true);
  });

  test("farm carrots and the rabbit block, but the plot stays walkable between them", () => {
    expect(walkable(FARM.x, FARM.y)).toBe(true);
    expect(walkable(RABBIT.x, RABBIT.y)).toBe(false);
    expect(walkable(FARM_CARROTS[4]!.x, FARM_CARROTS[4]!.y)).toBe(false);
    expect(walkable(FARM_SHED.x, FARM_SHED.y)).toBe(false);
  });

  test("Greta stands on the south path and Wolfenberg waits further into the wood", () => {
    expect(walkable(GRETA.x, GRETA.y)).toBe(false);
    expect(walkable(WOLFENBERG.x, WOLFENBERG.y)).toBe(false);
    expect(Math.abs(GRETA.x - southPathX(GRETA.y))).toBeLessThan(8);
    expect(WOLFENBERG.y).toBeLessThan(GRETA.y);
    expect(WOLFENBERG.x).toBeGreaterThan(GRETA.x);
    expect(Math.hypot(WOLFENBERG.x - GRETA.x, WOLFENBERG.y - GRETA.y)).toBeGreaterThan(100);
    expect(Math.hypot(WOLFENBERG.x - GRETA.x, WOLFENBERG.y - GRETA.y)).toBeLessThan(220);
  });

  test("logs and stumps block their ground footprint", () => {
    const npcs = UNIQUE_NPC_KINDS.map((kind) => {
      const prop = WORLD_PROPS.find((item) => item.kind === kind);
      if (!prop) throw new Error(`${kind} is missing from authored props`);
      return prop;
    });
    const blocked = createWalkable(createWorldLayout([
      ...npcs,
      { kind: "log", x: 80, y: 40, scale: 1, seed: 1, variant: 0 },
      { kind: "mossLog", x: 80, y: 140, scale: 1, seed: 1, variant: 0, rot: 90 },
      { kind: "stump", x: 80, y: 240, scale: 1, seed: 1, variant: 0 },
    ]).trunks);
    const logLift = WORLD_MODEL_SIZES.log[1] / 2;
    const mossLift = WORLD_MODEL_SIZES.mossLog[1] / 2;
    const stumpOffset = TREE_TRUNK_HITBOX.stump?.[2] ?? 0;
    expect(blocked(80, 40 + logLift)).toBe(false);
    expect(blocked(80, 40)).toBe(false);
    expect(blocked(80, 40 - 4)).toBe(false);
    expect(blocked(80, 140 + mossLift)).toBe(false);
    expect(blocked(80 + 50, 140 + mossLift)).toBe(true);
    expect(blocked(80, 140 + mossLift + 30)).toBe(false);
    expect(blocked(80, 240 + stumpOffset)).toBe(false);
    expect(blocked(80, 240)).toBe(false);
    expect(blocked(80, 240 - 8)).toBe(false);
    expect(blocked(200, 40)).toBe(true);
  });
});
