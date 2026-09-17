import { lakePhaseFromSeed } from "./lake-shape";
import { onPuddleShore } from "./pond-shape";

export const VIEW_HEIGHT = 540;
export const MAP_WIDTH = 4000;
export const MAP_HEIGHT = 2800;
/** Prop/mouse scatter stays on this inner size so a bigger rim does not reshuffle the world. */
export const SCATTER_WIDTH = 3200;
export const SCATTER_HEIGHT = 2300;
export const MAP_WALK_MARGIN = 45;
export const CAT_SPEED = 118;
export const CAT_SCALE = 2.05;
/** Paw-level body used against trunks and other ground solids. */
export const CAT_COLLISION = { halfW: 8, halfH: 6 };
export const CLAW_DURATION = 0.3;
/** Fraction of CLAW_DURATION when the swipe connects and can kill. */
export const CLAW_HIT_AT = 0.28;
export const WALK_FRAME = 0.1;
/** Fixed sim step. Clients and a future host must use this, not the display refresh. */
export const TICK_DT = 1 / 60;
export const MAX_TICKS_PER_FRAME = 5;
/** Seconds before a killed mouse or fish comes back. */
export const PREY_RESPAWN = 40;
export const MOUSE_RESPAWN = PREY_RESPAWN;
/** Claw reach in front of the cat, in world units. */
export const CLAW_RANGE = { forward: 46, back: 10, side: 26 };
/** How close a cat must stand to use E on an interactable. */
export const INTERACT_RANGE = 54;
export const MAILBOX = { x: 153, y: 52 };
/** Tribute Bernie asks for before the pond investigation. */
export const BERNIE_SUPPLY = { mice: 1, fish: 1 };
/** Seconds the failed-interact Meow hangs above the cat. */
export const MEOW_DURATION = 1.15;
/** Wait this long after the meow sound before the Meow text pops. */
export const MEOW_TEXT_DELAY = 0.3;
/** Wait this long after the hiss sound before the SSSSS text pops. */
export const HISS_TEXT_DELAY = 0.3;
/** Seconds a new-quest hint hangs in the middle of the screen. */
export const QUEST_HINT_DURATION = 3.2;
/** Shake and ignite before the rocket carrot leaves the soil. */
export const ROCKET_IGNITE = 0.62;

export const LOCAL_PLAYER_ID = "local";
export const DEFAULT_SPAWN = { x: 0, y: -5 };
export const DEFAULT_CAT_SEED = 5;

export const LAKE_X = -380;
export const LAKE_Y = -610;
export const LAKE_WIDTH = 900;
export const LAKE_HEIGHT = 520;
export const LAKE_SEED = 8417;
export const PIER_WIDTH = 84;
export const PIER_HEIGHT = 136;
export const PIER_SEED = 719;
export const PIER_X = LAKE_X + 70;
export const PIER_Y = LAKE_Y + 153;
export const SCENE_SEED = 1987;
export const MOUSE_SEED = 4412;
export const BERNIE_SEED = 2704;

/** Far-northwest dying wood: x west of east edge, y north of south edge. */
export const BERNIE_WOODS = { east: -400, south: 160 };
export const BERNIE_HUT = { x: -1480, y: 820 };
/** On the stoop in front of the door, facing south toward anyone who walks up. */
export const BERNIE = { x: BERNIE_HUT.x + 8, y: BERNIE_HUT.y - 40 };
export const BERNIE_NAME = "Bernie Sandwhiskers";
export const BERNIE_POND_X = -920;
export const BERNIE_POND_Y = 800;
export const BERNIE_POND_WIDTH = 680;
export const BERNIE_POND_HEIGHT = 410;
export const BERNIE_POND_SEED = 3311;
const berniePondPhase = lakePhaseFromSeed(BERNIE_POND_SEED);
/** East-west approach stays south of the dried pond, then turns north to the hut. */
export const BERNIE_PATH_APPROACH_Y = 500;

/** Far-northeast campus. Sprite origin is the south wall, feet on the last canvas rows. */
export const DATA_CENTER = { x: 1260, y: 820 };
export const DATA_CENTER_SCALE = 1.86;
/** On the yard in front of the hall, east of the door. */
export const SAM = { x: DATA_CENTER.x + 78, y: DATA_CENTER.y - 48 };
export const SAM_NAME = "Sam Catman";
/** Extra cabinet rows north of the hall, peeking out the sides. */
export const DATA_CENTER_RACKS = [
  { x: DATA_CENTER.x - 248, y: DATA_CENTER.y + 52, scale: 1.38, seed: 42 },
  { x: DATA_CENTER.x + 258, y: DATA_CENTER.y + 64, scale: 1.3, seed: 43 },
  { x: DATA_CENTER.x - 168, y: DATA_CENTER.y + 94, scale: 1.16, seed: 44 },
] as const;

/** Far-southwest carrot farm. Plot origin is the field centre. */
export const FARM = { x: -1280, y: -900 };
export const FARM_PLOT = { halfW: 218, halfH: 148 };
/** West edge of the plot, south face on the last canvas rows. */
export const FARM_SHED = { x: FARM.x - 300, y: FARM.y + 250 };
export const FARM_SHED_SCALE = 1.22;
/** Next to Bag End, facing anyone walking up from the plot. */
export const RABBIT = { x: FARM_SHED.x + 50, y: FARM_SHED.y - 10 };
export const RABBIT_NAME = "Elon Hopsk";
/** Biggest carrot in the plot. All farm carrots launch if you claw them. */
export const ROCKET_CARROT = {
  x: FARM.x + 38,
  y: FARM.y - 22,
  scale: 1.44,
  seed: 65,
  variant: 0,
} as const;
export const FARM_CARROTS = [
  { x: FARM.x - 128, y: FARM.y + 58, scale: 1.22, seed: 61, variant: 0 },
  { x: FARM.x - 8, y: FARM.y + 82, scale: 1.38, seed: 62, variant: 1 },
  { x: FARM.x + 118, y: FARM.y + 50, scale: 1.14, seed: 63, variant: 2 },
  { x: FARM.x - 88, y: FARM.y - 42, scale: 1.28, seed: 64, variant: 3 },
  ROCKET_CARROT,
  { x: FARM.x + 148, y: FARM.y - 58, scale: 1.18, seed: 66, variant: 1 },
] as const;
export type WorldModelKind =
  | "pine"
  | "oak"
  | "willow"
  | "bush"
  | "den"
  | "hut"
  | "datacenter"
  | "racks"
  | "bernie"
  | "sam"
  | "carrot"
  | "rabbit"
  | "fence"
  | "shed"
  | "mailbox"
  | "mailBubble"
  | "lamp"
  | "flowers"
  | "stone"
  | "log"
  | "cat"
  | "pike"
  | "perch"
  | "bluegill"
  | "mouse";

export type WorldProp = {
  kind: WorldModelKind;
  x: number;
  y: number;
  scale: number;
  seed: number;
  variant: number;
  sick?: boolean;
  /** Degrees. Omitted when 0. Fence and log use this. */
  rot?: number;
};

/** Vegetation the map editor can stamp, move, and delete. */
export const PLACEABLE_WORLD_KINDS = [
  "pine",
  "oak",
  "willow",
  "bush",
  "flowers",
  "stone",
  "log",
  "fence",
  "lamp",
] as const;
export type PlaceableWorldKind = (typeof PLACEABLE_WORLD_KINDS)[number];

/** Flowers: 0 white, 1 blue, 2 pink. */
export const FLOWER_VARIANTS = [0, 1, 2] as const;
export type FlowerVariant = (typeof FLOWER_VARIANTS)[number];

export function normalizeFlowerVariant(value: unknown): FlowerVariant {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return (((n % 3) + 3) % 3) as FlowerVariant;
}

/** Unique characters: the editor can move them, not add or remove them. */
export const UNIQUE_NPC_KINDS = ["bernie", "sam", "rabbit"] as const;
export type UniqueNpcKind = (typeof UNIQUE_NPC_KINDS)[number];

/** Long sprites the editor can spin to any angle. */
export const ROTATABLE_WORLD_KINDS = ["fence", "log"] as const;
export type RotatableWorldKind = (typeof ROTATABLE_WORLD_KINDS)[number];
export const ROTATABLE_WORLD_KIND_SET = new Set<WorldModelKind>(ROTATABLE_WORLD_KINDS);

export const AUTHORABLE_WORLD_KINDS = [...PLACEABLE_WORLD_KINDS, ...UNIQUE_NPC_KINDS] as const;
export type AuthorableWorldKind = (typeof AUTHORABLE_WORLD_KINDS)[number];
export const AUTHORABLE_WORLD_KIND_SET = new Set<WorldModelKind>(AUTHORABLE_WORLD_KINDS);
export const PLACEABLE_WORLD_KIND_SET = new Set<WorldModelKind>(PLACEABLE_WORLD_KINDS);
export const UNIQUE_NPC_KIND_SET = new Set<WorldModelKind>(UNIQUE_NPC_KINDS);

export function isPlaceableWorldKind(kind: string): kind is PlaceableWorldKind {
  return PLACEABLE_WORLD_KIND_SET.has(kind as WorldModelKind);
}

export function isUniqueNpcKind(kind: string): kind is UniqueNpcKind {
  return UNIQUE_NPC_KIND_SET.has(kind as WorldModelKind);
}

export function isAuthorableWorldKind(kind: string): kind is AuthorableWorldKind {
  return AUTHORABLE_WORLD_KIND_SET.has(kind as WorldModelKind);
}

export function isRotatableWorldKind(kind: string): kind is RotatableWorldKind {
  return ROTATABLE_WORLD_KIND_SET.has(kind as WorldModelKind);
}

/** Degrees in [0, 360). 0 means unrotated and is omitted from saved props. */
export function normalizeRotation(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const wrapped = ((n % 360) + 360) % 360;
  if (wrapped < 0.001 || wrapped > 359.999) return 0;
  const trimmed = Number(wrapped.toFixed(2));
  return trimmed === 360 ? 0 : trimmed;
}

export function nextRotation(value: unknown, step = 15): number {
  return normalizeRotation(normalizeRotation(value) + step);
}

/** Props whose trunk box should play the wood claw sound. */
export const TREE_KINDS = new Set<WorldModelKind>(["pine", "oak", "willow"]);

/** Ground footprint. Optional offsetY shifts the box north so a south-origin building stays solid. */
export const TREE_TRUNK_HITBOX: Partial<
  Record<
    WorldModelKind,
    readonly [halfW: number, halfH: number, offsetY?: number]
  >
> = {
  pine: [8, 5],
  oak: [11, 6],
  willow: [9, 5],
  hut: [46, 16],
  datacenter: [142, 72, 72],
  racks: [30, 12],
  bernie: [8, 6],
  sam: [8, 6],
  carrot: [9, 6],
  rabbit: [8, 6],
  fence: [22, 5],
  shed: [56, 16],
};

export const mainPathY = (x: number) =>
  -190 + Math.sin(x / 235) * 58 + Math.sin(x / 93) * 22;
export const southPathX = (y: number) => 655 + Math.sin((y + 290) / 145) * 82;
export const denPathX = (y: number) => Math.sin((y + 170) / 56) * 24;

export function berniePathPoints(): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let x = BERNIE_WOODS.east + 12; x >= BERNIE_HUT.x; x -= 20) {
    points.push([x, BERNIE_PATH_APPROACH_Y + Math.sin((x + 980) / 88) * 20]);
  }
  for (let y = BERNIE_PATH_APPROACH_Y; y <= BERNIE_HUT.y - 16; y += 16) {
    points.push([BERNIE_HUT.x + Math.sin((y + 40) / 64) * 12, y]);
  }
  points.push([BERNIE_HUT.x, BERNIE_HUT.y - 10]);
  return points;
}

export function dataCenterPathPoints(): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let y = mainPathY(DATA_CENTER.x); y <= DATA_CENTER.y - 20; y += 18) {
    points.push([DATA_CENTER.x + Math.sin((y + 40) / 72) * 16, y]);
  }
  points.push([DATA_CENTER.x, DATA_CENTER.y - 14]);
  return points;
}

export function farmPathPoints(): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const startY = mainPathY(FARM.x);
  const endY = FARM.y + FARM_PLOT.halfH + 6;
  for (let y = startY; y >= endY; y -= 18) {
    points.push([FARM.x + Math.sin((y + 40) / 72) * 16, y]);
  }
  points.push([FARM.x, endY]);
  return points;
}

/** Under the west wall, so the hall sprite hides the pipe's end. */
export const INTAKE_PIPE_END = { x: DATA_CENTER.x - 56, y: DATA_CENTER.y + 22 };

export function intakePipeY(x: number) {
  const span = INTAKE_PIPE_END.x - BERNIE_POND_X;
  const t = span === 0 ? 0 : (x - BERNIE_POND_X) / span;
  const settle = Math.max(0, Math.min(1, (INTAKE_PIPE_END.x - 90 - x) / 220));
  return (
    BERNIE_POND_Y +
    (INTAKE_PIPE_END.y - BERNIE_POND_Y) * t +
    (Math.sin((x + 40) / 150) * 22 + Math.sin((x + 90) / 71) * 10) * settle
  );
}

/** Walkable mud just east of the remaining puddle, on the pipe. */
const INTAKE_X = BERNIE_POND_X + 156;
export const INTAKE = { x: INTAKE_X, y: intakePipeY(INTAKE_X) };

/** True on the dried bank around the remaining water. */
export function nearIntakeRim(x: number, y: number) {
  return onPuddleShore(
    BERNIE_POND_WIDTH,
    BERNIE_POND_HEIGHT,
    berniePondPhase,
    x - BERNIE_POND_X,
    y - BERNIE_POND_Y,
  );
}

export function intakePipePoints(): Array<[number, number]> {
  const points: Array<[number, number]> = [[BERNIE_POND_X, BERNIE_POND_Y]];
  for (let x = BERNIE_POND_X + 16; x < INTAKE_PIPE_END.x; x += 16) {
    points.push([x, intakePipeY(x)]);
  }
  points.push([INTAKE_PIPE_END.x, INTAKE_PIPE_END.y]);
  return points;
}

export function onIntakePipe(x: number, y: number) {
  if (x < BERNIE_POND_X - 36 || x > INTAKE_PIPE_END.x + 28) return false;
  return Math.abs(y - intakePipeY(x)) < 30;
}
