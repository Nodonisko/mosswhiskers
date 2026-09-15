import type { PlayerSim, TalkId } from "./sim";
import { BERNIE_NAME, RABBIT_NAME, SAM_NAME } from "./world-config";

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
    objective: "Bring me some fish and mice, would you? Anything the south woods still have.",
  },
  "bernie-thanks": {
    name: BERNIE_NAME,
    paragraphs: [
      "So long, and thanks for all the fish. The mice too. That will keep me going.",
    ],
    objective: "Now this pond. It should not be drying. Something is wrong with the water. Would you look around and see why?",
  },
  "bernie-pond": {
    name: BERNIE_NAME,
    paragraphs: [
      "Still no luck with the pond? It shrinks a little every day.",
    ],
    objective: "There is a pipe in the puddle that was not always there. Follow it, would you?",
  },
  "sam-wait": {
    name: SAM_NAME,
    paragraphs: [
      "Not just now.",
    ],
    objective: "Speak with Bernie first, would you? Northwest woods, by the pond. Then we can talk.",
  },
  "sam-pitch": {
    name: SAM_NAME,
    paragraphs: [
      "Afternoon. How do you like the data center? The machines think a great deal and drink even more. Perfectly ordinary, I'm told.",
    ],
    objective: "Bernie's pond is rather past it, so I may run a new pipe to the water south of your hollow. One has to keep the racks from getting warm. Do say hello for me.",
  },
  "bernie-report": {
    name: BERNIE_NAME,
    paragraphs: [
      "Ah. Not a drought, then. Catman has a pipe in my pond. He is using the water to keep his barn cool.",
    ],
    objective: "I have a friend on the southwest farm who never did care for Catman. Grows vegetables. Enormous ones. He may have a thought.",
  },
  "bernie-hopsk": {
    name: BERNIE_NAME,
    paragraphs: [
      "The rabbit. Southwest farm. You cannot miss the crop. Or whatever he is calling it this week.",
    ],
    objective: "Ask him nicely. He is proud of the things, and he has never liked Catman.",
  },
  "bernie-clog": {
    name: BERNIE_NAME,
    paragraphs: [
      "A rocket. Of course he called it that. If it fits the straw, I shall not argue with the branding.",
    ],
    objective: "The intake is in my pond. The gulping end. Nose first, I should think.",
  },
  "hopsk-wait": {
    name: RABBIT_NAME,
    paragraphs: [
      "Not today. Launch window's closed.",
    ],
    objective: "Bernie first, would you? Northwest woods, by the pond. Then we can discuss payload.",
  },
  "hopsk-offer": {
    name: RABBIT_NAME,
    paragraphs: [
      "Hello Whiskers. Do you like carrots? Mine are nearly as big as rockets. You can take this rocket. Sorry. This carrot. Catman has been nicking the water, and this one should bung up his pipe.",
    ],
    objective: "Stuff it in the intake. The pond end, where the pipe is gulping. Nose first, if you would.",
  },
  "hopsk-nudge": {
    name: RABBIT_NAME,
    paragraphs: [
      "Still got the carrot? Good. Do not eat it. It is for the pipe.",
    ],
    objective: "Bernie's puddle. The mouth of the pipe. You will hear it drinking.",
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
      "The pipe is taking the pond with it. Something stout might wedge in the mouth.",
    ],
    objective: "If you had a rocket, this would be the place. The gulping end.",
  },
  "intake-stuff": {
    name: "Intake",
    paragraphs: [
      "The rocket sits in the mouth with a certain dignity. The gulping has stopped.",
    ],
    objective: "Tell Bernie. Far northwest, by the pond. He will have noticed the quiet.",
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
    objective: "Look in on Catman's barn, would you? If it is on fire, I should like to know. If it is not, I should like to know that too.",
  },
  "bernie-blaze": {
    name: BERNIE_NAME,
    paragraphs: [
      "The campus, east of here. Rather orange, last I glanced.",
    ],
    objective: "Sam will be out front, I expect. He does like to explain things.",
  },
  "sam-blaze": {
    name: SAM_NAME,
    paragraphs: [
      "Ah. Afternoon. We appear to be experiencing a localised warmth. Entirely within parameters. The parameters being, at present, 'on fire'.",
    ],
    objective: "I don't suppose you've seen a root vegetable? The cooling has gone a bit artisanal. The models are still thinking. They are thinking, chiefly, about heat.",
  },
  "bernie-victory": {
    name: BERNIE_NAME,
    paragraphs: [
      "So. The pond is keeping what water it has, and Catman's barn is having a little think. That will do for today.",
    ],
    objective: "Watch the woods. And your own pond, while you still have one.",
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
      open = player?.talkId != null;
      talkHud.hidden = !open;
      if (open && player?.talkId) render(player.talkId);
      else shown = null;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
