export type Point = readonly [number, number];

/** Pixel raster used by world sprites. All primitives snap to whole pixels. */
export type WorldPaint = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  random: () => number;
  rect: (x: number, y: number, w: number, h: number, color: string) => void;
  ellipse: (cx: number, cy: number, rx: number, ry: number, color: string) => void;
  poly: (points: readonly Point[], color: string) => void;
  line: (x0: number, y0: number, x1: number, y1: number, color: string, thickness?: number) => void;
};
