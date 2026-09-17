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

/** Drop the file so iOS/Android dismiss Now Playing instead of leaving a paused tile. */
export function releaseMediaElement(audio: HTMLAudioElement) {
  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    // Empty elements can throw.
  }
  audio.removeAttribute("src");
  try {
    audio.srcObject = null;
  } catch {
    // Older WebKit.
  }
  audio.load();
}

export function bindMediaElement(audio: HTMLAudioElement, src: string) {
  if (audio.getAttribute("src") !== src) audio.src = src;
}
