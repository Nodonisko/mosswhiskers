import { describe, expect, test } from "bun:test";
import { JOYSTICK_DEADZONE, joystickFromOffset, mergeInputs, moveFromKeys } from "./input";

describe("moveFromKeys", () => {
  test("idle is a zero vector", () => {
    expect(moveFromKeys(new Set())).toEqual({ x: 0, y: 0 });
  });

  test("diagonal input is normalized", () => {
    const move = moveFromKeys(new Set(["w", "d"]));
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1);
    expect(move.x).toBeCloseTo(Math.SQRT1_2);
    expect(move.y).toBeCloseTo(Math.SQRT1_2);
  });
});

describe("joystickFromOffset", () => {
  test("origin and tiny nudges stay idle", () => {
    expect(joystickFromOffset(0, 0, 50)).toEqual({ x: 0, y: 0 });
    expect(joystickFromOffset(50 * JOYSTICK_DEADZONE * 0.5, 0, 50)).toEqual({ x: 0, y: 0 });
  });

  test("screen right is +x and screen up is +y", () => {
    const east = joystickFromOffset(50, 0, 50);
    expect(east.x).toBeCloseTo(1);
    expect(east.y).toBeCloseTo(0);
    const north = joystickFromOffset(0, -50, 50);
    expect(north.x).toBeCloseTo(0);
    expect(north.y).toBeCloseTo(1);
  });

  test("past the rim clamps to unit length", () => {
    const move = joystickFromOffset(80, -80, 50);
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1);
    expect(move.x).toBeCloseTo(Math.SQRT1_2);
    expect(move.y).toBeCloseTo(Math.SQRT1_2);
  });

  test("a half-tilt is analog after the deadzone", () => {
    const move = joystickFromOffset(25, 0, 50);
    expect(move.y).toBeCloseTo(0);
    expect(move.x).toBeGreaterThan(0);
    expect(move.x).toBeLessThan(1);
  });
});

describe("mergeInputs", () => {
  test("keeps analog magnitude from one source", () => {
    expect(mergeInputs({ x: 0.4, y: 0 }, { x: 0, y: 0 })).toEqual({
      x: 0.4,
      y: 0,
      claw: false,
      interact: false,
    });
  });

  test("clamps stacked full tilts and ORs actions", () => {
    const move = mergeInputs({ x: 1, y: 0, claw: true }, { x: 1, y: 0, interact: true });
    expect(move.x).toBeCloseTo(1);
    expect(move.y).toBeCloseTo(0);
    expect(move.claw).toBe(true);
    expect(move.interact).toBe(true);
  });
});
