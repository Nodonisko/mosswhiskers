import * as THREE from "three";
import "./styles.css";
import { createKeyboardInput } from "./input";
import { createLakeModel, updateLakeModel } from "./lake-model";
import { paintPixelTexture } from "./pixel-canvas";
import { createPierModel } from "./pier-model";
import { seeded } from "./rng";
import { createSim, hitsSolid, tickSim, type FishSim, type MouseSim, type MouseSpec, type Solid } from "./sim";
import {
  CAT_COLLISION,
  CLAW_DURATION,
  LAKE_HEIGHT,
  LAKE_WIDTH,
  LAKE_X,
  LAKE_Y,
  MAP_HEIGHT,
  MAP_WIDTH,
  PIER_X,
  PIER_Y,
  VIEW_HEIGHT,
  denPathX,
  mainPathY,
  southPathX,
} from "./world-config";
import { createWorldModel, getWorldModelTexture, TREE_TRUNK_HITBOX, type WorldModelKind } from "./world-models";

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

  const southernLake = createLakeModel({ width: LAKE_WIDTH, height: LAKE_HEIGHT, seed: 8417 });
  southernLake.mesh.position.set(LAKE_X, LAKE_Y, -3);
  world.add(southernLake.mesh);

  const lakePier = createPierModel({ seed: 719 });
  lakePier.mesh.position.set(PIER_X, PIER_Y, -2);
  world.add(lakePier.mesh);

  const occluders: THREE.Sprite[] = [];
  const trunks: Solid[] = [];
  const worldEntities: Array<{ id: string; kind: WorldModelKind; x: number; y: number }> = [];
  world.userData.entities = worldEntities;

  function place(kind: WorldModelKind, x: number, y: number, scale = 1, seed = 1, variant = 0) {
    const model = createWorldModel(kind, { scale, seed, variant });
    model.position.set(x, y, 0);
    model.renderOrder = 10000 - Math.round(y);
    model.userData.baseY = y;
    world.add(model);
    if (kind !== "cat") worldEntities.push({ id: model.userData.id as string, kind, x, y });
    const trunk = TREE_TRUNK_HITBOX[kind];
    if (trunk) trunks.push({ x, y, halfW: trunk[0] * scale, halfH: trunk[1] * scale });
    if (kind === "pine" || kind === "oak" || kind === "willow" || kind === "den") {
      (model.material as THREE.SpriteMaterial).alphaTest = 0.08;
      occluders.push(model);
    }
    return model;
  }

  // Deep background canopy.
  for (let i = 0; i < 11; i++) {
    place(i % 3 === 0 ? "pine" : "oak", -540 + i * 108, 170 + (i % 3) * 34, 1.2 + (i % 2) * 0.12, 70 + i, i);
  }

  // Side framing and the colony clearing.
  place("pine", -455, 112, 1.18, 13, 1);
  place("oak", -404, 8, 1.12, 14, 2);
  place("oak", 455, 115, 1.24, 15, 3);
  place("pine", 415, -20, 1.1, 16, 4);
  place("den", 0, 46, 1.12, 22);
  place("mailbox", 153, 52, 1.28, 23);
  const mailNotice = place("mailBubble", 153, 116, 0.92, 26);
  mailNotice.position.z = 12;
  mailNotice.renderOrder = 30000;
  (mailNotice.material as THREE.SpriteMaterial).depthTest = false;
  const lanterns = [
    place("lamp", -230, -86, 1.12, 24),
    place("lamp", 230, -86, 1.12, 25),
  ];

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

  [-165, -136, -107, -78, -49, -22, 4].forEach((y, index) => {
    const pathX = denPathX(y);
    const offset = 54 + (index % 2) * 8;
    place("bush", pathX - offset, y, 1.08 + (index % 3) * 0.05, 40 + index);
    place("bush", pathX + offset, y + (index % 2 === 0 ? 5 : -4), 1.1 + ((index + 1) % 3) * 0.05, 50 + index);
  });

  place("log", -420, -112, 1.12, 31);
  place("stone", 330, -140, 0.9, 32);
  place("stone", -340, 118, 0.75, 33);
  place("bush", -382, -32, 1.2, 36);
  place("bush", 385, 10, 1.18, 37);
  place("pine", -500, -164, 1.08, 38, 1);
  place("oak", 510, -185, 1.14, 39, 2);

  const flowerGroups: Array<[number, number, number, number]> = [
    [-342, 137, 1.1, 0], [-450, 90, 1.05, 1],
    [400, 79, 1.06, 2], [380, -228, 1.1, 0],
    [-318, -210, .95, 1], [321, -114, .92, 2],
    [-444, -14, .92, 0], [435, 190, .88, 1],
  ];
  flowerGroups.forEach(([x, y, scale, variant], index) => place("flowers", x, y, scale, 100 + index, variant));

  // Landmarks beyond the starting clearing.
  place("log", -860, 470, 1.32, 251);
  place("log", 910, 390, 1.18, 252);
  place("stone", -970, -570, 1.25, 253);
  place("stone", 790, -640, 1.1, 254);

  // A few willows frame the banks, with room to walk between their trunks.
  const lakeWillows: Array<[number, number, number]> = [
    [LAKE_X - 325, LAKE_Y + 145, 1.12],
    [LAKE_X + 378, LAKE_Y - 34, 1.05],
    [LAKE_X - 205, LAKE_Y - 192, 0.98],
  ];
  lakeWillows.forEach(([x, y, scale], index) => place("willow", x, y, scale, 280 + index, index));

  const isForestFloor = (x: number, y: number) => {
    const insideColony = Math.abs(x) < 610 && y > -340 && y < 330;
    const insideLake = southernLake.containsPoint(x - LAKE_X, y - LAKE_Y, 46);
    const nearWillow = lakeWillows.some(([willowX, willowY]) => Math.hypot(x - willowX, y - willowY) < 92);
    const onMainPath = Math.abs(y - mainPathY(x)) < 56;
    const onSouthPath = Math.abs(x - southPathX(y)) < 56 && y < mainPathY(655) + 30;
    return !insideColony && !insideLake && !nearWillow && !onMainPath && !onSouthPath;
  };

  const sceneRandom = seeded(1987);
  let scattered = 0;
  let scatterAttempts = 0;
  while (scattered < 105 && scatterAttempts < 600) {
    scatterAttempts += 1;
    const x = (sceneRandom() - 0.5) * (MAP_WIDTH - 180);
    const y = (sceneRandom() - 0.5) * (MAP_HEIGHT - 180);
    if (!isForestFloor(x, y)) continue;

    const roll = sceneRandom();
    const seed = 500 + (scattered % 8);
    if (roll < 0.44) {
      place(sceneRandom() < 0.43 ? "pine" : "oak", x, y, 0.9 + sceneRandom() * 0.42, seed, scattered % 5);
    } else if (roll < 0.64) {
      place("bush", x, y, 0.82 + sceneRandom() * 0.46, seed);
    } else if (roll < 0.84) {
      place("flowers", x, y, 0.72 + sceneRandom() * 0.45, seed, scattered % 3);
    } else if (roll < 0.94) {
      place("stone", x, y, 0.72 + sceneRandom() * 0.62, seed);
    } else {
      place("log", x, y, 0.76 + sceneRandom() * 0.42, seed);
    }
    scattered += 1;
  }

  const cat = place("cat", 0, -5, 2.05, 5, 0);
  cat.renderOrder = 10005;
  const catScaleX = Math.abs(cat.scale.x);
  const catViews = {
    e: [0, 1, 2, 3, 4, 5, 6, 7].map((variant) => getWorldModelTexture("cat", { seed: 5, variant, facing: "e" })),
    w: [0, 1, 2, 3, 4, 5, 6, 7].map((variant) => getWorldModelTexture("cat", { seed: 5, variant, facing: "w" })),
    n: [0, 1, 2, 3, 4, 5, 6, 7].map((variant) => getWorldModelTexture("cat", { seed: 5, variant, facing: "n" })),
    s: [0, 1, 2, 3, 4, 5, 6, 7].map((variant) => getWorldModelTexture("cat", { seed: 5, variant, facing: "s" })),
  } as const;
  const catClawHit = {
    e: [5, 6, 7].map((variant) => getWorldModelTexture("cat", { seed: 5, variant, facing: "e", hit: true })),
    w: [5, 6, 7].map((variant) => getWorldModelTexture("cat", { seed: 5, variant, facing: "w", hit: true })),
    n: [5, 6, 7].map((variant) => getWorldModelTexture("cat", { seed: 5, variant, facing: "n", hit: true })),
    s: [5, 6, 7].map((variant) => getWorldModelTexture("cat", { seed: 5, variant, facing: "s", hit: true })),
  } as const;
  (cat.material as THREE.SpriteMaterial).map = catViews.s[0]!;
  let catWalkTime = 0;

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

  const mouseRandom = seeded(4412);
  const mouseSpecs: MouseSpec[] = [];
  let mouseAttempts = 0;
  while (mouseSpecs.length < 12 && mouseAttempts < 500) {
    mouseAttempts += 1;
    const x = (mouseRandom() - 0.5) * (MAP_WIDTH - 220);
    const y = (mouseRandom() - 0.5) * (MAP_HEIGHT - 220);
    if (!isForestFloor(x, y)) continue;
    if (mouseSpecs.some((spec) => Math.hypot(spec.originX - x, spec.originY - y) < 140)) continue;
    mouseSpecs.push({
      id: `mouse-${mouseSpecs.length}`,
      originX: x,
      originY: y,
      radiusX: 36 + mouseRandom() * 28,
      radiusY: 10 + mouseRandom() * 8,
      speed: 1.1 + mouseRandom() * 0.7,
      phase: mouseRandom() * Math.PI * 2,
      step: 0.1 + mouseRandom() * 0.05,
    });
  }

  const sim = createSim({
    cat: { x: 0, y: -5 },
    fish: [
      { id: "fish-pike", kind: "pike", originX: LAKE_X - 20, originY: LAKE_Y - 30, radiusX: 210, radiusY: 85, speed: 0.12, phase: 0.4, tailStep: 0.85 },
      { id: "fish-perch", kind: "perch", originX: LAKE_X + 90, originY: LAKE_Y + 10, radiusX: 155, radiusY: 70, speed: 0.16, phase: 1.8, tailStep: 0.7 },
      { id: "fish-bluegill", kind: "bluegill", originX: LAKE_X + 130, originY: LAKE_Y - 70, radiusX: 120, radiusY: 55, speed: 0.19, phase: 3.1, tailStep: 0.55 },
    ],
    mice: mouseSpecs,
  });
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

  const walkable = (x: number, y: number) => {
    if (hitsSolid(x, y, trunks, CAT_COLLISION.halfW, CAT_COLLISION.halfH)) return false;
    const overWater = southernLake.containsPoint(x - LAKE_X, y - LAKE_Y, -10);
    const onPier = lakePier.containsPoint(x - PIER_X, y - PIER_Y, 5);
    return !overWater || onPier;
  };

  const input = createKeyboardInput();
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
  let raf = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    tickSim(sim, input.sample(), dt, walkable);

    cat.position.x = sim.cat.x;
    cat.position.y = sim.cat.y;
    cat.scale.x = catScaleX;
    if (sim.cat.moving) catWalkTime += dt;
    else catWalkTime = 0;
    let catFrame = 0;
    const catMaterial = cat.material as THREE.SpriteMaterial;
    if (sim.cat.clawing) {
      const swing = sim.cat.clawElapsed / CLAW_DURATION;
      catFrame = swing < 0.28 ? 5 : swing < 0.64 ? 6 : 7;
      catMaterial.map = sim.cat.clawHit
        ? catClawHit[sim.cat.facing][catFrame - 5]!
        : catViews[sim.cat.facing][catFrame]!;
    } else if (sim.cat.moving) {
      catFrame = 1 + (Math.floor(catWalkTime / 0.1) % 4);
      catMaterial.map = catViews[sim.cat.facing][catFrame]!;
    } else {
      catMaterial.map = catViews[sim.cat.facing][0]!;
    }
    cat.position.z = sim.cat.clawing
      ? 1.2
      : sim.cat.moving
        ? Math.sin(catWalkTime * 22) * 0.6
        : Math.sin(sim.elapsed * 3.2) * 0.7;
    cat.renderOrder = 10000 - Math.round(cat.position.y);

    const catHalfW = catScaleX * (20 / 36) * 0.3;
    for (const sprite of occluders) {
      const halfW = sprite.scale.x * 0.28;
      const intoTree = sprite.position.y + sprite.scale.y * 0.16;
      const underCanopy = sprite.position.y + sprite.scale.y * 0.82;
      const overlapping = Math.abs(cat.position.x - sprite.position.x) < halfW + catHalfW
        && cat.position.y > intoTree
        && cat.position.y < underCanopy;
      const target = overlapping ? 0.38 : 1;
      const material = sprite.material as THREE.SpriteMaterial;
      material.opacity += (target - material.opacity) * Math.min(1, 8 * dt);
    }
    mailNotice.position.y = 116 + Math.round(Math.sin(sim.elapsed * 4) * 2);
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

    const cameraEdgeX = Math.max(0, MAP_WIDTH / 2 - viewWidth / 2);
    const cameraEdgeY = MAP_HEIGHT / 2 - VIEW_HEIGHT / 2;
    const cameraTargetX = THREE.MathUtils.clamp(cat.position.x, -cameraEdgeX, cameraEdgeX);
    const cameraTargetY = THREE.MathUtils.clamp(cat.position.y + 24, -cameraEdgeY, cameraEdgeY);
    const cameraFollow = 1 - Math.exp(-6 * dt);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraTargetX, cameraFollow);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraTargetY, cameraFollow);
    renderer.render(scene, camera);
  }
  animate();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      input.dispose();
      window.removeEventListener("resize", resize);
    },
  };
}

const game = startGame();
if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
