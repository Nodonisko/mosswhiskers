import type { MoveInput } from "./input";
import {
  CAT_SPEED,
  CLAW_DURATION,
  CLAW_HIT_AT,
  CLAW_RANGE,
  DEFAULT_CAT_SEED,
  DEFAULT_SPAWN,
  INTERACT_RANGE,
  LOCAL_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WALK_MARGIN,
  MAP_WIDTH,
  MEOW_DURATION,
  QUEST_HINT_DURATION,
  PREY_RESPAWN,
  BERNIE_SUPPLY,
  nearIntakeRim,
} from "./world-config";

export type FishKind = "pike" | "perch" | "bluegill";

export type CatFacing = "n" | "e" | "s" | "w";

export type PlayerId = string;

/** One command from one player for one tick. Remote peers inject the same shape. */
export type PlayerInputs = Readonly<Record<PlayerId, MoveInput>>;

export const IDLE_INPUT: MoveInput = { x: 0, y: 0 };

export type InventoryItemKind = "mouse" | FishKind | "carrot";

export type InventorySlot = {
  kind: InventoryItemKind;
  count: number;
};

export type InteractableKind = "mailbox" | "bernie" | "sam" | "rabbit" | "intake";

export type Interactable = {
  id: string;
  kind: InteractableKind;
  x: number;
  y: number;
};

/** Per-player quest flags. Never store these on GameSim — each cat keeps their own. */
export type QuestId = "sandwhisker" | "pond" | "report" | "hopsk" | "clog" | "smoke" | "blaze";

export type TalkId =
  | "bernie-ask"
  | "bernie-thanks"
  | "bernie-pond"
  | "bernie-report"
  | "bernie-hopsk"
  | "bernie-clog"
  | "bernie-smoke"
  | "bernie-blaze"
  | "bernie-victory"
  | "sam-wait"
  | "sam-pitch"
  | "sam-blaze"
  | "hopsk-wait"
  | "hopsk-offer"
  | "hopsk-nudge"
  | "hopsk-clogged"
  | "intake-look"
  | "intake-stuff"
  | "intake-clogged";

export type PlayerProgress = {
  mailboxRead: boolean;
  activeQuest: QuestId | null;
  heardSam: boolean;
  heardHopsk: boolean;
  pipeClogged: boolean;
};

export type PlayerSim = {
  id: PlayerId;
  name: string;
  x: number;
  y: number;
  facing: CatFacing;
  moving: boolean;
  walkElapsed: number;
  clawing: boolean;
  clawElapsed: number;
  clawHit: boolean;
  seed: number;
  inventory: InventorySlot[];
  nearbyId: string | null;
  openId: string | null;
  talkId: TalkId | null;
  meowing: boolean;
  meowElapsed: number;
  meowNonce: number;
  questHint: QuestId | null;
  questHintElapsed: number;
  progress: PlayerProgress;
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

/**
 * Authoritative world state. JSON-serializable so a host can snapshot it
 * and every client can paint the same mice, fish, and other cats' swipes.
 */
export type GameSim = {
  elapsed: number;
  tick: number;
  players: PlayerSim[];
  fish: FishSim[];
  mice: MouseSim[];
  interactables: Interactable[];
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

export function clawHitsTarget(player: PlayerSim, target: { x: number; y: number; alive: boolean }) {
  if (!target.alive) return false;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const forward = player.facing === "e" ? dx : player.facing === "w" ? -dx : player.facing === "n" ? dy : -dy;
  const side = player.facing === "e" || player.facing === "w" ? dy : dx;
  return forward > -CLAW_RANGE.back && forward < CLAW_RANGE.forward && Math.abs(side) < CLAW_RANGE.side;
}

export function createPlayer(options: { id: string; name?: string; x: number; y: number; seed?: number }): PlayerSim {
  return {
    id: options.id,
    name: options.name ?? options.id,
    x: options.x,
    y: options.y,
    facing: "s",
    moving: false,
    walkElapsed: 0,
    clawing: false,
    clawElapsed: 0,
    clawHit: false,
    seed: options.seed ?? DEFAULT_CAT_SEED,
    inventory: [],
    nearbyId: null,
    openId: null,
    talkId: null,
    meowing: false,
    meowElapsed: 0,
    meowNonce: 0,
    questHint: null,
    questHintElapsed: 0,
    progress: { mailboxRead: false, activeQuest: null, heardSam: false, heardHopsk: false, pipeClogged: false },
  };
}

const FISH_KINDS: readonly InventoryItemKind[] = ["pike", "perch", "bluegill"];

export function addToInventory(player: PlayerSim, kind: InventoryItemKind) {
  const slot = player.inventory.find((entry) => entry.kind === kind);
  if (slot) slot.count += 1;
  else player.inventory.push({ kind, count: 1 });
}

export function inventoryCount(slots: readonly InventorySlot[]) {
  return slots.reduce((sum, slot) => sum + slot.count, 0);
}

export function countKind(slots: readonly InventorySlot[], kind: InventoryItemKind) {
  return slots.find((slot) => slot.kind === kind)?.count ?? 0;
}

export function countFish(slots: readonly InventorySlot[]) {
  return FISH_KINDS.reduce((sum, kind) => sum + countKind(slots, kind), 0);
}

export function hasBernieSupplies(slots: readonly InventorySlot[]) {
  return countKind(slots, "mouse") >= BERNIE_SUPPLY.mice && countFish(slots) >= BERNIE_SUPPLY.fish;
}

export function removeFromInventory(player: PlayerSim, kind: InventoryItemKind, amount = 1) {
  const slot = player.inventory.find((entry) => entry.kind === kind);
  if (!slot || slot.count < amount) return false;
  slot.count -= amount;
  if (slot.count <= 0) player.inventory = player.inventory.filter((entry) => entry !== slot);
  return true;
}

export function takeBernieSupplies(player: PlayerSim) {
  removeFromInventory(player, "mouse", BERNIE_SUPPLY.mice);
  let fishLeft = BERNIE_SUPPLY.fish;
  for (const kind of FISH_KINDS) {
    while (fishLeft > 0 && removeFromInventory(player, kind, 1)) fishLeft -= 1;
  }
}

function closeDialog(player: PlayerSim) {
  player.openId = null;
  player.talkId = null;
}

function setActiveQuest(player: PlayerSim, quest: QuestId | null) {
  if (player.progress.activeQuest === quest) return;
  player.progress.activeQuest = quest;
  if (!quest) return;
  player.questHint = quest;
  player.questHintElapsed = 0;
}

function beginSandwhisker(player: PlayerSim) {
  player.progress.mailboxRead = true;
  if (player.progress.activeQuest !== null) return;
  if (player.progress.heardSam || player.progress.heardHopsk || player.progress.pipeClogged) return;
  setActiveQuest(player, "sandwhisker");
}

function canTalkToSam(player: PlayerSim) {
  return player.progress.activeQuest === "pond"
    || player.progress.activeQuest === "report"
    || player.progress.heardSam;
}

function talkToSam(player: PlayerSim) {
  if (player.progress.pipeClogged && (player.progress.activeQuest === "blaze" || player.progress.activeQuest === null)) {
    if (player.progress.activeQuest === "blaze") setActiveQuest(player, null);
    player.talkId = "sam-blaze";
    return;
  }
  if (!canTalkToSam(player)) {
    player.talkId = "sam-wait";
    return;
  }
  player.progress.heardSam = true;
  if (player.progress.activeQuest === "pond") setActiveQuest(player, "report");
  player.talkId = "sam-pitch";
}

function canTalkToHopsk(player: PlayerSim) {
  return player.progress.activeQuest === "hopsk"
    || player.progress.activeQuest === "clog"
    || player.progress.activeQuest === "smoke"
    || player.progress.activeQuest === "blaze"
    || player.progress.heardHopsk
    || player.progress.pipeClogged;
}

function talkToHopsk(player: PlayerSim) {
  if (!canTalkToHopsk(player)) {
    player.talkId = "hopsk-wait";
    return;
  }
  if (player.progress.pipeClogged) {
    player.talkId = "hopsk-clogged";
    return;
  }
  if (!player.progress.heardHopsk) {
    player.progress.heardHopsk = true;
    addToInventory(player, "carrot");
    if (player.progress.activeQuest === "hopsk") setActiveQuest(player, "clog");
    player.talkId = "hopsk-offer";
    return;
  }
  player.talkId = "hopsk-nudge";
}

function talkToIntake(player: PlayerSim) {
  if (player.progress.pipeClogged) {
    player.talkId = "intake-clogged";
    return;
  }
  if (canStuffIntake(player)) {
    removeFromInventory(player, "carrot", 1);
    player.progress.pipeClogged = true;
    setActiveQuest(player, "smoke");
    player.talkId = "intake-stuff";
    return;
  }
  player.talkId = "intake-look";
}

export function canStuffIntake(player: PlayerSim) {
  return player.progress.activeQuest === "clog"
    && countKind(player.inventory, "carrot") > 0
    && !player.progress.pipeClogged;
}

function talkToBernie(player: PlayerSim) {
  player.progress.mailboxRead = true;
  if (player.progress.pipeClogged) {
    if (player.progress.activeQuest === "smoke") {
      setActiveQuest(player, "blaze");
      player.talkId = "bernie-smoke";
      return;
    }
    if (player.progress.activeQuest === "blaze") {
      player.talkId = "bernie-blaze";
      return;
    }
    player.talkId = "bernie-victory";
    return;
  }
  if (player.progress.heardHopsk) {
    if (player.progress.activeQuest === "hopsk") setActiveQuest(player, "clog");
    player.talkId = "bernie-clog";
    return;
  }
  if (player.progress.heardSam) {
    if (player.progress.activeQuest === "hopsk") {
      player.talkId = "bernie-hopsk";
      return;
    }
    setActiveQuest(player, "hopsk");
    player.talkId = "bernie-report";
    return;
  }
  if (player.progress.activeQuest === "pond") {
    player.talkId = "bernie-pond";
    return;
  }
  if (hasBernieSupplies(player.inventory)) {
    takeBernieSupplies(player);
    setActiveQuest(player, "pond");
    player.talkId = "bernie-thanks";
    return;
  }
  setActiveQuest(player, "sandwhisker");
  player.talkId = "bernie-ask";
}

export function playerById(sim: GameSim, id: PlayerId): PlayerSim | undefined {
  return sim.players.find((player) => player.id === id);
}

export function addPlayer(sim: GameSim, options: { id: string; name?: string; x: number; y: number; seed?: number }): PlayerSim {
  const existing = playerById(sim, options.id);
  if (existing) return existing;
  const player = createPlayer(options);
  sim.players.push(player);
  return player;
}

export function removePlayer(sim: GameSim, id: PlayerId) {
  sim.players = sim.players.filter((player) => player.id !== id);
}

export function createSim(options: {
  players?: Array<{ id?: string; name?: string; x: number; y: number; seed?: number }>;
  fish: FishSpec[];
  mice?: MouseSpec[];
  interactables?: Interactable[];
}): GameSim {
  const players = options.players ?? [{ id: LOCAL_PLAYER_ID, ...DEFAULT_SPAWN }];
  return {
    elapsed: 0,
    tick: 0,
    players: players.map((player, index) => createPlayer({
      id: player.id ?? (index === 0 ? LOCAL_PLAYER_ID : `player-${index}`),
      name: player.name,
      x: player.x,
      y: player.y,
      seed: player.seed,
    })),
    fish: options.fish.map((spec) => fishAt(spec, 0, 1)),
    mice: (options.mice ?? []).map((spec) => mouseAt(spec, 0, 1)),
    interactables: options.interactables ?? [],
  };
}

/** Deep JSON clone — the wire shape a host would send. */
export function snapshotSim(sim: GameSim): GameSim {
  return JSON.parse(JSON.stringify(sim)) as GameSim;
}

export function applySnapshot(sim: GameSim, snapshot: GameSim) {
  const next = snapshotSim(snapshot);
  sim.elapsed = next.elapsed;
  sim.tick = next.tick;
  sim.players = next.players;
  sim.fish = next.fish;
  sim.mice = next.mice;
  sim.interactables = next.interactables;
}

export function nearestInteractable(
  x: number,
  y: number,
  interactables: readonly Interactable[],
  range = INTERACT_RANGE,
  allowIntake = true,
) {
  let best: Interactable | null = null;
  let bestDist = range;
  for (const item of interactables) {
    if (item.kind === "intake" && !allowIntake) continue;
    const dist = item.kind === "intake" && nearIntakeRim(x, y)
      ? 0
      : Math.hypot(item.x - x, item.y - y);
    if (dist <= bestDist) {
      best = item;
      bestDist = dist;
    }
  }
  return best;
}

function tickPlayer(
  player: PlayerSim,
  input: MoveInput,
  dt: number,
  walkable: Walkable,
  interactables: readonly Interactable[],
) {
  const nearby = nearestInteractable(player.x, player.y, interactables, INTERACT_RANGE, canStuffIntake(player));
  player.nearbyId = nearby?.id ?? null;
  if (input.interact) {
    if (player.openId) closeDialog(player);
    else if (nearby) {
      player.openId = nearby.id;
      if (nearby.kind === "mailbox") beginSandwhisker(player);
      else if (nearby.kind === "bernie") talkToBernie(player);
      else if (nearby.kind === "sam") talkToSam(player);
      else if (nearby.kind === "rabbit") talkToHopsk(player);
      else if (nearby.kind === "intake") talkToIntake(player);
    } else {
      player.meowing = true;
      player.meowElapsed = 0;
      player.meowNonce += 1;
    }
  } else if (player.openId && player.openId !== player.nearbyId) {
    closeDialog(player);
  }

  if (player.meowing) {
    player.meowElapsed += dt;
    if (player.meowElapsed >= MEOW_DURATION) {
      player.meowing = false;
      player.meowElapsed = 0;
    }
  }

  if (player.questHint) {
    if (!player.openId) player.questHintElapsed += dt;
    if (player.questHintElapsed >= QUEST_HINT_DURATION) {
      player.questHint = null;
      player.questHintElapsed = 0;
    }
  }

  if (player.openId) {
    player.moving = false;
    player.walkElapsed = 0;
    if (player.clawing) player.clawElapsed += dt;
    return;
  }

  player.moving = input.x !== 0 || input.y !== 0;
  if (player.moving) player.walkElapsed += dt;
  else player.walkElapsed = 0;
  if (player.moving && !player.clawing) {
    player.facing = facingFromMove(input.x, input.y, player.facing);
  }
  if (input.claw && !player.clawing) {
    player.clawing = true;
    player.clawElapsed = 0;
    player.clawHit = false;
  }
  if (player.clawing) player.clawElapsed += dt;
  if (player.moving) {
    const edgeX = MAP_WIDTH / 2 - MAP_WALK_MARGIN;
    const edgeY = MAP_HEIGHT / 2 - MAP_WALK_MARGIN;
    const nextX = clamp(player.x + input.x * CAT_SPEED * dt, -edgeX, edgeX);
    const nextY = clamp(player.y + input.y * CAT_SPEED * dt, -edgeY, edgeY);
    if (walkable(nextX, nextY)) {
      player.x = nextX;
      player.y = nextY;
    } else if (walkable(nextX, player.y)) {
      player.x = nextX;
    } else if (walkable(player.x, nextY)) {
      player.y = nextY;
    }
  }
}

function tickPrey(sim: GameSim, dt: number) {
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
}

function finishClaws(sim: GameSim) {
  for (const player of sim.players) {
    if (player.clawing && player.clawElapsed >= CLAW_DURATION) {
      player.clawing = false;
      player.clawElapsed = 0;
    }
  }
}

function resolveClaws(sim: GameSim) {
  for (const player of sim.players) {
    if (!player.clawing || player.clawElapsed / CLAW_DURATION < CLAW_HIT_AT) continue;
    for (const mouse of sim.mice) {
      if (!clawHitsTarget(player, mouse)) continue;
      mouse.alive = false;
      mouse.respawnIn = PREY_RESPAWN;
      player.clawHit = true;
      addToInventory(player, "mouse");
    }
    for (const fish of sim.fish) {
      if (!clawHitsTarget(player, fish)) continue;
      fish.alive = false;
      fish.respawnIn = PREY_RESPAWN;
      player.clawHit = true;
      addToInventory(player, fish.kind);
    }
  }
}

export function tickSim(sim: GameSim, inputs: PlayerInputs, dt: number, walkable: Walkable) {
  sim.elapsed += dt;
  sim.tick += 1;
  for (const player of sim.players) {
    tickPlayer(player, inputs[player.id] ?? IDLE_INPUT, dt, walkable, sim.interactables);
  }
  tickPrey(sim, dt);
  resolveClaws(sim);
  finishClaws(sim);
}

/** Run onTick once per fixed step. Edge-triggered input must be sampled inside onTick, not before. */
export function drainFixedTicks(
  accumulator: number,
  tickDt: number,
  maxTicks: number,
  onTick: () => void,
) {
  let steps = 0;
  while (accumulator >= tickDt && steps < maxTicks) {
    onTick();
    accumulator -= tickDt;
    steps += 1;
  }
  return steps >= maxTicks ? 0 : accumulator;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
