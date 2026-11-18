import { THREE as T, OrbitControls } from './vendor/three-runtime.js';

const centre = new T.Vector3(.14, 6.95, 0);
export const orbitCentre = centre.clone(); // the point the view turns around (feedback-leaves.js turns with it)
const front = new T.Vector3(.115, .171, 1).normalize();
// The automatic turn: one full turn every TURN_SECONDS by default (24 hours), or as the admin sets it
// (3D Scene Controls: tree3dParameters.orbitSeconds, 30 seconds to 24 hours, and orbitDirection; setOrbit).
export const TURN_SECONDS = 24 * 60 * 60;
export const TURN_SECONDS_MIN = 30;
// One fixed, close framing with the tree as the main focus: the canopy fills a laptop screen from side to
// side, and on the 3.5:1 wall (7 m x 2 m) the tree fills the height with the river and hills either side.
// Zooming is off, so every screen always shows the tree at this size.
const frameHeight = 14.2;    // metres of the scene seen top to bottom (the trunk's roots to the canopy top)
const frameWidth = 27;       // metres always seen side to side, so a narrower screen still shows the canopy

export function createTreeView(camera, canvas, orbitButton, { autoOrbit, reducedMotion }) {
  const controls = new OrbitControls(camera);
  controls.target.copy(centre);
  controls.enablePan = false;
  controls.enableZoom = false; // no scroll, pinch or key zoom: the framing stays fixed
  controls.enableDamping = !reducedMotion;
  controls.minPolarAngle = T.MathUtils.degToRad(60);
  controls.maxPolarAngle = T.MathUtils.degToRad(85);
  controls.rotateSpeed = .54;
  // OrbitControls turns autoRotateSpeed / 60 of a turn a second: 60 / seconds is one turn in that many seconds.
  // A positive speed moves the view to its left round the tree, so the tree seems to turn to the right.
  const turnSpeed = (seconds, direction) => (direction === 'left' ? -1 : 1) * 60
    / Math.min(TURN_SECONDS, Math.max(TURN_SECONDS_MIN, Number(seconds) || TURN_SECONDS));
  controls.autoRotateSpeed = turnSpeed(TURN_SECONDS, 'right');

  const offset = new T.Vector3();
  const focus = controls.target;
  let viewDistance = 0;
  let dragging = false;
  let resumeDelay = 0;

  function pauseOrbit() {
    resumeDelay = 4;
    controls.autoRotate = false;
  }

  const keyMoves = new Map([
    ['ArrowLeft', () => controls.rotateLeft(-.065)],
    ['ArrowRight', () => controls.rotateLeft(.065)],
    ['ArrowUp', () => controls.rotateUp(.065)],
    ['ArrowDown', () => controls.rotateUp(-.065)],
  ]);
  canvas.addEventListener('keydown', event => {
    const move = keyMoves.get(event.key);
    if (!move || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    pauseOrbit();
    move();
  });

  controls.addEventListener('start', () => {
    dragging = true;
    pauseOrbit();
  });
  controls.addEventListener('end', () => {
    dragging = false;
    pauseOrbit();
  });
  controls.connect(canvas);
  controls.cursorStyle = 'grab';

  function showOrbitState() {
    orbitButton.setAttribute('aria-pressed', String(autoOrbit));
  }
  orbitButton.addEventListener('click', () => {
    autoOrbit = !autoOrbit;
    controls.autoRotate = false;
    showOrbitState();
  });
  showOrbitState();

  return {
    resize(aspect) {
      if (viewDistance > 0 && camera.aspect === aspect) return;
      camera.aspect = aspect;
      camera.fov = aspect < 1.12 ? 45 : 34;
      camera.updateProjectionMatrix();

      // Close enough to see frameHeight top to bottom, but never so close that frameWidth is cut off.
      const firstFraming = viewDistance === 0;
      const halfFovTan = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
      viewDistance = Math.max(frameHeight / (2 * halfFovTan), frameWidth / (2 * halfFovTan * aspect));
      controls.minDistance = viewDistance;
      controls.maxDistance = viewDistance;
      if (firstFraming) offset.copy(front);
      else offset.subVectors(camera.position, focus).normalize(); // keep the current orbit angle
      focus.copy(centre);
      camera.position.copy(focus).addScaledVector(offset, viewDistance);
      controls.update(0);
      camera.updateMatrixWorld();
    },
    update(dt, elapsedSeconds) {
      const orbitStep = Math.max(0, elapsedSeconds - resumeDelay);
      resumeDelay = Math.max(0, resumeDelay - elapsedSeconds);
      controls.dampingFactor = -Math.expm1(-dt * 9);
      controls.autoRotate = autoOrbit && !dragging && orbitStep > 0;
      controls.update(orbitStep);
    },
    // The admin's turning speed (one full turn every `seconds`) and direction ('right' or 'left').
    setOrbit({ seconds, direction }) {
      controls.autoRotateSpeed = turnSpeed(seconds, direction);
    },
  };
}
