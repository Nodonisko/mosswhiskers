import { createGame } from "./game";
import { BOOT_START_KEY, BOOT_START_TOUCH, preloadGame, yieldFrame } from "./preload";

const THEME_PLAYING = "#729847";

function bootRoot() {
  return document.getElementById("boot");
}

function setBusy(busy: boolean) {
  bootRoot()?.setAttribute("aria-busy", busy ? "true" : "false");
}

function setStatus(label: string, ratio?: number) {
  const status = document.getElementById("boot-status");
  const percent = document.getElementById("boot-percent");
  if (status) status.textContent = label;
  if (percent) {
    if (ratio == null) {
      percent.textContent = "";
      percent.hidden = true;
    } else {
      percent.hidden = false;
      percent.textContent = `${Math.max(0, Math.min(100, Math.round(ratio * 100)))}%`;
    }
  }
}

function showStartPrompt() {
  const status = document.getElementById("boot-status");
  const percent = document.getElementById("boot-percent");
  const start = document.getElementById("boot-start");
  const key = document.querySelector(".boot-start-key");
  const touch = document.querySelector(".boot-start-touch");
  if (status) status.hidden = true;
  if (percent) percent.hidden = true;
  if (key) key.textContent = BOOT_START_KEY;
  if (touch) touch.textContent = BOOT_START_TOUCH;
  if (start) start.hidden = false;
  bootRoot()?.classList.add("is-ready");
  setBusy(false);
}

function dismissBoot() {
  const boot = bootRoot();
  if (boot) boot.hidden = true;
  document.documentElement.classList.add("is-playing");
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute("content", THEME_PLAYING);
}

function isCreditLink(event: Event) {
  const target = event.target;
  return target instanceof Element && Boolean(target.closest("a"));
}

function isStartGesture(event: Event) {
  if (isCreditLink(event)) return false;
  if (event instanceof KeyboardEvent) {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return false;
    if (event.key === "Tab" || event.key === "Escape") return false;
    if (event.key === "Shift" || event.key === "Meta" || event.key === "Control" || event.key === "Alt") return false;
    return true;
  }
  if (event instanceof PointerEvent && event.button !== 0) return false;
  return true;
}

function waitForStart() {
  return new Promise<void>((resolve) => {
    const finish = (event: Event) => {
      if (!isStartGesture(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.removeEventListener("keydown", finish, true);
      window.removeEventListener("pointerdown", finish, true);
      resolve();
    };
    window.addEventListener("keydown", finish, true);
    window.addEventListener("pointerdown", finish, true);
  });
}

async function boot() {
  setBusy(true);
  setStatus("LOADING", 0);
  await preloadGame((progress) => setStatus("LOADING", progress.ratio * 0.86));
  setStatus("LOADING", 0.9);
  await yieldFrame();
  const game = createGame();
  setStatus("LOADING", 1);
  await yieldFrame();
  showStartPrompt();
  await waitForStart();
  game.start();
  dismissBoot();
  if (import.meta.hot) {
    import.meta.hot.dispose(() => game.dispose());
  }
}

void boot();
