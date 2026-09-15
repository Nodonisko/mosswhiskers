import { joystickFromOffset, type MoveInput } from "./input";
import type { PlayerSim } from "./sim";

const NPC_NEARBY = new Set(["bernie", "sam", "rabbit"]);

export function interactButtonLabel(nearbyId: string | null | undefined) {
  return nearbyId != null && NPC_NEARBY.has(nearbyId) ? "TALK" : "USE";
}

const TOUCH_QUERY = "(pointer: coarse), (hover: none)";

type FullscreenHost = HTMLElement & {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone)
    || window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches;
}

function canRequestFullscreen() {
  const el = document.documentElement as FullscreenHost;
  return typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function";
}

function isFullscreen() {
  const doc = document as FullscreenDocument;
  return Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
}

function requestTheater() {
  const el = document.documentElement as FullscreenHost;
  try {
    if (typeof el.requestFullscreen === "function") void el.requestFullscreen();
    else el.webkitRequestFullscreen?.();
  } catch {
    // iPhone Safari has no Fullscreen API; Android may still deny this.
  }
}

export function createTouchHud(root: HTMLElement) {
  const hud = root.querySelector<HTMLElement>(".touch-hud");
  const pad = root.querySelector<HTMLElement>(".touch-joystick");
  const base = root.querySelector<HTMLElement>(".touch-joystick-base");
  const knob = root.querySelector<HTMLElement>(".touch-joystick-knob");
  const interactBtn = root.querySelector<HTMLButtonElement>(".touch-interact");
  const clawBtn = root.querySelector<HTMLButtonElement>(".touch-claw");
  const fullscreenBtn = root.querySelector<HTMLButtonElement>(".fullscreen-btn");
  const controlsHint = root.querySelector<HTMLElement>(".controls");
  if (!hud || !pad || !base || !knob || !interactBtn || !clawBtn || !fullscreenBtn || !controlsHint) {
    throw new Error("Touch HUD markup is missing");
  }
  const touchHud: HTMLElement = hud;
  const stickPad: HTMLElement = pad;
  const stickBase: HTMLElement = base;
  const stickKnob: HTMLElement = knob;
  const interact: HTMLButtonElement = interactBtn;
  const claw: HTMLButtonElement = clawBtn;
  const fullBtn: HTMLButtonElement = fullscreenBtn;
  const controls: HTMLElement = controlsHint;

  let move: MoveInput = { x: 0, y: 0 };
  let clawQueued = false;
  let interactQueued = false;
  let stickPointer: number | null = null;
  let touchUnlocked = false;
  const media = window.matchMedia(TOUCH_QUERY);

  function isMobile() {
    return touchUnlocked || media.matches;
  }

  function paintInteract(nearbyId: string | null | undefined) {
    const label = interactButtonLabel(nearbyId);
    if (interact.textContent === label) return;
    interact.textContent = label;
    interact.setAttribute("aria-label", label === "TALK" ? "Talk" : "Use");
  }

  function syncChrome() {
    const on = isMobile();
    touchHud.hidden = !on;
    touchHud.setAttribute("aria-hidden", on ? "false" : "true");
    root.classList.toggle("has-touch-controls", on);
    const showFull = on && !isStandalone() && canRequestFullscreen() && !isFullscreen();
    fullBtn.hidden = !showFull;
    controls.hidden = on;
  }

  function onStickMove(event: PointerEvent) {
    if (event.pointerId !== stickPointer) return;
    event.preventDefault();
    steer(event.clientX, event.clientY);
  }

  function onStickUp(event: PointerEvent) {
    if (event.pointerId !== stickPointer) return;
    resetStick();
  }

  function listenWindow(on: boolean) {
    if (on) {
      window.addEventListener("pointermove", onStickMove, { passive: false });
      window.addEventListener("pointerup", onStickUp);
      window.addEventListener("pointercancel", onStickUp);
      return;
    }
    window.removeEventListener("pointermove", onStickMove);
    window.removeEventListener("pointerup", onStickUp);
    window.removeEventListener("pointercancel", onStickUp);
  }

  function resetStick() {
    if (stickPointer != null) listenWindow(false);
    stickPointer = null;
    move = { x: 0, y: 0 };
    stickPad.classList.remove("is-active");
    stickKnob.style.transform = "";
  }

  function steer(clientX: number, clientY: number) {
    const rect = stickBase.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const radius = Math.min(rect.width, rect.height) / 2;
    move = joystickFromOffset(dx, dy, radius);
    const length = Math.hypot(dx, dy);
    const scale = length > radius ? radius / length : 1;
    stickKnob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  }

  function onStickDown(event: PointerEvent) {
    if (stickPointer != null || event.button !== 0) return;
    event.preventDefault();
    stickPointer = event.pointerId;
    stickPad.classList.add("is-active");
    listenWindow(true);
    steer(event.clientX, event.clientY);
  }

  function queueAction(event: PointerEvent, kind: "claw" | "interact") {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLButtonElement).blur();
    if (kind === "claw") clawQueued = true;
    else interactQueued = true;
  }

  function ignoreSpace(event: KeyboardEvent) {
    if (event.key === " " || event.code === "Space") event.preventDefault();
  }

  function onTouchUnlock() {
    touchUnlocked = true;
    syncChrome();
  }

  function onFullscreenTap(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    requestTheater();
  }

  function onContextMenu(event: Event) {
    event.preventDefault();
  }

  const onInteractDown = (event: PointerEvent) => queueAction(event, "interact");
  const onClawDown = (event: PointerEvent) => queueAction(event, "claw");

  stickPad.addEventListener("pointerdown", onStickDown);
  interact.addEventListener("pointerdown", onInteractDown);
  claw.addEventListener("pointerdown", onClawDown);
  interact.addEventListener("keydown", ignoreSpace);
  claw.addEventListener("keydown", ignoreSpace);
  fullBtn.addEventListener("pointerdown", onFullscreenTap);
  touchHud.addEventListener("contextmenu", onContextMenu);
  media.addEventListener("change", syncChrome);
  document.addEventListener("fullscreenchange", syncChrome);
  document.addEventListener("webkitfullscreenchange", syncChrome as EventListener);
  window.addEventListener("touchstart", onTouchUnlock, { passive: true });
  window.addEventListener("blur", resetStick);
  syncChrome();

  paintInteract(null);

  return {
    sample() {
      const nextClaw = clawQueued;
      const nextInteract = interactQueued;
      clawQueued = false;
      interactQueued = false;
      return { ...move, claw: nextClaw, interact: nextInteract };
    },
    sync(player: PlayerSim | undefined) {
      paintInteract(player?.nearbyId);
    },
    dispose() {
      stickPad.removeEventListener("pointerdown", onStickDown);
      interact.removeEventListener("pointerdown", onInteractDown);
      claw.removeEventListener("pointerdown", onClawDown);
      interact.removeEventListener("keydown", ignoreSpace);
      claw.removeEventListener("keydown", ignoreSpace);
      fullBtn.removeEventListener("pointerdown", onFullscreenTap);
      touchHud.removeEventListener("contextmenu", onContextMenu);
      media.removeEventListener("change", syncChrome);
      document.removeEventListener("fullscreenchange", syncChrome);
      document.removeEventListener("webkitfullscreenchange", syncChrome as EventListener);
      window.removeEventListener("touchstart", onTouchUnlock);
      window.removeEventListener("blur", resetStick);
      resetStick();
      root.classList.remove("has-touch-controls");
    },
  };
}
