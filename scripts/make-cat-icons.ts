import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_CAT_SEED } from "../src/world-config";

const BACK = [0x72, 0x98, 0x47] as const;

class FakeCanvas {
  data = new Uint8ClampedArray(0);
  #width = 0;
  #height = 0;

  get width() {
    return this.#width;
  }
  set width(value: number) {
    this.#width = value;
    this.#alloc();
  }
  get height() {
    return this.#height;
  }
  set height(value: number) {
    this.#height = value;
    this.#alloc();
  }

  #alloc() {
    this.data = new Uint8ClampedArray(this.#width * this.#height * 4);
  }

  getContext(type: string) {
    if (type !== "2d") throw new Error("Only 2d is mocked");
    return new FakeCtx(this);
  }
}

class FakeCtx {
  fillStyle = "#000000";
  imageSmoothingEnabled = false;

  constructor(private canvas: FakeCanvas) {}

  fillRect(x: number, y: number, w: number, h: number) {
    const color = parseHex(this.fillStyle);
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.canvas.width, x + w);
    const y1 = Math.min(this.canvas.height, y + h);
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * this.canvas.width + px) * 4;
        this.canvas.data[i] = color[0];
        this.canvas.data[i + 1] = color[1];
        this.canvas.data[i + 2] = color[2];
        this.canvas.data[i + 3] = 255;
      }
    }
  }

  getImageData(x: number, y: number, w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) {
      const src = ((y + row) * this.canvas.width + x) * 4;
      data.set(this.canvas.data.subarray(src, src + w * 4), row * w * 4);
    }
    return { data, width: w, height: h };
  }

  createImageData(w: number, h: number) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
  }

  putImageData(image: { data: Uint8ClampedArray; width: number; height: number }, x: number, y: number) {
    for (let row = 0; row < image.height; row++) {
      const dst = ((y + row) * this.canvas.width + x) * 4;
      const src = row * image.width * 4;
      this.canvas.data.set(image.data.subarray(src, src + image.width * 4), dst);
    }
  }
}

function parseHex(color: string): readonly [number, number, number] {
  const hex = color.replace("#", "");
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function crc32(buf: Uint8Array) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const t = new TextEncoder().encode(type);
  const out = new Uint8Array(8 + data.length + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(t, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePng(width: number, height: number, pixels: Uint8ClampedArray) {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    raw.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), row + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const parts = [
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function cropHead(canvas: FakeCanvas) {
  const { width, height, data } = canvas;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const chin = 21;
  for (let y = 0; y < Math.min(height, chin); y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! < 128) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  minX = Math.max(0, minX - 1);
  minY = Math.max(0, minY - 1);
  maxX = Math.min(width - 1, maxX + 1);
  maxY = Math.min(chin - 1, maxY + 1);
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const crop = new Uint8ClampedArray(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const src = ((minY + y) * width + (minX + x)) * 4;
      crop.set(data.subarray(src, src + 4), (y * cropW + x) * 4);
    }
  }
  return { crop, cropW, cropH };
}

function scaleToIcon(crop: Uint8ClampedArray, cropW: number, cropH: number, size: number) {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = BACK[0];
    out[i + 1] = BACK[1];
    out[i + 2] = BACK[2];
    out[i + 3] = 255;
  }
  const scale = Math.max(1, Math.floor(size / Math.max(cropW, cropH)));
  const dw = cropW * scale;
  const dh = cropH * scale;
  const ox = Math.floor((size - dw) / 2);
  const oy = Math.floor((size - dh) / 2);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const src = (y * cropW + x) * 4;
      if (crop[src + 3]! < 128) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((oy + y * scale + dy) * size + (ox + x * scale + dx)) * 4;
          out[i] = crop[src]!;
          out[i + 1] = crop[src + 1]!;
          out[i + 2] = crop[src + 2]!;
          out[i + 3] = 255;
        }
      }
    }
  }
  return out;
}

function svgFromCrop(crop: Uint8ClampedArray, cropW: number, cropH: number) {
  const rects = [`<rect width="${cropW}" height="${cropH}" fill="#729847"/>`];
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const i = (y * cropW + x) * 4;
      if (crop[i + 3]! < 128) continue;
      const hex = `#${[crop[i], crop[i + 1], crop[i + 2]].map((n) => n!.toString(16).padStart(2, "0")).join("")}`;
      rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${hex}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cropW} ${cropH}" shape-rendering="crispEdges">${rects.join("")}</svg>\n`;
}

const fake = new FakeCanvas();
(globalThis as { document: { createElement: (tag: string) => FakeCanvas } }).document = {
  createElement(tag: string) {
    if (tag !== "canvas") throw new Error(`unexpected element ${tag}`);
    return fake;
  },
};

const { paintWorldModel } = await import("../src/world-models");
paintWorldModel("cat", { seed: DEFAULT_CAT_SEED, variant: 0, facing: "s" });
const { crop, cropW, cropH } = cropHead(fake);

const root = new URL("..", import.meta.url).pathname;
mkdirSync(`${root}assets`, { recursive: true });
writeFileSync(`${root}favicon.svg`, svgFromCrop(crop, cropW, cropH));
for (const [name, size] of [
  ["assets/favicon-32.png", 32],
  ["assets/apple-touch-icon.png", 180],
  ["assets/icon-192.png", 192],
  ["assets/icon-512.png", 512],
] as const) {
  writeFileSync(`${root}${name}`, encodePng(size, size, scaleToIcon(crop, cropW, cropH, size)));
}
console.log(`cropped Mosswhisker head ${cropW}x${cropH}`);
