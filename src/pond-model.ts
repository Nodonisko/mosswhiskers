import * as THREE from "three";
import { lakeShoreRadius } from "./lake-shape";
import { createPixelCanvas, nearestTexture } from "./pixel-canvas";
import { pondBasinContains, pondPuddleContains, POND_PUDDLE_RATIO } from "./pond-shape";
import { seeded } from "./rng";
import { BERNIE_POND_HEIGHT, BERNIE_POND_SEED, BERNIE_POND_WIDTH } from "./world-config";

export { pondBasinContains, pondPuddleContains, POND_PUDDLE_RATIO } from "./pond-shape";

export interface DriedPondModel {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  width: number;
  height: number;
  phase: number;
  /** Remaining water only. Coordinates relative to mesh.position. */
  puddleContains: (localX: number, localY: number, padding?: number) => boolean;
  /** Full dried basin including mud flats. */
  basinContains: (localX: number, localY: number, padding?: number) => boolean;
  frames: readonly THREE.CanvasTexture[];
}

function hexRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** An XY ground plane: cracked mud flats around a tiny olive-grey puddle. */
export function createDriedPondModel(options: {
  width?: number;
  height?: number;
  seed?: number;
} = {}): DriedPondModel {
  const width = options.width ?? BERNIE_POND_WIDTH;
  const height = options.height ?? BERNIE_POND_HEIGHT;
  const seed = options.seed ?? BERNIE_POND_SEED;
  const random = seeded(seed);
  const phase = random() * Math.PI * 2;
  const textureWidth = Math.ceil(width / 2);
  const textureHeight = Math.ceil(height / 2);
  const { canvas: base, context: ctx } = createPixelCanvas(textureWidth, textureHeight);

  const pixelRatio = (x: number, y: number) => {
    const localX = (x + 0.5) / textureWidth * width - width / 2;
    const localY = height / 2 - (y + 0.5) / textureHeight * height;
    const nx = localX / (width / 2);
    const ny = localY / (height / 2);
    return Math.hypot(nx, ny) / lakeShoreRadius(Math.atan2(ny, nx), phase);
  };

  const image = ctx.createImageData(textureWidth, textureHeight);
  const pixels = image.data;
  for (let y = 0; y < textureHeight; y++) {
    for (let x = 0; x < textureWidth; x++) {
      const ratio = pixelRatio(x, y);
      if (ratio > 1) continue;
      const noise = random();
      let color: string;
      if (ratio > 0.94) {
        color = noise > 0.42 ? "#9a8b64" : "#8a7d5a";
      } else if (ratio > 0.82) {
        color = noise > 0.55 ? "#8a7d5a" : "#7a6e4e";
      } else if (ratio > 0.58) {
        color = noise > 0.62 ? "#7a6e4e" : "#6e6348";
      } else if (ratio > POND_PUDDLE_RATIO) {
        // Pale salt crust hugs the shrinking waterline.
        color = ratio < 0.46 && noise > 0.7 ? "#b7a87a" : noise > 0.5 ? "#6e6348" : "#5c5340";
      } else {
        const depth = Math.sin(x / 19 + y / 13) + Math.cos(y / 17 - x / 29);
        color = depth > 0.85 ? "#6a7a6c" : depth < -0.9 ? "#4e6358" : "#5a6e62";
      }
      const [r, g, b] = hexRgb(color);
      const index = (y * textureWidth + x) * 4;
      pixels[index] = r;
      pixels[index + 1] = g;
      pixels[index + 2] = b;
      pixels[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  // Dust and salt specks sit on packed mud, not on the remaining water.
  for (let i = 0; i < 180; i++) {
    const x = Math.floor(random() * textureWidth);
    const y = Math.floor(random() * textureHeight);
    const ratio = pixelRatio(x, y);
    if (ratio > 0.9 || ratio < 0.42) continue;
    ctx.fillStyle = random() > 0.45 ? "#cbb992" : "#b7a87a";
    ctx.fillRect(x, y, 1, 1);
  }

  const mudPixel = (x: number, y: number, color: string) => {
    if (x < 0 || y < 0 || x >= textureWidth || y >= textureHeight) return;
    const ratio = pixelRatio(x, y);
    if (ratio > 1 || ratio < 0.4) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };

  // Dark 1px cracks stay in the dried ring so the puddle reads as open water.
  const crackRandom = seeded(seed ^ 0x3c91);
  for (let i = 0; i < 42; i++) {
    let x = Math.floor(crackRandom() * textureWidth);
    let y = Math.floor(crackRandom() * textureHeight);
    const startRatio = pixelRatio(x, y);
    if (startRatio > 0.96 || startRatio < 0.44) continue;
    let angle = crackRandom() * Math.PI * 2;
    const length = 7 + Math.floor(crackRandom() * 14);
    for (let step = 0; step < length; step++) {
      x = Math.round(x + Math.cos(angle));
      y = Math.round(y + Math.sin(angle));
      mudPixel(x, y, crackRandom() > 0.45 ? "#3a3428" : "#2c281f");
      angle += (crackRandom() - 0.5) * 0.65;
      if (crackRandom() > 0.88 && step > 3) {
        const branchAngle = angle + (crackRandom() > 0.5 ? 0.9 : -0.9);
        let bx = x;
        let by = y;
        const branchLength = 3 + Math.floor(crackRandom() * 5);
        for (let branch = 0; branch < branchLength; branch++) {
          bx = Math.round(bx + Math.cos(branchAngle));
          by = Math.round(by + Math.sin(branchAngle));
          mudPixel(bx, by, "#3a3428");
        }
      }
    }
  }

  const reedRandom = seeded(seed ^ 0x7e2d);
  const shorePoint = (angle: number, ratio: number) => {
    const radius = lakeShoreRadius(angle, phase) * ratio;
    return {
      x: Math.round(textureWidth / 2 * (1 + Math.cos(angle) * radius)),
      y: Math.round(textureHeight / 2 * (1 - Math.sin(angle) * radius)),
    };
  };
  const reedPixel = (x: number, y: number, color: string) => {
    if (x < 0 || y < 0 || x >= textureWidth || y >= textureHeight) return;
    const ratio = pixelRatio(x, y);
    if (ratio > 1.02 || ratio < 0.48) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };

  // A handful of dead stalks on the bank. No pads, no submerged plants.
  for (const angle of [0.35, 0.85, 1.35, 1.9, 2.55, 3.15, 3.9, 4.55, 5.2, 5.85]) {
    const point = shorePoint(angle + (reedRandom() - 0.5) * 0.2, 0.88 + reedRandom() * 0.08);
    const stalks = 2 + Math.floor(reedRandom() * 2);
    for (let stalk = 0; stalk < stalks; stalk++) {
      const baseX = point.x + stalk * 2 - 1;
      const baseY = point.y + Math.floor(reedRandom() * 2);
      const stalkHeight = 4 + Math.floor(reedRandom() * 4);
      const lean = reedRandom() > 0.55 ? 1 : 0;
      for (let y = 0; y < stalkHeight; y++) {
        const bend = y > 2 ? lean : 0;
        const tip = y === stalkHeight - 1;
        reedPixel(baseX + bend, baseY - y, tip ? "#8a6e4a" : y < 2 ? "#4a3a28" : "#5a4630");
      }
    }
  }

  const ripples: Array<{ x: number; y: number; length: number; phase: number }> = [];
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(random() * textureWidth);
    const y = Math.floor(random() * textureHeight);
    if (pixelRatio(x, y) > 0.3) continue;
    ripples.push({ x, y, length: 2 + Math.floor(random() * 3), phase: random() * Math.PI * 2 });
  }

  const frames = Array.from({ length: 6 }, (_, frame) => {
    const { canvas, context } = createPixelCanvas(textureWidth, textureHeight);
    context.drawImage(base, 0, 0);
    for (const ripple of ripples) {
      const wave = Math.sin(frame / 6 * Math.PI * 2 + ripple.phase);
      const drift = wave > 0.55 ? 1 : 0;
      context.fillStyle = `rgba(140, 158, 148, ${0.055 + wave * 0.03})`;
      context.fillRect(ripple.x + drift, ripple.y, ripple.length, 1);
    }
    return nearestTexture(canvas);
  });

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: frames[0]!, transparent: true, alphaTest: 0.08, depthWrite: false }),
  );
  mesh.name = "bernie-pond";
  mesh.position.z = -3;
  mesh.renderOrder = -9;

  return {
    mesh,
    width,
    height,
    phase,
    frames,
    puddleContains(localX, localY, padding = 0) {
      return pondPuddleContains(width, height, phase, localX, localY, padding);
    },
    basinContains(localX, localY, padding = 0) {
      return pondBasinContains(width, height, phase, localX, localY, padding);
    },
  };
}

/** Slow loop; puddle glints barely move. */
export function updateDriedPondModel(pond: DriedPondModel, elapsedSeconds: number) {
  const index = Math.floor(Math.max(0, elapsedSeconds) / 1.1) % pond.frames.length;
  const nextFrame = pond.frames[index]!;
  if (pond.mesh.material.map !== nextFrame) pond.mesh.material.map = nextFrame;
}
