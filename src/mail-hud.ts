import { canStuffIntake, type PlayerSim } from "./sim";
import { interactButtonLabel } from "./touch-hud";

export function interactPromptCopy(
  nearbyId: string | null | undefined,
  stuffing: boolean,
  touch: boolean,
) {
  if (nearbyId === "mailbox") return touch ? "USE · READ MAIL" : "E · READ MAIL";
  if (stuffing) return touch ? "USE · INSERT CARROT" : "Press E to insert carrot";
  if (touch) return interactButtonLabel(nearbyId);
  return "E · TALK";
}

export function shouldShowInteractPrompt(
  nearbyId: string | null | undefined,
  openId: string | null | undefined,
  copy: string,
  touch: boolean,
) {
  if (!nearbyId || openId) return false;
  if (touch && copy === "TALK") return false;
  return true;
}

export function createMailHud(root: HTMLElement) {
  const prompt = root.querySelector<HTMLElement>(".interact-prompt");
  const letter = root.querySelector<HTMLElement>(".letter-hud");
  const closeBtn = letter?.querySelector<HTMLButtonElement>(".sheet-close");
  if (!prompt || !letter || !closeBtn) throw new Error("Mail HUD markup is missing");
  const interactPrompt: HTMLElement = prompt;
  const letterHud: HTMLElement = letter;
  const close: HTMLButtonElement = closeBtn;

  let open = false;
  let dismissQueued = false;

  function queueDismiss() {
    if (!open) return;
    dismissQueued = true;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    queueDismiss();
  }

  function onCloseDown(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    close.blur();
    queueDismiss();
  }

  function ignoreSpace(event: KeyboardEvent) {
    if (event.key === " " || event.code === "Space") event.preventDefault();
  }

  function onCloseClick(event: MouseEvent) {
    event.preventDefault();
  }

  window.addEventListener("keydown", onKeyDown);
  close.addEventListener("pointerdown", onCloseDown);
  close.addEventListener("click", onCloseClick);
  close.addEventListener("keydown", ignoreSpace);

  return {
    consumeDismiss() {
      const next = dismissQueued;
      dismissQueued = false;
      return next;
    },
    sync(player: PlayerSim | undefined) {
      const nearby = player?.nearbyId;
      const openId = player?.openId;
      open = openId === "mailbox";
      const stuffing = nearby === "intake" && player != null && canStuffIntake(player);
      const touch = root.classList.contains("has-touch-controls");
      const copy = interactPromptCopy(nearby, stuffing, touch);
      interactPrompt.textContent = copy;
      interactPrompt.classList.toggle("intake-hint", stuffing);
      interactPrompt.hidden = !shouldShowInteractPrompt(nearby, openId, copy, touch);
      letterHud.hidden = !open;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      close.removeEventListener("pointerdown", onCloseDown);
      close.removeEventListener("click", onCloseClick);
      close.removeEventListener("keydown", ignoreSpace);
    },
  };
}
