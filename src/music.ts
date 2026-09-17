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

const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;

function createAudioContext() {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctor();
}

function primeContext(context: AudioContext) {
  const osc = context.createOscillator();
  const silent = context.createGain();
  silent.gain.value = 0;
  osc.connect(silent);
  silent.connect(context.destination);
  osc.start();
  osc.stop(context.currentTime + 0.05);
}

export function createBackgroundMusic(src = "/assets/background.mp3"): BackgroundMusic {
  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;

  let settings = loadMusicSettings();
  let fileBytes: ArrayBuffer | null = null;
  let buffer: AudioBuffer | null = null;
  let source: AudioBufferSourceNode | null = null;
  let waitingForGesture = false;
  let closed = false;
  let loadId = 0;
  let inflightDecode: Promise<void> | null = null;

  void fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error("music missing");
      return response.arrayBuffer();
    })
    .then((data) => {
      fileBytes = data;
    })
    .catch(() => {});

  function applyGain() {
    if (!gain) return;
    gain.gain.value = volumeForLevel(settings.level);
  }

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

  function ensureContext() {
    if (ctx && ctx.state !== "closed") return ctx;
    ctx = createAudioContext();
    gain = ctx.createGain();
    gain.connect(ctx.destination);
    applyGain();
    return ctx;
  }

  function decodeIntoContext() {
    if (!ctx || buffer) return Promise.resolve();
    if (inflightDecode) return inflightDecode;
    const id = loadId;
    const audioCtx = ctx;
    inflightDecode = (fileBytes
      ? Promise.resolve(fileBytes)
      : fetch(src).then((response) => {
          if (!response.ok) throw new Error("music missing");
          return response.arrayBuffer();
        }))
      .then((data) => {
        fileBytes = data;
        if (id !== loadId || closed || ctx !== audioCtx) return null;
        return decodeAudioBuffer(audioCtx, data);
      })
      .then((decoded) => {
        if (!decoded || id !== loadId || closed || ctx !== audioCtx) return;
        buffer = decoded;
      })
      .catch(() => {
        if (id === loadId) buffer = null;
      })
      .finally(() => {
        inflightDecode = null;
      });
    return inflightDecode;
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
    if (!ctx || !gain || !buffer || closed || source) return;
    if (!canStartBufferSource(ctx.state)) return;
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
  }

  function rebuildContext() {
    loadId += 1;
    inflightDecode = null;
    stopSource();
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
    ctx = null;
    gain = null;
    buffer = null;
  }

  function resumeContext() {
    const audioCtx = ensureContext();
    if (audioCtx.state === "interrupted" || audioCtx.state === "suspended") return audioCtx.resume();
    return Promise.resolve();
  }

  function unlock() {
    waitingForGesture = false;
    listenUnlock(false);
    if (closed) return;
    setAudioSession("playback");
    const audioCtx = ensureContext();
    primeContext(audioCtx);
    void resumeContext()
      .then(() => decodeIntoContext())
      .then(() => {
        syncPlayback();
        if (!ctx || !canStartBufferSource(ctx.state) || !source) armUnlock();
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
      if (ctx && canStartBufferSource(ctx.state)) void ctx.suspend().catch(() => {});
      setAudioSession("ambient");
      clearMediaSession();
      return;
    }
    if (!ctx) {
      armUnlock();
      return;
    }
    setAudioSession("playback");
    if (!canStartBufferSource(ctx.state)) {
      void resumeContext()
        .then(() => decodeIntoContext())
        .then(() => {
          if (ctx && canStartBufferSource(ctx.state)) startSource();
          else armUnlock();
        })
        .catch(armUnlock);
      return;
    }
    if (!buffer) {
      void decodeIntoContext().then(() => startSource());
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
      listenUnlock(false);
      stopSource();
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
      setAudioSession("ambient");
      clearMediaSession();
    },
  };
}
