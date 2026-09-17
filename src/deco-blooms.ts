import type { WorldPaint } from "./world-paint";

const STEM = "#6c9149";
const STEM_LEAF = "#91a858";
const WHITE = ["#ced3aa", "#e7e8c9", "#b8ba72"] as const;
const BLUE = ["#547ca6", "#6595ba", "#7ea7c4"] as const;
const PINK = ["#967294", "#af7d9f", "#c591b1"] as const;
const YELLOW = ["#c4a040", "#d4b45a", "#e8d070"] as const;
const ORANGE = ["#c45a20", "#d4843c", "#e8a050"] as const;
const PURPLE = ["#6a4a8a", "#8a6aaa", "#b090c8"] as const;
const RED = ["#a03028", "#c45a4a", "#d87868"] as const;
const DAISY = ["#d4a030", "#e8c050"] as const;
const FERN = ["#2a4a22", "#345125", "#41632b", "#507231", "#6c9149"] as const;
const CLOVER = ["#2e713b", "#42934b", "#55a559", "#6ab666"] as const;

function bloomWhite(p: WorldPaint, x: number, y: number) {
  p.rect(x - 2, y - 2, 5, 5, WHITE[0]);
  p.rect(x - 1, y - 3, 3, 7, WHITE[1]);
  p.rect(x - 3, y - 1, 7, 3, WHITE[1]);
  p.rect(x - 1, y - 1, 2, 2, WHITE[2]);
}

function bloomStacked(p: WorldPaint, x: number, y: number, colors: readonly string[]) {
  for (let j = 0; j < 5; j++) {
    p.rect(x - 2 + (j % 2), y - j * 2, 4 - (j === 4 ? 2 : 0), 2, colors[j % 3]!);
  }
}

function bloomButtercup(p: WorldPaint, x: number, y: number) {
  p.ellipse(x, y, 4, 3, YELLOW[0]);
  p.rect(x - 3, y - 2, 6, 3, YELLOW[1]);
  p.ellipse(x, y - 1, 3, 2, YELLOW[2]);
  p.rect(x - 1, y - 1, 2, 2, YELLOW[0]);
}

function bloomPoppy(p: WorldPaint, x: number, y: number) {
  p.ellipse(x, y, 6, 4, ORANGE[0]);
  p.rect(x - 5, y - 2, 11, 4, ORANGE[1]);
  p.rect(x - 4, y - 4, 8, 3, ORANGE[2]);
  p.rect(x - 3, y - 1, 7, 2, ORANGE[0]);
  p.rect(x - 1, y - 1, 2, 2, ORANGE[0]);
  p.rect(x, y, 1, 1, RED[0]);
}

function bloomViolet(p: WorldPaint, x: number, y: number) {
  p.rect(x - 3, y - 1, 3, 3, PURPLE[0]);
  p.rect(x + 1, y - 1, 3, 3, PURPLE[1]);
  p.rect(x - 1, y - 4, 3, 3, PURPLE[2]);
  p.rect(x - 2, y + 1, 3, 2, PURPLE[1]);
  p.rect(x, y + 1, 3, 2, PURPLE[0]);
  p.rect(x - 1, y - 1, 2, 2, YELLOW[2]);
}

function bloomRose(p: WorldPaint, x: number, y: number) {
  p.ellipse(x, y, 4, 3, RED[0]);
  p.rect(x - 3, y - 2, 3, 3, RED[1]);
  p.rect(x + 1, y - 2, 3, 3, RED[2]);
  p.rect(x - 2, y - 4, 4, 3, RED[1]);
  p.rect(x - 2, y, 5, 2, RED[0]);
  p.rect(x - 1, y - 1, 2, 2, WHITE[1]);
}

function bloomDaisy(p: WorldPaint, x: number, y: number) {
  p.rect(x - 1, y - 4, 3, 3, WHITE[1]);
  p.rect(x + 2, y - 3, 3, 2, WHITE[0]);
  p.rect(x + 3, y - 1, 3, 3, WHITE[1]);
  p.rect(x + 2, y + 2, 3, 2, WHITE[0]);
  p.rect(x - 1, y + 3, 3, 3, WHITE[1]);
  p.rect(x - 4, y + 2, 3, 2, WHITE[0]);
  p.rect(x - 5, y - 1, 3, 3, WHITE[1]);
  p.rect(x - 4, y - 3, 3, 2, WHITE[0]);
  p.ellipse(x, y, 3, 3, DAISY[0]);
  p.rect(x - 1, y - 1, 3, 2, DAISY[1]);
}

function paintBloom(p: WorldPaint, x: number, y: number, kind: number) {
  if (kind === 0) bloomWhite(p, x, y);
  else if (kind === 1) bloomStacked(p, x, y, BLUE);
  else if (kind === 2) bloomStacked(p, x, y, PINK);
  else if (kind === 3) bloomButtercup(p, x, y);
  else if (kind === 4) bloomPoppy(p, x, y);
  else if (kind === 5) bloomViolet(p, x, y);
  else if (kind === 6) bloomRose(p, x, y);
  else bloomDaisy(p, x, y);
}

export function paintFlowers(p: WorldPaint, variant: number): void {
  const kind = ((variant % 8) + 8) % 8;
  p.ellipse(20, 37, 16, 3, FERN[1]);
  const count = 10 + Math.floor(p.random() * 5);
  const pad = kind === 4 || kind === 7 ? 7 : 5;
  const stems: Array<{ x: number; y: number; h: number }> = [];
  for (let i = 0; i < count; i++) {
    const x = pad + Math.floor(p.random() * (40 - pad * 2));
    const y = 9 + Math.floor(p.random() * 20);
    stems.push({ x, y, h: Math.min(6 + p.random() * 8, 38 - y) });
  }
  stems.sort((a, b) => a.y - b.y);
  for (const s of stems) {
    p.line(s.x, s.y, s.x - 1, s.y + s.h, STEM);
    p.line(s.x, s.y + 7, s.x + 4, s.y + 4, STEM_LEAF);
    paintBloom(p, s.x, s.y, kind);
  }
}

function fernPinna(
  p: WorldPaint,
  x: number,
  y: number,
  dir: number,
  len: number,
  lift: number,
  dark: string,
  mid: string,
  light: string,
) {
  if (len < 4) return;
  const tipX = x + dir * len;
  const tipY = y - lift;
  const hip = Math.round(len * 0.38);
  p.poly(
    [
      [x, y],
      [x + dir * hip, y - 2],
      [tipX, tipY],
      [x + dir * hip, y + 3],
      [x, y + 2],
    ],
    dark,
  );
  p.poly(
    [
      [x, y + 1],
      [x + dir * hip, y - 1],
      [tipX - dir, tipY + 1],
      [x + dir * 2, y + 1],
    ],
    mid,
  );
  p.rect(x + dir, y, Math.max(1, Math.floor(len * 0.28)), 1, light);
}

function fernFrond(
  p: WorldPaint,
  ox: number,
  oy: number,
  height: number,
  lean: number,
  width: number,
  lift: number,
  colors: readonly string[],
  pairs: number,
) {
  const dark = colors[0]!;
  const mid = colors[1]!;
  const leaf = colors[2]!;
  const light = colors[3] ?? leaf;
  for (let i = pairs; i >= 1; i--) {
    const t = i / (pairs + 0.4);
    const x = Math.round(ox + lean * t);
    const y = Math.round(oy - t * height);
    const flare = 0.58 + Math.sin(t * Math.PI) * 0.42;
    const len = Math.max(4, Math.round(width * flare));
    fernPinna(p, x, y, -1, len, lift, dark, mid, leaf);
    fernPinna(p, x + 1, y + (i % 2), 1, Math.max(4, len - 1), lift, dark, leaf, light);
  }
  p.line(ox, oy, ox + lean, oy - height, mid, 2);
  p.line(ox, oy - 1, ox + lean, oy - height + 1, light);
  p.poly(
    [
      [ox + lean - 1, oy - height],
      [ox + lean, oy - height - 5],
      [ox + lean + 1, oy - height],
    ],
    leaf,
  );
  p.rect(ox + lean, oy - height - 3, 1, 3, light);
}

export function paintFern(p: WorldPaint, variant: number): void {
  const shade = ((variant % 2) + 2) % 2 === 1;
  p.ellipse(23, 42, 14, 3, FERN[0]);
  if (!shade) {
    fernFrond(p, 31, 40, 17, 7, 8, 3, [FERN[1], FERN[2], FERN[3], FERN[3]], 5);
    fernFrond(p, 17, 41, 29, -5, 12, 3, [FERN[1], FERN[2], FERN[3], FERN[4]], 7);
  } else {
    fernFrond(p, 32, 40, 16, 8, 8, 2, [FERN[0], FERN[1], FERN[2], FERN[2]], 5);
    fernFrond(p, 18, 41, 27, -6, 11, 2, [FERN[0], FERN[1], FERN[2], FERN[3]], 7);
  }
}

function trifoil(p: WorldPaint, cx: number, cy: number) {
  const jitter = Math.floor(p.random() * 3);
  p.ellipse(cx - 3, cy + (jitter % 2), 3, 2, CLOVER[1]);
  p.rect(cx - 5, cy - 1, 4, 3, CLOVER[0 + (jitter % 2)]!);
  p.ellipse(cx + 3, cy + ((jitter + 1) % 2), 3, 2, CLOVER[2]);
  p.rect(cx + 1, cy - 1, 4, 3, CLOVER[1 + (jitter % 2)]!);
  p.ellipse(cx, cy - 3, 3, 2, CLOVER[3]);
  p.rect(cx - 2, cy - 4, 4, 3, CLOVER[2]);
  p.rect(cx - 1, cy - 1, 2, 2, CLOVER[0]);
  p.line(cx, cy + 1, cx, cy + 4, CLOVER[0]);
}

function cloverHead(p: WorldPaint, x: number, y: number, pink: boolean) {
  p.line(x, y + 2, x, y + 6, CLOVER[1]);
  if (pink) {
    p.ellipse(x, y, 3, 3, PINK[0]);
    p.rect(x - 2, y - 2, 5, 4, PINK[1]);
    p.rect(x - 1, y - 1, 3, 2, PINK[2]);
    p.rect(x, y, 1, 1, WHITE[1]);
  } else {
    p.ellipse(x, y, 3, 3, WHITE[0]);
    p.rect(x - 2, y - 2, 5, 4, WHITE[1]);
    p.rect(x - 1, y - 1, 3, 2, PINK[2]);
  }
}

export function paintClover(p: WorldPaint, variant: number): void {
  const flowering = ((variant % 2) + 2) % 2 === 1;
  p.ellipse(18, 18, 14, 2, CLOVER[0]);
  const plants: Array<{ x: number; y: number }> = [];
  const count = 5 + Math.floor(p.random() * 3);
  for (let i = 0; i < count; i++) {
    plants.push({
      x: 6 + Math.floor(p.random() * 24),
      y: 8 + Math.floor(p.random() * 8),
    });
  }
  plants.sort((a, b) => a.y - b.y);
  for (const plant of plants) trifoil(p, plant.x, plant.y);
  if (!flowering) return;
  const heads = 3 + Math.floor(p.random() * 2);
  for (let i = 0; i < heads; i++) {
    const x = 10 + Math.floor(p.random() * 16);
    const y = 4 + Math.floor(p.random() * 6);
    cloverHead(p, x, y, p.random() > 0.4);
  }
}
