import * as THREE from 'three';
import { seeded } from './rng';
import { TREE_TRUNK_HITBOX, isRotatableWorldKind, normalizeRotation, type WorldModelKind, type WorldProp } from './world-config';
import { paintFlowers, paintFern, paintClover } from './deco-blooms';
import { paintGrass, paintWheat, paintReeds } from './deco-grass';
import { paintMushroom } from './deco-fungi';
import { paintMoss, paintMossLog, paintStump } from './deco-moss';

export type { WorldModelKind };
export { TREE_TRUNK_HITBOX };
export type CatView = 'e' | 'w' | 'n' | 's';

export interface WorldModelOptions {
  seed?: number;
  scale?: number;
  /** Flowers: 0 white–7 daisy. Grass/wheat/reeds/mushroom/moss/fern/stump/clover: palette. Trees: foliage. Cat: 0 idle, 1–4 walk, 5–7 claw. */
  variant?: number;
  /** Cat, mouse, and fish. West is painted flipped. */
  facing?: CatView;
  /** Cat claw: red slash marks after a hit. */
  hit?: boolean;
  /** Pine/oak: yellowish-grey dying foliage. */
  sick?: boolean;
}

type Point = readonly [number, number];
type Paint = ReturnType<typeof painter>;
const textureCache = new Map<string, THREE.CanvasTexture>();

export const WORLD_MODEL_SIZES: Record<WorldModelKind, readonly [number, number]> = {
  pine: [88, 142], oak: [120, 152], willow: [146, 168], bush: [42, 38], den: [198, 154], hut: [136, 118], datacenter: [312, 180], racks: [96, 88], bernie: [36, 42], sam: [36, 42],
  carrot: [56, 92], rabbit: [36, 42], fence: [78, 36], shed: [188, 132],
  mailbox: [26, 48], mailBubble: [46, 38], lamp: [28, 84], flowers: [40, 40], stone: [32, 22], log: [90, 32],
  grass: [44, 28], wheat: [48, 44], reeds: [42, 68], mushroom: [36, 34], moss: [50, 22], mossLog: [90, 36], fern: [48, 44], stump: [46, 38], clover: [36, 20],
  cat: [36, 42],
  pike: [52, 18], perch: [36, 20], bluegill: [28, 24], mouse: [32, 16],
};

/** Raster primitives deliberately avoid canvas antialiasing. */
function painter(width: number, height: number, seed: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const random = seeded(seed);
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, color: string) => {
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      const span = rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
      rect(Math.ceil(cx - span), y, Math.floor(cx + span) - Math.ceil(cx - span) + 1, 1, color);
    }
  };
  const poly = (points: readonly Point[], color: string) => {
    const minY = Math.ceil(Math.min(...points.map(p => p[1])));
    const maxY = Math.floor(Math.max(...points.map(p => p[1])));
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i]!;
        const b = points[(i + 1) % points.length]!;
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) rect(Math.ceil(xs[i]!), y, Math.floor(xs[i + 1]!) - Math.ceil(xs[i]!) + 1, 1, color);
    }
  };
  const line = (x0: number, y0: number, x1: number, y1: number, color: string, thickness = 1) => {
    const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      rect(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thickness, thickness, color);
    }
  };
  return { canvas, ctx, random, rect, ellipse, poly, line };
}

function flipCanvasX(p: Paint) {
  const { canvas, ctx } = p;
  const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const dst = ctx.createImageData(canvas.width, canvas.height);
  const width = canvas.width;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      const to = (y * width + (width - 1 - x)) * 4;
      dst.data[to] = src.data[from]!;
      dst.data[to + 1] = src.data[from + 1]!;
      dst.data[to + 2] = src.data[from + 2]!;
      dst.data[to + 3] = src.data[from + 3]!;
    }
  }
  ctx.putImageData(dst, 0, 0);
}

const pineColors = ['#294222', '#345125', '#405f2a', '#507231', '#62853c', '#779449', '#899e52'];
const oakColors = ['#285a35', '#2e713b', '#378345', '#42934b', '#55a559', '#6ab666', '#83c379'];
const sickPineColors = ['#3f3e32', '#534f3c', '#655e46', '#746c50', '#857a5a', '#93886a', '#a39878'];
const sickOakColors = ['#454338', '#585440', '#686248', '#787054', '#877c60', '#94886c', '#a39678'];

function leafCluster(p: Paint, x: number, y: number, rx: number, ry: number, palette: string[], detail = 1) {
  p.ellipse(x, y + 2, rx, ry, palette[0]!);
  p.ellipse(x - 1, y - 1, rx - 2, ry - 2, palette[2]!);
  const count = Math.floor(rx * ry * 0.29 * detail);
  for (let i = 0; i < count; i++) {
    const dx = (p.random() * 2 - 1) * (rx - 2);
    const dy = (p.random() * 2 - 1) * (ry - 2);
    if ((dx / (rx - 2)) ** 2 + (dy / (ry - 2)) ** 2 > 0.92) continue;
    const light = -dx / rx * 0.5 - dy / ry * 0.4 + p.random();
    const colorIndex = Math.max(1, Math.min(palette.length - 1, Math.floor(light * 3 + 2)));
    const size = 2 + Math.floor(p.random() * 3);
    p.rect(x + dx, y + dy, size, 2 + Math.floor(p.random() * 3), palette[colorIndex]!);
    if (p.random() > 0.62) p.rect(x + dx - 1, y + dy + 1, size + 1, 2, palette[Math.max(1, colorIndex - 1)]!);
  }
}

function trunk(p: Paint, x: number, bottom: number, h: number, w: number, sick = false) {
  p.poly([[x - w / 2, bottom - h], [x + w / 2, bottom - h], [x + w / 2, bottom - 11], [x + w, bottom - 2], [x + w / 2, bottom], [x + 1, bottom - 4], [x - 3, bottom], [x - w, bottom - 2], [x - w / 2, bottom - 12]], sick ? '#5a5344' : '#51472f');
  p.poly([[x - w / 2 + 2, bottom - h], [x + w / 2 - 2, bottom - h], [x + w / 2 - 1, bottom - 10], [x + w - 3, bottom - 4], [x + 2, bottom - 7], [x - 3, bottom - 3], [x - w + 3, bottom - 4], [x - w / 2 + 3, bottom - 13]], sick ? '#7a6e52' : '#876b43');
  p.poly([[x - w / 2 + 3, bottom - h], [x, bottom - h], [x + 1, bottom - 16], [x - 3, bottom - 8], [x - w / 2 + 1, bottom - 6]], sick ? '#9a8a68' : '#a58b5b');
  p.line(x + w / 2 - 3, bottom - h + 4, x + w / 2 - 2, bottom - 13, '#695535', 2);
  p.line(x - 2, bottom - 31, x - 1, bottom - 16, '#bc9d67');
  p.line(x + 2, bottom - 17, x - 1, bottom - 10, '#705837');
}

function pine(p: Paint, variant: number, sick = false) {
  const healthy = variant % 2 ? pineColors.map((v, i) => i === 4 ? '#6b873a' : v) : pineColors;
  const palette = sick ? sickPineColors : healthy;
  const detail = sick ? 0.62 : 1;
  trunk(p, 43, 139, 70, 12, sick);
  // Layered boughs make the conical silhouette irregular, with the darkest skirts below.
  p.poly([[42, 3], [51, 16], [49, 18], [60, 31], [56, 32], [69, 49], [63, 49], [75, 65], [69, 65], [84, 90], [78, 94], [82, 100], [69, 110], [48, 115], [29, 113], [12, 105], [5, 98], [10, 91], [5, 89], [19, 67], [14, 69], [28, 45], [22, 47], [36, 24], [31, 26]], palette[0]!);
  leafCluster(p, 43, 91, 34, 21, palette, detail);
  leafCluster(p, 36, 79, 28, 18, palette, detail);
  leafCluster(p, 53, 78, 23, 17, palette, detail);
  leafCluster(p, 42, 60, 26, 19, palette, detail);
  leafCluster(p, 42, 44, 20, 17, palette, detail);
  leafCluster(p, 43, 29, 14, 15, palette, detail);
  leafCluster(p, 43, 15, 8, 10, palette, detail);
}

function oak(p: Paint, variant: number, sick = false) {
  const healthy = variant % 3 === 1 ? ['#304623', '#3d5726', '#506b2d', '#637f36', '#789343', '#8d9f51', '#a4b362'] : oakColors;
  const palette = sick ? sickOakColors : healthy;
  const detail = sick ? 0.65 : 1;
  trunk(p, 63, 149, 74, 20, sick);
  p.line(61, 116, 37, 84, '#745a35', 6);
  p.line(64, 114, 83, 83, '#755b35', 5);
  leafCluster(p, 61, 83, 48, 27, palette, detail);
  leafCluster(p, 30, 73, 27, 28, palette, detail);
  leafCluster(p, 91, 71, 25, 28, palette, detail);
  leafCluster(p, 53, 58, 33, 29, palette, detail);
  leafCluster(p, 30, 45, 25, 23, palette, detail);
  leafCluster(p, 87, 45, 28, 27, palette, detail);
  leafCluster(p, 59, 29, 31, 26, palette, detail);
  leafCluster(p, 52, 19, 19, 16, palette, detail);
}

function willow(p: Paint, variant: number) {
  const palette = variant % 2
    ? ['#365333', '#45653c', '#557c43', '#688e4b', '#7d9d58', '#91ae68', '#a2bb78']
    : ['#325239', '#416740', '#517b47', '#648e50', '#79a15e', '#8eaf70', '#a1be81'];
  p.ellipse(73, 163, 23, 4, '#4b6839');
  trunk(p, 73, 165, 101, 16);
  // Open, arching limbs remain visible between the hanging curtains of leaves.
  p.line(74, 123, 57, 76, '#65563a', 7);
  p.line(72, 120, 56, 77, '#a08a59', 3);
  p.line(57, 77, 29, 64, '#79633f', 4);
  p.line(76, 111, 98, 70, '#65563a', 6);
  p.line(76, 108, 96, 71, '#9b8152', 2);
  p.line(98, 70, 121, 68, '#79633f', 3);

  leafCluster(p, 73, 49, 49, 32, palette, 0.85);
  leafCluster(p, 37, 60, 29, 24, palette, 0.8);
  leafCluster(p, 109, 60, 29, 25, palette, 0.8);
  leafCluster(p, 58, 32, 29, 25, palette, 0.9);
  leafCluster(p, 91, 34, 31, 24, palette, 0.9);

  // Narrow, staggered fronds give the tree its weeping silhouette.
  for (let index = 0; index < 24; index++) {
    const x = 12 + index * 5.2;
    const edge = Math.abs(x - 73) / 64;
    const startY = 43 + edge * 15 + p.random() * 13;
    const length = 44 + edge * 16 + p.random() * 25;
    const bend = (x - 73) * 0.08;
    const phase = p.random() * Math.PI * 2;
    for (let step = 0; step < length; step += 3) {
      const t = step / length;
      const leafX = x + bend * t + Math.sin(t * 3 + phase) * 2;
      const width = t > 0.8 ? 2 : 3 + Math.floor(p.random() * 3);
      p.rect(leafX, startY + step, width, 4, palette[1]!);
      p.rect(leafX - 1, startY + step, Math.max(1, width - 1), 2, palette[3 + Math.floor(p.random() * 3)]!);
      if (step % 9 === 0 && t < 0.86) p.rect(leafX + width - 1, startY + step + 2, 2, 3, palette[2]!);
    }
  }
  leafCluster(p, 71, 27, 24, 18, palette, 0.75);
}

function bush(p: Paint) {
  p.ellipse(21, 33, 17, 4, '#41632b');
  leafCluster(p, 20, 24, 18, 12, oakColors);
  leafCluster(p, 11, 20, 9, 11, oakColors);
  leafCluster(p, 29, 18, 9, 12, oakColors);
  leafCluster(p, 20, 12, 12, 11, oakColors);
}

function rock(p: Paint, x: number, y: number, w: number, h: number, seedDetail = 60) {
  p.poly([[x + 2, y + h], [x, y + h * 0.65], [x + w * 0.17, y + h * 0.25], [x + w * 0.43, y], [x + w * 0.73, y + h * 0.06], [x + w * 0.97, y + h * 0.48], [x + w, y + h * 0.9], [x + w * 0.83, y + h]], '#555851');
  p.poly([[x + 3, y + h - 3], [x + 2, y + h * 0.64], [x + w * 0.2, y + h * 0.28], [x + w * 0.44, y + 2], [x + w * 0.7, y + h * 0.12], [x + w * 0.87, y + h * 0.45], [x + w * 0.84, y + h * 0.88], [x + w * 0.65, y + h - 2]], '#858780');
  p.poly([[x + 3, y + h * 0.62], [x + w * 0.2, y + h * 0.3], [x + w * 0.45, y + 3], [x + w * 0.64, y + h * 0.15], [x + w * 0.4, y + h * 0.38], [x + w * 0.32, y + h * 0.78]], '#a0a199');
  for (let i = 0; i < seedDetail; i++) {
    const dx = p.random() * w * 0.55 + w * 0.2;
    const dy = p.random() * h * 0.65 + h * 0.26;
    p.rect(x + dx, y + dy, 1 + Math.floor(p.random() * 2), 1, p.random() > 0.48 ? '#91938b' : '#7a7d75');
  }
}

function den(p: Paint) {
  // Shelter is a leaning slab and a fallen cedar surrounding a deep leafy doorway.
  p.ellipse(102, 146, 89, 6, '#4d6337');
  p.poly([[37, 141], [49, 49], [82, 18], [110, 32], [163, 99], [177, 146]], '#386c3b');
  for (let i = 0; i < 35; i++) {
    const x = 52 + p.random() * 102;
    const y = 48 + p.random() * 85;
    leafCluster(p, x, y, 10 + p.random() * 6, 8 + p.random() * 6, oakColors, 0.65);
  }
  p.poly([[75, 149], [76, 108], [81, 91], [92, 82], [103, 80], [116, 86], [124, 99], [126, 149]], '#294a31');
  p.poly([[84, 149], [84, 111], [90, 96], [100, 91], [111, 96], [118, 111], [118, 149]], '#284a31');
  // Weathered grey standing slab leans against the diagonal trunk.
  p.poly([[8, 149], [13, 122], [39, 34], [45, 16], [63, 8], [91, 7], [98, 17], [86, 51], [77, 77], [66, 113], [66, 149]], '#535951');
  p.poly([[13, 144], [18, 121], [43, 37], [50, 20], [74, 14], [91, 14], [84, 44], [73, 77], [62, 113], [62, 145]], '#828780');
  p.poly([[22, 121], [46, 43], [50, 26], [67, 24], [76, 31], [70, 55], [54, 99], [46, 133]], '#969b91');
  p.poly([[46, 22], [48, 15], [65, 10], [90, 10], [91, 15], [68, 16], [61, 21]], '#6c726c');
  for (let i = 0; i < 190; i++) {
    const y = 33 + p.random() * 96;
    const left = 48 - (y - 33) * 0.29;
    p.rect(left + 4 + p.random() * 25, y, 1, 1, p.random() > 0.5 ? '#92978f' : '#858a82');
  }
  rock(p, 2, 122, 38, 28, 30);
  rock(p, 34, 108, 31, 43, 45);
  // Broken branches behind the fallen trunk.
  p.line(120, 65, 140, 33, '#735329', 4);
  p.line(139, 36, 146, 35, '#997038', 3);
  p.line(143, 86, 171, 72, '#735329', 4);
  p.line(167, 75, 177, 61, '#997038', 3);
  p.line(114, 71, 93, 67, '#926b33', 3);
  // Main roof log, with long bands of bark and ragged cut edge.
  p.poly([[80, 17], [87, 8], [98, 12], [190, 130], [193, 142], [184, 150], [172, 149], [80, 33]], '#735326');
  p.poly([[83, 18], [91, 12], [99, 18], [187, 131], [188, 140], [180, 146], [172, 140], [84, 32]], '#9a712e');
  p.poly([[87, 16], [91, 15], [185, 135], [182, 139]], '#bd903c');
  p.line(83, 28, 174, 141, '#755323', 3);
  p.line(95, 23, 181, 132, '#785525', 2);
  p.line(90, 30, 165, 128, '#c2933e', 2);
  p.line(102, 34, 169, 119, '#ab8033', 2);
  for (let i = 0; i < 26; i++) {
    const t = p.random();
    const x = 92 + t * 84;
    const y = 27 + t * 109;
    p.line(x, y, x + 2, y + 4, p.random() > 0.5 ? '#795a2c' : '#c09342');
  }
  p.ellipse(181, 139, 8, 10, '#b78c42');
  p.ellipse(181, 139, 5, 7, '#7c5b2d');
  p.ellipse(181, 139, 3, 5, '#b0873b');
  // Low stacked stone support under the right side.
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const x = 128 + col * 12 + (row % 2) * 5;
      const y = 105 + row * 10;
      p.poly([[x, y + 10], [x - 2, y + 4], [x + 3, y], [x + 10, y + 1], [x + 14, y + 7], [x + 10, y + 13], [x + 2, y + 13]], '#685338');
      p.poly([[x + 1, y + 8], [x, y + 4], [x + 4, y + 2], [x + 9, y + 3], [x + 11, y + 7], [x + 8, y + 10], [x + 3, y + 10]], ['#a48a58', '#967b4e', '#b09a68'][Math.floor(p.random() * 3)]!);
    }
  }
}

function hut(p: Paint) {
  // Lived-in cottage. Feet (stones + shadow) sit on the last rows of the canvas.
  p.ellipse(68, 116, 52, 3, '#4a5236');
  p.ellipse(68, 115, 40, 2, '#5a6240');

  // Firewood stack on the left, sitting on the same ground line.
  p.rect(8, 98, 18, 16, '#5a3a20');
  p.rect(9, 99, 16, 14, '#8a5a30');
  for (let log = 0; log < 4; log++) {
    p.rect(10, 100 + log * 3, 14, 2, log % 2 ? '#c49a58' : '#6e4424');
    p.ellipse(24, 101 + log * 3, 2, 2, '#d4b070');
    p.ellipse(24, 101 + log * 3, 1, 1, '#6e4424');
  }

  // River-stone foundation flush with the sprite bottom.
  for (let col = 0; col < 9; col++) {
    const x = 18 + col * 11 + (col % 2);
    const y = 105 + (col % 3 === 0 ? 1 : 0);
    p.poly([[x, y + 12], [x - 2, y + 4], [x + 3, y], [x + 12, y + 2], [x + 13, y + 8], [x + 8, y + 12], [x + 2, y + 12]], '#5a564c');
    p.poly([[x + 1, y + 10], [x, y + 4], [x + 4, y + 2], [x + 10, y + 3], [x + 11, y + 7], [x + 7, y + 11], [x + 3, y + 11]], ['#8a8680', '#a09c94', '#7a7670'][col % 3]!);
    if (col % 3 === 1) p.rect(x + 3, y + 1, 3, 2, '#6a7a44');
  }

  // Warm timber walls, a little wider at the base.
  p.poly([[22, 111], [20, 58], [116, 58], [114, 111]], '#6e4a28');
  p.poly([[24, 109], [22, 60], [114, 60], [112, 109]], '#9a6e3c');
  p.rect(24, 60, 2, 49, '#c4a066');
  p.rect(110, 60, 2, 49, '#6e4a28');
  for (let plank = 0; plank < 10; plank++) {
    p.rect(26 + plank * 8, 62, 1, 47, plank % 2 ? '#8a5e32' : '#b08a50');
  }
  p.rect(22, 58, 94, 3, '#5a3a20');

  // Arched door with a warm crack of firelight at the sill.
  p.ellipse(46, 74, 11, 8, '#5a3420');
  p.rect(35, 74, 22, 37, '#5a3420');
  p.ellipse(46, 75, 9, 7, '#8a4a28');
  p.rect(37, 75, 18, 35, '#8a4a28');
  p.rect(38, 76, 2, 33, '#c47a48');
  p.rect(37, 84, 18, 1, '#5a3420');
  p.rect(37, 94, 18, 1, '#5a3420');
  p.rect(37, 107, 18, 3, '#f0c86a');
  p.rect(38, 108, 16, 1, '#ffe08a');
  p.rect(51, 90, 3, 3, '#d4b070');
  p.rect(52, 91, 1, 4, '#8a5a30');

  // Lit window, then the frame, so the cottage looks occupied.
  p.rect(76, 68, 24, 20, '#5a3420');
  p.rect(78, 70, 20, 16, '#c47a30');
  p.rect(79, 71, 8, 6, '#f0b44a');
  p.rect(89, 71, 8, 6, '#d48828');
  p.rect(79, 79, 8, 6, '#d48828');
  p.rect(89, 79, 8, 6, '#f0b44a');
  p.rect(87, 70, 2, 16, '#5a3420');
  p.rect(78, 77, 20, 2, '#5a3420');
  p.rect(76, 67, 24, 2, '#c4a066');
  p.rect(78, 86, 20, 5, '#6e4a28');
  p.rect(79, 87, 18, 3, '#8a5e32');
  p.rect(81, 85, 3, 3, '#6a8a40');
  p.rect(86, 84, 4, 4, '#7a9a48');
  p.rect(92, 85, 3, 3, '#6a8a40');
  p.rect(83, 83, 2, 2, '#d47848');
  p.rect(89, 83, 2, 2, '#e8a44a');

  // Thick thatch with an overhang and a few moss tufts.
  p.poly([[68, 12], [132, 54], [128, 64], [8, 64], [4, 54]], '#5a3a20');
  p.poly([[68, 16], [126, 56], [10, 56]], '#8a5e32');
  p.poly([[68, 18], [108, 48], [68, 28], [28, 48]], '#c49a58');
  p.poly([[68, 16], [78, 24], [68, 22], [58, 24]], '#e0c078');
  for (let row = 0; row < 8; row++) {
    const t = (row + 1) / 9;
    const y = 20 + t * 34;
    const half = 10 + t * 48;
    p.line(68 - half, y, 68 + half, y, '#6e4424');
    for (let x = 68 - half + 2 + (row % 2) * 4; x < 68 + half - 2; x += 7) {
      p.rect(x, y, 2, 4, p.random() > 0.35 ? '#b08a50' : '#d4b070');
    }
  }
  p.rect(42, 34, 8, 4, '#6a7a44');
  p.rect(96, 40, 7, 3, '#5a6a3c');
  p.rect(60, 46, 6, 3, '#6a7a44');

  // Brick chimney on the right slope, with a little smoke kept inside the canvas.
  p.rect(98, 22, 14, 28, '#6a4030');
  p.rect(99, 23, 12, 26, '#8a5850');
  p.rect(99, 23, 3, 24, '#b08070');
  for (let row = 0; row < 5; row++) {
    p.rect(99, 26 + row * 5, 12, 1, '#6a4030');
    if (row % 2) p.rect(104, 23 + row * 5, 1, 4, '#6a4030');
  }
  p.rect(97, 20, 16, 4, '#5a3428');
  p.rect(99, 18, 12, 3, '#7a5048');
  p.rect(104, 16, 3, 2, '#b8b0a4');

  // Warm lantern by the door. Overlay adds the flicker.
  p.line(30, 76, 30, 86, '#4a3830');
  p.line(30, 76, 34, 80, '#4a3830');
  p.rect(32, 80, 7, 8, '#8a6a40');
  p.rect(33, 81, 5, 6, '#c4a050');
  p.rect(34, 82, 3, 3, '#e8cc70');
  p.rect(32, 79, 7, 1, '#5a4a38');
}

/** Pixel blossom sampled from the OpenAI mark, 35×35. */
const OPENAI_BLOSSOM = [
  "............#######................",
  "...........##########..............",
  ".........#####...#####.............",
  ".........###.......#########.......",
  "........###........##########......",
  ".......###.......#####....#####....",
  "......####.....#####........###....",
  "....#####....#####...........###...",
  "...######...####..............##...",
  "..###..##...###.....#####.....###..",
  ".###...##...##.....########...###..",
  ".##....##...##...###....#####..##..",
  "###....##...##.#####.....########..",
  "###....##...#####.###......######..",
  "###....##...###.....###......####..",
  "###....##...##.......####.....###..",
  "###....##...##.......######....###.",
  ".##....###..##.......##..###....##.",
  ".###....######.......##...##....###",
  "..###.....####.......##...##....###",
  "..####......###.....###...##....###",
  "..######.....####.#####...##....###",
  "..########.....#####.##...##....###",
  "..##..#####....###...##...##...###.",
  "..###...########.....##...##...###.",
  "..###.....#####.....###...##..###..",
  "...##..............####...######...",
  "...###...........#####....#####....",
  "....###........#####.....####......",
  "....#####....#####.......###.......",
  ".....###########........###........",
  ".......#########.......###.........",
  ".............#####...#####.........",
  "..............##########...........",
  "................######.............",
] as const;

function openaiBlossom(p: Paint, left: number, top: number, color: string) {
  for (let y = 0; y < OPENAI_BLOSSOM.length; y++) {
    const row = OPENAI_BLOSSOM[y]!;
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "#") p.rect(left + x, top + y, 1, 1, color);
    }
  }
}

function hvacUnit(p: Paint, x: number, y: number, w: number, h: number) {
  p.rect(x, y, w, h, '#3a3e42');
  p.rect(x + 1, y + 1, w - 2, h - 2, '#6a7278');
  p.rect(x + 1, y + 1, w - 2, 2, '#8a9298');
  p.rect(x + w - 2, y + 2, 1, h - 3, '#4a5258');
  for (let grill = 0; grill < Math.floor((h - 6) / 3); grill++) {
    p.rect(x + 3, y + 4 + grill * 3, w - 6, 1, '#4a5258');
  }
  const fanX = x + Math.floor(w / 2);
  const fanY = y + Math.floor(h / 2) + 1;
  p.ellipse(fanX, fanY, 5, 5, '#3a4248');
  p.ellipse(fanX, fanY, 3, 3, '#5a6268');
  p.rect(fanX - 1, fanY - 1, 2, 2, '#2a3238');
}

function datacenter(p: Paint) {
  // Long industrial hall. Shadow and gravel sit on the last rows so the slab stands on the grass.
  p.ellipse(156, 176, 128, 4, '#4a5236');
  p.ellipse(156, 175, 108, 3, '#5a6240');
  for (let i = 0; i < 90; i++) {
    const x = 18 + p.random() * 276;
    const y = 166 + p.random() * 12;
    p.rect(x, y, 1 + Math.floor(p.random() * 2), 1, p.random() > 0.45 ? '#8a8678' : '#6e6a60');
  }

  // Chain fence across the yard, with a gated gap in front of the door.
  for (let x = 14; x < 300; x += 7) {
    if (x > 142 && x < 174) continue;
    p.rect(x, 164, 1, 14, '#4a5054');
    p.rect(x, 166, 1, 10, '#8a9296');
  }
  p.rect(14, 168, 128, 1, '#6a7276');
  p.rect(174, 168, 126, 1, '#6a7276');
  p.rect(14, 172, 128, 1, '#6a7276');
  p.rect(174, 172, 126, 1, '#6a7276');
  p.rect(142, 164, 2, 14, '#3a4044');
  p.rect(172, 164, 2, 14, '#3a4044');
  p.rect(144, 164, 28, 1, '#5a6266');

  // Generator annex on the left, a step shorter than the hall.
  p.rect(16, 96, 62, 68, '#4a4e48');
  p.rect(18, 98, 58, 64, '#7a7e74');
  p.rect(18, 98, 2, 64, '#a8aaa0');
  p.rect(72, 98, 2, 64, '#5a5e58');
  for (let plank = 0; plank < 5; plank++) {
    p.rect(22 + plank * 10, 100, 1, 60, plank % 2 ? '#6a6e64' : '#8a8e84');
  }
  p.rect(24, 108, 22, 28, '#3a3e3a');
  p.rect(25, 109, 20, 26, '#5a625c');
  for (let slat = 0; slat < 8; slat++) p.rect(26, 111 + slat * 3, 18, 1, '#3a423c');
  p.rect(50, 118, 16, 18, '#3a3e3a');
  p.rect(51, 119, 14, 16, '#4a5250');
  p.rect(53, 122, 4, 4, '#6ec8c4');
  p.rect(59, 128, 4, 4, '#3a8a88');
  p.rect(22, 152, 50, 8, '#5a5e58');
  p.rect(24, 154, 10, 4, '#3a3e3a');
  p.rect(38, 154, 10, 4, '#3a3e3a');
  p.rect(52, 154, 10, 4, '#3a3e3a');

  // Main hall, wider at the slab.
  p.rect(70, 50, 226, 114, '#5a5854');
  p.rect(72, 52, 222, 110, '#8e8a80');
  p.rect(72, 52, 3, 110, '#b8b4a8');
  p.rect(290, 52, 3, 110, '#6a6860');
  for (let seam = 0; seam < 10; seam++) {
    p.rect(88 + seam * 20, 54, 1, 106, seam % 2 ? '#7a766c' : '#9a968c');
  }
  p.rect(70, 158, 226, 6, '#6e6a64');
  p.rect(72, 159, 222, 3, '#a09c94');
  p.rect(76, 150, 8, 4, '#6a7a44');
  p.rect(118, 152, 6, 3, '#5a6a3c');
  p.rect(248, 151, 7, 3, '#6a7a44');

  // Parapet and roof deck.
  p.rect(66, 44, 234, 10, '#4a4e52');
  p.rect(68, 46, 230, 6, '#6a7278');
  p.rect(70, 47, 226, 2, '#8a9298');
  p.rect(72, 38, 222, 10, '#5c5854');
  p.rect(74, 40, 218, 6, '#7a7670');
  hvacUnit(p, 86, 18, 28, 24);
  hvacUnit(p, 128, 14, 32, 28);
  hvacUnit(p, 176, 16, 30, 26);
  hvacUnit(p, 222, 20, 26, 22);
  p.rect(262, 22, 4, 22, '#4a5054');
  p.rect(263, 12, 2, 12, '#6a7278');
  p.rect(258, 10, 12, 4, '#5a6268');
  p.rect(261, 6, 6, 5, '#8a9298');
  p.ellipse(264, 5, 3, 2, '#b0b4b0');

  // OpenAI sign: dark plate, orange blossom.
  p.rect(108, 54, 56, 56, '#3a2a18');
  p.rect(110, 56, 52, 52, '#1e1814');
  p.rect(111, 57, 50, 2, '#3a3028');
  p.rect(111, 57, 2, 50, '#3a3028');
  openaiBlossom(p, 118, 64, '#f07818');

  // Server-hall window ribbons, cool interior glow.
  const ribbon = (x: number, y: number, w: number) => {
    p.rect(x, y, w, 14, '#2a3238');
    p.rect(x + 1, y + 1, w - 2, 12, '#3a4a52');
    for (let pane = 0; pane < Math.floor((w - 4) / 8); pane++) {
      const px = x + 2 + pane * 8;
      p.rect(px, y + 2, 6, 10, pane % 3 === 0 ? '#2a5860' : '#3a6a74');
      p.rect(px + 1, y + 3, 2, 3, pane % 2 ? '#7ec8c4' : '#4a8890');
      if (pane % 4 === 1) p.rect(px + 3, y + 7, 2, 2, '#c8f0ee');
    }
    p.rect(x + Math.floor(w / 2) - 1, y + 1, 2, 12, '#2a3238');
  };
  ribbon(172, 62, 108);
  ribbon(78, 92, 28);
  ribbon(166, 92, 112);
  ribbon(78, 122, 64);

  // Staff door under the sign.
  p.rect(148, 128, 22, 34, '#3a3e42');
  p.rect(150, 130, 18, 30, '#5a6268');
  p.rect(151, 131, 2, 28, '#8a9298');
  p.rect(150, 144, 18, 1, '#3a3e42');
  p.rect(164, 146, 3, 3, '#c4a050');
  p.rect(152, 156, 14, 4, '#2a3238');

  // Loading dock on the right, hazard lip and dark bay.
  p.rect(230, 126, 56, 36, '#3a3e42');
  p.rect(232, 128, 52, 32, '#2a2e32');
  p.rect(234, 130, 48, 22, '#1a1e22');
  p.rect(236, 132, 18, 8, '#2a5860');
  p.rect(258, 136, 12, 6, '#3a8a88');
  p.rect(244, 142, 8, 4, '#7ec8c4');
  for (let stripe = 0; stripe < 7; stripe++) {
    p.rect(232 + stripe * 7, 154, 7, 6, stripe % 2 ? '#c4a050' : '#2a2e32');
  }

  // Bollards by the gate.
  p.rect(136, 160, 4, 8, '#4a5054');
  p.rect(137, 161, 2, 6, '#b8b0a4');
  p.rect(176, 160, 4, 8, '#4a5054');
  p.rect(177, 161, 2, 6, '#b8b0a4');
}

function racks(p: Paint) {
  p.ellipse(48, 85, 40, 3, '#4a5236');
  const cabinets = [
    { x: 4, y: 24, w: 22, h: 60 },
    { x: 26, y: 14, w: 24, h: 70 },
    { x: 50, y: 22, w: 22, h: 62 },
    { x: 72, y: 18, w: 20, h: 66 },
  ];
  for (const cab of cabinets) {
    const lean = Math.floor(p.random() * 3);
    p.rect(cab.x, cab.y - lean, cab.w, cab.h + lean, '#2a2e32');
    p.rect(cab.x + 1, cab.y - lean + 1, cab.w - 2, cab.h + lean - 2, '#3a444c');
    p.rect(cab.x + 2, cab.y - lean + 6, cab.w - 4, cab.h + lean - 12, '#15191e');
    p.rect(cab.x + 1, cab.y - lean + 1, 1, cab.h + lean - 2, '#6a7680');
    p.rect(cab.x + cab.w - 2, cab.y - lean + 1, 1, cab.h + lean - 2, '#2a3238');
    p.rect(cab.x + 3, cab.y - lean + 2, 4, 2, '#3a4a3c');
    p.rect(cab.x + cab.w - 8, cab.y - lean + 2, 4, 2, '#4a3a30');
    for (let row = 0; row < 12; row++) {
      const y = cab.y - lean + 10 + row * 4;
      p.rect(cab.x + 5, y, 1, 1, '#243238');
      p.rect(cab.x + cab.w - 7, y, 1, 1, '#243238');
    }
    p.rect(cab.x + 2, cab.y + cab.h - 4, cab.w - 4, 3, '#2a3238');
  }
}

function mailbox(p: Paint) {
  p.rect(11, 21, 6, 26, '#795436');
  p.rect(12, 22, 3, 23, '#a67b4d');
  p.poly([[3, 27], [3, 8], [7, 2], [15, 1], [20, 6], [20, 28]], '#28485a');
  p.poly([[5, 25], [5, 9], [8, 4], [14, 3], [17, 7], [17, 25]], '#426c82');
  p.poly([[6, 9], [9, 5], [13, 5], [15, 8], [15, 12], [6, 12]], '#578fa2');
  p.rect(7, 14, 8, 10, '#3b657e');
  p.rect(10, 17, 3, 3, '#86a2a1');
  p.rect(9, 18, 1, 3, '#86a2a1');
  p.rect(13, 18, 1, 3, '#86a2a1');
  p.rect(20, 1, 2, 18, '#ba7337');
  p.rect(20, 1, 6, 4, '#f1b15d');
  p.rect(21, 2, 4, 2, '#ffd279');
}

function mailBubble(p: Paint) {
  const border = '#67523a';
  const paper = '#fff1c2';
  const paperLight = '#fff8da';
  const ink = '#76583b';
  p.rect(5, 1, 36, 2, border);
  p.rect(2, 4, 42, 23, border);
  p.rect(5, 2, 36, 27, border);
  p.rect(4, 5, 38, 20, paper);
  p.rect(6, 4, 34, 2, paperLight);
  p.poly([[17, 27], [30, 27], [24, 37]], border);
  p.poly([[20, 26], [28, 26], [24, 33]], paper);
  p.rect(13, 8, 20, 14, ink);
  p.rect(15, 10, 16, 10, paperLight);
  p.line(15, 11, 23, 17, ink, 1);
  p.line(31, 11, 23, 17, ink, 1);
  p.line(15, 19, 20, 15, ink, 1);
  p.line(31, 19, 26, 15, ink, 1);
}

function lamp(p: Paint) {
  p.poly([[6, 81], [6, 77], [10, 69], [10, 39], [8, 39], [8, 34], [6, 18], [4, 17], [4, 11], [12, 4], [13, 1], [15, 1], [16, 4], [25, 11], [25, 17], [22, 19], [20, 34], [18, 39], [17, 39], [17, 69], [22, 77], [22, 82]], '#464d48');
  p.rect(12, 33, 4, 42, '#858c81');
  p.rect(12, 34, 1, 38, '#b0b2a1');
  p.rect(10, 49, 9, 3, '#464d48');
  p.rect(1, 41, 26, 3, '#4d554e');
  p.rect(2, 40, 2, 5, '#777e70');
  p.rect(24, 40, 2, 5, '#777e70');
  p.rect(5, 41, 18, 1, '#959c8a');
  p.poly([[7, 12], [14, 5], [22, 12]], '#909587');
  p.rect(5, 13, 19, 2, '#777e73');
  p.rect(7, 17, 14, 2, '#aaa995');
  p.rect(10, 20, 8, 12, '#665b40');
  p.rect(10, 20, 1, 11, '#bab59a');
  p.rect(17, 20, 1, 11, '#aaa58e');
  p.rect(11, 33, 7, 2, '#969b8b');
  p.poly([[9, 77], [13, 70], [16, 71], [19, 78], [19, 80], [9, 80]], '#818778');
  p.rect(10, 78, 8, 1, '#a6aa99');
}

function log(p: Paint) {
  p.line(6, 17, 17, 3, '#665030', 3);
  p.line(29, 18, 32, 3, '#77613c', 3);
  p.line(51, 16, 61, 4, '#786039', 3);
  p.line(70, 19, 80, 28, '#725735', 3);
  p.poly([[2, 13], [6, 10], [81, 10], [89, 15], [88, 23], [81, 26], [6, 25], [1, 22]], '#655136');
  p.poly([[6, 13], [81, 13], [86, 16], [85, 21], [79, 23], [6, 22]], '#a08755');
  p.rect(7, 14, 73, 2, '#b39a68');
  p.rect(10, 20, 68, 2, '#806840');
  p.line(8, 18, 35, 17, '#766039');
  p.line(47, 18, 76, 19, '#78603c');
  p.ellipse(83, 18, 3, 5, '#b69c69');
  p.ellipse(83, 18, 1, 3, '#7a603b');
}

type CatColors = { fur: string; shadow: string; light: string; belly: string; paw: string };

function catPose(variant: number) {
  const claw = variant >= 5 ? (variant - 5) % 3 : -1;
  const step = variant >= 1 && variant <= 4 ? (variant - 1) % 4 : -1;
  return {
    claw,
    lean: claw < 0 ? 0 : [0, 1, 0][claw]!,
    bob: step < 0 ? 0 : (step % 2 === 0 ? 0 : -1),
    tailX: claw >= 0 ? -1 : step < 0 ? 0 : [-1, 0, 1, 0][step]!,
    tailBend: claw >= 0 ? -1 : step < 0 ? 0 : [0, 1, 0, -1][step]!,
    leftLift: claw >= 0 ? 0 : step < 0 ? 0 : [2, 0, 0, 1][step]!,
    rightLift: claw >= 0 ? 0 : step < 0 ? 0 : [0, 1, 2, 0][step]!,
    leftShift: claw >= 0 ? 0 : step < 0 ? 0 : [-1, 0, 1, 0][step]!,
    rightShift: claw >= 0 ? 0 : step < 0 ? 0 : [1, 0, -1, 0][step]!,
  };
}

type SlashTint = { ink: string; shade: string; inkSoft: string; shadeSoft: string };

function clawTint(hit: boolean): SlashTint {
  return hit
    ? { ink: '#d4453a', shade: '#8f201c', inkSoft: '#e07068', shadeSoft: '#b03830' }
    : { ink: '#8a8580', shade: '#6e6a65', inkSoft: '#9a9590', shadeSoft: '#7a7570' };
}

function slash(p: Paint, x: number, y: number, length: number, ink: string, shade: string, dir = 1) {
  p.line(x, y, x + length, y + length * dir, ink, 2);
  p.line(x + 3, y - 1, x + 3 + length, y - 1 + length * dir, shade, 2);
  p.line(x + 6, y, x + 6 + length, y + length * dir, ink, 2);
}

function catFront(p: Paint, variant: number, c: CatColors, tint: SlashTint) {
  const { fur, shadow, light } = c;
  const { claw, lean, bob, tailX, tailBend, leftLift, rightLift, leftShift, rightShift } = catPose(variant);
  const ax = (n: number) => n + 8 + lean;
  p.ellipse(ax(10), 28, 7, 2, '#536740');
  p.line(ax(11) + tailX, 16 + bob, ax(11) + tailX + tailBend, 2, shadow, 2);
  p.line(ax(11) + tailX, 14 + bob, ax(11) + tailX + tailBend, 3, light);
  p.ellipse(ax(10), 19 + bob, 5, 9, shadow);
  p.ellipse(ax(10), 18 + bob, 4, 8, fur);
  p.rect(ax(9), 19 + bob, 3, 7, c.belly);
  p.rect(ax(6), 19 + bob, 3, 2, shadow);
  p.rect(ax(13), 20 + bob, 2, 2, shadow);
  p.poly([[ax(4), 16 + bob], [ax(3), 8 + bob], [ax(5), 7 + bob], [ax(8), 10 + bob], [ax(12), 10 + bob], [ax(16), 7 + bob], [ax(17), 8 + bob], [ax(16), 17 + bob], [ax(13), 20 + bob], [ax(7), 20 + bob]], shadow);
  p.poly([[ax(5), 16 + bob], [ax(5), 10 + bob], [ax(8), 12 + bob], [ax(12), 12 + bob], [ax(15), 10 + bob], [ax(15), 17 + bob], [ax(12), 19 + bob], [ax(7), 18 + bob]], light);
  p.rect(ax(5), 10 + bob, 2, 3, '#dcaaa0');
  p.rect(ax(14), 10 + bob, 1, 3, '#dcaaa0');
  p.rect(ax(7), 12 + bob, 2, 3, fur);
  p.rect(ax(11), 12 + bob, 2, 3, fur);
  p.rect(ax(6), 15 + bob, 3, 2, '#d5e4b0');
  p.rect(ax(12), 15 + bob, 3, 2, '#d5e4b0');
  p.rect(ax(7), 15 + bob, 1, 2, '#398774');
  p.rect(ax(13), 15 + bob, 1, 2, '#398774');
  p.rect(ax(9), 17 + bob, 3, 2, '#f6e9c9');
  p.rect(ax(10), 17 + bob, 1, 1, '#a66f67');
  p.line(ax(4), 17 + bob, ax(1), 16 + bob, '#e9dfbb');
  p.line(ax(15), 17 + bob, ax(19), 16 + bob, '#e9dfbb');
  p.rect(ax(6) + leftShift, 25 - leftLift, 3, 4, c.paw);
  if (claw < 0) {
    p.rect(ax(12) + rightShift, 25 - rightLift, 3, 4, c.paw);
    return;
  }
  if (claw === 0) {
    p.rect(ax(10), 21, 4, 4, c.paw);
    p.rect(ax(11), 23, 3, 2, '#e8d4b0');
    p.rect(ax(11), 25, 1, 1, tint.ink);
    p.rect(ax(13), 25, 1, 1, tint.shade);
    p.rect(ax(12), 26, 1, 1, tint.ink);
  } else if (claw === 1) {
    p.rect(ax(9), 23, 4, 3, c.paw);
    p.rect(ax(10), 25, 3, 2, '#e8d4b0');
    slash(p, ax(7), 33, 6, tint.ink, tint.shade);
  } else {
    p.rect(ax(10), 24, 3, 3, c.paw);
    slash(p, ax(8), 35, 4, tint.inkSoft, tint.shadeSoft);
  }
}

function samCat(p: Paint) {
  catFront(p, 0, {
    fur: '#d08a3c',
    shadow: '#7a5634',
    light: '#e8b060',
    belly: '#f4f1ea',
    paw: '#ece8e0',
  }, clawTint(false));
  const ax = (n: number) => n + 8;
  p.rect(ax(9), 13, 2, 4, '#f4f1ea');
  p.rect(ax(9), 14, 2, 2, '#fff8f0');
}

function carrot(p: Paint, variant: number) {
  if (variant >= 20) {
    rocketCarrot(p);
    return;
  }
  const loose = variant >= 10;
  const lean = [0, -5, 4, 2][variant % 4]!;
  const cx = 28 + Math.round(lean * 0.25);
  const soil = loose ? 88 : 82;
  const crown = loose ? 48 : 64;
  if (!loose) p.ellipse(28, 90, 18, 2, '#4a5834');

  const stems: Array<{ x: number; bend: number; h: number }> = [
    { x: cx - 7, bend: -8, h: 42 },
    { x: cx - 2, bend: -3, h: 50 },
    { x: cx + 2, bend: 4, h: 46 },
    { x: cx + 8, bend: 9, h: 38 },
  ];
  if (variant % 2) stems.push({ x: cx + 1, bend: -6, h: 36 });
  for (const stem of stems) {
    for (let step = 0; step < stem.h; step += 2) {
      const t = step / stem.h;
      const x = stem.x + stem.bend * t * t;
      const y = crown - 2 - step;
      p.rect(x, y, 2, 3, t > 0.7 ? '#2a5224' : '#347030');
      if (step > 6 && step % 6 === 0) {
        const side = (step / 6) % 2 === 0 ? -1 : 1;
        const leaf = 4 + Math.floor(p.random() * 4);
        p.rect(x + side * 2, y - 1, leaf, 3, '#3d8a34');
        p.rect(x + side * 3, y - 2, leaf - 1, 2, '#6aaa44');
        p.rect(x + side * (leaf - 1), y, 2, 2, '#4f9a38');
      }
    }
  }
  p.ellipse(cx, crown - 1, 8, 5, '#2f5a28');
  p.ellipse(cx - 1, crown - 3, 5, 3, '#4a8a34');

  p.poly([
    [cx - 10, crown + 4], [cx - 12, crown + 12], [cx - 8, soil - 2],
    [cx + 8, soil - 2], [cx + 11, crown + 12], [cx + 9, crown + 4],
    [cx + 4, crown], [cx - 4, crown],
  ], '#b84410');
  p.poly([
    [cx - 7, crown + 5], [cx - 8, crown + 12], [cx - 4, soil - 4],
    [cx + 3, soil - 6], [cx + 6, crown + 10], [cx + 4, crown + 4],
    [cx, crown + 2],
  ], '#e86a1c');
  p.poly([
    [cx - 5, crown + 6], [cx - 5, crown + 12], [cx - 2, soil - 8],
    [cx, crown + 8],
  ], '#f4a040');
  p.line(cx + 4, crown + 7, cx + 3, soil - 6, '#c45414');
  p.rect(cx - 1, crown + 8, 2, 2, '#f8c070');

  if (loose) {
    p.rect(cx - 2, soil - 2, 4, 4, '#c45414');
    p.rect(cx - 1, soil, 2, 3, '#e86a1c');
    return;
  }

  p.ellipse(cx, soil + 4, 16, 6, '#5a3e24');
  p.ellipse(cx - 1, soil + 2, 14, 5, '#7a5a34');
  p.poly([
    [cx - 16, soil + 6], [cx - 14, soil - 2], [cx - 6, soil - 6],
    [cx + 5, soil - 7], [cx + 14, soil - 1], [cx + 16, soil + 6],
    [cx + 8, soil + 8], [cx - 8, soil + 8],
  ], '#6a4a28');
  p.poly([
    [cx - 10, soil + 4], [cx - 8, soil - 1], [cx - 2, soil - 4],
    [cx + 4, soil - 3], [cx + 8, soil + 2], [cx + 4, soil + 5],
    [cx - 6, soil + 5],
  ], '#8a6840');
  p.rect(cx - 6, soil, 4, 2, '#9a7850');
  p.rect(cx + 3, soil + 2, 5, 2, '#5a3e24');
  p.rect(cx - 2, soil - 3, 3, 2, '#c45414');
}

/** Nose-up rocket: pointy tip leads, greens are the engine. */
function rocketCarrot(p: Paint) {
  const cx = 28;
  const greens = 70;

  p.poly([
    [cx, 1], [cx - 1, 6], [cx - 3, 14], [cx - 7, 28], [cx - 11, 46],
    [cx - 12, greens - 2], [cx + 12, greens - 2], [cx + 11, 46],
    [cx + 7, 28], [cx + 3, 14], [cx + 1, 6],
  ], '#b84410');
  p.poly([
    [cx, 2], [cx - 1, 8], [cx - 4, 22], [cx - 7, 42],
    [cx - 6, greens - 8], [cx + 5, greens - 10], [cx + 6, 40],
    [cx + 4, 20], [cx + 1, 8],
  ], '#e86a1c');
  p.poly([
    [cx, 4], [cx - 1, 16], [cx - 3, 34], [cx - 2, 50],
    [cx + 1, 38], [cx + 2, 16],
  ], '#f4a040');
  p.line(cx + 3, 18, cx + 4, greens - 12, '#c45414');
  p.rect(cx - 1, 8, 2, 12, '#f8c070');
  p.rect(cx, 1, 1, 6, '#f4a040');
  p.rect(cx - 1, 1, 2, 3, '#e86a1c');

  const stems: Array<{ x: number; bend: number; h: number }> = [
    { x: cx - 7, bend: -6, h: 16 },
    { x: cx - 2, bend: -2, h: 20 },
    { x: cx + 2, bend: 3, h: 18 },
    { x: cx + 7, bend: 7, h: 15 },
  ];
  for (const stem of stems) {
    for (let step = 0; step < stem.h; step += 2) {
      const t = step / stem.h;
      const x = stem.x + stem.bend * t * t;
      const y = greens + step;
      p.rect(x, y, 2, 3, t > 0.65 ? '#2a5224' : '#347030');
      if (step > 4 && step % 6 === 0) {
        const side = (step / 6) % 2 === 0 ? -1 : 1;
        const leaf = 4 + (step % 5);
        p.rect(x + side * 2, y, leaf, 3, '#3d8a34');
        p.rect(x + side * 3, y + 1, leaf - 1, 2, '#6aaa44');
      }
    }
  }
  p.ellipse(cx, greens + 1, 8, 5, '#2f5a28');
  p.ellipse(cx - 1, greens - 1, 5, 3, '#4a8a34');
}

function rabbit(p: Paint) {
  const ax = (n: number) => n + 8;
  p.ellipse(ax(10), 28, 7, 2, '#536740');
  p.ellipse(ax(16), 20, 3, 3, '#c8c0b4');
  p.ellipse(ax(16), 20, 2, 2, '#fff8f0');
  p.ellipse(ax(13), 22, 5, 6, '#c4b8a8');
  p.ellipse(ax(12), 21, 4, 5, '#f0ece4');
  p.ellipse(ax(10), 18, 6, 8, '#c4b8a8');
  p.ellipse(ax(10), 17, 5, 7, '#f4f0e8');
  p.rect(ax(8), 16, 4, 8, '#fffaf4');
  p.poly([[ax(7), 11], [ax(5), 1], [ax(8), 0], [ax(9), 11]], '#c4b8a8');
  p.poly([[ax(7), 10], [ax(6), 2], [ax(7), 1], [ax(8), 10]], '#f4f0e8');
  p.rect(ax(7), 2, 1, 8, '#f0a090');
  p.poly([[ax(12), 11], [ax(13), 0], [ax(16), 1], [ax(14), 11]], '#c4b8a8');
  p.poly([[ax(13), 10], [ax(14), 2], [ax(15), 1], [ax(14), 10]], '#f4f0e8');
  p.rect(ax(14), 2, 1, 8, '#f0a090');
  p.ellipse(ax(10), 11, 6, 6, '#c4b8a8');
  p.ellipse(ax(10), 11, 5, 5, '#f4f0e8');
  p.ellipse(ax(10), 12, 3, 3, '#fffaf4');
  p.rect(ax(7), 10, 2, 2, '#1a1814');
  p.rect(ax(12), 10, 2, 2, '#1a1814');
  p.rect(ax(7), 10, 1, 1, '#fff8f0');
  p.rect(ax(12), 10, 1, 1, '#fff8f0');
  p.rect(ax(9), 13, 3, 2, '#e8a0a0');
  p.rect(ax(10), 13, 1, 1, '#d47878');
  p.line(ax(6), 14, ax(1), 13, '#e9dfbb');
  p.line(ax(14), 14, ax(19), 13, '#e9dfbb');
  p.rect(ax(7), 24, 3, 4, '#fff8f0');
  p.rect(ax(12), 24, 3, 4, '#fff8f0');
  p.rect(ax(6), 26, 4, 3, '#e8e0d4');
  p.rect(ax(12), 26, 4, 3, '#e8e0d4');
}

function fence(p: Paint) {
  p.ellipse(39, 34, 34, 2, '#4a5236');
  p.rect(6, 8, 8, 26, '#5a3e24');
  p.rect(7, 9, 6, 24, '#8a6240');
  p.rect(8, 9, 2, 22, '#c49a60');
  p.rect(64, 10, 8, 24, '#5a3e24');
  p.rect(65, 11, 6, 22, '#8a6240');
  p.rect(66, 11, 2, 20, '#c49a60');
  p.rect(4, 12, 70, 5, '#6a4a28');
  p.rect(5, 13, 68, 3, '#b08a50');
  p.rect(4, 22, 70, 5, '#6a4a28');
  p.rect(5, 23, 68, 3, '#a07844');
  for (let i = 0; i < 8; i++) {
    p.rect(10 + i * 8, 13, 1, 3, p.random() > 0.5 ? '#8a6240' : '#c49a60');
    p.rect(12 + i * 8, 23, 1, 3, p.random() > 0.5 ? '#7a5234' : '#b08a50');
  }
  p.rect(6, 7, 8, 2, '#4a3420');
  p.rect(64, 9, 8, 2, '#4a3420');
}

function shed(p: Paint) {
  const turf = ['#2a4a28', '#355c30', '#43743a', '#558a46', '#6aa054', '#83b468', '#9cc67c'];
  const cx = 94;
  const ground = 129;
  p.ellipse(cx, ground, 82, 3, '#4a5236');
  p.poly([[6, ground], [10, 96], [22, 62], [48, 28], [cx, 8], [142, 26], [170, 58], [182, 96], [184, ground]], turf[0]!);
  leafCluster(p, cx, 58, 72, 42, turf, 0.85);
  leafCluster(p, 42, 78, 38, 32, turf, 0.8);
  leafCluster(p, 148, 74, 36, 30, turf, 0.8);
  leafCluster(p, cx, 32, 40, 24, turf, 0.9);
  leafCluster(p, 70, 48, 28, 22, turf, 0.7);
  leafCluster(p, 122, 46, 30, 22, turf, 0.7);

  p.rect(124, 16, 12, 32, '#6a4030');
  p.rect(125, 18, 10, 30, '#8a5850');
  p.rect(125, 18, 3, 28, '#b08070');
  for (let row = 0; row < 5; row++) {
    p.rect(125, 22 + row * 5, 10, 1, '#6a4030');
    if (row % 2) p.rect(129, 19 + row * 5, 1, 4, '#6a4030');
  }
  p.rect(123, 14, 14, 4, '#5a3428');
  p.rect(125, 12, 10, 3, '#7a5048');
  p.rect(128, 10, 4, 3, '#b8b0a4');

  for (let col = 0; col < 12; col++) {
    const x = 22 + col * 12 + (col % 2);
    const y = 116 + (col % 3 === 0 ? 1 : 0);
    p.poly([[x, y + 12], [x - 2, y + 4], [x + 3, y], [x + 12, y + 2], [x + 13, y + 8], [x + 8, y + 12], [x + 2, y + 12]], '#5a564c');
    p.poly([[x + 1, y + 10], [x, y + 4], [x + 4, y + 2], [x + 10, y + 3], [x + 11, y + 7], [x + 7, y + 11], [x + 3, y + 11]], ['#8a8680', '#a09c94', '#7a7670'][col % 3]!);
  }

  const holeX = cx;
  const holeY = 102;
  p.ellipse(holeX, holeY + 2, 24, 22, '#5a4630');
  p.ellipse(holeX, holeY, 21, 20, '#3a2a1c');
  p.ellipse(holeX, holeY, 18, 17, '#1a1410');
  p.ellipse(holeX, holeY - 1, 14, 13, '#12100c');
  p.ellipse(holeX + 2, holeY - 3, 8, 8, '#0c0a08');
  p.ellipse(holeX - 8, holeY - 4, 4, 5, '#2a2218');
  p.rect(holeX - 10, 118, 20, 4, '#4a3828');
  p.rect(holeX - 8, 119, 16, 2, '#6a5038');
}

function catSide(p: Paint, variant: number, c: CatColors, tint: SlashTint) {
  const { fur, shadow, light } = c;
  const { claw, lean, bob, tailX, tailBend, leftLift, rightLift, leftShift, rightShift } = catPose(variant);
  const ax = (n: number) => n + 4 + lean;
  const y = (n: number) => n + bob;
  p.ellipse(ax(14), 28, 8, 2, '#536740');
  p.line(ax(8) + tailX, y(18), ax(6) + tailX + tailBend, y(5), shadow, 2);
  p.line(ax(9) + tailX, y(17), ax(7) + tailX + tailBend, y(6), light);
  p.rect(ax(7), y(19), 16, 6, shadow);
  p.rect(ax(8), y(18), 14, 1, shadow);
  p.rect(ax(8), y(25), 14, 1, shadow);
  p.rect(ax(8), y(19), 14, 6, fur);
  p.rect(ax(9), y(18), 12, 1, light);
  p.rect(ax(11), y(23), 7, 2, '#f0dfb4');
  p.rect(ax(18), y(16), 6, 5, shadow);
  p.rect(ax(18), y(17), 6, 4, fur);
  p.ellipse(ax(24), y(14), 5, 5, shadow);
  p.ellipse(ax(24), y(14), 4, 4, fur);
  p.ellipse(ax(25), y(14), 3, 3, light);
  p.rect(ax(22), y(8), 3, 4, shadow);
  p.rect(ax(23), y(9), 1, 2, '#dcaaa0');
  p.rect(ax(20), y(9), 2, 3, shadow);
  p.rect(ax(25), y(13), 2, 2, '#d5e4b0');
  p.rect(ax(26), y(13), 1, 2, '#398774');
  p.rect(ax(28), y(15), 2, 2, '#f6e9c9');
  p.rect(ax(29), y(15), 1, 1, '#a66f67');
  p.rect(ax(9) + leftShift, 25 - leftLift, 3, 3, '#f1e4bd');
  if (claw < 0) {
    p.rect(ax(18) + rightShift, 25 - rightLift, 3, 3, '#f1e4bd');
    return;
  }
  if (claw === 0) {
    p.rect(ax(20), 21, 4, 4, '#f1e4bd');
    p.rect(ax(21), 23, 3, 2, '#e8d4b0');
    p.rect(ax(22), 25, 1, 1, tint.ink);
    p.rect(ax(24), 25, 1, 1, tint.shade);
    p.rect(ax(23), 26, 1, 1, tint.ink);
  } else if (claw === 1) {
    p.rect(ax(21), 23, 4, 3, '#f1e4bd');
    p.rect(ax(22), 25, 3, 2, '#e8d4b0');
    slash(p, ax(20), 33, 5, tint.ink, tint.shade);
  } else {
    p.rect(ax(21), 24, 3, 3, '#f1e4bd');
    slash(p, ax(21), 35, 4, tint.inkSoft, tint.shadeSoft);
  }
}

function catBack(p: Paint, variant: number, c: CatColors, tint: SlashTint) {
  const { fur, shadow, light } = c;
  const { claw, bob, tailX, tailBend, leftLift, rightLift, leftShift, rightShift } = catPose(variant);
  const ax = (n: number) => n + 8;
  p.ellipse(ax(10), 28, 6, 2, '#536740');
  p.ellipse(ax(10), 19 + bob, 4, 8, shadow);
  p.ellipse(ax(10), 18 + bob, 3, 7, fur);
  p.rect(ax(9), 16 + bob, 2, 8, light);
  p.poly([[ax(5), 16 + bob], [ax(4), 8 + bob], [ax(6), 7 + bob], [ax(8), 10 + bob], [ax(12), 10 + bob], [ax(14), 7 + bob], [ax(16), 8 + bob], [ax(15), 17 + bob], [ax(12), 19 + bob], [ax(8), 19 + bob]], shadow);
  p.poly([[ax(6), 15 + bob], [ax(6), 10 + bob], [ax(8), 11 + bob], [ax(12), 11 + bob], [ax(14), 10 + bob], [ax(14), 16 + bob], [ax(12), 18 + bob], [ax(8), 17 + bob]], fur);
  p.rect(ax(6), 10 + bob, 2, 3, shadow);
  p.rect(ax(13), 10 + bob, 1, 3, shadow);
  p.rect(ax(8), 13 + bob, 4, 2, shadow);
  p.line(ax(10) + tailX, 14 + bob, ax(10) + tailBend, 2, shadow, 2);
  p.line(ax(10) + tailX, 13 + bob, ax(10) + tailBend, 3, light);
  if (claw < 0) {
    p.rect(ax(6) + leftShift, 25 - leftLift, 3, 4, '#f1e4bd');
    p.rect(ax(11) + rightShift, 25 - rightLift, 3, 4, '#f1e4bd');
    return;
  }
  if (claw === 0) {
    p.rect(ax(8), 18, 4, 4, '#f1e4bd');
    p.rect(ax(9), 17, 1, 1, tint.ink);
    p.rect(ax(11), 17, 1, 1, tint.shade);
    p.rect(ax(10), 16, 1, 1, tint.ink);
  } else if (claw === 1) {
    p.rect(ax(8), 15, 4, 3, '#f1e4bd');
    slash(p, ax(6), 8, 6, tint.ink, tint.shade, -1);
  } else {
    p.rect(ax(9), 17, 3, 3, '#f1e4bd');
    slash(p, ax(7), 6, 4, tint.inkSoft, tint.shadeSoft, -1);
  }
}

function cat(p: Paint, variant: number, seed: number, facing: CatView, hit: boolean) {
  const orange = seed % 2 === 1;
  const colors: CatColors = {
    fur: orange ? '#c99751' : '#929286',
    shadow: orange ? '#8c693e' : '#626961',
    light: orange ? '#e3b86c' : '#b8b7a3',
    belly: '#f0dfb4',
    paw: '#f1e4bd',
  };
  const tint = clawTint(hit);
  if (facing === 'n') catBack(p, variant, colors, tint);
  else if (facing === 's') catFront(p, variant, colors, tint);
  else {
    catSide(p, variant, colors, tint);
    if (facing === 'w') flipCanvasX(p);
  }
}

/** Northern pike: long olive torpedo, duckbill snout, pale bean spots, fins set far back. */
function pike(p: Paint, variant: number) {
  const tail = variant % 2 === 0 ? 0 : 1;
  p.poly([[1, 3 + tail], [10, 7], [3, 8], [10, 10], [1, 14 - tail], [12, 9]], '#2f3c28');
  p.poly([[2, 5 + tail], [10, 8], [2, 12 - tail], [8, 9]], '#6a7d48');
  p.rect(5, 8, 4, 2, '#cdd0b4');
  p.poly([[16, 1], [25, 1], [24, 6], [17, 6]], '#2f3c28');
  p.poly([[18, 2], [24, 2], [23, 6], [18, 6]], '#7a6b42');
  p.line(19, 2, 22, 2, '#c4b07a');
  p.poly([[16, 12], [24, 12], [23, 17], [17, 16]], '#2f3c28');
  p.poly([[17, 12], [23, 12], [22, 16], [18, 15]], '#6a5c3c');
  p.poly([[30, 12], [35, 12], [34, 16], [29, 15]], '#b88958');
  p.poly([[10, 5], [14, 3], [28, 3], [40, 5], [48, 6], [51, 8], [48, 11], [40, 13], [28, 14], [14, 13], [10, 11]], '#2f3c28');
  p.poly([[12, 6], [15, 4], [28, 4], [40, 6], [47, 7], [47, 10], [40, 12], [28, 13], [15, 12], [12, 10]], '#4f6238');
  p.poly([[16, 5], [28, 5], [39, 6], [42, 7], [28, 8], [16, 7]], '#7d9156');
  p.poly([[14, 10], [28, 11], [42, 10], [40, 12], [28, 13], [15, 12]], '#d2d4c0');
  p.rect(18, 11, 22, 1, '#e4e6d2');
  p.poly([[42, 5], [51, 7], [51, 10], [42, 12], [40, 8]], '#2f3c28');
  p.poly([[42, 6], [50, 8], [50, 9], [42, 11]], '#6a7d48');
  p.rect(46, 7, 5, 1, '#d2d4c0');
  p.rect(45, 9, 5, 1, '#3a342c');
  p.line(39, 5, 39, 12, '#2f3c28', 2);
  p.rect(40, 6, 4, 4, '#e4e6d2');
  p.rect(41, 7, 3, 3, '#2a2e22');
  p.rect(43, 7, 1, 1, '#f4f6e4');
  for (const [x, y] of [[15, 6], [20, 5], [25, 6], [30, 5], [35, 6], [18, 7], [23, 8], [28, 7], [33, 8], [21, 9], [31, 9]] as const) {
    p.rect(x, y, 3, 2, '#d2d4c0');
    p.rect(x + 1, y, 1, 1, '#e4e6d2');
  }
  p.poly([[36, 11 + (variant % 2)], [40, 11], [39, 15], [35, 14]], '#7a6b42');
}

/** Yellow perch: gold flanks, dark vertical bars, orange lower fins, two dorsal fins. */
function perch(p: Paint, variant: number) {
  const tail = variant % 2 === 0 ? 0 : 1;
  p.poly([[0, 5 + tail], [8, 8], [1, 9], [8, 11], [0, 14 - tail], [5, 11], [5, 8]], '#7a3e24');
  p.poly([[1, 7 + tail], [8, 9], [1, 12 - tail], [5, 10]], '#d0703c');
  p.rect(3, 9, 3, 1, '#e8a060');
  p.poly([[12, 0], [20, 0], [19, 6], [13, 6]], '#2f2c24');
  p.poly([[13, 1], [19, 1], [18, 6], [14, 6]], '#6a6240');
  p.rect(17, 1, 2, 3, '#1e1c18');
  p.poly([[19, 1], [27, 2], [26, 6], [19, 6]], '#6a6240');
  p.poly([[20, 2], [26, 3], [25, 6], [20, 6]], '#d4b05a');
  p.poly([[15, 14], [22, 14], [21, 19], [15, 18]], '#7a3e24');
  p.poly([[16, 14], [21, 14], [20, 18], [16, 17]], '#d0703c');
  p.poly([[22, 14], [27, 14], [26, 18], [22, 16]], '#d0703c');
  p.poly([[8, 6], [12, 3], [22, 2], [30, 5], [32, 8], [30, 13], [22, 16], [12, 15], [8, 12]], '#7a5c30');
  p.poly([[9, 7], [13, 4], [22, 3], [29, 6], [31, 8], [29, 12], [22, 15], [13, 14], [9, 11]], '#d4b05a');
  p.poly([[14, 5], [22, 4], [28, 6], [22, 8], [14, 7]], '#e4c878');
  p.poly([[11, 12], [22, 13], [28, 12], [22, 15], [13, 14]], '#f0e6c4');
  for (const x of [11, 16, 21, 26]) {
    p.rect(x, 5, 2, 8, '#2f2c24');
    p.rect(x, 6, 1, 6, '#3d3a2e');
  }
  p.rect(13, 13, 16, 2, '#f0e6c4');
  p.poly([[29, 5], [35, 7], [35, 12], [29, 14], [27, 9]], '#7a5c30');
  p.poly([[29, 6], [34, 8], [34, 11], [29, 13]], '#e4c878');
  p.rect(31, 10, 3, 1, '#3a342c');
  p.rect(29, 7, 4, 4, '#f0e6c4');
  p.rect(30, 8, 3, 3, '#2a2e22');
  p.rect(32, 8, 1, 1, '#f4edd4');
  p.line(27, 6, 27, 13, '#7a5c30');
  p.poly([[24, 11 + (variant % 2)], [29, 11], [28, 16], [23, 15]], '#d0703c');
}

/** Bluegill: deep round sunfish, dark ear flap, teal cheek, orange breast. */
function bluegill(p: Paint, variant: number) {
  const tail = variant % 2 === 0 ? 0 : 1;
  p.poly([[0, 7 + tail], [7, 10], [1, 12], [7, 13], [0, 16 - tail], [4, 12]], '#2f3c28');
  p.poly([[1, 9 + tail], [7, 11], [1, 14 - tail], [5, 12]], '#6a8c58');
  p.rect(2, 11, 3, 2, '#4a7d78');
  p.poly([[9, 1], [18, 1], [20, 5], [18, 9], [9, 9], [8, 5]], '#2f3c28');
  p.poly([[10, 2], [17, 2], [18, 5], [17, 8], [10, 8]], '#5a6e40');
  p.ellipse(14, 12, 11, 9, '#2f3c28');
  p.ellipse(14, 12, 10, 8, '#4a5e34');
  p.ellipse(14, 11, 8, 6, '#6a8248');
  p.ellipse(15, 15, 8, 4, '#d4843c');
  p.ellipse(15, 16, 6, 3, '#e4a058');
  p.rect(10, 6, 2, 10, '#3a4a30');
  p.rect(16, 7, 2, 8, '#3a4a30');
  p.poly([[17, 8], [22, 7], [24, 11], [22, 16], [17, 17]], '#3a6e6a');
  p.poly([[18, 9], [22, 9], [23, 12], [21, 15], [18, 15]], '#5a9a8e');
  p.rect(17, 11, 4, 4, '#1a1a14');
  p.rect(18, 12, 3, 3, '#2a2a20');
  p.poly([[21, 9], [26, 10], [26, 13], [22, 14]], '#4a5e34');
  p.rect(24, 11, 2, 1, '#3a342c');
  p.rect(21, 9, 4, 4, '#e8d090');
  p.rect(22, 10, 3, 3, '#2a2e22');
  p.rect(24, 10, 1, 1, '#f4edd4');
  p.poly([[11, 14 + (variant % 2)], [20, 13], [19, 20], [10, 18]], '#d4843c');
  p.poly([[12, 15], [19, 14], [18, 18], [12, 17]], '#e4a058');
}

function mouse(p: Paint, variant: number, seed: number) {
  const palettes = [
    { fur: '#8a8884', shadow: '#5c5a56', light: '#b4b0aa', belly: '#d8d4cc' },
    { fur: '#7a7874', shadow: '#4e4c48', light: '#a8a49e', belly: '#ccc8c0' },
    { fur: '#949088', shadow: '#64625c', light: '#c0bbb4', belly: '#e0dcd4' },
  ] as const;
  const c = palettes[Math.abs(seed) % 3]!;
  const step = variant % 2;
  p.ellipse(20, 14, 7, 2, '#536740');
  p.line(1, 6 + step, 8, 9, '#9a9088');
  p.line(8, 9, 16, 10, '#8a8480');
  p.ellipse(20, 10, 6, 3, c.shadow);
  p.ellipse(20, 9, 5, 2, c.fur);
  p.rect(18, 10, 6, 2, c.belly);
  p.ellipse(26, 9, 3, 3, c.shadow);
  p.ellipse(26, 9, 2, 2, c.fur);
  p.ellipse(27, 9, 1, 1, c.light);
  p.rect(24, 5, 2, 3, c.shadow);
  p.rect(26, 4, 2, 3, c.shadow);
  p.rect(24, 6, 1, 1, '#c4b8b0');
  p.rect(26, 5, 1, 1, '#c4b8b0');
  p.rect(28, 9, 3, 2, c.light);
  p.rect(30, 9, 1, 1, '#c4b8b0');
  p.rect(27, 8, 1, 1, '#1c1814');
  p.rect(16 + step, 12, 2, 2, '#c8c0b4');
  p.rect(22 - step, 12, 2, 2, '#c8c0b4');
}

export function paintWorldModel(kind: WorldModelKind, options: WorldModelOptions = {}): HTMLCanvasElement {
  const seed = options.seed ?? 1;
  const variant = options.variant ?? 0;
  const facing = options.facing ?? 'e';
  const hit = options.hit === true;
  const sick = options.sick === true;
  const [width, height] = WORLD_MODEL_SIZES[kind];
  const p = painter(width, height, seed);
  switch (kind) {
    case 'pine': pine(p, variant, sick); break;
    case 'oak': oak(p, variant, sick); break;
    case 'willow': willow(p, variant); break;
    case 'bush': bush(p); break;
    case 'den': den(p); break;
    case 'hut': hut(p); break;
    case 'datacenter': datacenter(p); break;
    case 'racks': racks(p); break;
    case 'bernie': catFront(p, 0, {
      fur: '#929286',
      shadow: '#626961',
      light: '#b8b7a3',
      belly: '#d8dbd6',
      paw: '#cdd0cb',
    }, clawTint(false)); break;
    case 'sam': samCat(p); break;
    case 'carrot': carrot(p, variant); break;
    case 'rabbit': rabbit(p); break;
    case 'fence': fence(p); break;
    case 'shed': shed(p); break;
    case 'mailbox': mailbox(p); break;
    case 'mailBubble': mailBubble(p); break;
    case 'lamp': lamp(p); break;
    case 'flowers': paintFlowers(p, variant); break;
    case 'stone': rock(p, 1, 1, 29, 19, 12); break;
    case 'log': log(p); break;
    case 'grass': paintGrass(p, variant); break;
    case 'wheat': paintWheat(p, variant); break;
    case 'reeds': paintReeds(p, variant); break;
    case 'mushroom': paintMushroom(p, variant); break;
    case 'moss': paintMoss(p, variant); break;
    case 'mossLog': paintMossLog(p, variant); break;
    case 'fern': paintFern(p, variant); break;
    case 'stump': paintStump(p, variant); break;
    case 'clover': paintClover(p, variant); break;
    case 'cat': cat(p, variant, seed, facing, hit); break;
    case 'pike':
      pike(p, variant);
      if (facing === 'w') flipCanvasX(p);
      break;
    case 'perch':
      perch(p, variant);
      if (facing === 'w') flipCanvasX(p);
      break;
    case 'bluegill':
      bluegill(p, variant);
      if (facing === 'w') flipCanvasX(p);
      break;
    case 'mouse':
      mouse(p, variant, seed);
      if (facing === 'w') flipCanvasX(p);
      break;
  }
  return p.canvas;
}

export function getWorldModelTexture(kind: WorldModelKind, options: WorldModelOptions = {}): THREE.CanvasTexture {
  const seed = options.seed ?? 1;
  const variant = options.variant ?? 0;
  const facing = options.facing ?? 'e';
  const hit = options.hit === true;
  const sick = options.sick === true;
  const key = `${kind}:${seed}:${variant}:${facing}:${hit ? 'h' : ''}:${sick ? 's' : ''}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const canvas = paintWorldModel(kind, options);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}

/** Create a unique Sprite/material while sharing immutable, seeded pixel textures. */
export function createWorldModel(kind: WorldModelKind, options: WorldModelOptions = {}): THREE.Sprite {
  const seed = options.seed ?? 1;
  const variant = options.variant ?? 0;
  const [width, height] = WORLD_MODEL_SIZES[kind];
  const texture = getWorldModelTexture(kind, options);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.5, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, kind === 'cat' || kind === 'bernie' || kind === 'sam' || kind === 'rabbit' ? (height - 30) / height : 0);
  sprite.scale.set(width * (options.scale ?? 1), height * (options.scale ?? 1), 1);
  sprite.name = `${kind}-${seed}-${variant}`;
  sprite.userData = { id: sprite.name, kind, seed, variant, nativeWidth: width, nativeHeight: height };
  return sprite;
}

/** Spin fence/log around the visual middle without moving an unrotated south origin. */
export function applyWorldPropPose(sprite: THREE.Sprite, prop: Pick<WorldProp, "kind" | "x" | "y" | "scale" | "rot">) {
  const [width, height] = WORLD_MODEL_SIZES[prop.kind];
  const scale = prop.scale;
  sprite.scale.set(width * scale, height * scale, 1);
  const rotatable = isRotatableWorldKind(prop.kind);
  const rot = rotatable ? normalizeRotation(prop.rot) : 0;
  (sprite.material as THREE.SpriteMaterial).rotation = rot * Math.PI / 180;
  if (rotatable) {
    sprite.center.set(0.5, 0.5);
    sprite.position.set(prop.x, prop.y + (height * scale) / 2, 0);
    return;
  }
  const paw = prop.kind === "cat" || prop.kind === "bernie" || prop.kind === "sam" || prop.kind === "rabbit";
  sprite.center.set(0.5, paw ? (height - 30) / height : 0);
  sprite.position.set(prop.x, prop.y, 0);
}

/** Call only when the entire world is destroyed; textures are shared across models. */
export function disposeWorldModelTextures() {
  for (const texture of textureCache.values()) texture.dispose();
  textureCache.clear();
}
