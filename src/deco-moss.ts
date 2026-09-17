import type { WorldPaint } from "./world-paint";

const MOSS = ["#2a4a22", "#345125", "#3a6a32", "#4a7a38", "#5a8a40", "#6c9149", "#91a858"] as const;
const LICHEN = ["#6a7a48", "#8a9a58", "#a0b070", "#c0c888"] as const;

function jitter(p: WorldPaint, n: number): number {
  return Math.floor(p.random() * (n * 2 + 1)) - n;
}

function mossClump(p: WorldPaint, x: number, y: number, rx: number, ry: number) {
  p.ellipse(x, y + 1, rx, ry, MOSS[0]);
  p.ellipse(x, y, Math.max(2, rx - 1), Math.max(1, ry - 1), MOSS[1]);
  p.ellipse(x - 1, y - 1, Math.max(2, rx - 2), Math.max(1, ry - 2), MOSS[2]);
  if (rx > 4) p.ellipse(x - 1, y - 2, Math.max(2, rx - 4), Math.max(1, ry - 3), MOSS[3]);
  const tips = 2 + Math.floor(p.random() * 4);
  for (let i = 0; i < tips; i++) {
    const dx = (p.random() * 2 - 1) * Math.max(1, rx - 3);
    const dy = (p.random() * 1.5 - 1) * Math.max(1, ry - 2);
    p.rect(x + dx, y + dy, 1 + Math.floor(p.random() * 2), 1, p.random() > 0.45 ? MOSS[5] : MOSS[6]);
  }
}

function cushion(p: WorldPaint, x: number, y: number, rx: number, ry: number) {
  p.ellipse(x + 1, y + 2, rx, ry, MOSS[0]);
  p.ellipse(x, y + 1, rx - 1, Math.max(2, ry - 1), MOSS[1]);
  p.ellipse(x - 1, y, Math.max(3, rx - 2), Math.max(2, ry - 2), MOSS[2]);
  p.ellipse(x - 2, y - 1, Math.max(2, rx - 4), Math.max(2, ry - 3), MOSS[4]);
  p.ellipse(x - 2, y - 2, Math.max(2, rx - 6), Math.max(1, ry - 5), MOSS[5]);
  p.rect(x - rx * 0.3, y - ry * 0.5, 2, 1, MOSS[6]);
  p.rect(x - rx * 0.12, y - ry * 0.62, 1, 1, MOSS[6]);
  const tips = 2 + Math.floor(p.random() * 3);
  for (let i = 0; i < tips; i++) {
    p.rect(x - 2 + p.random() * 4, y - ry * 0.4 + p.random() * 3, 1, 1, MOSS[6]);
  }
}

function lichenSpot(p: WorldPaint, x: number, y: number, rx: number, ry: number) {
  p.ellipse(x, y, rx, ry, LICHEN[0]);
  p.ellipse(x - 1, y - 1, Math.max(1, rx - 2), Math.max(1, ry - 1), LICHEN[1]);
  if (p.random() > 0.35) p.rect(x, y - 1, 1 + Math.floor(p.random() * 2), 1, LICHEN[2]);
  if (p.random() > 0.55) p.rect(x + jitter(p, 1), y, 1, 1, LICHEN[3]);
}

function cap(p: WorldPaint, x: number, y: number) {
  p.rect(x, y + 1, 2, 4, "#a09070");
  p.rect(x, y + 2, 1, 2, "#e8dcc0");
  p.ellipse(x + 1, y, 4, 2, "#8a2018");
  p.rect(x - 2, y - 1, 6, 2, "#c44532");
  p.rect(x - 1, y - 1, 2, 1, "#e07050");
  p.rect(x, y - 1, 1, 1, "#e8dcc0");
}

function mossPatch(p: WorldPaint) {
  p.poly(
    [[4, 20], [7, 16], [14, 14], [21, 16], [27, 13], [35, 15], [41, 13], [46, 17], [47, 20], [43, 21], [28, 21], [16, 20], [6, 21]],
    MOSS[0],
  );
  const lumps: Array<readonly [number, number, number, number]> = [
    [11, 17, 7, 3],
    [18, 16, 8, 4],
    [26, 17, 9, 3],
    [34, 16, 7, 4],
    [41, 18, 6, 3],
    [15, 15, 5, 3],
    [30, 14, 6, 3],
    [22, 18, 7, 3],
    [8, 18, 5, 2],
  ];
  for (const [x, y, rx, ry] of lumps) {
    mossClump(p, x + jitter(p, 1), y + (p.random() > 0.6 ? 1 : 0), rx, ry);
  }
  for (let i = 0; i < 10; i++) {
    p.rect(6 + p.random() * 38, 14 + p.random() * 6, 1 + Math.floor(p.random() * 2), 1, p.random() > 0.5 ? MOSS[4] : MOSS[6]);
  }
}

function cushionMoss(p: WorldPaint) {
  p.ellipse(25, 20, 18, 2, MOSS[0]);
  cushion(p, 14, 15, 10, 5);
  cushion(p, 26, 12, 11, 7);
  cushion(p, 38, 16, 9, 5);
  cushion(p, 20, 17, 7, 4);
  if (p.random() > 0.35) mossClump(p, 32 + jitter(p, 2), 18, 5, 3);
  if (p.random() > 0.5) mossClump(p, 9 + jitter(p, 1), 18, 4, 2);
}

function lichen(p: WorldPaint) {
  p.poly([[8, 20], [11, 14], [19, 11], [29, 10], [38, 13], [44, 16], [45, 20], [40, 21], [14, 21], [7, 20]], "#555851");
  p.poly([[11, 19], [14, 15], [20, 12], [29, 12], [36, 14], [41, 17], [40, 20], [16, 20]], "#858780");
  p.poly([[16, 16], [22, 13], [31, 13], [28, 17], [20, 18]], "#a0a199");
  for (let i = 0; i < 18; i++) {
    p.rect(14 + p.random() * 24, 13 + p.random() * 7, 1, 1, p.random() > 0.48 ? "#91938b" : "#7a7d75");
  }
  const spots: Array<readonly [number, number, number, number]> = [
    [12, 16, 4, 2],
    [18, 14, 5, 3],
    [26, 13, 4, 2],
    [33, 15, 5, 2],
    [40, 17, 3, 2],
    [22, 17, 3, 2],
    [15, 18, 3, 1],
    [30, 18, 4, 2],
    [36, 12, 3, 2],
  ];
  for (const [x, y, rx, ry] of spots) {
    if (p.random() > 0.12) lichenSpot(p, x + jitter(p, 1), y, rx, ry);
  }
}

export function paintMoss(p: WorldPaint, variant: number): void {
  const kind = ((variant % 3) + 3) % 3;
  if (kind === 1) cushionMoss(p);
  else if (kind === 2) lichen(p);
  else mossPatch(p);
}

function logWood(p: WorldPaint) {
  p.line(6, 24, 17, 8, "#665030", 3);
  p.line(29, 25, 32, 7, "#77613c", 3);
  p.line(51, 23, 61, 9, "#786039", 3);
  p.line(70, 26, 80, 34, "#725735", 3);
  p.poly([[2, 20], [6, 16], [81, 15], [89, 22], [88, 32], [81, 35], [6, 34], [1, 29]], "#655136");
  p.poly([[6, 20], [81, 19], [86, 23], [85, 29], [79, 32], [6, 31]], "#a08755");
  p.rect(7, 21, 73, 2, "#b39a68");
  p.rect(10, 28, 68, 2, "#806840");
  p.line(8, 25, 35, 24, "#766039");
  p.line(47, 25, 76, 26, "#78603c");
}

function logRings(p: WorldPaint) {
  p.ellipse(83, 25, 4, 7, "#655136");
  p.ellipse(83, 25, 3, 6, "#b69c69");
  p.ellipse(83, 25, 2, 4, "#7a603b");
  p.ellipse(83, 25, 1, 2, "#b69c69");
}

function mossyLog(p: WorldPaint) {
  logWood(p);
  const along: Array<readonly [number, number, number, number]> = [
    [12, 15, 6, 3],
    [22, 14, 7, 3],
    [34, 15, 6, 2],
    [46, 14, 8, 3],
    [58, 15, 6, 3],
    [68, 16, 5, 2],
  ];
  for (const [x, y, rx, ry] of along) {
    if (p.random() > 0.12) mossClump(p, x + jitter(p, 2), y + jitter(p, 1), rx, ry);
  }
  mossClump(p, 18 + jitter(p, 2), 24, 4, 2);
  mossClump(p, 52 + jitter(p, 2), 26, 5, 2);
  if (p.random() > 0.4) mossClump(p, 38, 23, 3, 2);
  logRings(p);
}

function thickMossLog(p: WorldPaint) {
  logWood(p);
  p.poly([[8, 18], [18, 12], [40, 10], [62, 12], [78, 16], [76, 20], [8, 21]], MOSS[0]);
  const along: Array<readonly [number, number, number, number]> = [
    [10, 16, 6, 3],
    [18, 13, 8, 4],
    [28, 12, 7, 3],
    [38, 13, 9, 4],
    [50, 12, 8, 4],
    [60, 14, 7, 3],
    [70, 16, 6, 3],
    [16, 20, 5, 3],
    [32, 21, 6, 3],
    [48, 20, 7, 3],
    [64, 22, 5, 2],
    [24, 28, 5, 2],
    [56, 29, 6, 2],
    [72, 27, 4, 2],
  ];
  for (const [x, y, rx, ry] of along) {
    mossClump(p, x + jitter(p, 1), y, rx, ry);
  }
  cap(p, 22, 10);
  if (p.random() > 0.3) cap(p, 48 + jitter(p, 2), 11);
  logRings(p);
}

export function paintMossLog(p: WorldPaint, variant: number): void {
  if (((variant % 2) + 2) % 2 === 1) thickMossLog(p);
  else mossyLog(p);
}

function stumpWood(p: WorldPaint) {
  p.ellipse(23, 36, 16, 2, "#3a4630");
  p.poly([[3, 36], [8, 30], [14, 28], [17, 32], [12, 37], [4, 37]], "#655136");
  p.poly([[43, 36], [38, 29], [32, 28], [29, 32], [34, 37], [42, 37]], "#655136");
  p.poly([[18, 33], [23, 31], [28, 33], [26, 37], [20, 37]], "#655136");
  p.poly([[5, 35], [10, 31], [14, 30], [15, 33], [11, 36]], "#a08755");
  p.poly([[41, 35], [36, 30], [32, 30], [31, 33], [35, 36]], "#a08755");
  p.poly([[20, 34], [23, 32], [26, 34], [24, 36], [21, 36]], "#a08755");
  p.rect(8, 34, 3, 1, "#735326");
  p.rect(36, 34, 3, 1, "#735326");
  p.poly([[10, 16], [36, 16], [38, 22], [37, 32], [9, 32], [8, 22]], "#655136");
  p.poly([[12, 17], [34, 17], [35, 22], [34, 30], [12, 30], [11, 22]], "#a08755");
  p.rect(13, 18, 2, 11, "#b39a68");
  p.rect(32, 20, 2, 10, "#806840");
  p.line(16, 18, 15, 30, "#735326");
  p.line(28, 19, 29, 31, "#7a603b");
  p.rect(20, 22, 1, 8, "#806840");
  p.ellipse(23, 12, 16, 8, "#655136");
  p.ellipse(23, 18, 15, 3, "#735326");
  p.ellipse(23, 12, 14, 7, "#b39a68");
  p.ellipse(23, 12, 11, 5, "#a08755");
  p.ellipse(23, 12, 8, 3, "#b69c69");
  p.ellipse(23, 12, 5, 2, "#a08755");
  p.ellipse(23, 12, 2, 1, "#7a603b");
  p.ellipse(20, 10, 5, 2, "#b69c69");
  p.line(23, 12, 32, 16, "#806840");
  p.rect(31, 15, 2, 1, "#735326");
  p.rect(18, 22, 1, 1, "#735326");
  p.rect(26, 24, 1, 1, "#7a603b");
  p.rect(15, 26, 1, 1, "#806840");
}

export function paintStump(p: WorldPaint, variant: number): void {
  stumpWood(p);
  if (((variant % 2) + 2) % 2 !== 1) return;
  mossClump(p, 12, 10, 5, 3);
  mossClump(p, 23, 8, 6, 3);
  mossClump(p, 34, 11, 5, 2);
  mossClump(p, 16, 16, 4, 2);
  mossClump(p, 8, 32, 5, 3);
  mossClump(p, 38, 31, 5, 3);
  mossClump(p, 23, 34, 4, 2);
  if (p.random() > 0.25) mossClump(p, 30, 20, 4, 2);
  cap(p, 35, 22);
}
