export const VIEW_HEIGHT = 540;
export const MAP_WIDTH = 2600;
export const MAP_HEIGHT = 1800;
export const MAP_WALK_MARGIN = 45;
export const CAT_SPEED = 118;
/** Paw-level body used against trunks and other ground solids. */
export const CAT_COLLISION = { halfW: 8, halfH: 6 };
export const CLAW_DURATION = 0.3;
/** Seconds before a killed mouse scurries back. */
export const MOUSE_RESPAWN = 40;
/** Claw reach in front of the cat, in world units. */
export const CLAW_RANGE = { forward: 46, back: 10, side: 26 };

export const LAKE_X = -380;
export const LAKE_Y = -610;
export const LAKE_WIDTH = 900;
export const LAKE_HEIGHT = 520;
export const PIER_X = LAKE_X + 70;
export const PIER_Y = LAKE_Y + 153;

export const mainPathY = (x: number) => -190 + Math.sin(x / 235) * 58 + Math.sin(x / 93) * 22;
export const southPathX = (y: number) => 655 + Math.sin((y + 290) / 145) * 82;
export const denPathX = (y: number) => Math.sin((y + 170) / 56) * 24;
