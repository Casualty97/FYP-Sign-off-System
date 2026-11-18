// The 3D screen's view, as the admin sets it (Admin > Digital Tree Adjustment > 3D Tree Settings > 3D View and
// Zoom; tree3dParameters allowZoom and screenView, checked by backend/features/parameters/tree3d.js):
//   - every 3D screen shows the view the admin chose from the saved snapshots ("Use on 3D screens":
//     screenView, its zoom and its angle round the tree), or the standard view (zoom 1, from the front), and
//     moves smoothly to a newly chosen one within a few seconds;
//   - with "Let viewers zoom in and out" (allowZoom), viewers zoom with the mouse wheel, a pinch, the + and -
//     keys and the + and - buttons in the controls bar (on their own when the admin turned the controls bar
//     off), between tree-view.js ZOOM_MIN and ZOOM_MAX; turned off, the screen goes back to the view in use's
//     zoom.
// The admin's 3D preview (editor: the page opened with ?viewEditor=1 in the admin's panel) can always zoom;
// the admin turns and zooms it to the view wanted and saves a snapshot of it there (scene.js esgTree3dView).
import { onTree3dSettings } from './tree3d-settings.js';
import { ZOOM_MIN, ZOOM_MAX } from './tree-view.js';

const ZOOM_STEP = 1.18;      // each press of + or - zooms this much
const clampZoom = zoom => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(zoom) || 1));

// The admin's chosen view, if it is a whole view; otherwise none (the standard view).
function chosenView(view) {
  if (!view || ![view.zoom, view.azimuth, view.polar].every(value => Number.isFinite(Number(value)))) return null;
  return { zoom: clampZoom(view.zoom), azimuth: Number(view.azimuth), polar: Number(view.polar) };
}

export function installViewSettings(treeView, { zoomIn, zoomOut, viewTools, editor = false }) {
  let rules = null; // the admin's view settings, once loaded

  // The view in use: the admin's chosen snapshot, or the standard view (zoom 1, from the front).
  const viewInUse = () => rules.screenView || { zoom: 1, ...treeView.standardAngle() };

  function showTools() {
    for (const button of [zoomIn, zoomOut]) if (button) button.hidden = !rules.allowZoom;
    if (viewTools) viewTools.hidden = !rules.allowZoom;
    // Shown even with the admin's controls bar turned off: then on their own (scene.css view-tools-on).
    document.body.classList.toggle('view-tools-on', rules.allowZoom);
  }

  onTree3dSettings(settings => {
    const screenView = chosenView(settings.screenView);
    const before = rules;
    rules = {
      allowZoom: editor || settings.allowZoom === true,
      screenView,
      key: screenView ? [screenView.zoom, screenView.azimuth, screenView.polar].join('|') : 'standard',
    };
    treeView.setZoomRules({ allow: rules.allowZoom, zoom: viewInUse().zoom });
    showTools();
    if (!before) treeView.setView(viewInUse(), { smooth: false }); // the screen opening: the view in use
    else if (rules.key !== before.key) treeView.setView(viewInUse()); // the admin chose another view
    else if (before.allowZoom && !rules.allowZoom) treeView.setView({ zoom: viewInUse().zoom }); // zooming turned off
  });

  zoomIn?.addEventListener('click', () => treeView.zoomBy(ZOOM_STEP));
  zoomOut?.addEventListener('click', () => treeView.zoomBy(1 / ZOOM_STEP));
}
