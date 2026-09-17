import { clearMediaSession } from "./html-audio";
import { isPageVisible, watchPageVisible } from "./page-visible";

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

function createAudioContext() {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctor();
}

export function createBackgroundMusic(src = "/assets/background.mp3"): BackgroundMusic {
  const ctx = createAudioContext();
  const gain = ctx.createGain();
  gain.connect(ctx.destination);

  let settings = loadMusicSettings();
  let buffer: AudioBuffer | null = null;
  let source: AudioBufferSourceNode | null = null;
  let waitingForGesture = false;
  let closed = false;

  applyGain();

  void fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error("music missing");
      return response.arrayBuffer();
    })
    .then((data) => ctx.decodeAudioData(data.slice(0)))
    .then((decoded) => {
      buffer = decoded;
      syncPlayback();
    })
    .catch(() => {});

  function applyGain() {
    gain.gain.value = volumeForLevel(settings.level);
  }

  function stopSource() {
    if (!source) return;
    try {
      source.stop();
    } catch {
      // Already stopped.
    }
    source.disconnect();
    source = null;
  }

  function startSource() {
    if (!buffer || source || closed) return;
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
  }

  function armUnlock() {
    if (waitingForGesture || closed) return;
    waitingForGesture = true;
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }

  function unlock() {
    waitingForGesture = false;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    if (closed) return;
    void ctx.resume().then(syncPlayback).catch(armUnlock);
  }

  function syncPlayback() {
    if (closed) return;
    applyGain();
    const want = shouldPlayMusic(isPageVisible(), settings.level);
    if (want) {
      startSource();
      if (ctx.state !== "running") {
        void ctx.resume().then(() => {
          if (ctx.state !== "running") armUnlock();
        }).catch(armUnlock);
      }
      return;
    }
    stopSource();
    if (ctx.state === "running") void ctx.suspend();
    clearMediaSession();
  }

  void ctx.resume().then(() => {
    if (ctx.state === "running") syncPlayback();
    else armUnlock();
  }).catch(armUnlock);

  const unwatch = watchPageVisible(() => syncPlayback());

  function persist(next: MusicSettings) {
    settings = next;
    saveMusicSettings(settings);
    unlock();
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
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      stopSource();
      void ctx.close();
      clearMediaSession();
    },
  };
}
