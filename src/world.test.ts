import { describe, expect, test } from "bun:test";
import { lakeContainsLocalPoint, lakePhaseFromSeed } from "./lake-shape";
import { pondBasinContains } from "./pond-shape";
import { createWalkable, createWorldLayout, createLockedProps, inDataCenterClearing, inFarmClearing, inFarmPlot, isBernieWoods } from "./world";
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
  FARM,
  FARM_CARROTS,
  FARM_PLOT,
  FARM_SHED,
  farmPathPoints,
  INTAKE,
  INTAKE_PIPE_END,
  intakePipePoints,
  LAKE_HEIGHT,
  LAKE_SEED,
  LAKE_WIDTH,
  LAKE_X,
  LAKE_Y,
  MAILBOX,
  MAP_HEIGHT,
  MAP_WIDTH,
  mainPathY,
  nearIntakeRim,
  PIER_X,
  PIER_Y,
  RABBIT,
  ROCKET_CARROT,
  SAM,
  TREE_TRUNK_HITBOX,
  isAuthorableWorldKind,
  isUniqueNpcKind,
} from "./world-config";
import { WORLD_MODEL_SIZES } from "./world-models";
import { WORLD_GROUND, WORLD_PROPS } from "./world-props";
import { farmPlotGround, groundKindAt } from "./ground";

describe("createWorldLayout", () => {
  test("the same seed produces the same props, mice, and fish", () => {
    const a = createWorldLayout();
    const b = createWorldLayout();
    expect(a.props).toEqual(b.props);
    expect(a.mice).toEqual(b.mice);
    expect(a.fish).toEqual(b.fish);
    expect(a.trunks).toEqual(b.trunks);
    expect(a.trees).toEqual(b.trees);
    expect(a.interactables).toEqual(b.interactables);
    expect(a.trees.length).toBeGreaterThan(0);
    expect(a.trees.length).toBeLessThan(a.trunks.length);
    expect(a.mice.length).toBeGreaterThan(0);
    expect(a.fish.map((fish) => fish.id)).toEqual([
      "fish-pike",
      "fish-perch",
      "fish-bluegill",
      "fish-pike-2",
      "fish-perch-2",
      "fish-bluegill-2",
      "fish-bluegill-3",
      "fish-bluegill-4",
    ]);
    expect(a.interactables).toEqual([
      { id: "mailbox", kind: "mailbox", x: MAILBOX.x, y: MAILBOX.y },
      { id: "bernie", kind: "bernie", x: BERNIE.x, y: BERNIE.y },
      { id: "sam", kind: "sam", x: SAM.x, y: SAM.y },
      { id: "rabbit", kind: "rabbit", x: RABBIT.x, y: RABBIT.y },
      { id: "intake", kind: "intake", x: INTAKE.x, y: INTAKE.y },
    ]);
  });

  test("landmarks stay in code while vegetation and NPCs come from authored props", () => {
    expect(WORLD_PROPS.every((prop) => isAuthorableWorldKind(prop.kind))).toBe(true);
    expect(createLockedProps().every((prop) => !isUniqueNpcKind(prop.kind))).toBe(true);
    const layout = createWorldLayout();
    expect(layout.props.filter((prop) => prop.kind === "bernie")).toHaveLength(1);
    expect(layout.props.filter((prop) => prop.kind === "sam")).toHaveLength(1);
    expect(layout.props.filter((prop) => prop.kind === "rabbit")).toHaveLength(1);
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

  test("Bernie woods has a hut, sick trees, and no prey or undergrowth", () => {
    const layout = createWorldLayout();
    const hut = layout.props.find((prop) => prop.kind === "hut");
    expect(hut).toEqual(expect.objectContaining({ x: BERNIE_HUT.x, y: BERNIE_HUT.y }));
    const bernie = layout.props.find((prop) => prop.kind === "bernie");
    expect(bernie).toEqual(expect.objectContaining({ x: BERNIE.x, y: BERNIE.y }));
    expect(BERNIE.y).toBeLessThan(BERNIE_HUT.y);
    expect(BERNIE.y).toBeGreaterThan(BERNIE_HUT.y - 50);
    expect(Math.abs(BERNIE.x - BERNIE_HUT.x)).toBeLessThan(40);

    const inWoods = layout.props.filter((prop) => isBernieWoods(prop.x, prop.y));
    expect(inWoods.some((prop) => prop.kind === "hut")).toBe(true);
    expect(inWoods.some((prop) => prop.kind === "bernie")).toBe(true);
    expect(inWoods.filter((prop) => prop.kind === "pine" || prop.kind === "oak").length).toBeGreaterThan(8);
    expect(inWoods.every((prop) => (
      prop.kind === "hut"
      || prop.kind === "bernie"
      || ((prop.kind === "pine" || prop.kind === "oak") && prop.sick)
    ))).toBe(true);
    expect(inWoods.filter((prop) => prop.kind === "pine" || prop.kind === "oak").every((tree) => (
      Math.hypot(tree.x - BERNIE_HUT.x, tree.y - BERNIE_HUT.y) >= 200
    ))).toBe(true);
    expect(inWoods.some((prop) => prop.kind === "flowers" || prop.kind === "bush" || prop.kind === "log" || prop.kind === "stone")).toBe(false);

    expect(layout.mice.every((mouse) => !isBernieWoods(mouse.originX, mouse.originY))).toBe(true);
    expect(layout.fish.every((fish) => !isBernieWoods(fish.originX, fish.originY))).toBe(true);
    expect(MAP_WIDTH / 2 + BERNIE_HUT.x).toBeGreaterThan(400);
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

  test("the southwest farm has a shed, giant carrots, and a rabbit by the plot", () => {
    const layout = createWorldLayout();
    expect(layout.props.find((prop) => prop.kind === "shed")).toEqual(expect.objectContaining({
      x: FARM_SHED.x,
      y: FARM_SHED.y,
    }));
    expect(FARM_SHED.x).toBeLessThan(FARM.x - FARM_PLOT.halfW);
    expect(inFarmPlot(FARM_SHED.x, FARM_SHED.y)).toBe(false);
    expect(layout.props.find((prop) => prop.kind === "rabbit")).toEqual(expect.objectContaining({
      x: RABBIT.x,
      y: RABBIT.y,
      scale: CAT_SCALE,
    }));
    const carrots = layout.props.filter((prop) => prop.kind === "carrot");
    expect(carrots).toHaveLength(FARM_CARROTS.length);
    expect(carrots.every((crop) => crop.scale > 1.1 && crop.scale < 1.5)).toBe(true);
    expect(carrots.every((crop) => inFarmPlot(crop.x, crop.y))).toBe(true);
    expect(WORLD_GROUND).toEqual(farmPlotGround());
    expect(carrots.every((crop) => groundKindAt(WORLD_GROUND, crop.x, crop.y) === "furrow")).toBe(true);
    expect(Math.max(...FARM_CARROTS.map((crop) => crop.scale))).toBe(ROCKET_CARROT.scale);
    expect(Math.hypot(ROCKET_CARROT.x - FARM.x, ROCKET_CARROT.y - FARM.y)).toBeLessThan(80);
    expect(layout.props.find((prop) => prop.kind === "carrot" && prop.x === ROCKET_CARROT.x && prop.y === ROCKET_CARROT.y)?.scale).toBe(ROCKET_CARROT.scale);
    expect(Math.abs(RABBIT.x - FARM_SHED.x)).toBeLessThan(80);
    expect(Math.abs(RABBIT.y - FARM_SHED.y)).toBeLessThan(20);
    expect(inFarmPlot(RABBIT.x, RABBIT.y)).toBe(false);
    expect(MAP_WIDTH / 2 + FARM.x).toBeGreaterThan(400);
    expect(MAP_HEIGHT / 2 + FARM.y).toBeGreaterThan(200);
    const blocking = layout.props.filter((prop) => (
      (prop.kind === "pine" || prop.kind === "oak")
      && inFarmClearing(prop.x, prop.y)
    ));
    expect(blocking).toEqual([]);
    expect(layout.mice.every((mouse) => !inFarmClearing(mouse.originX, mouse.originY))).toBe(true);
    expect(layout.props.filter((prop) => prop.kind === "fence" && prop.rot === 90)).toHaveLength(5);
    expect(farmPathPoints().length).toBeGreaterThan(8);
    for (const [x, y] of farmPathPoints()) {
      expect(y).toBeGreaterThanOrEqual(FARM.y + FARM_PLOT.halfH);
      expect(inFarmPlot(x, y)).toBe(false);
    }
    const driveway = layout.props.filter((prop) => (
      (prop.kind === "pine" || prop.kind === "oak")
      && Math.abs(prop.x - FARM.x) < 48
      && prop.y < mainPathY(FARM.x)
      && prop.y > FARM.y
    ));
    expect(driveway).toEqual([]);
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

  test("logs and stumps block their ground footprint", () => {
    const bernie = WORLD_PROPS.find((prop) => prop.kind === "bernie");
    const sam = WORLD_PROPS.find((prop) => prop.kind === "sam");
    const rabbit = WORLD_PROPS.find((prop) => prop.kind === "rabbit");
    if (!bernie || !sam || !rabbit) throw new Error("NPCs are missing from authored props");
    const blocked = createWalkable(createWorldLayout([
      bernie,
      sam,
      rabbit,
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
