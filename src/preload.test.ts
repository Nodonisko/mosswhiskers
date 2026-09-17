import { expect, test } from "bun:test";
import { MUSIC_URL } from "./music";
import { PIXEL_FONT_URL } from "./pixel-canvas";
import {
  AUDIO_URLS,
  BOOT_START_KEY,
  BOOT_START_TOUCH,
  PRELOAD_URLS,
  worldTextureJobs,
} from "./preload";
import { SFX_URLS } from "./sfx";
import { createWorldLayout } from "./world";
import { DEFAULT_CAT_SEED, FARM_CARROTS } from "./world-config";
import { worldModelTextureKey } from "./world-models";

test("preloads the pixel font, music, and every sound clip", () => {
  expect(PRELOAD_URLS).toContain(PIXEL_FONT_URL);
  expect(AUDIO_URLS).toContain(MUSIC_URL);
  for (const src of SFX_URLS) expect(AUDIO_URLS).toContain(src);
});

test("texture jobs cover the authored world, the player cat, and farm rockets", () => {
  const jobs = worldTextureJobs();
  const keys = new Set(jobs.map((job) => worldModelTextureKey(job.kind, job)));
  expect(keys.size).toBe(jobs.length);

  const layout = createWorldLayout();
  for (const prop of layout.props) {
    expect(keys.has(worldModelTextureKey(prop.kind, {
      seed: prop.seed,
      variant: prop.variant,
      sick: prop.sick,
    }))).toBe(true);
  }

  expect(keys.has(worldModelTextureKey("cat", { seed: DEFAULT_CAT_SEED, variant: 0, facing: "s" }))).toBe(true);
  expect(keys.has(worldModelTextureKey("cat", { seed: DEFAULT_CAT_SEED, variant: 7, facing: "e", hit: true }))).toBe(true);
  expect(keys.has(worldModelTextureKey("carrot", { seed: FARM_CARROTS[0]!.seed, variant: 20 }))).toBe(true);
  expect(keys.has(worldModelTextureKey("carrot", { seed: 88, variant: 10 }))).toBe(true);
});

test("boot start copy has a keyboard line and a touch line", () => {
  expect(BOOT_START_KEY.toLowerCase()).toContain("key");
  expect(BOOT_START_TOUCH.toLowerCase()).toContain("tap");
});
