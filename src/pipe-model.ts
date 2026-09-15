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
const BALL_COUNT = 5;
const BALL_SPEED = 210;

type PipeSample = {
  tx: number;
  ty: number;
  along: number;
  dist: number;
  ny: number;
  flange: boolean;
};

export type IntakePipeModel = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  base: ImageData;
  working: ImageData;
  samples: PipeSample[];
  length: number;
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

function bulgeAt(along: number, length: number, elapsed: number) {
  const wrapped = ((elapsed * BALL_SPEED) % length + length) % length;
  const spacing = length / BALL_COUNT;
  let extra = 0;
  for (let i = 0; i < BALL_COUNT; i++) {
    const pos = (wrapped + i * spacing) % length;
    let delta = Math.abs(along - pos);
    delta = Math.min(delta, length - delta);
    extra = Math.max(extra, Math.exp(-((delta / BULGE_WIDTH) ** 2)) * BULGE_HEIGHT);
  }
  return extra;
}

function pipeColor(dist: number, radius: number, ny: number, flange: boolean, bulge: number) {
  const t = dist / radius;
  const lit = bulge > 5;
  if (t > 0.84) return lit ? "#2e3034" : "#3a3c40";
  if (ny > 0.4 && t < 0.4) return lit ? "#e8e0d0" : flange ? "#b8b0a4" : "#c4bcb0";
  if (t < 0.58) return lit ? "#b8b0a4" : flange ? "#8a8680" : "#9a968c";
  return lit ? "#8a8680" : flange ? "#6a6864" : "#7a7670";
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
  const samples: PipeSample[] = [];
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
      samples.push({ tx, ty, along: hit.along, dist: hit.dist, ny: hit.ny, flange: onFlange });
      const radius = onFlange ? PIPE_RADIUS + 5 : PIPE_RADIUS;
      if (hit.dist > radius + 1) continue;
      let color = pipeColor(hit.dist, radius, hit.ny, onFlange, 0);
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
  return { mesh, canvas, context, base, working, samples, length };
}

export function updateIntakePipeModel(pipe: IntakePipeModel, elapsed: number, clogged = false) {
  const { base, working, samples, length, context, canvas, mesh } = pipe;
  working.data.set(base.data);
  if (!clogged) {
    const pixels = working.data;
    const width = canvas.width;
    for (const sample of samples) {
      const extra = bulgeAt(sample.along, length, elapsed);
      const radius = (sample.flange ? PIPE_RADIUS + 5 : PIPE_RADIUS) + extra;
      if (sample.dist > radius + 1) continue;
      const index = (sample.ty * width + sample.tx) * 4;
      const color = pipeColor(sample.dist, radius, sample.ny, sample.flange, extra);
      const [r, g, b] = hexRgb(color);
      pixels[index] = r;
      pixels[index + 1] = g;
      pixels[index + 2] = b;
      pixels[index + 3] = 255;
    }
  }
  context.putImageData(working, 0, 0);
  const map = mesh.material.map;
  if (map) map.needsUpdate = true;
}
