import { Howl } from "howler";
import { clearMediaSession, onAudioRevive, watchGameAudio } from "./audio-runtime";
import { isPageVisible } from "./page-visible";

export const MUSIC_LEVELS = 5;
export const DEFAULT_MUSIC_LEVEL = 3;
export const DEFAULT_SFX_LEVEL = 5;
const STORAGE_KEY = "mosswhiskers-music";
const LEVEL_VOLUMES = [0, 0, 0.25, 0.5, 0.75, 1] as const;

export type MusicSettings = {
  level: number;
  sfxLevel: number;
};

export type BackgroundMusic = {
  level(): number;
  setLevel(level: number): void;
  sfxLevel(): number;
  setSfxLevel(level: number): void;
  sfxVolume(): number;
  dispose(): void;
};

export function clampLevel(value: number, fallback = DEFAULT_MUSIC_LEVEL) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MUSIC_LEVELS, Math.max(1, Math.round(value)));
}

export function volumeForLevel(level: number) {
  return LEVEL_VOLUMES[clampLevel(level)] ?? LEVEL_VOLUMES[DEFAULT_MUSIC_LEVEL];
}

export function parseMusicSettings(raw: string | null): MusicSettings {
  const fallback: MusicSettings = { level: DEFAULT_MUSIC_LEVEL, sfxLevel: DEFAULT_SFX_LEVEL };
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw) as { level?: unknown; volume?: unknown; muted?: unknown; sfxLevel?: unknown };
    const sfxLevel = typeof data.sfxLevel === "number" ? clampLevel(data.sfxLevel, DEFAULT_SFX_LEVEL) : DEFAULT_SFX_LEVEL;
    if (typeof data.level === "number") return { level: clampLevel(data.level), sfxLevel };
    if (data.muted === true) return { level: 1, sfxLevel };
    if (typeof data.volume === "number") {
      if (data.volume <= 0) return { level: 1, sfxLevel };
      return { level: clampLevel(Math.round(data.volume / 0.25) + 1), sfxLevel };
    }
    return { ...fallback, sfxLevel };
  } catch {
    return fallback;
  }
}

export function loadMusicSettings(): MusicSettings {
  try {
    return parseMusicSettings(localStorage.getItem(STORAGE_KEY));
  } catch {
    return { level: DEFAULT_MUSIC_LEVEL, sfxLevel: DEFAULT_SFX_LEVEL };
  }
}

export function saveMusicSettings(settings: MusicSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode and quota errors are fine to ignore.
  }
}

export function shouldPlayMusic(visible: boolean, level: number) {
  return visible && level > 1;
}

export function createBackgroundMusic(src = "/assets/background.mp3"): BackgroundMusic {
  let settings = loadMusicSettings();
  let music: Howl | null = null;
  let closed = false;

  function createHowl() {
    const track = new Howl({
      src: [src],
      html5: true,
      loop: true,
      preload: true,
      volume: volumeForLevel(settings.level),
      onunlock: () => syncPlayback(),
      onplayerror: () => {
        track.once("unlock", () => syncPlayback());
      },
    });
    return track;
  }

  function drop() {
    if (!music) return;
    music.stop();
    music.unload();
    music = null;
    clearMediaSession();
  }

  function syncPlayback(visible = isPageVisible()) {
    if (closed) return;
    if (!shouldPlayMusic(visible, settings.level)) {
      drop();
      return;
    }
    music ??= createHowl();
    music.volume(volumeForLevel(settings.level));
    if (!music.playing()) music.play();
  }

  const unwatch = watchGameAudio((visible) => syncPlayback(visible));
  const unrevive = onAudioRevive(() => {
    music = null;
    if (!closed) syncPlayback();
  });

  function persist(next: MusicSettings) {
    settings = next;
    saveMusicSettings(settings);
    syncPlayback();
  }

  return {
    level() {
      return settings.level;
    },
    setLevel(level) {
      persist({ ...settings, level: clampLevel(level) });
    },
    sfxLevel() {
      return settings.sfxLevel;
    },
    setSfxLevel(level) {
      persist({ ...settings, sfxLevel: clampLevel(level, DEFAULT_SFX_LEVEL) });
    },
    sfxVolume() {
      return volumeForLevel(settings.sfxLevel);
    },
    dispose() {
      closed = true;
      unwatch();
      unrevive();
      drop();
    },
  };
}
