import { MUSIC_LEVELS, type BackgroundMusic } from "./music";

type LevelSlider = {
  get(): number;
  set(level: number): void;
};

function bindSlider(slider: HTMLElement, control: LevelSlider) {
  const fill = slider.querySelector<HTMLElement>(".settings-slider-fill");
  const points = [...slider.querySelectorAll<HTMLButtonElement>(".settings-slider-point")];
  if (!fill || points.length !== MUSIC_LEVELS) throw new Error("Settings HUD markup is missing");
  const sliderFill: HTMLElement = fill;
  let dragPointer: number | null = null;

  function paint() {
    const level = control.get();
    sliderFill.style.width = `calc((100% - 22px) * ${(level - 1) / (MUSIC_LEVELS - 1)})`;
    for (const point of points) {
      const pointLevel = Number(point.dataset.level);
      const on = pointLevel <= level;
      const current = pointLevel === level;
      point.classList.toggle("is-on", on);
      point.setAttribute("aria-checked", current ? "true" : "false");
    }
  }

  function levelFromX(clientX: number) {
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const start = first.getBoundingClientRect().left + first.offsetWidth / 2;
    const end = last.getBoundingClientRect().left + last.offsetWidth / 2;
    if (end <= start) return control.get();
    const t = (clientX - start) / (end - start);
    return Math.round(t * (MUSIC_LEVELS - 1)) + 1;
  }

  function choose(level: number) {
    control.set(level);
    paint();
  }

  const ignoreSpace = (event: KeyboardEvent) => {
    if (event.key === " " || event.code === "Space") event.preventDefault();
  };
  const onPointClick = (event: Event) => {
    event.stopPropagation();
    const button = event.currentTarget as HTMLButtonElement;
    choose(Number(button.dataset.level));
    button.blur();
  };
  const onSliderDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragPointer = event.pointerId;
    slider.setPointerCapture(event.pointerId);
    choose(levelFromX(event.clientX));
  };
  const onSliderMove = (event: PointerEvent) => {
    if (dragPointer !== event.pointerId) return;
    choose(levelFromX(event.clientX));
  };
  const onSliderUp = (event: PointerEvent) => {
    if (dragPointer !== event.pointerId) return;
    dragPointer = null;
  };

  slider.addEventListener("pointerdown", onSliderDown);
  slider.addEventListener("pointermove", onSliderMove);
  slider.addEventListener("pointerup", onSliderUp);
  slider.addEventListener("pointercancel", onSliderUp);
  for (const point of points) {
    point.addEventListener("click", onPointClick);
    point.addEventListener("keydown", ignoreSpace);
    point.addEventListener("keyup", ignoreSpace);
  }
  paint();

  return {
    dispose() {
      slider.removeEventListener("pointerdown", onSliderDown);
      slider.removeEventListener("pointermove", onSliderMove);
      slider.removeEventListener("pointerup", onSliderUp);
      slider.removeEventListener("pointercancel", onSliderUp);
      for (const point of points) {
        point.removeEventListener("click", onPointClick);
        point.removeEventListener("keydown", ignoreSpace);
        point.removeEventListener("keyup", ignoreSpace);
      }
    },
  };
}

export function createSettingsHud(root: HTMLElement, music: BackgroundMusic) {
  const toggle = root.querySelector<HTMLButtonElement>(".settings-toggle");
  const panel = root.querySelector<HTMLElement>(".settings-panel");
  const musicSlider = root.querySelector<HTMLElement>('[data-setting="music"]');
  const sfxSlider = root.querySelector<HTMLElement>('[data-setting="sfx"]');
  if (!toggle || !panel || !musicSlider || !sfxSlider) {
    throw new Error("Settings HUD markup is missing");
  }
  const settingsToggle: HTMLButtonElement = toggle;
  const settingsPanel: HTMLElement = panel;

  let open = false;

  function setOpen(next: boolean) {
    open = next;
    settingsPanel.hidden = !open;
    settingsToggle.setAttribute("aria-expanded", open ? "true" : "false");
    settingsToggle.setAttribute("aria-label", open ? "Close settings" : "Open settings");
  }

  const musicControl = bindSlider(musicSlider, {
    get: () => music.level(),
    set: (level) => music.setLevel(level),
  });
  const sfxControl = bindSlider(sfxSlider, {
    get: () => music.sfxLevel(),
    set: (level) => music.setSfxLevel(level),
  });

  const onToggle = (event: Event) => {
    event.stopPropagation();
    setOpen(!open);
    settingsToggle.blur();
  };
  const ignoreSpace = (event: KeyboardEvent) => {
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

  settingsToggle.addEventListener("click", onToggle);
  settingsToggle.addEventListener("keydown", ignoreSpace);
  settingsToggle.addEventListener("keyup", ignoreSpace);
  document.addEventListener("click", onDocumentClick);
  window.addEventListener("keydown", onKeyDown);

  return {
    dispose() {
      settingsToggle.removeEventListener("click", onToggle);
      settingsToggle.removeEventListener("keydown", ignoreSpace);
      settingsToggle.removeEventListener("keyup", ignoreSpace);
      musicControl.dispose();
      sfxControl.dispose();
      document.removeEventListener("click", onDocumentClick);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
