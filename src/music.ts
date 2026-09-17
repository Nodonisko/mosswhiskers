import { bindMediaElement, clearMediaSession, releaseMediaElement } from "./html-audio";
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

export type GameAudioSessionType = "playback" | "ambient";

export function audioSessionType(visible: boolean, level: number): GameAudioSessionType {
  return shouldPlayMusic(visible, level) ? "playback" : "ambient";
}

type NavigatorAudioSession = {
  type: "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record";
};

function setAudioSession(type: GameAudioSessionType) {
  const session = (navigator as Navigator & { audioSession?: NavigatorAudioSession }).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    // Safari can reject a type if another API holds the session.
  }
}

const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;

function createMusicElement() {
  const audio = new Audio();
  audio.loop = true;
  audio.preload = "auto";
  audio.hidden = true;
  audio.setAttribute("aria-hidden", "true");
  audio.disableRemotePlayback = true;
  return audio;
}

export function createBackgroundMusic(src = "/assets/background.mp3"): BackgroundMusic {
  let audio = createMusicElement();
  let settings = loadMusicSettings();
  let waitingForGesture = false;
  let closed = false;

  function listenUnlock(on: boolean) {
    for (const type of UNLOCK_EVENTS) {
      if (on) window.addEventListener(type, unlock);
      else window.removeEventListener(type, unlock);
    }
  }

  function armUnlock() {
    if (waitingForGesture || closed) return;
    waitingForGesture = true;
    listenUnlock(true);
  }

  function discard() {
    releaseMediaElement(audio);
    audio.remove();
    audio = createMusicElement();
    setAudioSession("ambient");
    clearMediaSession();
  }

  function unlock() {
    waitingForGesture = false;
    listenUnlock(false);
    if (closed) return;
    syncPlayback();
  }

  function syncPlayback() {
    if (closed) return;
    const level = settings.level;
    audio.volume = volumeForLevel(level);
    audio.muted = level === 1;
    if (!shouldPlayMusic(isPageVisible(), level)) {
      discard();
      return;
    }
    setAudioSession("playback");
    bindMediaElement(audio, src);
    void audio.play().catch(armUnlock);
  }

  armUnlock();
  syncPlayback();
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
      listenUnlock(false);
      discard();
    },
  };
}
