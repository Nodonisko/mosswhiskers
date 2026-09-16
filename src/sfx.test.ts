import { expect, test } from "bun:test";
import { BEEP_FADE_RANGE, BEEP_FULL_RANGE, beepProximity, CLAW_SOUNDS, FIRE_FADE_RANGE, FIRE_FULL_RANGE, fireProximity, GULP_FADE_RANGE, GULP_FULL_RANGE, gulpDistance, gulpProximity, MEOW_SOUNDS, ROCKET_SOUND_DELAY, ROCKET_SOUND_SKIP, pickRandom } from "./sfx";

test("picks a claw clip from the roll", () => {
  expect(pickRandom(CLAW_SOUNDS, () => 0)).toBe("/assets/sounds/claw1.mp3");
  expect(pickRandom(CLAW_SOUNDS, () => 0.99)).toBe("/assets/sounds/claw2.mp3");
});

test("picks a meow clip from the roll", () => {
  expect(pickRandom(MEOW_SOUNDS, () => 0)).toBe("/assets/sounds/meow1.mp3");
  expect(pickRandom(MEOW_SOUNDS, () => 0.99)).toBe("/assets/sounds/meow6.mp3");
});

test("rocket launch skips the clip lead-in and waits before playing", () => {
  expect(ROCKET_SOUND_SKIP).toBe(1.5);
  expect(ROCKET_SOUND_DELAY).toBe(0.5);
});

test("gulp is loud at the intake and silent far from the pond", () => {
  expect(gulpProximity(0)).toBe(1);
  expect(gulpProximity(GULP_FULL_RANGE)).toBe(1);
  expect(gulpProximity(GULP_FADE_RANGE)).toBe(0);
  expect(gulpProximity(GULP_FADE_RANGE + 80)).toBe(0);
  expect(gulpProximity((GULP_FULL_RANGE + GULP_FADE_RANGE) / 2)).toBeCloseTo(0.5);
});

test("gulp falls off faster south of the intake than east or north", () => {
  const south = gulpProximity(gulpDistance(0, -320));
  const north = gulpProximity(gulpDistance(0, 320));
  const east = gulpProximity(gulpDistance(320, 0));
  expect(south).toBeLessThan(east);
  expect(south).toBeLessThan(north);
  expect(gulpProximity(gulpDistance(0, -450))).toBe(0);
});

test("fire crackle is loud at the data center and silent far away", () => {
  expect(fireProximity(0)).toBe(1);
  expect(fireProximity(FIRE_FULL_RANGE)).toBe(1);
  expect(fireProximity(FIRE_FADE_RANGE)).toBe(0);
  expect(fireProximity((FIRE_FULL_RANGE + FIRE_FADE_RANGE) / 2)).toBeCloseTo(0.5);
});

test("computer beeps fall off much closer than the fire", () => {
  expect(beepProximity(0)).toBe(1);
  expect(beepProximity(BEEP_FULL_RANGE)).toBe(1);
  expect(beepProximity(BEEP_FADE_RANGE)).toBe(0);
  expect(beepProximity(FIRE_FULL_RANGE)).toBe(0);
});
