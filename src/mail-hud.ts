import { canStuffIntake, type PlayerSim } from "./sim";

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
      interactPrompt.textContent = nearby === "mailbox"
        ? "E · READ MAIL"
        : stuffing
          ? "Press E to insert carrot"
          : "E · TALK";
      interactPrompt.classList.toggle("intake-hint", stuffing);
      interactPrompt.hidden = !nearby || Boolean(openId);
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
