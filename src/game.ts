import * as THREE from "three";
import "./styles.css";
import { createKeyboardInput, createPlayerInput } from "./input";
import { createTouchHud } from "./touch-hud";
import { updateLakeModel } from "./lake-model";
import { createMailHud } from "./mail-hud";
import { createMeowLayer, type SpeechPop } from "./meow-hud";
import { createNameLayer, playerNameTags, type NameTag } from "./name-hud";
import { createBackgroundMusic } from "./music";
import { createPackHud } from "./pack-hud";
import { createQuestHud } from "./quest-hud";
import { createSettingsHud } from "./settings-hud";
import { createSfxPlayer, FIRE_FADE_RANGE, GULP_FADE_RANGE, gulpDistance, ROCKET_SOUND_DELAY } from "./sfx";
import { createEndingHud } from "./ending-hud";
import { createTalkHud } from "./talk-hud";
import { paintPixelTexture } from "./pixel-canvas";
import { intakeGulpIndex, updateIntakePipeModel } from "./pipe-model";
import { createRocketFx, updateRocketFx } from "./rocket-fx";
import { createHutFx, createShedFx, updateHutFx } from "./hut-fx";
import { createDataCenterFx, updateDataCenterFx } from "./datacenter-fx";
import { updateDriedPondModel } from "./pond-model";
import {
  createSim,
  drainFixedTicks,
  playerById,
  rocketCarrotPose,
  tickSim,
  type CatFacing,
  type FishSim,
  type MouseSim,
  type PlayerSim,
} from "./sim";
import { createWalkable, createWorldLayout, type WorldProp } from "./world";
import { addWorldBackdrop } from "./world-backdrop";
import {
  BERNIE_NAME,
  GRETA_NAME,
  BERNIE_POND_X,
  BERNIE_POND_Y,
  CAT_SCALE,
  CLAW_DURATION,
  CLAW_HIT_AT,
  DATA_CENTER,
  DEFAULT_CAT_SEED,
  FARM_CARROTS,
  DEFAULT_SPAWN,
  LOCAL_PLAYER_ID,
  MAILBOX,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_TICKS_PER_FRAME,
  INTAKE,
  RABBIT_NAME,
  ROCKET_CARROT,
  SAM_NAME,
  TICK_DT,
  VIEW_HEIGHT,
  WALK_FRAME,
  WOLFENBERG_NAME,
} from "./world-config";
import { createWorldModel, getWorldModelTexture, applyWorldPropPose, type WorldModelKind } from "./world-models";

type CatTextures = {
  views: Record<CatFacing, THREE.Texture[]>;
  clawHit: Record<CatFacing, THREE.Texture[]>;
};

const FACINGS: CatFacing[] = ["e", "w", "n", "s"];

function catTextures(seed: number, cache: Map<number, CatTextures>): CatTextures {
  const cached = cache.get(seed);
  if (cached) return cached;
  const views = {} as CatTextures["views"];
  const clawHit = {} as CatTextures["clawHit"];
  for (const facing of FACINGS) {
    views[facing] = [0, 1, 2, 3, 4, 5, 6, 7].map((variant) => getWorldModelTexture("cat", { seed, variant, facing }));
    clawHit[facing] = [5, 6, 7].map((variant) => getWorldModelTexture("cat", { seed, variant, facing, hit: true }));
  }
  const created = { views, clawHit };
  cache.set(seed, created);
  return created;
}

export function createGame() {
  const canvas = document.querySelector<HTMLCanvasElement>("#world");
  if (!canvas) throw new Error("World canvas is missing");
  const music = createBackgroundMusic();
  const sfx = createSfxPlayer(() => music.sfxVolume());

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x688f45);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-480, 480, 270, -270, 0.1, 2000);
  camera.position.set(0, 0, 1000);

  const world = new THREE.Group();
  scene.add(world);
  // Neither root ever moves. Leaving them auto-updating forces three.js to
  // recompose a matrix for every sprite in the world, every frame.
  scene.matrixAutoUpdate = false;
  world.matrixAutoUpdate = false;

  const { southernLake, berniePond, intakePipe } = addWorldBackdrop(world);

  const layout = createWorldLayout();
  const occluders: THREE.Sprite[] = [];
  const worldEntities: Array<{ id: string; kind: WorldModelKind; x: number; y: number }> = [];
  world.userData.entities = worldEntities;
  const lanterns: THREE.Sprite[] = [];
  let mailNotice: THREE.Sprite | undefined;
  let bernieHut: THREE.Sprite | undefined;
  let hopskShed: THREE.Sprite | undefined;
  const farmCarrotSprites: Array<THREE.Sprite | undefined> = FARM_CARROTS.map(() => undefined);
  let dataHall: THREE.Sprite | undefined;
  const rackSprites: THREE.Sprite[] = [];

  function place(prop: WorldProp) {
    const model = createWorldModel(prop.kind, {
      scale: prop.scale,
      seed: prop.seed,
      variant: prop.variant,
      sick: prop.sick,
    });
    applyWorldPropPose(model, prop);
    model.renderOrder = 10000 - Math.round(prop.y);
    model.userData.baseY = prop.y;
    world.add(model);
    worldEntities.push({ id: model.userData.id as string, kind: prop.kind, x: prop.x, y: prop.y });
    if (prop.kind === "pine" || prop.kind === "oak" || prop.kind === "willow" || prop.kind === "den" || prop.kind === "hut" || prop.kind === "datacenter" || prop.kind === "racks" || prop.kind === "carrot" || prop.kind === "shed") {
      (model.material as THREE.SpriteMaterial).alphaTest = 0.08;
      occluders.push(model);
    }
    if (prop.kind === "lamp") lanterns.push(model);
    if (prop.kind === "hut") bernieHut = model;
    if (prop.kind === "shed") hopskShed = model;
    if (prop.kind === "carrot") {
      const index = FARM_CARROTS.findIndex((crop) => crop.x === prop.x && crop.y === prop.y);
      if (index >= 0) farmCarrotSprites[index] = model;
    }
    if (prop.kind === "datacenter") dataHall = model;
    if (prop.kind === "racks") rackSprites.push(model);
    if (prop.kind === "mailBubble") {
      model.position.z = 12;
      model.renderOrder = 30000;
      (model.material as THREE.SpriteMaterial).depthTest = false;
      mailNotice = model;
    }
    // Rocket carrots fly and the mailbox notice bobs; every other prop is placed once.
    if (prop.kind !== "carrot" && prop.kind !== "mailBubble") {
      model.matrixAutoUpdate = false;
      model.updateMatrix();
    }
    return model;
  }
  for (const prop of layout.props) place(prop);
  if (!mailNotice) throw new Error("Mailbox notice is missing from the world layout");
  if (!bernieHut) throw new Error("Bernie hut is missing from the world layout");
  if (!hopskShed) throw new Error("Hopsk shed is missing from the world layout");
  if (farmCarrotSprites.some((sprite) => !sprite)) throw new Error("Farm carrots are missing from the world layout");
  if (!dataHall) throw new Error("Data center is missing from the world layout");
  const mailboxNotice: THREE.Sprite = mailNotice;
  const hutSprite: THREE.Sprite = bernieHut;
  const hutFx = createHutFx(hutSprite, world);
  const shedSprite: THREE.Sprite = hopskShed;
  const shedFx = createShedFx(shedSprite, world);
  const rocketSprites = farmCarrotSprites as THREE.Sprite[];
  const rocketFx = rocketSprites.map((sprite, index) => {
    const crop = FARM_CARROTS[index]!;
    return createRocketFx(
      sprite,
      world,
      getWorldModelTexture("carrot", { seed: crop.seed, variant: crop.variant }),
      getWorldModelTexture("carrot", { seed: crop.seed, variant: 20 }),
      { x: crop.x, y: crop.y },
    );
  });
  const dataCenterFx = createDataCenterFx(dataHall, rackSprites, world);
  const clogCarrot = createWorldModel("carrot", { scale: 0.86, seed: 88, variant: 10 });
  clogCarrot.position.set(BERNIE_POND_X + 6, BERNIE_POND_Y - 4, 0);
  clogCarrot.renderOrder = 10000 - Math.round(BERNIE_POND_Y);
  clogCarrot.visible = false;
  (clogCarrot.material as THREE.SpriteMaterial).alphaTest = 0.08;
  clogCarrot.matrixAutoUpdate = false;
  clogCarrot.updateMatrix();
  world.add(clogCarrot);

  const lanternFlameFrames = [
    paintPixelTexture(8, 12, (ctx) => {
      ctx.fillStyle = "#d8653f";
      ctx.fillRect(2, 4, 5, 7);
      ctx.fillRect(3, 2, 3, 3);
      ctx.fillStyle = "#ffd36a";
      ctx.fillRect(3, 6, 3, 4);
      ctx.fillRect(4, 4, 2, 2);
    }),
    paintPixelTexture(8, 12, (ctx) => {
      ctx.fillStyle = "#d8653f";
      ctx.fillRect(1, 5, 5, 6);
      ctx.fillRect(3, 2, 3, 4);
      ctx.fillStyle = "#ffd36a";
      ctx.fillRect(3, 6, 2, 4);
      ctx.fillRect(4, 4, 2, 3);
    }),
    paintPixelTexture(8, 12, (ctx) => {
      ctx.fillStyle = "#d8653f";
      ctx.fillRect(2, 5, 5, 6);
      ctx.fillRect(2, 3, 3, 3);
      ctx.fillStyle = "#ffd36a";
      ctx.fillRect(3, 7, 3, 3);
      ctx.fillRect(3, 5, 2, 2);
    }),
  ];

  const lanternFlames = lanterns.map((lantern, index) => {
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: lanternFlameFrames[index] ?? lanternFlameFrames[0],
      transparent: true,
      alphaTest: 0.1,
      depthTest: false,
    }));
    flame.scale.set(9, 14, 1);
    flame.position.set(lantern.position.x, lantern.position.y + 65, 12);
    flame.renderOrder = lantern.renderOrder + 1;
    flame.matrixAutoUpdate = false;
    flame.updateMatrix();
    world.add(flame);
    return flame;
  });

  const atRocket = location.hash === "#rocket";
  const sim = createSim({
    players: [{
      id: LOCAL_PLAYER_ID,
      name: "Mosswhisker",
      x: atRocket ? ROCKET_CARROT.x : DEFAULT_SPAWN.x,
      y: atRocket ? ROCKET_CARROT.y + 40 : DEFAULT_SPAWN.y,
      seed: DEFAULT_CAT_SEED,
    }],
    fish: layout.fish,
    mice: layout.mice,
    interactables: layout.interactables,
  });
  if (atRocket) {
    const preview = playerById(sim, LOCAL_PLAYER_ID);
    if (preview) preview.facing = "s";
  }

  const textureCache = new Map<number, CatTextures>();
  type PlayerView = { sprite: THREE.Sprite; scaleX: number };
  const playerViews = new Map<string, PlayerView>();

  function attachPlayer(player: PlayerSim) {
    const sprite = createWorldModel("cat", {
      scale: CAT_SCALE,
      seed: player.seed,
      variant: 0,
      facing: player.facing,
    });
    sprite.renderOrder = 10005;
    sprite.userData.id = player.id;
    world.add(sprite);
    const view = { sprite, scaleX: Math.abs(sprite.scale.x) };
    playerViews.set(player.id, view);
    return view;
  }

  function paintPlayer(player: PlayerSim) {
    let view = playerViews.get(player.id);
    if (!view) view = attachPlayer(player);
    const { sprite, scaleX } = view;
    const maps = catTextures(player.seed, textureCache);
    sprite.position.x = player.x;
    sprite.position.y = player.y;
    sprite.scale.x = scaleX;
    const material = sprite.material as THREE.SpriteMaterial;
    if (player.clawing) {
      const swing = player.clawElapsed / CLAW_DURATION;
      const frame = swing < CLAW_HIT_AT ? 5 : swing < 0.64 ? 6 : 7;
      material.map = player.clawHit
        ? maps.clawHit[player.facing][frame - 5]!
        : maps.views[player.facing][frame]!;
    } else if (player.moving) {
      const frame = 1 + (Math.floor(player.walkElapsed / WALK_FRAME) % 4);
      material.map = maps.views[player.facing][frame]!;
    } else {
      material.map = maps.views[player.facing][0]!;
    }
    sprite.position.z = player.clawing
      ? 1.2
      : player.moving
        ? Math.sin(player.walkElapsed * 22) * 0.6
        : Math.sin(sim.elapsed * 3.2 + player.seed) * 0.7;
    sprite.renderOrder = 10000 - Math.round(sprite.position.y);
  }

  const livingPlayers = new Set<string>();
  function syncPlayers(players: readonly PlayerSim[]) {
    livingPlayers.clear();
    for (const player of players) livingPlayers.add(player.id);
    for (const [id, view] of playerViews) {
      if (livingPlayers.has(id)) continue;
      world.remove(view.sprite);
      playerViews.delete(id);
    }
    for (const player of players) paintPlayer(player);
  }

  type FishView = {
    sprite: THREE.Sprite;
    frames: { e: [THREE.Texture, THREE.Texture]; w: [THREE.Texture, THREE.Texture] };
  };
  const fishViews = new Map<string, FishView>();

  function attachFish(fish: FishSim, scale: number, seed: number) {
    const east0 = getWorldModelTexture(fish.kind, { seed, variant: 0, facing: "e" });
    const east1 = getWorldModelTexture(fish.kind, { seed, variant: 1, facing: "e" });
    const west0 = getWorldModelTexture(fish.kind, { seed, variant: 0, facing: "w" });
    const west1 = getWorldModelTexture(fish.kind, { seed, variant: 1, facing: "w" });
    const sprite = createWorldModel(fish.kind, { scale, seed, variant: 0, facing: "e" });
    const material = sprite.material as THREE.SpriteMaterial;
    material.opacity = 0.58;
    material.color.set("#9eb8b6");
    material.alphaTest = 0.08;
    sprite.center.set(0.5, 0.58);
    sprite.position.set(fish.x, fish.y, -2.4);
    sprite.renderOrder = -8;
    sprite.userData.id = fish.id;
    world.add(sprite);
    fishViews.set(fish.id, { sprite, frames: { e: [east0, east1], w: [west0, west1] } });
  }
  sim.fish.forEach((fish, index) => attachFish(fish, 1.1 + (index % 3) * 0.04, 801 + index));

  type MouseView = {
    sprite: THREE.Sprite;
    frames: { e: [THREE.Texture, THREE.Texture]; w: [THREE.Texture, THREE.Texture] };
  };
  const mouseViews = new Map<string, MouseView>();

  function attachMouse(mouse: MouseSim, scale: number, seed: number) {
    const east0 = getWorldModelTexture("mouse", { seed, variant: 0, facing: "e" });
    const east1 = getWorldModelTexture("mouse", { seed, variant: 1, facing: "e" });
    const west0 = getWorldModelTexture("mouse", { seed, variant: 0, facing: "w" });
    const west1 = getWorldModelTexture("mouse", { seed, variant: 1, facing: "w" });
    const sprite = createWorldModel("mouse", { scale, seed, variant: 0, facing: "e" });
    sprite.position.set(mouse.x, mouse.y, 0);
    sprite.renderOrder = 10000 - Math.round(mouse.y);
    sprite.userData.id = mouse.id;
    world.add(sprite);
    mouseViews.set(mouse.id, { sprite, frames: { e: [east0, east1], w: [west0, west1] } });
  }
  sim.mice.forEach((mouse, index) => attachMouse(mouse, 1.05 + (index % 3) * 0.08, 900 + (index % 3)));

  function walkableSolids() {
    return layout.trunks.filter((solid) => {
      const index = FARM_CARROTS.findIndex((crop) => crop.x === solid.x && crop.y === solid.y);
      if (index < 0) return true;
      return !sim.rocketCarrots[index]?.launched;
    });
  }
  let walkable = createWalkable(layout.trunks);
  let launchMask = 0;
  function syncWalkable() {
    let next = 0;
    for (let index = 0; index < sim.rocketCarrots.length; index++) {
      if (sim.rocketCarrots[index]!.launched) next |= 1 << index;
    }
    if (next === launchMask) return;
    launchMask = next;
    walkable = createWalkable(walkableSolids());
  }
  const gameRoot = document.getElementById("game") ?? document.body;
  const touch = createTouchHud(gameRoot);
  const input = createPlayerInput(createKeyboardInput(), touch);
  const packRoot = document.querySelector<HTMLElement>(".pack-hud");
  if (!packRoot) throw new Error("Pack HUD is missing");
  const pack = createPackHud(packRoot);
  const questRoot = document.querySelector<HTMLElement>(".quest-hud");
  if (!questRoot) throw new Error("Quest HUD is missing");
  const quest = createQuestHud(questRoot);
  const settingsRoot = document.querySelector<HTMLElement>(".settings-hud");
  if (!settingsRoot) throw new Error("Settings HUD is missing");
  const settings = createSettingsHud(settingsRoot, music);
  const mail = createMailHud(gameRoot);
  const talk = createTalkHud(gameRoot);
  const ending = createEndingHud(gameRoot);
  const meows = createMeowLayer(world);
  const names = createNameLayer(world);
  /** Named NPCs never move, so their tags are built once. */
  const npcNameTags = ([
    ["bernie", "npc-bernie", BERNIE_NAME],
    ["sam", "npc-sam", SAM_NAME],
    ["rabbit", "npc-hopsk", RABBIT_NAME],
    ["greta", "npc-greta", GRETA_NAME],
    ["wolfenberg", "npc-wolfenberg", WOLFENBERG_NAME],
  ] as const).flatMap(([itemId, tagId, name]) => {
    const npc = layout.interactables.find((item) => item.id === itemId);
    return npc ? [{ id: tagId, name, x: npc.x, y: npc.y }] : [];
  });
  const nameTags: NameTag[] = [];
  const launchedRockets = new Set<THREE.Sprite>();
  const heardMeow = new Map<string, number>();
  const heardClaw = new Map<string, number>();
  const heardClawWood = new Map<string, number>();
  const heardHiss = new Map<string, number>();
  const heardRockets = new Set<number>();
  const heardMice = new Set<string>();
  const heardFish = new Set<string>();
  function hear(map: Map<string, number>, id: string, nonce: number, play: () => void) {
    if (nonce <= (map.get(id) ?? 0)) return;
    map.set(id, nonce);
    play();
  }
  function syncSfx() {
    for (const player of sim.players) {
      hear(heardMeow, player.id, player.meowNonce, () => sfx.playMeow());
      hear(heardClaw, player.id, player.clawNonce, () => sfx.playClaw());
      if (player.clawWood) hear(heardClawWood, player.id, player.clawNonce, () => sfx.playClawWood());
    }
    for (const hiss of sim.hisses) {
      hear(heardHiss, hiss.id, hiss.hissNonce, () => sfx.playHiss());
    }
    for (const [index, rocket] of sim.rocketCarrots.entries()) {
      if (!rocket.launched || rocket.elapsed < ROCKET_SOUND_DELAY || heardRockets.has(index)) continue;
      heardRockets.add(index);
      sfx.playRocket();
    }
    for (const mouse of sim.mice) {
      if (mouse.alive) {
        heardMice.delete(mouse.id);
        continue;
      }
      if (heardMice.has(mouse.id)) continue;
      heardMice.add(mouse.id);
      sfx.playMouse();
    }
    for (const fish of sim.fish) {
      if (fish.alive) {
        heardFish.delete(fish.id);
        continue;
      }
      if (heardFish.has(fish.id)) continue;
      heardFish.add(fish.id);
      sfx.playSplash();
    }
    const listener = playerById(sim, LOCAL_PLAYER_ID) ?? sim.players[0];
    const campusDistance = listener
      ? Math.hypot(listener.x - DATA_CENTER.x, listener.y - DATA_CENTER.y)
      : FIRE_FADE_RANGE;
    const burning = Boolean(listener?.progress.pipeClogged);
    sfx.syncGulp({
      gulpIndex: intakeGulpIndex(sim.elapsed, intakePipe.length),
      clogged: burning,
      distance: listener
        ? gulpDistance(listener.x - INTAKE.x, listener.y - INTAKE.y)
        : GULP_FADE_RANGE,
    });
    sfx.syncFire({ burning, distance: campusDistance });
    sfx.syncBeep({ humming: Boolean(listener) && !burning, distance: campusDistance });
  }
  const pops: SpeechPop[] = [];
  function speechPops() {
    pops.length = 0;
    for (const player of sim.players) {
      if (!player.meowing) continue;
      pops.push({ id: player.id, x: player.x, y: player.y, elapsed: player.meowElapsed, label: "Meow" });
    }
    for (const hiss of sim.hisses) {
      if (!hiss.hissing) continue;
      const npc = sim.interactables.find((item) => item.id === hiss.id);
      if (!npc) continue;
      pops.push({ id: `hiss-${hiss.id}`, x: npc.x, y: npc.y, elapsed: hiss.hissElapsed, label: "SSSSS" });
    }
    return pops;
  }
  let viewWidth = 960;
  function viewportBox() {
    const view = window.visualViewport;
    return {
      width: Math.round(view?.width ?? window.innerWidth),
      height: Math.round(view?.height ?? window.innerHeight),
      top: Math.round(view?.offsetTop ?? 0),
      left: Math.round(view?.offsetLeft ?? 0),
    };
  }
  function resize() {
    const { width, height, top, left } = viewportBox();
    gameRoot.style.top = `${top}px`;
    gameRoot.style.left = `${left}px`;
    gameRoot.style.width = `${width}px`;
    gameRoot.style.height = `${height}px`;
    renderer.setSize(width, height, false);
    viewWidth = VIEW_HEIGHT * (width / height);
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = VIEW_HEIGHT / 2;
    camera.bottom = -VIEW_HEIGHT / 2;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("scroll", resize);
  resize();

  /**
   * The intake strip spans a third of the map and repainting it costs more than
   * the rest of the frame put together, so it only animates while on camera.
   * The margin covers the camera drifting in before its lerp runs below.
   */
  function intakePipeOnCamera() {
    const { minX, maxX, minY, maxY } = intakePipe.bounds;
    const margin = 64;
    return maxX + margin > camera.position.x - viewWidth / 2
      && minX - margin < camera.position.x + viewWidth / 2
      && maxY + margin > camera.position.y - VIEW_HEIGHT / 2
      && minY - margin < camera.position.y + VIEW_HEIGHT / 2;
  }

  const clock = new THREE.Clock(false);
  let accumulator = 0;
  let raf = 0;
  let started = false;
  function animate() {
    raf = requestAnimationFrame(animate);
    const frameDt = Math.min(clock.getDelta(), 0.05);
    accumulator += frameDt;
    accumulator = drainFixedTicks(accumulator, TICK_DT, MAX_TICKS_PER_FRAME, () => {
      const sample = input.sample();
      if (ending.blocking()) {
        mail.consumeDismiss();
        talk.consumeDismiss();
        sample.x = 0;
        sample.y = 0;
        sample.claw = false;
        sample.interact = false;
      } else if (mail.consumeDismiss() || talk.consumeDismiss()) {
        sample.interact = true;
      }
      syncWalkable();
      tickSim(sim, { [LOCAL_PLAYER_ID]: sample }, TICK_DT, walkable, layout.trees);
    });
    syncSfx();

    syncPlayers(sim.players);
    meows.sync(speechPops());
    nameTags.length = 0;
    for (const tag of npcNameTags) nameTags.push(tag);
    for (const tag of playerNameTags(sim.players)) nameTags.push(tag);
    names.sync(nameTags);

    const catHalfW = CAT_SCALE * 20 * 0.3;
    launchedRockets.clear();
    for (let index = 0; index < sim.rocketCarrots.length; index++) {
      if (sim.rocketCarrots[index]!.launched) launchedRockets.add(rocketSprites[index]!);
    }
    for (const sprite of occluders) {
      const material = sprite.material as THREE.SpriteMaterial;
      if (launchedRockets.has(sprite)) {
        material.opacity = 1;
        continue;
      }
      const halfW = sprite.scale.x * 0.28;
      const intoTree = sprite.position.y + sprite.scale.y * 0.16;
      const underCanopy = sprite.position.y + sprite.scale.y * 0.82;
      let overlapping = false;
      for (const player of sim.players) {
        if (
          Math.abs(player.x - sprite.position.x) < halfW + catHalfW
          && player.y > intoTree
          && player.y < underCanopy
        ) {
          overlapping = true;
          break;
        }
      }
      const target = overlapping ? 0.38 : 1;
      material.opacity += (target - material.opacity) * Math.min(1, 8 * frameDt);
    }
    mailboxNotice.position.y = MAILBOX.y + 64 + Math.round(Math.sin(sim.elapsed * 4) * 2);
    lanternFlames.forEach((flame, index) => {
      const frame = Math.floor(sim.elapsed / 0.22 + index) % lanternFlameFrames.length;
      (flame.material as THREE.SpriteMaterial).map = lanternFlameFrames[frame]!;
    });
    const local = playerById(sim, LOCAL_PLAYER_ID) ?? sim.players[0];
    const clogged = Boolean(local?.progress.pipeClogged);
    updateLakeModel(southernLake, sim.elapsed);
    updateDriedPondModel(berniePond, sim.elapsed);
    clogCarrot.visible = clogged;
    if (intakePipeOnCamera()) updateIntakePipeModel(intakePipe, sim.elapsed, clogged);
    updateHutFx(hutFx, hutSprite, sim.elapsed);
    updateHutFx(shedFx, shedSprite, sim.elapsed + 0.9);
    for (const [index, sprite] of rocketSprites.entries()) {
      const rocket = sim.rocketCarrots[index]!;
      const crop = FARM_CARROTS[index]!;
      updateRocketFx(
        rocketFx[index]!,
        sprite,
        rocketCarrotPose(rocket.elapsed, crop, index),
        rocket.elapsed,
        rocket.launched,
      );
    }
    updateDataCenterFx(dataCenterFx, sim.elapsed, clogged);
    for (const fish of sim.fish) {
      const view = fishViews.get(fish.id);
      if (!view) continue;
      view.sprite.visible = fish.alive;
      if (!fish.alive) continue;
      view.sprite.position.x = Math.round(fish.x);
      view.sprite.position.y = Math.round(fish.y + Math.sin(sim.elapsed * 0.55 + fish.phase) * 0.5);
      view.sprite.renderOrder = -8;
      const facing = fish.facing < 0 ? "w" : "e";
      (view.sprite.material as THREE.SpriteMaterial).map = view.frames[facing][fish.frame]!;
    }
    for (const mouse of sim.mice) {
      const view = mouseViews.get(mouse.id);
      if (!view) continue;
      view.sprite.visible = mouse.alive;
      if (!mouse.alive) continue;
      view.sprite.position.x = Math.round(mouse.x);
      view.sprite.position.y = Math.round(mouse.y);
      view.sprite.renderOrder = 10000 - Math.round(mouse.y);
      const facing = mouse.facing < 0 ? "w" : "e";
      (view.sprite.material as THREE.SpriteMaterial).map = view.frames[facing][mouse.frame]!;
    }

    if (local) {
      pack.sync(local.inventory);
      quest.sync(local);
      mail.sync(local);
      talk.sync(local);
      touch.sync(local);
      ending.sync(local);
      mailboxNotice.visible = !local.progress.mailboxRead;
      const cameraEdgeX = Math.max(0, MAP_WIDTH / 2 - viewWidth / 2);
      const cameraEdgeY = MAP_HEIGHT / 2 - VIEW_HEIGHT / 2;
      const cameraTargetX = THREE.MathUtils.clamp(local.x, -cameraEdgeX, cameraEdgeX);
      const cameraTargetY = THREE.MathUtils.clamp(local.y + 24, -cameraEdgeY, cameraEdgeY);
      const cameraFollow = 1 - Math.exp(-6 * frameDt);
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraTargetX, cameraFollow);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraTargetY, cameraFollow);
    }
    ending.tick(frameDt);
    renderer.render(scene, camera);
  }
  syncPlayers(sim.players);
  renderer.render(scene, camera);

  return {
    start() {
      if (started) return;
      started = true;
      music.arm();
      clock.start();
      animate();
    },
    dispose() {
      started = false;
      cancelAnimationFrame(raf);
      settings.dispose();
      music.dispose();
      sfx.dispose();
      input.dispose();
      pack.dispose();
      quest.dispose();
      mail.dispose();
      talk.dispose();
      ending.dispose();
      meows.dispose();
      names.dispose();
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
    },
  };
}
