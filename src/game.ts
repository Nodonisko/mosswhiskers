import * as THREE from "three";
import "./styles.css";
import { createKeyboardInput } from "./input";
import { createLakeModel, updateLakeModel } from "./lake-model";
import { createMailHud } from "./mail-hud";
import { createPackHud } from "./pack-hud";
import { createQuestHud } from "./quest-hud";
import { paintPixelTexture } from "./pixel-canvas";
import { createPierModel } from "./pier-model";
import { seeded } from "./rng";
import {
  createSim,
  drainFixedTicks,
  playerById,
  tickSim,
  type CatFacing,
  type FishSim,
  type MouseSim,
  type PlayerSim,
} from "./sim";
import { createWalkable, createWorldLayout, type WorldProp } from "./world";
import {
  CAT_SCALE,
  CLAW_DURATION,
  CLAW_HIT_AT,
  DEFAULT_CAT_SEED,
  DEFAULT_SPAWN,
  LAKE_HEIGHT,
  LAKE_SEED,
  LAKE_WIDTH,
  LAKE_X,
  LAKE_Y,
  LOCAL_PLAYER_ID,
  MAILBOX,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_TICKS_PER_FRAME,
  PIER_SEED,
  PIER_X,
  PIER_Y,
  TICK_DT,
  VIEW_HEIGHT,
  WALK_FRAME,
  denPathX,
  mainPathY,
  southPathX,
} from "./world-config";
import { createWorldModel, getWorldModelTexture, type WorldModelKind } from "./world-models";

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

function startGame() {
  const canvas = document.querySelector<HTMLCanvasElement>("#world");
  if (!canvas) throw new Error("World canvas is missing");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x688f45);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-480, 480, 270, -270, 0.1, 2000);
  camera.position.set(0, 0, 1000);

  const world = new THREE.Group();
  scene.add(world);

  const textureLoader = new THREE.TextureLoader();
  const grass = textureLoader.load("/assets/meadow-texture.png");
  grass.colorSpace = THREE.SRGBColorSpace;
  grass.magFilter = THREE.NearestFilter;
  grass.minFilter = THREE.NearestMipmapLinearFilter;
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(7.2, 5.1);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT),
    new THREE.MeshBasicMaterial({ map: grass, color: 0xe5f0ca }),
  );
  ground.position.z = -20;
  ground.renderOrder = -100;
  world.add(ground);

  function makeForestPaths() {
    const textureWidth = 650;
    const textureHeight = 450;
    const worldToTextureX = (x: number) => (x + MAP_WIDTH / 2) / 4;
    const worldToTextureY = (y: number) => (MAP_HEIGHT / 2 - y) / 4;
    const map = paintPixelTexture(textureWidth, textureHeight, (ctx) => {
      const routes: Array<Array<[number, number]>> = [];
      const drawRouteStroke = (points: Array<[number, number]>, width: number, color: string) => {
        ctx.beginPath();
        points.forEach(([x, y], index) => {
          const textureX = worldToTextureX(x);
          const textureY = worldToTextureY(y);
          if (index === 0) ctx.moveTo(textureX, textureY);
          else ctx.lineTo(textureX, textureY);
        });
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.stroke();
      };

      const mainRoute: Array<[number, number]> = [];
      for (let x = -MAP_WIDTH / 2 - 40; x <= MAP_WIDTH / 2 + 40; x += 24) {
        mainRoute.push([x, mainPathY(x)]);
      }
      routes.push(mainRoute);

      const southRoute: Array<[number, number]> = [];
      for (let y = mainPathY(655); y >= -MAP_HEIGHT / 2 - 30; y -= 22) {
        southRoute.push([southPathX(y), y]);
      }
      routes.push(southRoute);

      const denRoute: Array<[number, number]> = [];
      for (let y = mainPathY(0); y <= 28; y += 14) {
        denRoute.push([denPathX(y), y]);
      }
      routes.push(denRoute);

      const pathLayers: Array<[number, string]> = [
        [13, "#625138"],
        [11, "#8b6c43"],
        [7, "#a6814e"],
      ];
      for (const [width, color] of pathLayers) {
        for (const route of routes) drawRouteStroke(route, width, color);
      }

      const dirtColors = ["#765c3b", "#947348", "#b18c59", "#bc9867"];
      const pathRandom = seeded(7123);
      const coverage = ctx.getImageData(0, 0, textureWidth, textureHeight).data;
      for (let index = 0; index < 1500; index++) {
        const x = Math.floor(pathRandom() * textureWidth);
        const y = Math.floor(pathRandom() * textureHeight);
        if (coverage[(y * textureWidth + x) * 4 + 3] === 0) continue;
        ctx.fillStyle = dirtColors[index % dirtColors.length] ?? "#71583a";
        const size = pathRandom() > 0.86 ? 2 : 1;
        ctx.fillRect(x, y, size, size);
      }
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT),
      new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.85, alphaTest: 0.08 }),
    );
    mesh.position.z = -4;
    mesh.renderOrder = -10;
    return mesh;
  }
  world.add(makeForestPaths());

  const southernLake = createLakeModel({ width: LAKE_WIDTH, height: LAKE_HEIGHT, seed: LAKE_SEED });
  southernLake.mesh.position.set(LAKE_X, LAKE_Y, -3);
  world.add(southernLake.mesh);

  const lakePier = createPierModel({ seed: PIER_SEED });
  lakePier.mesh.position.set(PIER_X, PIER_Y, -2);
  world.add(lakePier.mesh);

  const layout = createWorldLayout();
  const occluders: THREE.Sprite[] = [];
  const worldEntities: Array<{ id: string; kind: WorldModelKind; x: number; y: number }> = [];
  world.userData.entities = worldEntities;
  const lanterns: THREE.Sprite[] = [];
  let mailNotice: THREE.Sprite | undefined;

  function place(prop: WorldProp) {
    const model = createWorldModel(prop.kind, {
      scale: prop.scale,
      seed: prop.seed,
      variant: prop.variant,
    });
    model.position.set(prop.x, prop.y, 0);
    model.renderOrder = 10000 - Math.round(prop.y);
    model.userData.baseY = prop.y;
    world.add(model);
    worldEntities.push({ id: model.userData.id as string, kind: prop.kind, x: prop.x, y: prop.y });
    if (prop.kind === "pine" || prop.kind === "oak" || prop.kind === "willow" || prop.kind === "den") {
      (model.material as THREE.SpriteMaterial).alphaTest = 0.08;
      occluders.push(model);
    }
    if (prop.kind === "lamp") lanterns.push(model);
    if (prop.kind === "mailBubble") {
      model.position.z = 12;
      model.renderOrder = 30000;
      (model.material as THREE.SpriteMaterial).depthTest = false;
      mailNotice = model;
    }
    return model;
  }
  for (const prop of layout.props) place(prop);
  if (!mailNotice) throw new Error("Mailbox notice is missing from the world layout");
  const mailboxNotice: THREE.Sprite = mailNotice;

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
    world.add(flame);
    return flame;
  });

  const sim = createSim({
    players: [{ id: LOCAL_PLAYER_ID, x: DEFAULT_SPAWN.x, y: DEFAULT_SPAWN.y, seed: DEFAULT_CAT_SEED }],
    fish: layout.fish,
    mice: layout.mice,
    interactables: layout.interactables,
  });

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

  function syncPlayers(players: readonly PlayerSim[]) {
    const living = new Set(players.map((player) => player.id));
    for (const [id, view] of playerViews) {
      if (living.has(id)) continue;
      world.remove(view.sprite);
      playerViews.delete(id);
    }
    for (const player of players) paintPlayer(player);
  }

  type FishView = {
    sprite: THREE.Sprite;
    frames: [THREE.Texture, THREE.Texture];
    baseScaleX: number;
  };
  const fishViews = new Map<string, FishView>();

  function attachFish(fish: FishSim, scale: number, seed: number) {
    const sprite = createWorldModel(fish.kind, { scale, seed, variant: 0 });
    const map0 = (sprite.material as THREE.SpriteMaterial).map;
    const map1 = getWorldModelTexture(fish.kind, { seed, variant: 1 });
    if (!map0 || !map1) throw new Error(`Fish textures missing for ${fish.kind}`);
    const material = sprite.material as THREE.SpriteMaterial;
    material.opacity = 0.58;
    material.color.set("#9eb8b6");
    material.alphaTest = 0.08;
    sprite.center.set(0.5, 0.58);
    sprite.position.set(fish.x, fish.y, -2.4);
    sprite.renderOrder = -8;
    sprite.userData.id = fish.id;
    world.add(sprite);
    fishViews.set(fish.id, { sprite, frames: [map0, map1], baseScaleX: sprite.scale.x });
  }
  attachFish(sim.fish[0]!, 1.18, 801);
  attachFish(sim.fish[1]!, 1.14, 802);
  attachFish(sim.fish[2]!, 1.16, 803);

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

  const walkable = createWalkable(layout.trunks);
  const input = createKeyboardInput();
  const packRoot = document.querySelector<HTMLElement>(".pack-hud");
  if (!packRoot) throw new Error("Pack HUD is missing");
  const pack = createPackHud(packRoot);
  const questRoot = document.querySelector<HTMLElement>(".quest-hud");
  if (!questRoot) throw new Error("Quest HUD is missing");
  const quest = createQuestHud(questRoot);
  const mail = createMailHud(document.getElementById("game") ?? document.body);
  let viewWidth = 960;
  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    viewWidth = VIEW_HEIGHT * (width / height);
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = VIEW_HEIGHT / 2;
    camera.bottom = -VIEW_HEIGHT / 2;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  const clock = new THREE.Clock();
  let accumulator = 0;
  let raf = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    const frameDt = Math.min(clock.getDelta(), 0.05);
    accumulator += frameDt;
    accumulator = drainFixedTicks(accumulator, TICK_DT, MAX_TICKS_PER_FRAME, () => {
      const sample = input.sample();
      if (mail.consumeDismiss()) sample.interact = true;
      tickSim(sim, { [LOCAL_PLAYER_ID]: sample }, TICK_DT, walkable);
    });

    syncPlayers(sim.players);

    const catHalfW = CAT_SCALE * 20 * 0.3;
    for (const sprite of occluders) {
      const halfW = sprite.scale.x * 0.28;
      const intoTree = sprite.position.y + sprite.scale.y * 0.16;
      const underCanopy = sprite.position.y + sprite.scale.y * 0.82;
      const overlapping = sim.players.some((player) => (
        Math.abs(player.x - sprite.position.x) < halfW + catHalfW
        && player.y > intoTree
        && player.y < underCanopy
      ));
      const target = overlapping ? 0.38 : 1;
      const material = sprite.material as THREE.SpriteMaterial;
      material.opacity += (target - material.opacity) * Math.min(1, 8 * frameDt);
    }
    mailboxNotice.position.y = MAILBOX.y + 64 + Math.round(Math.sin(sim.elapsed * 4) * 2);
    lanternFlames.forEach((flame, index) => {
      const frame = Math.floor(sim.elapsed / 0.22 + index) % lanternFlameFrames.length;
      (flame.material as THREE.SpriteMaterial).map = lanternFlameFrames[frame]!;
    });
    updateLakeModel(southernLake, sim.elapsed);
    for (const fish of sim.fish) {
      const view = fishViews.get(fish.id);
      if (!view) continue;
      view.sprite.visible = fish.alive;
      if (!fish.alive) continue;
      view.sprite.position.x = Math.round(fish.x);
      view.sprite.position.y = Math.round(fish.y + Math.sin(sim.elapsed * 0.55 + fish.phase) * 0.5);
      view.sprite.scale.x = view.baseScaleX * fish.facing;
      view.sprite.renderOrder = -8;
      (view.sprite.material as THREE.SpriteMaterial).map = view.frames[fish.frame]!;
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

    const local = playerById(sim, LOCAL_PLAYER_ID) ?? sim.players[0];
    if (local) {
      pack.sync(local.inventory);
      quest.sync(local.progress.activeQuest);
      mail.sync(local);
      mailboxNotice.visible = !local.progress.mailboxRead;
      const cameraEdgeX = Math.max(0, MAP_WIDTH / 2 - viewWidth / 2);
      const cameraEdgeY = MAP_HEIGHT / 2 - VIEW_HEIGHT / 2;
      const cameraTargetX = THREE.MathUtils.clamp(local.x, -cameraEdgeX, cameraEdgeX);
      const cameraTargetY = THREE.MathUtils.clamp(local.y + 24, -cameraEdgeY, cameraEdgeY);
      const cameraFollow = 1 - Math.exp(-6 * frameDt);
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraTargetX, cameraFollow);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraTargetY, cameraFollow);
    }
    renderer.render(scene, camera);
  }
  animate();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      input.dispose();
      pack.dispose();
      quest.dispose();
      mail.dispose();
      window.removeEventListener("resize", resize);
    },
  };
}

const game = startGame();
if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
