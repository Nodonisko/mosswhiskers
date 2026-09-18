import type { PlayerSim, TalkId } from "./sim";
import {
  BERNIE_NAME,
  GRETA_NAME,
  RABBIT_NAME,
  SAM_NAME,
  WOLFENBERG_NAME,
} from "./world-config";

type TalkCopy = {
  name: string;
  paragraphs: string[];
  objective: string;
};

const TALK: Record<TalkId, TalkCopy> = {
  "bernie-ask": {
    name: BERNIE_NAME,
    paragraphs: [
      "You came. Good. These trees have gone the color of old straw, and I cannot hunt a thing.",
    ],
    objective:
      "Bring me some mice, would you? Fish too, if the south woods still have any.",
  },
  "bernie-thanks": {
    name: BERNIE_NAME,
    paragraphs: [
      "So long, and thanks for all the fish. The mice too. That will keep me going.",
    ],
    objective:
      "Something is wrong with the water. It should not be drying. Would you look around and see why?",
  },
  "bernie-pond": {
    name: BERNIE_NAME,
    paragraphs: ["Still no luck with the pond? It shrinks a little every day."],
    objective:
      "There is a pipe in the puddle that was not always there. Follow it, would you?",
  },
  "sam-wait": {
    name: SAM_NAME,
    paragraphs: ["Not just now."],
    objective:
      "Speak with Bernie first, would you? Northwest woods, by the pond. Then we can talk.",
  },
  "sam-pitch": {
    name: SAM_NAME,
    paragraphs: [
      "Afternoon. How do you like the data center? The machines think a great deal and drink even more. Perfectly ordinary, I'm told.",
    ],
    objective:
      "Bernie's pond is running out, so I may run a new pipe to the water south of your hollow. One has to keep the racks from getting warm.",
  },
  "bernie-report": {
    name: BERNIE_NAME,
    paragraphs: [
      "Ah. Not a drought, then. Catman has a pipe in my pond. He is using the water to keep his barn cool.",
    ],
    objective:
      "There is a farmer on the southwest farm who never really liked Catman. Grows vegetables. Enormous ones. Billionaire class, I'm afraid. He may have a thought.",
  },
  "bernie-hopsk": {
    name: BERNIE_NAME,
    paragraphs: [
      "Southwest farm. You cannot miss the crop. Or whatever he is calling it this week.",
    ],
    objective:
      "Ask him nicely. He is proud of the things, and he has never liked Catman.",
  },
  "bernie-clog": {
    name: BERNIE_NAME,
    paragraphs: [
      "A rocket. Of course he called it that. If it fits the straw, I shall not argue with the branding.",
    ],
    objective:
      "The intake is in my pond. The gulping end. Nose first, I should think.",
  },
  "hopsk-wait": {
    name: RABBIT_NAME,
    paragraphs: ["Not today. Launch window's closed."],
    objective:
      "Go to Bernie first, would you? Northwest woods, by the pond. Then we can discuss payload.",
  },
  "hopsk-offer": {
    name: RABBIT_NAME,
    paragraphs: [
      "Hello Whiskers. Do you like carrots? Mine are nearly as big as rockets. You can take this rocket. Sorry. This carrot. Catman has been nicking the water, and this one should bung up his pipe.",
    ],
    objective:
      "Stuff carrot into the intake. The pond end, where the pipe is gulping. Nose first, if you would.",
  },
  "hopsk-nudge": {
    name: RABBIT_NAME,
    paragraphs: [
      "Still got the carrot? Good. Do not eat it. It is for the pipe.",
    ],
    objective:
      "Go to Bernie's puddle. The mouth of the pipe. You will hear it drinking.",
  },
  "hopsk-clogged": {
    name: RABBIT_NAME,
    paragraphs: [
      "Telemetry looks promising. If it explodes, that was always a feature.",
    ],
    objective: "Bernie will want a word. He usually does.",
  },
  "intake-look": {
    name: "Intake",
    paragraphs: [
      "The pipe is taking the pond with it. Something should do the trick. Some vegetable, perhaps?",
    ],
    objective: "If you had a rocket, this would be the place. The gulping end.",
  },
  "intake-stuff": {
    name: "Intake",
    paragraphs: [
      "The rocket sits in the mouth with a certain dignity. The gulping has stopped.",
    ],
    objective:
      "Tell Bernie. Far northwest, by the pond. He will have noticed the quiet.",
  },
  "intake-clogged": {
    name: "Intake",
    paragraphs: [
      "Still wedged. The pipe seems to have had a think about its life choices.",
    ],
    objective: "Bernie, if you have not already. Then the glow in the east.",
  },
  "bernie-smoke": {
    name: BERNIE_NAME,
    paragraphs: [
      "The pipe has gone quiet. And now there is a glow in the east, which I do not love.",
    ],
    objective:
      "Look in on Catman's barn, would you? If it is on fire, I should like to know. If it is not, I should like to know that too.",
  },
  "bernie-blaze": {
    name: BERNIE_NAME,
    paragraphs: ["The campus, east of here. Rather orange, last I glanced."],
    objective:
      "Sam will be out front, I expect. He does like to explain things.",
  },
  "sam-blaze": {
    name: SAM_NAME,
    paragraphs: [
      "Ah. Afternoon. Nothing to see here. Planned safety procedure to slow AI development as everyone wanted. The $200 subscriptions are paused until the procedure concludes.",
    ],
    objective:
      "Report back to Bernie that AI development has been slowed, as everyone wanted.",
  },
  "bernie-victory": {
    name: BERNIE_NAME,
    paragraphs: [
      "So. The pond is keeping what water it has, and Catman's barn is having a little think. That will do for today.",
    ],
    objective: "Watch the woods. And your own pond, while you still have one.",
  },
  "greta-note": {
    name: GRETA_NAME,
    paragraphs: [
      "I should be bringing biscuits to grandmother, but I am on this path because the grown wolves will not leave the coal in the ground.",
    ],
    objective:
      "Grandmother may have a stove. She does not need another degree.",
  },
  "wolfenberg-note": {
    name: WOLFENBERG_NAME,
    paragraphs: [
      "Come closer, would you? The engagement is better at this range.",
    ],
    objective: "Stay. Most users bounce. It is sad for the numbers.",
  },
};

export function createTalkHud(root: HTMLElement) {
  const talk = root.querySelector<HTMLElement>(".talk-hud");
  const kicker = root.querySelector<HTMLElement>(".talk-kicker");
  const title = root.querySelector<HTMLElement>("#talk-title");
  const body = root.querySelector<HTMLElement>(".talk-body");
  const closeBtn = talk?.querySelector<HTMLButtonElement>(".sheet-close");
  if (!talk || !kicker || !title || !body || !closeBtn)
    throw new Error("Talk HUD markup is missing");
  const talkHud: HTMLElement = talk;
  const talkKicker: HTMLElement = kicker;
  const talkTitle: HTMLElement = title;
  const talkBody: HTMLElement = body;
  const close: HTMLButtonElement = closeBtn;

  let open = false;
  let shown: TalkId | null = null;
  let dismissQueued = false;

  function render(talkId: TalkId) {
    if (shown === talkId) return;
    shown = talkId;
    const copy = TALK[talkId];
    talkKicker.hidden = true;
    talkTitle.textContent = copy.name;
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
      open = player?.talkId != null;
      talkHud.hidden = !open;
      if (open && player?.talkId) render(player.talkId);
      else shown = null;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      close.removeEventListener("pointerdown", onCloseDown);
      close.removeEventListener("click", onCloseClick);
      close.removeEventListener("keydown", ignoreSpace);
    },
  };
}
