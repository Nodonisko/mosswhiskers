import * as THREE from "three";
import { createPixelCanvas, nearestTexture } from "./pixel-canvas";
import { seeded } from "./rng";
import {
  BERNIE_POND_X,
  BERNIE_POND_Y,
  INTAKE_PIPE_END,
  intakePipePoints,
} from "./world-config";

const PIPE_RADIUS = 11;
const FLANGE_EVERY = 92;
const SUPPORT_EVERY = 128;
const BULGE_WIDTH = 26;
const BULGE_HEIGHT = 14;
export const PIPE_BALL_COUNT = 5;
export const PIPE_BALL_SPEED = 210;
/** Past three widths a swallow raises the pipe by under a hundredth of a pixel. */
const BULGE_REACH = BULGE_WIDTH * 3;

/**
 * One entry per pipe pixel, flattened so the per-frame loop walks contiguous
 * memory instead of chasing ~34k object pointers.
 */
type PipeSamples = {
  /** Byte offset of the pixel inside the ImageData. */
  offset: Int32Array;
  along: Float32Array;
  dist: Float32Array;
  /** Bit 0: the surface faces up. Bit 1: the sample sits on a flange. */
  flags: Uint8Array;
};

export type IntakePipeModel = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  base: ImageData;
  working: ImageData;
  samples: PipeSamples;
  length: number;
  /** Swell height per world unit along the pipe, refilled once a frame. */
  bulge: Float32Array;
  /** World rect of the painted strip, so callers can skip off-camera frames. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  painted: "none" | "flowing" | "clogged";
};

function closestOnPath(x: number, y: number, points: ReadonlyArray<readonly [number, number]>) {
  let best = 1e9;
  let along = 0;
  let traveled = 0;
  let nx = 0;
  let ny = 1;
  let px = x;
  let py = y;
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = points[i]!;
    const [bx, by] = points[i + 1]!;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lenSq));
    const qx = ax + dx * t;
    const qy = ay + dy * t;
    const dist = Math.hypot(x - qx, y - qy);
    if (dist < best) {
      best = dist;
      along = traveled + t * Math.sqrt(lenSq);
      const len = Math.sqrt(lenSq);
      nx = -dy / len;
      ny = dx / len;
      if (ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      px = qx;
      py = qy;
    }
    traveled += Math.sqrt(lenSq);
  }
  return { dist: best, along, nx, ny, px, py, length: traveled };
}

function hexRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function writePixel(pixels: Uint8ClampedArray, width: number, tx: number, ty: number, color: string) {
  const [r, g, b] = hexRgb(color);
  const index = (ty * width + tx) * 4;
  pixels[index] = r;
  pixels[index + 1] = g;
  pixels[index + 2] = b;
  pixels[index + 3] = 255;
}

/** Table entries per world unit. Half steps keep the swell within a fifth of a texel of exact. */
const BULGE_RESOLUTION = 2;
const BULGE_STEPS = BULGE_REACH * BULGE_RESOLUTION;

/** The swallow's bell curve, sampled once so exp() stays out of the pixel loop. */
const BULGE_PROFILE = Float32Array.from(
  { length: BULGE_STEPS + 1 },
  (_, step) => Math.exp(-((step / BULGE_RESOLUTION / BULGE_WIDTH) ** 2)) * BULGE_HEIGHT,
);

export function bulgeTableFor(length: number) {
  return new Float32Array(Math.ceil(length * BULGE_RESOLUTION) + 1);
}

/** Stamp the five swallows into the table, keeping the tallest where they overlap. */
export function fillBulgeTable(bulge: Float32Array, length: number, elapsed: number) {
  bulge.fill(0);
  const span = bulge.length;
  const spacing = length / PIPE_BALL_COUNT;
  const wrapped = ((elapsed * PIPE_BALL_SPEED) % length + length) % length;
  for (let ball = 0; ball < PIPE_BALL_COUNT; ball++) {
    const centre = Math.round(((wrapped + ball * spacing) % length) * BULGE_RESOLUTION);
    for (let step = -BULGE_STEPS; step <= BULGE_STEPS; step++) {
      const height = BULGE_PROFILE[step < 0 ? -step : step]!;
      const at = (((centre + step) % span) + span) % span;
      if (height > bulge[at]!) bulge[at] = height;
    }
  }
}

/** How many swallows have reached the pond intake. */
export const GULP_SOUND_LEAD = 0.3;

export function intakeGulpIndex(elapsed: number, length: number, lead = GULP_SOUND_LEAD) {
  if (length <= 0) return 0;
  return Math.floor((elapsed + lead) * PIPE_BALL_SPEED * PIPE_BALL_COUNT / length);
}

/** Rim, sunlit top, upper body, lower body. A swallow passing lights each band up. */
const PIPE_SHADES = [
  { plain: "#3a3c40", flange: "#3a3c40", lit: "#2e3034" },
  { plain: "#c4bcb0", flange: "#b8b0a4", lit: "#e8e0d0" },
  { plain: "#9a968c", flange: "#8a8680", lit: "#b8b0a4" },
  { plain: "#7a7670", flange: "#6a6864", lit: "#8a8680" },
] as const;

const SHADE_PLAIN = 0;
const SHADE_FLANGE = 1;
const SHADE_LIT = 2;

/** Every shade resolved to bytes up front, so the pixel loop never parses hex. */
const PIPE_PALETTE = (() => {
  const bytes = new Uint8Array(PIPE_SHADES.length * 3 * 3);
  PIPE_SHADES.forEach((shade, band) => {
    [shade.plain, shade.flange, shade.lit].forEach((hex, slot) => {
      const [r, g, b] = hexRgb(hex);
      const at = (band * 3 + slot) * 3;
      bytes[at] = r;
      bytes[at + 1] = g;
      bytes[at + 2] = b;
    });
  });
  return bytes;
})();

function pipeBand(t: number, facesUp: boolean) {
  if (t > 0.84) return 0;
  if (facesUp && t < 0.4) return 1;
  if (t < 0.58) return 2;
  return 3;
}

function pipeColor(dist: number, radius: number, ny: number, flange: boolean, bulge: number) {
  const shade = PIPE_SHADES[pipeBand(dist / radius, ny > 0.4)]!;
  return bulge > 5 ? shade.lit : flange ? shade.flange : shade.plain;
}

/** Ground-level intake pipe from Bernie's puddle to the data-center west wall. */
export function createIntakePipeModel(): IntakePipeModel {
  const points = intakePipePoints();
  let minX = BERNIE_POND_X;
  let maxX = INTAKE_PIPE_END.x;
  let minY = BERNIE_POND_Y;
  let maxY = INTAKE_PIPE_END.y;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  minX -= 52;
  maxX += 28;
  minY -= 52;
  maxY += 44;
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = 2;
  const textureWidth = Math.ceil(width / scale);
  const textureHeight = Math.ceil(height / scale);
  const { canvas, context } = createPixelCanvas(textureWidth, textureHeight);
  const base = context.createImageData(textureWidth, textureHeight);
  const pixels = base.data;
  const random = seeded(9041);
  const offsets: number[] = [];
  const alongs: number[] = [];
  const dists: number[] = [];
  const flags: number[] = [];
  let length = 1;

  for (let ty = 0; ty < textureHeight; ty++) {
    for (let tx = 0; tx < textureWidth; tx++) {
      const worldX = minX + (tx + 0.5) * scale;
      const worldY = maxY - (ty + 0.5) * scale;
      const hit = closestOnPath(worldX, worldY, points);
      length = hit.length;
      const intake = Math.hypot(worldX - BERNIE_POND_X, worldY - BERNIE_POND_Y);
      const onFlange = hit.along > 36 && hit.along < hit.length - 90
        && Math.abs((hit.along + 8) % FLANGE_EVERY) < 7;
      const onSupport = hit.along > 48 && hit.along < hit.length - 110
        && Math.abs((hit.along + 20) % SUPPORT_EVERY) < 5;

      if (intake < 20) {
        if (intake < 7) writePixel(pixels, textureWidth, tx, ty, "#3a4a44");
        else if (intake < 12) writePixel(pixels, textureWidth, tx, ty, "#5a6860");
        else if (intake < 16) writePixel(pixels, textureWidth, tx, ty, "#7a7670");
        else writePixel(pixels, textureWidth, tx, ty, "#4a4e52");
        continue;
      }

      if (
        onSupport
        && worldY < hit.py
        && hit.py - worldY < 16
        && Math.abs(worldX - hit.px) < 4
        && hit.dist > PIPE_RADIUS
      ) {
        writePixel(pixels, textureWidth, tx, ty, hit.py - worldY > 12 ? "#4a4038" : "#6a6258");
        continue;
      }

      if (hit.dist > PIPE_RADIUS + 6 + BULGE_HEIGHT) continue;
      offsets.push((ty * textureWidth + tx) * 4);
      alongs.push(hit.along);
      dists.push(hit.dist);
      flags.push((hit.ny > 0.4 ? 1 : 0) | (onFlange ? 2 : 0));
      const radius = onFlange ? PIPE_RADIUS + 5 : PIPE_RADIUS;
      if (hit.dist > radius + 1) continue;
      let color: string = pipeColor(hit.dist, radius, hit.ny, onFlange, 0);
      if (random() > 0.986 && hit.dist / radius < 0.7) color = "#8a5a40";
      writePixel(pixels, textureWidth, tx, ty, color);
    }
  }

  context.putImageData(base, 0, 0);
  const working = context.createImageData(textureWidth, textureHeight);
  working.data.set(base.data);

  const texture = nearestTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture, transparent: true, alphaTest: 0.08, depthWrite: false, toneMapped: false,
    }),
  );
  mesh.name = "pond-intake-pipe";
  mesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, -1.6);
  mesh.renderOrder = -7;
  return {
    mesh,
    canvas,
    context,
    base,
    working,
    samples: {
      offset: Int32Array.from(offsets),
      along: Float32Array.from(alongs),
      dist: Float32Array.from(dists),
      flags: Uint8Array.from(flags),
    },
    length,
    bulge: bulgeTableFor(length),
    bounds: { minX, maxX, minY, maxY },
    painted: "none",
  };
}

function commitPipe(pipe: IntakePipeModel) {
  pipe.context.putImageData(pipe.working, 0, 0);
  const map = pipe.mesh.material.map;
  if (map) map.needsUpdate = true;
}

/**
 * Repaints the travelling swallows. A clogged pipe holds one still image, so it
 * only ever needs painting once; callers should also skip frames where the strip
 * is off camera, since every call re-uploads the whole texture.
 */
export function updateIntakePipeModel(pipe: IntakePipeModel, elapsed: number, clogged = false) {
  if (clogged) {
    if (pipe.painted === "clogged") return;
    pipe.painted = "clogged";
    pipe.working.data.set(pipe.base.data);
    commitPipe(pipe);
    return;
  }
  pipe.painted = "flowing";

  const { base, working, samples, bulge, length } = pipe;
  const { offset, along, dist, flags } = samples;
  working.data.set(base.data);
  fillBulgeTable(bulge, length, elapsed);

  const pixels = working.data;
  for (let i = 0; i < offset.length; i++) {
    const extra = bulge[(along[i]! * BULGE_RESOLUTION) | 0]!;
    const flag = flags[i]!;
    const flange = (flag & 2) !== 0;
    const radius = (flange ? PIPE_RADIUS + 5 : PIPE_RADIUS) + extra;
    const reach = dist[i]!;
    if (reach > radius + 1) continue;
    const band = pipeBand(reach / radius, (flag & 1) !== 0);
    const slot = extra > 5 ? SHADE_LIT : flange ? SHADE_FLANGE : SHADE_PLAIN;
    const shade = (band * 3 + slot) * 3;
    const at = offset[i]!;
    pixels[at] = PIPE_PALETTE[shade]!;
    pixels[at + 1] = PIPE_PALETTE[shade + 1]!;
    pixels[at + 2] = PIPE_PALETTE[shade + 2]!;
    pixels[at + 3] = 255;
  }
  commitPipe(pipe);
}
