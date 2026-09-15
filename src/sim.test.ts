import { describe, expect, test } from "bun:test";
import { moveFromKeys } from "./input";
import { createSim, hitsSolid, tickSim } from "./sim";
import { CAT_SPEED, CLAW_DURATION, MOUSE_RESPAWN } from "./world-config";

const openGround = () => true;
const blocked = () => false;

function simAtOrigin() {
  return createSim({
    cat: { x: 0, y: -5 },
    fish: [{
      id: "fish-pike",
      kind: "pike",
      originX: 0,
      originY: 0,
      radiusX: 10,
      radiusY: 4,
      speed: 1,
      phase: 0,
      tailStep: 0.5,
    }],
  });
}

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

describe("tickSim", () => {
  test("moves the cat at CAT_SPEED along one axis", () => {
    const sim = simAtOrigin();
    tickSim(sim, { x: 1, y: 0 }, 1, openGround);
    expect(sim.cat.x).toBeCloseTo(CAT_SPEED);
    expect(sim.cat.y).toBe(-5);
    expect(sim.cat.facing).toBe("e");
    expect(sim.cat.moving).toBe(true);
  });

  test("faces the cardinal of movement", () => {
    const sim = simAtOrigin();
    tickSim(sim, { x: -1, y: 0 }, 0.1, openGround);
    expect(sim.cat.facing).toBe("w");
    tickSim(sim, { x: 0, y: 1 }, 0.1, openGround);
    expect(sim.cat.facing).toBe("n");
    tickSim(sim, { x: 0, y: -1 }, 0.1, openGround);
    expect(sim.cat.facing).toBe("s");
  });

  test("keeps the last compatible facing on a perfect diagonal", () => {
    const sim = simAtOrigin();
    tickSim(sim, { x: 0, y: 1 }, 0.1, openGround);
    expect(sim.cat.facing).toBe("n");
    tickSim(sim, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, 0.1, openGround);
    expect(sim.cat.facing).toBe("n");
  });

  test("does not turn mid-claw", () => {
    const sim = simAtOrigin();
    tickSim(sim, { x: 0, y: 1, claw: true }, 0.05, openGround);
    expect(sim.cat.facing).toBe("n");
    tickSim(sim, { x: 1, y: 0 }, 0.05, openGround);
    expect(sim.cat.facing).toBe("n");
    expect(sim.cat.clawing).toBe(true);
  });

  test("does not walk into blocked cells", () => {
    const sim = simAtOrigin();
    tickSim(sim, { x: 1, y: 0 }, 1, blocked);
    expect(sim.cat.x).toBe(0);
    expect(sim.cat.y).toBe(-5);
    expect(sim.cat.moving).toBe(true);
  });

  test("keeps diagonal travel at the same speed", () => {
    const sim = simAtOrigin();
    const move = moveFromKeys(new Set(["w", "d"]));
    tickSim(sim, move, 1, openGround);
    expect(Math.hypot(sim.cat.x, sim.cat.y + 5)).toBeCloseTo(CAT_SPEED);
  });

  test("slides along a blocked axis", () => {
    const sim = simAtOrigin();
    const wall = (x: number, y: number) => y < 20;
    tickSim(sim, { x: 1, y: 1 }, 1, wall);
    expect(sim.cat.x).toBeCloseTo(CAT_SPEED);
    expect(sim.cat.y).toBe(-5);
  });

  test("space starts a claw that ignores a second press until it finishes", () => {
    const sim = simAtOrigin();
    tickSim(sim, { x: 0, y: 0, claw: true }, 0.05, openGround);
    expect(sim.cat.clawing).toBe(true);
    const started = sim.cat.clawElapsed;
    tickSim(sim, { x: 0, y: 0, claw: true }, 0.05, openGround);
    expect(sim.cat.clawElapsed).toBeCloseTo(started + 0.05);
    tickSim(sim, { x: 0, y: 0 }, CLAW_DURATION, openGround);
    expect(sim.cat.clawing).toBe(false);
  });

  test("mice scurry around their origin and face left or right", () => {
    const sim = createSim({
      cat: { x: 0, y: 0 },
      fish: [],
      mice: [{
        id: "mouse-1",
        originX: 10,
        originY: 20,
        radiusX: 8,
        radiusY: 4,
        speed: 1,
        phase: 0,
        step: 0.2,
      }],
    });
    expect(sim.mice[0]!.x).toBeCloseTo(18);
    expect(sim.mice[0]!.y).toBeCloseTo(20);
    tickSim(sim, { x: 0, y: 0 }, Math.PI / 2, openGround);
    expect(sim.mice[0]!.x).toBeCloseTo(10);
    expect(sim.mice[0]!.y).toBeCloseTo(24);
    expect(sim.mice[0]!.facing).toBe(-1);
  });

  test("a claw in front of the cat kills a nearby mouse and tints the swipe", () => {
    const sim = createSim({
      cat: { x: 0, y: 0 },
      fish: [],
      mice: [{ id: "mouse-1", originX: 28, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, step: 0.2 }],
    });
    sim.cat.facing = "e";
    tickSim(sim, { x: 0, y: 0, claw: true }, 0.12, openGround);
    expect(sim.mice[0]!.alive).toBe(false);
    expect(sim.mice[0]!.respawnIn).toBe(MOUSE_RESPAWN);
    expect(sim.cat.clawHit).toBe(true);
  });

  test("a claw does not kill a mouse behind the cat or out of reach", () => {
    const sim = createSim({
      cat: { x: 0, y: 0 },
      fish: [],
      mice: [
        { id: "behind", originX: -40, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, step: 0.2 },
        { id: "far", originX: 120, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, step: 0.2 },
      ],
    });
    sim.cat.facing = "e";
    tickSim(sim, { x: 0, y: 0, claw: true }, 0.12, openGround);
    expect(sim.mice[0]!.alive).toBe(true);
    expect(sim.mice[1]!.alive).toBe(true);
    expect(sim.cat.clawHit).toBe(false);
  });

  test("a killed mouse respawns after MOUSE_RESPAWN", () => {
    const sim = createSim({
      cat: { x: 0, y: 0 },
      fish: [],
      mice: [{ id: "mouse-1", originX: 28, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, step: 0.2 }],
    });
    sim.cat.facing = "e";
    tickSim(sim, { x: 0, y: 0, claw: true }, 0.12, openGround);
    tickSim(sim, { x: 0, y: 0 }, CLAW_DURATION, openGround);
    expect(sim.mice[0]!.alive).toBe(false);
    tickSim(sim, { x: 0, y: 0 }, MOUSE_RESPAWN, openGround);
    expect(sim.mice[0]!.alive).toBe(true);
  });

  test("a claw in front of the cat kills a nearby fish", () => {
    const sim = createSim({
      cat: { x: 0, y: 0 },
      fish: [{ id: "fish-1", kind: "pike", originX: 28, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, tailStep: 0.5 }],
    });
    sim.cat.facing = "e";
    tickSim(sim, { x: 0, y: 0, claw: true }, 0.12, openGround);
    expect(sim.fish[0]!.alive).toBe(false);
    expect(sim.fish[0]!.respawnIn).toBe(MOUSE_RESPAWN);
    expect(sim.cat.clawHit).toBe(true);
    tickSim(sim, { x: 0, y: 0 }, CLAW_DURATION, openGround);
    tickSim(sim, { x: 0, y: 0 }, MOUSE_RESPAWN, openGround);
    expect(sim.fish[0]!.alive).toBe(true);
  });
});

describe("hitsSolid", () => {
  const trunk = { x: 0, y: 0, halfW: 8, halfH: 5 };

  test("only the trunk footprint is solid", () => {
    expect(hitsSolid(0, 0, [trunk], 8, 6)).toBe(true);
    expect(hitsSolid(0, 40, [trunk], 8, 6)).toBe(false);
    expect(hitsSolid(40, 0, [trunk], 8, 6)).toBe(false);
  });
});
