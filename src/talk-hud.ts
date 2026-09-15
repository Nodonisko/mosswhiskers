import type { PlayerSim, TalkId } from "./sim";

type TalkCopy = {
  kicker: string;
  title: string;
  paragraphs: string[];
  objective: string;
};

const TALK: Record<TalkId, TalkCopy> = {
  "bernie-ask": {
    kicker: "Bernie Sandwhisker",
    title: "Mosswhisker",
    paragraphs: [
      "You came. Good. These trees have gone the color of old straw, and I cannot hunt a thing.",
    ],
    objective: "Bring me some fish and mice, would you? Anything the south woods still have.",
  },
  "bernie-thanks": {
    kicker: "Bernie Sandwhisker",
    title: "Mosswhisker",
    paragraphs: [
      "Bless your paws. That will keep me going.",
    ],
    objective: "Now this pond. It should not be drying. Something is wrong with the water. Would you look around and see why?",
  },
  "bernie-pond": {
    kicker: "Bernie Sandwhisker",
    title: "Mosswhisker",
    paragraphs: [
      "Still no luck with the pond? It shrinks a little every day.",
    ],
    objective: "Have a sniff around. Something is drinking it dry, or stopping the rain from finding it.",
  },
};

export function createTalkHud(root: HTMLElement) {
  const talk = root.querySelector<HTMLElement>(".talk-hud");
  const kicker = root.querySelector<HTMLElement>(".talk-kicker");
  const title = root.querySelector<HTMLElement>("#talk-title");
  const body = root.querySelector<HTMLElement>(".talk-body");
  if (!talk || !kicker || !title || !body) throw new Error("Talk HUD markup is missing");
  const talkHud: HTMLElement = talk;
  const talkKicker: HTMLElement = kicker;
  const talkTitle: HTMLElement = title;
  const talkBody: HTMLElement = body;

  let open = false;
  let shown: TalkId | null = null;
  let dismissQueued = false;

  function render(talkId: TalkId) {
    if (shown === talkId) return;
    shown = talkId;
    const copy = TALK[talkId];
    talkKicker.textContent = copy.kicker;
    talkTitle.textContent = copy.title;
    talkBody.replaceChildren();
    for (const line of copy.paragraphs) {
      const p = document.createElement("p");
      p.textContent = line;
      talkBody.append(p);
    }
    const objective = document.createElement("p");
    objective.className = "letter-objective";
    objective.textContent = copy.objective;
    talkBody.append(objective);
  }

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
      open = player?.openId === "bernie";
      talkHud.hidden = !open;
      if (open && player?.talkId) render(player.talkId);
      else shown = null;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
