import * as THREE from "three";
import "./styles.css";
import { createWorldModel, type WorldModelKind } from "./world-models";

const canvas = document.querySelector<HTMLCanvasElement>("#world");
if (!canvas) throw new Error("World canvas is missing");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x688f45);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-480, 480, 270, -270, 0.1, 2000);
camera.position.set(0, 0, 1000);

const VIEW_HEIGHT = 540;
const MAP_WIDTH = 2600;
const MAP_HEIGHT = 1800;
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

function pixelCanvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const surface = document.createElement("canvas");
  surface.width = width;
  surface.height = height;
  const context = surface.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");
  context.imageSmoothingEnabled = false;
  draw(context);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

function makePath(width: number, x: number, y: number, rotation = 0) {
  const map = pixelCanvas(128, 24, (ctx) => {
    ctx.fillStyle = "#d9c46e";
    ctx.fillRect(0, 3, 128, 19);
    ctx.fillStyle = "#eadb8e";
    ctx.fillRect(0, 5, 128, 4);
    ctx.fillStyle = "#b9a35b";
    for (let x = 2; x < 128; x += 9) ctx.fillRect(x, 17 + (x % 3), 5, 2);
    ctx.fillStyle = "#f2e49b";
    for (let x = 5; x < 128; x += 13) ctx.fillRect(x, 10 + (x % 5), 3, 2);
  });
  map.wrapS = THREE.RepeatWrapping;
  map.repeat.x = width / 180;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 58),
    new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.1 }),
  );
  mesh.position.set(x, y, -4);
  mesh.rotation.z = rotation;
  mesh.renderOrder = -10;
  return mesh;
}
world.add(makePath(MAP_WIDTH, 0, -188));
world.add(makePath(980, 655, -520, Math.PI / 2));

const steppingStoneMap = pixelCanvas(20, 70, (ctx) => {
  const stones = [[4, 1, 12, 9], [1, 17, 15, 10], [5, 34, 13, 9], [2, 50, 16, 11]];
  for (const [x = 0, y = 0, w = 0, h = 0] of stones) {
    ctx.fillStyle = "#acb18e";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#dfe0b6";
    ctx.fillRect(x + 2, y + 1, w - 4, 3);
    ctx.fillStyle = "#8c9575";
    ctx.fillRect(x + w - 3, y + 3, 2, h - 4);
  }
});
const steps = new THREE.Sprite(new THREE.SpriteMaterial({ map: steppingStoneMap, transparent: true }));
steps.center.set(0.5, 0);
steps.scale.set(38, 136, 1);
steps.position.set(0, -282, 0);
steps.renderOrder = -5;
world.add(steps);

function place(kind: WorldModelKind, x: number, y: number, scale = 1, seed = 1, variant = 0) {
  const model = createWorldModel(kind, { scale, seed, variant });
  model.position.set(x, y, 0);
  model.renderOrder = 10000 - Math.round(y);
  model.userData.baseY = y;
  world.add(model);
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
place("lamp", -230, -86, 1.12, 24);
place("lamp", 230, -86, 1.12, 25);

for (const x of [-112, 112]) {
  place("bush", x, -91, 1.12, 40 + x);
  place("bush", x, -126, 1.12, 41 + x);
  place("bush", x, -161, 1.12, 42 + x);
}

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

// Routes and landmarks beyond the starting clearing.
for (const [index, x] of [-1040, -720, 720, 1040].entries()) {
  place("lamp", x, -150, 1.05, 240 + index);
}
place("log", -860, 470, 1.32, 251);
place("log", 910, 390, 1.18, 252);
place("stone", -760, -570, 1.25, 253);
place("stone", 790, -640, 1.1, 254);

function seededSceneRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const sceneRandom = seededSceneRandom(1987);
let scattered = 0;
let scatterAttempts = 0;
while (scattered < 105 && scatterAttempts < 600) {
  scatterAttempts += 1;
  const x = (sceneRandom() - 0.5) * (MAP_WIDTH - 180);
  const y = (sceneRandom() - 0.5) * (MAP_HEIGHT - 180);
  const insideColony = Math.abs(x) < 610 && y > -340 && y < 330;
  const onMainPath = Math.abs(y + 188) < 76;
  const onSouthPath = Math.abs(x - 655) < 75 && y < 10;
  if (insideColony || onMainPath || onSouthPath) continue;

  const roll = sceneRandom();
  const seed = 500 + scattered;
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

const keys = new Set<string>();
const movementKeys = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (movementKeys.has(key)) event.preventDefault();
  keys.add(key);
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());

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
let elapsed = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  let dx = 0;
  let dy = 0;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;
  if (keys.has("w") || keys.has("arrowup")) dy += 1;
  if (keys.has("s") || keys.has("arrowdown")) dy -= 1;

  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    const mapEdgeX = MAP_WIDTH / 2 - 45;
    const mapEdgeY = MAP_HEIGHT / 2 - 45;
    cat.position.x = THREE.MathUtils.clamp(cat.position.x + (dx / length) * 118 * dt, -mapEdgeX, mapEdgeX);
    cat.position.y = THREE.MathUtils.clamp(cat.position.y + (dy / length) * 118 * dt, -mapEdgeY, mapEdgeY);
    cat.scale.x = Math.abs(cat.scale.x) * (dx < 0 ? -1 : 1);
    cat.position.z = Math.sin(elapsed * 16) * 1.5;
  } else {
    cat.position.z = Math.sin(elapsed * 3.2) * 0.7;
  }
  cat.renderOrder = 10000 - Math.round(cat.position.y);
  mailNotice.position.y = 116 + Math.round(Math.sin(elapsed * 4) * 2);

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
