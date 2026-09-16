import * as THREE from "three";
import { createPixelCanvas, nearestTexture, whenPixelFontReady } from "./pixel-canvas";
import type { PlayerSim } from "./sim";
import { LOCAL_PLAYER_ID } from "./world-config";

const FONT = '8px "Press Start 2P"';
const PAD_X = 6;
const PAD_Y = 4;
const NAME_RISE = 58;
const NAME_SCALE = 1.05;

export type NameTag = {
  id: string;
  name: string;
  x: number;
  y: number;
};

type NameTexture = {
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
};

type NameView = {
  sprite: THREE.Sprite;
  name: string;
};

function paintName(text: string): NameTexture {
  const probe = createPixelCanvas(8, 8);
  probe.context.font = FONT;
  const textWidth = Math.ceil(probe.context.measureText(text).width);
  const width = Math.max(16, textWidth + PAD_X * 2);
  const height = 8 + PAD_Y * 2;
  const { canvas, context } = createPixelCanvas(width, height);
  context.font = FONT;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "miter";
  context.miterLimit = 2;
  context.lineWidth = 3;
  context.strokeStyle = "#3a2a14";
  context.fillStyle = "#fff8dd";
  const cx = width / 2;
  const cy = height / 2 + 1;
  context.strokeText(text, cx, cy);
  context.fillText(text, cx, cy);
  return { texture: nearestTexture(canvas), width, height };
}

export function playerNameTags(players: readonly PlayerSim[], localId = LOCAL_PLAYER_ID): NameTag[] {
  return players
    .filter((player) => player.id !== localId)
    .map((player) => ({ id: player.id, name: player.name, x: player.x, y: player.y }));
}

export function createNameLayer(world: THREE.Group) {
  const cache = new Map<string, NameTexture>();
  const views = new Map<string, NameView>();

  function textureFor(name: string) {
    const cached = cache.get(name);
    if (cached) return cached;
    const painted = paintName(name);
    cache.set(name, painted);
    return painted;
  }

  function apply(sprite: THREE.Sprite, painted: NameTexture) {
    const material = sprite.material as THREE.SpriteMaterial;
    material.map = painted.texture;
    sprite.scale.set(painted.width * NAME_SCALE, painted.height * NAME_SCALE, 1);
  }

  function discard(id: string) {
    const view = views.get(id);
    if (!view) return;
    world.remove(view.sprite);
    view.sprite.material.dispose();
    views.delete(id);
  }

  function refresh() {
    cache.clear();
    for (const view of views.values()) apply(view.sprite, textureFor(view.name));
  }

  whenPixelFontReady(refresh);

  return {
    sync(tags: readonly NameTag[]) {
      const living = new Set<string>();
      for (const tag of tags) {
        if (!tag.name) continue;
        living.add(tag.id);
        let view = views.get(tag.id);
        if (!view) {
          const painted = textureFor(tag.name);
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: painted.texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          }));
          sprite.center.set(0.5, 0);
          apply(sprite, painted);
          world.add(sprite);
          view = { sprite, name: tag.name };
          views.set(tag.id, view);
        } else if (view.name !== tag.name) {
          view.name = tag.name;
          apply(view.sprite, textureFor(tag.name));
        }
        view.sprite.position.set(tag.x, tag.y + NAME_RISE, 12);
        view.sprite.renderOrder = 30006;
      }
      for (const id of views.keys()) {
        if (!living.has(id)) discard(id);
      }
    },
    dispose() {
      for (const id of [...views.keys()]) discard(id);
      for (const painted of cache.values()) painted.texture.dispose();
      cache.clear();
    },
  };
}
