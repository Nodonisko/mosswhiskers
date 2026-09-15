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
  const image = frames[0]?.image;
  const nativeW = Number(parent.userData.nativeWidth) || 1;
  const nativeH = Number(parent.userData.nativeHeight) || 1;
  if (image instanceof HTMLCanvasElement) {
    sprite.scale.set(
      parent.scale.x * (image.width / nativeW),
      parent.scale.y * (image.height / nativeH),
      1,
    );
  } else {
    sprite.scale.copy(parent.scale);
  }
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
  size = 1,
) {
  const rise = frame % 3;
  const wobble = frame % 2 === 0 ? 0 : 1;
  if (size <= 1) {
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
    return;
  }
  const w = 5 + size * 4;
  const h = 8 + size * 8;
  ctx.fillStyle = "#3a2010";
  ctx.fillRect(x + wobble, y - rise + 4, w, h);
  ctx.fillStyle = "#d8653f";
  ctx.fillRect(x + 2 + wobble, y - rise, w - 4, h + 2);
  ctx.fillRect(x + Math.floor(w / 2) - 1 + wobble, y - rise - 4 * size, 3 + size, 8 + size);
  ctx.fillStyle = "#ffd36a";
  ctx.fillRect(x + 3 + wobble, y - rise + 6, w - 7, h - 6);
  ctx.fillRect(x + Math.floor(w / 2) + wobble, y - rise, 2, 8 + size * 2);
  if (frame % 2 === 0) {
    ctx.fillStyle = "#fff4c8";
    ctx.fillRect(x + Math.floor(w / 2) + wobble, y - rise + 8, 1, 5 + size);
  }
  if (size >= 3) {
    ctx.fillStyle = "#d8653f";
    ctx.fillRect(x - 3 + wobble, y - rise + 8, 5, h - 8);
    ctx.fillStyle = "#ffd36a";
    ctx.fillRect(x - 2 + wobble, y - rise + 12, 3, h - 14);
  }
}

function paintSmoke(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, size = 1) {
  const drift = ((frame + size) % 5) - 2;
  const lift = (frame % 4) * (1 + size);
  const w = 4 + size * 3;
  const h = 3 + size * 2;
  ctx.fillStyle = "#3a3a38";
  ctx.fillRect(x + drift, y - lift, w, h);
  ctx.fillStyle = "#5a5a58";
  ctx.fillRect(x + 2 + drift, y - lift - 3 - size, w - 1, h);
  ctx.fillStyle = "#7a7a76";
  ctx.fillRect(x + size + drift, y - lift - 6 - size * 2, w - 2, h - 1);
  if (size > 1) {
    ctx.fillStyle = "#6a6a66";
    ctx.fillRect(x - 2 + drift, y - lift - 4, 5 + size, 3 + size);
    ctx.fillStyle = "#8a8a84";
    ctx.fillRect(x + 4 + drift, y - lift - 8 - size, 4 + size, 3);
  }
}

const HALL_FIRE_HEAD = 40;

function hallFireFrames() {
  const [width, height] = WORLD_MODEL_SIZES.datacenter;
  const head = HALL_FIRE_HEAD;
  return [0, 1, 2, 3].map((frame) => paintPixelTexture(width, height + head, (ctx) => {
    const y = (n: number) => n + head;
    paintFlame(ctx, 178, y(52), frame, 1);
    paintFlame(ctx, 196, y(48), frame + 1, 2);
    paintFlame(ctx, 218, y(50), frame + 2, 3);
    paintFlame(ctx, 242, y(46), frame, 2);
    paintFlame(ctx, 86, y(84), frame + 1, 1);
    paintFlame(ctx, 174, y(84), frame, 2);
    paintFlame(ctx, 192, y(80), frame + 2, 3);
    paintFlame(ctx, 214, y(86), frame + 1, 1);
    paintFlame(ctx, 236, y(82), frame, 2);
    paintFlame(ctx, 92, y(116), frame + 2, 1);
    paintFlame(ctx, 108, y(112), frame, 2);
    paintFlame(ctx, 238, y(118), frame + 1, 3);
    paintFlame(ctx, 132, y(16), frame, 2);
    paintFlame(ctx, 154, y(10), frame + 2, 3);
    paintFlame(ctx, 180, y(12), frame + 1, 1);
    paintFlame(ctx, 206, y(8), frame, 3);
    paintFlame(ctx, 228, y(14), frame + 2, 2);
    paintSmoke(ctx, 128, 18, frame, 2);
    paintSmoke(ctx, 158, 10, frame + 1, 3);
    paintSmoke(ctx, 188, 6, frame + 2, 2);
    paintSmoke(ctx, 218, 8, frame, 3);
    paintSmoke(ctx, 248, 14, frame + 1, 2);
    paintSmoke(ctx, 140, y(4), frame + 2, 1);
    paintSmoke(ctx, 200, y(0), frame, 2);
  }));
}

function rackFireFrames(seed: number) {
  const [width, height] = WORLD_MODEL_SIZES.racks;
  const head = 18;
  return [0, 1, 2, 3].map((frame) => paintPixelTexture(width, height + head, (ctx) => {
    const y = (n: number) => n + head;
    paintFlame(ctx, 10 + (seed % 4), y(8), frame + seed, 1);
    paintFlame(ctx, 38, y(2), frame + 1, 2);
    paintFlame(ctx, 64, y(10), frame + 2, 1);
    paintSmoke(ctx, 18, 4, frame + seed, 2);
    paintSmoke(ctx, 44, 2, frame + 1, 1);
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
