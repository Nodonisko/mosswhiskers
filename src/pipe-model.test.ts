import { expect, test } from "bun:test";
import { GULP_SOUND_LEAD, intakeGulpIndex, PIPE_BALL_COUNT, PIPE_BALL_SPEED } from "./pipe-model";

test("gulp index ticks each time a swallow reaches the intake", () => {
  const length = 1000;
  const period = length / PIPE_BALL_COUNT / PIPE_BALL_SPEED;
  expect(intakeGulpIndex(0, length, 0)).toBe(0);
  expect(intakeGulpIndex(period - 0.001, length, 0)).toBe(0);
  expect(intakeGulpIndex(period, length, 0)).toBe(1);
  expect(intakeGulpIndex(period * 2, length, 0)).toBe(2);
});

test("gulp sound leads the swallow peak", () => {
  const length = 1000;
  const period = length / PIPE_BALL_COUNT / PIPE_BALL_SPEED;
  expect(intakeGulpIndex(period - GULP_SOUND_LEAD, length)).toBe(1);
  expect(intakeGulpIndex(period - GULP_SOUND_LEAD - 0.001, length)).toBe(0);
});
