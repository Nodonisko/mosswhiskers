import * as THREE from "three";
import { paintPixelTexture } from "./pixel-canvas";
import { WORLD_MODEL_SIZES } from "./world-models";

type Overlay = {
  sprite: THREE.Sprite;
  frames: THREE.CanvasTexture[];
  step: number;
};

export type HutFx = {
  overlays: Overlay[];
};

const LANTERN_ORIGIN = { x: 31, y: 78 };
const WINDOW_ORIGIN = { x: 78, y: 70 };
const SMOKE_ORIGIN = { x: 94, y: -28 };

function hutPixelCenter(hut: THREE.Sprite, px: number, py: number) {
  const [width, height] = WORLD_MODEL_SIZES.hut;
  const scaleX = hut.scale.x / width;
  const scaleY = hut.scale.y / height;
  return {
    x: hut.position.x + (px - width / 2) * scaleX,
    y: hut.position.y + (height - py) * scaleY,
  };
}

function overlay(
  hut: THREE.Sprite,
  origin: { x: number; y: number },
  frames: THREE.CanvasTexture[],
  nativeWidth: number,
  nativeHeight: number,
  step: number,
): Overlay {
  const [hutW, hutH] = WORLD_MODEL_SIZES.hut;
  const scaleX = hut.scale.x / hutW;
  const scaleY = hut.scale.y / hutH;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: frames[0],
    transparent: true,
    opacity: 1,
    alphaTest: 0.04,
    depthWrite: false,
    toneMapped: false,
  }));
  sprite.scale.set(nativeWidth * scaleX, nativeHeight * scaleY, 1);
  const center = hutPixelCenter(hut, origin.x + nativeWidth / 2, origin.y + nativeHeight / 2);
  sprite.position.set(center.x, center.y, 1.4);
  sprite.renderOrder = hut.renderOrder + 2;
  sprite.center.set(0.5, 0.5);
  return { sprite, frames, step };
}

function smokeOverlay(
  hut: THREE.Sprite,
  frames: THREE.CanvasTexture[],
  nativeWidth: number,
  nativeHeight: number,
  step: number,
): Overlay {
  const item = overlay(hut, SMOKE_ORIGIN, frames, nativeWidth, nativeHeight, step);
  const material = item.sprite.material as THREE.SpriteMaterial;
  material.alphaTest = 0;
  material.depthTest = false;
  item.sprite.position.z = 2.2;
  item.sprite.renderOrder = hut.renderOrder + 8;
  return item;
}

function lanternFrames() {
  const wash = (ctx: CanvasRenderingContext2D, alpha: number) => {
    ctx.fillStyle = `rgba(242, 213, 106, ${alpha})`;
    ctx.fillRect(2, 3, 5, 6);
  };
  const core = (ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number) => {
    ctx.fillStyle = `rgba(255, 241, 168, ${alpha})`;
    ctx.fillRect(x, y, 3, 3);
    ctx.fillStyle = `rgba(255, 252, 220, ${alpha * 0.7})`;
    ctx.fillRect(x + 1, y + 1, 1, 1);
  };
  return [
    paintPixelTexture(9, 11, (ctx) => {
      wash(ctx, 0.16);
      core(ctx, 3, 4, 0.42);
    }),
    paintPixelTexture(9, 11, (ctx) => {
      wash(ctx, 0.28);
      ctx.fillStyle = "rgba(232, 168, 72, 0.18)";
      ctx.fillRect(7, 5, 2, 4);
      core(ctx, 3, 3, 0.58);
      ctx.fillStyle = "rgba(255, 252, 230, 0.45)";
      ctx.fillRect(4, 3, 1, 1);
    }),
    paintPixelTexture(9, 11, (ctx) => {
      wash(ctx, 0.12);
      core(ctx, 3, 5, 0.32);
    }),
  ];
}

function windowFrames() {
  const gloss = (ctx: CanvasRenderingContext2D, alpha: number) => {
    ctx.fillStyle = `rgba(255, 252, 236, ${alpha})`;
    ctx.fillRect(2, 2, 2, 1);
    ctx.fillRect(2, 2, 1, 2);
  };
  return [
    paintPixelTexture(20, 16, (ctx) => gloss(ctx, 0.12)),
    paintPixelTexture(20, 16, (ctx) => gloss(ctx, 0.22)),
    paintPixelTexture(20, 16, (ctx) => gloss(ctx, 0.34)),
    paintPixelTexture(20, 16, (ctx) => gloss(ctx, 0.2)),
  ];
}

function smokeFrames() {
  const puff = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const column = (
    ctx: CanvasRenderingContext2D,
    drift: number,
    rise: number,
  ) => {
    puff(ctx, 8 + drift, 45 - rise, 6, 3, "#9a968c");
    puff(ctx, 9 + drift, 43 - rise, 4, 2, "#c8c4ba");
    puff(ctx, 10 + drift, 37 - rise, 5, 3, "#b0aca2");
    puff(ctx, 11 + drift, 35 - rise, 3, 2, "#d4d0c6");
    puff(ctx, 12 + drift, 28 - rise, 5, 3, "#a8a49a");
    puff(ctx, 14 + drift, 26 - rise, 3, 2, "#ccc8be");
    puff(ctx, 15 + drift, 19 - rise, 4, 3, "#9c9890");
    puff(ctx, 16 + drift, 17 - rise, 3, 2, "#c0bcb4");
    puff(ctx, 17 + drift, 11 - rise, 3, 2, "#b4b0a8");
  };
  return [
    paintPixelTexture(24, 48, (ctx) => column(ctx, 0, 0)),
    paintPixelTexture(24, 48, (ctx) => column(ctx, 1, 3)),
    paintPixelTexture(24, 48, (ctx) => column(ctx, 2, 6)),
    paintPixelTexture(24, 48, (ctx) => column(ctx, 1, 2)),
  ];
}

export function createHutFx(hut: THREE.Sprite, world: THREE.Object3D): HutFx {
  const overlays = [
    overlay(hut, LANTERN_ORIGIN, lanternFrames(), 9, 11, 0.34),
    overlay(hut, WINDOW_ORIGIN, windowFrames(), 20, 16, 1.15),
    smokeOverlay(hut, smokeFrames(), 24, 48, 0.42),
  ];
  for (const item of overlays) world.add(item.sprite);
  return { overlays };
}

export function updateHutFx(fx: HutFx, hut: THREE.Sprite, elapsed: number) {
  const opacity = (hut.material as THREE.SpriteMaterial).opacity;
  for (const item of fx.overlays) {
    const frame = Math.floor(Math.max(0, elapsed) / item.step) % item.frames.length;
    const material = item.sprite.material as THREE.SpriteMaterial;
    material.map = item.frames[frame]!;
    material.opacity = opacity;
  }
}
