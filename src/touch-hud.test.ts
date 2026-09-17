import { expect, test } from "bun:test";
import { interactButtonLabel } from "./touch-hud";

test("defaults to USE away from people", () => {
  expect(interactButtonLabel(null)).toBe("USE");
  expect(interactButtonLabel(undefined)).toBe("USE");
  expect(interactButtonLabel("mailbox")).toBe("USE");
  expect(interactButtonLabel("intake")).toBe("USE");
});

test("says TALK beside an NPC", () => {
  expect(interactButtonLabel("bernie")).toBe("TALK");
  expect(interactButtonLabel("sam")).toBe("TALK");
  expect(interactButtonLabel("rabbit")).toBe("TALK");
});
