// The glowing look of the 3D ESG Tree, as in the ESG Centre's glowing-tree concept: the river valley at
// night, with the tree lit from within.
//   - the scene is held at night (after the weather's own update every frame, so live weather, rain and the
//     admin's sky settings never brighten it), in a cool moonlight;
//   - everything glows in the three ESG colours, green (Environmental), blue (Social) and orange
//     (Governance):
//   - streams of green, blue and orange light run up the trunk and out along the branches, with pulses of
//     light travelling up them;
//   - the tree's own leaves glow, each leaf in its own vivid colour, green, blue or orange, lit from within
//     with a bright edge and glowing veins, and now and then one twinkles;
//   - rings of light lie on the ground round the base of the tree, a pulse of light spreading out across them;
//   - specks of light float and twinkle round the canopy;
//   - their light spills round them in a soft glow (a bloom, createBloom).
// The feedback leaves glow green, blue or orange by their visitor's badge, a VIP's gold with a star of light at
// its tip (feedback-leaves.js). The admin turns the look on or off in
// 3D Tree Settings ("Glowing look", tree3dParameters.glowLook, on by default); ?look=natural or ?look=glow in
// the page address fixes one (to try it out).
import { THREE as T } from './vendor/three-runtime.js';
import { sprigsOf } from './tree-growth.js';

const BARK_DIM = 0.4;            // how much of the bark's own colour shows under its light streams
const SPARKLES = 380;            // specks of light round the canopy

// Whether to show the glowing look: from the page address if it names one (fixed), otherwise the admin's
// setting; the glowing look if the settings cannot be read.
export async function startingLook() {
  const fromAddress = new URLSearchParams(location.search).get('look');
  if (fromAddress === 'natural' || fromAddress === 'glow') return { glow: fromAddress === 'glow', fixed: true };
  try {
    const response = await fetch('/api/parameters', { cache: 'no-store' });
    const data = await response.json();
    if (response.ok && data.success) return { glow: data.parameters?.tree3dParameters?.glowLook !== false, fixed: false };
  } catch (error) {
    console.warn('The 3D look setting could not be read; showing the glowing look.', error);
  }
  return { glow: true, fixed: false };
}

const GLOW_COMMON = /* glsl */`
uniform float glowTime;
uniform vec3 glowCentre;
varying vec3 vGlowPos;
float glowHash( vec3 p ) { return fract( sin( dot( p, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ); }
`;

// Streams of light winding up the trunk and out along the branches, in the three ESG colours: thin lines at
// fixed angles round the trunk (so they run up it, and out along branches, which spread from it), orange,
// blue and green, with pulses travelling along them.
const BARK_GLOW = /* glsl */`
  vec3 fromTrunk = vGlowPos - glowCentre;
  float around = atan( fromTrunk.z, fromTrunk.x );
  float along = fromTrunk.y + length( fromTrunk.xz ) * .8;
  float wind = around * 7. + sin( fromTrunk.y * .55 + around * 2. ) * 1.1;
  float orangeLine = pow( max( 0., sin( wind ) ), 34. );
  float blueLine = pow( max( 0., sin( wind * .5 + 1.9 ) ), 52. );
  float greenLine = pow( max( 0., sin( wind * .5 + .25 ) ), 52. );
  float orangePulse = pow( fract( along * .085 - glowTime * .2 + around * .16 ), 5. );
  float bluePulse = pow( fract( along * .07 - glowTime * .27 + .5 - around * .11 ), 5. );
  float greenPulse = pow( fract( along * .078 - glowTime * .23 + .25 + around * .13 ), 5. );
  vec3 streams = vec3( 1., .5, .1 ) * orangeLine * ( .45 + 2.4 * orangePulse )
    + vec3( .2, .6, 1. ) * blueLine * ( .4 + 2.2 * bluePulse )
    + vec3( .25, 1., .35 ) * greenLine * ( .4 + 2.2 * greenPulse );
  diffuseColor.rgb = diffuseColor.rgb * ${BARK_DIM.toFixed(2)} + streams * 1.5;
`;

// The tree's own leaves, glowing: each leaf in its own vivid colour, green, blue or orange (LEAF_SHARES of
// the leaves green and blue, the rest orange), chosen by the leaf's own random number (leafPick, pickLeaves),
// lit from within: glowing through, brighter towards its edge, its veins glowing, and now and then one
// twinkles. The bloom (createBloom) spreads their light round them.
const LEAF_SHARES = [0.45, 0.3];
const LEAF_GLOW = /* glsl */`
#ifdef USE_MAP
  vec3 hue = vLeafPick < ${LEAF_SHARES[0].toFixed(2)} ? vec3( .08, 1., .16 )
    : vLeafPick < ${(LEAF_SHARES[0] + LEAF_SHARES[1]).toFixed(2)} ? vec3( .04, .36, 1. ) : vec3( 1., .42, .04 );
  const vec3 leafLuma = vec3( .3, .59, .11 );
  float shade = dot( diffuseColor.rgb, leafLuma );
  float edge = 1. - texture2D( map, vMapUv, 2. ).a;
  float veinPoint = dot( texture2D( map, vMapUv, -.5 ).rgb, leafLuma );
  float veinAround = dot( texture2D( map, vMapUv, 2.5 ).rgb, leafLuma );
  float vein = smoothstep( .03, .14, ( veinPoint - veinAround ) / max( veinAround, .05 ) );
  float twinkle = step( .965, fract( vLeafPick * 173.1 ) ) * pow( max( 0., sin( glowTime * 1.7 + vLeafPick * 60. ) ), 24. );
  diffuseColor.rgb = hue * ( .18 + .75 * shade + .9 * edge ) + mix( hue, vec3( 1. ), .4 ) * ( .45 * vein + 1.5 * twinkle );
#endif
`;

// Every leaf's own random number from 0 to 1 (leafPick, the same at all of a leaf's corners: a leaf is one
// connected piece of the foliage, tree-growth.js sprigsOf), for its colour and its twinkle.
function pickLeaves(geometry) {
  if (!geometry?.attributes.position || geometry.attributes.leafPick) return;
  const { sprig, sprigs } = sprigsOf(geometry);
  const random = new Float32Array(sprigs);
  for (let s = 0; s < sprigs; s++) {
    const x = Math.sin((s + 1) * 12.9898 + 78.233) * 43758.5453;
    random[s] = x - Math.floor(x);
  }
  const pick = new Float32Array(sprig.length);
  for (let i = 0; i < sprig.length; i++) pick[i] = random[sprig[i]];
  geometry.setAttribute('leafPick', new T.BufferAttribute(pick, 1));
}

function glowMaterial(material, uniforms, done) {
  if (!material || done.has(material)) return;
  done.add(material);
  const leaf = material.alphaTest > 0;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer); // the leaves' wind (matte-tree.js)
    Object.assign(shader.uniforms, uniforms);
    // Where on the tree, as at its full size (glowUnscale), so its colours hold still while it grows; and a
    // leaf's own random number (leafPick, pickLeaves).
    shader.vertexShader = `uniform vec3 glowCentre;\nuniform float glowUnscale;\nvarying vec3 vGlowPos;\n${leaf ? 'attribute float leafPick;\nvarying float vLeafPick;\n' : ''}`
      + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n'
        + '  vGlowPos = glowCentre + ( ( modelMatrix * vec4( transformed, 1. ) ).xyz - glowCentre ) * glowUnscale;'
        + (leaf ? '\n  vLeafPick = leafPick;' : ''));
    shader.fragmentShader = GLOW_COMMON + (leaf ? 'varying float vLeafPick;\n' : '') + shader.fragmentShader.replace('#include <map_fragment>',
      `#include <map_fragment>\n${leaf ? LEAF_GLOW : BARK_GLOW}`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${key ? key() : ''}|glow-${leaf ? 'leaf' : 'bark'}`;
  material.needsUpdate = true;
}

// Rings of light on the ground round the tree, with a pulse spreading out across them.
function platform(clock, centre, radius) {
  const material = new T.ShaderMaterial({
    name: 'Glowing rings round the tree',
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { glowTime: clock.time },
    vertexShader: /* glsl */`
      varying vec2 ringUv;
      void main() { ringUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1. ); }`,
    fragmentShader: /* glsl */`
      uniform float glowTime;
      varying vec2 ringUv;
      float ring( float r, float at, float width ) { return exp( -pow( ( r - at ) / width, 2. ) ); }
      void main() {
        vec2 p = ringUv * 2. - 1.;
        float r = length( p );
        float a = atan( p.y, p.x ) / 6.2832 + .5;
        float dashes = step( .55, fract( a * 36. + glowTime * .04 ) ) * ring( r, .86, .007 );
        float pulse = ring( r, fract( glowTime * .16 ) * .98, .025 ) * ( 1. - r );
        // The three ESG colours: a blue ring, an orange ring and an outer green ring with its dashes.
        vec3 blue = vec3( .25, .65, 1. ), orange = vec3( 1., .52, .14 ), green = vec3( .3, 1., .4 );
        vec3 light = blue * ( 1.3 * ring( r, .64, .01 ) + .9 * pulse )
          + orange * ( 1.2 * ring( r, .78, .008 ) + .35 * ring( r, .5, .006 ) )
          + green * ( .95 * ring( r, .97, .009 ) + .8 * dashes )
          + vec3( .18, .42, .85 ) * .16 * smoothstep( 1., .25, r );
        gl_FragColor = vec4( light * smoothstep( 1., .985, r ), 1. );
      }`,
  });
  const mesh = new T.Mesh(new T.CircleGeometry(radius, 160), material);
  mesh.name = 'Glowing rings round the tree';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(centre.x, centre.y + 0.06, centre.z);
  mesh.renderOrder = 1;
  return mesh;
}

// Specks of light round the canopy, each twinkling at its own pace and drifting gently.
function sparkles(clock, box, renderer) {
  const random = (() => { let seed = 92821; return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); })();
  const size = box.getSize(new T.Vector3());
  const positions = new Float32Array(SPARKLES * 3);
  const phases = new Float32Array(SPARKLES);
  for (let i = 0; i < SPARKLES; i++) {
    positions[i * 3] = box.min.x + random() * size.x;
    positions[i * 3 + 1] = box.min.y + random() * size.y * 1.08;
    positions[i * 3 + 2] = box.min.z + random() * size.z;
    phases[i] = random();
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setAttribute('phase', new T.BufferAttribute(phases, 1));
  const material = new T.ShaderMaterial({
    name: 'Specks of light',
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { glowTime: clock.time, pixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */`
      uniform float glowTime, pixelRatio;
      attribute float phase;
      varying float twinkle;
      varying vec3 speckColour;
      void main() {
        vec3 p = position;
        p.y += sin( glowTime * .45 + phase * 40. ) * .35;
        p.x += sin( glowTime * .3 + phase * 23. ) * .25;
        vec4 view = modelViewMatrix * vec4( p, 1. );
        twinkle = .25 + .75 * pow( .5 + .5 * sin( glowTime * ( 1.2 + phase * 2. ) + phase * 31. ), 3. );
        speckColour = phase < .33 ? vec3( 1., .62, .28 ) : phase < .66 ? vec3( .45, .78, 1. ) : vec3( .55, 1., .55 );
        gl_PointSize = ( 5.5 + 4. * twinkle ) * pixelRatio * ( 22. / -view.z );
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: /* glsl */`
      varying float twinkle;
      varying vec3 speckColour;
      void main() {
        float d = length( gl_PointCoord - .5 );
        float glow = smoothstep( .5, .0, d );
        gl_FragColor = vec4( speckColour * glow * glow * twinkle * 1.6, 1. );
      }`,
  });
  const points = new T.Points(geometry, material);
  points.name = 'Specks of light';
  points.frustumCulled = false;
  return { points, material };
}

// The glow round everything that lights itself (a bloom, as the light of the glowing-tree concept spills round
// its leaves): the things on GLOW_LAYER (the tree's leaves and light streams, the rings, and the feedback
// leaves, feedback-leaves.js) are drawn again, small (BLOOM_SCALE of the screen), on black; what is brighter
// than BLOOM_THRESHOLD is blurred (two rounds, the second wider) and added onto the frame.
export const GLOW_LAYER = 4;
const BLOOM_SCALE = 1 / 3;
const BLOOM_THRESHOLD = 0.24;
const BLOOM_STRENGTH = 0.7;
function createBloom(renderer) {
  const target = () => new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, depthBuffer: false });
  const glowing = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
  const blurA = target(), blurB = target();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const quadScene = new T.Scene();
  quadScene.add(quad);
  const vertexShader = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4( position.xy, 0., 1. ); }';
  const blur = new T.ShaderMaterial({
    uniforms: { source: { value: null }, step: { value: new T.Vector2() }, threshold: { value: 0 } },
    vertexShader,
    fragmentShader: /* glsl */`
      uniform sampler2D source;
      uniform vec2 step;
      uniform float threshold;
      varying vec2 vUv;
      vec3 sampleAt( vec2 uv ) { return max( texture2D( source, uv ).rgb - threshold, 0. ); }
      void main() {
        vec3 sum = sampleAt( vUv ) * .2270;
        sum += ( sampleAt( vUv + step * 1.3846 ) + sampleAt( vUv - step * 1.3846 ) ) * .3162;
        sum += ( sampleAt( vUv + step * 3.2308 ) + sampleAt( vUv - step * 3.2308 ) ) * .0703;
        gl_FragColor = vec4( sum, 1. );
      }`,
    depthTest: false, depthWrite: false,
  });
  const add = new T.ShaderMaterial({
    uniforms: { glow: { value: null }, strength: { value: BLOOM_STRENGTH } },
    vertexShader,
    fragmentShader: /* glsl */`
      uniform sampler2D glow;
      uniform float strength;
      varying vec2 vUv;
      void main() { gl_FragColor = vec4( pow( texture2D( glow, vUv ).rgb * strength, vec3( 1. / 2.2 ) ), 1. ); }`,
    blending: T.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false,
  });
  const size = new T.Vector2(), clearColour = new T.Color();
  const pass = (material, source, destination, x, y, threshold = 0) => {
    material.uniforms.source.value = source.texture;
    material.uniforms.step.value.set(x / source.width, y / source.height);
    material.uniforms.threshold.value = threshold;
    quad.material = material;
    renderer.setRenderTarget(destination);
    renderer.render(quadScene, camera);
  };
  return (scene, sceneCamera) => {
    renderer.getDrawingBufferSize(size);
    const width = Math.max(1, Math.round(size.x * BLOOM_SCALE)), height = Math.max(1, Math.round(size.y * BLOOM_SCALE));
    if (glowing.width !== width || glowing.height !== height) [glowing, blurA, blurB].forEach(t => t.setSize(width, height));
    // The glowing things only, on black.
    const layers = sceneCamera.layers.mask, background = scene.background, autoClear = renderer.autoClear;
    const clearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(clearColour);
    sceneCamera.layers.set(GLOW_LAYER);
    scene.background = null;
    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(glowing);
    renderer.clear();
    renderer.render(scene, sceneCamera);
    sceneCamera.layers.mask = layers;
    scene.background = background;
    renderer.setClearColor(clearColour, clearAlpha);
    // Blurred: the bright parts, then wider.
    pass(blur, glowing, blurA, 1, 0, BLOOM_THRESHOLD);
    pass(blur, blurA, blurB, 0, 1);
    pass(blur, blurB, blurA, 2.2, 0);
    pass(blur, blurA, blurB, 0, 2.2);
    // Added onto the frame on screen.
    add.uniforms.glow.value = blurB.texture;
    quad.material = add;
    renderer.setRenderTarget(null);
    renderer.autoClear = false;
    renderer.render(quadScene, camera);
    renderer.autoClear = autoClear;
  };
}

// addTree(tree): the next stage's tree, made to glow before it is shown (scene.js); update(tree) takes the
// tree shown now; afterRender(camera), after each frame is drawn, adds the glow round the lit things (bloom).
export function addGlowLook({ scene, renderer, tree, clock, lights }) {
  tree.updateMatrixWorld(true);
  const base = new T.Vector3().setFromMatrixPosition(tree.matrixWorld);
  const uniforms = { glowTime: clock.time, glowCentre: { value: base }, glowUnscale: { value: 1 } };
  const done = new Set();
  const foliage = new T.Box3();
  const addTree = next => next.traverse(object => {
    if (!object.isMesh) return;
    object.layers.enable(GLOW_LAYER); // its leaves and light streams glow (bloom)
    if ([object.material].flat().some(material => material?.alphaTest > 0)) pickLeaves(object.geometry);
    for (const material of [object.material].flat()) {
      glowMaterial(material, uniforms, done);
      if (next === tree && material?.alphaTest > 0) foliage.expandByObject(object);
    }
  });
  addTree(tree);

  const wood = new T.Box3().setFromObject(tree);
  const reach = Math.max(4.5, Math.min(9, Math.max(wood.max.x - wood.min.x, wood.max.z - wood.min.z) * 0.32));
  const rings = platform(clock, base, reach);
  rings.layers.enable(GLOW_LAYER);
  scene.add(rings);
  const specks = sparkles(clock, foliage.isEmpty() ? wood : foliage, renderer); // soft already: not in the bloom
  scene.add(specks.points);
  const bloom = createBloom(renderer);

  return {
    addTree,
    afterRender: camera => bloom(scene, camera),
    // After the weather's update: night, in cool moonlight, whatever the weather or the time of day.
    update(shown = tree) {
      uniforms.glowUnscale.value = 1 / Math.max(0.05, shown.scale.x); // a tree growing into its next stage
      if (clock.treeShade) clock.treeShade.value = 0; // the tree lights itself (matte-tree.js timeOfDay)
      clock.night.value = 1;
      clock.dusk.value = 0;
      lights.sun.intensity = 0.28;
      lights.sun.color.set(0x8fb2ff);
      lights.hemi.intensity = 0.5;
      lights.hemi.color.set(0x2c4378);
      lights.hemi.groundColor.set(0x0a1020);
      lights.fill.intensity = 0.2;
      lights.fill.color.set(0x6fa6ff);
      lights.rim.intensity = 0.35;
      lights.rim.color.set(0xffc27a);
      renderer.toneMappingExposure = 1;
      specks.material.uniforms.pixelRatio.value = renderer.getPixelRatio();
    },
  };
}
