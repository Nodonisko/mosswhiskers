import { lakeContainsLocalPoint, lakePhaseFromSeed } from "./lake-shape";
import { pierContainsLocalPoint } from "./pier-shape";
import { pondPuddleContains } from "./pond-shape";
import { seeded } from "./rng";
import { hitsSolid, type FishSpec, type Interactable, type MouseSpec, type Solid, type Walkable } from "./sim";
import {
  BERNIE_HUT,
  BERNIE_POND_HEIGHT,
  BERNIE_POND_SEED,
  BERNIE_POND_WIDTH,
  BERNIE_POND_X,
  BERNIE_POND_Y,
  BERNIE_WOODS,
  CAT_COLLISION,
  DATA_CENTER,
  DATA_CENTER_RACKS,
  DATA_CENTER_SCALE,
  FARM,
  FARM_CARROTS,
  FARM_PLOT,
  FARM_SHED,
  FARM_SHED_SCALE,
  INTAKE,
  LAKE_HEIGHT,
  LAKE_SEED,
  LAKE_WIDTH,
  LAKE_X,
  LAKE_Y,
  MAILBOX,
  SCATTER_HEIGHT,
  SCATTER_WIDTH,
  MOUSE_SEED,
  PIER_HEIGHT,
  PIER_WIDTH,
  PIER_X,
  PIER_Y,
  mainPathY,
  onIntakePipe,
  southPathX,
  TREE_KINDS,
  TREE_TRUNK_HITBOX,
  isRotatableWorldKind,
  normalizeRotation,
  type WorldModelKind,
  type WorldProp,
} from "./world-config";
import { WORLD_MODEL_SIZES } from "./world-models";
import { WORLD_PROPS } from "./world-props";

export type { WorldProp };

export type WorldLayout = {
  props: WorldProp[];
  fish: FishSpec[];
  mice: MouseSpec[];
  trunks: Solid[];
  trees: Solid[];
  interactables: Interactable[];
};

export const LAKE_WILLOWS: Array<[number, number, number]> = WORLD_PROPS
  .filter((prop) => prop.kind === "willow")
  .map((prop) => [prop.x, prop.y, prop.scale]);

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

function trunksFromProps(props: readonly WorldProp[], kinds?: ReadonlySet<WorldModelKind>): Solid[] {
  const trunks: Solid[] = [];
  for (const prop of props) {
    if (kinds && !kinds.has(prop.kind)) continue;
    const trunk = TREE_TRUNK_HITBOX[prop.kind];
    if (trunk) {
      const scale = prop.scale;
      const halfW = trunk[0] * scale;
      const halfH = trunk[1] * scale;
      const offsetY = (trunk[2] ?? 0) * scale;
      if (isRotatableWorldKind(prop.kind)) {
        const lift = WORLD_MODEL_SIZES[prop.kind][1] * scale / 2;
        const rot = normalizeRotation(prop.rot) * Math.PI / 180;
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const localY = -lift;
        trunks.push({
          x: prop.x - localY * s,
          y: prop.y + lift + localY * c,
          halfW,
          halfH,
          rot: rot || undefined,
        });
      } else {
        trunks.push({
          x: prop.x,
          y: prop.y + offsetY,
          halfW,
          halfH,
        });
      }
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

function addProp(
  props: WorldProp[],
  kind: WorldModelKind,
  x: number,
  y: number,
  scale = 1,
  seed = 1,
  variant = 0,
) {
  props.push({ kind, x, y, scale, seed, variant });
}

/** Buildings and crops. Vegetation, lamps, and NPCs live in WORLD_PROPS. */
export function createLockedProps(): WorldProp[] {
  const props: WorldProp[] = [];
  addProp(props, "den", 0, 46, 1.12, 22);
  addProp(props, "mailbox", MAILBOX.x, MAILBOX.y, 1.28, 23);
  addProp(props, "mailBubble", MAILBOX.x, MAILBOX.y + 64, 0.92, 26);
  addProp(props, "hut", BERNIE_HUT.x, BERNIE_HUT.y, 1.42, 29);
  addProp(props, "datacenter", DATA_CENTER.x, DATA_CENTER.y, DATA_CENTER_SCALE, 41);
  for (const rack of DATA_CENTER_RACKS) addProp(props, "racks", rack.x, rack.y, rack.scale, rack.seed);
  addProp(props, "shed", FARM_SHED.x, FARM_SHED.y, FARM_SHED_SCALE, 60);
  for (const crop of FARM_CARROTS) addProp(props, "carrot", crop.x, crop.y, crop.scale, crop.seed, crop.variant);
  return props;
}

function npcInteractable(props: readonly WorldProp[], kind: "bernie" | "sam" | "rabbit"): Interactable {
  const prop = props.find((item) => item.kind === kind);
  if (!prop) throw new Error(`${kind} is missing from the authored world props`);
  return { id: kind, kind, x: prop.x, y: prop.y };
}

/** Deterministic map: authored vegetation and NPCs plus fixed landmarks. */
export function createWorldLayout(editable = WORLD_PROPS): WorldLayout {
  const props = [...createLockedProps(), ...editable];

  return {
    props,
    fish: FISH_SPECS,
    mice: createMouseSpecs(),
    trunks: trunksFromProps(props),
    trees: trunksFromProps(props, TREE_KINDS),
    interactables: [
      { id: "mailbox", kind: "mailbox", x: MAILBOX.x, y: MAILBOX.y },
      npcInteractable(editable, "bernie"),
      npcInteractable(editable, "sam"),
      npcInteractable(editable, "rabbit"),
      { id: "intake", kind: "intake", x: INTAKE.x, y: INTAKE.y },
    ],
  };
}
