import type { QuestId } from "./sim";

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
  if (!toggle || !icon || !panel) throw new Error("Quest HUD markup is missing");
  const questToggle: HTMLButtonElement = toggle;
  const questIcon: HTMLCanvasElement = icon;
  const questPanel: HTMLElement = panel;

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
    sync(questId: QuestId | null) {
      hasQuest = questId !== null;
      root.hidden = !hasQuest;
      if (!hasQuest) setOpen(false);
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
