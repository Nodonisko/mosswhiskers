import * as THREE from "three";
import { paintPixelTexture } from "./pixel-canvas";
import type { RocketCarrotPose } from "./sim";

type Puff = {
  sprite: THREE.Sprite;
  born: number;
  x: number;
  y: number;
  drift: number;
  rise: number;
  life: number;
};

export type RocketFx = {
  fire: THREE.Sprite;
  fireFrames: THREE.CanvasTexture[];
  puffs: Puff[];
  puffFrames: THREE.CanvasTexture[];
  plantedMap: THREE.Texture;
  launchMap: THREE.Texture;
  origin: { x: number; y: number };
  spawnAt: number;
};

const PUFF_COUNT = 16;
const PUFF_LIFE = 0.9;

let fireFrameCache: THREE.CanvasTexture[] | undefined;
let puffFrameCache: THREE.CanvasTexture[] | undefined;

function fireFrames() {
  const draw = (ctx: CanvasRenderingContext2D, frame: number) => {
    const w = frame === 1 ? 1 : 0;
    const stretch = frame % 3;
    ctx.fillStyle = "#d8653f";
    ctx.fillRect(3 + w, 1, 6, 8 + stretch);
    ctx.fillRect(4 + w, 8 + stretch, 4, 4);
    ctx.fillRect(5 + w, 12 + stretch, 2, 3);
    ctx.fillStyle = "#ffd36a";
    ctx.fillRect(4 + w, 3, 4, 6 + stretch);
    ctx.fillRect(5 + w, 8 + stretch, 2, 4);
    if (frame !== 2) {
      ctx.fillStyle = "#fff4c8";
      ctx.fillRect(5 + w, 5, 2, 4);
    }
  };
  return [0, 1, 2].map((frame) => paintPixelTexture(12, 18, (ctx) => draw(ctx, frame)));
}

function getFireFrames() {
  return fireFrameCache ??= fireFrames();
}

function puffFrames() {
  const draw = (ctx: CanvasRenderingContext2D, frame: number) => {
    const drift = frame % 3;
    ctx.fillStyle = "#6a6860";
    ctx.fillRect(4 + drift, 8, 7, 5);
    ctx.fillStyle = "#8a8880";
    ctx.fillRect(5 + drift, 5, 6, 4);
    ctx.fillStyle = "#a8a69c";
    ctx.fillRect(6 + drift, 3, 4, 3);
    if (frame > 0) {
      ctx.fillStyle = "#7a7870";
      ctx.fillRect(2 + drift, 7, 4, 3);
    }
  };
  return [0, 1, 2].map((frame) => paintPixelTexture(16, 16, (ctx) => draw(ctx, frame)));
}

function getPuffFrames() {
  return puffFrameCache ??= puffFrames();
}

function exhaustAt(pose: RocketCarrotPose) {
  if (pose.flying) return { x: pose.x, y: pose.y - 4 };
  return { x: pose.x, y: pose.y + 4 };
}

export function createRocketFx(
  carrot: THREE.Sprite,
  world: THREE.Object3D,
  plantedMap: THREE.Texture,
  launchMap: THREE.Texture,
  origin: { x: number; y: number },
): RocketFx {
  const frames = getFireFrames();
  const fire = new THREE.Sprite(new THREE.SpriteMaterial({
    map: frames[0],
    transparent: true,
    opacity: 1,
    alphaTest: 0.04,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  }));
  fire.center.set(0.5, 1);
  fire.scale.set(28, 42, 1);
  fire.visible = false;
  fire.position.z = 2.4;
  fire.renderOrder = carrot.renderOrder + 2;
  world.add(fire);

  const smoke = getPuffFrames();
  const puffs: Puff[] = [];
  for (let i = 0; i < PUFF_COUNT; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smoke[i % smoke.length],
      transparent: true,
      opacity: 0,
      alphaTest: 0,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    }));
    sprite.center.set(0.5, 0.5);
    sprite.scale.set(18, 16, 1);
    sprite.visible = false;
    sprite.position.z = 2.3;
    world.add(sprite);
    puffs.push({ sprite, born: -10, x: 0, y: 0, drift: 0, rise: 0, life: PUFF_LIFE });
  }

  return {
    fire,
    fireFrames: frames,
    puffs,
    puffFrames: smoke,
    plantedMap,
    launchMap,
    origin,
    spawnAt: -1,
  };
}

function puffNoise(elapsed: number, salt: number) {
  const n = Math.sin(elapsed * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function spawnPuff(fx: RocketFx, x: number, y: number, elapsed: number) {
  let puff = fx.puffs[0]!;
  for (const item of fx.puffs) {
    if (elapsed - item.born >= item.life) {
      puff = item;
      break;
    }
    if (item.born < puff.born) puff = item;
  }
  puff.born = elapsed;
  puff.x = x + puffNoise(elapsed + fx.origin.x * 0.01, 1) * 6 - 3;
  puff.y = y;
  puff.drift = puffNoise(elapsed + fx.origin.y * 0.01, 2) * 28 - 14;
  puff.rise = 18 + puffNoise(elapsed + fx.origin.x * 0.02, 3) * 16;
  puff.life = 0.7 + puffNoise(elapsed, 4) * 0.4;
  puff.sprite.visible = true;
}

export function updateRocketFx(
  fx: RocketFx,
  carrot: THREE.Sprite,
  pose: RocketCarrotPose,
  elapsed: number,
  launched: boolean,
  taken = false,
) {
  const material = carrot.material as THREE.SpriteMaterial;
  if (taken) {
    carrot.visible = false;
    fx.fire.visible = false;
    for (const puff of fx.puffs) puff.sprite.visible = false;
    return;
  }
  if (!launched) {
    material.map = fx.plantedMap;
    material.rotation = 0;
    carrot.center.set(0.5, 0);
    carrot.position.set(fx.origin.x, fx.origin.y, 0);
    carrot.renderOrder = 10000 - Math.round(fx.origin.y);
    carrot.visible = true;
    fx.fire.visible = false;
    for (const puff of fx.puffs) puff.sprite.visible = false;
    return;
  }

  carrot.visible = !pose.gone;
  const active = pose.igniting || pose.flying;
  fx.fire.visible = active && !pose.gone;
  if (pose.flying) {
    material.map = fx.launchMap;
    material.rotation = 0;
    carrot.center.set(0.5, 0);
    carrot.position.set(pose.x, pose.y, 2.5);
    carrot.renderOrder = 40000;
  } else {
    material.map = fx.plantedMap;
    material.rotation = 0;
    carrot.center.set(0.5, 0);
    carrot.position.set(pose.x, pose.y, 0.4);
    carrot.renderOrder = 10000 - Math.round(fx.origin.y);
  }
  material.opacity = 1;

  const exhaust = exhaustAt(pose);
  if (fx.fire.visible) {
    const frame = Math.floor(Math.max(0, elapsed) / 0.08) % fx.fireFrames.length;
    const fireMat = fx.fire.material as THREE.SpriteMaterial;
    fireMat.map = fx.fireFrames[frame]!;
    fireMat.opacity = pose.flying ? 1 : 0.85;
    fx.fire.position.set(exhaust.x, exhaust.y, 2.6);
    fx.fire.renderOrder = carrot.renderOrder + 2;
    fx.fire.scale.set(pose.flying ? 36 : 28, pose.flying ? 54 : 42, 1);
  }

  const gap = pose.flying ? 0.055 : 0.1;
  if (active && elapsed - fx.spawnAt >= gap) {
    spawnPuff(fx, exhaust.x, exhaust.y, elapsed);
    fx.spawnAt = elapsed;
  }

  for (const puff of fx.puffs) {
    const age = elapsed - puff.born;
    if (age < 0 || age >= puff.life) {
      puff.sprite.visible = false;
      continue;
    }
    const t = age / puff.life;
    puff.sprite.visible = true;
    puff.sprite.position.set(puff.x + puff.drift * t, puff.y + puff.rise * t, 2.3);
    puff.sprite.scale.set(16 + t * 14, 14 + t * 12, 1);
    puff.sprite.renderOrder = carrot.renderOrder + 1;
    const puffMat = puff.sprite.material as THREE.SpriteMaterial;
    puffMat.map = fx.puffFrames[Math.min(fx.puffFrames.length - 1, Math.floor(t * fx.puffFrames.length))]!;
    puffMat.opacity = (1 - t) * 0.9;
  }
}
