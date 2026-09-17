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

export type GameAudioSessionType = "playback" | "ambient";

export function audioSessionType(visible: boolean, level: number): GameAudioSessionType {
  return shouldPlayMusic(visible, level) ? "playback" : "ambient";
}

export function canStartBufferSource(state: string) {
  return state === "running";
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

function decodeAudioBuffer(context: AudioContext, data: ArrayBuffer) {
  const copy = data.slice(0);
  return new Promise<AudioBuffer>((resolve, reject) => {
    let settled = false;
    const ok = (buf: AudioBuffer) => {
      if (settled) return;
      settled = true;
      resolve(buf);
    };
    const fail = (err?: unknown) => {
      if (settled) return;
      settled = true;
      reject(err ?? new Error("decode failed"));
    };
    try {
      const result = context.decodeAudioData(copy, ok, fail);
      if (result && typeof result.then === "function") void result.then(ok, fail);
    } catch (err) {
      fail(err);
    }
  });
}

function createAudioContext() {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctor();
}

export function createBackgroundMusic(src = "/assets/background.mp3"): BackgroundMusic {
  let ctx = createAudioContext();
  let gain = ctx.createGain();
  gain.connect(ctx.destination);

  let settings = loadMusicSettings();
  let fileBytes: ArrayBuffer | null = null;
  let buffer: AudioBuffer | null = null;
  let source: AudioBufferSourceNode | null = null;
  let waitingForGesture = false;
  let closed = false;
  let loading = false;
  let loadId = 0;

  applyGain();
  void loadBuffer();

  function applyGain() {
    gain.gain.value = volumeForLevel(settings.level);
  }

  function loadBuffer() {
    if (loading || closed) return;
    loading = true;
    const id = loadId;
    const request = fileBytes
      ? Promise.resolve(fileBytes)
      : fetch(src).then((response) => {
          if (!response.ok) throw new Error("music missing");
          return response.arrayBuffer();
        });
    void request
      .then((data) => {
        fileBytes = data;
        if (id !== loadId || closed) return null;
        return decodeAudioBuffer(ctx, data);
      })
      .then((decoded) => {
        loading = false;
        if (!decoded || id !== loadId || closed) return;
        buffer = decoded;
        syncPlayback();
      })
      .catch(() => {
        loading = false;
        if (id === loadId) buffer = null;
      });
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
    if (!buffer || closed || source) return;
    if (!canStartBufferSource(ctx.state)) return;
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
  }

  function contextAlive() {
    return ctx.state !== "closed";
  }

  function rebuildContext() {
    loadId += 1;
    loading = false;
    stopSource();
    if (contextAlive()) void ctx.close().catch(() => {});
    ctx = createAudioContext();
    gain = ctx.createGain();
    gain.connect(ctx.destination);
    buffer = null;
    applyGain();
    loadBuffer();
  }

  function armUnlock() {
    if (waitingForGesture || closed) return;
    waitingForGesture = true;
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }

  function resumeContext() {
    if (!contextAlive()) {
      rebuildContext();
      return ctx.resume();
    }
    if (ctx.state === "interrupted") return ctx.resume();
    if (ctx.state === "suspended") return ctx.resume();
    return Promise.resolve();
  }

  function unlock() {
    waitingForGesture = false;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    if (closed) return;
    setAudioSession("playback");
    void resumeContext()
      .then(() => {
        if (ctx.state === "closed") {
          rebuildContext();
          armUnlock();
          return;
        }
        syncPlayback();
        if (!canStartBufferSource(ctx.state)) armUnlock();
      })
      .catch(() => {
        rebuildContext();
        armUnlock();
      });
  }

  function syncPlayback() {
    if (closed) return;
    applyGain();
    const want = shouldPlayMusic(isPageVisible(), settings.level);
    if (!want) {
      stopSource();
      if (canStartBufferSource(ctx.state)) void ctx.suspend().catch(() => {});
      setAudioSession("ambient");
      clearMediaSession();
      return;
    }
    setAudioSession("playback");
    if (!canStartBufferSource(ctx.state)) {
      void resumeContext()
        .then(() => {
          if (canStartBufferSource(ctx.state)) startSource();
          else armUnlock();
        })
        .catch(armUnlock);
      return;
    }
    startSource();
  }

  armUnlock();
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
      setAudioSession("ambient");
      clearMediaSession();
    },
  };
}
