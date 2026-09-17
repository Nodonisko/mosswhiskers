import * as THREE from "three";
import { createLakeModel, type LakeModel } from "./lake-model";
import { createPierModel } from "./pier-model";
import { createDriedPondModel, type DriedPondModel } from "./pond-model";
import { createIntakePipeModel, type IntakePipeModel } from "./pipe-model";
import { paintPixelTexture } from "./pixel-canvas";
import { seeded } from "./rng";
import { inDataCenterClearing, inFarmPlot, isBernieWoods } from "./world";
import {
  BERNIE_POND_HEIGHT,
  BERNIE_POND_SEED,
  BERNIE_POND_WIDTH,
  BERNIE_POND_X,
  BERNIE_POND_Y,
  BERNIE_WOODS,
  DATA_CENTER,
  FARM,
  FARM_PLOT,
  LAKE_HEIGHT,
  LAKE_SEED,
  LAKE_WIDTH,
  LAKE_X,
  LAKE_Y,
  MAP_HEIGHT,
  MAP_WIDTH,
  PIER_SEED,
  PIER_X,
  PIER_Y,
  berniePathPoints,
  dataCenterPathPoints,
  denPathX,
  farmPathPoints,
  mainPathY,
  southPathX,
} from "./world-config";

export type WorldBackdrop = {
  southernLake: LakeModel;
  berniePond: DriedPondModel;
  intakePipe: IntakePipeModel;
};

export function addWorldBackdrop(world: THREE.Group): WorldBackdrop {
  const textureLoader = new THREE.TextureLoader();
  const grass = textureLoader.load("/assets/meadow-texture.png");
  grass.colorSpace = THREE.SRGBColorSpace;
  grass.magFilter = THREE.NearestFilter;
  grass.minFilter = THREE.NearestMipmapLinearFilter;
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(MAP_WIDTH / 360, MAP_HEIGHT / 353);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT),
    new THREE.MeshBasicMaterial({ map: grass, color: 0xe5f0ca }),
  );
  ground.position.z = -20;
  ground.renderOrder = -100;
  world.add(ground);
  world.add(makeBernieFloor());
  world.add(makeDataCenterPad());
  world.add(makeFarmPad());
  world.add(makeForestPaths());

  const southernLake = createLakeModel({ width: LAKE_WIDTH, height: LAKE_HEIGHT, seed: LAKE_SEED });
  southernLake.mesh.position.set(LAKE_X, LAKE_Y, -3);
  world.add(southernLake.mesh);

  const lakePier = createPierModel({ seed: PIER_SEED });
  lakePier.mesh.position.set(PIER_X, PIER_Y, -2);
  world.add(lakePier.mesh);

  const berniePond = createDriedPondModel({
    width: BERNIE_POND_WIDTH,
    height: BERNIE_POND_HEIGHT,
    seed: BERNIE_POND_SEED,
  });
  berniePond.mesh.position.set(BERNIE_POND_X, BERNIE_POND_Y, -3);
  world.add(berniePond.mesh);

  const intakePipe = createIntakePipeModel();
  world.add(intakePipe.mesh);

  return { southernLake, berniePond, intakePipe };
}

function makeBernieFloor() {
  const west = -MAP_WIDTH / 2;
  const east = BERNIE_WOODS.east + 70;
  const south = BERNIE_WOODS.south - 70;
  const north = MAP_HEIGHT / 2;
  const width = east - west;
  const height = north - south;
  const textureWidth = Math.ceil(width / 4);
  const textureHeight = Math.ceil(height / 4);
  const map = paintPixelTexture(textureWidth, textureHeight, (ctx) => {
    const image = ctx.createImageData(textureWidth, textureHeight);
    const pixels = image.data;
    for (let y = 0; y < textureHeight; y++) {
      for (let x = 0; x < textureWidth; x++) {
        const worldX = west + (x + 0.5) / textureWidth * width;
        const worldY = north - (y + 0.5) / textureHeight * height;
        if (!isBernieWoods(worldX, worldY)) continue;
        const eastFade = Math.min(1, (BERNIE_WOODS.east - worldX) / 110);
        const southFade = Math.min(1, (worldY - BERNIE_WOODS.south) / 110);
        const alpha = Math.max(0, eastFade) * Math.max(0, southFade);
        if (alpha <= 0) continue;
        const index = (y * textureWidth + x) * 4;
        const dust = ((x * 13 + y * 7) % 5) / 5;
        pixels[index] = Math.round(176 + dust * 18);
        pixels[index + 1] = Math.round(168 + dust * 12);
        pixels[index + 2] = Math.round(122 + dust * 10);
        pixels[index + 3] = Math.round(168 * alpha);
      }
    }
    ctx.putImageData(image, 0, 0);
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.82, alphaTest: 0.04, depthWrite: false }),
  );
  mesh.position.set((west + east) / 2, (south + north) / 2, -19);
  mesh.renderOrder = -90;
  return mesh;
}

function makeDataCenterPad() {
  const west = DATA_CENTER.x - 360;
  const east = DATA_CENTER.x + 360;
  const south = DATA_CENTER.y - 220;
  const north = DATA_CENTER.y + 280;
  const width = east - west;
  const height = north - south;
  const textureWidth = Math.ceil(width / 4);
  const textureHeight = Math.ceil(height / 4);
  const map = paintPixelTexture(textureWidth, textureHeight, (ctx) => {
    const image = ctx.createImageData(textureWidth, textureHeight);
    const pixels = image.data;
    for (let y = 0; y < textureHeight; y++) {
      for (let x = 0; x < textureWidth; x++) {
        const worldX = west + (x + 0.5) / textureWidth * width;
        const worldY = north - (y + 0.5) / textureHeight * height;
        if (!inDataCenterClearing(worldX, worldY)) continue;
        const index = (y * textureWidth + x) * 4;
        const dust = ((x * 11 + y * 17) % 5) / 5;
        pixels[index] = Math.round(118 + dust * 22);
        pixels[index + 1] = Math.round(116 + dust * 16);
        pixels[index + 2] = Math.round(104 + dust * 12);
        pixels[index + 3] = 176;
      }
    }
    ctx.putImageData(image, 0, 0);
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.88, alphaTest: 0.04, depthWrite: false }),
  );
  mesh.position.set((west + east) / 2, (south + north) / 2, -19);
  mesh.renderOrder = -90;
  return mesh;
}

function makeFarmPad() {
  const west = FARM.x - FARM_PLOT.halfW - 16;
  const east = FARM.x + FARM_PLOT.halfW + 16;
  const south = FARM.y - FARM_PLOT.halfH - 16;
  const north = FARM.y + FARM_PLOT.halfH + 16;
  const width = east - west;
  const height = north - south;
  const textureWidth = Math.ceil(width / 4);
  const textureHeight = Math.ceil(height / 4);
  const map = paintPixelTexture(textureWidth, textureHeight, (ctx) => {
    const image = ctx.createImageData(textureWidth, textureHeight);
    const pixels = image.data;
    for (let y = 0; y < textureHeight; y++) {
      for (let x = 0; x < textureWidth; x++) {
        const worldX = west + (x + 0.5) / textureWidth * width;
        const worldY = north - (y + 0.5) / textureHeight * height;
        if (!inFarmPlot(worldX, worldY)) continue;
        const index = (y * textureWidth + x) * 4;
        const dust = ((x * 9 + y * 13) % 5) / 5;
        const furrow = Math.sin((worldX - FARM.x) / 16) > 0.15;
        pixels[index] = Math.round((furrow ? 96 : 118) + dust * 18);
        pixels[index + 1] = Math.round((furrow ? 68 : 86) + dust * 14);
        pixels[index + 2] = Math.round((furrow ? 42 : 54) + dust * 10);
        pixels[index + 3] = 210;
      }
    }
    ctx.putImageData(image, 0, 0);
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.92, alphaTest: 0.04, depthWrite: false }),
  );
  mesh.position.set((west + east) / 2, (south + north) / 2, -19);
  mesh.renderOrder = -90;
  return mesh;
}

function makeForestPaths() {
  const textureWidth = MAP_WIDTH / 4;
  const textureHeight = MAP_HEIGHT / 4;
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

    routes.push(berniePathPoints());
    routes.push(dataCenterPathPoints());
    routes.push(farmPathPoints());

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
