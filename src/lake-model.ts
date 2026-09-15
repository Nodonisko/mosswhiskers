import * as THREE from "three";

export interface LakeModelOptions {
  width?: number;
  height?: number;
  seed?: number;
}

export interface LakeModel {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  width: number;
  height: number;
  /** Coordinates are relative to mesh.position; positive padding includes the bank. */
  containsPoint: (localX: number, localY: number, padding?: number) => boolean;
  frames: readonly THREE.CanvasTexture[];
}

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Lake texture requires Canvas 2D");
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

/** An XY ground plane, drawn at two world units per texel to match the meadow. */
export function createLakeModel(options: LakeModelOptions = {}): LakeModel {
  const width = options.width ?? 850;
  const height = options.height ?? 500;
  const random = seeded(options.seed ?? 8417);
  const phase = random() * Math.PI * 2;
  const textureWidth = Math.ceil(width / 2);
  const textureHeight = Math.ceil(height / 2);
  const { canvas: base, context: ctx } = makeCanvas(textureWidth, textureHeight);

  // Broad coves and unequal lobes; all paint and collision use this same contour.
  const shorelineRadius = (angle: number) =>
    0.855 + Math.sin(angle * 3 + phase) * 0.055
    + Math.sin(angle * 5 - 0.8) * 0.024
    + Math.cos(angle * 2 + 0.4) * 0.033
    + Math.sin(angle * 9 + 1.1) * 0.009;
  const shoreRatio = (x: number, y: number) => {
    const nx = x / (width / 2);
    const ny = y / (height / 2);
    return Math.hypot(nx, ny) / shorelineRadius(Math.atan2(ny, nx));
  };
  const pixelRatio = (x: number, y: number) =>
    shoreRatio((x + 0.5) / textureWidth * width - width / 2,
      height / 2 - (y + 0.5) / textureHeight * height);

  for (let y = 0; y < textureHeight; y++) {
    for (let x = 0; x < textureWidth; x++) {
      const ratio = pixelRatio(x, y);
      if (ratio > 1) continue;
      const noise = random();
      if (ratio > 0.983) {
        ctx.fillStyle = noise > 0.35 ? "#648044" : "#768f4b";
      } else if (ratio > 0.96) {
        ctx.fillStyle = noise > 0.82 ? "#8b8155" : "#82794f";
      } else if (ratio > 0.941) {
        ctx.fillStyle = noise > 0.85 ? "#746c49" : "#696c4c";
      } else if (ratio > 0.921) {
        ctx.fillStyle = noise > 0.72 ? "#76a197" : "#68958a";
      } else if (ratio > 0.88) {
        ctx.fillStyle = noise > 0.88 ? "#60928f" : "#5a8d8c";
      } else {
        const depth = Math.sin(x / 47 + y / 29) + Math.cos(y / 37 - x / 81);
        ctx.fillStyle = depth > 0.8 ? "#4f858e" : depth < -0.9 ? "#487c89" : "#4b808c";
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // A few low-contrast square color flecks stay still beneath moving glints.
  for (let i = 0; i < 640; i++) {
    const x = Math.floor(random() * textureWidth);
    const y = Math.floor(random() * textureHeight);
    if (pixelRatio(x, y) > 0.865) continue;
    ctx.fillStyle = random() > 0.5 ? "#548892" : "#467b86";
    const size = random() > 0.9 ? 2 : 1;
    ctx.fillRect(x, y, size, size);
  }

  // Separate seed stream keeps the existing water texture and ripple timing intact.
  const plantRandom = seeded((options.seed ?? 8417) ^ 0x51a7);
  const waterPixel = (x: number, y: number, color: string) => {
    if (x < 0 || y < 0 || x >= textureWidth || y >= textureHeight || pixelRatio(x, y) > 0.875) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };
  const shorePoint = (angle: number, ratio: number) => {
    const radius = shorelineRadius(angle) * ratio;
    return {
      x: Math.round(textureWidth / 2 * (1 + Math.cos(angle) * radius)),
      y: Math.round(textureHeight / 2 * (1 - Math.sin(angle) * radius)),
    };
  };

  // Sparse, muted silhouettes suggest plants beneath the water in the shallows.
  for (const angle of [0.35, 0.65, 1.9, 2.15, 3.5, 4.35, 5.55]) {
    const point = shorePoint(angle + (plantRandom() - 0.5) * 0.15, 0.73 + plantRandom() * 0.07);
    for (let blade = -1; blade <= 1; blade++) {
      const bladeHeight = 5 + Math.floor(plantRandom() * 5);
      for (let y = 0; y < bladeHeight; y++) {
        const bend = Math.round(Math.sin(y * 0.55 + blade) * 1.1);
        const x = point.x + blade * 2 + bend;
        waterPixel(x, point.y - y, "#477f80");
        if (y < bladeHeight - 2) waterPixel(x + 1, point.y - y, "#548b89");
      }
    }
  }

  // Three small groups leave the broad middle of the lake open.
  for (const [cluster, angle] of [0.95, 2.85, 5.1].entries()) {
    const point = shorePoint(angle + (plantRandom() - 0.5) * 0.12, 0.76);
    const pads = cluster === 1 ? [[0, 0], [10, 5]] : [[0, 0], [11, 3], [-7, 7]];
    for (const [pad, offset] of pads.entries()) {
      const x = point.x + offset[0]!;
      const y = point.y + offset[1]!;
      const radius = pad === 0 ? 5 : 4;
      for (let py = -3; py <= 3; py++) {
        for (let px = -radius; px <= radius; px++) {
          const edge = (px / radius) ** 2 + (py / 3) ** 2;
          // A tiny wedge of exposed water makes each pad read as a lily leaf.
          if (edge > 1 || (px >= 0 && py >= 0 && Math.abs(px - py) <= 1)) continue;
          waterPixel(x + px, y + py + 1, "#3e7172");
        }
      }
      for (let py = -3; py <= 3; py++) {
        for (let px = -radius; px <= radius; px++) {
          const edge = (px / radius) ** 2 + (py / 3) ** 2;
          if (edge > 1 || (px >= 0 && py >= 0 && Math.abs(px - py) <= 1)) continue;
          waterPixel(x + px, y + py, edge > 0.64 ? "#4f7950" : py < 0 ? "#81a563" : "#719650");
        }
      }
      if (pad === 0 && cluster !== 1) {
        waterPixel(x - 2, y - 2, "#d2ada8");
        waterPixel(x - 3, y - 3, "#e5c5b8");
        waterPixel(x - 1, y - 3, "#e5c5b8");
        waterPixel(x - 2, y - 3, "#e3cf8b");
        waterPixel(x - 2, y - 4, "#dbb6b0");
      }
    }
  }

  const ripples: Array<{ x: number; y: number; length: number; phase: number }> = [];
  for (let i = 0; i < 155; i++) {
    const x = Math.floor(random() * textureWidth);
    const y = Math.floor(random() * textureHeight);
    if (pixelRatio(x, y) > 0.82) continue;
    ripples.push({ x, y, length: 2 + Math.floor(random() * 4), phase: random() * Math.PI * 2 });
  }

  // Only the small glints change. The bank, water colors, and texture stay fixed.
  const frames = Array.from({ length: 8 }, (_, frame) => {
    const { canvas, context } = makeCanvas(textureWidth, textureHeight);
    context.drawImage(base, 0, 0);
    for (const ripple of ripples) {
      const wave = Math.sin(frame / 8 * Math.PI * 2 + ripple.phase);
      const drift = wave > 0.5 ? 1 : 0;
      context.fillStyle = `rgba(159, 199, 190, ${0.14 + wave * 0.055})`;
      context.fillRect(ripple.x + drift, ripple.y, ripple.length, 1);
      context.fillStyle = `rgba(155, 196, 189, ${0.08 + wave * 0.035})`;
      context.fillRect(ripple.x + drift - 1, ripple.y + 2, 2, 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  });

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: frames[0]!, transparent: true, alphaTest: 0.08, depthWrite: false }),
  );
  mesh.name = "southern-lake";
  mesh.position.z = -3;
  mesh.renderOrder = -9;

  return {
    mesh, width, height, frames,
    containsPoint(localX, localY, padding = 0) {
      // Positive padding follows each radial shoreline normal approximately.
      const distance = Math.hypot(localX, localY);
      if (distance === 0) return true;
      const ratio = shoreRatio(localX, localY);
      return distance <= distance / ratio + padding;
    },
  };
}

/** Slow six-second loop, changing just one pixel of ripple position at most. */
export function updateLakeModel(lake: LakeModel, elapsedSeconds: number) {
  const index = Math.floor(Math.max(0, elapsedSeconds) / 0.75) % lake.frames.length;
  const nextFrame = lake.frames[index]!;
  if (lake.mesh.material.map !== nextFrame) lake.mesh.material.map = nextFrame;
}
