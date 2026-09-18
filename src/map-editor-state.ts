import {
  arrayLooksLikeGround,
  brushRadius,
  diskHitsMarks,
  isGroundKind,
  makeDisk,
  markOpacity,
  markSoftness,
  normalizeGroundMarks,
  parseGroundMarks,
  GROUND_OPACITY_DEFAULT,
  GROUND_SOFTNESS_DEFAULT,
  type GroundBrushSize,
  type GroundDirty,
  type GroundKind,
  type GroundMark,
  type GroundStampKind,
} from "./ground";
import {
  BERNIE,
  CAT_SCALE,
  GRETA,
  MAP_HEIGHT,
  MAP_WIDTH,
  RABBIT,
  SAM,
  UNIQUE_NPC_KINDS,
  WOLFENBERG,
  canHaveSickFoliage,
  isAuthorableWorldKind,
  isPlaceableWorldKind,
  isRotatableWorldKind,
  isUniqueNpcKind,
  nextRotation,
  normalizePlaceVariant,
  normalizeRotation,
  PLACEABLE_VARIANT_LABELS,
  PLACEABLE_WORLD_KINDS,
  type PlaceableWorldKind,
  type UniqueNpcKind,
  type WorldModelKind,
  type WorldProp,
} from "./world-config";
import { WORLD_MODEL_SIZES } from "./world-models";

export type EditorProp = WorldProp & { id: number };

export type EditorTool = PlaceableWorldKind | "select" | "ground";

export type { GroundBrushSize, GroundKind, GroundMark };

export const PLACEABLE_LABELS: Record<PlaceableWorldKind, string> = {
  pine: "Pine",
  oak: "Oak",
  willow: "Willow",
  bush: "Bush",
  flowers: "Flowers",
  stone: "Rock",
  log: "Log",
  grass: "Grass",
  wheat: "Wheat",
  reeds: "Reeds",
  mushroom: "Mushroom",
  moss: "Moss",
  mossLog: "Mossy log",
  fern: "Fern",
  stump: "Stump",
  clover: "Clover",
  fence: "Fence",
  lamp: "Lamp",
};

export type EditorPaletteItem = {
  id: string;
  kind: PlaceableWorldKind;
  variant: number;
  label: string;
};

export function editorPaletteItems(): EditorPaletteItem[] {
  const items: EditorPaletteItem[] = [];
  for (const kind of PLACEABLE_WORLD_KINDS) {
    const variants = PLACEABLE_VARIANT_LABELS[kind];
    if (variants) {
      variants.forEach((label, variant) => {
        items.push({ id: `${kind}-${variant}`, kind, variant, label });
      });
      continue;
    }
    items.push({ id: kind, kind, variant: 0, label: PLACEABLE_LABELS[kind] });
  }
  return items;
}

export function placeableLabel(kind: PlaceableWorldKind, variant = 0) {
  const variants = PLACEABLE_VARIANT_LABELS[kind];
  if (!variants) return PLACEABLE_LABELS[kind];
  return variants[normalizePlaceVariant(kind, variant)]!;
}

export function placeableDefaultScale(kind: PlaceableWorldKind) {
  return kind === "mushroom" ? 0.6 : 1;
}

export const NPC_LABELS: Record<UniqueNpcKind, string> = {
  bernie: "Bernie",
  sam: "Sam",
  rabbit: "Hopsk",
  greta: "Greta",
  wolfenberg: "Wolfenberg",
};

export const DEFAULT_NPC_PROPS: Record<UniqueNpcKind, WorldProp> = {
  bernie: { kind: "bernie", x: BERNIE.x, y: BERNIE.y, scale: CAT_SCALE, seed: 0, variant: 0 },
  sam: { kind: "sam", x: SAM.x, y: SAM.y, scale: CAT_SCALE, seed: 0, variant: 0 },
  rabbit: { kind: "rabbit", x: RABBIT.x, y: RABBIT.y, scale: CAT_SCALE, seed: 0, variant: 0 },
  greta: { kind: "greta", x: GRETA.x, y: GRETA.y, scale: CAT_SCALE, seed: 0, variant: 0 },
  wolfenberg: { kind: "wolfenberg", x: WOLFENBERG.x, y: WOLFENBERG.y, scale: CAT_SCALE, seed: 0, variant: 0 },
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

/** Screen pixels of extra pan so map edges can sit in the open canvas. */
export const EDITOR_OVERSCROLL_PX = {
  left: 640,
  right: 680,
  top: 420,
  bottom: 360,
} as const;

export function cameraPanBounds(mapSize: number, viewSize: number, overscrollMin: number, overscrollMax: number) {
  const edge = Math.max(0, mapSize / 2 - viewSize / 2);
  return { min: -edge - overscrollMin, max: edge + overscrollMax };
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
  if (prop.sick && canHaveSickFoliage(prop.kind)) next.sick = true;
  if (isRotatableWorldKind(prop.kind)) {
    const rot = normalizeRotation(prop.rot);
    if (rot) next.rot = rot;
  }
  return next;
}

function spriteCenterY(kind: WorldModelKind) {
  if (kind === "cat" || kind === "bernie" || kind === "sam" || kind === "rabbit" || kind === "greta" || kind === "wolfenberg") {
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

export function hitContains(prop: WorldProp, x: number, y: number, pad = 0) {
  const box = propCenter(prop);
  const dx = x - box.x;
  const dy = y - box.y;
  const c = Math.cos(box.rot);
  const s = Math.sin(box.rot);
  const localX = dx * c + dy * s;
  const localY = -dx * s + dy * c;
  return Math.abs(localX) <= box.width / 2 + pad && Math.abs(localY) <= box.height / 2 + pad;
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
export function hitTest<T extends WorldProp>(props: readonly T[], x: number, y: number, pad = 0): T | undefined {
  let best: T | undefined;
  for (const prop of props) {
    if (!hitContains(prop, x, y, pad)) continue;
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

function parsePropList(parsed: unknown): WorldProp[] {
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

export function parseWorldPropsJson(text: string): WorldProp[] {
  return parsePropList(JSON.parse(toJsonArray(text, "WORLD_PROPS")));
}

export function parseWorldGroundJson(text: string): GroundMark[] | undefined {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      if (!arrayLooksLikeGround(parsed)) return undefined;
      return parseGroundMarks(parsed);
    }
    if (parsed && typeof parsed === "object" && "ground" in parsed) {
      return parseGroundMarks((parsed as { ground: unknown }).ground);
    }
  } catch {
    /* TypeScript source */
  }
  const named = extractNamedArray(trimmed, "WORLD_GROUND");
  if (!named) return undefined;
  try {
    return parseGroundMarks(JSON.parse(tsArrayToJson(named)));
  } catch {
    return undefined;
  }
}

function extractNamedArray(text: string, name: string) {
  const index = text.indexOf(name);
  if (index < 0) return undefined;
  const assign = text.indexOf("= [", index);
  if (assign < 0) return undefined;
  const start = assign + 2;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return undefined;
}

function tsArrayToJson(slice: string) {
  return slice
    .replace(/\b(kind|x|y|scale|seed|variant|sick|rot|tx|ty|shape|r|halfW|halfH|opacity|softness):/g, '"$1":')
    .replace(/,(\s*[}\]])/g, "$1");
}

function toJsonArray(text: string, name = "WORLD_PROPS") {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) return trimmed;
  const named = extractNamedArray(trimmed, name);
  if (named) return tsArrayToJson(named);
  const start = trimmed.indexOf("= [") >= 0 ? trimmed.indexOf("= [") + 2 : trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("Paste must include a WORLD_PROPS array");
  return tsArrayToJson(trimmed.slice(start, end + 1));
}

export function serializeWorldPropsJson(props: readonly WorldProp[]): string {
  return `${JSON.stringify(ensureUniqueNpcs(props.map(stripProp)), null, 2)}\n`;
}

export const EDITOR_DRAFT_KEY = "mosswhiskers-map-editor-v1";

export type EditorCameraDraft = { x: number; y: number; zoom: number };

export type EditorDraft = {
  props: WorldProp[];
  ground?: GroundMark[];
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
      const record = parsed as { props: unknown; ground?: unknown; camera?: unknown };
      return {
        props: parseWorldPropsJson(JSON.stringify(record.props)),
        ground: record.ground != null ? parseGroundMarks(record.ground) : undefined,
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
    ground: draft.ground ? normalizeGroundMarks(draft.ground) : undefined,
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

function groundLiteral(mark: GroundMark) {
  const fields = [
    `x: ${compactNumber(mark.x)}`,
    `y: ${compactNumber(mark.y)}`,
    `r: ${compactNumber(mark.r)}`,
    `kind: "${mark.kind}"`,
  ];
  if (mark.opacity != null) fields.push(`opacity: ${compactNumber(mark.opacity)}`);
  if (mark.softness != null) fields.push(`softness: ${compactNumber(mark.softness)}`);
  return `  { ${fields.join(", ")} },`;
}

export function serializeWorldPropsTs(props: readonly WorldProp[], ground: readonly GroundMark[] = []): string {
  const body = ensureUniqueNpcs(props.map(stripProp)).map(propLiteral).join("\n");
  const groundBody = normalizeGroundMarks(ground).map(groundLiteral).join("\n");
  // The ground array stays one flat literal so older editor builds can still
  // parse it; tsc cannot form a union that wide, hence the suppression.
  const groundGuard = "// @ts-ignore TS2590: union too complex for a generated array this large.";
  return `import type { GroundMark } from "./ground";\nimport type { WorldProp } from "./world-config";\n\nexport const WORLD_PROPS: WorldProp[] = [\n${body}\n];\n\n${groundGuard}\nexport const WORLD_GROUND: GroundMark[] = [\n${groundBody}\n];\n`;
}

export function toEditorProps(props: readonly WorldProp[]): EditorProp[] {
  return ensureUniqueNpcs([...props]).map((prop, index) => ({ ...prop, id: index + 1 }));
}

export function fromEditorProps(props: readonly EditorProp[]): WorldProp[] {
  return ensureUniqueNpcs(props.map(({ id: _id, ...prop }) => prop));
}

export type EditorPoint = {
  x: number;
  y: number;
};

export function pasteAnchor(clip: WorldProp, view?: EditorPoint | null, cursor?: EditorPoint | null) {
  if (cursor) return clampMap(cursor.x, cursor.y);
  if (view) return clampMap(view.x, view.y);
  return clampMap(clip.x + 24, clip.y - 18);
}

type EditorHistoryFrame = {
  props: EditorProp[];
  ground: GroundMark[];
};

export type EditorStore = {
  props: EditorProp[];
  ground: GroundMark[];
  selectedId: number | null;
  tool: EditorTool;
  nextId: number;
  past: EditorHistoryFrame[];
  future: EditorHistoryFrame[];
  clipboard: WorldProp | null;
};

function snapshot(store: EditorStore): EditorHistoryFrame {
  return {
    props: store.props.map((prop) => ({ ...prop })),
    ground: store.ground.map((mark) => ({ ...mark })),
  };
}

function applyFrame(store: EditorStore, frame: EditorHistoryFrame) {
  store.props = frame.props;
  store.ground = frame.ground;
  if (store.selectedId != null && !store.props.some((prop) => prop.id === store.selectedId)) {
    store.selectedId = null;
  }
}

export function createEditorStore(initial: readonly WorldProp[], ground: readonly GroundMark[] = []): EditorStore {
  const props = toEditorProps(initial);
  return {
    props,
    ground: normalizeGroundMarks(ground),
    selectedId: null,
    tool: "select",
    nextId: props.reduce((max, prop) => Math.max(max, prop.id), 0) + 1,
    past: [],
    future: [],
    clipboard: null,
  };
}

export function selectedProp(store: EditorStore): EditorProp | undefined {
  return store.props.find((prop) => prop.id === store.selectedId);
}

function pushHistory(store: EditorStore) {
  store.past.push(snapshot(store));
  if (store.past.length > HISTORY_LIMIT) store.past.shift();
  store.future = [];
}

export function undo(store: EditorStore) {
  const previous = store.past.pop();
  if (!previous) return false;
  store.future.push(snapshot(store));
  applyFrame(store, previous);
  return true;
}

export function redo(store: EditorStore) {
  const next = store.future.pop();
  if (!next) return false;
  store.past.push(snapshot(store));
  applyFrame(store, next);
  return true;
}

export function selectAt(store: EditorStore, x: number, y: number) {
  const hit = hitTest(store.props, x, y);
  store.selectedId = hit?.id ?? null;
  return hit;
}

export type EditorMapClick = "place" | "select" | "clear";

/** Only the select tool picks occupants. A stamp plants even on occupied ground. */
export function mapClick(
  store: EditorStore,
  x: number,
  y: number,
  seed: number,
  rot: number,
  variant: number,
): EditorMapClick {
  if (store.tool !== "select" && store.tool !== "ground") {
    placeAt(store, store.tool, x, y, seed, rot, variant);
    return "place";
  }
  const hit = hitTest(store.props, x, y);
  if (hit) {
    store.selectedId = hit.id;
    return "select";
  }
  store.selectedId = null;
  return "clear";
}

export function placeAt(store: EditorStore, kind: PlaceableWorldKind, x: number, y: number, seed = 1, rot = 0, variant = 0) {
  const at = clampMap(x, y);
  pushHistory(store);
  const prop: EditorProp = {
    id: store.nextId,
    kind,
    x: compactNumber(at.x),
    y: compactNumber(at.y),
    scale: placeableDefaultScale(kind),
    seed,
    variant: normalizePlaceVariant(kind, variant),
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
  if (canHaveSickFoliage(prop.kind)) {
    if (patch.sick === true) prop.sick = true;
    if (patch.sick === false) delete prop.sick;
  } else {
    delete prop.sick;
  }
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

export function canCopyProp(prop: WorldProp | undefined): prop is WorldProp & { kind: PlaceableWorldKind } {
  return Boolean(prop && isPlaceableWorldKind(prop.kind));
}

export function duplicateSelected(store: EditorStore) {
  const prop = selectedProp(store);
  if (!canCopyProp(prop)) return;
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

export function copySelected(store: EditorStore) {
  const prop = selectedProp(store);
  if (!canCopyProp(prop)) return;
  store.clipboard = stripProp(prop);
  return store.clipboard;
}

export function pasteClipboard(store: EditorStore, view?: EditorPoint | null, cursor?: EditorPoint | null) {
  const clip = store.clipboard;
  if (!clip || !isPlaceableWorldKind(clip.kind)) return;
  const at = pasteAnchor(clip, view, cursor);
  pushHistory(store);
  const copy: EditorProp = {
    ...clip,
    id: store.nextId,
    x: compactNumber(at.x),
    y: compactNumber(at.y),
  };
  store.nextId += 1;
  store.props.push(copy);
  store.selectedId = copy.id;
  store.clipboard = stripProp(copy);
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

export function replaceGround(store: EditorStore, marks: readonly GroundMark[]) {
  pushHistory(store);
  store.ground = normalizeGroundMarks(marks);
}

export function replaceMap(store: EditorStore, props: readonly WorldProp[], ground: readonly GroundMark[]) {
  pushHistory(store);
  store.props = toEditorProps(props);
  store.ground = normalizeGroundMarks(ground);
  store.nextId = store.props.reduce((max, prop) => Math.max(max, prop.id), 0) + 1;
  store.selectedId = null;
}

const STAMP_GAP = 0.35;

function appendDisk(
  store: EditorStore,
  x: number,
  y: number,
  radius: number,
  kind: GroundStampKind,
  recordHistory: boolean,
  opacity = GROUND_OPACITY_DEFAULT,
  softness = GROUND_SOFTNESS_DEFAULT,
) {
  const dirty: GroundDirty[] = [];
  const last = store.ground.at(-1);
  if (
    last
    && last.kind === kind
    && last.r === radius
    && Math.abs(markOpacity(last) - opacity) < 0.02
    && Math.abs(markSoftness(last) - softness) < 0.02
  ) {
    const dist = Math.hypot(last.x - x, last.y - y);
    const step = Math.max(4, radius * STAMP_GAP);
    if (!recordHistory) {
      if (dist < step) return dirty;
      const next = store.ground.slice();
      const ux = (x - last.x) / dist;
      const uy = (y - last.y) / dist;
      for (let along = step; along < dist - step * 0.25; along += step) {
        const stamp = makeDisk(last.x + ux * along, last.y + uy * along, radius, kind, opacity, softness);
        next.push(stamp);
        dirty.push({ x: stamp.x, y: stamp.y, r: radius, softness });
      }
      const stamp = makeDisk(x, y, radius, kind, opacity, softness);
      next.push(stamp);
      dirty.push({ x: stamp.x, y: stamp.y, r: radius, softness });
      store.ground = next;
      return dirty;
    }
  }
  if (kind === "erase" && !diskHitsMarks(store.ground, x, y, radius, softness)) return dirty;
  if (recordHistory) pushHistory(store);
  const stamp = makeDisk(x, y, radius, kind, opacity, softness);
  store.ground = [...store.ground, stamp];
  dirty.push({ x: stamp.x, y: stamp.y, r: radius, softness });
  return dirty;
}

export function paintGroundAt(
  store: EditorStore,
  x: number,
  y: number,
  kind: GroundKind,
  size: GroundBrushSize,
  recordHistory: boolean,
  opacity = GROUND_OPACITY_DEFAULT,
  softness = GROUND_SOFTNESS_DEFAULT,
) {
  if (!isGroundKind(kind)) return [];
  return appendDisk(store, x, y, brushRadius(size), kind, recordHistory, opacity, softness);
}

export function eraseGroundAt(
  store: EditorStore,
  x: number,
  y: number,
  size: GroundBrushSize,
  recordHistory: boolean,
  opacity = GROUND_OPACITY_DEFAULT,
  softness = GROUND_SOFTNESS_DEFAULT,
) {
  return appendDisk(store, x, y, brushRadius(size), "erase", recordHistory, opacity, softness);
}
