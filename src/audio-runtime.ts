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

export function resumeHowlerContext() {
  const ctx = Howler.ctx;
  if (ctx && ctx.state !== "running") void ctx.resume();
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

type VisibleListener = (visible: boolean) => void;

const listeners = new Set<VisibleListener>();
let unwatch: (() => void) | null = null;

function applyVisible(visible: boolean) {
  Howler.mute(!visible);
  setAudioSession(audioSessionType(visible));
  if (visible) resumeHowlerContext();
  else clearMediaSession();
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
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && unwatch) {
      unwatch();
      unwatch = null;
      Howler.mute(false);
      setAudioSession("ambient");
    }
  };
}
