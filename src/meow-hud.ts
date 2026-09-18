import * as THREE from "three";
import { createPixelCanvas, nearestTexture, whenPixelFontReady } from "./pixel-canvas";
import { MEOW_DURATION, MEOW_TEXT_DELAY, HISS_TEXT_DELAY, GROWL_TEXT_DELAY } from "./world-config";

const MEOW_WIDTH = 96;
const MEOW_HEIGHT = 32;
const MEOW_SCALE = 0.72;

export const SPEECH_LABELS = ["Meow", "SSSSS", "GRRRR"] as const;
export type SpeechLabel = (typeof SPEECH_LABELS)[number];

export type SpeechPop = {
  id: string;
  x: number;
  y: number;
  elapsed: number;
  label: SpeechLabel;
};

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

function paintSpeech(ctx: CanvasRenderingContext2D, label: SpeechLabel) {
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
  ctx.strokeText(label, MEOW_WIDTH / 2, MEOW_HEIGHT / 2);
  ctx.fillText(label, MEOW_WIDTH / 2, MEOW_HEIGHT / 2);
}

type SpeechTexture = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
};

export function createMeowLayer(world: THREE.Group) {
  const textures = {} as Record<SpeechLabel, SpeechTexture>;
  for (const label of SPEECH_LABELS) {
    const { canvas, context } = createPixelCanvas(MEOW_WIDTH, MEOW_HEIGHT);
    paintSpeech(context, label);
    textures[label] = { canvas, context, texture: nearestTexture(canvas) };
  }
  const views = new Map<string, { sprite: THREE.Sprite; label: SpeechLabel }>();

  whenPixelFontReady(() => {
    for (const label of SPEECH_LABELS) {
      const painted = textures[label];
      paintSpeech(painted.context, label);
      painted.texture.needsUpdate = true;
    }
  });

  function discard(id: string) {
    const view = views.get(id);
    if (!view) return;
    world.remove(view.sprite);
    view.sprite.material.dispose();
    views.delete(id);
  }

  return {
    sync(pops: readonly SpeechPop[]) {
      const living = new Set<string>();
      for (const pop of pops) {
        const delay = pop.label === "Meow" ? MEOW_TEXT_DELAY : pop.label === "SSSSS" ? HISS_TEXT_DELAY : GROWL_TEXT_DELAY;
        const poseElapsed = pop.elapsed - delay;
        if (poseElapsed < 0) continue;
        living.add(pop.id);
        let view = views.get(pop.id);
        if (!view) {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures[pop.label].texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          }));
          sprite.center.set(0.5, 0);
          sprite.scale.set(MEOW_WIDTH * MEOW_SCALE, MEOW_HEIGHT * MEOW_SCALE, 1);
          world.add(sprite);
          view = { sprite, label: pop.label };
          views.set(pop.id, view);
        } else if (view.label !== pop.label) {
          view.label = pop.label;
          view.sprite.material.map = textures[pop.label].texture;
        }
        const pose = meowPose(poseElapsed);
        view.sprite.visible = pose.opacity > 0.02;
        view.sprite.position.set(pop.x, pop.y + pose.rise, 12);
        view.sprite.scale.set(MEOW_WIDTH * MEOW_SCALE * pose.scaleX, MEOW_HEIGHT * MEOW_SCALE * pose.scaleY, 1);
        view.sprite.material.rotation = pose.rotation;
        view.sprite.material.opacity = pose.opacity;
        view.sprite.renderOrder = 30010;
      }
      for (const id of views.keys()) {
        if (!living.has(id)) discard(id);
      }
    },
    dispose() {
      for (const id of [...views.keys()]) discard(id);
      for (const painted of Object.values(textures)) painted.texture.dispose();
    },
  };
}
