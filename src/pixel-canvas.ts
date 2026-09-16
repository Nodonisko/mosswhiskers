import * as THREE from "three";

const PIXEL_FONT_URL = "/assets/PressStart2P-Regular.ttf";
let pixelFont: Promise<void> | undefined;

export function whenPixelFontReady(run: () => void) {
  pixelFont ??= new FontFace("Press Start 2P", `url("${PIXEL_FONT_URL}")`, {
    style: "normal",
    weight: "400",
    display: "block",
  }).load().then((face) => {
    document.fonts.add(face);
  }).catch(() => undefined);
  void pixelFont.then(run);
}

export function createPixelCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

export function nearestTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

export function paintPixelTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const { canvas, context } = createPixelCanvas(width, height);
  draw(context);
  return nearestTexture(canvas);
}
