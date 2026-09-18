import * as THREE from "three";
import { createPixelCanvas, nearestTexture } from "./pixel-canvas";
import { FARM, FARM_PLOT, MAP_HEIGHT, MAP_WIDTH } from "./world-config";

export const GROUND_TILE = 24;
export const GROUND_TEXEL = 3;
const GROUND_CHUNK = 192;
export const GROUND_BRUSH_SIZES = [1, 2, 3] as const;
export type GroundBrushSize = (typeof GROUND_BRUSH_SIZES)[number];
export const GROUND_OPACITY_DEFAULT = 1;
export const GROUND_SOFTNESS_DEFAULT = 1;

export const GROUND_KINDS = ["furrow", "dirt", "dust", "moss", "gravel", "mud", "sand"] as const;
export type GroundKind = (typeof GROUND_KINDS)[number];
export type GroundStampKind = GroundKind | "erase";

export type GroundMark = {
  x: number;
  y: number;
  r: number;
  kind: GroundStampKind;
  opacity?: number;
  softness?: number;
};

export type GroundDirty = { x: number; y: number; r: number; softness?: number };

export const GROUND_LABELS: Record<GroundKind, string> = {
  furrow: "Furrows",
  dirt: "Dirt",
  dust: "Dust",
  moss: "Moss",
  gravel: "Gravel",
  mud: "Mud",
  sand: "Sand",
};

export const GROUND_MINIMAP: Record<GroundKind, string> = {
  furrow: "#6e4a2c",
  dirt: "#8b6c43",
  dust: "#b4a67c",
  moss: "#3d6a38",
  gravel: "#7a7870",
  mud: "#4a3a28",
  sand: "#c4b07a",
};

const GROUND_KIND_SET = new Set<string>(GROUND_KINDS);
const GROUND_KIND_INDEX = new Map<GroundKind, number>(GROUND_KINDS.map((kind, index) => [kind, index]));

export function isGroundKind(value: unknown): value is GroundKind {
  return typeof value === "string" && GROUND_KIND_SET.has(value);
}

export function clampOpacity(value: number) {
  return Math.max(0.1, Math.min(1, value));
}

export function clampSoftness(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function markOpacity(mark: Pick<GroundMark, "opacity">) {
  return mark.opacity == null ? GROUND_OPACITY_DEFAULT : clampOpacity(mark.opacity);
}

export function markSoftness(mark: Pick<GroundMark, "softness">) {
  return mark.softness == null ? GROUND_SOFTNESS_DEFAULT : clampSoftness(mark.softness);
}

export function brushRadius(size: GroundBrushSize) {
  return GROUND_TILE * size;
}

export function diskOuter(radius: number, softness = GROUND_SOFTNESS_DEFAULT) {
  const fadeOut = 0.06 + clampSoftness(softness) * 0.84;
  return radius * (1 + fadeOut);
}

function diskInner(radius: number, softness = GROUND_SOFTNESS_DEFAULT) {
  const fadeIn = 0.04 + clampSoftness(softness) * 0.38;
  return radius * (1 - fadeIn);
}

export function brushWorldSize(size: GroundBrushSize, softness = GROUND_SOFTNESS_DEFAULT) {
  return diskOuter(brushRadius(size), softness) * 2;
}

function onMap(x: number, y: number) {
  return Math.abs(x) <= MAP_WIDTH / 2 && Math.abs(y) <= MAP_HEIGHT / 2;
}

function clampMap(x: number, y: number) {
  return {
    x: Math.max(-MAP_WIDTH / 2, Math.min(MAP_WIDTH / 2, x)),
    y: Math.max(-MAP_HEIGHT / 2, Math.min(MAP_HEIGHT / 2, y)),
  };
}

function smootherstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function diskCoverage(worldX: number, worldY: number, x: number, y: number, radius: number, softness: number) {
  const dist = Math.hypot(worldX - x, worldY - y);
  const inner = diskInner(radius, softness);
  const outer = diskOuter(radius, softness);
  if (dist >= outer) return 0;
  if (dist <= inner) return 1;
  const falloff = smootherstep(inner, outer, dist);
  return (1 - falloff) * (1 - falloff);
}

export function markCoverage(mark: GroundMark, worldX: number, worldY: number) {
  return diskCoverage(worldX, worldY, mark.x, mark.y, mark.r, markSoftness(mark)) * markOpacity(mark);
}

/**
 * markCoverage with the per-mark constants hoisted out, for callers that walk
 * many texels of one dab. Squared radii keep the sqrt on the fade ring only.
 */
type MarkKernel = {
  inner: number;
  outer: number;
  innerSq: number;
  outerSq: number;
  opacity: number;
};

function markKernel(mark: GroundMark): MarkKernel {
  const softness = markSoftness(mark);
  const inner = diskInner(mark.r, softness);
  const outer = diskOuter(mark.r, softness);
  return { inner, outer, innerSq: inner * inner, outerSq: outer * outer, opacity: markOpacity(mark) };
}

function kernelCoverage(kernel: MarkKernel, distSq: number) {
  if (distSq >= kernel.outerSq) return 0;
  if (distSq <= kernel.innerSq) return kernel.opacity;
  const falloff = smootherstep(kernel.inner, kernel.outer, Math.sqrt(distSq));
  return (1 - falloff) * (1 - falloff) * kernel.opacity;
}

export function sampleGround(marks: readonly GroundMark[], worldX: number, worldY: number) {
  let kind: GroundKind | undefined;
  let alpha = 0;
  for (const mark of marks) {
    const cover = markCoverage(mark, worldX, worldY);
    if (cover <= 0.02) continue;
    if (mark.kind === "erase") {
      alpha *= 1 - cover;
      if (alpha <= 0.04) {
        kind = undefined;
        alpha = 0;
      }
      continue;
    }
    alpha = cover + alpha * (1 - cover);
    kind = mark.kind;
  }
  if (!kind || alpha <= 0.04) return undefined;
  return { kind, alpha: Math.min(1, alpha) };
}

export function groundKindAt(marks: readonly GroundMark[], x: number, y: number): GroundKind | undefined {
  return sampleGround(marks, x, y)?.kind;
}

export function markBounds(mark: GroundMark) {
  const pad = diskOuter(mark.r, markSoftness(mark));
  return {
    west: mark.x - pad,
    east: mark.x + pad,
    south: mark.y - pad,
    north: mark.y + pad,
  };
}

function boundsOverlap(
  left: { west: number; east: number; south: number; north: number },
  right: { west: number; east: number; south: number; north: number },
) {
  return left.west < right.east && left.east > right.west && left.south < right.north && left.north > right.south;
}

export function diskHitsMarks(marks: readonly GroundMark[], x: number, y: number, radius: number, softness = GROUND_SOFTNESS_DEFAULT) {
  const reach = diskOuter(radius, softness);
  for (const mark of marks) {
    if (mark.kind === "erase") continue;
    if (Math.hypot(mark.x - x, mark.y - y) < diskOuter(mark.r, markSoftness(mark)) + reach) return true;
  }
  return false;
}

export function makeDisk(
  x: number,
  y: number,
  radius: number,
  kind: GroundStampKind,
  opacity = GROUND_OPACITY_DEFAULT,
  softness = GROUND_SOFTNESS_DEFAULT,
): GroundMark {
  const at = clampMap(x, y);
  const mark: GroundMark = { kind, x: at.x, y: at.y, r: radius };
  if (Math.abs(clampOpacity(opacity) - GROUND_OPACITY_DEFAULT) > 0.001) mark.opacity = clampOpacity(opacity);
  if (Math.abs(clampSoftness(softness) - GROUND_SOFTNESS_DEFAULT) > 0.001) mark.softness = clampSoftness(softness);
  return mark;
}

function inFarmPlotLocal(x: number, y: number) {
  const dx = Math.abs(x - FARM.x) / FARM_PLOT.halfW;
  const dy = Math.abs(y - FARM.y) / FARM_PLOT.halfH;
  return dx ** 4 + dy ** 4 < 1;
}

/** Hopsk's field, painted with the same circular dabs as the ground brush. */
export function farmPlotGround(): GroundMark[] {
  const r = brushRadius(1);
  const step = r * 0.7;
  const marks: GroundMark[] = [];
  const minX = FARM.x - FARM_PLOT.halfW;
  const maxX = FARM.x + FARM_PLOT.halfW;
  const minY = FARM.y - FARM_PLOT.halfH;
  const maxY = FARM.y + FARM_PLOT.halfH;
  for (let y = minY; y <= maxY + 1e-6; y += step) {
    for (let x = minX; x <= maxX + 1e-6; x += step) {
      if (!inFarmPlotLocal(x, y)) continue;
      marks.push(makeDisk(x, y, r, "furrow"));
    }
  }
  return marks;
}

export function normalizeGroundMarks(marks: readonly GroundMark[]): GroundMark[] {
  const next: GroundMark[] = [];
  for (const mark of marks) {
    if (mark.kind !== "erase" && !isGroundKind(mark.kind)) continue;
    if (!Number.isFinite(mark.x) || !Number.isFinite(mark.y) || !Number.isFinite(mark.r) || mark.r <= 0) continue;
    if (!onMap(mark.x, mark.y)) continue;
    next.push(makeDisk(mark.x, mark.y, mark.r, mark.kind, markOpacity(mark), markSoftness(mark)));
  }
  return next;
}

function looksLikeGroundRecord(record: Record<string, unknown>) {
  if (record.shape === "disk") return true;
  if (typeof record.tx === "number" && typeof record.ty === "number") return true;
  if (typeof record.r === "number" || typeof record.radius === "number") return true;
  return false;
}

export function parseGroundMarks(value: unknown): GroundMark[] {
  if (!Array.isArray(value)) return [];
  const marks: GroundMark[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.tx === "number" && typeof record.ty === "number" && isGroundKind(record.kind)) {
      marks.push(makeDisk((record.tx + 0.5) * GROUND_TILE, (record.ty + 0.5) * GROUND_TILE, GROUND_TILE, record.kind));
      continue;
    }
    const radius = typeof record.r === "number" ? record.r : typeof record.radius === "number" ? record.radius : undefined;
    const kind = record.kind === "erase" || isGroundKind(record.kind) ? record.kind : undefined;
    if (typeof record.x !== "number" || typeof record.y !== "number" || radius == null || !kind) continue;
    const opacity = typeof record.opacity === "number" ? record.opacity : GROUND_OPACITY_DEFAULT;
    const softness = typeof record.softness === "number" ? record.softness : GROUND_SOFTNESS_DEFAULT;
    marks.push(makeDisk(record.x, record.y, radius, kind, opacity, softness));
  }
  return normalizeGroundMarks(marks);
}

export function arrayLooksLikeGround(value: unknown) {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  const first = value[0];
  return Boolean(first && typeof first === "object" && looksLikeGroundRecord(first as Record<string, unknown>));
}

function hash2(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function groundPixel(kind: GroundKind, worldX: number, worldY: number): [number, number, number, number] {
  const ix = Math.floor(worldX);
  const iy = Math.floor(worldY);
  const dust = ((ix * 9 + iy * 13) % 5) / 5;
  switch (kind) {
    case "furrow": {
      const row = Math.sin((worldX - FARM.x) / 16) > 0.15;
      return [
        Math.round((row ? 96 : 118) + dust * 18),
        Math.round((row ? 68 : 86) + dust * 14),
        Math.round((row ? 42 : 54) + dust * 10),
        210,
      ];
    }
    case "dirt": {
      const fleck = ((ix * 11 + iy * 17) % 7) === 0;
      return [
        Math.round((fleck ? 98 : 138) + dust * 16),
        Math.round((fleck ? 74 : 104) + dust * 12),
        Math.round((fleck ? 48 : 68) + dust * 8),
        200,
      ];
    }
    case "dust": {
      return [
        Math.round(176 + dust * 18),
        Math.round(168 + dust * 12),
        Math.round(122 + dust * 10),
        168,
      ];
    }
    case "moss": {
      const lush = hash2(Math.floor(worldX / 10), Math.floor(worldY / 10)) > 0.55;
      return [
        Math.round((lush ? 52 : 68) + dust * 14),
        Math.round((lush ? 92 : 108) + dust * 16),
        Math.round((lush ? 44 : 52) + dust * 10),
        200,
      ];
    }
    case "gravel": {
      const pebble = ((ix * 13 + iy * 19) % 6) === 0;
      return [
        Math.round((pebble ? 96 : 124) + dust * 20),
        Math.round((pebble ? 94 : 120) + dust * 16),
        Math.round((pebble ? 86 : 108) + dust * 12),
        200,
      ];
    }
    case "mud": {
      const wet = hash2(Math.floor(worldX / 8), Math.floor(worldY / 8)) > 0.7;
      return [
        Math.round((wet ? 62 : 78) + dust * 12),
        Math.round((wet ? 48 : 60) + dust * 10),
        Math.round((wet ? 32 : 40) + dust * 8),
        220,
      ];
    }
    case "sand": {
      return [
        Math.round(196 + dust * 18),
        Math.round(176 + dust * 14),
        Math.round(118 + dust * 10),
        190,
      ];
    }
  }
}

export function paintGroundSwatch(kind: GroundKind, size = 40) {
  const { canvas, context } = createPixelCanvas(size, size);
  const image = context.createImageData(size, size);
  const pixels = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = groundPixel(kind, x * 3, y * 3);
      const index = (y * size + x) * 4;
      pixels[index] = r;
      pixels[index + 1] = g;
      pixels[index + 2] = b;
      pixels[index + 3] = a;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function disposeGroundMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose();
  const material = mesh.material as THREE.MeshBasicMaterial;
  material.map?.dispose();
  material.dispose();
}

type GroundChunk = {
  cx: number;
  cy: number;
  mesh: THREE.Mesh;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  textureWidth: number;
  textureHeight: number;
};

function chunkKey(cx: number, cy: number) {
  return `${cx},${cy}`;
}

function visitChunks(
  west: number,
  east: number,
  south: number,
  north: number,
  visit: (cx: number, cy: number) => void,
) {
  const cx0 = Math.floor(west / GROUND_CHUNK);
  const cx1 = Math.floor((east - 1e-6) / GROUND_CHUNK);
  const cy0 = Math.floor(south / GROUND_CHUNK);
  const cy1 = Math.floor((north - 1e-6) / GROUND_CHUNK);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) visit(cx, cy);
  }
}

export function attachGroundOverlay(world: THREE.Object3D, marks: readonly GroundMark[]) {
  const chunks = new Map<string, GroundChunk>();
  // Which kind won each texel, and how opaque it ended up. Reused across chunks.
  const chunkTexels = (GROUND_CHUNK / GROUND_TEXEL) ** 2;
  const kindScratch = new Int8Array(chunkTexels);
  // Float64 so the blend accumulates exactly as sampleGround's arithmetic does.
  const alphaScratch = new Float64Array(chunkTexels);

  function disposeChunk(key: string) {
    const chunk = chunks.get(key);
    if (!chunk) return;
    world.remove(chunk.mesh);
    disposeGroundMesh(chunk.mesh);
    chunks.delete(key);
  }

  function disposeAll() {
    for (const key of [...chunks.keys()]) disposeChunk(key);
  }

  function ensureChunk(cx: number, cy: number) {
    const key = chunkKey(cx, cy);
    const existing = chunks.get(key);
    if (existing) return existing;
    const textureWidth = GROUND_CHUNK / GROUND_TEXEL;
    const textureHeight = textureWidth;
    const { canvas, context } = createPixelCanvas(textureWidth, textureHeight);
    const texture = nearestTexture(canvas);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_CHUNK, GROUND_CHUNK),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.94,
        alphaTest: 0.04,
        depthWrite: false,
      }),
    );
    mesh.position.set((cx + 0.5) * GROUND_CHUNK, (cy + 0.5) * GROUND_CHUNK, -18);
    mesh.renderOrder = -80;
    mesh.name = "ground-overlay";
    world.add(mesh);
    const chunk: GroundChunk = { cx, cy, mesh, context, texture, textureWidth, textureHeight };
    chunks.set(key, chunk);
    return chunk;
  }

  function paintChunk(chunk: GroundChunk, next: readonly GroundMark[]) {
    const west = chunk.cx * GROUND_CHUNK;
    const south = chunk.cy * GROUND_CHUNK;
    const east = west + GROUND_CHUNK;
    const north = south + GROUND_CHUNK;
    const local = next.filter((mark) => boundsOverlap(markBounds(mark), { west, east, south, north }));
    const image = chunk.context.createImageData(chunk.textureWidth, chunk.textureHeight);
    if (local.length) {
      const width = chunk.textureWidth;
      const height = chunk.textureHeight;
      kindScratch.fill(-1);
      alphaScratch.fill(0);

      /*
       * Scatter, not gather: each dab writes only the texels beneath it rather
       * than every texel asking every dab. The dabs are still applied in array
       * order, so each texel sees the same sequence sampleGround would give it.
       */
      for (const mark of local) {
        const kind = mark.kind === "erase" ? -1 : GROUND_KIND_INDEX.get(mark.kind)!;
        const kernel = markKernel(mark);
        const y0 = Math.max(0, Math.floor((north - mark.y - kernel.outer) / GROUND_TEXEL));
        const y1 = Math.min(height - 1, Math.ceil((north - mark.y + kernel.outer) / GROUND_TEXEL));
        for (let y = y0; y <= y1; y++) {
          const worldY = north - (y + 0.5) / height * GROUND_CHUNK;
          const dy = worldY - mark.y;
          // Walk the dab's circle row by row, so the bounding box corners never cost anything.
          const halfSpan = Math.sqrt(Math.max(0, kernel.outerSq - dy * dy));
          const x0 = Math.max(0, Math.floor((mark.x - halfSpan - west) / GROUND_TEXEL));
          const x1 = Math.min(width - 1, Math.ceil((mark.x + halfSpan - west) / GROUND_TEXEL));
          const row = y * width;
          for (let x = x0; x <= x1; x++) {
            const dx = west + (x + 0.5) / width * GROUND_CHUNK - mark.x;
            const cover = kernelCoverage(kernel, dx * dx + dy * dy);
            if (cover <= 0.02) continue;
            const at = row + x;
            if (kind < 0) {
              const faded = alphaScratch[at]! * (1 - cover);
              if (faded <= 0.04) {
                kindScratch[at] = -1;
                alphaScratch[at] = 0;
              } else {
                alphaScratch[at] = faded;
              }
              continue;
            }
            alphaScratch[at] = cover + alphaScratch[at]! * (1 - cover);
            kindScratch[at] = kind;
          }
        }
      }

      const pixels = image.data;
      for (let y = 0; y < height; y++) {
        const worldY = north - (y + 0.5) / height * GROUND_CHUNK;
        for (let x = 0; x < width; x++) {
          const at = y * width + x;
          const kind = kindScratch[at]!;
          const alpha = alphaScratch[at]!;
          if (kind < 0 || alpha <= 0.04) continue;
          const worldX = west + (x + 0.5) / width * GROUND_CHUNK;
          const [r, g, b, a] = groundPixel(GROUND_KINDS[kind]!, worldX, worldY);
          const index = at * 4;
          pixels[index] = r;
          pixels[index + 1] = g;
          pixels[index + 2] = b;
          pixels[index + 3] = Math.round(a * Math.min(1, alpha));
        }
      }
    }
    chunk.context.putImageData(image, 0, 0);
    chunk.texture.needsUpdate = true;
    if (local.length === 0) disposeChunk(chunkKey(chunk.cx, chunk.cy));
  }

  function paintKeys(next: readonly GroundMark[], keys: Iterable<string>) {
    for (const key of keys) {
      const split = key.split(",");
      const cx = Number(split[0]);
      const cy = Number(split[1]);
      paintChunk(ensureChunk(cx, cy), next);
    }
  }

  function rebuild(next: readonly GroundMark[]) {
    const keys = new Set<string>();
    for (const mark of next) {
      const bounds = markBounds(mark);
      visitChunks(bounds.west, bounds.east, bounds.south, bounds.north, (cx, cy) => {
        keys.add(chunkKey(cx, cy));
      });
    }
    for (const key of [...chunks.keys()]) {
      if (!keys.has(key)) disposeChunk(key);
    }
    paintKeys(next, keys);
  }

  function patch(next: readonly GroundMark[], dirty: readonly GroundDirty[]) {
    if (dirty.length === 0) {
      rebuild(next);
      return;
    }
    const keys = new Set<string>();
    for (const dab of dirty) {
      const pad = diskOuter(dab.r, dab.softness);
      visitChunks(
        dab.x - pad,
        dab.x + pad,
        dab.y - pad,
        dab.y + pad,
        (cx, cy) => keys.add(chunkKey(cx, cy)),
      );
    }
    paintKeys(next, keys);
  }

  rebuild(marks);
  return {
    rebuild,
    patch,
  };
}
