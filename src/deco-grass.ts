import type { WorldPaint } from "./world-paint";

function irand(p: WorldPaint, min: number, max: number): number {
  return min + Math.floor(p.random() * (max - min + 1));
}

function pick<T>(p: WorldPaint, items: readonly T[]): T {
  return items[Math.floor(p.random() * items.length)]!;
}

function stem(
  p: WorldPaint,
  x0: number,
  baseY: number,
  height: number,
  lean: number,
  dark: string,
  light: string,
  thickness = 1,
  kink = 0,
  xMin = 2,
  xMax = 41,
): { x: number; y: number } {
  const h = Math.max(1, Math.round(height));
  let tipX = Math.max(xMin, Math.min(xMax, Math.round(x0)));
  let tipY = Math.round(baseY);
  for (let i = 0; i < h; i++) {
    const t = h === 1 ? 1 : i / (h - 1);
    const extra = t > 0.55 ? kink * ((t - 0.55) / 0.45) : 0;
    const x = Math.max(xMin, Math.min(xMax, Math.round(x0 + lean * t * t + extra)));
    const y = Math.round(baseY - i);
    p.rect(x, y, thickness, 1, t > 0.62 ? light : dark);
    if (thickness > 1) p.rect(x, y, 1, 1, light);
    tipX = x;
    tipY = y;
  }
  return { x: tipX, y: tipY };
}

function sideShoot(p: WorldPaint, x: number, y: number, dir: number, color: string) {
  const len = 3 + irand(p, 0, 2);
  p.line(x, y, x + dir * len, y - 2, color);
}

function seedHead(p: WorldPaint, x: number, y: number) {
  p.rect(x - 1, y, 2, 3, "#c4a050");
  p.rect(x, y - 1, 1, 2, "#e0c45a");
  p.rect(x - 1, y + 1, 1, 2, "#8a6a30");
  if (p.random() > 0.45) p.rect(x + 1, y, 1, 2, "#d4b45a");
  p.rect(x, y - 2, 1, 1, "#ead07a");
}

function wheatEar(p: WorldPaint, cx: number, top: number, lean: number, heavy: boolean) {
  const h = (heavy ? 7 : 5) + irand(p, 0, 3);
  p.rect(cx - 1, top, 3, h, "#c4a050");
  p.rect(cx, top + 1, 2, h - 1, "#e0c45a");
  p.rect(cx - 1, top + 2, 1, h - 3, "#8a6a30");
  p.rect(cx + 1, top, 1, 2, "#ead07a");
  p.rect(cx - 1, top + 1, 1, 2, "#d4b45a");
  p.rect(cx + 1, top + 3, 1, 2, "#d4b45a");
  p.rect(cx, top + h - 2, 1, 2, "#b08a40");
  if (heavy) {
    p.rect(cx - 2, top + 2, 1, 3, "#b08a40");
    p.rect(cx + 2, top + 1, 1, 3, "#e0c45a");
    p.rect(cx - 1, top + 4, 3, 1, "#ead07a");
  }
  p.line(cx - 1, top, cx - 1 + lean - 1, top - 3, "#ead07a");
  p.line(cx, top, cx + lean, top - 4 - (heavy ? 1 : 0), "#f0e0a0");
  p.line(cx + 1, top, cx + 1 + lean, top - 3, "#e0c45a");
}

function cattailHead(p: WorldPaint, x: number, top: number, h: number) {
  p.rect(x - 1, top, 4, h, "#6a4428");
  p.rect(x, top + 1, 2, h - 2, "#8a5a30");
  p.rect(x, top + 2, 1, h - 4, "#a07040");
  p.rect(x + 1, top + Math.floor(h * 0.35), 1, 3, "#c49458");
  p.rect(x + 2, top + 2, 1, h - 5, "#8a5a30");
  p.rect(x, top - 3, 2, 4, "#ead07a");
  p.rect(x, top - 4, 1, 2, "#f0e0a0");
  p.rect(x + 1, top - 2, 1, 2, "#c49458");
}

export function paintGrass(p: WorldPaint, variant: number): void {
  const kind = ((variant % 3) + 3) % 3;
  p.ellipse(22, 26, 15, 3, "#41632b");
  const ground = 25;
  const midGreens = ["#41632b", "#507231", "#6c9149", "#91a858"] as const;
  const darkGreens = ["#294222", "#345125", "#41632b"] as const;

  if (kind === 0) {
    // Short meadow tuft.
    const count = 11 + irand(p, 0, 2);
    for (let i = 0; i < count; i++) {
      const x = 5 + Math.round((i / (count - 1)) * 33) + irand(p, -1, 1);
      const dist = Math.abs(x - 22) / 18;
      const h = Math.min(16, 7 + Math.round((1 - dist) * 6) + irand(p, 0, 3));
      const lean = irand(p, -2, 2);
      const dark = pick(p, midGreens);
      const light = p.random() > 0.35 ? "#91a858" : "#6c9149";
      const thick = p.random() > 0.78 ? 2 : 1;
      stem(p, x, ground, h, lean, dark, light, thick, 0, 2, 40);
      if (p.random() > 0.6) sideShoot(p, x, ground - Math.floor(h * 0.4), p.random() > 0.5 ? 1 : -1, light);
    }
    return;
  }

  if (kind === 1) {
    // Taller wild grass, bending and ragged.
    const count = 13 + irand(p, 0, 3);
    for (let i = 0; i < count; i++) {
      const x = 4 + Math.round((i / (count - 1)) * 35) + irand(p, -1, 1);
      const dist = Math.abs(x - 22) / 20;
      const ragged = p.random() > 0.72 ? 0.55 : 1;
      const h = Math.min(22, Math.round((14 + (1 - dist) * 8 + irand(p, 0, 4)) * ragged));
      const lean = irand(p, -4, 4);
      const kink = irand(p, -3, 3);
      const dark = pick(p, p.random() > 0.4 ? darkGreens : midGreens);
      const light = pick(p, ["#507231", "#6c9149", "#91a858", "#4f9a38"] as const);
      const thick = p.random() > 0.7 ? 2 : 1;
      stem(p, x, ground, h, lean, dark, light, thick, kink, 2, 40);
      if (p.random() > 0.5) sideShoot(p, x + Math.sign(lean), ground - Math.floor(h * 0.5), lean >= 0 ? 1 : -1, light);
    }
    return;
  }

  // Seed grass with tan heads.
  const count = 12 + irand(p, 0, 2);
  for (let i = 0; i < count; i++) {
    const x = 5 + Math.round((i / (count - 1)) * 33) + irand(p, -1, 1);
    const dist = Math.abs(x - 22) / 18;
    const h = Math.min(20, 14 + Math.round((1 - dist) * 8) + irand(p, 0, 3));
    const lean = irand(p, -3, 3);
    const dark = pick(p, ["#345125", "#41632b", "#507231"] as const);
    const light = pick(p, ["#6c9149", "#91a858"] as const);
    const tip = stem(p, x, ground, h, lean, dark, light, p.random() > 0.8 ? 2 : 1, irand(p, -2, 2), 2, 40);
    if (h > 16 || p.random() > 0.28) seedHead(p, tip.x, tip.y);
  }
}

export function paintWheat(p: WorldPaint, variant: number): void {
  const kind = ((variant % 2) + 2) % 2;
  p.ellipse(24, 42, 17, 3, "#41632b");
  const ground = 41;
  const stalkDark = ["#3a5028", "#4a6030", "#8a6a30"] as const;
  const stalkLight = ["#4a6030", "#8a6a30", "#b08a40"] as const;

  if (kind === 0) {
    // Ripe yellow clump, many thin stalks.
    const count = 16 + irand(p, 0, 3);
    for (let i = 0; i < count; i++) {
      const x = 5 + Math.round((i / (count - 1)) * 37) + irand(p, -1, 1);
      const dist = Math.abs(x - 24) / 20;
      const h = Math.min(34, 22 + Math.round((1 - dist) * 12) + irand(p, 0, 5));
      const lean = irand(p, -3, 3);
      const tip = stem(p, x, ground, h, lean, pick(p, stalkDark), pick(p, stalkLight), 1, irand(p, -2, 2), 3, 44);
      wheatEar(p, tip.x, tip.y, Math.sign(lean) || 1, p.random() > 0.35);
    }
    return;
  }

  // Planted sheaf: stalks gather at a bind, heads packed above.
  const cx = 24;
  const count = 18 + irand(p, 0, 2);
  const bindY = 22 + irand(p, 0, 2);
  for (let i = 0; i < count; i++) {
    const x = 10 + Math.round((i / (count - 1)) * 27) + irand(p, -1, 1);
    const inward = (cx - x) * 0.42;
    const lowerH = ground - bindY;
    const mid = stem(p, x, ground, lowerH, inward, pick(p, stalkDark), "#8a6a30", p.random() > 0.82 ? 2 : 1, 0, 3, 44);
    const splay = (x - cx) * 0.28 + irand(p, -1, 1);
    const upperH = 12 + irand(p, 0, 5);
    const tip = stem(p, mid.x, bindY, upperH, splay, "#8a6a30", "#b08a40", 1, 0, 3, 44);
    wheatEar(p, tip.x, tip.y, Math.sign(splay) || 1, true);
  }
  p.rect(cx - 6, bindY - 1, 13, 4, "#8a6a30");
  p.rect(cx - 5, bindY, 11, 2, "#c4a050");
  p.rect(cx - 4, bindY + 1, 9, 1, "#e0c45a");
  p.rect(cx + 5, bindY, 2, 2, "#b08a40");
}

export function paintReeds(p: WorldPaint, variant: number): void {
  const kind = ((variant % 3) + 3) % 3;
  p.ellipse(21, 65, 16, 3, "#41632b");
  const ground = 64;

  if (kind === 0) {
    // Clustered vertical lake reeds.
    const count = 12 + irand(p, 0, 2);
    for (let i = 0; i < count; i++) {
      const x = 7 + Math.round((i / (count - 1)) * 27) + irand(p, -1, 1);
      const dist = Math.abs(x - 21) / 16;
      const h = Math.min(58, 40 + Math.round((1 - dist) * 16) + irand(p, 0, 6));
      const lean = irand(p, -2, 2);
      const dark = pick(p, ["#294222", "#345125", "#3a5028"] as const);
      const light = pick(p, ["#41632b", "#507231", "#6c9149"] as const);
      stem(p, x, ground, h, lean, dark, light, p.random() > 0.55 ? 2 : 1, 0, 2, 38);
      if (p.random() > 0.7) p.rect(x + lean, ground - h + 1, 1, 2, "#91a858");
    }
    return;
  }

  if (kind === 1) {
    // Cattails with sausage-brown heads and pale tips.
    const count = 5 + irand(p, 0, 2);
    for (let i = 0; i < count; i++) {
      const x = 9 + Math.round((i / Math.max(1, count - 1)) * 22) + irand(p, -1, 1);
      const h = Math.min(56, 48 + irand(p, 0, 8));
      const lean = irand(p, -2, 2);
      const tip = stem(p, x, ground, h, lean, "#3a5028", "#507231", 2, 0, 4, 36);
      const headH = 11 + irand(p, 0, 5);
      cattailHead(p, tip.x, tip.y + 4, headH);
      if (p.random() > 0.55) {
        const leafY = ground - irand(p, 18, 36);
        p.line(tip.x, leafY, tip.x + (p.random() > 0.5 ? 4 : -4), leafY - 3, "#6c9149", 2);
      }
    }
    return;
  }

  // Mixed shore reeds, splayed, a couple broken.
  const count = 11 + irand(p, 0, 2);
  for (let i = 0; i < count; i++) {
    const x = 5 + Math.round((i / (count - 1)) * 31) + irand(p, -1, 1);
    const broken = i === 2 || i === count - 3 || p.random() > 0.88;
    const splay = Math.round((x - 21) * 0.22) + irand(p, -2, 2);
    const fullH = Math.min(56, 28 + irand(p, 0, 26));
    const h = broken ? Math.floor(fullH * (0.28 + p.random() * 0.28)) : fullH;
    const dark = pick(p, ["#294222", "#345125", "#3a5028", "#41632b"] as const);
    const light = pick(p, ["#507231", "#6c9149", "#91a858"] as const);
    const tip = stem(p, x, ground, h, splay, dark, light, p.random() > 0.65 ? 2 : 1, broken ? 0 : irand(p, -2, 2), 2, 38);
    if (broken) {
      const dir = splay >= 0 ? 1 : -1;
      p.line(tip.x + dir, tip.y + 1, tip.x + dir * (5 + irand(p, 0, 3)), tip.y + 3, light);
      p.rect(tip.x, tip.y, 2, 1, "#345125");
    } else if (p.random() > 0.55) {
      sideShoot(p, tip.x, ground - Math.floor(h * 0.35), splay >= 0 ? 1 : -1, light);
    }
  }
}
