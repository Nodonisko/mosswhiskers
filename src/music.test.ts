import { expect, test } from "bun:test";
import {
  audioSessionType,
  clampLevel,
  DEFAULT_MUSIC_LEVEL,
  DEFAULT_SFX_LEVEL,
  parseMusicSettings,
  shouldPlayMusic,
  volumeForLevel,
} from "./music";

test("clamps music to five levels", () => {
  expect(clampLevel(-1)).toBe(1);
  expect(clampLevel(9)).toBe(5);
  expect(clampLevel(3.4)).toBe(3);
  expect(clampLevel(Number.NaN)).toBe(DEFAULT_MUSIC_LEVEL);
  expect(clampLevel(Number.NaN, DEFAULT_SFX_LEVEL)).toBe(DEFAULT_SFX_LEVEL);
});

test("lowest level is silent and level 3 is half volume", () => {
  expect(volumeForLevel(1)).toBe(0);
  expect(volumeForLevel(2)).toBe(0.25);
  expect(volumeForLevel(3)).toBe(0.5);
  expect(volumeForLevel(4)).toBe(0.75);
  expect(volumeForLevel(5)).toBe(1);
});

test("parses stored music settings", () => {
  expect(parseMusicSettings(null)).toEqual({ level: DEFAULT_MUSIC_LEVEL, sfxLevel: DEFAULT_SFX_LEVEL });
  expect(parseMusicSettings("{")).toEqual({ level: DEFAULT_MUSIC_LEVEL, sfxLevel: DEFAULT_SFX_LEVEL });
  expect(parseMusicSettings(JSON.stringify({ level: 4 }))).toEqual({ level: 4, sfxLevel: DEFAULT_SFX_LEVEL });
  expect(parseMusicSettings(JSON.stringify({ muted: true }))).toEqual({ level: 1, sfxLevel: DEFAULT_SFX_LEVEL });
  expect(parseMusicSettings(JSON.stringify({ volume: 0.4 }))).toEqual({ level: 3, sfxLevel: DEFAULT_SFX_LEVEL });
  expect(parseMusicSettings(JSON.stringify({ level: 2, sfxLevel: 5 }))).toEqual({ level: 2, sfxLevel: 5 });
});

test("keeps music off in a hidden tab", () => {
  expect(shouldPlayMusic(true, 3)).toBe(true);
  expect(shouldPlayMusic(true, 1)).toBe(false);
  expect(shouldPlayMusic(false, 5)).toBe(false);
  expect(shouldPlayMusic(false, 1)).toBe(false);
});

test("uses playback audio session only while the tab is audible", () => {
  expect(audioSessionType(true, 3)).toBe("playback");
  expect(audioSessionType(false, 3)).toBe("ambient");
  expect(audioSessionType(true, 1)).toBe("ambient");
});
