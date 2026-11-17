// The tree's growth stage on the 3D ESG Tree, as on the 2D tree: 0 (bare trunk) to 4 (full canopy). It is
// the same setting as the 2D tree's (treeParameters.treeStage, set in the admin's Tree Growth Stage, by
// hand or from the leaf count), so both trees always show the same stage. Each stage is its own Ketapang
// model in /assets/Tree/3dTreeLeaves (Ketapang_Stage_0.glb to Ketapang_Stage_4.glb); stage 4 is the full
// tree the scene was built around. scene.js loads the stage's model; when the stage changes (in Auto as the
// leaves come in, or saved in the admin) it loads the new stage's model in the background (loadStageTree)
// and the tree grows into it in place, without reloading the page, within about 5 seconds. In Auto the tree
// also grows a little with every leaf between the stages (tree-growth.js).
import { THREE as T, GLTFLoader, MeshoptDecoder } from './vendor/three-runtime.js';
import { isGrown } from './tree-growth.js';

export const FULL_STAGE = 4;
export const STAGE_NAMES = ['Bare Trunk', 'Early Growth', 'Young Canopy', 'Mature Canopy', 'Full Canopy'];

// Stages 0 to 3 were exported much smaller than the full stage 4 tree. At this scale they grow towards
// it: stage 3's canopy is as wide as stage 4's, and the tree is taller at every stage (about 8.6, 9.3,
// 10.2 and 10.4 metres, then 13.3 at stage 4).
const YOUNG_STAGE_SCALE = 6.2;

export const normaliseStage = value => Math.max(0, Math.min(FULL_STAGE, Math.round(Number(value) || 0)));
export const stageModelUrl = stage => `/assets/Tree/3dTreeLeaves/Ketapang_Stage_${normaliseStage(stage)}.glb`;

// How far the tree has grown through its stage (0 to 1) in the admin's Auto growth stage, as the server
// reports it (backend/features/parameters/treeStage.js); null in Manual, where the stage's tree shows full.
export function growthProgress(treeParameters) {
  const progress = Number(treeParameters?.treeStageAuto?.progress);
  return treeParameters?.treeStageMode === 'auto' && treeParameters?.treeStageAuto && Number.isFinite(progress)
    ? Math.max(0, Math.min(1, progress)) : null;
}

// The stage to show: ?stage=0 to 4 in the page address fixes one (to try a stage out; with ?growth=0 to 1
// part grown); otherwise the saved stage, the same as the 2D tree's, and in Auto how far it has grown
// through it. If the settings cannot be read, the full tree.
export async function startingStage() {
  const address = new URLSearchParams(location.search);
  const fromAddress = address.get('stage');
  if (fromAddress !== null && /^[0-4]$/.test(fromAddress)) {
    const growth = address.get('growth');
    const progress = growth !== null && growth.trim() !== '' && Number.isFinite(Number(growth)) ? Number(growth) : null;
    return { stage: Number(fromAddress), fixed: true, growth: progress };
  }
  try {
    const response = await fetch('/api/parameters', { cache: 'no-store' });
    const data = await response.json();
    if (response.ok && data.success) {
      const tree = data.parameters?.treeParameters;
      return { stage: normaliseStage(tree?.treeStage), fixed: false, growth: growthProgress(tree) };
    }
  } catch (error) {
    console.warn('The tree growth stage could not be read; showing the full tree.', error);
  }
  return { stage: FULL_STAGE, fixed: false, growth: null };
}

// Loads another stage's model while the page runs (the tree growing into its next stage, scene.js), with its
// exported names and reflection layers, as loadEnvironment does for the first one (landscape.js).
let decodingInWorkers = false;
export async function loadStageTree(stage) {
  // Unpacks the model off the page's main thread, so the scene keeps moving while it loads.
  if (!decodingInWorkers) {
    try { MeshoptDecoder.useWorkers(2); } catch (error) { console.warn('The model is unpacked on the page instead.', error); }
    decodingInWorkers = true;
  }
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const asset = await loader.loadAsync(stageModelUrl(stage));
  asset.scene.traverse(node => {
    if (node.userData.displayName) node.name = node.userData.displayName;
    if (node.userData.reflected) node.layers.enable(1);
  });
  return asset.scene;
}

// Takes a tree out of the scene and frees its geometry, materials and pictures (the stage before, once the
// tree has grown into the next).
export function removeTree(tree) {
  tree.removeFromParent();
  const textures = new Set();
  tree.traverse(object => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    for (const material of [object.material].flat()) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
  });
  textures.forEach(texture => texture.dispose());
}

// Readies a young stage's model for the scene: scaled up to the scene's size in the geometry itself, so the
// wind in its leaves and the feedback leaves work in metres as on stage 4, and its own patch of soil left
// out (the island has its own ground, as under the stage 4 tree).
export function prepareStageTree(tree, stage) {
  if (stage >= FULL_STAGE) return tree;
  const scaled = new Set();
  const soil = [];
  tree.traverse(object => {
    if (object !== tree) object.position.multiplyScalar(YOUNG_STAGE_SCALE);
    if (!object.isMesh) return;
    const materials = [object.material].flat();
    if (/loam and sand/i.test(object.name) || materials.some(material => /soil/i.test(material?.name || ''))) {
      soil.push(object);
      return;
    }
    if (scaled.has(object.geometry)) return;
    scaled.add(object.geometry);
    object.geometry.scale(YOUNG_STAGE_SCALE, YOUNG_STAGE_SCALE, YOUNG_STAGE_SCALE);
  });
  soil.forEach(object => object.removeFromParent());
  return tree;
}

// Points sampled from the tree's wood (bark and branches) or its leaves (those it is growing to,
// tree-growth.js), in the tree's own coordinates (relative to the soil, as the birds' perches) or in the
// world (as the falling leaves' routes).
function treePoints(tree, leaves, inWorld, wanted = 20000) {
  tree.updateMatrixWorld(true);
  const toTree = new T.Matrix4().copy(tree.matrixWorld).invert();
  const shown = tree.userData.foliageTarget ?? tree.userData.foliageShown ?? 1;
  const points = [];
  tree.traverse(object => {
    if (!object.isMesh) return;
    const isLeaves = [object.material].flat().some(material => material?.alphaTest > 0);
    if (isLeaves !== leaves) return;
    const position = object.geometry.attributes.position;
    const normal = object.geometry.attributes.normal;
    const matrix = inWorld ? object.matrixWorld : new T.Matrix4().multiplyMatrices(toTree, object.matrixWorld);
    const step = Math.max(1, Math.floor(position.count / wanted));
    for (let i = 0; i < position.count; i += step) {
      if (leaves && !isGrown(object.geometry, i, shown)) continue;
      if (!leaves && normal && normal.getY(i) < 0.6) continue; // the top of a branch, where a bird can sit
      points.push(new T.Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix));
    }
  });
  return points;
}

function nearest(points, target, accept = () => true) {
  let best = null, bestDistance = Infinity;
  for (const point of points) {
    if (!accept(point)) continue;
    const distance = point.distanceToSquared(target);
    if (distance < bestDistance) { best = point; bestDistance = distance; }
  }
  return best;
}

// The birds' perches on this stage's branches: each of stage 4's perches moved to the nearest top of a
// branch of this tree, above head height and below the crown (tree coordinates, as createBirds takes them).
export function perchSeats(tree, seats, stage) {
  if (stage >= FULL_STAGE) return seats;
  const wood = treePoints(tree, false, false);
  if (!wood.length) return seats;
  const top = Math.max(...wood.map(point => point.y));
  const target = new T.Vector3();
  return seats.map(([x, y, z]) => {
    const seat = nearest(wood, target.set(x, y, z), point => point.y > 2.5 && point.y < top * 0.92);
    return seat ? [seat.x, seat.y, seat.z] : [x, y, z];
  });
}

// The wind's falling leaves from this stage's canopy: each route (leaf-drifts.json, made for stage 4)
// starts at the nearest leaf of this tree instead. A bare trunk (stage 0) has no leaves to drop.
export function canopyDriftRoutes(tree, routes, stage) {
  if (stage >= FULL_STAGE) return routes;
  if (stage <= 0) return [];
  const leaves = treePoints(tree, true, true, 12000);
  if (!leaves.length) return [];
  const target = new T.Vector3();
  return routes.map(route => {
    const start = nearest(leaves, target.set(...route.start));
    return start ? { ...route, start: [start.x, start.y, start.z] } : route;
  });
}
