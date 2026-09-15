import { describe, expect, test } from "bun:test";
import { createWalkable, createWorldLayout } from "./world";
import { LAKE_X, LAKE_Y, MAILBOX, PIER_X, PIER_Y } from "./world-config";

describe("createWorldLayout", () => {
  test("the same seed produces the same props, mice, and fish", () => {
    const a = createWorldLayout();
    const b = createWorldLayout();
    expect(a.props).toEqual(b.props);
    expect(a.mice).toEqual(b.mice);
    expect(a.fish).toEqual(b.fish);
    expect(a.trunks).toEqual(b.trunks);
    expect(a.interactables).toEqual(b.interactables);
    expect(a.mice.length).toBeGreaterThan(0);
    expect(a.fish.map((fish) => fish.id)).toEqual(["fish-pike", "fish-perch", "fish-bluegill"]);
    expect(a.interactables).toEqual([{ id: "mailbox", kind: "mailbox", x: MAILBOX.x, y: MAILBOX.y }]);
  });

  test("mice have stable ids a host can address", () => {
    const layout = createWorldLayout();
    const ids = layout.mice.map((mouse) => mouse.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("mouse-"))).toBe(true);
  });
});

describe("createWalkable", () => {
  const walkable = createWalkable(createWorldLayout().trunks);

  test("the colony spawn is walkable", () => {
    expect(walkable(0, -5)).toBe(true);
  });

  test("the lake interior is blocked except on the pier", () => {
    expect(walkable(LAKE_X, LAKE_Y)).toBe(false);
    expect(walkable(PIER_X, PIER_Y)).toBe(true);
  });
});
