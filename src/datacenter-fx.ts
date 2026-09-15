import * as THREE from "three";
import { paintPixelTexture } from "./pixel-canvas";
import { WORLD_MODEL_SIZES } from "./world-models";

type Overlay = {
  sprite: THREE.Sprite;
  parent: THREE.Sprite;
  frames: THREE.CanvasTexture[];
  step: number;
};

export type DataCenterFx = {
  overlays: Overlay[];
  fire: Overlay[];
};

const LED = ["#7ef0e8", "#5ad8c8", "#8ce87a", "#f0c050", "#ffe8a0", "#f07850"];
const HALL_BANDS = [
  { x: 25, y: 110, w: 20, h: 24 },
  { x: 236, y: 132, w: 44, h: 18 },
  { x: 136, y: 160, w: 6, h: 6 },
  { x: 176, y: 160, w: 6, h: 6 },
];

function attachOverlay(
  parent: THREE.Sprite,
  frames: THREE.CanvasTexture[],
  step: number,
): Overlay {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: frames[0],
    transparent: true,
    opacity: 1,
    alphaTest: 0.02,
    depthWrite: false,
    toneMapped: false,
  }));
  sprite.center.set(0.5, 0);
  sprite.scale.copy(parent.scale);
  sprite.position.set(parent.position.x, parent.position.y, 1.5);
  sprite.renderOrder = parent.renderOrder + 3;
  return { sprite, parent, frames, step };
}

function paintBand(
  ctx: CanvasRenderingContext2D,
  band: { x: number; y: number; w: number; h: number },
  frame: number,
  gap: number,
) {
  for (let y = band.y; y < band.y + band.h; y += gap) {
    for (let x = band.x; x < band.x + band.w; x += gap) {
      const phase = (x * 5 + y * 11) % 6;
      const beat = (phase + frame) % 6;
      if (beat === 2 || beat === 5) continue;
      if ((x * 3 + y) % 4 === 0) continue;
      ctx.fillStyle = LED[(x + y + frame) % LED.length]!;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function hallLedFrames() {
  const [width, height] = WORLD_MODEL_SIZES.datacenter;
  return [0, 1, 2, 3, 4, 5].map((frame) => paintPixelTexture(width, height, (ctx) => {
    for (const band of HALL_BANDS) paintBand(ctx, band, frame, 2);
  }));
}

function rackLedFrames(seed: number) {
  const [width, height] = WORLD_MODEL_SIZES.racks;
  const cabinets = [
    { x: 4, y: 24, w: 22, h: 60 },
    { x: 26, y: 14, w: 24, h: 70 },
    { x: 50, y: 22, w: 22, h: 62 },
    { x: 72, y: 18, w: 20, h: 66 },
  ];
  return [0, 1, 2, 3, 4, 5].map((frame) => paintPixelTexture(width, height, (ctx) => {
    for (const [index, cab] of cabinets.entries()) {
      for (let row = 0; row < 12; row++) {
        const y = cab.y + 10 + row * 4;
        for (const col of [5, cab.w - 7]) {
          const phase = (seed + index * 3 + row * 2 + col) % 6;
          if ((phase + frame) % 6 === 4) continue;
          ctx.fillStyle = row % 5 === 0 ? "#f0c050" : LED[(row + frame + seed) % LED.length]!;
          ctx.fillRect(cab.x + col, y, 1, 1);
        }
      }
      const topPhase = (seed + index + frame) % 4;
      ctx.fillStyle = topPhase === 0 ? "#8ce87a" : "#3a4a3c";
      ctx.fillRect(cab.x + 4, cab.y + 3, 3, 2);
      ctx.fillStyle = topPhase === 2 ? "#f07850" : "#4a3a30";
      ctx.fillRect(cab.x + cab.w - 8, cab.y + 3, 3, 2);
    }
  }));
}

function paintFlame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
) {
  const rise = frame % 3;
  const wobble = frame % 2 === 0 ? 0 : 1;
  ctx.fillStyle = "#3a2010";
  ctx.fillRect(x + wobble, y - rise + 6, 7, 10);
  ctx.fillStyle = "#d8653f";
  ctx.fillRect(x + 1 + wobble, y - rise + 3, 5, 11);
  ctx.fillRect(x + 2 + wobble, y - rise, 3, 5);
  ctx.fillStyle = "#ffd36a";
  ctx.fillRect(x + 2 + wobble, y - rise + 6, 3, 7);
  ctx.fillRect(x + 3 + wobble, y - rise + 2, 2, 5);
  if (frame % 2 === 0) {
    ctx.fillStyle = "#fff4c8";
    ctx.fillRect(x + 3 + wobble, y - rise + 8, 1, 4);
  }
}

function paintSmoke(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const drift = (frame % 4) - 1;
  ctx.fillStyle = frame % 2 ? "#5a5a58" : "#3a3a38";
  ctx.fillRect(x + drift, y - (frame % 3) * 2, 5, 4);
  ctx.fillRect(x + 3 + drift, y - 4 - (frame % 3), 4, 3);
}

function hallFireFrames() {
  const [width, height] = WORLD_MODEL_SIZES.datacenter;
  return [0, 1, 2, 3].map((frame) => paintPixelTexture(width, height, (ctx) => {
    paintFlame(ctx, 178, 52, frame);
    paintFlame(ctx, 196, 48, frame + 1);
    paintFlame(ctx, 218, 50, frame + 2);
    paintFlame(ctx, 242, 46, frame);
    paintFlame(ctx, 86, 84, frame + 1);
    paintFlame(ctx, 174, 84, frame);
    paintFlame(ctx, 192, 80, frame + 2);
    paintFlame(ctx, 214, 86, frame + 1);
    paintFlame(ctx, 236, 82, frame);
    paintFlame(ctx, 92, 116, frame + 2);
    paintFlame(ctx, 108, 112, frame);
    paintFlame(ctx, 238, 118, frame + 1);
    paintFlame(ctx, 132, 16, frame);
    paintFlame(ctx, 154, 10, frame + 2);
    paintFlame(ctx, 180, 12, frame + 1);
    paintFlame(ctx, 206, 8, frame);
    paintFlame(ctx, 228, 14, frame + 2);
    paintSmoke(ctx, 140, 4, frame);
    paintSmoke(ctx, 188, 0, frame + 1);
    paintSmoke(ctx, 230, 2, frame + 2);
  }));
}

function rackFireFrames(seed: number) {
  const [width, height] = WORLD_MODEL_SIZES.racks;
  return [0, 1, 2, 3].map((frame) => paintPixelTexture(width, height, (ctx) => {
    paintFlame(ctx, 10 + (seed % 4), 8, frame + seed);
    paintFlame(ctx, 38, 2, frame + 1);
    paintFlame(ctx, 64, 10, frame + 2);
    paintSmoke(ctx, 20, 0, frame + seed);
  }));
}

export function createDataCenterFx(
  hall: THREE.Sprite,
  racks: readonly THREE.Sprite[],
  world: THREE.Object3D,
): DataCenterFx {
  const overlays = [attachOverlay(hall, hallLedFrames(), 0.13)];
  const fire = [attachOverlay(hall, hallFireFrames(), 0.11)];
  racks.forEach((rack, index) => {
    overlays.push(attachOverlay(rack, rackLedFrames(40 + index * 11), 0.11 + index * 0.02));
    fire.push(attachOverlay(rack, rackFireFrames(index * 7), 0.1 + index * 0.02));
  });
  for (const item of overlays) world.add(item.sprite);
  for (const item of fire) {
    item.sprite.visible = false;
    item.sprite.renderOrder = item.parent.renderOrder + 4;
    world.add(item.sprite);
  }
  return { overlays, fire };
}

export function updateDataCenterFx(fx: DataCenterFx, elapsed: number, burning = false) {
  for (const item of fx.overlays) {
    const frame = Math.floor(Math.max(0, elapsed) / item.step) % item.frames.length;
    const material = item.sprite.material as THREE.SpriteMaterial;
    material.map = item.frames[frame]!;
    const parentOpacity = (item.parent.material as THREE.SpriteMaterial).opacity;
    material.opacity = burning ? parentOpacity * 0.28 : parentOpacity;
    item.sprite.renderOrder = item.parent.renderOrder + 3;
  }
  for (const item of fx.fire) {
    item.sprite.visible = burning;
    if (!burning) continue;
    const frame = Math.floor(Math.max(0, elapsed) / item.step) % item.frames.length;
    const material = item.sprite.material as THREE.SpriteMaterial;
    material.map = item.frames[frame]!;
    material.opacity = (item.parent.material as THREE.SpriteMaterial).opacity;
    item.sprite.position.set(item.parent.position.x, item.parent.position.y, 1.6);
    item.sprite.renderOrder = item.parent.renderOrder + 4;
  }
}
