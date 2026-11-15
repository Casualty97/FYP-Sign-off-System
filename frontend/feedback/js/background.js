// =============================================================================
// background.js - Virtual photo backgrounds (like a video call)
//
// What it does:
//   The visitor picks one of a few RP backgrounds on the camera page. They see it on the live camera
//   (a preview), and when the photo is captured, everything behind them is replaced by that background.
//
// How it works (3 steps):
//   1. A person-segmentation model marks which pixels are "person" (the mask).
//   2. A hand model finds hands, and we add the hands and forearms to the mask,
//      because the person model often loses thin fingers and lone arms.
//   3. The background is drawn first, then the person is drawn on top using the mask.
//
// The values below were tuned in a separate test page. Change them here, not in the UI.
//
// Like the other kiosk scripts, this file uses plain top-level functions. Private names start with "bg"
// (or BG_) so they cannot clash with names in other files. The functions used by other files are:
//   setupBackgroundPicker(), resetBackgroundSelection(), waitForBackgroundIfNeeded(),
//   getBackgroundCompositeCanvas(video) and the constant BACKGROUND_IN_BOOMERANG.
// =============================================================================

// ---------- Backgrounds the visitor can choose ----------
// To add or change one: put a ~1280x720 JPG (under ~200 KB) in assets/backgrounds/ and edit this list.
const BACKGROUND_OPTIONS = [
    { id: 'none', label: 'No background', image: null },
    { id: 'rp-library', label: 'RP Library', image: '/assets/backgrounds/rp-library.jpg' },
    { id: 'rp-pond', label: 'RP Pond', image: '/assets/backgrounds/rp-pond.jpg' },
    { id: 'rp-south-food-court', label: 'RP South Food Court', image: '/assets/backgrounds/rp-south-food-court.jpg' }
];

// Boomerang records many frames, and each one needs the person model. Set to false if it feels slow on the tablet.
const BACKGROUND_IN_BOOMERANG = true;

// ---------- Models ----------
// Each model is tried from our own copy first (assets/models/, works with no internet),
// then from Google's pinned copy as a backup.
const BG_SEGMENTER_MODEL_URLS = [
    '/assets/models/selfie_segmenter.tflite',
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite'
];
const BG_HAND_MODEL_URLS = [
    '/assets/models/hand_landmarker.task',
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
];

// ---------- Tuned settings ----------
const BG_MASK_THRESHOLD = 0.50;        // how sure the model must be before a pixel counts as "person"
const BG_MASK_CRISPNESS = 0.40;        // 0 = soft edges, 1 = hard edges
const BG_HAND_WIDTH = 0.28;            // thickness of finger and palm shapes (x hand size)
const BG_FOREARM_LENGTH = 2.5;         // forearm candidate area length (x hand size)
const BG_FOREARM_WIDTH = 1.10;         // forearm candidate area width (x palm width)
const BG_FOREARM_COLOUR_TOLERANCE = 10; // how close to the palm's skin colour a forearm pixel must be
const BG_HAND_CONFIDENCE = 0.70;       // ignore "hands" the model is less sure about (pillows, cushions...)

// ---------- State ----------
let selectedBackgroundId = 'none';
const backgroundImages = {};        // id -> loaded image
let bgSegmenter = null;
let bgHandLandmarker = null;
let bgPersonMaskIndex = 0;            // which of the model's masks is the "person" one
let bgToolReady = false;
let bgToolLoadPromise = null;

// A workspace is a set of off-screen canvases used to build one picture. The photo capture and the live
// preview each get their own, so switching between the two sizes never has to resize (and clear) the same canvases.
function createBackgroundWorkspace() {
    const make = (options) => {
        const canvas = document.createElement('canvas');
        return { canvas: canvas, ctx: canvas.getContext('2d', options) };
    };
    return {
        mask: make(),                                   // the model's small mask
        combined: make(),                               // model mask + hands + forearms, full size
        person: make(),                                 // the camera picture cut out to the person
        result: make(),                                 // final: background + person
        armCam: make({ willReadFrequently: true }),     // small scratch canvases for the forearm colour test
        armShape: make({ willReadFrequently: true }),
        patch: make({ willReadFrequently: true }),
        maskImageData: null
    };
}
const bgCaptureWorkspace = createBackgroundWorkspace();
let bgPreviewWorkspace = null;

// =========================================================================
// Loading the models (only when the visitor first picks a background)
// =========================================================================

function setBackgroundStatus(message) {
    const status = document.getElementById('background-status');
    if (status) status.textContent = message || '';
}

// Create a MediaPipe task: for each model address in turn, try the GPU first and then the CPU
// (some tablets have no usable GPU delegate). Throws only if every combination fails.
async function createBackgroundTask(createTask, modelUrls, extraOptions) {
    let lastError = null;
    for (const modelUrl of modelUrls) {
        for (const delegate of ['GPU', 'CPU']) {
            try {
                return await createTask(Object.assign({ baseOptions: { modelAssetPath: modelUrl, delegate: delegate } }, extraOptions));
            } catch (error) {
                lastError = error;
            }
        }
    }
    throw lastError;
}

function ensureBackgroundReady() {
    if (bgToolReady) return Promise.resolve(true);
    if (bgToolLoadPromise) return bgToolLoadPromise;

    bgToolLoadPromise = import(MEDIAPIPE_TASKS_VISION_URL)
        .then(async ({ ImageSegmenter, HandLandmarker, FilesetResolver }) => {
            const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

            // IMAGE mode: we segment one photo at a time, so every call is synchronous.
            bgSegmenter = await createBackgroundTask(
                (options) => ImageSegmenter.createFromOptions(vision, options),
                BG_SEGMENTER_MODEL_URLS,
                { runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false }
            );
            const labels = bgSegmenter.getLabels();
            const labelIndex = labels.findIndex((label) => /person|foreground/i.test(label));
            bgPersonMaskIndex = labelIndex >= 0 ? labelIndex : 0;

            // The hand model is a bonus. If it fails, the background still works without hand protection.
            try {
                bgHandLandmarker = await createBackgroundTask(
                    (options) => HandLandmarker.createFromOptions(vision, options),
                    BG_HAND_MODEL_URLS,
                    {
                        runningMode: 'IMAGE',
                        numHands: 2,
                        minHandDetectionConfidence: BG_HAND_CONFIDENCE,
                        minHandPresenceConfidence: BG_HAND_CONFIDENCE
                    }
                );
            } catch (handError) {
                console.warn('Background: hand model could not load, continuing without hand protection.', handError);
                bgHandLandmarker = null;
            }

            bgToolReady = true;
            return true;
        })
        .catch((error) => {
            console.error('Background tool could not load:', error);
            bgToolLoadPromise = null;   // allow another try next time
            return false;
        });

    return bgToolLoadPromise;
}

// Capture waits for this, so a photo is never taken half-way through loading the tool
async function waitForBackgroundIfNeeded() {
    if (selectedBackgroundId === 'none') return;
    await ensureBackgroundReady();
}

function loadBackgroundImage(id) {
    const option = BACKGROUND_OPTIONS.find((item) => item.id === id);
    if (!option || !option.image) return Promise.resolve(null);
    if (backgroundImages[id]) return Promise.resolve(backgroundImages[id]);

    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => { backgroundImages[id] = image; resolve(image); };
        image.onerror = () => resolve(null);
        image.src = option.image;
    });
}

// =========================================================================
// The picker (thumbnails on the camera page)
// =========================================================================

function updateBackgroundPickerHighlight() {
    const selected = BACKGROUND_OPTIONS.find((item) => item.id === selectedBackgroundId);
    document.querySelectorAll('.background-card').forEach((card) => {
        const isActive = card.dataset.background === selectedBackgroundId;
        card.classList.toggle('active', isActive);
        card.setAttribute('aria-selected', String(isActive));
    });
    const activeLabel = document.getElementById('background-active');
    if (activeLabel && selected) activeLabel.textContent = selected.label;
}

async function selectBackground(id) {
    if (!BACKGROUND_OPTIONS.some((item) => item.id === id)) return;
    selectedBackgroundId = id;
    updateBackgroundPickerHighlight();

    if (id === 'none') {
        setBackgroundStatus('');
        stopBackgroundPreview();
        return;
    }

    setBackgroundStatus('Getting your background ready...');
    const [image, ready] = await Promise.all([loadBackgroundImage(id), ensureBackgroundReady()]);
    if (selectedBackgroundId !== id) return;   // the visitor picked something else while this was loading

    if (!image || !ready) {
        selectedBackgroundId = 'none';
        updateBackgroundPickerHighlight();
        stopBackgroundPreview();
        setBackgroundStatus('Sorry, backgrounds are not available right now. Your photo will use your real background.');
        return;
    }
    setBackgroundStatus('');
    startBackgroundPreview();   // show the background on the live camera
}

function setupBackgroundPicker() {
    const selector = document.getElementById('background-selector');
    if (!selector || selector.dataset.ready === 'true') return;
    selector.dataset.ready = 'true';

    BACKGROUND_OPTIONS.forEach((option) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'background-card';
        card.dataset.background = option.id;
        card.setAttribute('role', 'option');

        const thumb = document.createElement('span');
        thumb.className = 'background-thumb' + (option.image ? '' : ' none');
        if (option.image) {
            const image = document.createElement('img');
            image.src = option.image;
            image.alt = '';
            image.loading = 'lazy';
            image.addEventListener('error', () => { thumb.classList.add('thumb-failed'); image.remove(); });
            thumb.appendChild(image);
        } else {
            thumb.textContent = '\u{1F6AB}';   // "no" sign; the name under it says what it is
        }

        const label = document.createElement('span');
        label.className = 'background-name';
        label.textContent = option.label;

        card.appendChild(thumb);
        card.appendChild(label);
        card.addEventListener('click', () => selectBackground(option.id));
        selector.appendChild(card);
    });
    updateBackgroundPickerHighlight();
}

// Called whenever a new visitor starts, so the next person does not inherit the previous choice
function resetBackgroundSelection() {
    selectedBackgroundId = 'none';
    updateBackgroundPickerHighlight();
    setBackgroundStatus('');
    stopBackgroundPreview();
}

// =========================================================================
// Making the picture
// =========================================================================

// Push mask values towards 0 or 1 so edges look crisp. Only a thin soft edge is left.
function sharpenBackgroundMask(value) {
    const half = 0.5 * (1 - BG_MASK_CRISPNESS) + 0.02;
    const a = BG_MASK_THRESHOLD - half;
    const b = BG_MASK_THRESHOLD + half;
    const t = Math.min(1, Math.max(0, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

// Copy the model's numbers (0..1 per pixel) into bgMaskCanvas as transparency
function fillBackgroundMaskCanvas(ws, values, maskWidth, maskHeight) {
    const canvas = ws.mask.canvas;
    if (canvas.width !== maskWidth || canvas.height !== maskHeight || !ws.maskImageData) {
        canvas.width = maskWidth;
        canvas.height = maskHeight;
        ws.maskImageData = ws.mask.ctx.createImageData(maskWidth, maskHeight);
    }
    const pixels = ws.maskImageData.data;
    for (let i = 0; i < values.length; i++) {
        const o = i * 4;
        pixels[o] = pixels[o + 1] = pixels[o + 2] = 0;
        pixels[o + 3] = sharpenBackgroundMask(values[i]) * 255;
    }
    ws.mask.ctx.putImageData(ws.maskImageData, 0, 0);
}

// --- Hands -------------------------------------------------------------

// Landmark numbers that join up: 0 = wrist, 4/8/12/16/20 = fingertips
const BG_FINGERS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
const BG_PALM = [0, 1, 5, 9, 13, 17];

// The hand model can mistake pink or skin-toned objects (a pillow) for a hand, so keep only confident ones
function confidentBackgroundHands(result) {
    const kept = [];
    (result.landmarks || []).forEach((landmarks, i) => {
        const score = (result.handedness && result.handedness[i] && result.handedness[i][0])
            ? result.handedness[i][0].score : 0;
        if (score >= BG_HAND_CONFIDENCE) kept.push(landmarks);
    });
    return kept;
}

// Thick shapes over each hand: a filled palm and a fat line along every finger
function drawBackgroundHandShapes(ctx, hands, w, h) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    hands.forEach((landmarks) => {
        const point = (i) => [landmarks[i].x * w, landmarks[i].y * h];
        const [wristX, wristY] = point(0);
        const [middleX, middleY] = point(9);
        const handLength = Math.hypot(middleX - wristX, middleY - wristY);   // wrist to middle-finger base = hand size
        ctx.lineWidth = Math.max(2, handLength * BG_HAND_WIDTH);

        ctx.beginPath();
        BG_PALM.forEach((index, n) => { const [x, y] = point(index); if (n) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        BG_FINGERS.forEach((finger) => {
            ctx.beginPath();
            finger.forEach((index, n) => { const [x, y] = point(index); if (n) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
            ctx.stroke();
        });
    });
    ctx.restore();
}

// --- Forearms ----------------------------------------------------------

// The area where a forearm could be: from the wrist, away from the fingers, widening a little towards the elbow
function backgroundForearmArea(landmarks, w, h) {
    const point = (i) => [landmarks[i].x * w, landmarks[i].y * h];
    const [wristX, wristY] = point(0);
    const [middleX, middleY] = point(9);
    const handLength = Math.hypot(middleX - wristX, middleY - wristY);
    if (handLength < 4) return null;

    const [indexX, indexY] = point(5);
    const [pinkyX, pinkyY] = point(17);
    const [ringX, ringY] = point(13);
    const palmWidth = Math.hypot(indexX - pinkyX, indexY - pinkyY);
    const dx = (wristX - middleX) / handLength;   // direction: fingers -> wrist -> elbow
    const dy = (wristY - middleY) / handLength;
    const nx = -dy;                               // direction across the arm
    const ny = dx;
    const halfAtWrist = palmWidth * BG_FOREARM_WIDTH / 2;
    const halfAtElbow = halfAtWrist * 1.25;
    const endX = wristX + dx * handLength * BG_FOREARM_LENGTH;
    const endY = wristY + dy * handLength * BG_FOREARM_LENGTH;

    return {
        corners: [
            [wristX + nx * halfAtWrist, wristY + ny * halfAtWrist],
            [endX + nx * halfAtElbow, endY + ny * halfAtElbow],
            [endX - nx * halfAtElbow, endY - ny * halfAtElbow],
            [wristX - nx * halfAtWrist, wristY - ny * halfAtWrist]
        ],
        palmCentre: [(wristX + indexX + pinkyX + middleX + ringX) / 5, (wristY + indexY + pinkyY + middleY + ringY) / 5]
    };
}

// Colour without brightness (so shadows matter less): the Cb and Cr parts of YCbCr
function backgroundChroma(r, g, b) {
    return [128 - 0.168736 * r - 0.331264 * g + 0.5 * b, 128 + 0.5 * r - 0.418688 * g - 0.081312 * b];
}

// Inside the forearm area, keep only pixels whose colour matches the palm. The arm's real edges decide the outline.
function addBackgroundForearm(ws, source, landmarks, w, h) {
    const area = backgroundForearmArea(landmarks, w, h);
    if (!area) return;

    const xs = area.corners.map((p) => p[0]);
    const ys = area.corners.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const x1 = Math.min(w, Math.ceil(Math.max(...xs)));
    const y1 = Math.min(h, Math.ceil(Math.max(...ys)));
    const boxW = x1 - x0;
    const boxH = y1 - y0;
    if (boxW < 2 || boxH < 2) return;

    // 1) the palm's colour: average of a small patch in the middle of the palm
    const patchX = Math.min(w - 5, Math.max(4, Math.round(area.palmCentre[0])));
    const patchY = Math.min(h - 5, Math.max(4, Math.round(area.palmCentre[1])));
    ws.patch.canvas.width = 9;
    ws.patch.canvas.height = 9;
    ws.patch.ctx.drawImage(source, patchX - 4, patchY - 4, 9, 9, 0, 0, 9, 9);
    const patch = ws.patch.ctx.getImageData(0, 0, 9, 9).data;
    let palmCb = 0;
    let palmCr = 0;
    for (let i = 0; i < 81; i++) {
        const [cb, cr] = backgroundChroma(patch[i * 4], patch[i * 4 + 1], patch[i * 4 + 2]);
        palmCb += cb;
        palmCr += cr;
    }
    palmCb /= 81;
    palmCr /= 81;

    // 2) the camera pixels inside the box around the forearm area
    ws.armCam.canvas.width = boxW;
    ws.armCam.canvas.height = boxH;
    ws.armCam.ctx.drawImage(source, x0, y0, boxW, boxH, 0, 0, boxW, boxH);
    const camera = ws.armCam.ctx.getImageData(0, 0, boxW, boxH);

    // 3) which of those pixels are inside the forearm area
    ws.armShape.canvas.width = boxW;
    ws.armShape.canvas.height = boxH;
    ws.armShape.ctx.fillStyle = '#000';
    ws.armShape.ctx.beginPath();
    area.corners.forEach(([x, y], n) => { if (n) ws.armShape.ctx.lineTo(x - x0, y - y0); else ws.armShape.ctx.moveTo(x - x0, y - y0); });
    ws.armShape.ctx.closePath();
    ws.armShape.ctx.fill();
    const inside = ws.armShape.ctx.getImageData(0, 0, boxW, boxH).data;

    // 4) keep a pixel only if it is inside the area AND close to the palm's colour
    const data = camera.data;
    for (let i = 0; i < boxW * boxH; i++) {
        const o = i * 4;
        let alpha = 0;
        if (inside[o + 3] > 127) {
            const [cb, cr] = backgroundChroma(data[o], data[o + 1], data[o + 2]);
            const distance = Math.hypot(cb - palmCb, cr - palmCr);
            const t = Math.min(1, Math.max(0, (distance - BG_FOREARM_COLOUR_TOLERANCE) / (BG_FOREARM_COLOUR_TOLERANCE * 0.6)));
            alpha = 1 - t * t * (3 - 2 * t);
        }
        data[o] = data[o + 1] = data[o + 2] = 0;
        data[o + 3] = alpha * 255;
    }
    ws.armCam.ctx.putImageData(camera, 0, 0);

    // 5) add to the mask, with a tiny blur to close small holes
    ws.combined.ctx.save();
    ws.combined.ctx.filter = 'blur(2px)';
    ws.combined.ctx.drawImage(ws.armCam.canvas, x0, y0);
    ws.combined.ctx.restore();
}

// --- Putting it together ----------------------------------------------

// Draw an image so it fills the whole canvas without being stretched ("cover")
function drawBackgroundCover(ctx, image, w, h) {
    const scale = Math.max(w / image.width, h / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    ctx.drawImage(image, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
}

// Build one picture: the camera picture (source: the video, or a smaller copy of it) with the background swapped.
// ws = which set of canvases to use, w/h = size of the source, useHands = also protect hands and forearms.
function buildBackgroundComposite(ws, source, w, h, useHands) {
    const backgroundImage = backgroundImages[selectedBackgroundId];
    if (!backgroundImage) return null;

    // 1) the person mask from the model
    const result = bgSegmenter.segment(source);
    const masks = result.confidenceMasks || [];
    if (masks.length === 0) {
        if (result.close) result.close();
        return null;
    }
    const mask = masks[Math.min(bgPersonMaskIndex, masks.length - 1)];
    fillBackgroundMaskCanvas(ws, mask.getAsFloat32Array(), mask.width, mask.height);
    if (result.close) result.close();

    // 2) hands (optional)
    let hands = [];
    if (useHands && bgHandLandmarker) hands = confidentBackgroundHands(bgHandLandmarker.detect(source));

    // 3) combined mask = model mask + hands + forearms
    [ws.combined.canvas, ws.person.canvas, ws.result.canvas].forEach((canvas) => {
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    });
    ws.combined.ctx.clearRect(0, 0, w, h);
    ws.combined.ctx.imageSmoothingQuality = 'high';
    ws.combined.ctx.drawImage(ws.mask.canvas, 0, 0, w, h);
    if (hands.length) {
        drawBackgroundHandShapes(ws.combined.ctx, hands, w, h);
        hands.forEach((landmarks) => addBackgroundForearm(ws, source, landmarks, w, h));
    }

    // 4) cut the person out of the camera picture
    ws.person.ctx.globalCompositeOperation = 'source-over';
    ws.person.ctx.clearRect(0, 0, w, h);
    ws.person.ctx.drawImage(source, 0, 0, w, h);
    ws.person.ctx.globalCompositeOperation = 'destination-in';
    ws.person.ctx.drawImage(ws.combined.canvas, 0, 0, w, h);
    ws.person.ctx.globalCompositeOperation = 'source-over';

    // 5) background first, then the person on top.
    // The picture is shown mirrored when "Mirror View" is on (the photo capture and the preview both flip it),
    // which would flip the background too and mirror any writing in it. So when mirrored we flip the background
    // here, and the mirroring later turns it the right way round again.
    ws.result.ctx.setTransform(1, 0, 0, 1, 0, 0);
    ws.result.ctx.clearRect(0, 0, w, h);
    ws.result.ctx.save();
    if (typeof isMirrored !== 'undefined' && isMirrored) {
        ws.result.ctx.translate(w, 0);
        ws.result.ctx.scale(-1, 1);
    }
    drawBackgroundCover(ws.result.ctx, backgroundImage, w, h);
    ws.result.ctx.restore();
    ws.result.ctx.drawImage(ws.person.canvas, 0, 0, w, h);

    return ws.result.canvas;
}

// Used by the photo capture: full-size picture, or null if no background is selected or anything goes wrong.
// A null result means capture simply uses the normal camera picture.
function getBackgroundCompositeCanvas(video) {
    if (selectedBackgroundId === 'none' || !bgToolReady) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    try {
        return buildBackgroundComposite(bgCaptureWorkspace, video, w, h, true);
    } catch (error) {
        console.warn('Background could not be applied, using the normal photo:', error);
        return null;
    }
}

// =========================================================================
// Live preview: the visitor sees the background on the camera while posing
// =========================================================================
// A canvas is laid over the camera video. About 10 times a second, a small copy of the camera picture is
// made, the background is swapped in, and the result is drawn on that canvas. The photo itself is still
// made from the full-size video, so the preview only has to be good enough to pose with.
const BG_PREVIEW_WIDTH = 480;             // preview picture width in pixels (smaller = faster)
const BG_PREVIEW_INTERVAL_MS = 100;       // at most one preview picture every 100 ms (about 10 per second)

let bgPreviewRunning = false;
let bgPreviewLastTime = 0;
let bgPreviewInterval = BG_PREVIEW_INTERVAL_MS;
let bgPreviewUseHands = true;
let bgPreviewSlowFrames = 0;
let bgPreviewErrors = 0;
let bgPreviewCanvas = null;
let bgPreviewCanvasCtx = null;
let bgPreviewScratch = null;
let bgPreviewScratchCtx = null;

function getBackgroundPreviewCanvas() {
    if (bgPreviewCanvas && bgPreviewCanvas.isConnected) return bgPreviewCanvas;
    const video = document.getElementById('video');
    if (!video || !video.parentElement) return null;

    const canvas = document.createElement('canvas');
    canvas.id = 'background-preview-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    // Same size and crop as the video, under the face-filter canvas (z-index 6) and over the video
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:5;pointer-events:none;display:none;';
    video.insertAdjacentElement('afterend', canvas);
    bgPreviewCanvas = canvas;
    bgPreviewCanvasCtx = canvas.getContext('2d');
    return canvas;
}

function hideBackgroundPreview() {
    if (bgPreviewCanvas) bgPreviewCanvas.style.display = 'none';
}

function startBackgroundPreview() {
    if (bgPreviewRunning) return;
    bgPreviewRunning = true;
    bgPreviewInterval = BG_PREVIEW_INTERVAL_MS;
    bgPreviewUseHands = true;
    bgPreviewSlowFrames = 0;
    bgPreviewErrors = 0;
    requestAnimationFrame(backgroundPreviewTick);
}

function stopBackgroundPreview() {
    bgPreviewRunning = false;
    hideBackgroundPreview();
}

// If the preview is too slow for this device, make it lighter step by step instead of freezing the page
function adaptBackgroundPreviewSpeed(frameMs) {
    bgPreviewSlowFrames = frameMs > 160 ? bgPreviewSlowFrames + 1 : Math.max(0, bgPreviewSlowFrames - 1);
    if (bgPreviewSlowFrames < 8) return;
    bgPreviewSlowFrames = 0;
    if (bgPreviewUseHands) {
        bgPreviewUseHands = false;               // step 1: skip the hand model in the preview (the photo still uses it)
        console.info('Background preview: slow device, hand protection turned off in the preview only.');
    } else if (bgPreviewInterval < 300) {
        bgPreviewInterval = 300;                 // step 2: fewer preview pictures per second
        console.info('Background preview: slow device, preview slowed down.');
    }
}

function backgroundPreviewTick(now) {
    if (!bgPreviewRunning) return;
    if (selectedBackgroundId === 'none') { stopBackgroundPreview(); return; }
    requestAnimationFrame(backgroundPreviewTick);
    if (now - bgPreviewLastTime < bgPreviewInterval) return;
    bgPreviewLastTime = now;

    // Only draw while the camera is really running and visible. Otherwise show nothing and wait.
    const video = document.getElementById('video');
    const cameraRunning = bgToolReady && video && video.srcObject && !video.paused
        && video.readyState >= 2 && video.videoWidth > 0 && video.offsetParent !== null;
    const canvas = getBackgroundPreviewCanvas();
    if (!cameraRunning || !canvas) { hideBackgroundPreview(); return; }

    try {
        const started = performance.now();
        const previewWidth = BG_PREVIEW_WIDTH;
        const previewHeight = Math.round(previewWidth * video.videoHeight / video.videoWidth);

        if (!bgPreviewScratch) {
            bgPreviewScratch = document.createElement('canvas');
            bgPreviewScratchCtx = bgPreviewScratch.getContext('2d');
        }
        if (bgPreviewScratch.width !== previewWidth || bgPreviewScratch.height !== previewHeight) {
            bgPreviewScratch.width = previewWidth;
            bgPreviewScratch.height = previewHeight;
        }
        bgPreviewScratchCtx.drawImage(video, 0, 0, previewWidth, previewHeight);

        if (!bgPreviewWorkspace) bgPreviewWorkspace = createBackgroundWorkspace();
        const picture = buildBackgroundComposite(bgPreviewWorkspace, bgPreviewScratch, previewWidth, previewHeight, bgPreviewUseHands);
        if (!picture) { hideBackgroundPreview(); return; }

        if (canvas.width !== previewWidth || canvas.height !== previewHeight) {
            canvas.width = previewWidth;
            canvas.height = previewHeight;
        }
        bgPreviewCanvasCtx.drawImage(picture, 0, 0);
        // Follow the Mirror View button, the same way the video does
        canvas.style.transform = (typeof isMirrored !== 'undefined' && isMirrored) ? 'scaleX(-1)' : 'none';
        canvas.style.display = 'block';

        bgPreviewErrors = 0;
        adaptBackgroundPreviewSpeed(performance.now() - started);
    } catch (error) {
        bgPreviewErrors++;
        hideBackgroundPreview();               // fall back to the plain camera picture
        console.warn('Background preview problem:', error);
        if (bgPreviewErrors >= 3) {
            bgPreviewRunning = false;          // give up on the preview; the photo still gets its background
            console.warn('Background preview stopped after repeated problems.');
        }
    }
}
