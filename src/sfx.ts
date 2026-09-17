import { isPageVisible, watchPageVisible } from "./page-visible";

export const CLAW_SOUNDS = [
  "/assets/sounds/claw1.mp3",
  "/assets/sounds/claw2.mp3",
] as const;

export const MEOW_SOUNDS = [
  "/assets/sounds/meow1.mp3",
  "/assets/sounds/meow2.mp3",
  "/assets/sounds/meow3.mp3",
  "/assets/sounds/meow4.mp3",
  "/assets/sounds/meow5.mp3",
  "/assets/sounds/meow6.mp3",
] as const;

export const HISS_SOUND = "/assets/sounds/hiss.mp3";
export const MOUSE_SOUND = "/assets/sounds/mouse_squeek.mp3";
export const SPLASH_SOUND = "/assets/sounds/water_splash.mp3";
export const GULP_SOUND = "/assets/sounds/gulp.mp3";
export const GULP_FULL_RANGE = 240;
export const GULP_FADE_RANGE = 640;
/** South of the intake counts farther, so the path up from the woods is quieter. */
export const GULP_SOUTH_STRETCH = 1.55;
export const FIRE_SOUND = "/assets/sounds/fire_craking.mp3";
export const FIRE_FULL_RANGE = 280;
export const FIRE_FADE_RANGE = 720;
export const BEEP_SOUND = "/assets/sounds/computer_beeping.mp3";
export const BEEP_FULL_RANGE = 100;
export const BEEP_FADE_RANGE = 240;
export const ROCKET_SOUND = "/assets/sounds/rocket_launch.mp3";
export const ROCKET_SOUND_SKIP = 1.5;
export const ROCKET_SOUND_DELAY = 0.5;

export type SfxPlayer = {
  playClaw(): void;
  playMeow(): void;
  playHiss(): void;
  playMouse(): void;
  playSplash(): void;
  playRocket(): void;
  syncGulp(state: { gulpIndex: number; clogged: boolean; distance: number }): void;
  syncFire(state: { burning: boolean; distance: number }): void;
  syncBeep(state: { humming: boolean; distance: number }): void;
  dispose(): void;
};

export function pickRandom<T>(items: readonly T[], random = Math.random) {
  const index = Math.min(items.length - 1, Math.max(0, Math.floor(random() * items.length)));
  return items[index]!;
}

export function proximityGain(distance: number, fullRange: number, fadeRange: number) {
  if (distance <= fullRange) return 1;
  if (distance >= fadeRange) return 0;
  return 1 - (distance - fullRange) / (fadeRange - fullRange);
}

export function gulpDistance(dx: number, dy: number) {
  const south = dy < 0 ? dy * GULP_SOUTH_STRETCH : dy;
  return Math.hypot(dx, south);
}

export function gulpProximity(distance: number) {
  return proximityGain(distance, GULP_FULL_RANGE, GULP_FADE_RANGE);
}

export function fireProximity(distance: number) {
  return proximityGain(distance, FIRE_FULL_RANGE, FIRE_FADE_RANGE);
}

export function beepProximity(distance: number) {
  return proximityGain(distance, BEEP_FULL_RANGE, BEEP_FADE_RANGE);
}

export function createSfxPlayer(getVolume: () => number): SfxPlayer {
  const sources = [...CLAW_SOUNDS, ...MEOW_SOUNDS, HISS_SOUND, MOUSE_SOUND, SPLASH_SOUND, GULP_SOUND, FIRE_SOUND, BEEP_SOUND, ROCKET_SOUND];
  for (const src of sources) {
    const preload = new Audio(src);
    preload.preload = "auto";
  }
  const live = new Set<HTMLAudioElement>();
  const gulp = new Audio(GULP_SOUND);
  gulp.preload = "auto";
  gulp.disableRemotePlayback = true;
  const fire = new Audio(FIRE_SOUND);
  fire.preload = "auto";
  fire.loop = true;
  fire.disableRemotePlayback = true;
  const beep = new Audio(BEEP_SOUND);
  beep.preload = "auto";
  beep.loop = true;
  beep.disableRemotePlayback = true;
  let lastGulpIndex = -1;

  function hush() {
    if (!gulp.paused) gulp.pause();
    if (!fire.paused) fire.pause();
    if (!beep.paused) beep.pause();
    for (const audio of live) {
      if (!audio.paused) audio.pause();
    }
  }

  function play(src: string, startAt = 0) {
    const volume = getVolume();
    if (volume <= 0 || !isPageVisible()) return;
    const audio = new Audio(src);
    audio.volume = volume;
    live.add(audio);
    const cleanup = () => {
      live.delete(audio);
      audio.removeAttribute("src");
      audio.load();
    };
    audio.addEventListener("ended", cleanup);
    audio.addEventListener("error", cleanup);
    const start = () => {
      if (startAt > 0) audio.currentTime = startAt;
      void audio.play().catch(cleanup);
    };
    if (startAt > 0 && audio.readyState < HTMLMediaElement.HAVE_METADATA) {
      audio.addEventListener("loadedmetadata", start, { once: true });
    } else {
      start();
    }
  }

  function loopAmbient(audio: HTMLAudioElement, gain: number) {
    audio.volume = Math.max(0, Math.min(1, getVolume() * gain));
    if (audio.volume <= 0 || !isPageVisible()) {
      if (!audio.paused) audio.pause();
      return;
    }
    if (audio.paused) void audio.play().catch(() => {});
  }

  const unwatch = watchPageVisible((visible) => {
    if (!visible) hush();
  });

  return {
    playClaw() {
      play(pickRandom(CLAW_SOUNDS));
    },
    playMeow() {
      play(pickRandom(MEOW_SOUNDS));
    },
    playHiss() {
      play(HISS_SOUND);
    },
    playMouse() {
      play(MOUSE_SOUND);
    },
    playSplash() {
      play(SPLASH_SOUND);
    },
    playRocket() {
      play(ROCKET_SOUND, ROCKET_SOUND_SKIP);
    },
    syncGulp({ gulpIndex, clogged, distance }) {
      const gain = clogged ? 0 : gulpProximity(distance);
      if (clogged && !gulp.paused) gulp.pause();
      gulp.volume = Math.max(0, Math.min(1, getVolume() * gain));
      if (lastGulpIndex < 0) {
        lastGulpIndex = gulpIndex;
        return;
      }
      if (gulpIndex === lastGulpIndex) return;
      lastGulpIndex = gulpIndex;
      if (clogged || gulp.volume <= 0 || !isPageVisible()) return;
      gulp.currentTime = 0;
      void gulp.play().catch(() => {});
    },
    syncFire({ burning, distance }) {
      loopAmbient(fire, burning ? fireProximity(distance) : 0);
    },
    syncBeep({ humming, distance }) {
      loopAmbient(beep, humming ? beepProximity(distance) : 0);
    },
    dispose() {
      unwatch();
      gulp.pause();
      gulp.removeAttribute("src");
      gulp.load();
      fire.pause();
      fire.removeAttribute("src");
      fire.load();
      beep.pause();
      beep.removeAttribute("src");
      beep.load();
      for (const audio of live) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      live.clear();
    },
  };
}
