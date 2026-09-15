import type { PlayerSim } from "./sim";

export function createMailHud(root: HTMLElement) {
  const prompt = root.querySelector<HTMLElement>(".interact-prompt");
  const letter = root.querySelector<HTMLElement>(".letter-hud");
  if (!prompt || !letter) throw new Error("Mail HUD markup is missing");
  const interactPrompt: HTMLElement = prompt;
  const letterHud: HTMLElement = letter;

  let open = false;
  let dismissQueued = false;

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    dismissQueued = true;
  }

  window.addEventListener("keydown", onKeyDown);

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
      interactPrompt.textContent = nearby === "bernie" ? "E · TALK" : "E · READ MAIL";
      interactPrompt.hidden = !nearby || Boolean(openId);
      letterHud.hidden = !open;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
