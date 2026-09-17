import { Howler } from "howler";
import { isPageVisible, watchPageVisible } from "./page-visible";

Howler.autoUnlock = true;
Howler.autoSuspend = false;

export type GameAudioSessionType = "playback" | "ambient";

export function audioSessionType(visible: boolean): GameAudioSessionType {
  return visible ? "playback" : "ambient";
}

type NavigatorAudioSession = {
  type: "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record";
};

export function setAudioSession(type: GameAudioSessionType) {
  const session = (navigator as Navigator & { audioSession?: NavigatorAudioSession }).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    // Safari can reject a type if another API holds the session.
  }
}

export function clearMediaSession() {
  const session = navigator.mediaSession;
  if (!session) return;
  try {
    session.metadata = null;
    session.playbackState = "none";
  } catch {
    // Safari can throw if the session is already idle.
  }
}

const UNLOCK_EVENTS = ["pointerdown", "touchstart", "touchend", "click", "keydown"] as const;

type VisibleListener = (visible: boolean) => void;

const listeners = new Set<VisibleListener>();
const revivers = new Set<() => void>();
let unwatch: (() => void) | null = null;
let waitingForGesture = false;
let ctxWatch: AudioContext | null = null;
let reviving = false;
/** iOS can keep ctx.state at "running" after background while Web Audio is silent. */
let audioGraphStale = false;

export function onAudioRevive(fn: () => void) {
  revivers.add(fn);
  return () => revivers.delete(fn);
}

function listenUnlock(on: boolean) {
  for (const type of UNLOCK_EVENTS) {
    if (on) window.addEventListener(type, unlock, true);
    else window.removeEventListener(type, unlock, true);
  }
}

function armUnlock() {
  if (waitingForGesture) return;
  waitingForGesture = true;
  listenUnlock(true);
}

export function webAudioIsRunning(state: string | undefined) {
  return state === "running";
}

export function webAudioReadyForSfx() {
  return !audioGraphStale && webAudioIsRunning(Howler.ctx?.state as string | undefined);
}

function contextState() {
  return Howler.ctx?.state as string | undefined;
}

type HowlEmitter = { _emit?: (event: string) => void; _html5?: boolean };
type HowlerResumeApi = {
  state?: string;
  _howls?: HowlEmitter[];
  _audioUnlocked?: boolean;
  _unlockAudio?: () => void;
};

function howlerResumeApi() {
  return Howler as typeof Howler & HowlerResumeApi;
}

/** HTML audio ignores masterGain; SFX do not. Re-apply gain after iOS interrupts the context. */
function unmuteHowler() {
  Howler.mute(false);
  const ctx = Howler.ctx;
  const gain = Howler.masterGain?.gain;
  if (!ctx || !gain || !webAudioIsRunning(ctx.state)) return;
  const volume = Howler.volume();
  try {
    gain.cancelScheduledValues(ctx.currentTime);
    gain.setValueAtTime(volume, ctx.currentTime);
  } catch {
    // Interrupted contexts can reject AudioParam updates.
  }
  gain.value = volume;
}

function markHowlerRunning() {
  const api = howlerResumeApi();
  api.state = "running";
  unmuteHowler();
  for (const howl of api._howls ?? []) howl._emit?.("resume");
}

function watchContext() {
  const ctx = Howler.ctx;
  if (!ctx || ctx === ctxWatch) return;
  ctxWatch?.removeEventListener("statechange", onContextState);
  ctxWatch = ctx;
  ctx.addEventListener("statechange", onContextState);
}

function onContextState() {
  if (!isPageVisible()) return;
  if (audioGraphStale || !webAudioIsRunning(contextState())) armUnlock();
  if (!audioGraphStale) void resumeHowlerContext();
}

function reviveDeadContext() {
  if (reviving) return;
  reviving = true;
  try {
    ctxWatch?.removeEventListener("statechange", onContextState);
    ctxWatch = null;
    const api = howlerResumeApi();
    const html5 = (api._howls ?? []).filter((howl) => howl._html5);
    for (const howl of html5) {
      const index = api._howls?.indexOf(howl) ?? -1;
      if (index >= 0) api._howls?.splice(index, 1);
    }
    try {
      Howler.unload();
    } catch {
      try {
        Howler.ctx?.close();
      } catch {
        // Zombie contexts can reject close().
      }
      (Howler as unknown as { ctx: AudioContext | null }).ctx = null;
    }
    api._howls = [...(api._howls ?? []), ...html5];
    api._audioUnlocked = false;
    Howler.autoUnlock = true;
    Howler.autoSuspend = false;
    api._unlockAudio?.();
    Howler.mute(false);
    for (const fn of revivers) fn();
    watchContext();
  } finally {
    reviving = false;
  }
}

export function resumeHowlerContext() {
  watchContext();
  const ctx = Howler.ctx;
  if (!ctx) return Promise.resolve();
  if (audioGraphStale) {
    armUnlock();
    return Promise.resolve();
  }
  if (webAudioIsRunning(ctx.state)) {
    markHowlerRunning();
    return Promise.resolve();
  }
  if (ctx.state === "closed") {
    reviveDeadContext();
    return Promise.resolve();
  }
  return ctx.resume().then(() => {
    if (contextState() === "closed") reviveDeadContext();
    else if (webAudioIsRunning(contextState())) markHowlerRunning();
    else armUnlock();
  }).catch(() => {
    if (contextState() === "closed") reviveDeadContext();
    else armUnlock();
  });
}

function playUnlockBuffer() {
  const ctx = Howler.ctx;
  if (!ctx) return;
  try {
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Closed or not-yet-running contexts can reject start().
  }
}

function unlock() {
  waitingForGesture = false;
  listenUnlock(false);
  if (!isPageVisible()) {
    armUnlock();
    return;
  }
  setAudioSession("playback");
  if (audioGraphStale) {
    audioGraphStale = false;
    reviveDeadContext();
  }
  playUnlockBuffer();
  const ctx = Howler.ctx;
  if (ctx && ctx.state !== "closed") {
    try {
      void ctx.resume();
    } catch {
      armUnlock();
    }
  }
  void resumeHowlerContext().then(() => {
    if (!isPageVisible()) return;
    if (!webAudioIsRunning(contextState())) {
      armUnlock();
      return;
    }
    markHowlerRunning();
    for (const listener of listeners) listener(true);
  });
}

function applyVisible(visible: boolean) {
  if (visible) {
    setAudioSession("playback");
    Howler.mute(false);
    if (!audioGraphStale) {
      void resumeHowlerContext().then(() => {
        if (isPageVisible() && webAudioIsRunning(contextState())) markHowlerRunning();
      });
    }
    armUnlock();
  } else {
    audioGraphStale = true;
    Howler.mute(true);
    setAudioSession("ambient");
    clearMediaSession();
    armUnlock();
  }
  for (const listener of listeners) listener(visible);
}

/** Mute on hide, claim a playback session while visible, resume a suspended context. */
export function watchGameAudio(onChange: VisibleListener) {
  if (!unwatch) {
    unwatch = watchPageVisible(applyVisible);
    applyVisible(isPageVisible());
  }
  listeners.add(onChange);
  onChange(isPageVisible());
  watchContext();
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && unwatch) {
      unwatch();
      unwatch = null;
      listenUnlock(false);
      waitingForGesture = false;
      audioGraphStale = false;
      ctxWatch?.removeEventListener("statechange", onContextState);
      ctxWatch = null;
      Howler.mute(false);
      setAudioSession("ambient");
    }
  };
}
