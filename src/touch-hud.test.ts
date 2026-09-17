import { expect, test } from "bun:test";
import { interactButtonLabel, shouldShowTouchControls } from "./touch-hud";

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

test("hides the joystick on a mouse-only computer", () => {
  expect(shouldShowTouchControls({
    maxTouchPoints: 0,
    pointerCoarse: false,
    hoverNone: false,
    touchUnlocked: false,
  })).toBe(false);
});

test("does not treat a desktop click as a phone", () => {
  expect(shouldShowTouchControls({
    maxTouchPoints: 0,
    pointerCoarse: false,
    hoverNone: true,
    touchUnlocked: true,
  })).toBe(false);
});

test("shows the joystick on a phone", () => {
  expect(shouldShowTouchControls({
    maxTouchPoints: 5,
    pointerCoarse: true,
    hoverNone: true,
    touchUnlocked: false,
  })).toBe(true);
});

test("shows the joystick after a real touch on a tablet with a trackpad", () => {
  expect(shouldShowTouchControls({
    maxTouchPoints: 5,
    pointerCoarse: false,
    hoverNone: false,
    touchUnlocked: true,
  })).toBe(true);
});
