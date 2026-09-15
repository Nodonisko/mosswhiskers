import { CAT_SPEED, CLAW_DURATION, CLAW_RANGE, MAP_HEIGHT, MAP_WALK_MARGIN, MAP_WIDTH, MOUSE_RESPAWN } from "./world-config";
import type { MoveInput } from "./input";

export type FishKind = "pike" | "perch" | "bluegill";

export type CatFacing = "n" | "e" | "s" | "w";

export type CatSim = {
  id: "cat";
  x: number;
  y: number;
  facing: CatFacing;
  moving: boolean;
  clawing: boolean;
  clawElapsed: number;
  clawHit: boolean;
};

/** Snap movement to a cardinal; on a perfect diagonal keep the last compatible facing. */
export function facingFromMove(x: number, y: number, previous: CatFacing): CatFacing {
  if (x === 0 && y === 0) return previous;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax > ay) return x < 0 ? "w" : "e";
  if (ay > ax) return y < 0 ? "s" : "n";
  const horizontal: CatFacing = x < 0 ? "w" : "e";
  const vertical: CatFacing = y < 0 ? "s" : "n";
  if (previous === horizontal || previous === vertical) return previous;
  return horizontal;
}

export type FishSpec = {
  id: string;
  kind: FishKind;
  originX: number;
  originY: number;
  radiusX: number;
  radiusY: number;
  speed: number;
  phase: number;
  tailStep: number;
};

export type FishSim = FishSpec & {
  x: number;
  y: number;
  facing: 1 | -1;
  frame: 0 | 1;
  alive: boolean;
  respawnIn: number;
};

export type MouseSpec = {
  id: string;
  originX: number;
  originY: number;
  radiusX: number;
  radiusY: number;
  speed: number;
  phase: number;
  step: number;
};

export type MouseSim = MouseSpec & {
  x: number;
  y: number;
  facing: 1 | -1;
  frame: 0 | 1;
  alive: boolean;
  respawnIn: number;
};

export type GameSim = {
  elapsed: number;
  cat: CatSim;
  fish: FishSim[];
  mice: MouseSim[];
};

export type Walkable = (x: number, y: number) => boolean;

export type Solid = {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
};

export function hitsSolid(
  x: number,
  y: number,
  solids: readonly Solid[],
  radiusX: number,
  radiusY: number,
) {
  for (const solid of solids) {
    if (Math.abs(x - solid.x) < solid.halfW + radiusX && Math.abs(y - solid.y) < solid.halfH + radiusY) {
      return true;
    }
  }
  return false;
}

function fishAt(spec: FishSpec, elapsed: number, previousFacing: 1 | -1, previous?: Pick<FishSim, "alive" | "respawnIn">): FishSim {
  const t = elapsed * spec.speed + spec.phase;
  const vx = -Math.sin(t) * spec.radiusX * spec.speed;
  return {
    ...spec,
    x: spec.originX + Math.cos(t) * spec.radiusX,
    y: spec.originY + Math.sin(t) * spec.radiusY,
    facing: Math.abs(vx) > 0.8 ? (vx < 0 ? -1 : 1) : previousFacing,
    frame: (Math.floor(elapsed / spec.tailStep + spec.phase * 2) % 2) as 0 | 1,
    alive: previous?.alive ?? true,
    respawnIn: previous?.respawnIn ?? 0,
  };
}

function mouseAt(spec: MouseSpec, elapsed: number, previousFacing: 1 | -1, previous?: Pick<MouseSim, "alive" | "respawnIn">): MouseSim {
  const t = elapsed * spec.speed + spec.phase;
  const vx = -Math.sin(t) * spec.radiusX * spec.speed;
  return {
    ...spec,
    x: spec.originX + Math.cos(t) * spec.radiusX,
    y: spec.originY + Math.sin(t) * spec.radiusY,
    facing: Math.abs(vx) > 0.4 ? (vx < 0 ? -1 : 1) : previousFacing,
    frame: (Math.floor(elapsed / spec.step + spec.phase * 3) % 2) as 0 | 1,
    alive: previous?.alive ?? true,
    respawnIn: previous?.respawnIn ?? 0,
  };
}

export function clawHitsTarget(cat: CatSim, target: { x: number; y: number; alive: boolean }) {
  if (!target.alive) return false;
  const dx = target.x - cat.x;
  const dy = target.y - cat.y;
  const forward = cat.facing === "e" ? dx : cat.facing === "w" ? -dx : cat.facing === "n" ? dy : -dy;
  const side = cat.facing === "e" || cat.facing === "w" ? dy : dx;
  return forward > -CLAW_RANGE.back && forward < CLAW_RANGE.forward && Math.abs(side) < CLAW_RANGE.side;
}

export function createSim(options: { cat: { x: number; y: number }; fish: FishSpec[]; mice?: MouseSpec[] }): GameSim {
  return {
    elapsed: 0,
    cat: {
      id: "cat",
      x: options.cat.x,
      y: options.cat.y,
      facing: "s",
      moving: false,
      clawing: false,
      clawElapsed: 0,
      clawHit: false,
    },
    fish: options.fish.map((spec) => fishAt(spec, 0, 1)),
    mice: (options.mice ?? []).map((spec) => mouseAt(spec, 0, 1)),
  };
}

export function tickSim(sim: GameSim, input: MoveInput, dt: number, walkable: Walkable) {
  sim.elapsed += dt;
  sim.cat.moving = input.x !== 0 || input.y !== 0;
  if (sim.cat.moving && !sim.cat.clawing) {
    sim.cat.facing = facingFromMove(input.x, input.y, sim.cat.facing);
  }
  if (input.claw && !sim.cat.clawing) {
    sim.cat.clawing = true;
    sim.cat.clawElapsed = 0;
    sim.cat.clawHit = false;
  }
  if (sim.cat.clawing) sim.cat.clawElapsed += dt;
  if (sim.cat.moving) {
    const edgeX = MAP_WIDTH / 2 - MAP_WALK_MARGIN;
    const edgeY = MAP_HEIGHT / 2 - MAP_WALK_MARGIN;
    const nextX = clamp(sim.cat.x + input.x * CAT_SPEED * dt, -edgeX, edgeX);
    const nextY = clamp(sim.cat.y + input.y * CAT_SPEED * dt, -edgeY, edgeY);
    if (walkable(nextX, nextY)) {
      sim.cat.x = nextX;
      sim.cat.y = nextY;
    } else if (walkable(nextX, sim.cat.y)) {
      sim.cat.x = nextX;
    } else if (walkable(sim.cat.x, nextY)) {
      sim.cat.y = nextY;
    }
  }
  for (const fish of sim.fish) {
    if (!fish.alive) {
      fish.respawnIn -= dt;
      if (fish.respawnIn <= 0) {
        fish.alive = true;
        fish.respawnIn = 0;
      }
    }
    const next = fishAt(fish, sim.elapsed, fish.facing, fish);
    fish.x = next.x;
    fish.y = next.y;
    fish.facing = next.facing;
    fish.frame = next.frame;
  }
  for (const mouse of sim.mice) {
    if (!mouse.alive) {
      mouse.respawnIn -= dt;
      if (mouse.respawnIn <= 0) {
        mouse.alive = true;
        mouse.respawnIn = 0;
      }
    }
    const next = mouseAt(mouse, sim.elapsed, mouse.facing, mouse);
    mouse.x = next.x;
    mouse.y = next.y;
    mouse.facing = next.facing;
    mouse.frame = next.frame;
  }
  if (sim.cat.clawing && sim.cat.clawElapsed / CLAW_DURATION >= 0.28) {
    for (const mouse of sim.mice) {
      if (!clawHitsTarget(sim.cat, mouse)) continue;
      mouse.alive = false;
      mouse.respawnIn = MOUSE_RESPAWN;
      sim.cat.clawHit = true;
    }
    for (const fish of sim.fish) {
      if (!clawHitsTarget(sim.cat, fish)) continue;
      fish.alive = false;
      fish.respawnIn = MOUSE_RESPAWN;
      sim.cat.clawHit = true;
    }
  }
  if (sim.cat.clawing && sim.cat.clawElapsed >= CLAW_DURATION) {
    sim.cat.clawing = false;
    sim.cat.clawElapsed = 0;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
