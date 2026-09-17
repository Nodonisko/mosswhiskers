import { MUSIC_URL } from "./music";
import { loadPixelFont, PIXEL_FONT_URL } from "./pixel-canvas";
import { SFX_URLS } from "./sfx";
import { createWorldLayout } from "./world";
import { DEFAULT_CAT_SEED, FARM_CARROTS, type WorldModelKind } from "./world-config";
import { getWorldModelTexture, worldModelTextureKey, type WorldModelOptions } from "./world-models";

export const BOOT_START_KEY = "Press any key to start";
export const BOOT_START_TOUCH = "Tap to start";

const CAT_FACINGS = ["e", "w", "n", "s"] as const;
const SIDE_FACINGS = ["e", "w"] as const;

export const IMAGE_URLS = [
  "/assets/cog.png",
  "/assets/meadow-texture.png",
  "/assets/favicon-32.png",
  "/assets/apple-touch-icon.png",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/favicon.svg",
] as const;

export const AUDIO_URLS = [
  MUSIC_URL,
  "/assets/sounds/background.mp3",
  ...SFX_URLS,
] as const;

export const PRELOAD_URLS = [
  PIXEL_FONT_URL,
  ...IMAGE_URLS,
  ...AUDIO_URLS,
] as const;

export type TextureJob = { kind: WorldModelKind } & WorldModelOptions;

export type PreloadProgress = {
  done: number;
  total: number;
  ratio: number;
};

function addJob(jobs: TextureJob[], seen: Set<string>, kind: WorldModelKind, options: WorldModelOptions = {}) {
  const key = worldModelTextureKey(kind, options);
  if (seen.has(key)) return;
  seen.add(key);
  jobs.push({ kind, ...options });
}

/** Every canvas sprite the live game will ask for, so start hits the texture cache. */
export function worldTextureJobs(): TextureJob[] {
  const layout = createWorldLayout();
  const jobs: TextureJob[] = [];
  const seen = new Set<string>();

  for (const prop of layout.props) {
    addJob(jobs, seen, prop.kind, { seed: prop.seed, variant: prop.variant, sick: prop.sick });
  }

  for (const facing of CAT_FACINGS) {
    for (const variant of [0, 1, 2, 3, 4, 5, 6, 7]) {
      addJob(jobs, seen, "cat", { seed: DEFAULT_CAT_SEED, variant, facing });
    }
    for (const variant of [5, 6, 7]) {
      addJob(jobs, seen, "cat", { seed: DEFAULT_CAT_SEED, variant, facing, hit: true });
    }
  }

  layout.fish.forEach((fish, index) => {
    const seed = 801 + index;
    for (const facing of SIDE_FACINGS) {
      addJob(jobs, seen, fish.kind, { seed, variant: 0, facing });
      addJob(jobs, seen, fish.kind, { seed, variant: 1, facing });
    }
  });

  layout.mice.forEach((_, index) => {
    const seed = 900 + (index % 3);
    for (const facing of SIDE_FACINGS) {
      addJob(jobs, seen, "mouse", { seed, variant: 0, facing });
      addJob(jobs, seen, "mouse", { seed, variant: 1, facing });
    }
  });

  for (const crop of FARM_CARROTS) {
    addJob(jobs, seen, "carrot", { seed: crop.seed, variant: crop.variant });
    addJob(jobs, seen, "carrot", { seed: crop.seed, variant: 20 });
  }
  addJob(jobs, seen, "carrot", { seed: 88, variant: 10 });

  for (const kind of ["pike", "perch", "bluegill"] as const) {
    addJob(jobs, seen, kind, { seed: 801, variant: 0, facing: "e" });
  }
  addJob(jobs, seen, "mouse", { seed: 900, variant: 0, facing: "e" });

  return jobs;
}

export function yieldFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function fetchAsset(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    if (url.endsWith(".png") || url.endsWith(".svg")) {
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = objectUrl;
        await image.decode();
      } catch {
        // Decode failures still leave the HTTP cache warm.
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
      return;
    }
    await response.arrayBuffer();
  } catch {
    // Optional files such as the meadow texture must not block boot.
  }
}

export async function preloadGame(onProgress?: (progress: PreloadProgress) => void) {
  const jobs = worldTextureJobs();
  const total = PRELOAD_URLS.length + jobs.length + 1;
  let done = 0;

  function report() {
    onProgress?.({ done, total, ratio: done / total });
  }

  report();
  await loadPixelFont();
  done += 1;
  report();

  await Promise.all(PRELOAD_URLS.map(async (url) => {
    await fetchAsset(url);
    done += 1;
    report();
  }));

  for (let index = 0; index < jobs.length; index++) {
    const job = jobs[index]!;
    getWorldModelTexture(job.kind, job);
    done += 1;
    if (index === jobs.length - 1 || index % 2 === 1) {
      report();
      await yieldFrame();
    }
  }

  report();
}
