// Owner: Role 1, Zihan. Previous team: Nick (15).
// Part 6/17 of the feedback page: face landmarks, filter drawing, filter selector, face-gated capture, landing QR (load order in feedback.html).
async function ensureFaceLandmarkerReady() {
    if (faceLandmarker) {
        return faceLandmarker;
    }

    if (faceLandmarkerLoadPromise) {
        return faceLandmarkerLoadPromise;
    }

    faceLandmarkerLoadPromise = import(MEDIAPIPE_TASKS_VISION_URL)
        .then(async ({ FaceLandmarker, FilesetResolver }) => {
            updateFaceDetectionStatus('Loading AR face effects...', 'loading');
            const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
            faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: FACE_LANDMARKER_MODEL_URL,
                    delegate: 'GPU'
                },
                runningMode: 'VIDEO',
                numFaces: 1,
                minFaceDetectionConfidence: 0.5,
                minFacePresenceConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            updateFaceDetectionStatus('Face detection ready.', 'success');
            return faceLandmarker;
        })
        .catch((error) => {
            console.error('Failed to load MediaPipe Face Landmarker:', error);
            updateFaceDetectionStatus('Face effects unavailable. Photo capture still works.', 'error');
            throw error;
        })
        .finally(() => {
            faceLandmarkerLoadPromise = null;
        });

    return faceLandmarkerLoadPromise;
}

function getFaceAccessoryLandmarksFromResult(result) {
    return result?.faceLandmarks?.[0] || result?.face_landmarks?.[0] || null;
}

function detectFaceAccessoryLandmarks(video) {
    if (!faceLandmarker || !video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        return null;
    }

    const result = faceLandmarker.detectForVideo(video, performance.now());
    return getFaceAccessoryLandmarksFromResult(result);
}

function clearFaceAccessoryCanvas() {
    const canvas = document.getElementById('face-accessory-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width || canvas.clientWidth, canvas.height || canvas.clientHeight);
}

function resizeFaceAccessoryCanvas(video, canvas) {
    if (!video || !canvas) return false;

    const width = video.videoWidth || canvas.clientWidth;
    const height = video.videoHeight || canvas.clientHeight;
    if (!width || !height) return false;

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    return true;
}

function getLandmarkPoint(landmarks, index, width, height) {
    const landmark = landmarks?.[index];
    if (!landmark) return null;

    return {
        x: landmark.x * width,
        y: landmark.y * height,
        z: landmark.z || 0
    };
}

function getFaceAccessoryGeometry(landmarks, width, height) {
    const leftEyeOuter = getLandmarkPoint(landmarks, 33, width, height);
    const rightEyeOuter = getLandmarkPoint(landmarks, 263, width, height);
    const leftIris = getLandmarkPoint(landmarks, 468, width, height);
    const rightIris = getLandmarkPoint(landmarks, 473, width, height);
    const leftEyeInner = getLandmarkPoint(landmarks, 133, width, height);
    const rightEyeInner = getLandmarkPoint(landmarks, 362, width, height);
    const noseTip = getLandmarkPoint(landmarks, 1, width, height);
    const forehead = getLandmarkPoint(landmarks, 10, width, height);
    const chin = getLandmarkPoint(landmarks, 152, width, height);

    if (!leftEyeOuter || !rightEyeOuter || !noseTip) {
        return null;
    }

    const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const leftEye = leftEyeInner ? midpoint(leftEyeOuter, leftEyeInner) : (leftIris || leftEyeOuter);
    const rightEye = rightEyeInner ? midpoint(rightEyeOuter, rightEyeInner) : (rightIris || rightEyeOuter);
    const eyeCenter = midpoint(leftEye, rightEye);
    const lensSpacing = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
    const eyeDistance = Math.hypot(rightEyeOuter.x - leftEyeOuter.x, rightEyeOuter.y - leftEyeOuter.y);
    if (!lensSpacing || !eyeDistance) return null;
    const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    const faceHeight = forehead && chin ? Math.hypot(chin.x - forehead.x, chin.y - forehead.y) : eyeDistance * 1.65;

    return {
        angle,
        eyeCenter,
        eyeDistance,
        faceHeight,
        forehead: forehead || { x: eyeCenter.x, y: eyeCenter.y - eyeDistance * 0.85 },
        chin: chin || { x: eyeCenter.x, y: eyeCenter.y + eyeDistance * 0.9 }
    };
}

function withAccessoryTransform(ctx, center, angle, drawFn) {
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angle);
    drawFn();
    ctx.restore();
}

function drawGraduationAccessory(ctx, geometry, time) { // Graduation cap face filter (DONE BY NICK)
    const center = {
        x: geometry.forehead.x,
        y: geometry.forehead.y - geometry.eyeDistance * 0.42
    };

    withAccessoryTransform(ctx, center, geometry.angle, () => {
        const capWidth = geometry.eyeDistance * 1.85;
        const capHeight = geometry.eyeDistance * 0.41;
        const top = ctx.createLinearGradient(0, -capHeight, 0, capHeight);
        top.addColorStop(0, '#475669');
        top.addColorStop(1, '#172434');

        ctx.fillStyle = '#182c38';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(-capWidth * 0.26, 0, capWidth * 0.52, capHeight * 0.72, capHeight * 0.22);
        } else {
            ctx.rect(-capWidth * 0.26, 0, capWidth * 0.52, capHeight * 0.72);
        }
        ctx.fill();

        ctx.fillStyle = top;
        ctx.strokeStyle = '#71828c';
        ctx.lineWidth = Math.max(2, geometry.eyeDistance * 0.02);

        ctx.beginPath();
        ctx.moveTo(0, -capHeight * 0.62);
        ctx.lineTo(capWidth / 2, -capHeight * 0.08);
        ctx.lineTo(0, capHeight * 0.48);
        ctx.lineTo(-capWidth / 2, -capHeight * 0.08);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#51ab8b';
        ctx.fillRect(-capWidth * 0.19, capHeight * 0.53, capWidth * 0.38, capHeight * 0.075);

        ctx.strokeStyle = '#efc574';
        ctx.lineWidth = Math.max(2, geometry.eyeDistance * 0.018);
        ctx.beginPath();
        ctx.moveTo(capWidth * 0.08, -capHeight * 0.14);
        ctx.quadraticCurveTo(capWidth * 0.28, capHeight * 0.18, capWidth * 0.25, capHeight * (0.7 + Math.sin(time / 260) * 0.08));
        ctx.stroke();

        ctx.fillStyle = '#efc574';
        ctx.beginPath();
        ctx.arc(capWidth * 0.25, capHeight * 0.72, geometry.eyeDistance * 0.045, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawFaceAccessory(ctx, landmarks, width, height, time = performance.now()) {
    if (selectedFaceAccessory === 'none' || !landmarks) {
        return;
    }

    const geometry = getFaceAccessoryGeometry(landmarks, width, height);
    if (!geometry) {
        return;
    }

    FACE_ACCESSORY_RENDERERS[selectedFaceAccessory]?.(ctx, geometry, time, width);
}

// The face landmarks stop at the chin, so the neck and shoulder positions are estimated.
function drawPhotoTie(ctx, geometry) {
    const size = geometry.faceHeight;
    withAccessoryTransform(ctx, geometry.chin, geometry.angle, () => {
        ctx.scale(size, size);
        ctx.translate(0, 0.28);
        ctx.fillStyle = '#125c47';
        ctx.beginPath();
        ctx.moveTo(-0.067, 0.08);
        ctx.lineTo(-0.13, 0.53);
        ctx.lineTo(0, 0.66);
        ctx.lineTo(0.13, 0.53);
        ctx.lineTo(0.067, 0.08);
        ctx.closePath();
        ctx.fill();

        ctx.save();
        ctx.clip();
        ctx.strokeStyle = '#81c7a1';
        ctx.lineWidth = 0.027;
        for (const y of [0.23, 0.36, 0.49]) {
            ctx.beginPath();
            ctx.moveTo(-0.14, y + 0.095);
            ctx.lineTo(0.14, y);
            ctx.stroke();
        }
        ctx.restore();

        ctx.fillStyle = '#217d60';
        ctx.beginPath();
        ctx.moveTo(-0.09, 0);
        ctx.lineTo(0.09, 0);
        ctx.lineTo(0.058, 0.13);
        ctx.lineTo(-0.058, 0.13);
        ctx.closePath();
        ctx.fill();
    });
}

function drawShoulderBear(ctx, geometry, _time, frameWidth = Infinity) {
    const size = geometry.faceHeight;
    const side = geometry.chin.x + size * 0.86 > frameWidth ? -1 : 1;
    const center = { x: geometry.chin.x + side * size * 0.64, y: geometry.chin.y + size * 0.1 };
    withAccessoryTransform(ctx, center, geometry.angle * 0.35, () => {
        ctx.scale(size, size);

        function oval(x, y, width, height, color) {
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.ellipse(x, y, width, height, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        oval(0, 0.095, 0.145, 0.15, '#212a33');
        for (const x of [-0.108, 0.108]) {
            oval(x, -0.205, 0.052, 0.052, '#ac724b');
            oval(x, -0.205, 0.028, 0.029, '#e5aa8b');
            oval(x * 0.82, 0.223, 0.064, 0.042, '#b77d55');
        }
        oval(0, -0.09, 0.145, 0.134, '#d5a478');
        oval(0, -0.049, 0.074, 0.052, '#f1c8a0');
        oval(-0.047, -0.12, 0.013, 0.017, '#282524');
        oval(0.047, -0.12, 0.013, 0.017, '#282524');
        oval(0, -0.066, 0.022, 0.013, '#482e27');
        ctx.strokeStyle = '#482e27';
        ctx.lineWidth = 0.008;
        ctx.beginPath();
        ctx.arc(0, -0.055, 0.024, 0.25, Math.PI - 0.25);
        ctx.stroke();

        ctx.fillStyle = '#74b797';
        ctx.beginPath();
        ctx.moveTo(-0.087, 0.028);
        ctx.lineTo(0, 0.1);
        ctx.lineTo(0.087, 0.028);
        ctx.lineTo(0.061, 0.092);
        ctx.lineTo(0, 0.132);
        ctx.lineTo(-0.061, 0.092);
        ctx.closePath();
        ctx.fill();
    });
}

const rpGestureLogo = new Image();
rpGestureLogo.src = '/assets/props/rp-gesture-logo.png';

function getRpGesturePlacement(landmarks, width, height) {
    const wrist = getLandmarkPoint(landmarks, 0, width, height);
    const middleKnuckle = getLandmarkPoint(landmarks, 9, width, height);
    if (!wrist || !middleKnuckle) return null;
    const palmSize = Math.hypot(middleKnuckle.x - wrist.x, middleKnuckle.y - wrist.y);
    const x = (wrist.x + middleKnuckle.x) / 2;
    const y = (wrist.y + middleKnuckle.y) / 2;
    if (palmSize < 8 || x < 0 || x >= width || y < 0 || y >= height) return null;

    const size = Math.min(Math.max(palmSize * 1.65, width * 0.07), Math.min(width, height) * 0.23);
    const side = x > width / 2 ? -1 : 1;
    const radius = size / 2;
    return {
        center: {
            x: Math.max(radius, Math.min(width - radius, x + side * (palmSize * 0.7 + radius))),
            y: Math.max(radius, Math.min(height - radius, y))
        },
        size,
        palmSize
    };
}

let rpGesturePlacement = null;
let rpGestureVideoTime = -Infinity;

function drawCameraAccessory(ctx, video, landmarks, width, height, capture = false) {
    if (selectedFaceAccessory !== 'rp-gesture') {
        drawFaceAccessory(ctx, landmarks, width, height);
        return;
    }
    if (!bgHandLandmarker || video.readyState < 2) return;
    const time = video.currentTime;
    if (capture || time < rpGestureVideoTime || time - rpGestureVideoTime >= 0.08) {
        rpGestureVideoTime = time;
        rpGesturePlacement = null;
        try {
            for (const hand of confidentBackgroundHands(bgHandLandmarker.detect(video))) {
                const placement = getRpGesturePlacement(hand, width, height);
                if (placement && (!rpGesturePlacement || placement.palmSize > rpGesturePlacement.palmSize)) {
                    rpGesturePlacement = placement;
                }
            }
        } catch (error) {
            console.warn('RP logo hand tracking failed:', error.message);
        }
    }
    if (rpGesturePlacement) drawRpGestureLogo(ctx, rpGesturePlacement, isMirrored);
}

function drawRpGestureLogo(ctx, { center, size }, mirrored = false) {
    if (!rpGestureLogo.naturalWidth) return;
    withAccessoryTransform(ctx, center, 0, () => {
        if (mirrored) ctx.scale(-1, 1);
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(rpGestureLogo, -size / 2, -size / 2, size, size);
    });
}

const FACE_ACCESSORY_RENDERERS = {
    graduation: drawGraduationAccessory,
    'rp-tie': drawPhotoTie,
    'rp-bear': drawShoulderBear
};

function drawFaceAccessoryForCameraView(ctx, video, landmarks, width, height) {
    ctx.save();
    if (isMirrored) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
    }
    drawCameraAccessory(ctx, video, landmarks, width, height);
    ctx.restore();
}

function renderLiveFaceAccessory() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('face-accessory-canvas');
    if (!video || !canvas || !stream) {
        clearFaceAccessoryCanvas();
        faceAccessoryAnimationFrame = null;
        return;
    }

    if (resizeFaceAccessoryCanvas(video, canvas)) {
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (selectedFaceAccessory !== 'none' && selectedFaceAccessory !== 'rp-gesture') {
            if (video.currentTime !== latestFaceAccessoryVideoTime) {
                latestFaceAccessoryLandmarks = detectFaceAccessoryLandmarks(video);
                latestFaceAccessoryVideoTime = video.currentTime;
            }
        }
        drawFaceAccessoryForCameraView(ctx, video, latestFaceAccessoryLandmarks, canvas.width, canvas.height);
    }

    faceAccessoryAnimationFrame = requestAnimationFrame(renderLiveFaceAccessory);
}

async function startFaceAccessoryPreview() {
    stopFaceAccessoryPreview();
    clearFaceAccessoryCanvas();

    if (selectedFaceAccessory === 'none') {
        return;
    }

    try {
        if (selectedFaceAccessory === 'rp-gesture') {
            const tracker = await ensureHandLandmarkerReady();
            if (selectedFaceAccessory !== 'rp-gesture' || !stream) return;
            if (!tracker) {
                document.getElementById('rp-gesture-hint').textContent = 'Hand tracking is unavailable. Try selecting RP Hand Sign again.';
                return;
            }
        } else {
            await ensureFaceLandmarkerReady();
        }
        if (!faceAccessoryAnimationFrame && stream) renderLiveFaceAccessory();
    } catch (error) {
        console.warn('Face accessory preview disabled:', error.message);
    }
}

function stopFaceAccessoryPreview() {
    if (faceAccessoryAnimationFrame) {
        cancelAnimationFrame(faceAccessoryAnimationFrame);
        faceAccessoryAnimationFrame = null;
    }
    rpGesturePlacement = null;
    rpGestureVideoTime = -Infinity;
    latestFaceAccessoryLandmarks = null;
    latestFaceAccessoryVideoTime = -1;
    clearFaceAccessoryCanvas();
}

function updateFaceAccessoryButtons() {
    document.querySelectorAll('.face-filter-card').forEach((button) => {
        const isActive = button.dataset.accessory === selectedFaceAccessory;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const hint = document.getElementById('rp-gesture-hint');
    if (hint) {
        hint.hidden = selectedFaceAccessory !== 'rp-gesture';
        hint.textContent = hint.hidden ? '' : 'Show a peace sign, a heart, or another hand pose to bring up the RP logo.';
    }
    const activeLabel = document.getElementById('face-filter-active');
    const option = FACE_ACCESSORY_OPTIONS.find(item => item.id === selectedFaceAccessory);
    if (activeLabel && option) {
        activeLabel.textContent = option.label;
    }
}

function scrollSelectedFaceFilterIntoView(behavior = 'smooth') { // changes made by nick
    const selectedButton = document.querySelector(`.face-filter-card[data-accessory="${selectedFaceAccessory}"]`);
    if (selectedButton) {
        selectedButton.scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
    }
}

function selectFaceAccessory(accessory, shouldScroll = true) {
    if (!FACE_ACCESSORY_IDS.includes(accessory)) {
        return;
    }

    selectedFaceAccessory = accessory;
    userData.selectedFaceAccessory = accessory; // Store face filter choice for Nick analytics (DONE BY NICK)
    updateFaceAccessoryButtons();
    if (shouldScroll) {
        scrollSelectedFaceFilterIntoView();
    }
    if (stream) {
        startFaceAccessoryPreview();
    } else {
        clearFaceAccessoryCanvas();
    }
    resetInactivityTimer();
}

function getCenteredFaceFilterAccessory() { // changes made by nick
    const selector = document.getElementById('face-filter-selector');
    if (!selector) {
        return selectedFaceAccessory;
    }

    const selectorBox = selector.getBoundingClientRect();
    const centerX = selectorBox.left + selectorBox.width / 2;
    let nearest = null;
    let nearestDistance = Infinity;

    selector.querySelectorAll('.face-filter-card').forEach((button) => {
        const box = button.getBoundingClientRect();
        const distance = Math.abs((box.left + box.width / 2) - centerX);
        if (distance < nearestDistance) {
            nearest = button;
            nearestDistance = distance;
        }
    });

    return nearest?.dataset.accessory || selectedFaceAccessory;
}

function setupFaceAccessorySelector() { // swipeable filter selector - changes made by nick
    const selector = document.getElementById('face-filter-selector');

    document.querySelectorAll('.face-filter-card').forEach((button) => {
        const preview = button.querySelector('canvas');
        const context = preview?.getContext('2d');
        if (context) {
            context.clearRect(0, 0, preview.width, preview.height);
            if (button.dataset.accessory === 'rp-gesture') {
                const drawThumbnail = () => drawRpGestureLogo(context, { center: { x: 48, y: 28 }, size: 52 });
                if (rpGestureLogo.complete) drawThumbnail();
                else rpGestureLogo.addEventListener('load', drawThumbnail, { once: true });
            }
            FACE_ACCESSORY_RENDERERS[button.dataset.accessory]?.(context, {
                eyeDistance: 42,
                faceHeight: 56,
                chin: { x: button.dataset.accessory === 'rp-bear' ? 12 : 48, y: 5 },
                eyeCenter: { x: 48, y: 29 },
                forehead: { x: 48, y: 46 },
                angle: 0
            }, 0);
        }

        button.addEventListener('click', () => {
            selectFaceAccessory(button.dataset.accessory || 'none');
        });
    });

    if (selector) {
        selector.addEventListener('scroll', () => {
            if (faceFilterScrollTimer) {
                clearTimeout(faceFilterScrollTimer);
            }

            faceFilterScrollTimer = setTimeout(() => {
                const centeredAccessory = getCenteredFaceFilterAccessory();
                if (centeredAccessory !== selectedFaceAccessory) {
                    selectFaceAccessory(centeredAccessory, false);
                }
            }, 120);
        }, { passive: true });
    }

    updateFaceAccessoryButtons();
    requestAnimationFrame(() => scrollSelectedFaceFilterIntoView('auto'));
}

async function getCurrentFaceAccessoryLandmarks() {
    if (selectedFaceAccessory === 'rp-gesture') {
        await ensureHandLandmarkerReady();
        return null;
    }

    if (selectedFaceAccessory === 'none') {
        return null;
    }

    const video = document.getElementById('video');
    if (!video) {
        return null;
    }

    try {
        await ensureFaceLandmarkerReady();
        latestFaceAccessoryLandmarks = detectFaceAccessoryLandmarks(video) || latestFaceAccessoryLandmarks;
        return latestFaceAccessoryLandmarks;
    } catch (error) {
        console.warn('Unable to detect landmarks for selected face accessory:', error.message);
        return null;
    }
}

async function capturePhotoIfFaceDetected() {
    try {
        updateFaceDetectionStatus('Checking for face...', 'loading');

        const faceDetection = await detectFaceInCurrentFrame(); // reuse face box for slimming filter done by nick
        if (!faceDetection) {
            updateFaceDetectionStatus('No face detected. Position your face in frame and try again.', 'error');
            showVisitorNotice('photo-form-alert', 'No face detected. Please position your face clearly in the camera frame and capture again.', 'I could not see a face clearly. Move into the frame and try again.');
            return false;
        }

        updateFaceDetectionStatus('Face detected. Capturing photo...', 'success');
        const faceAccessoryLandmarks = await getCurrentFaceAccessoryLandmarks();
        await takePhoto(faceDetection, faceAccessoryLandmarks); // pass face box into beauty filter done by nick
        return true;
    } catch (error) {
        console.error('Face detection check failed:', error);
        updateFaceDetectionStatus('Face detection failed. Please try again.', 'error');
        showVisitorNotice('photo-form-alert', `Face detection failed: ${error.message}`, 'The face check had trouble. Try again with brighter lighting.');
        return false;
    }
}


