# Digital tree (2D and 3D)

**Owner:** Role 2, Wei Jie

**Where the code is**

- backend/features/tree/routes.js
- frontend/tree/, frontend/3dTree/
- frontend/admin/js/tree.js (Digital Tree Adjustment tab), frontend/admin/js/tree3d.js (its 3D Tree Settings tab), backend/features/parameters/tree3d.js (3D settings defaults and checks), and the leaf / background / vip-leaf / treeParameters routes still inside backend/features/admin/routes.js

**What it does**

The wall display. /api/tree returns this year's visitors as leaves; tree.js places them around the trunk, animates falling leaves and VIP gold leaves, and polls for new feedback. The admin tab controls growth stage, backgrounds, leaf images and the title box. A new feedback's leaf first shows at the bottom middle of the wall for treeParameters.leafShowcaseSeconds (12 seconds by default, "Time at the Bottom Middle" in the 2D Visualization Parameters, one setting shared by both trees and also set from the 3D Tree Visualization Parameters, saved by PUT /api/admin/parameters/treeParameters too; 0 flies at once; an empty box saves the default, not 0), then flies to the tree; several new leaves take turns there. The page checks for new feedback every 5 seconds from when it opens. A leaf pushed off by a new one falls smoothly on both trees: it drifts out and flows down in one curve (no zigzag or spin), settling softly as it fades; on the 2D tree the fall is one Web Animation pinned to its start (tree.js playLeafFall), so a refresh mid-fall does not restart it. The admin's Display 2D/3D Tree (treeParameters.treeDisplayMode) chooses the tree on the wall: /tree and /3dTree both open the chosen tree (the other address redirects, keeping any ?options; backend/features/parameters/treeDisplay.js, on both servers), and an open tree page switches by itself within about 5 seconds of a change (not the admin's /tree-demo). The 3D page is the self-contained Ketapang River scene (frontend/3dTree/3dTree.html with scene.js and its modules, three.js bundled in vendor/, models and audio in assets/); see frontend/3dTree/README.md. The admin's 3D Tree Settings tab sets the 3D page's weather, rain area, river level, orbit, sound, soil cutaway, which on-screen panels show, and its title box (the same settings as the 2D title box); they are saved as `tree3dParameters` through PUT /api/admin/parameters/tree3dParameters and the 3D page (tree3d-settings.js) applies them from /api/parameters within about 5 seconds. Its 3D Leaf Adjustments set the feedback leaves on the 3D tree (frontend/3dTree/feedback-leaves.js, the RainTree leaf model in assets/Tree/3dTreeLeaves): new and older leaf colours, how long a leaf counts as new, leaf scale (how many leaves: the same as the 2D tree, its Maximum Visible Leaves and growth stage); there is no leaf upload for 3D. Its 3D VIP Leaf Adjustments set the gold VIP leaves (VIPs are the names in VIP Management): their gold, scale and gold glow. Its 3D Tree Visualization Parameters are the 2D Visualization Parameters for the 3D tree (leaf area, refresh interval, opacity, appear, float-up time, fall duration, badge leaf colours; the bottom-middle time is the 2D tree's, shared by both trees; saved in tree3dParameters), with Maximum Visible Leaves shared with the 2D tree (treeParameters.leafFallThreshold, now also accepted by PUT /api/admin/parameters/treeParameters). Maximum Visible Leaves is first in, first out on both trees; the 3D tree makes many leaves smaller so they fit. A 3D leaf joins light and turns dark after its light period (tree3dParameters.leafNewHours, minutes or hours; the dark shade may go down to OLD_MIN_LIGHTNESS in feedback-leaves.js, so it reads clearly as a dark shade): light to dark green, or (by default) a light to a dark shade of its badge colour, the 3D badge colour once changed in the 3D panel and otherwise the 2D tree's badgeLeafStyles colour. Every 2D leaf (not a VIP's) is likewise its badge's colour from Badge Leaf Styling: a light shade for its first tint window (badgeLeafStyles.tintDurationHours, "A leaf stays light for" in Badge Leaf Styling, minutes or hours, stored to 3 decimals of an hour so 1 minute can be set; 24 hours when 0 or unset), then a darker shade (tree.js adds .leaf-tint-aged; tree.css). The 3D tree grows through the same stages 0 to 4 as the 2D tree (the same treeStage, also settable in the admin's 3D Tree Growth Stage panel), showing the Ketapang_Stage_0 to 4 models in assets/Tree/3dTreeLeaves (frontend/3dTree/tree-stage.js); the /3dTree page changes to a new stage in place, without reloading (the tree grows into it). In Auto (treeParameters.treeStageMode 'auto', saved by either admin panel) the stage grows by itself: GET /api/parameters reports the stage for this year's leaf count and the leafThresholds (backend/features/parameters/treeStage.js, with the count from features/tree/routes.js countLiveTreeLeaves), so both trees move up within about 15 seconds of reaching a threshold; Manual keeps the chosen stage, shown full. Between the stages the 3D tree grows a little with every leaf: /api/parameters also reports how far the tree is from this stage's threshold to the next (treeStageAuto.progress, stageProgress in treeStage.js), and the tree's own foliage fills in with it, slowly (about 9 seconds per new leaf, without a reload), from the middle of the canopy outwards, the new growth a fresh lime green at the leaf's own brightness (never glowing at night) fading into the canopy over about 20 seconds, until the canopy is full at the next stage's threshold; nothing already grown is taken away and the visitors' leaves stay; on reaching a new stage the tree grows into it in place, without reloading the page: the new stage's model loads in the background, takes the tree's place at the same size with the foliage it had, then grows to its own size with a growth spurt of fresh foliage, the visitors' leaves staying where they are; it is fully grown at the Stage 4 (Full Canopy) threshold, set in the admin (frontend/3dTree/tree-growth.js). The admin's 3D Tree Growth Stage panel shows how far it has grown ("60% grown towards Stage 3 (6 more leaves)"). ?stage=2&growth=0.5 on /3dTree shows a stage part grown, ?stage=3&growFrom=2 stage 3 just reached, with its growth spurt. In the natural look the 3D tree is shaded for the time of day like the rest of the scene (cool moonlight at night, warmer at dusk; frontend/3dTree/matte-tree.js), the feedback leaves a little less so they stay readable. The 3D page has the glowing look of the ESG Centre's concept (frontend/3dTree/glow-look.js): the scene at night, light streams in the trunk and branches, the tree's own leaves glowing green, blue and orange, rings of light round the base and floating specks of light. The admin's 3D Tree Settings has a "Glowing look" switch (tree3dParameters.glowLook, on by default, checked in backend/features/parameters/tree3d.js); off shows the daylight river valley with natural leaves, and an open 3D page reloads into the chosen look within about 5 seconds (?look=natural or ?look=glow fixes one). The 3D feedback leaves glow like leaves of light (a vivid badge colour, glowing veins and outline, a soft breathing glow and an occasional light sweep), with the visitor's name in white handwriting (frontend/3dTree/feedback-leaves.js GLOW_FRAGMENT). Clicking a 3D feedback leaf opens the same leaf detail card as the 2D tree (name, privacy label, badge, date, pledge snippet; frontend/3dTree/leaf-detail.js), beside the leaf. On both trees the card opens beside the clicked leaf (on the side with more room, kept on screen) and closes with its button, Escape, a click away from the leaves, or when the leaf falls; on the 3D tree it also closes as soon as the view is turned (feedback-leaves.js). On both trees feedback leaves stay clear of the title box wherever the admin positions it: new leaves are never placed under it, the bottom-middle start rises above a bottom title box, and leaves it covers after it moves or resizes are given new spots (2D: tree.js getTitleKeepOut; 3D: feedback-leaves.js titleArea and keepClearOfTitle). The 3D view has one fixed zoom (frontend/3dTree/tree-view.js); when it is turned round the tree, every feedback leaf stays where it is on the tree, without turning.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/3dtree` | backend/server.js |
| GET | `/3dTree` | backend/kioskServer.js |
| POST | `/api/admin/parameters/background` | backend/features/admin/routes.js |
| POST | `/api/admin/parameters/leaf` | backend/features/admin/routes.js |
| GET | `/api/admin/parameters/leaf/list` | backend/features/admin/routes.js |
| POST | `/api/admin/parameters/leaf/revert` | backend/features/admin/routes.js |
| POST | `/api/admin/parameters/leaf/select` | backend/features/admin/routes.js |
| GET | `/api/admin/parameters/tree-background/list` | backend/features/admin/routes.js |
| POST | `/api/admin/parameters/tree-background/select` | backend/features/admin/routes.js |
| POST | `/api/admin/parameters/tree-background/upload` | backend/features/admin/routes.js |
| PUT | `/api/admin/parameters/treeParameters` | backend/features/admin/routes.js |
| POST | `/api/admin/parameters/vip-leaf` | backend/features/admin/routes.js |
| GET | `/api/admin/parameters/vip-leaf/list` | backend/features/admin/routes.js |
| POST | `/api/admin/parameters/vip-leaf/revert` | backend/features/admin/routes.js |
| POST | `/api/admin/parameters/vip-leaf/select` | backend/features/admin/routes.js |
| GET | `/api/tree` | backend/features/tree/routes.js |
| GET | `/api/tree/vip-names` | backend/features/tree/routes.js |
| GET | `/api/tree/years` | backend/features/tree/routes.js |
| GET | `/tree` | backend/kioskServer.js |
| GET | `/tree-demo` | backend/server.js |
| GET | `/tree-demo/` | backend/server.js |

**Task-sheet items for this feature**

- 3D tree animation with a moving leaf container; smoother 2D animation; replace or enhance the 4 growth stages.
- New leaf appears at the bottom centre for 10 to 15 s before joining the tree.
- Event-driven refresh instead of polling.
- Corrected pulse screen layout (deliverables list).

**Known issues (from the October 2026 review, line numbers refer to the layout before the restructure where noted)**

- Live tree polls every 5 s regardless of leafRefreshInterval, 4 requests and a full rebuild each time (tree.js 2042).
- Auto growth stage is computed once when the admin saves; nothing re-evaluates it as leaves arrive (the thresholds are stored and reloaded into the form since 31 Oct).
- Empty number boxes save 0 and the wall uses hidden defaults (admin/js/parameters.js + tree.js 411).
- Tree keeps archived rows that pulse and pledgeboard hide (treeRoutes 112).
- Default background path wrong in parameters/store.js 185 (black wall on a fresh install).
- Fixed 18 Nov 2026: the badge tint duration had no admin input (param-tintDurationHours), so it was always 0 (24 hours); it is now "A leaf stays light for" (minutes or hours) in Badge Leaf Styling.

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
