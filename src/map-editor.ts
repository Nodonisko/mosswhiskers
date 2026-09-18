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
  canHaveSickFoliage,
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
import { WORLD_GROUND, WORLD_PROPS } from "./world-props";
import { createWorldModel, paintWorldModel, WORLD_MODEL_SIZES, applyWorldPropPose } from "./world-models";
import {
  brushRadius,
  brushWorldSize,
  clampOpacity,
  clampSoftness,
  diskOuter,
  GROUND_BRUSH_SIZES,
  GROUND_KINDS,
  GROUND_LABELS,
  GROUND_MINIMAP,
  GROUND_OPACITY_DEFAULT,
  GROUND_SOFTNESS_DEFAULT,
  groundPixel,
  isGroundKind,
  markCoverage,
  markOpacity,
  markSoftness,
  paintGroundSwatch,
  type GroundBrushSize,
  type GroundKind,
} from "./ground";
import { createPixelCanvas, nearestTexture } from "./pixel-canvas";
import {
  EDITOR_DRAFT_KEY,
  EDITOR_OVERSCROLL_PX,
  NPC_LABELS,
  cameraPanBounds,
  copySelected,
  createEditorStore,
  duplicateSelected,
  pasteClipboard,
  editorPaletteItems,
  eraseGroundAt,
  fromEditorProps,
  cornerActionAt,
  mapClick,
  moveById,
  nextSeed,
  paintGroundAt,
  parseEditorDraft,
  parseWorldGroundJson,
  parseWorldPropsJson,
  placeableDefaultScale,
  placeableLabel,
  propCenter,
  propCorners,
  redo,
  removeSelected,
  replaceMap,
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
  const paletteList = required(root.querySelector(".palette-list"), "Palette list");
  const inspectEmpty = required(root.querySelector<HTMLElement>(".inspect-empty"), "Inspector empty");
  const inspectForm = required(root.querySelector<HTMLFormElement>(".inspect-form"), "Inspector form");
  const inspectKind = required(root.querySelector<HTMLElement>(".inspect-kind"), "Inspector kind");
  const statusEl = required(root.querySelector<HTMLElement>(".editor-status"), "Status");
  const minimap = required(root.querySelector<HTMLCanvasElement>(".minimap"), "Minimap");
  const minimapCtx = required(minimap.getContext("2d"), "Minimap context");
  const resetModal = required(root.querySelector<HTMLElement>(".editor-modal"), "Reset prompt");

  const draft = readDraft();
  const store = createEditorStore(draft?.props ?? WORLD_PROPS, draft?.ground ?? WORLD_GROUND);
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

  const brushPreview = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
  );
  brushPreview.position.z = 7;
  brushPreview.renderOrder = 35000;
  brushPreview.visible = false;
  world.add(brushPreview);

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

  const paletteProps = required(root.querySelector<HTMLElement>(".palette-props"), "Prop palette");
  const paletteGround = required(root.querySelector<HTMLElement>(".palette-ground"), "Ground palette");
  const groundList = required(root.querySelector(".ground-list"), "Ground list");
  let groundKind: GroundKind | "erase" = "furrow";
  let groundSize: GroundBrushSize = 2;
  let groundOpacity = GROUND_OPACITY_DEFAULT;
  let groundSoftness = GROUND_SOFTNESS_DEFAULT;
  const opacityInput = required(root.querySelector<HTMLInputElement>("[data-ground-opacity]"), "Opacity slider");
  const opacityValue = required(root.querySelector("[data-ground-opacity-value]"), "Opacity value");
  const softnessInput = required(root.querySelector<HTMLInputElement>("[data-ground-softness]"), "Softness slider");
  const softnessValue = required(root.querySelector("[data-ground-softness-value]"), "Softness value");

  function addGroundItem(id: GroundKind | "erase", label: string, swatch: HTMLElement) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = id === "erase" ? "palette-item ground-item is-erase" : "palette-item ground-item";
    button.dataset.ground = id;
    const name = document.createElement("span");
    name.textContent = label;
    button.append(swatch, name);
    groundList.append(button);
  }

  const eraseSwatch = document.createElement("span");
  eraseSwatch.className = "palette-swatch";
  eraseSwatch.textContent = "×";
  addGroundItem("erase", "Erase", eraseSwatch);
  for (const kind of GROUND_KINDS) {
    const swatch = paintGroundSwatch(kind);
    swatch.className = "palette-swatch";
    addGroundItem(kind, GROUND_LABELS[kind], swatch);
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
  let pointerOnCanvas = false;
  let lastClient = { x: 0, y: 0 };
  let placeRot = 0;
  let placeVariant = 0;
  let lastPlaceKind: PlaceableWorldKind = "pine";
  let lastPlaceVariant = 0;
  let painting = false;
  let paintErase = false;
  let paintRecorded = false;

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
    if (tool === "ground") return `ground-${groundKind}`;
    if (placeableVariantCount(tool) > 1) return `${tool}-${normalizePlaceVariant(tool, variant)}`;
    return tool;
  }

  function syncBrushPreview() {
    const size = 64;
    const { canvas: stamp, context } = createPixelCanvas(size, size);
    const image = context.createImageData(size, size);
    const pixels = image.data;
    const center = size / 2;
    const erase = groundKind === "erase";
    const worldR = brushRadius(groundSize);
    const outer = brushWorldSize(groundSize, groundSoftness) / 2;
    const paintKind: GroundKind = groundKind === "erase" ? "dirt" : groundKind;
    const probe = { x: 0, y: 0, r: worldR, kind: paintKind, opacity: groundOpacity, softness: groundSoftness };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const worldX = (x + 0.5 - center) / center * outer;
        const worldY = (y + 0.5 - center) / center * outer;
        const cover = markCoverage(probe, worldX, worldY);
        if (cover <= 0.02) continue;
        const index = (y * size + x) * 4;
        if (erase) {
          pixels[index] = 180;
          pixels[index + 1] = 70;
          pixels[index + 2] = 70;
          pixels[index + 3] = Math.round(88 * cover);
          continue;
        }
        const [r, g, b, a] = groundPixel(paintKind, x * 3, y * 3);
        pixels[index] = r;
        pixels[index + 1] = g;
        pixels[index + 2] = b;
        pixels[index + 3] = Math.round(a * 0.42 * cover);
      }
    }
    context.putImageData(image, 0, 0);
    const map = nearestTexture(stamp);
    const material = brushPreview.material as THREE.MeshBasicMaterial;
    material.map?.dispose();
    material.map = map;
    material.needsUpdate = true;
    const worldSize = brushWorldSize(groundSize, groundSoftness);
    brushPreview.scale.set(worldSize, worldSize, 1);
  }

  function brushPercent(value: number) {
    return `${Math.round(value * 100)}%`;
  }

  function groundSizeLabel() {
    return groundSize === 1 ? "S" : groundSize === 2 ? "M" : "L";
  }

  function syncBrushSliders() {
    opacityInput.value = String(Math.round(groundOpacity * 100));
    opacityValue.textContent = brushPercent(groundOpacity);
    softnessInput.value = String(Math.round(groundSoftness * 100));
    softnessValue.textContent = brushPercent(groundSoftness);
  }

  function syncGroundChrome() {
    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-ground]")) {
      button.classList.toggle("is-active", button.dataset.ground === groundKind);
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-ground-size]")) {
      button.classList.toggle("is-active", Number(button.dataset.groundSize) === groundSize);
    }
    syncBrushSliders();
    syncBrushPreview();
  }

  function setGroundKind(next: GroundKind | "erase") {
    groundKind = next;
    syncGroundChrome();
    if (store.tool === "ground") {
      say(next === "erase" ? "Erase ground" : `Brush ${GROUND_LABELS[next]}`);
      syncInspector();
    }
  }

  function setGroundSize(next: GroundBrushSize) {
    groundSize = next;
    syncGroundChrome();
    if (store.tool === "ground") {
      say(`Brush size ${next === 1 ? "small" : next === 2 ? "medium" : "large"}`);
      syncInspector();
    }
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
    if (isPlaceableWorldKind(tool)) {
      placeVariant = normalizePlaceVariant(tool, variant ?? placeVariant);
      lastPlaceKind = tool;
      lastPlaceVariant = placeVariant;
    } else {
      placeVariant = 0;
    }
    const active = paletteIdFor(tool);
    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-tool]")) {
      button.classList.toggle("is-active", (button.dataset.palette ?? button.dataset.tool) === active);
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
      button.classList.toggle("is-active", button.dataset.mode === (
        tool === "ground" ? "ground" : isPlaceableWorldKind(tool) ? "place" : "select"
      ));
    }
    paletteProps.hidden = tool === "ground";
    paletteGround.hidden = tool !== "ground";
    ghost.visible = false;
    brushPreview.visible = tool === "ground";
    canvas.style.cursor = tool === "select" ? "default" : "crosshair";
    if (isPlaceableWorldKind(tool)) setGhostKind(tool);
    if (tool === "ground") syncGroundChrome();
    syncInspector();
  }

  function currentView() {
    return {
      x: camera.position.x,
      y: camera.position.y,
      width: viewWidth,
      height: VIEW_HEIGHT / zoom,
    };
  }

  function currentCursor() {
    if (!pointerOnCanvas) return null;
    return screenToWorld(lastClient.x, lastClient.y);
  }

  function markPointer(event: { clientX: number; clientY: number }) {
    pointerOnCanvas = true;
    lastClient = { x: event.clientX, y: event.clientY };
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
    const viewHeight = VIEW_HEIGHT / zoom;
    const worldPerPixelX = viewWidth / Math.max(1, canvas.clientWidth);
    const worldPerPixelY = viewHeight / Math.max(1, canvas.clientHeight);
    const x = cameraPanBounds(
      MAP_WIDTH,
      viewWidth,
      EDITOR_OVERSCROLL_PX.left * worldPerPixelX,
      EDITOR_OVERSCROLL_PX.right * worldPerPixelX,
    );
    const y = cameraPanBounds(
      MAP_HEIGHT,
      viewHeight,
      EDITOR_OVERSCROLL_PX.bottom * worldPerPixelY,
      EDITOR_OVERSCROLL_PX.top * worldPerPixelY,
    );
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, x.min, x.max);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, y.min, y.max);
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
        ground: store.ground,
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

  let pendingGround: Array<{ x: number; y: number; r: number }> = [];
  let groundRaf = 0;

  function flushGround(full = false) {
    if (groundRaf) {
      cancelAnimationFrame(groundRaf);
      groundRaf = 0;
    }
    const dirty = pendingGround;
    pendingGround = [];
    if (full) backdrop.setGround(store.ground);
    else if (dirty.length) backdrop.setGround(store.ground, dirty);
  }

  function queueGround(dirty: Array<{ x: number; y: number; r: number }>) {
    pendingGround.push(...dirty);
    if (groundRaf) return;
    groundRaf = requestAnimationFrame(() => {
      groundRaf = 0;
      flushGround();
    });
  }

  function syncGround() {
    flushGround(true);
  }

  function mutated(groundChanged = false) {
    persistEnabled = true;
    syncSprites();
    if (groundChanged) syncGround();
    syncInspector();
    persist();
  }

  const field = (name: string) => inspectForm.elements.namedItem(name) as HTMLInputElement;

  function syncInspector() {
    const prop = selectedProp(store);
    if (store.tool === "ground") {
      inspectEmpty.hidden = false;
      inspectForm.hidden = true;
      inspectEmpty.textContent = groundKind === "erase"
        ? `Erase · size ${groundSizeLabel()} · opacity ${brushPercent(groundOpacity)} · softness ${brushPercent(groundSoftness)}. Drag to delete painted ground. Right-click also erases.`
        : `${GROUND_LABELS[groundKind]} · size ${groundSizeLabel()} · opacity ${brushPercent(groundOpacity)} · softness ${brushPercent(groundSoftness)}. Drag to paint. Right-click erases.`;
      return;
    }
    inspectEmpty.textContent = "Click a tree, plant, or NPC.";
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
    inspectForm.querySelector(".inspect-sick")?.toggleAttribute("hidden", !canHaveSickFoliage(prop.kind));
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
    if (store.tool === "select" && hover && !isUniqueNpcKind(hover.kind)) {
      const action = cornerActionAt(hover, x, y, handleHitRadius(), rotateHitRadius());
      if (action?.type === "rotate") return ROTATE_CURSOR;
      if (action?.type === "scale") return handleCursor(action.handle);
    }
    if (store.tool === "ground") return "crosshair";
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
    for (const mark of store.ground) {
      const at = toMap(mark.x, mark.y);
      if (mark.kind === "erase") ctx.globalCompositeOperation = "destination-out";
      else {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = GROUND_MINIMAP[mark.kind];
      }
      ctx.globalAlpha = markOpacity(mark);
      ctx.beginPath();
      ctx.arc(at.x, at.y, Math.max(1, diskOuter(mark.r, markSoftness(mark)) * sx), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
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
      sam: "#6b3e22",
      rabbit: "#fff8f0",
    };
      const flowerColors = ["#e7e8c9", "#6595ba", "#c591b1", "#e0c45a", "#d4843c", "#8a6aaa", "#c45a4a", "#f0ead0"] as const;
      for (const prop of store.props) {
        const at = toMap(prop.x, prop.y);
        ctx.fillStyle = prop.sick && canHaveSickFoliage(prop.kind)
          ? "#8a7a58"
          : prop.kind === "flowers"
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

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target === opacityInput) {
      groundOpacity = clampOpacity(Number(target.value) / 100);
      syncGroundChrome();
      if (store.tool === "ground") syncInspector();
      return;
    }
    if (target === softnessInput) {
      groundSoftness = clampSoftness(Number(target.value) / 100);
      syncGroundChrome();
      if (store.tool === "ground") syncInspector();
    }
  });

  root.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action], [data-tool], [data-mode], [data-ground], [data-ground-size]");
    if (!button) return;
    if (button.dataset.mode === "select") {
      setTool("select");
      return;
    }
    if (button.dataset.mode === "place") {
      setTool(lastPlaceKind, lastPlaceVariant);
      return;
    }
    if (button.dataset.mode === "ground") {
      setTool("ground");
      return;
    }
    if (button.dataset.groundSize) {
      const size = Number(button.dataset.groundSize);
      if (GROUND_BRUSH_SIZES.includes(size as GroundBrushSize)) setGroundSize(size as GroundBrushSize);
      return;
    }
    if (button.dataset.ground) {
      const next = button.dataset.ground;
      if (next === "erase" || isGroundKind(next)) {
        setTool("ground");
        setGroundKind(next);
      }
      return;
    }
    if (button.dataset.tool) {
      const tool = button.dataset.tool;
      if (isPlaceableWorldKind(tool)) {
        setTool(tool, Number(button.dataset.variant ?? 0));
      }
      return;
    }
    const action = button.dataset.action;
    if (action === "undo") {
      if (undo(store)) mutated(true);
    } else if (action === "redo") {
      if (redo(store)) mutated(true);
    } else if (action === "copy") {
      await copyText(serializeWorldPropsTs(fromEditorProps(store.props), store.ground), "world-props.ts");
    } else if (action === "import") {
      let text = "";
      try { text = await navigator.clipboard.readText(); } catch { /* fallback prompt */ }
      if (!text) text = window.prompt("Paste src/world-props.ts") ?? "";
      if (!text.trim()) return;
      const props = parseWorldPropsJson(text);
      const ground = parseWorldGroundJson(text);
      if (ground) replaceMap(store, props, ground);
      else replaceProps(store, props);
      mutated(Boolean(ground));
      say(ground ? "Imported props and ground" : "Imported");
    } else if (action === "reset") {
      resetModal.hidden = false;
    } else if (action === "reset-cancel") {
      resetModal.hidden = true;
    } else if (action === "reset-confirm") {
      resetModal.hidden = true;
      replaceMap(store, WORLD_PROPS, WORLD_GROUND);
      syncSprites();
      syncGround();
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
    markPointer(event);
    if (event.button === 1 || event.button === 2 || event.altKey) {
      panning = true;
      lastPointer = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0 && event.button !== 2) return;
    const at = screenToWorld(event.clientX, event.clientY);
    if (store.tool === "ground") {
      painting = true;
      paintErase = event.button === 2 || event.altKey || groundKind === "erase";
      paintRecorded = false;
      const dirty = paintErase
        ? eraseGroundAt(store, at.x, at.y, groundSize, true, groundOpacity, groundSoftness)
        : paintGroundAt(store, at.x, at.y, groundKind as GroundKind, groundSize, true, groundOpacity, groundSoftness);
      if (dirty.length) {
        paintRecorded = true;
        persistEnabled = true;
        queueGround(dirty);
      }
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    const selected = selectedProp(store);
    if (store.tool === "select" && selected && !isUniqueNpcKind(selected.kind)) {
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
    const action = mapClick(store, at.x, at.y, nextSeed(store), placeRot, placeVariant);
    if (action === "place") {
      const prop = selectedProp(store);
      if (prop && (prop.kind === "pine" || prop.kind === "oak") && isBernieWoods(prop.x, prop.y)) prop.sick = true;
      mutated();
      return;
    }
    if (action === "select") {
      dragging = true;
      dragRecorded = false;
      lastPointer = at;
      setTool("select");
      syncInspector();
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    syncInspector();
  });

  canvas.addEventListener("pointermove", (event) => {
    markPointer(event);
    const at = screenToWorld(event.clientX, event.clientY);
    if (painting) {
      const dirty = paintErase
        ? eraseGroundAt(store, at.x, at.y, groundSize, !paintRecorded, groundOpacity, groundSoftness)
        : paintGroundAt(store, at.x, at.y, groundKind as GroundKind, groundSize, !paintRecorded, groundOpacity, groundSoftness);
      if (dirty.length) {
        paintRecorded = true;
        persistEnabled = true;
        queueGround(dirty);
      }
      brushPreview.position.set(at.x, at.y, 7);
      return;
    }
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
    if (isPlaceableWorldKind(store.tool)) {
      ghost.visible = true;
      ghost.position.set(at.x, at.y + ghostLift(store.tool), 0);
    } else {
      ghost.visible = false;
    }
    if (store.tool === "ground") {
      brushPreview.visible = true;
      brushPreview.position.set(at.x, at.y, 7);
    } else {
      brushPreview.visible = false;
    }
    canvas.style.cursor = hoverCursor(at.x, at.y);
  });

  function endPointer(event: PointerEvent) {
    if (painting && paintRecorded) flushGround();
    if ((dragging && dragRecorded) || (resizing && dragRecorded) || (rotating && dragRecorded) || panning || (painting && paintRecorded)) persistView();
    dragging = false;
    resizing = false;
    rotating = false;
    painting = false;
    paintErase = false;
    resizeOrigin = null;
    panning = false;
    canvas.style.cursor = store.tool === "select" ? "default" : "crosshair";
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* already released */ }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerenter", markPointer);
  canvas.addEventListener("pointerleave", () => {
    pointerOnCanvas = false;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("wheel", (event) => {
    markPointer(event);
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
      if (event.shiftKey ? redo(store) : undo(store)) mutated(true);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.code === "KeyY") {
      event.preventDefault();
      if (redo(store)) mutated(true);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.code === "KeyC") {
      event.preventDefault();
      const copied = copySelected(store);
      if (copied && isPlaceableWorldKind(copied.kind)) {
        say(`Copied ${placeableLabel(copied.kind, copied.variant)}`);
      } else if (selectedProp(store) && isUniqueNpcKind(selectedProp(store)!.kind)) {
        say("Unique NPCs cannot be copied");
      }
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.code === "KeyV") {
      event.preventDefault();
      if (pasteClipboard(store, currentView(), currentCursor())) mutated();
      else say("Nothing to paste");
      return;
    }
    if (event.code === "KeyR") {
      event.preventDefault();
      rotateCurrent(event.shiftKey ? -15 : 15);
      return;
    }
    if (event.code === "KeyB") {
      event.preventDefault();
      setTool("ground");
      return;
    }
    if (event.code === "KeyE" && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      setTool("ground");
      setGroundKind(groundKind === "erase" ? "furrow" : "erase");
      return;
    }
    if (event.code === "BracketLeft" || event.code === "Minus") {
      event.preventDefault();
      setGroundSize(groundSize === 3 ? 2 : 1);
      return;
    }
    if (event.code === "BracketRight" || event.code === "Equal") {
      event.preventDefault();
      setGroundSize(groundSize === 1 ? 2 : 3);
      return;
    }
    if (event.code === "Escape" || (event.code === "KeyV" && !event.metaKey && !event.ctrlKey)) {
      setTool("select");
    }
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
  syncGroundChrome();
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
      if (groundRaf) cancelAnimationFrame(groundRaf);
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
