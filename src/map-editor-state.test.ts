import { describe, expect, test } from "bun:test";
import { WORLD_GROUND, WORLD_PROPS } from "./world-props";
import { FARM } from "./world-config";
import { isAuthorableWorldKind, isUniqueNpcKind, nextRotation, normalizeRotation, UNIQUE_NPC_KINDS, canHaveSickFoliage } from "./world-config";
import { farmPlotGround, groundKindAt, sampleGround } from "./ground";
import {
  createEditorStore,
  cameraPanBounds,
  copySelected,
  cornerActionAt,
  duplicateSelected,
  editorPaletteItems,
  ensureUniqueNpcs,
  eraseGroundAt,
  fromEditorProps,
  handleIndexAt,
  hitContains,
  hitTest,
  mapClick,
  paintGroundAt,
  parseEditorDraft,
  parseWorldGroundJson,
  parseWorldPropsJson,
  pasteClipboard,
  placeAt,
  propCenter,
  propCorners,
  removeSelected,
  rotateByPointer,
  rotateSelected,
  scaleByHandle,
  selectAt,
  serializeEditorDraft,
  serializeWorldPropsTs,
  undo,
  updateById,
} from "./map-editor-state";
import { sickFoliageColor } from "./world-models";

describe("map editor props", () => {
  test("authored props are vegetation plus one of each NPC", () => {
    expect(WORLD_PROPS.every((prop) => isAuthorableWorldKind(prop.kind))).toBe(true);
    for (const kind of UNIQUE_NPC_KINDS) {
      expect(WORLD_PROPS.filter((prop) => prop.kind === kind)).toHaveLength(1);
    }
  });

  test("TypeScript export round-trips through import, including lamps", () => {
    const source = serializeWorldPropsTs(WORLD_PROPS, WORLD_GROUND);
    const parsed = parseWorldPropsJson(source);
    expect(parsed.filter((prop) => prop.kind === "lamp")).toHaveLength(2);
    expect(parsed.filter((prop) => prop.kind === "lamp")).toEqual(
      WORLD_PROPS.filter((prop) => prop.kind === "lamp"),
    );
  });

  test("JSON import drops buildings and extra NPCs, and restores missing ones", () => {
    const parsed = parseWorldPropsJson(JSON.stringify([
      { kind: "pine", x: 10, y: 20, scale: 1.2, seed: 4, variant: 1 },
      { kind: "bernie", x: -100, y: 50, scale: 9, seed: 3, variant: 2 },
      { kind: "bernie", x: 0, y: 0, scale: 1, seed: 1, variant: 0 },
      { kind: "hut", x: 1, y: 2, scale: 1, seed: 1, variant: 0 },
      { kind: "carrot", x: 3, y: 4, scale: 1, seed: 1, variant: 0 },
    ]));
    expect(parsed.filter((prop) => prop.kind === "pine")).toEqual([
      expect.objectContaining({ kind: "pine", x: 10, y: 20 }),
    ]);
    expect(parsed.filter((prop) => prop.kind === "bernie")).toEqual([
      expect.objectContaining({ kind: "bernie", x: -100, y: 50, scale: 2.05 }),
    ]);
    expect(parsed.some((prop) => prop.kind === "hut" || prop.kind === "carrot")).toBe(false);
    expect(parsed.filter((prop) => isUniqueNpcKind(prop.kind)).map((prop) => prop.kind).sort()).toEqual([
      "bernie",
      "rabbit",
      "sam",
    ]);
  });

  test("NPCs cannot be deleted, vegetation can", () => {
    const store = createEditorStore([
      { kind: "bush", x: 0, y: 0, scale: 1, seed: 1, variant: 0 },
      { kind: "bernie", x: 40, y: 10, scale: 2.05, seed: 0, variant: 0 },
    ]);
    const bernie = store.props.find((prop) => prop.kind === "bernie")!;
    store.selectedId = bernie.id;
    expect(removeSelected(store)).toBe(false);
    expect(store.props.some((prop) => prop.kind === "bernie")).toBe(true);

    const bush = store.props.find((prop) => prop.kind === "bush")!;
    store.selectedId = bush.id;
    expect(removeSelected(store)).toBe(true);
    expect(store.props.some((prop) => prop.kind === "bush")).toBe(false);
  });

  test("palette lists each flower color and placing keeps that variant", () => {
    expect(editorPaletteItems().filter((item) => item.kind === "flowers")).toEqual([
      { id: "flowers-0", kind: "flowers", variant: 0, label: "White flowers" },
      { id: "flowers-1", kind: "flowers", variant: 1, label: "Blue flowers" },
      { id: "flowers-2", kind: "flowers", variant: 2, label: "Pink flowers" },
      { id: "flowers-3", kind: "flowers", variant: 3, label: "Yellow flowers" },
      { id: "flowers-4", kind: "flowers", variant: 4, label: "Orange flowers" },
      { id: "flowers-5", kind: "flowers", variant: 5, label: "Purple flowers" },
      { id: "flowers-6", kind: "flowers", variant: 6, label: "Red flowers" },
      { id: "flowers-7", kind: "flowers", variant: 7, label: "Daisies" },
    ]);
    expect(editorPaletteItems().some((item) => item.kind === "mushroom" && item.label === "Toadstool")).toBe(true);
    expect(editorPaletteItems().some((item) => item.kind === "wheat")).toBe(true);
    const store = createEditorStore([]);
    expect(placeAt(store, "flowers", 0, 0, 1, 0, 0).variant).toBe(0);
    expect(placeAt(store, "flowers", 10, 0, 2, 0, 1).variant).toBe(1);
    expect(placeAt(store, "flowers", 20, 0, 3, 0, 2).variant).toBe(2);
    expect(placeAt(store, "flowers", 30, 0, 4, 0, 5).variant).toBe(5);
    expect(placeAt(store, "flowers", 40, 0, 5, 0, 8).variant).toBe(0);
    expect(placeAt(store, "mushroom", 50, 0, 6, 0, 3)).toEqual(expect.objectContaining({ variant: 3, scale: 0.6 }));
    expect(placeAt(store, "grass", 60, 0, 7, 0, 5)).toEqual(expect.objectContaining({ variant: 2, scale: 1 }));
  });

  test("placing, undoing, and TypeScript export keep a single Bernie", () => {
    const store = createEditorStore(WORLD_PROPS);
    const before = store.props.length;
    placeAt(store, "oak", 12, -8, 77);
    expect(store.props.length).toBe(before + 1);
    undo(store);
    expect(store.props.length).toBe(before);
    const source = serializeWorldPropsTs(fromEditorProps(store.props));
    expect(source).toContain('kind: "bernie"');
    expect(source.match(/kind: "bernie"/g)?.length).toBe(1);
    expect(ensureUniqueNpcs(WORLD_PROPS).filter((prop) => prop.kind === "sam")).toHaveLength(1);
  });

  test("hit testing prefers the southern overlapping sprite", () => {
    const low = { id: 1, kind: "bush" as const, x: 0, y: 0, scale: 2, seed: 1, variant: 0 };
    const high = { id: 2, kind: "bush" as const, x: 0, y: 20, scale: 2, seed: 1, variant: 0 };
    expect(hitTest([low, high], 0, 30)?.id).toBe(1);
  });

  test("camera pan allows overscroll past the map so edges can clear the chrome", () => {
    expect(cameraPanBounds(4000, 1000, 200, 250)).toEqual({ min: -1700, max: 1750 });
    expect(cameraPanBounds(4000, 5000, 200, 250)).toEqual({ min: -200, max: 250 });
  });

  test("a stamp plants on occupied ground; only the select tool picks", () => {
    const store = createEditorStore([
      { kind: "bush", x: 0, y: 0, scale: 1, seed: 1, variant: 0 },
    ]);
    const bush = store.props.find((prop) => prop.kind === "bush")!;
    store.tool = "flowers";
    expect(mapClick(store, 0, 10, 2, 0, 0)).toBe("place");
    expect(store.props.filter((prop) => prop.kind === "flowers")).toHaveLength(1);
    expect(store.selectedId).not.toBe(bush.id);

    store.tool = "select";
    expect(mapClick(store, 0, 10, 3, 0, 0)).toBe("select");
    expect(store.selectedId).toBe(bush.id);
    expect(store.props.filter((prop) => prop.kind === "flowers")).toHaveLength(1);
  });

  test("selecting empty ground clears the selection", () => {
    const store = createEditorStore(WORLD_PROPS);
    const npc = store.props.find((prop) => prop.kind === "bernie")!;
    store.selectedId = npc.id;
    expect(selectAt(store, 1900, -1300)).toBeUndefined();
    expect(store.selectedId).toBeNull();
  });

  test("editor draft round-trips props and camera, and ignores junk", () => {
    const raw = serializeEditorDraft({
      props: [{ kind: "lamp", x: 11, y: -4, scale: 1, seed: 2, variant: 0 }],
      camera: { x: 40, y: -12, zoom: 0.8 },
    });
    const draft = parseEditorDraft(raw);
    expect(draft?.camera).toEqual({ x: 40, y: -12, zoom: 0.8 });
    expect(draft?.props.filter((prop) => prop.kind === "lamp")).toEqual([
      expect.objectContaining({ kind: "lamp", x: 11, y: -4 }),
    ]);
    expect(parseEditorDraft(JSON.stringify([{ kind: "pine", x: 1, y: 2, scale: 1, seed: 1, variant: 0 }]))?.props)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: "pine", x: 1, y: 2 })]));
    expect(parseEditorDraft("not json")).toBeNull();
    expect(parseEditorDraft(null)).toBeNull();
  });

  test("ground brush paints, erases, and undo restores Hopsk's field", () => {
    const farm = farmPlotGround();
    const store = createEditorStore([], farm);
    expect(groundKindAt(store.ground, FARM.x, FARM.y)).toBe("furrow");
    expect(paintGroundAt(store, 80, 40, "moss", 1, true).length).toBeGreaterThan(0);
    expect(groundKindAt(store.ground, 80, 40)).toBe("moss");
    expect(eraseGroundAt(store, FARM.x, FARM.y, 2, true).length).toBeGreaterThan(0);
    expect(groundKindAt(store.ground, FARM.x, FARM.y)).toBeUndefined();
    expect(undo(store)).toBe(true);
    expect(groundKindAt(store.ground, FARM.x, FARM.y)).toBe("furrow");
    expect(groundKindAt(store.ground, 80, 40)).toBe("moss");
    const source = serializeWorldPropsTs([], store.ground);
    expect(source).toContain('kind: "moss"');
    expect(parseWorldGroundJson(source)?.some((mark) => mark.kind === "moss")).toBe(true);
    expect(parseWorldGroundJson(JSON.stringify([{ kind: "pine", x: 1, y: 2, scale: 1, seed: 1, variant: 0 }]))).toBeUndefined();
  });

  test("separate clicks stay as dots; only a drag strokes between them", () => {
    const store = createEditorStore([]);
    expect(paintGroundAt(store, 0, 0, "dirt", 1, true).length).toBe(1);
    expect(paintGroundAt(store, 120, 0, "dirt", 1, true).length).toBe(1);
    expect(store.ground.filter((mark) => mark.kind === "dirt")).toHaveLength(2);
    expect(groundKindAt(store.ground, 0, 0)).toBe("dirt");
    expect(groundKindAt(store.ground, 120, 0)).toBe("dirt");
    expect(groundKindAt(store.ground, 60, 0)).toBeUndefined();

    const dragged = createEditorStore([]);
    paintGroundAt(dragged, 0, 0, "dirt", 1, true);
    paintGroundAt(dragged, 120, 0, "dirt", 1, false);
    expect(dragged.ground.length).toBeGreaterThan(2);
    expect(groundKindAt(dragged.ground, 60, 0)).toBe("dirt");
  });

  test("ground brush stores opacity and softness on stamps", () => {
    const store = createEditorStore([]);
    expect(paintGroundAt(store, 10, 20, "sand", 1, true, 0.4, 0.2).length).toBe(1);
    expect(store.ground.at(-1)).toEqual({ x: 10, y: 20, r: 24, kind: "sand", opacity: 0.4, softness: 0.2 });
    const source = serializeWorldPropsTs([], store.ground);
    expect(source).toContain("opacity: 0.4");
    expect(source).toContain("softness: 0.2");
    expect(parseWorldGroundJson(source)).toEqual([
      { x: 10, y: 20, r: 24, kind: "sand", opacity: 0.4, softness: 0.2 },
    ]);
    expect(paintGroundAt(store, 10, 20, "sand", 1, true, 0.4, 0.2).length).toBe(1);
    expect(store.ground).toHaveLength(2);
    expect(sampleGround(store.ground, 10, 20)?.alpha).toBeCloseTo(0.64);
  });

  test("editor draft keeps painted ground next to props", () => {
    const raw = serializeEditorDraft({
      props: [{ kind: "lamp", x: 11, y: -4, scale: 1, seed: 2, variant: 0 }],
      ground: [{ x: 84, y: -36, r: 24, kind: "sand" }],
      camera: { x: 40, y: -12, zoom: 0.8 },
    });
    const draft = parseEditorDraft(raw);
    expect(draft?.ground).toEqual([{ x: 84, y: -36, r: 24, kind: "sand" }]);
  });

  test("editor draft keeps stamp opacity and softness", () => {
    const raw = serializeEditorDraft({
      props: [],
      ground: [{ x: 12, y: -8, r: 24, kind: "moss", opacity: 0.4, softness: 0.2 }],
      camera: { x: 0, y: 0, zoom: 0.55 },
    });
    const draft = parseEditorDraft(raw);
    expect(draft?.ground).toEqual([{ x: 12, y: -8, r: 24, kind: "moss", opacity: 0.4, softness: 0.2 }]);
  });

  test("duplicate skips NPCs", () => {
    const store = createEditorStore(WORLD_PROPS);
    const npc = store.props.find((prop) => prop.kind === "sam")!;
    store.selectedId = npc.id;
    expect(duplicateSelected(store)).toBeUndefined();
    expect(store.props.filter((prop) => prop.kind === "sam")).toHaveLength(1);
  });

  test("copy and paste clones a placeable but not an NPC", () => {
    const store = createEditorStore([
      { kind: "willow", x: 10, y: 20, scale: 1.2, seed: 4, variant: 1, sick: true },
      { kind: "bernie", x: 40, y: 10, scale: 2.05, seed: 0, variant: 0 },
    ]);
    const bernie = store.props.find((prop) => prop.kind === "bernie")!;
    store.selectedId = bernie.id;
    expect(copySelected(store)).toBeUndefined();
    expect(pasteClipboard(store)).toBeUndefined();

    const willow = store.props.find((prop) => prop.kind === "willow")!;
    store.selectedId = willow.id;
    expect(copySelected(store)).toEqual(expect.objectContaining({
      kind: "willow",
      x: 10,
      y: 20,
      scale: 1.2,
      sick: true,
    }));
    const pasted = pasteClipboard(store);
    expect(pasted).toEqual(expect.objectContaining({
      kind: "willow",
      x: 34,
      y: 2,
      scale: 1.2,
      seed: 4,
      variant: 1,
      sick: true,
    }));
    expect(store.selectedId).toBe(pasted!.id);
    expect(store.props.filter((prop) => prop.kind === "willow")).toHaveLength(2);

    const again = pasteClipboard(store);
    expect(again).toEqual(expect.objectContaining({ kind: "willow", x: 58, y: -16 }));
  });

  test("paste always follows the pointer, or the view center if the pointer is gone", () => {
    const store = createEditorStore([
      { kind: "bush", x: 0, y: 0, scale: 1, seed: 1, variant: 0 },
    ]);
    const bush = store.props.find((prop) => prop.kind === "bush")!;
    store.selectedId = bush.id;
    expect(copySelected(store)).toBeDefined();
    expect(pasteClipboard(store, { x: 0, y: 0 }, { x: 80, y: 40 })).toEqual(expect.objectContaining({ x: 80, y: 40 }));
    expect(pasteClipboard(store, { x: 0, y: 0 }, { x: 120, y: -10 })).toEqual(expect.objectContaining({ x: 120, y: -10 }));
    expect(pasteClipboard(store, { x: 400, y: -80 }, null)).toEqual(expect.objectContaining({ x: 400, y: -80 }));
  });

  test("sick foliage is kept on leafy plants and ignored on rocks and lamps", () => {
    expect(canHaveSickFoliage("bush")).toBe(true);
    expect(canHaveSickFoliage("fern")).toBe(true);
    expect(canHaveSickFoliage("lamp")).toBe(false);
    expect(canHaveSickFoliage("stone")).toBe(false);
    expect(canHaveSickFoliage("bernie")).toBe(false);
    expect(sickFoliageColor("#507231")).not.toBe("#507231");
    expect(sickFoliageColor("#b08a50")).toBe("#b08a50");

    const store = createEditorStore([
      { kind: "bush", x: 0, y: 0, scale: 1, seed: 1, variant: 0 },
      { kind: "lamp", x: 8, y: 8, scale: 1, seed: 2, variant: 0 },
    ]);
    const bush = store.props.find((prop) => prop.kind === "bush")!;
    updateById(store, bush.id, { sick: true });
    expect(bush.sick).toBe(true);
    const source = serializeWorldPropsTs(fromEditorProps(store.props));
    expect(source).toContain("sick: true");
    expect(parseWorldPropsJson(source).find((prop) => prop.kind === "bush")?.sick).toBe(true);

    const lamp = store.props.find((prop) => prop.kind === "lamp")!;
    updateById(store, lamp.id, { sick: true });
    expect(lamp.sick).toBeUndefined();
  });

  test("fences and logs keep any angle, including 45°", () => {
    expect(normalizeRotation(370)).toBe(10);
    expect(normalizeRotation(-15)).toBe(345);
    expect(nextRotation(0)).toBe(15);
    expect(nextRotation(350, 15)).toBe(5);
    const fence = { kind: "fence" as const, x: 0, y: 0, scale: 1, seed: 1, variant: 0 };
    expect(hitContains(fence, 30, 10)).toBe(true);
    expect(hitContains({ ...fence, rot: 90 }, 30, 10)).toBe(false);
    expect(hitContains({ ...fence, rot: 90 }, 0, 40)).toBe(true);
    expect(hitContains(fence, 0, 40)).toBe(false);
    const source = serializeWorldPropsTs([{ ...fence, rot: 45 }]);
    expect(source).toContain("rot: 45");
    expect(parseWorldPropsJson(source).find((prop) => prop.kind === "fence")?.rot).toBe(45);
    const mossLog = { kind: "mossLog" as const, x: 0, y: 0, scale: 1, seed: 1, variant: 0, rot: 90 };
    expect(parseWorldPropsJson(serializeWorldPropsTs([mossLog])).find((prop) => prop.kind === "mossLog")?.rot).toBe(90);
    const store = createEditorStore([fence]);
    const placed = store.props.find((prop) => prop.kind === "fence")!;
    store.selectedId = placed.id;
    expect(rotateSelected(store, 22.5)).toBe(true);
    expect(placed.rot).toBe(22.5);
  });

  test("corner handles scale uniformly and keep the opposite corner fixed", () => {
    const store = createEditorStore([
      { kind: "bush", x: 0, y: 0, scale: 1, seed: 1, variant: 0 },
      { kind: "bernie", x: 40, y: 10, scale: 2.05, seed: 0, variant: 0 },
    ]);
    const bush = store.props.find((prop) => prop.kind === "bush")!;
    const origin = { ...bush };
    const corners = propCorners(origin);
    expect(handleIndexAt(bush, corners[1]!.x, corners[1]!.y, 8)).toBe(1);
    const bernie = store.props.find((prop) => prop.kind === "bernie")!;
    expect(handleIndexAt(bernie, bernie.x, bernie.y, 80)).toBeUndefined();

    const opposite = corners[3]!;
    const dragged = corners[1]!;
    scaleByHandle(
      store,
      bush.id,
      1,
      origin,
      opposite.x + (dragged.x - opposite.x) * 2,
      opposite.y + (dragged.y - opposite.y) * 2,
      true,
    );
    expect(bush.scale).toBe(2);
    const nextOpposite = propCorners(bush)[3]!;
    expect(nextOpposite.x).toBeCloseTo(opposite.x);
    expect(nextOpposite.y).toBeCloseTo(opposite.y);
  });

  test("a little outside a fence corner rotates instead of scaling", () => {
    const fence = { kind: "fence" as const, x: 0, y: 0, scale: 1, seed: 1, variant: 0 };
    const bush = { kind: "bush" as const, x: 0, y: 0, scale: 1, seed: 1, variant: 0 };
    const corners = propCorners(fence);
    const center = propCenter(fence);
    const se = corners[1]!;
    const len = Math.hypot(se.x - center.x, se.y - center.y);
    const far = {
      x: se.x + ((se.x - center.x) / len) * 18,
      y: se.y + ((se.y - center.y) / len) * 18,
    };
    expect(cornerActionAt(fence, se.x, se.y, 8, 30)).toEqual({ type: "scale", handle: 1 });
    expect(cornerActionAt(fence, far.x, far.y, 8, 30)).toEqual({ type: "rotate", handle: 1 });
    expect(cornerActionAt(bush, far.x, far.y, 8, 30)?.type).not.toBe("rotate");
    const store = createEditorStore([fence]);
    const placed = store.props.find((prop) => prop.kind === "fence")!;
    const box = propCenter(placed);
    rotateByPointer(store, placed.id, { ...placed }, 0, box.x, box.y + 40, true);
    expect(placed.rot).toBe(90);
  });
});
