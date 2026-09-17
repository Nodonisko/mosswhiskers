import { createEndingSequence, ENDING_PROMPT_DESKTOP, ENDING_PROMPT_MOBILE, shouldStartEnding } from "./ending";
import type { PlayerSim } from "./sim";

export function createEndingHud(root: HTMLElement) {
  const hud = root.querySelector<HTMLElement>(".ending-hud");
  const line = root.querySelector<HTMLElement>(".ending-line");
  const prompt = root.querySelector<HTMLElement>(".ending-prompt");
  if (!hud || !line || !prompt) throw new Error("Ending HUD markup is missing");
  const endingHud: HTMLElement = hud;
  const endingLine: HTMLElement = line;
  const endingPrompt: HTMLElement = prompt;

  const sequence = createEndingSequence();
  let sawVictoryTalk = false;
  let played = false;

  function promptCopy() {
    return root.classList.contains("has-touch-controls")
      ? ENDING_PROMPT_MOBILE
      : ENDING_PROMPT_DESKTOP;
  }

  function paint() {
    const view = sequence.view();
    endingHud.hidden = !view.visible;
    endingHud.setAttribute("aria-hidden", view.visible ? "false" : "true");
    endingHud.classList.toggle("is-on", view.visible);
    endingHud.style.opacity = String(view.overlay);
    endingLine.textContent = view.line;
    endingLine.style.opacity = String(view.lineOpacity);
    endingPrompt.textContent = promptCopy();
    endingPrompt.style.opacity = String(view.promptOpacity);
  }

  function play() {
    played = true;
    sequence.start();
    paint();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!sequence.blocking()) return;
    if (event.key !== " " && event.code !== "Space") return;
    event.preventDefault();
    if (event.repeat) return;
    sequence.tryDismiss();
  }

  function onPointerDown(event: PointerEvent) {
    if (!sequence.blocking() || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("a")) return;
    event.preventDefault();
    sequence.tryDismiss();
  }

  window.addEventListener("keydown", onKeyDown);
  endingHud.addEventListener("pointerdown", onPointerDown);
  endingHud.addEventListener("play-ending", play);
  paint();

  return {
    play,
    blocking() {
      return sequence.blocking();
    },
    tick(dt: number) {
      sequence.tick(dt);
      paint();
    },
    sync(player: PlayerSim | undefined) {
      const onVictoryTalk = player?.talkId === "bernie-victory";
      if (shouldStartEnding(onVictoryTalk, sawVictoryTalk, played)) {
        play();
      }
      sawVictoryTalk = onVictoryTalk;
      paint();
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      endingHud.removeEventListener("pointerdown", onPointerDown);
      endingHud.removeEventListener("play-ending", play);
    },
  };
}
