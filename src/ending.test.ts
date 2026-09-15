import { describe, expect, test } from "bun:test";
import {
  createEndingSequence,
  ENDING_LINES,
  ENDING_TIMING,
  shouldStartEnding,
} from "./ending";

function playUntilWait() {
  const ending = createEndingSequence();
  ending.start();
  const { fadeBlack, lineIn, lineHold, lineOut, promptIn } = ENDING_TIMING;
  const throughLines = fadeBlack
    + lineIn + lineHold[0]! + lineOut
    + lineIn + lineHold[1]! + lineOut
    + lineIn + lineHold[2]!
    + promptIn;
  ending.tick(throughLines);
  return ending;
}

describe("shouldStartEnding", () => {
  test("starts once victory talk closes", () => {
    expect(shouldStartEnding(false, true, false)).toBe(true);
  });

  test("does not start while victory talk is still open", () => {
    expect(shouldStartEnding(true, true, false)).toBe(false);
  });

  test("does not start twice", () => {
    expect(shouldStartEnding(false, true, true)).toBe(false);
  });
});

describe("createEndingSequence", () => {
  test("fades to black before the first line", () => {
    const ending = createEndingSequence();
    ending.start();
    ending.tick(ENDING_TIMING.fadeBlack * 0.5);
    const mid = ending.view();
    expect(mid.visible).toBe(true);
    expect(mid.blocking).toBe(true);
    expect(mid.lineOpacity).toBe(0);
    expect(mid.overlay).toBeGreaterThan(0.4);
    expect(mid.overlay).toBeLessThan(1);
    expect(mid.canDismiss).toBe(false);
  });

  test("shows each line in turn, then the prompt", () => {
    const ending = createEndingSequence();
    ending.start();
    ending.tick(ENDING_TIMING.fadeBlack + ENDING_TIMING.lineIn);
    expect(ending.view().line).toBe(ENDING_LINES[0]);
    expect(ending.view().lineOpacity).toBeCloseTo(1);
    expect(ending.view().promptOpacity).toBe(0);

    ending.tick(ENDING_TIMING.lineHold[0]! + ENDING_TIMING.lineOut + ENDING_TIMING.lineIn);
    expect(ending.view().line).toBe(ENDING_LINES[1]);
    expect(ending.view().lineOpacity).toBeCloseTo(1);

    ending.tick(ENDING_TIMING.lineHold[1]! + ENDING_TIMING.lineOut + ENDING_TIMING.lineIn);
    expect(ending.view().line).toBe(ENDING_LINES[2]);
    expect(ending.view().promptOpacity).toBe(0);

    ending.tick(ENDING_TIMING.lineHold[2]! + ENDING_TIMING.promptIn);
    const ready = ending.view();
    expect(ready.line).toBe(ENDING_LINES[2]);
    expect(ready.lineOpacity).toBeCloseTo(1);
    expect(ready.promptOpacity).toBeCloseTo(1);
    expect(ready.canDismiss).toBe(true);
  });

  test("space does nothing until the last line and prompt are up", () => {
    const ending = createEndingSequence();
    ending.start();
    ending.tick(ENDING_TIMING.fadeBlack + ENDING_TIMING.lineIn);
    expect(ending.tryDismiss()).toBe(false);
    expect(ending.view().line).toBe(ENDING_LINES[0]);
  });

  test("space fades out and returns control", () => {
    const ending = playUntilWait();
    expect(ending.tryDismiss()).toBe(true);
    ending.tick(ENDING_TIMING.fadeOut * 0.4);
    expect(ending.view().visible).toBe(true);
    expect(ending.view().overlay).toBeLessThan(1);
    expect(ending.blocking()).toBe(true);
    ending.tick(ENDING_TIMING.fadeOut);
    expect(ending.view().visible).toBe(false);
    expect(ending.blocking()).toBe(false);
  });
});
