import * as THREE from "three";
import { createPixelCanvas, nearestTexture } from "./pixel-canvas";
import type { PlayerSim } from "./sim";
import { MEOW_DURATION } from "./world-config";

const MEOW_WIDTH = 96;
const MEOW_HEIGHT = 32;
const MEOW_SCALE = 0.72;

/** Bounce, rise, and fade from sim time so every client paints the same meow. */
export function meowPose(elapsed: number) {
  const t = Math.min(1, Math.max(0, elapsed / MEOW_DURATION));
  const squash =
    t < 0.14 ? 0.22 + (t / 0.14) * 0.6 :
    t < 0.26 ? 0.82 + ((t - 0.14) / 0.12) * 0.32 :
    1;
  const stretch =
    t < 0.14 ? 0.35 + (t / 0.14) * 0.87 :
    t < 0.26 ? 1.22 - ((t - 0.14) / 0.12) * 0.22 :
    t < 0.4 ? 1 - ((t - 0.26) / 0.14) * 0.04 :
    1;
  const rise = 28 + t * 36;
  const tilt = t < 0.72 ? Math.sin(t * Math.PI * 5) * 0.18 * (1 - t) : 0;
  const opacity = t < 0.1 ? t / 0.1 : t > 0.72 ? Math.max(0, 1 - (t - 0.72) / 0.28) : 1;
  return { rise, scaleX: stretch, scaleY: squash, rotation: tilt, opacity };
}

function paintMeow(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, MEOW_WIDTH, MEOW_HEIGHT);
  ctx.imageSmoothingEnabled = false;
  ctx.font = '16px "Press Start 2P"';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "miter";
  ctx.miterLimit = 2;
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#3a2a14";
  ctx.fillStyle = "#fff8dd";
  ctx.strokeText("Meow", MEOW_WIDTH / 2, MEOW_HEIGHT / 2);
  ctx.fillText("Meow", MEOW_WIDTH / 2, MEOW_HEIGHT / 2);
}

export function createMeowLayer(world: THREE.Group) {
  const { canvas, context } = createPixelCanvas(MEOW_WIDTH, MEOW_HEIGHT);
  paintMeow(context);
  const texture = nearestTexture(canvas);
  const views = new Map<string, THREE.Sprite>();

  void document.fonts.load('16px "Press Start 2P"').then(() => {
    paintMeow(context);
    texture.needsUpdate = true;
  });

  function discard(id: string) {
    const sprite = views.get(id);
    if (!sprite) return;
    world.remove(sprite);
    sprite.material.dispose();
    views.delete(id);
  }

  return {
    sync(players: readonly PlayerSim[]) {
      const living = new Set<string>();
      for (const player of players) {
        if (!player.meowing) continue;
        living.add(player.id);
        let sprite = views.get(player.id);
        if (!sprite) {
          sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          }));
          sprite.center.set(0.5, 0);
          sprite.scale.set(MEOW_WIDTH * MEOW_SCALE, MEOW_HEIGHT * MEOW_SCALE, 1);
          world.add(sprite);
          views.set(player.id, sprite);
        }
        const pose = meowPose(player.meowElapsed);
        sprite.visible = pose.opacity > 0.02;
        sprite.position.set(player.x, player.y + pose.rise, 12);
        sprite.scale.set(MEOW_WIDTH * MEOW_SCALE * pose.scaleX, MEOW_HEIGHT * MEOW_SCALE * pose.scaleY, 1);
        sprite.material.rotation = pose.rotation;
        sprite.material.opacity = pose.opacity;
        sprite.renderOrder = 30010;
      }
      for (const id of views.keys()) {
        if (!living.has(id)) discard(id);
      }
    },
    dispose() {
      for (const id of [...views.keys()]) discard(id);
      texture.dispose();
    },
  };
}
