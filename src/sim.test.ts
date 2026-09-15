import { describe, expect, test } from "bun:test";
import { moveFromKeys, type MoveInput } from "./input";
import {
  addPlayer,
  applySnapshot,
  createSim,
  drainFixedTicks,
  hitsSolid,
  playerById,
  removePlayer,
  snapshotSim,
  tickSim,
  type GameSim,
  type Walkable,
} from "./sim";
import { CAT_SPEED, CLAW_DURATION, LOCAL_PLAYER_ID, MAILBOX, MOUSE_RESPAWN, TICK_DT } from "./world-config";

const openGround = () => true;
const blocked = () => false;

function cat(sim: GameSim) {
  return sim.players[0]!;
}

function tick(sim: GameSim, input: MoveInput, dt: number, walkable: Walkable = openGround) {
  tickSim(sim, { [cat(sim).id]: input }, dt, walkable);
}

function simAtOrigin() {
  return createSim({
    players: [{ id: LOCAL_PLAYER_ID, x: 0, y: -5 }],
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
    tick(sim, { x: 1, y: 0 }, 1);
    expect(cat(sim).x).toBeCloseTo(CAT_SPEED);
    expect(cat(sim).y).toBe(-5);
    expect(cat(sim).facing).toBe("e");
    expect(cat(sim).moving).toBe(true);
  });

  test("faces the cardinal of movement", () => {
    const sim = simAtOrigin();
    tick(sim, { x: -1, y: 0 }, 0.1);
    expect(cat(sim).facing).toBe("w");
    tick(sim, { x: 0, y: 1 }, 0.1);
    expect(cat(sim).facing).toBe("n");
    tick(sim, { x: 0, y: -1 }, 0.1);
    expect(cat(sim).facing).toBe("s");
  });

  test("keeps the last compatible facing on a perfect diagonal", () => {
    const sim = simAtOrigin();
    tick(sim, { x: 0, y: 1 }, 0.1);
    expect(cat(sim).facing).toBe("n");
    tick(sim, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, 0.1);
    expect(cat(sim).facing).toBe("n");
  });

  test("does not turn mid-claw", () => {
    const sim = simAtOrigin();
    tick(sim, { x: 0, y: 1, claw: true }, 0.05);
    expect(cat(sim).facing).toBe("n");
    tick(sim, { x: 1, y: 0 }, 0.05);
    expect(cat(sim).facing).toBe("n");
    expect(cat(sim).clawing).toBe(true);
  });

  test("does not walk into blocked cells", () => {
    const sim = simAtOrigin();
    tick(sim, { x: 1, y: 0 }, 1, blocked);
    expect(cat(sim).x).toBe(0);
    expect(cat(sim).y).toBe(-5);
    expect(cat(sim).moving).toBe(true);
  });

  test("keeps diagonal travel at the same speed", () => {
    const sim = simAtOrigin();
    const move = moveFromKeys(new Set(["w", "d"]));
    tick(sim, move, 1);
    expect(Math.hypot(cat(sim).x, cat(sim).y + 5)).toBeCloseTo(CAT_SPEED);
  });

  test("slides along a blocked axis", () => {
    const sim = simAtOrigin();
    const wall = (_x: number, y: number) => y < 20;
    tick(sim, { x: 1, y: 1 }, 1, wall);
    expect(cat(sim).x).toBeCloseTo(CAT_SPEED);
    expect(cat(sim).y).toBe(-5);
  });

  test("space starts a claw that ignores a second press until it finishes", () => {
    const sim = simAtOrigin();
    tick(sim, { x: 0, y: 0, claw: true }, 0.05);
    expect(cat(sim).clawing).toBe(true);
    const started = cat(sim).clawElapsed;
    tick(sim, { x: 0, y: 0, claw: true }, 0.05);
    expect(cat(sim).clawElapsed).toBeCloseTo(started + 0.05);
    tick(sim, { x: 0, y: 0 }, CLAW_DURATION);
    expect(cat(sim).clawing).toBe(false);
  });

  test("walkElapsed advances only while moving", () => {
    const sim = simAtOrigin();
    tick(sim, { x: 1, y: 0 }, 0.2);
    expect(cat(sim).walkElapsed).toBeCloseTo(0.2);
    tick(sim, { x: 0, y: 0 }, 0.1);
    expect(cat(sim).walkElapsed).toBe(0);
  });

  test("mice scurry around their origin and face left or right", () => {
    const sim = createSim({
      players: [{ x: 0, y: 0 }],
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
    tick(sim, { x: 0, y: 0 }, Math.PI / 2);
    expect(sim.mice[0]!.x).toBeCloseTo(10);
    expect(sim.mice[0]!.y).toBeCloseTo(24);
    expect(sim.mice[0]!.facing).toBe(-1);
  });

  test("a claw in front of the cat kills a nearby mouse and tints the swipe", () => {
    const sim = createSim({
      players: [{ x: 0, y: 0 }],
      fish: [],
      mice: [{ id: "mouse-1", originX: 28, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, step: 0.2 }],
    });
    cat(sim).facing = "e";
    tick(sim, { x: 0, y: 0, claw: true }, 0.12);
    expect(sim.mice[0]!.alive).toBe(false);
    expect(sim.mice[0]!.respawnIn).toBe(MOUSE_RESPAWN);
    expect(cat(sim).clawHit).toBe(true);
    expect(cat(sim).inventory).toEqual([{ kind: "mouse", count: 1 }]);
  });

  test("a claw does not kill a mouse behind the cat or out of reach", () => {
    const sim = createSim({
      players: [{ x: 0, y: 0 }],
      fish: [],
      mice: [
        { id: "behind", originX: -40, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, step: 0.2 },
        { id: "far", originX: 120, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, step: 0.2 },
      ],
    });
    cat(sim).facing = "e";
    tick(sim, { x: 0, y: 0, claw: true }, 0.12);
    expect(sim.mice[0]!.alive).toBe(true);
    expect(sim.mice[1]!.alive).toBe(true);
    expect(cat(sim).clawHit).toBe(false);
    expect(cat(sim).inventory).toEqual([]);
  });

  test("a killed mouse respawns after MOUSE_RESPAWN", () => {
    const sim = createSim({
      players: [{ x: 0, y: 0 }],
      fish: [],
      mice: [{ id: "mouse-1", originX: 28, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, step: 0.2 }],
    });
    cat(sim).facing = "e";
    tick(sim, { x: 0, y: 0, claw: true }, 0.12);
    tick(sim, { x: 0, y: 0 }, CLAW_DURATION);
    expect(sim.mice[0]!.alive).toBe(false);
    tick(sim, { x: 0, y: 0 }, MOUSE_RESPAWN);
    expect(sim.mice[0]!.alive).toBe(true);
  });

  test("a claw in front of the cat kills a nearby fish", () => {
    const sim = createSim({
      players: [{ x: 0, y: 0 }],
      fish: [{ id: "fish-1", kind: "pike", originX: 28, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, tailStep: 0.5 }],
    });
    cat(sim).facing = "e";
    tick(sim, { x: 0, y: 0, claw: true }, 0.12);
    expect(sim.fish[0]!.alive).toBe(false);
    expect(sim.fish[0]!.respawnIn).toBe(MOUSE_RESPAWN);
    expect(cat(sim).clawHit).toBe(true);
    expect(cat(sim).inventory).toEqual([{ kind: "pike", count: 1 }]);
    tick(sim, { x: 0, y: 0 }, CLAW_DURATION);
    tick(sim, { x: 0, y: 0 }, MOUSE_RESPAWN);
    expect(sim.fish[0]!.alive).toBe(true);
  });

  test("a second catch of the same prey stacks in the pack", () => {
    const sim = createSim({
      players: [{ x: 0, y: 0 }],
      fish: [],
      mice: [{ id: "mouse-1", originX: 28, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, step: 0.2 }],
    });
    cat(sim).facing = "e";
    tick(sim, { x: 0, y: 0, claw: true }, 0.12);
    tick(sim, { x: 0, y: 0 }, CLAW_DURATION);
    tick(sim, { x: 0, y: 0 }, MOUSE_RESPAWN);
    tick(sim, { x: 0, y: 0, claw: true }, 0.12);
    expect(cat(sim).inventory).toEqual([{ kind: "mouse", count: 2 }]);
  });
});

describe("multiplayer-ready sim", () => {
  test("another player's swipe is visible in their own claw state", () => {
    const sim = createSim({
      players: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 80, y: 0 },
      ],
      fish: [],
    });
    tickSim(sim, {
      a: { x: 0, y: 0 },
      b: { x: 0, y: 0, claw: true },
    }, 0.05, openGround);
    expect(playerById(sim, "a")!.clawing).toBe(false);
    expect(playerById(sim, "b")!.clawing).toBe(true);
    expect(playerById(sim, "b")!.clawElapsed).toBeCloseTo(0.05);
  });

  test("a remote swipe can kill a mouse the local player is not near", () => {
    const sim = createSim({
      players: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 200, y: 0 },
      ],
      fish: [],
      mice: [{ id: "mouse-1", originX: 228, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, step: 0.2 }],
    });
    playerById(sim, "b")!.facing = "e";
    tickSim(sim, {
      a: { x: 0, y: 0 },
      b: { x: 0, y: 0, claw: true },
    }, 0.12, openGround);
    expect(sim.mice[0]!.alive).toBe(false);
    expect(playerById(sim, "b")!.clawHit).toBe(true);
    expect(playerById(sim, "a")!.clawHit).toBe(false);
    expect(playerById(sim, "b")!.inventory).toEqual([{ kind: "mouse", count: 1 }]);
    expect(playerById(sim, "a")!.inventory).toEqual([]);
  });

  test("two players can occupy the same sim and keep independent poses", () => {
    const sim = createSim({
      players: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 0, y: 0 },
      ],
      fish: [],
    });
    tickSim(sim, {
      a: { x: 1, y: 0 },
      b: { x: 0, y: 1 },
    }, 1, openGround);
    expect(playerById(sim, "a")!.x).toBeCloseTo(CAT_SPEED);
    expect(playerById(sim, "a")!.facing).toBe("e");
    expect(playerById(sim, "b")!.y).toBeCloseTo(CAT_SPEED);
    expect(playerById(sim, "b")!.facing).toBe("n");
  });

  test("missing input is idle, so a dropped peer does not keep walking", () => {
    const sim = createSim({
      players: [{ id: "a", x: 0, y: 0 }],
      fish: [],
    });
    tickSim(sim, { a: { x: 1, y: 0 } }, 0.1, openGround);
    tickSim(sim, {}, 0.1, openGround);
    expect(playerById(sim, "a")!.moving).toBe(false);
    expect(playerById(sim, "a")!.walkElapsed).toBe(0);
  });

  test("addPlayer and removePlayer join and leave without resetting the world", () => {
    const sim = createSim({
      players: [{ id: "a", x: 0, y: 0 }],
      fish: [],
      mice: [{ id: "mouse-1", originX: 10, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, step: 0.2 }],
    });
    tick(sim, { x: 0, y: 0 }, 1);
    addPlayer(sim, { id: "b", x: 40, y: -8, seed: 7 });
    expect(sim.players).toHaveLength(2);
    expect(sim.mice[0]!.id).toBe("mouse-1");
    removePlayer(sim, "a");
    expect(playerById(sim, "b")!.x).toBe(40);
  });

  test("GameSim round-trips through JSON so a host can snapshot mice, fish, and swipes", () => {
    const sim = createSim({
      players: [
        { id: "a", x: 12, y: -4, seed: 5 },
        { id: "b", x: 80, y: 10, seed: 9 },
      ],
      fish: [{ id: "fish-1", kind: "pike", originX: 0, originY: 0, radiusX: 0, radiusY: 0, speed: 1, phase: 0, tailStep: 0.5 }],
      mice: [{ id: "mouse-1", originX: 108, originY: 10, radiusX: 0, radiusY: 0, speed: 1, phase: 0, step: 0.2 }],
    });
    playerById(sim, "b")!.facing = "e";
    tickSim(sim, { b: { x: 0, y: 0, claw: true } }, 0.12, openGround);
    const snap = snapshotSim(sim);
    expect(JSON.parse(JSON.stringify(sim))).toEqual(snap);
    const other = createSim({ players: [{ id: "a", x: 0, y: 0 }], fish: [], mice: [] });
    applySnapshot(other, snap);
    expect(other.tick).toBe(sim.tick);
    expect(other.mice[0]!.alive).toBe(false);
    expect(playerById(other, "b")!.clawing).toBe(true);
    expect(playerById(other, "b")!.clawHit).toBe(true);
  });

  test("the same inputs at TICK_DT match across uneven frame sizes", () => {
    const move: MoveInput = { x: 1, y: 0 };
    const run = (frames: number[]) => {
      const sim = simAtOrigin();
      let leftover = 0;
      for (const frame of frames) {
        leftover += frame;
        while (leftover >= TICK_DT) {
          tick(sim, move, TICK_DT);
          leftover -= TICK_DT;
        }
      }
      return sim;
    };
    const smooth = run(Array.from({ length: 12 }, () => TICK_DT));
    const hitchy = run([TICK_DT * 2.4, TICK_DT * 0.3, TICK_DT * 1.8, TICK_DT * 0.5, TICK_DT * 3, TICK_DT * 4]);
    expect(hitchy.tick).toBe(smooth.tick);
    expect(cat(hitchy).x).toBeCloseTo(cat(smooth).x);
    expect(hitchy.fish[0]!.x).toBeCloseTo(smooth.fish[0]!.x);
  });

  test("a swipe held while walking still starts on the next sim tick", () => {
    const sim = simAtOrigin();
    let leftover = TICK_DT * 0.4;
    let clawQueued = true;
    const sample = (): MoveInput => {
      const claw = clawQueued;
      clawQueued = false;
      return { x: 1, y: 0, claw };
    };
    leftover = drainFixedTicks(leftover, TICK_DT, 5, () => {
      tick(sim, sample(), TICK_DT);
    });
    expect(cat(sim).clawing).toBe(false);
    expect(clawQueued).toBe(true);
    leftover += TICK_DT;
    leftover = drainFixedTicks(leftover, TICK_DT, 5, () => {
      tick(sim, sample(), TICK_DT);
    });
    expect(cat(sim).clawing).toBe(true);
    expect(cat(sim).moving).toBe(true);
    expect(clawQueued).toBe(false);
  });
});

describe("mailbox interaction", () => {
  const mailbox = { id: "mailbox", kind: "mailbox" as const, x: MAILBOX.x, y: MAILBOX.y };

  function simAtMailbox(extraPlayers: Array<{ id: string; x: number; y: number }> = []) {
    return createSim({
      players: [{ id: LOCAL_PLAYER_ID, x: MAILBOX.x, y: MAILBOX.y }, ...extraPlayers],
      fish: [],
      interactables: [mailbox],
    });
  }

  test("E near the mailbox opens the letter and marks that player as having read it", () => {
    const sim = simAtMailbox();
    tick(sim, { x: 0, y: 0, interact: true }, 0.05);
    expect(cat(sim).nearbyId).toBe("mailbox");
    expect(cat(sim).openId).toBe("mailbox");
    expect(cat(sim).progress.mailboxRead).toBe(true);
    expect(cat(sim).progress.activeQuest).toBe("sandwhisker");
  });

  test("E far from the mailbox does nothing", () => {
    const sim = createSim({
      players: [{ id: LOCAL_PLAYER_ID, x: 0, y: -5 }],
      fish: [],
      interactables: [mailbox],
    });
    tick(sim, { x: 0, y: 0, interact: true }, 0.05);
    expect(cat(sim).nearbyId).toBeNull();
    expect(cat(sim).openId).toBeNull();
    expect(cat(sim).progress.mailboxRead).toBe(false);
    expect(cat(sim).progress.activeQuest).toBeNull();
  });

  test("E closes an open letter, and the read flag stays on that player", () => {
    const sim = simAtMailbox();
    tick(sim, { x: 0, y: 0, interact: true }, 0.05);
    tick(sim, { x: 0, y: 0, interact: true }, 0.05);
    expect(cat(sim).openId).toBeNull();
    expect(cat(sim).progress.mailboxRead).toBe(true);
    expect(cat(sim).progress.activeQuest).toBe("sandwhisker");
  });

  test("an open letter freezes that player's movement", () => {
    const sim = simAtMailbox();
    tick(sim, { x: 0, y: 0, interact: true }, 0.05);
    const x = cat(sim).x;
    tick(sim, { x: 1, y: 0 }, 1);
    expect(cat(sim).x).toBe(x);
    expect(cat(sim).moving).toBe(false);
    expect(cat(sim).openId).toBe("mailbox");
  });

  test("reading the mailbox does not share quest progress with another player", () => {
    const sim = simAtMailbox([{ id: "guest", x: MAILBOX.x, y: MAILBOX.y }]);
    tickSim(sim, {
      [LOCAL_PLAYER_ID]: { x: 0, y: 0, interact: true },
      guest: { x: 0, y: 0 },
    }, 0.05, openGround);
    expect(cat(sim).openId).toBe("mailbox");
    expect(cat(sim).progress.mailboxRead).toBe(true);
    expect(cat(sim).progress.activeQuest).toBe("sandwhisker");
    expect(playerById(sim, "guest")!.openId).toBeNull();
    expect(playerById(sim, "guest")!.progress.mailboxRead).toBe(false);
    expect(playerById(sim, "guest")!.progress.activeQuest).toBeNull();
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
