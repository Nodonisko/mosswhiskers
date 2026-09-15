import * as THREE from 'three';

/** Native pixel dimensions are also world dimensions at scale 1. */
export type WorldModelKind = 'pine' | 'oak' | 'bush' | 'den' | 'mailbox' | 'mailBubble' | 'lamp' | 'flowers' | 'stone' | 'log' | 'cat';
export interface WorldModelOptions {
  seed?: number;
  scale?: number;
  /** Flowers: 0 white, 1 blue, 2 pink. Trees/cats: palette variation. */
  variant?: number;
}

type Point = readonly [number, number];
type Paint = ReturnType<typeof painter>;
const textureCache = new Map<string, THREE.CanvasTexture>();

export const WORLD_MODEL_SIZES: Record<WorldModelKind, readonly [number, number]> = {
  pine: [88, 142], oak: [120, 152], bush: [42, 38], den: [198, 154],
  mailbox: [26, 48], mailBubble: [46, 38], lamp: [28, 84], flowers: [40, 40], stone: [32, 22], log: [90, 32], cat: [20, 30],
};

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

const pineColors = ['#294222', '#345125', '#405f2a', '#507231', '#62853c', '#779449', '#899e52'];
const oakColors = ['#285a35', '#2e713b', '#378345', '#42934b', '#55a559', '#6ab666', '#83c379'];

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

function trunk(p: Paint, x: number, bottom: number, h: number, w: number) {
  p.poly([[x - w / 2, bottom - h], [x + w / 2, bottom - h], [x + w / 2, bottom - 11], [x + w, bottom - 2], [x + w / 2, bottom], [x + 1, bottom - 4], [x - 3, bottom], [x - w, bottom - 2], [x - w / 2, bottom - 12]], '#51472f');
  p.poly([[x - w / 2 + 2, bottom - h], [x + w / 2 - 2, bottom - h], [x + w / 2 - 1, bottom - 10], [x + w - 3, bottom - 4], [x + 2, bottom - 7], [x - 3, bottom - 3], [x - w + 3, bottom - 4], [x - w / 2 + 3, bottom - 13]], '#876b43');
  p.poly([[x - w / 2 + 3, bottom - h], [x, bottom - h], [x + 1, bottom - 16], [x - 3, bottom - 8], [x - w / 2 + 1, bottom - 6]], '#a58b5b');
  p.line(x + w / 2 - 3, bottom - h + 4, x + w / 2 - 2, bottom - 13, '#695535', 2);
  p.line(x - 2, bottom - 31, x - 1, bottom - 16, '#bc9d67');
  p.line(x + 2, bottom - 17, x - 1, bottom - 10, '#705837');
}

function pine(p: Paint, variant: number) {
  const palette = variant % 2 ? pineColors.map((v, i) => i === 4 ? '#6b873a' : v) : pineColors;
  trunk(p, 43, 139, 70, 12);
  // Layered boughs make the conical silhouette irregular, with the darkest skirts below.
  p.poly([[42, 3], [51, 16], [49, 18], [60, 31], [56, 32], [69, 49], [63, 49], [75, 65], [69, 65], [84, 90], [78, 94], [82, 100], [69, 110], [48, 115], [29, 113], [12, 105], [5, 98], [10, 91], [5, 89], [19, 67], [14, 69], [28, 45], [22, 47], [36, 24], [31, 26]], palette[0]!);
  leafCluster(p, 43, 91, 34, 21, palette);
  leafCluster(p, 36, 79, 28, 18, palette);
  leafCluster(p, 53, 78, 23, 17, palette);
  leafCluster(p, 42, 60, 26, 19, palette);
  leafCluster(p, 42, 44, 20, 17, palette);
  leafCluster(p, 43, 29, 14, 15, palette);
  leafCluster(p, 43, 15, 8, 10, palette);
}

function oak(p: Paint, variant: number) {
  const palette = variant % 3 === 1 ? ['#304623', '#3d5726', '#506b2d', '#637f36', '#789343', '#8d9f51', '#a4b362'] : oakColors;
  trunk(p, 63, 149, 74, 20);
  p.line(61, 116, 37, 84, '#745a35', 6);
  p.line(64, 114, 83, 83, '#755b35', 5);
  leafCluster(p, 61, 83, 48, 27, palette);
  leafCluster(p, 30, 73, 27, 28, palette);
  leafCluster(p, 91, 71, 25, 28, palette);
  leafCluster(p, 53, 58, 33, 29, palette);
  leafCluster(p, 30, 45, 25, 23, palette);
  leafCluster(p, 87, 45, 28, 27, palette);
  leafCluster(p, 59, 29, 31, 26, palette);
  leafCluster(p, 52, 19, 19, 16, palette);
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
  p.rect(14, 10, 20, 14, ink);
  p.rect(16, 12, 16, 10, paperLight);
  p.line(16, 13, 24, 19, ink, 1);
  p.line(32, 13, 24, 19, ink, 1);
  p.line(16, 21, 21, 17, ink, 1);
  p.line(32, 21, 27, 17, ink, 1);
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
  p.poly([[12, 30], [11, 27], [14, 23], [14, 20], [17, 24], [16, 29]], '#dd7951');
  p.poly([[13, 29], [13, 26], [16, 23], [15, 29]], '#f7c969');
  p.rect(11, 33, 7, 2, '#969b8b');
  p.poly([[9, 77], [13, 70], [16, 71], [19, 78], [19, 80], [9, 80]], '#818778');
  p.rect(10, 78, 8, 1, '#a6aa99');
}

function flowers(p: Paint, variant: number) {
  for (let i = 0; i < 13; i++) {
    const x = 5 + Math.floor(p.random() * 30);
    const y = 9 + Math.floor(p.random() * 23);
    const height = 6 + p.random() * 8;
    p.line(x, y, x - 1, y + height, '#6c9149');
    p.line(x, y + 7, x + 4, y + 4, '#91a858');
    if (variant % 3 === 0) {
      p.rect(x - 2, y - 2, 5, 5, '#ced3aa');
      p.rect(x - 1, y - 3, 3, 7, '#e7e8c9');
      p.rect(x - 3, y - 1, 7, 3, '#e7e8c9');
      p.rect(x - 1, y - 1, 2, 2, '#b8ba72');
    } else {
      const colors = variant % 3 === 1 ? ['#547ca6', '#6595ba', '#7ea7c4'] : ['#967294', '#af7d9f', '#c591b1'];
      for (let j = 0; j < 5; j++) {
        p.rect(x - 2 + j % 2, y - j * 2, 4 - (j === 4 ? 2 : 0), 2, colors[j % 3]!);
      }
    }
  }
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

function cat(p: Paint, variant: number) {
  const orange = variant % 2 === 0;
  const fur = orange ? '#c99751' : '#929286';
  const shadow = orange ? '#8c693e' : '#626961';
  const light = orange ? '#e3b86c' : '#b8b7a3';
  p.ellipse(10, 28, 7, 2, '#536740');
  p.line(11, 16, 11, 2, shadow, 2);
  p.line(11, 14, 11, 3, light);
  p.ellipse(10, 19, 5, 9, shadow);
  p.ellipse(10, 18, 4, 8, fur);
  p.rect(6, 25, 3, 4, '#f1e4bd');
  p.rect(12, 25, 3, 4, '#f1e4bd');
  p.rect(9, 19, 3, 7, '#f0dfb4');
  p.rect(6, 19, 3, 2, shadow);
  p.rect(13, 20, 2, 2, shadow);
  p.poly([[4, 16], [3, 8], [5, 7], [8, 10], [12, 10], [16, 7], [17, 8], [16, 17], [13, 20], [7, 20]], shadow);
  p.poly([[5, 16], [5, 10], [8, 12], [12, 12], [15, 10], [15, 17], [12, 19], [7, 18]], light);
  p.rect(5, 10, 2, 3, '#dcaaa0');
  p.rect(14, 10, 1, 3, '#dcaaa0');
  p.rect(7, 12, 2, 3, fur);
  p.rect(11, 12, 2, 3, fur);
  p.rect(6, 15, 3, 2, '#d5e4b0');
  p.rect(12, 15, 3, 2, '#d5e4b0');
  p.rect(7, 15, 1, 2, '#398774');
  p.rect(13, 15, 1, 2, '#398774');
  p.rect(9, 17, 3, 2, '#f6e9c9');
  p.rect(10, 17, 1, 1, '#a66f67');
  p.line(4, 17, 1, 16, '#e9dfbb');
  p.line(15, 17, 19, 16, '#e9dfbb');
}

/** Create a unique Sprite/material while sharing immutable, seeded pixel textures. */
export function createWorldModel(kind: WorldModelKind, options: WorldModelOptions = {}): THREE.Sprite {
  const seed = options.seed ?? 1;
  const variant = options.variant ?? 0;
  const key = `${kind}:${seed}:${variant}`;
  const [width, height] = WORLD_MODEL_SIZES[kind];
  let texture = textureCache.get(key);
  if (!texture) {
    const p = painter(width, height, seed);
    switch (kind) {
      case 'pine': pine(p, variant); break;
      case 'oak': oak(p, variant); break;
      case 'bush': bush(p); break;
      case 'den': den(p); break;
      case 'mailbox': mailbox(p); break;
      case 'mailBubble': mailBubble(p); break;
      case 'lamp': lamp(p); break;
      case 'flowers': flowers(p, variant); break;
      case 'stone': rock(p, 1, 1, 29, 19, 12); break;
      case 'log': log(p); break;
      case 'cat': cat(p, variant); break;
    }
    texture = new THREE.CanvasTexture(p.canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(key, texture);
  }
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.5, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0);
  sprite.scale.set(width * (options.scale ?? 1), height * (options.scale ?? 1), 1);
  sprite.name = `${kind}-${seed}`;
  sprite.userData = { kind, seed, variant, nativeWidth: width, nativeHeight: height };
  return sprite;
}

/** Call only when the entire world is destroyed; textures are shared across models. */
export function disposeWorldModelTextures() {
  for (const texture of textureCache.values()) texture.dispose();
  textureCache.clear();
}
