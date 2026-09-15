import { lakeContainsLocalPoint, lakePhaseFromSeed } from "./lake-shape";
import { pierContainsLocalPoint } from "./pier-shape";
import { seeded } from "./rng";
import { hitsSolid, type FishSpec, type Interactable, type MouseSpec, type Solid, type Walkable } from "./sim";
import {
  CAT_COLLISION,
  LAKE_HEIGHT,
  LAKE_SEED,
  LAKE_WIDTH,
  LAKE_X,
  LAKE_Y,
  MAILBOX,
  MAP_HEIGHT,
  MAP_WIDTH,
  MOUSE_SEED,
  PIER_HEIGHT,
  PIER_WIDTH,
  PIER_X,
  PIER_Y,
  SCENE_SEED,
  denPathX,
  mainPathY,
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

export function isForestFloor(x: number, y: number) {
  const insideColony = Math.abs(x) < 610 && y > -340 && y < 330;
  const insideLake = lakeContainsLocalPoint(LAKE_WIDTH, LAKE_HEIGHT, lakePhase, x - LAKE_X, y - LAKE_Y, 46);
  const nearWillow = LAKE_WILLOWS.some(([willowX, willowY]) => Math.hypot(x - willowX, y - willowY) < 92);
  const onMainPath = Math.abs(y - mainPathY(x)) < 56;
  const onSouthPath = Math.abs(x - southPathX(y)) < 56 && y < mainPathY(655) + 30;
  return !insideColony && !insideLake && !nearWillow && !onMainPath && !onSouthPath;
}

export function createWalkable(solids: readonly Solid[]): Walkable {
  return (x, y) => {
    if (hitsSolid(x, y, solids, CAT_COLLISION.halfW, CAT_COLLISION.halfH)) return false;
    const overWater = lakeContainsLocalPoint(LAKE_WIDTH, LAKE_HEIGHT, lakePhase, x - LAKE_X, y - LAKE_Y, -10);
    const onPier = pierContainsLocalPoint(PIER_WIDTH, PIER_HEIGHT, x - PIER_X, y - PIER_Y, 5);
    return !overWater || onPier;
  };
}

function trunksFromProps(props: readonly WorldProp[]): Solid[] {
  const trunks: Solid[] = [];
  for (const prop of props) {
    const trunk = TREE_TRUNK_HITBOX[prop.kind];
    if (trunk) trunks.push({ x: prop.x, y: prop.y, halfW: trunk[0] * prop.scale, halfH: trunk[1] * prop.scale });
  }
  return trunks;
}

export const FISH_SPECS: FishSpec[] = [
  { id: "fish-pike", kind: "pike", originX: LAKE_X - 20, originY: LAKE_Y - 30, radiusX: 210, radiusY: 85, speed: 0.12, phase: 0.4, tailStep: 0.85 },
  { id: "fish-perch", kind: "perch", originX: LAKE_X + 90, originY: LAKE_Y + 10, radiusX: 155, radiusY: 70, speed: 0.16, phase: 1.8, tailStep: 0.7 },
  { id: "fish-bluegill", kind: "bluegill", originX: LAKE_X + 130, originY: LAKE_Y - 70, radiusX: 120, radiusY: 55, speed: 0.19, phase: 3.1, tailStep: 0.55 },
];

export function createMouseSpecs(count = 12): MouseSpec[] {
  const mouseRandom = seeded(MOUSE_SEED);
  const mouseSpecs: MouseSpec[] = [];
  let mouseAttempts = 0;
  while (mouseSpecs.length < count && mouseAttempts < 500) {
    mouseAttempts += 1;
    const x = (mouseRandom() - 0.5) * (MAP_WIDTH - 220);
    const y = (mouseRandom() - 0.5) * (MAP_HEIGHT - 220);
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
  const add = (kind: WorldModelKind, x: number, y: number, scale = 1, seed = 1, variant = 0) => {
    props.push({ kind, x, y, scale, seed, variant });
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

  add("log", -860, 470, 1.32, 251);
  add("log", 910, 390, 1.18, 252);
  add("stone", -970, -570, 1.25, 253);
  add("stone", 790, -640, 1.1, 254);

  LAKE_WILLOWS.forEach(([x, y, scale], index) => add("willow", x, y, scale, 280 + index, index));

  const sceneRandom = seeded(SCENE_SEED);
  let scattered = 0;
  let scatterAttempts = 0;
  while (scattered < 105 && scatterAttempts < 600) {
    scatterAttempts += 1;
    const x = (sceneRandom() - 0.5) * (MAP_WIDTH - 180);
    const y = (sceneRandom() - 0.5) * (MAP_HEIGHT - 180);
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

  return {
    props,
    fish: FISH_SPECS,
    mice: createMouseSpecs(),
    trunks: trunksFromProps(props),
    interactables: [{ id: "mailbox", kind: "mailbox", x: MAILBOX.x, y: MAILBOX.y }],
  };
}
