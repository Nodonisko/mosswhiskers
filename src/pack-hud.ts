import { inventoryCount, type InventoryItemKind, type InventorySlot } from "./sim";
import { getWorldModelTexture } from "./world-models";

const ITEM_LABEL: Record<InventoryItemKind, string> = {
  mouse: "Mouse",
  pike: "Pike",
  perch: "Perch",
  bluegill: "Bluegill",
};

const FRAME_INK = "#67523a";

/** Stepped 1px outline, same construction as the mail bubble. */
function pixelBorderUrl(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;
  ctx.fillRect(2, 0, 4, 1);
  ctx.fillRect(1, 1, 6, 1);
  ctx.fillRect(0, 2, 8, 4);
  ctx.fillRect(1, 6, 6, 1);
  ctx.fillRect(2, 7, 4, 1);
  ctx.clearRect(3, 3, 2, 2);
  return canvas.toDataURL("image/png");
}

function paintBackpack(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  ctx.imageSmoothingEnabled = false;
  const r = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const ink = FRAME_INK;
  const leather = "#8b6c43";
  const light = "#d4b57a";
  const dark = "#5a4630";
  const strap = "#6c5739";

  r(5, 1, 3, 2, strap);
  r(16, 1, 3, 2, strap);
  r(4, 3, 3, 10, strap);
  r(17, 3, 3, 10, strap);
  r(5, 1, 3, 1, light);
  r(16, 1, 3, 1, light);
  r(4, 3, 1, 10, light);
  r(19, 3, 1, 10, dark);

  r(8, 3, 8, 1, ink);
  r(6, 4, 12, 1, ink);
  r(5, 5, 14, 15, ink);
  r(6, 20, 12, 1, ink);
  r(8, 21, 8, 1, ink);

  r(8, 4, 8, 1, light);
  r(6, 5, 12, 1, leather);
  r(6, 6, 12, 13, leather);
  r(7, 19, 10, 1, dark);

  r(6, 6, 12, 4, light);
  r(7, 7, 10, 2, leather);
  r(6, 9, 12, 1, ink);
  r(11, 8, 2, 3, ink);
  r(11, 9, 2, 1, light);

  r(8, 6, 1, 11, dark);
  r(15, 6, 1, 11, dark);

  r(7, 12, 10, 7, ink);
  r(8, 13, 8, 5, dark);
  r(8, 13, 8, 2, leather);
  r(9, 14, 6, 1, light);
}

function itemIconUrl(kind: InventoryItemKind) {
  const texture = getWorldModelTexture(kind, { seed: kind === "mouse" ? 900 : 801, variant: 0, facing: "e" });
  const image = texture.image;
  if (!(image instanceof HTMLCanvasElement)) throw new Error(`Missing icon canvas for ${kind}`);
  return image.toDataURL();
}

export function createPackHud(root: HTMLElement) {
  const toggle = root.querySelector<HTMLButtonElement>(".pack-toggle");
  const icon = root.querySelector<HTMLCanvasElement>(".pack-icon");
  const countEl = root.querySelector<HTMLElement>(".pack-count");
  const panel = root.querySelector<HTMLElement>(".pack-panel");
  const grid = root.querySelector<HTMLElement>(".pack-grid");
  const empty = root.querySelector<HTMLElement>(".pack-empty");
  if (!toggle || !icon || !countEl || !panel || !grid || !empty) {
    throw new Error("Pack HUD markup is missing");
  }
  const packToggle: HTMLButtonElement = toggle;
  const packIcon: HTMLCanvasElement = icon;
  const packCount: HTMLElement = countEl;
  const packPanel: HTMLElement = panel;
  const packGrid: HTMLElement = grid;
  const packEmpty: HTMLElement = empty;

  paintBackpack(packIcon);
  document.documentElement.style.setProperty("--pack-frame", `url("${pixelBorderUrl(FRAME_INK)}")`);
  const icons = {
    mouse: itemIconUrl("mouse"),
    pike: itemIconUrl("pike"),
    perch: itemIconUrl("perch"),
    bluegill: itemIconUrl("bluegill"),
  } as const;

  let open = false;
  let signature = "";

  function setOpen(next: boolean) {
    open = next;
    packPanel.hidden = !open;
    packToggle.setAttribute("aria-expanded", open ? "true" : "false");
    packToggle.setAttribute("aria-label", open ? "Close pack" : "Open pack");
  }

  function render(slots: readonly InventorySlot[]) {
    const total = inventoryCount(slots);
    packCount.textContent = String(total);
    packCount.hidden = total === 0;
    packEmpty.hidden = slots.length > 0;
    packGrid.replaceChildren();
    for (const slot of slots) {
      const item = document.createElement("li");
      item.className = "pack-slot pixel-frame";
      const img = document.createElement("img");
      img.src = icons[slot.kind];
      img.alt = "";
      img.width = 48;
      img.height = 32;
      const name = document.createElement("span");
      name.className = "pack-slot-name";
      name.textContent = ITEM_LABEL[slot.kind];
      const qty = document.createElement("span");
      qty.className = "pack-slot-count";
      qty.textContent = `×${slot.count}`;
      item.append(img, name, qty);
      packGrid.append(item);
    }
  }

  const onToggle = (event: Event) => {
    event.stopPropagation();
    setOpen(!open);
    packToggle.blur();
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

  packToggle.addEventListener("click", onToggle);
  packToggle.addEventListener("keydown", onToggleKey);
  packToggle.addEventListener("keyup", onToggleKey);
  document.addEventListener("click", onDocumentClick);
  window.addEventListener("keydown", onKeyDown);

  return {
    sync(slots: readonly InventorySlot[]) {
      const next = JSON.stringify(slots);
      if (next === signature) return;
      signature = next;
      render(slots);
    },
    dispose() {
      packToggle.removeEventListener("click", onToggle);
      packToggle.removeEventListener("keydown", onToggleKey);
      packToggle.removeEventListener("keyup", onToggleKey);
      document.removeEventListener("click", onDocumentClick);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
