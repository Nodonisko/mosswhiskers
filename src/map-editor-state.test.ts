import { describe, expect, test } from "bun:test";
import { WORLD_PROPS } from "./world-props";
import { isAuthorableWorldKind, isUniqueNpcKind, nextRotation, normalizeRotation, UNIQUE_NPC_KINDS } from "./world-config";
import {
  createEditorStore,
  cornerActionAt,
  duplicateSelected,
  editorPaletteItems,
  ensureUniqueNpcs,
  fromEditorProps,
  handleIndexAt,
  hitContains,
  hitTest,
  parseEditorDraft,
  parseWorldPropsJson,
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
} from "./map-editor-state";

describe("map editor props", () => {
  test("authored props are vegetation plus one of each NPC", () => {
    expect(WORLD_PROPS.every((prop) => isAuthorableWorldKind(prop.kind))).toBe(true);
    for (const kind of UNIQUE_NPC_KINDS) {
      expect(WORLD_PROPS.filter((prop) => prop.kind === kind)).toHaveLength(1);
    }
  });

  test("TypeScript export round-trips through import, including lamps", () => {
    const source = serializeWorldPropsTs(WORLD_PROPS);
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
    ]);
    const store = createEditorStore([]);
    expect(placeAt(store, "flowers", 0, 0, 1, 0, 0).variant).toBe(0);
    expect(placeAt(store, "flowers", 10, 0, 2, 0, 1).variant).toBe(1);
    expect(placeAt(store, "flowers", 20, 0, 3, 0, 2).variant).toBe(2);
    expect(placeAt(store, "flowers", 30, 0, 4, 0, 5).variant).toBe(2);
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

  test("duplicate skips NPCs", () => {
    const store = createEditorStore(WORLD_PROPS);
    const npc = store.props.find((prop) => prop.kind === "sam")!;
    store.selectedId = npc.id;
    expect(duplicateSelected(store)).toBeUndefined();
    expect(store.props.filter((prop) => prop.kind === "sam")).toHaveLength(1);
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
