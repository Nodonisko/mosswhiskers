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
/** Seconds the failed-interact Meow hangs above the cat. */
export const MEOW_DURATION = 1.15;

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
/** On the path in front of the door, facing south toward anyone who walks up. */
export const BERNIE = { x: BERNIE_HUT.x + 100, y: BERNIE_HUT.y - 35 };
export const BERNIE_NAME = "Bernie";
export const BERNIE_POND_X = -920;
export const BERNIE_POND_Y = 800;
export const BERNIE_POND_WIDTH = 680;
export const BERNIE_POND_HEIGHT = 410;
export const BERNIE_POND_SEED = 3311;
/** East-west approach stays south of the dried pond, then turns north to the hut. */
export const BERNIE_PATH_APPROACH_Y = 500;

export type WorldModelKind =
  | "pine"
  | "oak"
  | "willow"
  | "bush"
  | "den"
  | "hut"
  | "bernie"
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

/** Ground footprint of the trunk only, in native pixels / world units at scale 1. */
export const TREE_TRUNK_HITBOX: Partial<
  Record<WorldModelKind, readonly [halfW: number, halfH: number]>
> = {
  pine: [8, 5],
  oak: [11, 6],
  willow: [9, 5],
  hut: [46, 16],
  bernie: [8, 6],
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
