import { lakeContainsLocalPoint, lakePhaseFromSeed } from "./lake-shape";
import { pierContainsLocalPoint } from "./pier-shape";
import { pondPuddleContains } from "./pond-shape";
import { seeded } from "./rng";
import { hitsSolid, type FishSpec, type Interactable, type MouseSpec, type Solid, type Walkable } from "./sim";
import {
  BERNIE,
  BERNIE_HUT,
  BERNIE_PATH_APPROACH_Y,
  BERNIE_POND_HEIGHT,
  BERNIE_POND_SEED,
  BERNIE_POND_WIDTH,
  BERNIE_POND_X,
  BERNIE_POND_Y,
  BERNIE_SEED,
  BERNIE_WOODS,
  CAT_COLLISION,
  CAT_SCALE,
  DATA_CENTER,
  DATA_CENTER_RACKS,
  DATA_CENTER_SCALE,
  FARM,
  FARM_CARROTS,
  FARM_FENCES,
  FARM_PLOT,
  FARM_SHED,
  FARM_SHED_SCALE,
  INTAKE,
  RABBIT,
  SAM,
  LAKE_HEIGHT,
  LAKE_SEED,
  LAKE_WIDTH,
  LAKE_X,
  LAKE_Y,
  MAILBOX,
  MAP_HEIGHT,
  MAP_WIDTH,
  SCATTER_HEIGHT,
  SCATTER_WIDTH,
  MOUSE_SEED,
  PIER_HEIGHT,
  PIER_WIDTH,
  PIER_X,
  PIER_Y,
  SCENE_SEED,
  denPathX,
  mainPathY,
  onIntakePipe,
  southPathX,
  TREE_TRUNK_HITBOX,
  type WorldModelKind,
} from "./world-config";

export type WorldProp = {
  kind: WorldModelKind;
  x: number;
  y: number;
  scale: number;
  seed: number;
  variant: number;
  sick?: boolean;
};

export type WorldLayout = {
  props: WorldProp[];
  fish: FishSpec[];
  mice: MouseSpec[];
  trunks: Solid[];
  interactables: Interactable[];
};

export const LAKE_WILLOWS: Array<[number, number, number]> = [
  [LAKE_X - 325, LAKE_Y + 145, 1.12],
  [LAKE_X + 378, LAKE_Y - 34, 1.05],
  [LAKE_X - 205, LAKE_Y - 192, 0.98],
];

const lakePhase = lakePhaseFromSeed(LAKE_SEED);
const berniePondPhase = lakePhaseFromSeed(BERNIE_POND_SEED);

export function isBernieWoods(x: number, y: number) {
  const insideColony = Math.abs(x) < 610 && y > -340 && y < 330;
  return x < BERNIE_WOODS.east && y > BERNIE_WOODS.south && !insideColony;
}

export function inDataCenterClearing(x: number, y: number) {
  const dx = (x - DATA_CENTER.x) / 350;
  const dy = (y - (DATA_CENTER.y + 80)) / 260;
  return dx * dx + dy * dy < 1;
}

function onDataCenterPath(x: number, y: number) {
  return y >= mainPathY(DATA_CENTER.x) - 28
    && y <= DATA_CENTER.y + 8
    && Math.abs(x - (DATA_CENTER.x + Math.sin((y + 40) / 72) * 16)) < 48;
}

export function inFarmClearing(x: number, y: number) {
  const dx = (x - (FARM.x - 80)) / 420;
  const dy = (y - (FARM.y + 30)) / 300;
  return dx * dx + dy * dy < 1;
}

export function inFarmPlot(x: number, y: number) {
  const dx = Math.abs(x - FARM.x) / FARM_PLOT.halfW;
  const dy = Math.abs(y - FARM.y) / FARM_PLOT.halfH;
  return dx ** 4 + dy ** 4 < 1;
}

function onFarmPath(x: number, y: number) {
  const endY = FARM.y + FARM_PLOT.halfH;
  return y <= mainPathY(FARM.x) + 28
    && y >= endY
    && Math.abs(x - (FARM.x + Math.sin((y + 40) / 72) * 16)) < 48;
}

function onBerniePath(x: number, y: number) {
  const alongSouth = x <= BERNIE_WOODS.east + 24 && x >= BERNIE_HUT.x - 20
    && Math.abs(y - BERNIE_PATH_APPROACH_Y) < 44;
  const alongWest = Math.abs(x - BERNIE_HUT.x) < 44
    && y >= BERNIE_PATH_APPROACH_Y - 20 && y <= BERNIE_HUT.y + 10;
  const inFrontYard = y < BERNIE_HUT.y - 20
    && y > BERNIE_PATH_APPROACH_Y + 40
    && Math.abs(x - BERNIE_HUT.x) < 58;
  return alongSouth || alongWest || inFrontYard;
}

function inBernieClearing(x: number, y: number) {
  if (Math.hypot(x - BERNIE_HUT.x, y - BERNIE_HUT.y) < 200) return true;
  const nx = (x - BERNIE_POND_X) / (BERNIE_POND_WIDTH / 2 + 18);
  const ny = (y - BERNIE_POND_Y) / (BERNIE_POND_HEIGHT / 2 + 18);
  return nx * nx + ny * ny < 1;
}

export function isForestFloor(x: number, y: number) {
  if (isBernieWoods(x, y)) return false;
  const insideColony = Math.abs(x) < 610 && y > -340 && y < 330;
  const insideLake = lakeContainsLocalPoint(LAKE_WIDTH, LAKE_HEIGHT, lakePhase, x - LAKE_X, y - LAKE_Y, 46);
  const nearWillow = LAKE_WILLOWS.some(([willowX, willowY]) => Math.hypot(x - willowX, y - willowY) < 92);
  const onMainPath = Math.abs(y - mainPathY(x)) < 56;
  const onSouthPath = Math.abs(x - southPathX(y)) < 56 && y < mainPathY(655) + 30;
  return !insideColony && !insideLake && !nearWillow && !onMainPath && !onSouthPath
    && !inDataCenterClearing(x, y) && !onDataCenterPath(x, y) && !onIntakePipe(x, y)
    && !inFarmClearing(x, y) && !onFarmPath(x, y);
}

export function createWalkable(solids: readonly Solid[]): Walkable {
  return (x, y) => {
    if (hitsSolid(x, y, solids, CAT_COLLISION.halfW, CAT_COLLISION.halfH)) return false;
    const overWater = lakeContainsLocalPoint(LAKE_WIDTH, LAKE_HEIGHT, lakePhase, x - LAKE_X, y - LAKE_Y, -10);
    const onPier = pierContainsLocalPoint(PIER_WIDTH, PIER_HEIGHT, x - PIER_X, y - PIER_Y, 5);
    if (overWater && !onPier) return false;
    return !pondPuddleContains(BERNIE_POND_WIDTH, BERNIE_POND_HEIGHT, berniePondPhase, x - BERNIE_POND_X, y - BERNIE_POND_Y);
  };
}

function trunksFromProps(props: readonly WorldProp[]): Solid[] {
  const trunks: Solid[] = [];
  for (const prop of props) {
    const trunk = TREE_TRUNK_HITBOX[prop.kind];
    if (trunk) {
      trunks.push({
        x: prop.x,
        y: prop.y + (trunk[2] ?? 0) * prop.scale,
        halfW: trunk[0] * prop.scale,
        halfH: trunk[1] * prop.scale,
      });
    }
  }
  return trunks;
}

export const FISH_SPECS: FishSpec[] = [
  { id: "fish-pike", kind: "pike", originX: LAKE_X - 20, originY: LAKE_Y - 30, radiusX: 210, radiusY: 85, speed: 0.12, phase: 0.4, tailStep: 0.85 },
  { id: "fish-perch", kind: "perch", originX: LAKE_X + 90, originY: LAKE_Y + 10, radiusX: 155, radiusY: 70, speed: 0.16, phase: 1.8, tailStep: 0.7 },
  { id: "fish-bluegill", kind: "bluegill", originX: LAKE_X + 130, originY: LAKE_Y - 70, radiusX: 120, radiusY: 55, speed: 0.19, phase: 3.1, tailStep: 0.55 },
  { id: "fish-pike-2", kind: "pike", originX: LAKE_X - 160, originY: LAKE_Y + 50, radiusX: 150, radiusY: 58, speed: 0.13, phase: 5.2, tailStep: 0.8 },
  { id: "fish-perch-2", kind: "perch", originX: LAKE_X - 90, originY: LAKE_Y - 110, radiusX: 130, radiusY: 50, speed: 0.15, phase: 0.9, tailStep: 0.65 },
  { id: "fish-bluegill-2", kind: "bluegill", originX: LAKE_X + 40, originY: LAKE_Y + 95, radiusX: 100, radiusY: 42, speed: 0.21, phase: 4.6, tailStep: 0.5 },
  { id: "fish-bluegill-3", kind: "bluegill", originX: LAKE_X - 200, originY: LAKE_Y - 20, radiusX: 95, radiusY: 40, speed: 0.18, phase: 2.2, tailStep: 0.52 },
  { id: "fish-bluegill-4", kind: "bluegill", originX: LAKE_X + 210, originY: LAKE_Y + 30, radiusX: 88, radiusY: 38, speed: 0.22, phase: 5.8, tailStep: 0.48 },
];

export function createMouseSpecs(count = 12): MouseSpec[] {
  const mouseRandom = seeded(MOUSE_SEED);
  const mouseSpecs: MouseSpec[] = [];
  let mouseAttempts = 0;
  while (mouseSpecs.length < count && mouseAttempts < 500) {
    mouseAttempts += 1;
    const x = (mouseRandom() - 0.5) * (SCATTER_WIDTH - 220);
    const y = (mouseRandom() - 0.5) * (SCATTER_HEIGHT - 220);
    if (!isForestFloor(x, y)) continue;
    if (mouseSpecs.some((spec) => Math.hypot(spec.originX - x, spec.originY - y) < 140)) continue;
    mouseSpecs.push({
      id: `mouse-${mouseSpecs.length}`,
      originX: x,
      originY: y,
      radiusX: 36 + mouseRandom() * 28,
      radiusY: 10 + mouseRandom() * 8,
      speed: 1.1 + mouseRandom() * 0.7,
      phase: mouseRandom() * Math.PI * 2,
      step: 0.1 + mouseRandom() * 0.05,
    });
  }
  return mouseSpecs;
}

/** Deterministic map: same seed, same props, mice, fish, and trunks on every client. */
export function createWorldLayout(): WorldLayout {
  const props: WorldProp[] = [];
  const add = (kind: WorldModelKind, x: number, y: number, scale = 1, seed = 1, variant = 0, sick = false) => {
    const prop: WorldProp = { kind, x, y, scale, seed, variant };
    if (sick) prop.sick = true;
    props.push(prop);
  };

  for (let i = 0; i < 11; i++) {
    add(i % 3 === 0 ? "pine" : "oak", -540 + i * 108, 170 + (i % 3) * 34, 1.2 + (i % 2) * 0.12, 70 + i, i);
  }

  add("pine", -455, 112, 1.18, 13, 1);
  add("oak", -404, 8, 1.12, 14, 2);
  add("oak", 455, 115, 1.24, 15, 3);
  add("pine", 415, -20, 1.1, 16, 4);
  add("den", 0, 46, 1.12, 22);
  add("mailbox", MAILBOX.x, MAILBOX.y, 1.28, 23);
  add("mailBubble", MAILBOX.x, MAILBOX.y + 64, 0.92, 26);
  add("hut", BERNIE_HUT.x, BERNIE_HUT.y, 1.42, 29);
  add("datacenter", DATA_CENTER.x, DATA_CENTER.y, DATA_CENTER_SCALE, 41);
  for (const rack of DATA_CENTER_RACKS) add("racks", rack.x, rack.y, rack.scale, rack.seed);
  add("bernie", BERNIE.x, BERNIE.y, CAT_SCALE, 0);
  add("sam", SAM.x, SAM.y, CAT_SCALE, 0);
  add("shed", FARM_SHED.x, FARM_SHED.y, FARM_SHED_SCALE, 60);
  for (const crop of FARM_CARROTS) add("carrot", crop.x, crop.y, crop.scale, crop.seed, crop.variant);
  for (const rail of FARM_FENCES) add("fence", rail.x, rail.y, rail.scale, rail.seed);
  add("rabbit", RABBIT.x, RABBIT.y, CAT_SCALE, 0);
  add("flowers", FARM.x + 248, FARM.y + 36, 1.06, 93, 2);
  add("flowers", FARM.x - 256, FARM.y - 18, 0.96, 94, 0);
  add("bush", FARM.x + 246, FARM.y + 118, 1.16, 95);
  add("stone", FARM.x - 230, FARM.y + 160, 0.92, 96);
  add("lamp", -230, -86, 1.12, 24);
  add("lamp", 230, -86, 1.12, 25);

  [-165, -136, -107, -78, -49, -22, 4].forEach((y, index) => {
    const pathX = denPathX(y);
    const offset = 54 + (index % 2) * 8;
    add("bush", pathX - offset, y, 1.08 + (index % 3) * 0.05, 40 + index);
    add("bush", pathX + offset, y + (index % 2 === 0 ? 5 : -4), 1.1 + ((index + 1) % 3) * 0.05, 50 + index);
  });

  add("log", -420, -112, 1.12, 31);
  add("stone", 330, -140, 0.9, 32);
  add("stone", -340, 118, 0.75, 33);
  add("bush", -382, -32, 1.2, 36);
  add("bush", 385, 10, 1.18, 37);
  add("pine", -500, -164, 1.08, 38, 1);
  add("oak", 510, -185, 1.14, 39, 2);

  const flowerGroups: Array<[number, number, number, number]> = [
    [-342, 137, 1.1, 0], [-450, 90, 1.05, 1],
    [400, 79, 1.06, 2], [380, -228, 1.1, 0],
    [-318, -210, .95, 1], [321, -114, .92, 2],
    [-444, -14, .92, 0], [435, 190, .88, 1],
  ];
  flowerGroups.forEach(([x, y, scale, variant], index) => add("flowers", x, y, scale, 100 + index, variant));

  add("log", 220, 480, 1.32, 251);
  add("log", 910, 390, 1.18, 252);
  add("stone", -970, -570, 1.25, 253);
  add("stone", 790, -640, 1.1, 254);

  LAKE_WILLOWS.forEach(([x, y, scale], index) => add("willow", x, y, scale, 280 + index, index));

  const sceneRandom = seeded(SCENE_SEED);
  let scattered = 0;
  let scatterAttempts = 0;
  while (scattered < 125 && scatterAttempts < 700) {
    scatterAttempts += 1;
    const x = (sceneRandom() - 0.5) * (SCATTER_WIDTH - 180);
    const y = (sceneRandom() - 0.5) * (SCATTER_HEIGHT - 180);
    if (!isForestFloor(x, y)) continue;

    const roll = sceneRandom();
    const seed = 500 + (scattered % 8);
    if (roll < 0.44) {
      add(sceneRandom() < 0.43 ? "pine" : "oak", x, y, 0.9 + sceneRandom() * 0.42, seed, scattered % 5);
    } else if (roll < 0.64) {
      add("bush", x, y, 0.82 + sceneRandom() * 0.46, seed);
    } else if (roll < 0.84) {
      add("flowers", x, y, 0.72 + sceneRandom() * 0.45, seed, scattered % 3);
    } else if (roll < 0.94) {
      add("stone", x, y, 0.72 + sceneRandom() * 0.62, seed);
    } else {
      add("log", x, y, 0.76 + sceneRandom() * 0.42, seed);
    }
    scattered += 1;
  }

  const bernieRandom = seeded(BERNIE_SEED);
  const bernieTrees: Array<[number, number]> = [];
  let bernieAttempts = 0;
  while (bernieTrees.length < 72 && bernieAttempts < 900) {
    bernieAttempts += 1;
    const x = -SCATTER_WIDTH / 2 + 70 + bernieRandom() * (BERNIE_WOODS.east + SCATTER_WIDTH / 2 - 110);
    const y = BERNIE_WOODS.south + 36 + bernieRandom() * (SCATTER_HEIGHT / 2 - BERNIE_WOODS.south - 70);
    if (!isBernieWoods(x, y) || inBernieClearing(x, y) || onBerniePath(x, y) || onIntakePipe(x, y)) continue;
    if (bernieTrees.some(([treeX, treeY]) => Math.hypot(treeX - x, treeY - y) < 88)) continue;
    bernieTrees.push([x, y]);
    const kind = bernieRandom() < 0.52 ? "pine" : "oak";
    add(kind, x, y, 0.94 + bernieRandom() * 0.38, 800 + bernieTrees.length, bernieTrees.length % 5, true);
  }

  let rimAttempts = 0;
  while (bernieTrees.length < 96 && rimAttempts < 400) {
    rimAttempts += 1;
    const onWestRim = bernieRandom() < 0.62;
    const x = onWestRim
      ? -MAP_WIDTH / 2 + 80 + bernieRandom() * (MAP_WIDTH / 2 - SCATTER_WIDTH / 2 - 80)
      : -SCATTER_WIDTH / 2 + bernieRandom() * (BERNIE_WOODS.east + SCATTER_WIDTH / 2);
    const y = onWestRim
      ? BERNIE_WOODS.south + bernieRandom() * (MAP_HEIGHT / 2 - BERNIE_WOODS.south - 80)
      : SCATTER_HEIGHT / 2 - 40 + bernieRandom() * (MAP_HEIGHT / 2 - SCATTER_HEIGHT / 2);
    if (!isBernieWoods(x, y) || inBernieClearing(x, y) || onBerniePath(x, y) || onIntakePipe(x, y)) continue;
    if (bernieTrees.some(([treeX, treeY]) => Math.hypot(treeX - x, treeY - y) < 88)) continue;
    bernieTrees.push([x, y]);
    const kind = bernieRandom() < 0.52 ? "pine" : "oak";
    add(kind, x, y, 0.94 + bernieRandom() * 0.38, 800 + bernieTrees.length, bernieTrees.length % 5, true);
  }

  return {
    props,
    fish: FISH_SPECS,
    mice: createMouseSpecs(),
    trunks: trunksFromProps(props),
    interactables: [
      { id: "mailbox", kind: "mailbox", x: MAILBOX.x, y: MAILBOX.y },
      { id: "bernie", kind: "bernie", x: BERNIE.x, y: BERNIE.y },
      { id: "sam", kind: "sam", x: SAM.x, y: SAM.y },
      { id: "rabbit", kind: "rabbit", x: RABBIT.x, y: RABBIT.y },
      { id: "intake", kind: "intake", x: INTAKE.x, y: INTAKE.y },
    ],
  };
}
