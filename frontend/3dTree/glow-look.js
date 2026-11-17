// The glowing look of the 3D ESG Tree, as in the ESG Centre's glowing-tree concept: the river valley at
// night, with the tree lit from within.
//   - the scene is held at night (after the weather's own update every frame, so live weather, rain and the
//     admin's sky settings never brighten it), in a cool moonlight;
//   - streams of gold and blue light run up the trunk and out along the branches, with pulses of light
//     travelling up them;
//   - the tree's own leaves glow: mostly green, some blue and some orange (as Environmental, Social and
//     Governance), each with a bright edge, and now and then one twinkles;
//   - rings of light lie on the ground round the base of the tree, a pulse of light spreading out across them;
//   - specks of light float and twinkle round the canopy.
// The feedback leaves glow in their own colours (feedback-leaves.js). The admin turns the look on or off in
// 3D Tree Settings ("Glowing look", tree3dParameters.glowLook, on by default); ?look=natural or ?look=glow in
// the page address fixes one (to try it out).
import { THREE as T } from './vendor/three-runtime.js';

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

// Streams of light winding up the trunk and out along the branches: thin lines at fixed angles round the
// trunk (so they run up it, and out along branches, which spread from it), with pulses travelling along them.
const BARK_GLOW = /* glsl */`
  vec3 fromTrunk = vGlowPos - glowCentre;
  float around = atan( fromTrunk.z, fromTrunk.x );
  float along = fromTrunk.y + length( fromTrunk.xz ) * .8;
  float wind = around * 7. + sin( fromTrunk.y * .55 + around * 2. ) * 1.1;
  float goldLine = pow( max( 0., sin( wind ) ), 34. );
  float blueLine = pow( max( 0., sin( wind * .5 + 1.9 ) ), 52. );
  float goldPulse = pow( fract( along * .085 - glowTime * .2 + around * .16 ), 5. );
  float bluePulse = pow( fract( along * .07 - glowTime * .27 + .5 - around * .11 ), 5. );
  vec3 streams = vec3( 1., .7, .26 ) * goldLine * ( .45 + 2.4 * goldPulse )
    + vec3( .25, .72, 1. ) * blueLine * ( .4 + 2.2 * bluePulse );
  diffuseColor.rgb = diffuseColor.rgb * ${BARK_DIM.toFixed(2)} + streams * 1.5;
`;

// The tree's own leaves, glowing: each cluster of leaves in its colour (mostly green, some blue, some orange),
// lit by its own picture's light and shade, with a bright edge, and now and then a twinkle.
const LEAF_GLOW = /* glsl */`
#ifdef USE_MAP
  float cluster = glowHash( floor( vGlowPos * 1.6 ) );
  vec3 hue = cluster < .14 ? vec3( .22, .58, 1. ) : cluster < .27 ? vec3( 1., .55, .14 ) : vec3( .36, 1., .3 );
  float shade = dot( diffuseColor.rgb, vec3( .3, .59, .11 ) );
  float edge = 1. - texture2D( map, vMapUv, 2. ).a;
  float twinkle = step( .93, glowHash( floor( vGlowPos * 1.6 ) + 7.1 ) )
    * pow( max( 0., sin( glowTime * 1.7 + cluster * 60. ) ), 24. );
  diffuseColor.rgb = hue * ( .08 + .95 * shade + .85 * edge ) + mix( hue, vec3( 1. ), .5 ) * 1.5 * twinkle;
#endif
`;

function glowMaterial(material, uniforms, done) {
  if (!material || done.has(material)) return;
  done.add(material);
  const leaf = material.alphaTest > 0;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer); // the leaves' wind (matte-tree.js)
    Object.assign(shader.uniforms, uniforms);
    // Where on the tree, as at its full size (glowUnscale), so its colours hold still while it grows.
    shader.vertexShader = 'uniform vec3 glowCentre;\nuniform float glowUnscale;\nvarying vec3 vGlowPos;\n'
      + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n'
        + '  vGlowPos = glowCentre + ( ( modelMatrix * vec4( transformed, 1. ) ).xyz - glowCentre ) * glowUnscale;');
    shader.fragmentShader = GLOW_COMMON + shader.fragmentShader.replace('#include <map_fragment>',
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
        vec3 blue = vec3( .3, .78, 1. ), gold = vec3( 1., .74, .34 );
        vec3 light = blue * ( 1.3 * ring( r, .64, .01 ) + .9 * ring( r, .97, .009 ) + .8 * dashes + .9 * pulse )
          + gold * ( 1.2 * ring( r, .78, .008 ) + .35 * ring( r, .5, .006 ) )
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
        speckColour = phase < .4 ? vec3( 1., .82, .45 ) : phase < .7 ? vec3( .45, .85, 1. ) : vec3( .6, 1., .55 );
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

// addTree(tree): the next stage's tree, made to glow before it is shown (scene.js); update(tree) takes the
// tree shown now.
export function addGlowLook({ scene, renderer, tree, clock, lights }) {
  tree.updateMatrixWorld(true);
  const base = new T.Vector3().setFromMatrixPosition(tree.matrixWorld);
  const uniforms = { glowTime: clock.time, glowCentre: { value: base }, glowUnscale: { value: 1 } };
  const done = new Set();
  const foliage = new T.Box3();
  const addTree = next => next.traverse(object => {
    if (!object.isMesh) return;
    for (const material of [object.material].flat()) {
      glowMaterial(material, uniforms, done);
      if (next === tree && material?.alphaTest > 0) foliage.expandByObject(object);
    }
  });
  addTree(tree);

  const wood = new T.Box3().setFromObject(tree);
  const reach = Math.max(4.5, Math.min(9, Math.max(wood.max.x - wood.min.x, wood.max.z - wood.min.z) * 0.32));
  scene.add(platform(clock, base, reach));
  const specks = sparkles(clock, foliage.isEmpty() ? wood : foliage, renderer);
  scene.add(specks.points);

  return {
    addTree,
    // After the weather's update: night, in cool moonlight, whatever the weather or the time of day.
    update(shown = tree) {
      uniforms.glowUnscale.value = 1 / Math.max(0.05, shown.scale.x); // a tree growing into its next stage
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
