import type { PlayerSim, QuestId } from "./sim";

const QUEST_COPY: Record<QuestId, { summary: string; objective: string }> = {
  sandwhisker: {
    summary: "His woods are dying and the pond is a puddle.",
    objective:
      "Bring him fish and mice. He lives in the far northwest of the wood.",
  },
  pond: {
    summary: "Bernie took the fish and mice.",
    objective: "Investigate why his pond is drying up. Follow the pipe.",
  },
  report: {
    summary: "Sam Catman is cooling his data center with Bernie's pond.",
    objective: "Tell Bernie. He is in the far northwest of the wood.",
  },
  hopsk: {
    summary: "Bernie knows a rabbit who never did like Catman.",
    objective: "Find vegetable farmer on the southwest farm.",
  },
  clog: {
    summary: "Hopsk lent you one of his carrots.",
    objective: "Stuff it in the pipe intake. Bernie's pond, the gulping end.",
  },
  smoke: {
    summary: "The pipe has stopped drinking.",
    objective: "Tell Bernie. Far northwest, by the pond.",
  },
  blaze: {
    summary: "There is a glow over Catman's barn.",
    objective: "Check the data center. Speak with Sam.",
  },
};

const QUEST_HINT: Record<QuestId, string> = {
  sandwhisker: "Catch mouse and fish for Bernie",
  pond: "Investigate why pond is drying",
  report: "Go back to Bernie",
  hopsk: "Find vegetable farmer in South",
  clog: "Insert the carrot in the pipe",
  smoke: "Go back to Bernie",
  blaze: "Check the data center",
};

function paintQuestBang(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  ctx.imageSmoothingEnabled = false;
  const r = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const ink = "#3a2a14";
  const gold = "#f0c44c";
  const light = "#ffe58a";

  r(9, 1, 6, 14, ink);
  r(10, 2, 4, 12, gold);
  r(11, 2, 2, 5, light);
  r(10, 12, 4, 1, "#c8942e");

  r(9, 17, 6, 6, ink);
  r(10, 18, 4, 4, gold);
  r(11, 18, 2, 2, light);
}

export function createQuestHud(root: HTMLElement) {
  const toggle = root.querySelector<HTMLButtonElement>(".quest-toggle");
  const icon = root.querySelector<HTMLCanvasElement>(".quest-icon");
  const panel = root.querySelector<HTMLElement>(".quest-panel");
  const summary = root.querySelector<HTMLElement>(".quest-summary");
  const objective = root.querySelector<HTMLElement>(".quest-objective");
  if (!toggle || !icon || !panel || !summary || !objective)
    throw new Error("Quest HUD markup is missing");
  const questToggle: HTMLButtonElement = toggle;
  const questIcon: HTMLCanvasElement = icon;
  const questPanel: HTMLElement = panel;
  const questSummary: HTMLElement = summary;
  const questObjective: HTMLElement = objective;
  const toast = document.querySelector<HTMLElement>(".quest-toast");
  if (!toast) throw new Error("Quest toast markup is missing");
  const questToast: HTMLElement = toast;

  paintQuestBang(questIcon);

  let open = false;
  let hasQuest = false;

  function setOpen(next: boolean) {
    open = next && hasQuest;
    questPanel.hidden = !open;
    questToggle.setAttribute("aria-expanded", open ? "true" : "false");
    questToggle.setAttribute("aria-label", open ? "Close quest" : "Open quest");
  }

  const onToggle = (event: Event) => {
    event.stopPropagation();
    setOpen(!open);
    questToggle.blur();
  };
  const onToggleKey = (event: KeyboardEvent) => {
    if (event.key === " " || event.code === "Space") event.preventDefault();
  };
  const onDocumentClick = (event: MouseEvent) => {
    if (!open) return;
    if (root.contains(event.target as Node)) return;
    setOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
  };

  questToggle.addEventListener("click", onToggle);
  questToggle.addEventListener("keydown", onToggleKey);
  questToggle.addEventListener("keyup", onToggleKey);
  document.addEventListener("click", onDocumentClick);
  window.addEventListener("keydown", onKeyDown);

  return {
    sync(player: PlayerSim | undefined) {
      const questId = player?.progress.activeQuest ?? null;
      hasQuest = questId !== null;
      root.hidden = !hasQuest;
      if (questId) {
        const copy = QUEST_COPY[questId];
        questSummary.textContent = copy.summary;
        questObjective.textContent = copy.objective;
      }
      if (!hasQuest) setOpen(false);
      const hint = player?.questHint;
      const showToast = Boolean(hint) && !player?.openId;
      questToast.hidden = !showToast;
      if (showToast && hint) questToast.textContent = QUEST_HINT[hint];
    },
    dispose() {
      questToggle.removeEventListener("click", onToggle);
      questToggle.removeEventListener("keydown", onToggleKey);
      questToggle.removeEventListener("keyup", onToggleKey);
      document.removeEventListener("click", onDocumentClick);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
