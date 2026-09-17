import type { WorldPaint } from "./world-paint";

const STEM_DARK = "#a09070";
const STEM_MID = "#c4b898";
const STEM_LIGHT = "#e8dcc0";

function leanOf(p: WorldPaint): number {
  return Math.floor(p.random() * 3) - 1;
}

function paintStem(
  p: WorldPaint,
  cx: number,
  footY: number,
  w: number,
  h: number,
  lean: number,
) {
  const top = footY - h;
  const leftTop = cx - Math.floor(w / 2) + lean;
  const rightTop = leftTop + w;
  const leftBot = cx - Math.floor(w / 2);
  const rightBot = leftBot + w;
  p.poly([[leftTop, top], [rightTop, top], [rightBot, footY], [leftBot, footY]], STEM_DARK);
  if (w >= 3) {
    p.poly(
      [[leftTop + 1, top], [rightTop - 1, top], [rightBot - 1, footY - 1], [leftBot + 1, footY - 1]],
      STEM_MID,
    );
  }
  p.rect(leftTop + (w >= 4 ? 1 : 0), top, Math.max(1, Math.floor(w / 3)), Math.max(1, h - 1), STEM_LIGHT);
  p.rect(rightBot - 1, top + 2, 1, Math.max(1, h - 3), STEM_DARK);
  p.rect(leftBot, footY - 1, w, 1, STEM_DARK);
}

function paintDomeCap(
  p: WorldPaint,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  dark: string,
  mid: string,
  light: string,
) {
  p.ellipse(cx, cy, rx, ry, dark);
  p.ellipse(cx, cy + Math.max(1, Math.floor(ry * 0.5)), rx, Math.max(2, Math.floor(ry * 0.28)), dark);
  p.ellipse(cx - 1, cy - 1, Math.max(2, rx - 2), Math.max(2, ry - 2), mid);
  p.ellipse(
    cx - Math.max(2, Math.floor(rx * 0.28)),
    cy - Math.max(1, Math.floor(ry * 0.32)),
    Math.max(2, Math.floor(rx * 0.42)),
    Math.max(2, Math.floor(ry * 0.36)),
    light,
  );
}

function paintSpots(p: WorldPaint, cx: number, cy: number, rx: number, ry: number) {
  const units: Array<readonly [number, number]> = [
    [-0.4, -0.32], [0.28, -0.38], [0.48, 0.08], [-0.18, 0.28], [0.08, 0.02], [-0.52, 0.12], [0.32, 0.32],
  ];
  for (const [ux, uy] of units) {
    if (p.random() < 0.18) continue;
    const dx = ux * rx + (p.random() * 2 - 1);
    const dy = uy * ry + (p.random() * 2 - 1);
    if ((dx / rx) ** 2 + (dy / ry) ** 2 > 0.7) continue;
    p.rect(cx + dx, cy + dy, 1 + (p.random() > 0.45 ? 1 : 0), 1, STEM_LIGHT);
  }
}

function paintToadstoolCap(p: WorldPaint, cx: number, cy: number, rx: number, ry: number, spots: boolean) {
  paintDomeCap(p, cx, cy, rx, ry, "#8a2018", "#c44532", "#e07050");
  p.rect(cx - Math.floor(rx * 0.32), cy - Math.floor(ry * 0.48), Math.max(2, Math.floor(rx * 0.28)), 2, "#d45a3a");
  if (spots) paintSpots(p, cx, cy, rx, ry);
}

function paintBrownCap(p: WorldPaint, cx: number, cy: number, rx: number, ry: number) {
  paintDomeCap(p, cx, cy, rx, ry, "#5a3a22", "#7a5430", "#b88854");
  if (rx >= 4) p.rect(cx - Math.floor(rx * 0.38), cy - Math.floor(ry * 0.42), 2, 1, "#9a6c40");
}

// Classic red cap, thick cream stem, tiny sibling.
function toadstool(p: WorldPaint) {
  const sibLeft = p.random() < 0.55;
  const mainLean = leanOf(p);
  const sibLean = leanOf(p);
  const mainCx = sibLeft ? 21 : 15;
  const sibCx = sibLeft ? 8 : 28;

  paintStem(p, sibCx, 31, 3, 7, sibLean);
  paintToadstoolCap(p, sibCx + sibLean, 22, 5, 3, p.random() > 0.3);

  paintStem(p, mainCx, 32, 7, 13, mainLean);
  p.rect(mainCx - 2 + mainLean, 18, 5, 2, STEM_DARK);
  paintToadstoolCap(p, mainCx + mainLean, 12, 12, 8, true);
}

// Mixed brown cluster, 3–5 caps overlapping slightly.
function brownCluster(p: WorldPaint) {
  p.ellipse(18, 32, 12, 3, "#41632b");
  const templates = [
    { cx: 18, footY: 32, s: 1 },
    { cx: 9, footY: 32, s: 0.72 },
    { cx: 26, footY: 31, s: 0.68 },
    { cx: 13, footY: 30, s: 0.5 },
    { cx: 22, footY: 30, s: 0.46 },
  ] as const;
  const count = 3 + Math.floor(p.random() * 3);
  const shrooms = templates.slice(0, count).map((t) => {
    const lean = leanOf(p);
    const jitter = leanOf(p);
    const s = t.s;
    const capRx = Math.max(3, Math.round(3 + s * 4));
    const cx = Math.max(2 + capRx, Math.min(33 - capRx, t.cx + jitter));
    return {
      cx,
      footY: t.footY,
      lean,
      stemW: Math.max(2, Math.round(2 + s * 2.5)),
      stemH: Math.round(6 + s * 8),
      capRx,
      capRy: Math.max(2, Math.round(2.5 + s * 3)),
    };
  });
  shrooms.sort((a, b) => a.footY - a.stemH - (b.footY - b.stemH) || a.cx - b.cx);
  for (const m of shrooms) {
    paintStem(p, m.cx, m.footY, m.stemW, m.stemH, m.lean);
    paintBrownCap(p, m.cx + m.lean, m.footY - m.stemH - Math.floor(m.capRy * 0.2), m.capRx, m.capRy);
  }
}

// Tall pitted honeycomb cap, thicker at the top.
function morel(p: WorldPaint) {
  const lean = leanOf(p);
  const cx = 18 + lean;
  paintStem(p, 18, 32, 4, 9, lean);
  p.poly(
    [
      [cx - 4, 24],
      [cx - 7, 16],
      [cx - 8, 8],
      [cx - 6, 3],
      [cx, 2],
      [cx + 6, 3],
      [cx + 8, 8],
      [cx + 7, 16],
      [cx + 4, 24],
    ],
    "#4a3018",
  );
  p.poly(
    [
      [cx - 3, 23],
      [cx - 6, 16],
      [cx - 7, 8],
      [cx - 5, 4],
      [cx, 3],
      [cx + 5, 4],
      [cx + 7, 8],
      [cx + 6, 16],
      [cx + 3, 23],
    ],
    "#8a5a30",
  );
  p.poly(
    [
      [cx - 5, 10],
      [cx - 4, 5],
      [cx - 1, 3],
      [cx + 1, 5],
      [cx - 1, 11],
      [cx - 4, 15],
    ],
    "#c49458",
  );
  for (let row = 0; row < 9; row++) {
    const y = 6 + row * 2;
    const t = row / 8;
    const half = Math.round(5.5 - t * 2.5);
    const stagger = row % 2;
    for (let col = -half; col <= half; col += 2) {
      if (p.random() < 0.22) continue;
      const x = cx + col + stagger;
      if (x <= cx - half || x >= cx + half) continue;
      p.rect(x, y, 1, 1, p.random() > 0.4 ? "#4a3018" : "#6a4428");
      if (p.random() > 0.55 && x > cx - half + 1) p.rect(x - 1, y - 1, 1, 1, "#c49458");
    }
  }
  p.rect(cx - 2, 23, 4, 2, "#6a4428");
  p.rect(cx - 1, 3, 3, 2, "#c49458");
  p.rect(cx + 2, 5, 2, 1, "#a07040");
}

// Trumpet / vase flare with darker gold gill rects.
function chanterelle(p: WorldPaint) {
  const lean = leanOf(p);
  const cx = 18 + lean;
  const flare = 11 + Math.floor(p.random() * 2);
  p.poly(
    [
      [cx - flare - 1, 11],
      [cx - flare, 6],
      [cx - 6, 3],
      [cx, 2],
      [cx + 6, 3],
      [cx + flare, 6],
      [cx + flare + 1, 11],
      [cx + 6, 15],
      [cx + 3, 22],
      [cx + 3, 31],
      [cx - 3, 31],
      [cx - 3, 22],
      [cx - 6, 15],
    ],
    "#a05818",
  );
  p.poly(
    [
      [cx - 10, 10],
      [cx - 9, 7],
      [cx - 5, 4],
      [cx, 3],
      [cx + 5, 4],
      [cx + 9, 7],
      [cx + 10, 10],
      [cx + 5, 14],
      [cx + 2, 22],
      [cx + 2, 30],
      [cx - 2, 30],
      [cx - 2, 22],
      [cx - 5, 14],
    ],
    "#d49430",
  );
  p.poly(
    [
      [cx - 8, 9],
      [cx - 6, 5],
      [cx - 1, 4],
      [cx + 2, 6],
      [cx - 1, 10],
      [cx - 5, 12],
    ],
    "#f0c860",
  );
  p.rect(cx + 1, 16, 1, 12, "#a05818");
  p.rect(cx - 2, 16, 1, 11, "#e0b048");
  p.ellipse(cx, 9, 6, 3, "#c47420");
  p.ellipse(cx + 1, 10, 3, 2, "#a05818");
  const gillY = 6 + Math.floor(p.random() * 2);
  for (let i = 0; i < 7; i++) {
    const x = cx - 7 + i * 2;
    const h = 3 + (i === 3 ? 2 : 0);
    p.rect(x, gillY, 1, h, i < 4 ? "#c47420" : "#a05818");
  }
  p.rect(cx - 1, 31, 3, 1, STEM_DARK);
}

export function paintMushroom(p: WorldPaint, variant: number): void {
  p.ellipse(18, 32, 10, 3, "#41632b");
  switch (((variant % 4) + 4) % 4) {
    case 0:
      toadstool(p);
      break;
    case 1:
      brownCluster(p);
      break;
    case 2:
      morel(p);
      break;
    default:
      chanterelle(p);
      break;
  }
}
