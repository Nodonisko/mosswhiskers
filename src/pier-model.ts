import * as THREE from "three";
import { createPixelCanvas, nearestTexture } from "./pixel-canvas";
import { seeded } from "./rng";

export interface PierModelOptions {
  width?: number;
  height?: number;
  seed?: number;
}

export interface PierModel {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  width: number;
  height: number;
  /** Local XY bounds of the planks, excluding posts and the water shadow. */
  deckBounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Positive inset keeps a character's feet inside the deck edges. */
  containsPoint: (localX: number, localY: number, inset?: number) => boolean;
}

/** A small XY ground-plane pier; its north (+Y) end meets the bank. */
export function createPierModel(options: PierModelOptions = {}): PierModel {
  const width = options.width ?? 84;
  const height = options.height ?? 136;
  const { canvas, context: ctx } = createPixelCanvas(42, 68);
  const random = seeded(options.seed ?? 719);
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  // Low, offset shadow and the two supporting timbers beneath the planks.
  rect(5, 7, 35, 59, "rgba(35, 57, 52, 0.23)");
  rect(7, 4, 3, 60, "#655036");
  rect(32, 4, 3, 60, "#655036");
  rect(4, 3, 34, 60, "#655036");
  rect(4, 63, 34, 2, "#584b35");

  const plankColors = ["#a28a5d", "#aa9163", "#9c8358", "#ad9466"];
  for (let row = 0; row < 12; row++) {
    const y = 3 + row * 5;
    const left = 3 + (row % 4 === 1 ? 0 : 1);
    const right = 38 + (row % 5 === 2 ? 1 : 0);
    rect(left, y, right - left, 4, plankColors[Math.floor(random() * plankColors.length)]!);
    rect(left + 1, y, right - left - 2, 1, "#b9a174");
    rect(left, y + 3, right - left, 1, "#8b714b");
    // Short grain marks, occasional knots, and dark nail heads stay quiet at game scale.
    const grainX = 11 + Math.floor(random() * 12);
    rect(grainX, y + 2, 4 + Math.floor(random() * 6), 1, "#91774f");
    if (row % 4 === 2) {
      rect(grainX + 2, y + 1, 2, 1, "#806b47");
      rect(grainX + 3, y + 2, 2, 1, "#b49b6b");
    }
    rect(7, y + 2, 1, 1, "#63583f");
    rect(34, y + 2, 1, 1, "#63583f");
  }

  // Four short mooring posts leave the middle and shore entrance open.
  for (const y of [10, 56]) {
    for (const x of [2, 36]) {
      rect(x + 1, y + 1, 5, 8, "rgba(42, 49, 36, 0.25)");
      rect(x, y - 2, 4, 8, "#6c5739");
      rect(x, y - 2, 2, 7, "#90774e");
      rect(x - 1, y - 3, 6, 3, "#695739");
      rect(x, y - 3, 4, 2, "#c0a476");
      rect(x + 1, y - 2, 2, 1, "#9e8356");
    }
  }

  const texture = nearestTexture(canvas);

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture, transparent: true, alphaTest: 0.08, depthWrite: false, toneMapped: false,
    }),
  );
  mesh.name = "north-lake-pier";
  mesh.position.z = -2;
  mesh.renderOrder = -8;

  const deckBounds = {
    minX: (4 / 42 - 0.5) * width,
    maxX: (38 / 42 - 0.5) * width,
    minY: (0.5 - 63 / 68) * height,
    maxY: (0.5 - 3 / 68) * height,
  };
  return {
    mesh, width, height, deckBounds,
    containsPoint(localX, localY, inset = 0) {
      return localX >= deckBounds.minX + inset && localX <= deckBounds.maxX - inset
        && localY >= deckBounds.minY + inset && localY <= deckBounds.maxY - inset;
    },
  };
}
