import * as THREE from "three";
import "./editor.css";
import { updateLakeModel } from "./lake-model";
import { updateDriedPondModel } from "./pond-model";
import { updateIntakePipeModel } from "./pipe-model";
import { addWorldBackdrop } from "./world-backdrop";
import { createLockedProps, isBernieWoods } from "./world";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  VIEW_HEIGHT,
  isPlaceableWorldKind,
  isRotatableWorldKind,
  isUniqueNpcKind,
  nextRotation,
  normalizeFlowerVariant,
  normalizePlaceVariant,
  normalizeRotation,
  placeableVariantCount,
  type PlaceableWorldKind,
  type WorldProp,
} from "./world-config";
import { WORLD_PROPS } from "./world-props";
import { createWorldModel, paintWorldModel, WORLD_MODEL_SIZES, applyWorldPropPose } from "./world-models";
import {
  EDITOR_DRAFT_KEY,
  NPC_LABELS,
  createEditorStore,
  duplicateSelected,
  editorPaletteItems,
  fromEditorProps,
  cornerActionAt,
  hitTest,
  moveById,
  nextSeed,
  parseEditorDraft,
  parseWorldPropsJson,
  placeableDefaultScale,
  placeableLabel,
  placeAt,
  propCenter,
  propCorners,
  redo,
  removeSelected,
  replaceProps,
  rotateByPointer,
  rotateSelected,
  scaleByHandle,
  selectedProp,
  serializeEditorDraft,
  serializeWorldPropsTs,
  undo,
  updateById,
  type EditorStore,
} from "./map-editor-state";

const MIN_ZOOM = 0.22;
const MAX_ZOOM = 2.4;
const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><g fill="none" stroke="#fff8dd" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></g><g fill="none" stroke="#1a140c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></g></svg>`) }") 9 9, grab`;

function required<T>(value: T | null, label: string): T {
  if (value == null) throw new Error(`${label} is missing`);
  return value;
}

function readDraft() {
  try {
    return parseEditorDraft(localStorage.getItem(EDITOR_DRAFT_KEY));
  } catch {
    return null;
  }
}

function startEditor() {
  const canvas = required(document.querySelector<HTMLCanvasElement>("#world"), "World canvas");
  const root = required(document.getElementById("editor"), "Editor root");
  const paletteList = required(root.querySelector(".palette-list"), "Palette");
  const inspectEmpty = required(root.querySelector<HTMLElement>(".inspect-empty"), "Inspector empty");
  const inspectForm = required(root.querySelector<HTMLFormElement>(".inspect-form"), "Inspector form");
  const inspectKind = required(root.querySelector<HTMLElement>(".inspect-kind"), "Inspector kind");
  const statusEl = required(root.querySelector<HTMLElement>(".editor-status"), "Status");
  const minimap = required(root.querySelector<HTMLCanvasElement>(".minimap"), "Minimap");
  const minimapCtx = required(minimap.getContext("2d"), "Minimap context");
  const resetModal = required(root.querySelector<HTMLElement>(".editor-modal"), "Reset prompt");

  const draft = readDraft();
  const store = createEditorStore(draft?.props ?? WORLD_PROPS);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x688f45);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-480, 480, 270, -270, 0.1, 2000);
  camera.position.set(0, 0, 1000);
  const world = new THREE.Group();
  scene.add(world);

  const backdrop = addWorldBackdrop(world);
  for (const prop of createLockedProps()) {
    const model = createWorldModel(prop.kind, {
      scale: prop.scale,
      seed: prop.seed,
      variant: prop.variant,
      sick: prop.sick,
    });
    model.position.set(prop.x, prop.y, 0);
    model.renderOrder = 10000 - Math.round(prop.y);
    (model.material as THREE.SpriteMaterial).opacity = 0.92;
    world.add(model);
  }

  const sprites = new Map<number, THREE.Sprite>();
  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xffe08a, depthTest: false }),
  );
  outline.renderOrder = 40000;
  outline.frustumCulled = false;
  world.add(outline);

  const handleGeom = new THREE.PlaneGeometry(1, 1);
  const handleBackMat = new THREE.MeshBasicMaterial({ color: 0x3a2a18, depthTest: false, toneMapped: false });
  const handleFaceMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, depthTest: false, toneMapped: false });
  const handles = [0, 1, 2, 3].map(() => {
    const group = new THREE.Group();
    const back = new THREE.Mesh(handleGeom, handleBackMat);
    const face = new THREE.Mesh(handleGeom, handleFaceMat);
    back.scale.set(1.35, 1.35, 1);
    back.position.z = 8.5;
    face.position.z = 8.6;
    back.renderOrder = 40001;
    face.renderOrder = 40002;
    back.frustumCulled = false;
    face.frustumCulled = false;
    group.add(back, face);
    group.visible = false;
    world.add(group);
    return group;
  });

  const ghost = createWorldModel("pine", { scale: 1, seed: 1 });
  (ghost.material as THREE.SpriteMaterial).opacity = 0.42;
  ghost.visible = false;
  world.add(ghost);

  function appearance(prop: WorldProp) {
    return `${prop.kind}:${prop.seed}:${prop.variant}:${prop.sick ? "s" : ""}`;
  }

  function syncSprites() {
    const live = new Set<number>();
    for (const prop of store.props) {
      live.add(prop.id);
      const existing = sprites.get(prop.id);
      const look = appearance(prop);
      if (!existing || existing.userData.look !== look) {
        if (existing) world.remove(existing);
        const model = createWorldModel(prop.kind, {
          scale: prop.scale,
          seed: prop.seed,
          variant: prop.variant,
          sick: prop.sick,
        });
        model.userData.look = look;
        sprites.set(prop.id, model);
        world.add(model);
      }
      const sprite = sprites.get(prop.id)!;
      applyWorldPropPose(sprite, prop);
      sprite.renderOrder = 10000 - Math.round(prop.y);
    }
    for (const [id, sprite] of sprites) {
      if (live.has(id)) continue;
      world.remove(sprite);
      sprites.delete(id);
    }
  }
  syncSprites();

  for (const item of editorPaletteItems()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette-item";
    button.dataset.tool = item.kind;
    button.dataset.palette = item.id;
    button.dataset.variant = String(item.variant);
    const icon = paintWorldModel(item.kind, {
      seed: 4,
      variant: item.variant,
    });
    icon.style.width = "40px";
    icon.style.height = "40px";
    const label = document.createElement("span");
    label.textContent = item.label;
    button.append(icon, label);
    paletteList.append(button);
  }

  let zoom = draft?.camera?.zoom != null
    ? THREE.MathUtils.clamp(draft.camera.zoom, MIN_ZOOM, MAX_ZOOM)
    : 0.55;
  let viewWidth = 960;
  let statusTimer = 0;
  const keys = new Set<string>();
  let panning = false;
  let dragging = false;
  let resizing = false;
  let rotating = false;
  let rotateStartAngle = 0;
  let resizeHandle = 0;
  let resizeOrigin: WorldProp | null = null;
  let dragRecorded = false;
  let lastPointer = { x: 0, y: 0 };
  let placeRot = 0;
  let placeVariant = 0;

  function say(message: string) {
    statusEl.textContent = message;
    statusTimer = 2.4;
  }

  function ghostLift(kind: PlaceableWorldKind) {
    return isRotatableWorldKind(kind) ? WORLD_MODEL_SIZES[kind][1] / 2 : 0;
  }

  function setGhostKind(kind: PlaceableWorldKind) {
    applyWorldPropPose(ghost, {
      kind,
      x: 0,
      y: 0,
      scale: placeableDefaultScale(kind),
      rot: isRotatableWorldKind(kind) ? placeRot : 0,
    });
    const model = createWorldModel(kind, { scale: 1, seed: 1, variant: placeVariant });
    (ghost.material as THREE.SpriteMaterial).map = (model.material as THREE.SpriteMaterial).map;
    (ghost.material as THREE.SpriteMaterial).opacity = 0.42;
  }

  function paletteIdFor(tool: EditorStore["tool"], variant = placeVariant) {
    if (tool === "select") return "select";
    if (placeableVariantCount(tool) > 1) return `${tool}-${normalizePlaceVariant(tool, variant)}`;
    return tool;
  }

  function rotateCurrent(step: number) {
    if (rotateSelected(store, step)) {
      mutated();
      return;
    }
    if (isRotatableWorldKind(store.tool)) {
      placeRot = nextRotation(placeRot, step);
      setGhostKind(store.tool);
      say(`Rotation ${placeRot}°`);
    }
  }

  function setTool(tool: EditorStore["tool"], variant?: number) {
    store.tool = tool;
    placeVariant = tool === "select" ? 0 : normalizePlaceVariant(tool, variant ?? placeVariant);
    const active = paletteIdFor(tool);
    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-tool]")) {
      button.classList.toggle("is-active", (button.dataset.palette ?? button.dataset.tool) === active);
    }
    canvas.style.cursor = tool === "select" ? "default" : "crosshair";
    if (tool !== "select") setGhostKind(tool);
  }

  function screenToWorld(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    return {
      x: camera.position.x + ndcX * camera.right,
      y: camera.position.y + ndcY * camera.top,
    };
  }

  function clampCamera() {
    const edgeX = Math.max(0, MAP_WIDTH / 2 - viewWidth / 2);
    const edgeY = Math.max(0, MAP_HEIGHT / 2 - (VIEW_HEIGHT / zoom) / 2);
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -edgeX, edgeX);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, -edgeY, edgeY);
  }

  function resize() {
    const width = Math.round(window.innerWidth);
    const height = Math.round(window.innerHeight);
    renderer.setSize(width, height, false);
    viewWidth = (VIEW_HEIGHT / zoom) * (width / Math.max(1, height));
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = VIEW_HEIGHT / zoom / 2;
    camera.bottom = -VIEW_HEIGHT / zoom / 2;
    camera.updateProjectionMatrix();
    clampCamera();
  }

  let persistEnabled = Boolean(draft);

  function persist() {
    if (!persistEnabled) return;
    try {
      localStorage.setItem(EDITOR_DRAFT_KEY, serializeEditorDraft({
        props: fromEditorProps(store.props),
        camera: { x: camera.position.x, y: camera.position.y, zoom },
      }));
    } catch {
      /* private mode / quota */
    }
  }

  function persistView() {
    persistEnabled = true;
    persist();
  }

  function clearDraft() {
    persistEnabled = false;
    try {
      localStorage.removeItem(EDITOR_DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  function mutated() {
    persistEnabled = true;
    syncSprites();
    syncInspector();
    persist();
  }

  const field = (name: string) => inspectForm.elements.namedItem(name) as HTMLInputElement;

  function syncInspector() {
    const prop = selectedProp(store);
    inspectEmpty.hidden = Boolean(prop);
    inspectForm.hidden = !prop;
    if (!prop) return;
    if (isUniqueNpcKind(prop.kind)) {
      inspectKind.textContent = `${NPC_LABELS[prop.kind]} · unique NPC, drag to move`;
    } else if (isPlaceableWorldKind(prop.kind)) {
      inspectKind.textContent = placeableLabel(prop.kind, prop.variant);
    }
    field("x").value = String(Math.round(prop.x));
    field("y").value = String(Math.round(prop.y));
    field("scale").value = String(prop.scale);
    field("seed").value = String(prop.seed);
    field("variant").value = String(prop.variant);
    field("rot").value = String(normalizeRotation(prop.rot));
    field("sick").checked = Boolean(prop.sick);
    const npc = isUniqueNpcKind(prop.kind);
    const rotatable = isRotatableWorldKind(prop.kind);
    inspectForm.querySelector(".inspect-scale")?.toggleAttribute("hidden", npc);
    inspectForm.querySelector(".inspect-seed")?.toggleAttribute("hidden", npc);
    inspectForm.querySelector(".inspect-variant")?.toggleAttribute("hidden", npc);
    inspectForm.querySelector(".inspect-rot")?.toggleAttribute("hidden", !rotatable);
    inspectForm.querySelector(".inspect-sick")?.toggleAttribute("hidden", npc || (prop.kind !== "pine" && prop.kind !== "oak"));
    const deleteBtn = inspectForm.querySelector<HTMLButtonElement>("[data-action=delete]");
    const duplicateBtn = inspectForm.querySelector<HTMLButtonElement>("[data-action=duplicate]");
    const rotateBtn = inspectForm.querySelector<HTMLButtonElement>("[data-action=rotate]");
    if (deleteBtn) deleteBtn.disabled = npc;
    if (duplicateBtn) duplicateBtn.disabled = npc;
    if (rotateBtn) rotateBtn.hidden = !rotatable;
  }

  function pixelWorld(px: number) {
    return ((VIEW_HEIGHT / zoom) / Math.max(1, canvas.clientHeight)) * px;
  }

  function handleWorldSize() {
    return pixelWorld(7);
  }

  function handleHitRadius() {
    return pixelWorld(11);
  }

  function rotateHitRadius() {
    return pixelWorld(28);
  }

  function handleCursor(handle: number) {
    return handle === 0 || handle === 2 ? "nesw-resize" : "nwse-resize";
  }

  function hoverCursor(x: number, y: number) {
    const hover = selectedProp(store);
    if (hover && !isUniqueNpcKind(hover.kind)) {
      const action = cornerActionAt(hover, x, y, handleHitRadius(), rotateHitRadius());
      if (action?.type === "rotate") return ROTATE_CURSOR;
      if (action?.type === "scale") return handleCursor(action.handle);
    }
    return store.tool === "select" ? "default" : "crosshair";
  }

  function updateOutline() {
    const prop = selectedProp(store);
    outline.visible = Boolean(prop);
    const showHandles = Boolean(prop && !isUniqueNpcKind(prop.kind));
    if (!prop) {
      for (const handle of handles) handle.visible = false;
      return;
    }
    const corners = propCorners(prop);
    const points = corners.map((corner) => new THREE.Vector3(corner.x, corner.y, 8));
    outline.geometry.dispose();
    outline.geometry = new THREE.BufferGeometry().setFromPoints(points);
    const size = handleWorldSize();
    for (const [index, handle] of handles.entries()) {
      handle.visible = showHandles;
      if (!showHandles) continue;
      const corner = corners[index]!;
      handle.position.set(corner.x, corner.y, 0);
      handle.scale.set(size, size, 1);
    }
  }

  function drawMinimap() {
    const ctx = minimapCtx;
    const width = minimap.width;
    const height = minimap.height;
    ctx.fillStyle = "#688f45";
    ctx.fillRect(0, 0, width, height);
    const sx = width / MAP_WIDTH;
    const sy = height / MAP_HEIGHT;
    const toMap = (x: number, y: number) => ({
      x: (x + MAP_WIDTH / 2) * sx,
      y: (MAP_HEIGHT / 2 - y) * sy,
    });
    const colors: Partial<Record<WorldProp["kind"], string>> = {
      pine: "#2f5a28",
      oak: "#3d8a34",
      willow: "#6aaa44",
      bush: "#4f9a38",
      stone: "#858780",
      log: "#a08755",
      grass: "#6c9149",
      wheat: "#d4b45a",
      reeds: "#5a8a48",
      mushroom: "#c45a3a",
      moss: "#4a7a38",
      mossLog: "#6a8a40",
      fern: "#3d7a3a",
      stump: "#8a6a40",
      clover: "#5a9a44",
      fence: "#b08a50",
      lamp: "#f1b15d",
      bernie: "#f4eac8",
      sam: "#e8b060",
      rabbit: "#fff8f0",
    };
    const flowerColors = ["#e7e8c9", "#6595ba", "#c591b1", "#e0c45a", "#d4843c", "#8a6aaa", "#c45a4a", "#f0ead0"] as const;
    for (const prop of store.props) {
      const at = toMap(prop.x, prop.y);
      ctx.fillStyle = prop.kind === "flowers"
        ? flowerColors[normalizeFlowerVariant(prop.variant)]
        : colors[prop.kind] ?? "#fff8dd";
      const size = isUniqueNpcKind(prop.kind) ? 4 : 2;
      ctx.fillRect(Math.round(at.x), Math.round(at.y), size, size);
    }
    const view = toMap(camera.position.x - viewWidth / 2, camera.position.y + VIEW_HEIGHT / zoom / 2);
    ctx.strokeStyle = "#fff8dd";
    ctx.lineWidth = 1;
    ctx.strokeRect(view.x, view.y, viewWidth * sx, (VIEW_HEIGHT / zoom) * sy);
  }

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    say(`Copied ${label}`);
  }

  root.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action], [data-tool]");
    if (!button) return;
    if (button.dataset.tool) {
      const tool = button.dataset.tool;
      if (tool === "select") {
        setTool("select");
        return;
      }
      if (isPlaceableWorldKind(tool)) {
        setTool(tool, Number(button.dataset.variant ?? 0));
      }
      return;
    }
    const action = button.dataset.action;
    if (action === "undo") {
      if (undo(store)) mutated();
    } else if (action === "redo") {
      if (redo(store)) mutated();
    } else if (action === "copy") {
      await copyText(serializeWorldPropsTs(fromEditorProps(store.props)), "world-props.ts");
    } else if (action === "import") {
      let text = "";
      try { text = await navigator.clipboard.readText(); } catch { /* fallback prompt */ }
      if (!text) text = window.prompt("Paste src/world-props.ts") ?? "";
      if (!text.trim()) return;
      replaceProps(store, parseWorldPropsJson(text));
      mutated();
      say("Imported");
    } else if (action === "reset") {
      resetModal.hidden = false;
    } else if (action === "reset-cancel") {
      resetModal.hidden = true;
    } else if (action === "reset-confirm") {
      resetModal.hidden = true;
      replaceProps(store, WORLD_PROPS);
      syncSprites();
      syncInspector();
      clearDraft();
      say("Reset to the map in source");
    } else if (action === "delete") {
      if (removeSelected(store)) mutated();
    } else if (action === "duplicate") {
      if (duplicateSelected(store)) mutated();
    } else if (action === "rotate") {
      rotateCurrent(15);
    }
  });

  inspectForm.addEventListener("change", () => {
    const prop = selectedProp(store);
    if (!prop) return;
    updateById(store, prop.id, {
      x: Number(field("x").value),
      y: Number(field("y").value),
      scale: Number(field("scale").value),
      seed: Number(field("seed").value),
      variant: Number(field("variant").value),
      rot: Number(field("rot").value),
      sick: field("sick").checked,
    });
    mutated();
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 1 || event.button === 2 || event.altKey) {
      panning = true;
      lastPointer = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    const at = screenToWorld(event.clientX, event.clientY);
    const selected = selectedProp(store);
    if (selected && !isUniqueNpcKind(selected.kind)) {
      const action = cornerActionAt(selected, at.x, at.y, handleHitRadius(), rotateHitRadius());
      if (action?.type === "rotate") {
        rotating = true;
        resizeOrigin = { ...selected };
        const box = propCenter(selected);
        rotateStartAngle = Math.atan2(at.y - box.y, at.x - box.x);
        dragRecorded = false;
        setTool("select");
        canvas.style.cursor = ROTATE_CURSOR;
        canvas.setPointerCapture(event.pointerId);
        return;
      }
      if (action?.type === "scale") {
        resizing = true;
        resizeHandle = action.handle;
        resizeOrigin = { ...selected };
        dragRecorded = false;
        setTool("select");
        canvas.style.cursor = handleCursor(action.handle);
        canvas.setPointerCapture(event.pointerId);
        return;
      }
    }
    const hit = hitTest(store.props, at.x, at.y);
    if (hit) {
      store.selectedId = hit.id;
      dragging = true;
      dragRecorded = false;
      lastPointer = at;
      setTool("select");
      syncInspector();
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (store.tool !== "select") {
      const prop = placeAt(store, store.tool, at.x, at.y, nextSeed(store), placeRot, placeVariant);
      if ((prop.kind === "pine" || prop.kind === "oak") && isBernieWoods(prop.x, prop.y)) prop.sick = true;
      mutated();
      return;
    }
    store.selectedId = null;
    syncInspector();
  });

  canvas.addEventListener("pointermove", (event) => {
    const at = screenToWorld(event.clientX, event.clientY);
    if (panning) {
      const dx = event.clientX - lastPointer.x;
      const dy = event.clientY - lastPointer.y;
      lastPointer = { x: event.clientX, y: event.clientY };
      const worldPerPixelX = viewWidth / canvas.clientWidth;
      const worldPerPixelY = (VIEW_HEIGHT / zoom) / canvas.clientHeight;
      camera.position.x -= dx * worldPerPixelX;
      camera.position.y += dy * worldPerPixelY;
      clampCamera();
      return;
    }
    if (rotating && store.selectedId != null && resizeOrigin) {
      if (!dragRecorded) {
        rotateByPointer(store, store.selectedId, resizeOrigin, rotateStartAngle, at.x, at.y, true, event.shiftKey);
        dragRecorded = true;
      } else {
        rotateByPointer(store, store.selectedId, resizeOrigin, rotateStartAngle, at.x, at.y, false, event.shiftKey);
      }
      syncSprites();
      syncInspector();
      return;
    }
    if (resizing && store.selectedId != null && resizeOrigin) {
      if (!dragRecorded) {
        scaleByHandle(store, store.selectedId, resizeHandle, resizeOrigin, at.x, at.y, true);
        dragRecorded = true;
      } else {
        scaleByHandle(store, store.selectedId, resizeHandle, resizeOrigin, at.x, at.y, false);
      }
      syncSprites();
      syncInspector();
      return;
    }
    if (dragging && store.selectedId != null) {
      if (!dragRecorded) {
        moveById(store, store.selectedId, selectedProp(store)!.x, selectedProp(store)!.y, true);
        dragRecorded = true;
      }
      const prop = selectedProp(store);
      if (prop) {
        moveById(store, prop.id, prop.x + (at.x - lastPointer.x), prop.y + (at.y - lastPointer.y), false);
        lastPointer = at;
        syncSprites();
        syncInspector();
      }
      return;
    }
    if (store.tool !== "select") {
      ghost.visible = true;
      ghost.position.set(at.x, at.y + ghostLift(store.tool), 0);
    } else {
      ghost.visible = false;
    }
    canvas.style.cursor = hoverCursor(at.x, at.y);
  });

  function endPointer(event: PointerEvent) {
    if ((dragging && dragRecorded) || (resizing && dragRecorded) || (rotating && dragRecorded) || panning) persistView();
    dragging = false;
    resizing = false;
    rotating = false;
    resizeOrigin = null;
    panning = false;
    canvas.style.cursor = store.tool === "select" ? "default" : "crosshair";
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* already released */ }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const before = screenToWorld(event.clientX, event.clientY);
    zoom = THREE.MathUtils.clamp(zoom * (event.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM);
    resize();
    const after = screenToWorld(event.clientX, event.clientY);
    camera.position.x += before.x - after.x;
    camera.position.y += before.y - after.y;
    clampCamera();
    persistView();
  }, { passive: false });

  minimap.addEventListener("pointerdown", (event) => {
    const rect = minimap.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * MAP_WIDTH;
    const y = (0.5 - (event.clientY - rect.top) / rect.height) * MAP_HEIGHT;
    camera.position.x = x;
    camera.position.y = y;
    clampCamera();
    persistView();
  });

  function persistWhenHidden() {
    if (document.visibilityState === "hidden") persist();
  }
  function closeResetOnBackdrop(event: MouseEvent) {
    if (event.target === resetModal) resetModal.hidden = true;
  }
  resetModal.addEventListener("click", closeResetOnBackdrop);

  window.addEventListener("keydown", (event) => {
    keys.add(event.code);
    const typing = event.target instanceof HTMLInputElement;
    if (event.code === "Escape" && !resetModal.hidden) {
      event.preventDefault();
      resetModal.hidden = true;
      return;
    }
    if (typing) return;
    if ((event.metaKey || event.ctrlKey) && event.code === "KeyZ") {
      event.preventDefault();
      if (event.shiftKey ? redo(store) : undo(store)) mutated();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.code === "KeyY") {
      event.preventDefault();
      if (redo(store)) mutated();
      return;
    }
    if (event.code === "KeyR") {
      event.preventDefault();
      rotateCurrent(event.shiftKey ? -15 : 15);
      return;
    }
    if (event.code === "KeyV" || event.code === "Escape") setTool("select");
    if ((event.metaKey || event.ctrlKey) && event.code === "KeyD") {
      event.preventDefault();
      if (duplicateSelected(store)) mutated();
      return;
    }
    if (event.code === "Delete" || event.code === "Backspace") {
      event.preventDefault();
      if (removeSelected(store)) mutated();
    }
    const toolKeys: Record<string, PlaceableWorldKind> = {
      Digit1: "pine", Digit2: "oak", Digit3: "willow", Digit4: "bush",
      Digit5: "flowers", Digit6: "stone", Digit7: "log", Digit8: "fence", Digit9: "lamp",
    };
    const mapped = toolKeys[event.code];
    if (mapped && placeableVariantCount(mapped) > 1 && store.tool === mapped) {
      setTool(mapped, placeVariant + 1);
    } else if (mapped) setTool(mapped);
  });
  function onKeyUp(event: KeyboardEvent) {
    keys.delete(event.code);
    if (
      event.code === "KeyA" || event.code === "KeyD" || event.code === "KeyW" || event.code === "KeyS"
      || event.code === "ArrowLeft" || event.code === "ArrowRight" || event.code === "ArrowUp" || event.code === "ArrowDown"
    ) persistView();
  }
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", persist);
  document.addEventListener("visibilitychange", persistWhenHidden);
  resize();
  if (draft?.camera) {
    camera.position.x = draft.camera.x;
    camera.position.y = draft.camera.y;
    clampCamera();
  }
  setTool("select");
  syncInspector();
  if (draft) say("Restored editor draft");

  const clock = new THREE.Clock();
  let raf = 0;
  let elapsed = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    statusTimer = Math.max(0, statusTimer - dt);
    if (statusTimer === 0) statusEl.textContent = "";
    const pan = 420 / zoom * dt;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) camera.position.x -= pan;
    if (keys.has("KeyD") || keys.has("ArrowRight")) camera.position.x += pan;
    if (keys.has("KeyW") || keys.has("ArrowUp")) camera.position.y += pan;
    if (keys.has("KeyS") || keys.has("ArrowDown")) camera.position.y -= pan;
    clampCamera();
    updateOutline();
    updateLakeModel(backdrop.southernLake, elapsed);
    updateDriedPondModel(backdrop.berniePond, elapsed);
    updateIntakePipeModel(backdrop.intakePipe, elapsed, false);
    drawMinimap();
    renderer.render(scene, camera);
  }
  animate();

  return {
    dispose() {
      persist();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persistWhenHidden);
      window.removeEventListener("keyup", onKeyUp);
      resetModal.removeEventListener("click", closeResetOnBackdrop);
    },
  };
}

const editor = startEditor();
if (import.meta.hot) {
  import.meta.hot.dispose(() => editor.dispose());
}
