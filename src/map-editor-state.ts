import {
  BERNIE,
  CAT_SCALE,
  MAP_HEIGHT,
  MAP_WIDTH,
  RABBIT,
  SAM,
  UNIQUE_NPC_KINDS,
  isAuthorableWorldKind,
  isPlaceableWorldKind,
  isRotatableWorldKind,
  isUniqueNpcKind,
  nextRotation,
  normalizeFlowerVariant,
  normalizeRotation,
  PLACEABLE_WORLD_KINDS,
  type PlaceableWorldKind,
  type UniqueNpcKind,
  type WorldModelKind,
  type WorldProp,
} from "./world-config";
import { WORLD_MODEL_SIZES } from "./world-models";

export type EditorProp = WorldProp & { id: number };

export type EditorTool = PlaceableWorldKind | "select";

export const PLACEABLE_LABELS: Record<PlaceableWorldKind, string> = {
  pine: "Pine",
  oak: "Oak",
  willow: "Willow",
  bush: "Bush",
  flowers: "Flowers",
  stone: "Rock",
  log: "Log",
  fence: "Fence",
  lamp: "Lamp",
};

export const FLOWER_VARIANT_LABELS = ["White flowers", "Blue flowers", "Pink flowers"] as const;

export type EditorPaletteItem = {
  id: string;
  kind: PlaceableWorldKind;
  variant: number;
  label: string;
};

export function editorPaletteItems(): EditorPaletteItem[] {
  const items: EditorPaletteItem[] = [];
  for (const kind of PLACEABLE_WORLD_KINDS) {
    if (kind === "flowers") {
      FLOWER_VARIANT_LABELS.forEach((label, variant) => {
        items.push({ id: `flowers-${variant}`, kind, variant, label });
      });
      continue;
    }
    items.push({ id: kind, kind, variant: 0, label: PLACEABLE_LABELS[kind] });
  }
  return items;
}

export function placeableLabel(kind: PlaceableWorldKind, variant = 0) {
  return kind === "flowers" ? FLOWER_VARIANT_LABELS[normalizeFlowerVariant(variant)] : PLACEABLE_LABELS[kind];
}

export const NPC_LABELS: Record<UniqueNpcKind, string> = {
  bernie: "Bernie",
  sam: "Sam",
  rabbit: "Hopsk",
};

export const DEFAULT_NPC_PROPS: Record<UniqueNpcKind, WorldProp> = {
  bernie: { kind: "bernie", x: BERNIE.x, y: BERNIE.y, scale: CAT_SCALE, seed: 0, variant: 0 },
  sam: { kind: "sam", x: SAM.x, y: SAM.y, scale: CAT_SCALE, seed: 0, variant: 0 },
  rabbit: { kind: "rabbit", x: RABBIT.x, y: RABBIT.y, scale: CAT_SCALE, seed: 0, variant: 0 },
};

const HISTORY_LIMIT = 80;
const MAP_HALF_W = MAP_WIDTH / 2;
const MAP_HALF_H = MAP_HEIGHT / 2;

export function clampMap(x: number, y: number) {
  return {
    x: Math.max(-MAP_HALF_W + 20, Math.min(MAP_HALF_W - 20, x)),
    y: Math.max(-MAP_HALF_H + 20, Math.min(MAP_HALF_H - 20, y)),
  };
}

export function compactNumber(value: number) {
  if (Number.isInteger(value)) return value;
  const trimmed = Number(value.toFixed(4));
  return Number.isInteger(trimmed) ? trimmed : trimmed;
}

export function stripProp(prop: WorldProp): WorldProp {
  const next: WorldProp = {
    kind: prop.kind,
    x: compactNumber(prop.x),
    y: compactNumber(prop.y),
    scale: compactNumber(prop.scale),
    seed: prop.seed,
    variant: prop.variant,
  };
  if (prop.sick) next.sick = true;
  if (isRotatableWorldKind(prop.kind)) {
    const rot = normalizeRotation(prop.rot);
    if (rot) next.rot = rot;
  }
  return next;
}

function spriteCenterY(kind: WorldModelKind) {
  if (kind === "cat" || kind === "bernie" || kind === "sam" || kind === "rabbit") {
    const height = WORLD_MODEL_SIZES[kind][1];
    return (height - 30) / height;
  }
  return 0;
}

export function propCenter(prop: WorldProp) {
  const [nativeW, nativeH] = WORLD_MODEL_SIZES[prop.kind];
  const width = nativeW * prop.scale;
  const height = nativeH * prop.scale;
  const originY = spriteCenterY(prop.kind);
  const centerY = originY === 0 ? 0.5 : originY;
  return {
    x: prop.x,
    y: prop.y + centerY * height,
    width,
    height,
    rot: isRotatableWorldKind(prop.kind) ? normalizeRotation(prop.rot) * Math.PI / 180 : 0,
  };
}

export function propCorners(prop: WorldProp) {
  const { x, y, width, height, rot } = propCenter(prop);
  const hw = width / 2;
  const hh = height / 2;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [
    { x: x - hw * c + hh * s, y: y - hw * s - hh * c },
    { x: x + hw * c + hh * s, y: y + hw * s - hh * c },
    { x: x + hw * c - hh * s, y: y + hw * s + hh * c },
    { x: x - hw * c - hh * s, y: y - hw * s + hh * c },
  ];
}

export function propBounds(prop: WorldProp) {
  const corners = propCorners(prop);
  return {
    left: Math.min(corners[0]!.x, corners[1]!.x, corners[2]!.x, corners[3]!.x),
    right: Math.max(corners[0]!.x, corners[1]!.x, corners[2]!.x, corners[3]!.x),
    bottom: Math.min(corners[0]!.y, corners[1]!.y, corners[2]!.y, corners[3]!.y),
    top: Math.max(corners[0]!.y, corners[1]!.y, corners[2]!.y, corners[3]!.y),
  };
}

export function hitContains(prop: WorldProp, x: number, y: number) {
  const box = propCenter(prop);
  const dx = x - box.x;
  const dy = y - box.y;
  const c = Math.cos(box.rot);
  const s = Math.sin(box.rot);
  const localX = dx * c + dy * s;
  const localY = -dx * s + dy * c;
  return Math.abs(localX) <= box.width / 2 && Math.abs(localY) <= box.height / 2;
}

export const MIN_PROP_SCALE = 0.4;
export const MAX_PROP_SCALE = 2.6;

export function canScaleProp(prop: WorldProp) {
  return isPlaceableWorldKind(prop.kind);
}

/** Corner order: south-west, south-east, north-east, north-west. */
export function handleIndexAt(prop: WorldProp, x: number, y: number, radius: number): number | undefined {
  const action = cornerActionAt(prop, x, y, radius, 0);
  return action?.type === "scale" ? action.handle : undefined;
}

export type CornerAction = { type: "scale" | "rotate"; handle: number };

/**
 * Scale on the corner square. Rotate in the Figma-style band just outside
 * that corner, only for fences and logs.
 */
export function cornerActionAt(
  prop: WorldProp,
  x: number,
  y: number,
  scaleRadius: number,
  rotateRadius: number,
): CornerAction | undefined {
  if (!canScaleProp(prop)) return undefined;
  const box = propCenter(prop);
  const dx = x - box.x;
  const dy = y - box.y;
  const c = Math.cos(box.rot);
  const s = Math.sin(box.rot);
  const localX = dx * c + dy * s;
  const localY = -dx * s + dy * c;
  const hw = box.width / 2;
  const hh = box.height / 2;
  const corners = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ] as const;
  let best: CornerAction | undefined;
  let bestDist = Infinity;
  for (let i = 0; i < 4; i++) {
    const cx = corners[i]![0];
    const cy = corners[i]![1];
    const ox = localX - cx;
    const oy = localY - cy;
    const dist = Math.hypot(ox, oy);
    if (dist > Math.max(scaleRadius, rotateRadius) || dist >= bestDist) continue;
    if (dist <= scaleRadius) {
      best = { type: "scale", handle: i };
      bestDist = dist;
      continue;
    }
    if (!isRotatableWorldKind(prop.kind) || dist > rotateRadius) continue;
    const sx = cx === 0 ? 1 : Math.sign(cx);
    const sy = cy === 0 ? 1 : Math.sign(cy);
    if (ox * sx < -scaleRadius * 0.25 || oy * sy < -scaleRadius * 0.25) continue;
    best = { type: "rotate", handle: i };
    bestDist = dist;
  }
  return best;
}

export function rotateByPointer(
  store: EditorStore,
  id: number,
  origin: WorldProp,
  startAngle: number,
  pointerX: number,
  pointerY: number,
  recordHistory: boolean,
  snap = false,
) {
  const prop = store.props.find((item) => item.id === id);
  if (!prop || !isRotatableWorldKind(prop.kind)) return;
  if (recordHistory) pushHistory(store);
  const box = propCenter(origin);
  const angle = Math.atan2(pointerY - box.y, pointerX - box.x);
  let degrees = (origin.rot ?? 0) + (angle - startAngle) * (180 / Math.PI);
  if (snap) degrees = Math.round(degrees / 15) * 15;
  const rot = normalizeRotation(degrees);
  if (rot) prop.rot = rot;
  else delete prop.rot;
}

export function scaleByHandle(
  store: EditorStore,
  id: number,
  handle: number,
  origin: WorldProp,
  pointerX: number,
  pointerY: number,
  recordHistory: boolean,
) {
  const prop = store.props.find((item) => item.id === id);
  if (!prop || !canScaleProp(prop)) return;
  if (recordHistory) pushHistory(store);
  const startCorners = propCorners(origin);
  const opposite = startCorners[(handle + 2) % 4]!;
  const dragged = startCorners[handle]!;
  const axisX = dragged.x - opposite.x;
  const axisY = dragged.y - opposite.y;
  const axisLen2 = axisX * axisX + axisY * axisY;
  if (axisLen2 < 1e-8) return;
  const factor = ((pointerX - opposite.x) * axisX + (pointerY - opposite.y) * axisY) / axisLen2;
  const scale = compactNumber(Math.max(MIN_PROP_SCALE, Math.min(MAX_PROP_SCALE, origin.scale * factor)));
  const shifted = propCorners({ ...origin, scale })[(handle + 2) % 4]!;
  const at = clampMap(origin.x + (opposite.x - shifted.x), origin.y + (opposite.y - shifted.y));
  prop.x = compactNumber(at.x);
  prop.y = compactNumber(at.y);
  prop.scale = scale;
}

/** Frontmost hit: southern sprites draw on top. */
export function hitTest<T extends WorldProp>(props: readonly T[], x: number, y: number): T | undefined {
  let best: T | undefined;
  for (const prop of props) {
    if (!hitContains(prop, x, y)) continue;
    if (!best || prop.y < best.y) best = prop;
  }
  return best;
}

export function ensureUniqueNpcs(props: WorldProp[]): WorldProp[] {
  const kept: WorldProp[] = [];
  const seen = new Set<UniqueNpcKind>();
  for (const prop of props) {
    if (!isAuthorableWorldKind(prop.kind)) continue;
    if (isUniqueNpcKind(prop.kind)) {
      if (seen.has(prop.kind)) continue;
      seen.add(prop.kind);
      kept.push({ ...DEFAULT_NPC_PROPS[prop.kind], x: prop.x, y: prop.y, scale: CAT_SCALE });
      continue;
    }
    kept.push(stripProp(prop));
  }
  for (const kind of UNIQUE_NPC_KINDS) {
    if (seen.has(kind)) continue;
    kept.push({ ...DEFAULT_NPC_PROPS[kind] });
  }
  return kept;
}

export function parseWorldPropsJson(text: string): WorldProp[] {
  const parsed = JSON.parse(toJsonArray(text)) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Paste must be a WORLD_PROPS array");
  const props: WorldProp[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.kind !== "string" || !isAuthorableWorldKind(record.kind)) continue;
    if (typeof record.x !== "number" || typeof record.y !== "number") continue;
    props.push({
      kind: record.kind,
      x: record.x,
      y: record.y,
      scale: typeof record.scale === "number" ? record.scale : 1,
      seed: typeof record.seed === "number" ? Math.round(record.seed) : 1,
      variant: typeof record.variant === "number" ? Math.round(record.variant) : 0,
      sick: record.sick === true ? true : undefined,
      rot: isRotatableWorldKind(record.kind) ? normalizeRotation(record.rot) || undefined : undefined,
    });
  }
  return ensureUniqueNpcs(props);
}

function toJsonArray(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) return trimmed;
  const start = trimmed.indexOf("= [") >= 0 ? trimmed.indexOf("= [") + 2 : trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("Paste must include a WORLD_PROPS array");
  return trimmed.slice(start, end + 1)
    .replace(/\b(kind|x|y|scale|seed|variant|sick|rot):/g, '"$1":')
    .replace(/,(\s*[}\]])/g, "$1");
}

export function serializeWorldPropsJson(props: readonly WorldProp[]): string {
  return `${JSON.stringify(ensureUniqueNpcs(props.map(stripProp)), null, 2)}\n`;
}

export const EDITOR_DRAFT_KEY = "mosswhiskers-map-editor-v1";

export type EditorCameraDraft = { x: number; y: number; zoom: number };

export type EditorDraft = {
  props: WorldProp[];
  camera?: EditorCameraDraft;
};

function parseCamera(value: unknown): EditorCameraDraft | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.x !== "number" || typeof record.y !== "number" || typeof record.zoom !== "number") {
    return undefined;
  }
  return { x: record.x, y: record.y, zoom: record.zoom };
}

/** Browser draft: surviving reload. Reset must drop this, not rewrite source into it. */
export function parseEditorDraft(raw: string | null): EditorDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return { props: parseWorldPropsJson(raw) };
    if (parsed && typeof parsed === "object" && "props" in parsed) {
      const record = parsed as { props: unknown; camera?: unknown };
      return {
        props: parseWorldPropsJson(JSON.stringify(record.props)),
        camera: parseCamera(record.camera),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function serializeEditorDraft(draft: EditorDraft): string {
  return JSON.stringify({
    props: ensureUniqueNpcs(draft.props.map(stripProp)),
    camera: draft.camera,
  });
}

function propLiteral(prop: WorldProp) {
  const fields = [
    `kind: "${prop.kind}"`,
    `x: ${compactNumber(prop.x)}`,
    `y: ${compactNumber(prop.y)}`,
    `scale: ${compactNumber(prop.scale)}`,
    `seed: ${prop.seed}`,
    `variant: ${prop.variant}`,
  ];
  if (prop.sick) fields.push("sick: true");
  if (prop.rot) fields.push(`rot: ${prop.rot}`);
  return `  { ${fields.join(", ")} },`;
}

export function serializeWorldPropsTs(props: readonly WorldProp[]): string {
  const body = ensureUniqueNpcs(props.map(stripProp)).map(propLiteral).join("\n");
  return `import type { WorldProp } from "./world-config";\n\nexport const WORLD_PROPS: WorldProp[] = [\n${body}\n];\n`;
}

export function toEditorProps(props: readonly WorldProp[]): EditorProp[] {
  return ensureUniqueNpcs([...props]).map((prop, index) => ({ ...prop, id: index + 1 }));
}

export function fromEditorProps(props: readonly EditorProp[]): WorldProp[] {
  return ensureUniqueNpcs(props.map(({ id: _id, ...prop }) => prop));
}

export type EditorStore = {
  props: EditorProp[];
  selectedId: number | null;
  tool: EditorTool;
  nextId: number;
  past: EditorProp[][];
  future: EditorProp[][];
};

function snapshot(props: readonly EditorProp[]): EditorProp[] {
  return props.map((prop) => ({ ...prop }));
}

export function createEditorStore(initial: readonly WorldProp[]): EditorStore {
  const props = toEditorProps(initial);
  return {
    props,
    selectedId: null,
    tool: "select",
    nextId: props.reduce((max, prop) => Math.max(max, prop.id), 0) + 1,
    past: [],
    future: [],
  };
}

export function selectedProp(store: EditorStore): EditorProp | undefined {
  return store.props.find((prop) => prop.id === store.selectedId);
}

function pushHistory(store: EditorStore) {
  store.past.push(snapshot(store.props));
  if (store.past.length > HISTORY_LIMIT) store.past.shift();
  store.future = [];
}

export function undo(store: EditorStore) {
  const previous = store.past.pop();
  if (!previous) return false;
  store.future.push(snapshot(store.props));
  store.props = previous;
  if (store.selectedId != null && !store.props.some((prop) => prop.id === store.selectedId)) {
    store.selectedId = null;
  }
  return true;
}

export function redo(store: EditorStore) {
  const next = store.future.pop();
  if (!next) return false;
  store.past.push(snapshot(store.props));
  store.props = next;
  if (store.selectedId != null && !store.props.some((prop) => prop.id === store.selectedId)) {
    store.selectedId = null;
  }
  return true;
}

export function selectAt(store: EditorStore, x: number, y: number) {
  const hit = hitTest(store.props, x, y);
  store.selectedId = hit?.id ?? null;
  return hit;
}

export function placeAt(store: EditorStore, kind: PlaceableWorldKind, x: number, y: number, seed = 1, rot = 0, variant = 0) {
  const at = clampMap(x, y);
  pushHistory(store);
  const prop: EditorProp = {
    id: store.nextId,
    kind,
    x: compactNumber(at.x),
    y: compactNumber(at.y),
    scale: 1,
    seed,
    variant: kind === "flowers" ? normalizeFlowerVariant(variant) : Math.max(0, Math.round(variant)),
  };
  const angle = isRotatableWorldKind(kind) ? normalizeRotation(rot) : 0;
  if (angle) prop.rot = angle;
  store.nextId += 1;
  store.props.push(prop);
  store.selectedId = prop.id;
  return prop;
}

export function moveById(store: EditorStore, id: number, x: number, y: number, recordHistory: boolean) {
  const prop = store.props.find((item) => item.id === id);
  if (!prop) return;
  if (recordHistory) pushHistory(store);
  const at = clampMap(x, y);
  prop.x = compactNumber(at.x);
  prop.y = compactNumber(at.y);
}

export function updateById(store: EditorStore, id: number, patch: Partial<Omit<WorldProp, "kind">>) {
  const prop = store.props.find((item) => item.id === id);
  if (!prop) return;
  if (isUniqueNpcKind(prop.kind)) {
    if (patch.x != null || patch.y != null) {
      pushHistory(store);
      const at = clampMap(patch.x ?? prop.x, patch.y ?? prop.y);
      prop.x = compactNumber(at.x);
      prop.y = compactNumber(at.y);
    }
    return;
  }
  pushHistory(store);
  if (patch.x != null || patch.y != null) {
    const at = clampMap(patch.x ?? prop.x, patch.y ?? prop.y);
    prop.x = compactNumber(at.x);
    prop.y = compactNumber(at.y);
  }
  if (patch.scale != null) prop.scale = compactNumber(Math.max(MIN_PROP_SCALE, Math.min(MAX_PROP_SCALE, patch.scale)));
  if (patch.seed != null) prop.seed = Math.round(patch.seed);
  if (patch.variant != null) prop.variant = Math.max(0, Math.round(patch.variant));
  if (patch.sick === true) prop.sick = true;
  if (patch.sick === false) delete prop.sick;
  if (patch.rot != null && isRotatableWorldKind(prop.kind)) {
    const rot = normalizeRotation(patch.rot);
    if (rot) prop.rot = rot;
    else delete prop.rot;
  }
}

export function removeSelected(store: EditorStore) {
  const prop = selectedProp(store);
  if (!prop || isUniqueNpcKind(prop.kind)) return false;
  pushHistory(store);
  store.props = store.props.filter((item) => item.id !== prop.id);
  store.selectedId = null;
  return true;
}

export function duplicateSelected(store: EditorStore) {
  const prop = selectedProp(store);
  if (!prop || isUniqueNpcKind(prop.kind) || !isPlaceableWorldKind(prop.kind)) return;
  const at = clampMap(prop.x + 24, prop.y - 18);
  pushHistory(store);
  const copy: EditorProp = {
    ...prop,
    id: store.nextId,
    x: compactNumber(at.x),
    y: compactNumber(at.y),
  };
  store.nextId += 1;
  store.props.push(copy);
  store.selectedId = copy.id;
  return copy;
}

export function rotateSelected(store: EditorStore, step = 15) {
  const prop = selectedProp(store);
  if (!prop || !isRotatableWorldKind(prop.kind)) return false;
  updateById(store, prop.id, { rot: nextRotation(prop.rot, step) });
  return true;
}

export function nextSeed(store: EditorStore) {
  return store.props.reduce((max, prop) => Math.max(max, prop.seed), 0) + 1;
}

export function replaceProps(store: EditorStore, props: readonly WorldProp[]) {
  pushHistory(store);
  store.props = toEditorProps(props);
  store.nextId = store.props.reduce((max, prop) => Math.max(max, prop.id), 0) + 1;
  store.selectedId = null;
}
