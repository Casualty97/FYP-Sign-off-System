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

function drawRpGraduationGown(ctx, geometry) {
    const { chin, faceHeight, angle } = geometry;
    // Keep the neckline below the chin and use a smaller tilt for the shoulders.
    withAccessoryTransform(ctx, chin, angle * 0.3, () => {
        ctx.scale(faceHeight, faceHeight);
        const fabric = ctx.createLinearGradient(-0.9, 0, 0.9, 0);
        fabric.addColorStop(0, '#292e39');
        fabric.addColorStop(0.47, '#141820');
        fabric.addColorStop(1, '#252a34');

        ctx.beginPath();
        ctx.moveTo(-0.23, 0.15);
        ctx.bezierCurveTo(-0.43, 0.12, -0.75, 0.24, -0.89, 0.46);
        ctx.quadraticCurveTo(-1.02, 0.70, -1.07, 1.36);
        ctx.lineTo(1.07, 1.36);
        ctx.quadraticCurveTo(1.02, 0.70, 0.89, 0.46);
        ctx.bezierCurveTo(0.75, 0.24, 0.43, 0.12, 0.23, 0.15);
        ctx.quadraticCurveTo(0, 0.49, -0.23, 0.15);
        ctx.closePath();
        ctx.fillStyle = fabric;
        ctx.fill();

        ctx.strokeStyle = '#373d49';
        ctx.lineWidth = 0.017;
        ctx.beginPath();
        ctx.moveTo(-0.77, 0.52);
        ctx.quadraticCurveTo(-0.64, 0.83, -0.71, 1.35);
        ctx.moveTo(0.77, 0.52);
        ctx.quadraticCurveTo(0.64, 0.83, 0.71, 1.35);
        ctx.stroke();

        const hood = ctx.createLinearGradient(0, 0.13, 0, 0.61);
        hood.addColorStop(0, '#99dc81');
        hood.addColorStop(1, '#46a65c');
        ctx.beginPath();
        ctx.moveTo(-0.23, 0.15);
        ctx.bezierCurveTo(-0.42, 0.12, -0.57, 0.18, -0.67, 0.25);
        ctx.quadraticCurveTo(-0.37, 0.30, 0, 0.60);
        ctx.quadraticCurveTo(0.37, 0.30, 0.67, 0.25);
        ctx.bezierCurveTo(0.57, 0.18, 0.42, 0.12, 0.23, 0.15);
        ctx.quadraticCurveTo(0, 0.49, -0.23, 0.15);
        ctx.closePath();
        ctx.fillStyle = hood;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-0.74, 0.33);
        ctx.quadraticCurveTo(-0.45, 0.32, 0, 0.68);
        ctx.quadraticCurveTo(0.45, 0.32, 0.74, 0.33);
        ctx.strokeStyle = '#ed549c';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 0.029;
        ctx.stroke();
    });
}

function drawGraduationAccessory(ctx, geometry, time) { // Graduation cap face filter (DONE BY NICK)
    const center = {
        x: geometry.forehead.x,
        y: geometry.forehead.y - geometry.eyeDistance * 0.42
    };

    withAccessoryTransform(ctx, center, geometry.angle, () => {
        const capWidth = geometry.eyeDistance * 1.55;
        const capHeight = geometry.eyeDistance * 0.34;
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
        ctx.translate(0, 0.17);
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

const FACE_ACCESSORY_RENDERERS = {
    'rp-gown': drawRpGraduationGown,
    graduation: drawGraduationAccessory,
    'rp-tie': drawPhotoTie,
    'rp-bear': drawShoulderBear
};

function drawFaceAccessoryForCameraView(ctx, landmarks, width, height) {
    ctx.save();
    if (isMirrored) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
    }
    drawFaceAccessory(ctx, landmarks, width, height, performance.now());
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

        if (selectedFaceAccessory !== 'none') {
            if (video.currentTime !== latestFaceAccessoryVideoTime) {
                latestFaceAccessoryLandmarks = detectFaceAccessoryLandmarks(video);
                latestFaceAccessoryVideoTime = video.currentTime;
            }
            drawFaceAccessoryForCameraView(ctx, latestFaceAccessoryLandmarks, canvas.width, canvas.height);
        }
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
        await ensureFaceLandmarkerReady();
        renderLiveFaceAccessory();
    } catch (error) {
        console.warn('Face accessory preview disabled:', error.message);
    }
}

function stopFaceAccessoryPreview() {
    if (faceAccessoryAnimationFrame) {
        cancelAnimationFrame(faceAccessoryAnimationFrame);
        faceAccessoryAnimationFrame = null;
    }
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
            FACE_ACCESSORY_RENDERERS[button.dataset.accessory]?.(context, {
                eyeDistance: 42,
                faceHeight: button.dataset.accessory === 'rp-gown' ? 36 : 56,
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


