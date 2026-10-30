// Feedback (kiosk) page script, split from the former feedback.js by section (move only, nothing changed inside).
// File 6 of 17: face landmarks, filter drawing, filter selector, face-gated capture, landing QR. Owner: Role 1.
// Load order (classic scripts, one shared global scope): core, bear, lostFound, flowPages, faceDetect, faceFilters, init, inactivity, questions, submit, photo, overlays, navigation, backNavigation, events, config, language.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: Nick (15)   <- counted from the "DONE BY" style markers below
// Current team owner: Role 1, Zihan. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
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
    const noseTip = getLandmarkPoint(landmarks, 1, width, height);
    const upperLip = getLandmarkPoint(landmarks, 13, width, height);
    const forehead = getLandmarkPoint(landmarks, 10, width, height);
    const chin = getLandmarkPoint(landmarks, 152, width, height);
    const leftCheek = getLandmarkPoint(landmarks, 234, width, height);
    const rightCheek = getLandmarkPoint(landmarks, 454, width, height);

    if (!leftEyeOuter || !rightEyeOuter || !noseTip) {
        return null;
    }

    const eyeCenter = {
        x: (leftEyeOuter.x + rightEyeOuter.x) / 2,
        y: (leftEyeOuter.y + rightEyeOuter.y) / 2
    };
    const eyeDistance = Math.hypot(rightEyeOuter.x - leftEyeOuter.x, rightEyeOuter.y - leftEyeOuter.y);
    const angle = Math.atan2(rightEyeOuter.y - leftEyeOuter.y, rightEyeOuter.x - leftEyeOuter.x);
    const faceHeight = forehead && chin ? Math.max(eyeDistance * 1.9, Math.abs(chin.y - forehead.y)) : eyeDistance * 2.2;

    return {
        angle,
        eyeCenter,
        eyeDistance,
        faceHeight,
        noseTip,
        upperLip: upperLip || { x: noseTip.x, y: noseTip.y + eyeDistance * 0.35 },
        forehead: forehead || { x: eyeCenter.x, y: eyeCenter.y - eyeDistance * 0.85 },
        leftCheek: leftCheek || { x: eyeCenter.x - eyeDistance * 0.48, y: noseTip.y + eyeDistance * 0.2 },
        rightCheek: rightCheek || { x: eyeCenter.x + eyeDistance * 0.48, y: noseTip.y + eyeDistance * 0.2 }
    };
}

function withAccessoryTransform(ctx, center, angle, drawFn) {
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angle);
    drawFn();
    ctx.restore();
}

function drawGlassesAccessory(ctx, geometry) { // black round spectacles - changes made by nick
    const lensRadius = geometry.eyeDistance * 0.27;
    const lensOffset = geometry.eyeDistance * 0.34;
    const center = {
        x: geometry.eyeCenter.x,
        y: geometry.eyeCenter.y + geometry.eyeDistance * 0.03
    };

    withAccessoryTransform(ctx, center, geometry.angle, () => {
        ctx.lineWidth = Math.max(8, geometry.eyeDistance * 0.085);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#111827';

        ctx.beginPath();
        ctx.arc(-lensOffset, 0, lensRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(lensOffset, 0, lensRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = Math.max(7, geometry.eyeDistance * 0.07);
        ctx.beginPath();
        ctx.moveTo(-lensOffset + lensRadius * 0.86, -lensRadius * 0.06);
        ctx.quadraticCurveTo(0, -lensRadius * 0.34, lensOffset - lensRadius * 0.86, -lensRadius * 0.06);
        ctx.stroke();

        ctx.lineWidth = Math.max(6, geometry.eyeDistance * 0.055);
        ctx.strokeStyle = 'rgba(17, 24, 39, 0.78)';
        ctx.beginPath();
        ctx.moveTo(-lensOffset - lensRadius * 0.92, -lensRadius * 0.18);
        ctx.quadraticCurveTo(-lensOffset - lensRadius * 1.55, -lensRadius * 0.26, -lensOffset - lensRadius * 1.82, lensRadius * 0.34);
        ctx.moveTo(lensOffset + lensRadius * 0.92, -lensRadius * 0.18);
        ctx.quadraticCurveTo(lensOffset + lensRadius * 1.55, -lensRadius * 0.26, lensOffset + lensRadius * 1.82, lensRadius * 0.34);
        ctx.stroke();
    });
}

function drawSparkleGlassesAccessory(ctx, geometry, time) { // changes made by nick
    drawGlassesAccessory(ctx, geometry);
    const sparkleCenter = {
        x: geometry.eyeCenter.x + Math.cos(geometry.angle) * geometry.eyeDistance * 0.54,
        y: geometry.eyeCenter.y + Math.sin(geometry.angle) * geometry.eyeDistance * 0.54 - geometry.eyeDistance * 0.16
    };
    const pulse = 0.78 + Math.sin(time / 180) * 0.22;

    withAccessoryTransform(ctx, sparkleCenter, geometry.angle + time / 520, () => {
        ctx.fillStyle = `rgba(250, 204, 21, ${0.74 + pulse * 0.22})`;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.lineWidth = Math.max(2, geometry.eyeDistance * 0.018);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const radius = (i % 2 === 0 ? geometry.eyeDistance * 0.16 : geometry.eyeDistance * 0.055) * pulse;
            const angle = (Math.PI * 2 * i) / 8;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });
}

function drawMoustacheAccessory(ctx, geometry) {
    const width = geometry.eyeDistance * 0.84;
    const height = geometry.eyeDistance * 0.23;
    const center = {
        x: geometry.noseTip.x,
        y: geometry.upperLip.y + geometry.eyeDistance * 0.1
    };

    withAccessoryTransform(ctx, center, geometry.angle, () => {
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-width * 0.2, -height, -width * 0.48, -height * 0.65, -width * 0.5, height * 0.12);
        ctx.bezierCurveTo(-width * 0.35, height * 0.35, -width * 0.15, height * 0.18, 0, height * 0.04);
        ctx.bezierCurveTo(width * 0.15, height * 0.18, width * 0.35, height * 0.35, width * 0.5, height * 0.12);
        ctx.bezierCurveTo(width * 0.48, -height * 0.65, width * 0.2, -height, 0, 0);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.beginPath();
        ctx.ellipse(-width * 0.2, -height * 0.12, width * 0.13, height * 0.1, -0.35, 0, Math.PI * 2);
        ctx.ellipse(width * 0.2, -height * 0.12, width * 0.13, height * 0.1, 0.35, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawHatAccessory(ctx, geometry) {
    const brimWidth = geometry.eyeDistance * 1.42;
    const brimHeight = geometry.eyeDistance * 0.18;
    const crownWidth = geometry.eyeDistance * 0.88;
    const crownHeight = geometry.faceHeight * 0.3;
    const center = {
        x: geometry.forehead.x,
        y: geometry.forehead.y - geometry.eyeDistance * 0.34
    };

    withAccessoryTransform(ctx, center, geometry.angle, () => {
        ctx.fillStyle = '#111827';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = Math.max(2, geometry.eyeDistance * 0.025);

        ctx.beginPath();
        ctx.roundRect(-crownWidth / 2, -crownHeight, crownWidth, crownHeight, crownWidth * 0.08);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#4f46e5';
        ctx.fillRect(-crownWidth / 2, -crownHeight * 0.28, crownWidth, crownHeight * 0.14);

        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.ellipse(0, 0, brimWidth / 2, brimHeight / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });
}

function drawFlowerCrownAccessory(ctx, geometry, time) { // changes made by nick
    const flowerCount = 7;
    const center = {
        x: geometry.forehead.x,
        y: geometry.forehead.y - geometry.eyeDistance * 0.28
    };
    const colors = ['#fb7185', '#facc15', '#a78bfa', '#34d399', '#f472b6'];

    withAccessoryTransform(ctx, center, geometry.angle, () => {
        for (let i = 0; i < flowerCount; i++) {
            const progress = flowerCount === 1 ? 0 : i / (flowerCount - 1);
            const x = (progress - 0.5) * geometry.eyeDistance * 1.22;
            const arch = Math.sin(progress * Math.PI) * geometry.eyeDistance * 0.16;
            const y = -arch + Math.sin(time / 360 + i) * geometry.eyeDistance * 0.018;
            const radius = geometry.eyeDistance * (0.08 + (i % 2) * 0.015);

            ctx.fillStyle = colors[i % colors.length];
            for (let petal = 0; petal < 5; petal++) {
                const angle = (Math.PI * 2 * petal) / 5;
                ctx.beginPath();
                ctx.ellipse(
                    x + Math.cos(angle) * radius * 0.78,
                    y + Math.sin(angle) * radius * 0.78,
                    radius * 0.58,
                    radius * 0.38,
                    angle,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }

            ctx.fillStyle = '#fef3c7';
            ctx.beginPath();
            ctx.arc(x, y, radius * 0.38, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function drawHaloAccessory(ctx, geometry, time) { // changes made by nick
    const center = {
        x: geometry.forehead.x,
        y: geometry.forehead.y - geometry.eyeDistance * (0.62 + Math.sin(time / 430) * 0.04)
    };

    withAccessoryTransform(ctx, center, geometry.angle, () => {
        ctx.lineWidth = Math.max(5, geometry.eyeDistance * 0.06);
        ctx.strokeStyle = '#facc15';
        ctx.shadowColor = 'rgba(250, 204, 21, 0.82)';
        ctx.shadowBlur = geometry.eyeDistance * 0.18;
        ctx.beginPath();
        ctx.ellipse(0, 0, geometry.eyeDistance * 0.52, geometry.eyeDistance * 0.14, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    });
}

function drawBlushAccessory(ctx, geometry, time) { // changes made by nick
    const alpha = 0.38 + Math.sin(time / 420) * 0.08;
    const cheekRadiusX = geometry.eyeDistance * 0.18;
    const cheekRadiusY = geometry.eyeDistance * 0.1;
    const cheeks = [
        { point: geometry.leftCheek, offset: -geometry.eyeDistance * 0.04 },
        { point: geometry.rightCheek, offset: geometry.eyeDistance * 0.04 }
    ];

    cheeks.forEach(({ point, offset }) => {
        withAccessoryTransform(ctx, { x: point.x, y: point.y + offset }, geometry.angle, () => {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, cheekRadiusX);
            gradient.addColorStop(0, `rgba(244, 114, 182, ${alpha})`);
            gradient.addColorStop(1, 'rgba(244, 114, 182, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.ellipse(0, 0, cheekRadiusX, cheekRadiusY, 0, 0, Math.PI * 2);
            ctx.fill();
        });
    });
}

function drawPartyAccessory(ctx, geometry, time) { // changes made by nick
    const center = {
        x: geometry.forehead.x,
        y: geometry.forehead.y - geometry.eyeDistance * 0.42
    };
    const wiggle = Math.sin(time / 180) * 0.1;

    withAccessoryTransform(ctx, center, geometry.angle + wiggle, () => {
        const hatHeight = geometry.eyeDistance * 0.78;
        const hatWidth = geometry.eyeDistance * 0.48;
        const gradient = ctx.createLinearGradient(0, -hatHeight, 0, 0);
        gradient.addColorStop(0, '#60a5fa');
        gradient.addColorStop(0.5, '#f472b6');
        gradient.addColorStop(1, '#22c55e');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, -hatHeight);
        ctx.lineTo(hatWidth / 2, 0);
        ctx.lineTo(-hatWidth / 2, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.lineWidth = Math.max(2, geometry.eyeDistance * 0.025);
        for (let i = 1; i <= 3; i++) {
            const y = -hatHeight + (hatHeight * i) / 4;
            ctx.beginPath();
            ctx.moveTo(-hatWidth * 0.28, y);
            ctx.lineTo(hatWidth * 0.28, y + geometry.eyeDistance * 0.08);
            ctx.stroke();
        }

        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, -hatHeight, geometry.eyeDistance * 0.1, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawRpShadesAccessory(ctx, geometry) { // RP shades face filter (DONE BY NICK)
    const lensWidth = geometry.eyeDistance * 0.42;
    const lensHeight = geometry.eyeDistance * 0.26;
    const lensOffset = geometry.eyeDistance * 0.33;
    const center = {
        x: geometry.eyeCenter.x,
        y: geometry.eyeCenter.y + geometry.eyeDistance * 0.04
    };

    withAccessoryTransform(ctx, center, geometry.angle, () => {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#0f766e';
        ctx.lineWidth = Math.max(4, geometry.eyeDistance * 0.04);

        [-lensOffset, lensOffset].forEach((x) => {
            ctx.beginPath();
            ctx.roundRect(x - lensWidth / 2, -lensHeight / 2, lensWidth, lensHeight, lensHeight * 0.28);
            ctx.fill();
            ctx.stroke();
        });

        ctx.beginPath();
        ctx.moveTo(-lensOffset + lensWidth / 2, -lensHeight * 0.08);
        ctx.lineTo(lensOffset - lensWidth / 2, -lensHeight * 0.08);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${Math.max(12, geometry.eyeDistance * 0.12)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('RP', 0, 0);
    });
}

function drawLeafCrownAccessory(ctx, geometry, time) { // ESG leaf crown face filter (DONE BY NICK)
    const center = {
        x: geometry.forehead.x,
        y: geometry.forehead.y - geometry.eyeDistance * 0.32
    };

    withAccessoryTransform(ctx, center, geometry.angle, () => {
        for (let i = 0; i < 9; i++) {
            const progress = i / 8;
            const x = (progress - 0.5) * geometry.eyeDistance * 1.36;
            const y = -Math.sin(progress * Math.PI) * geometry.eyeDistance * 0.2 + Math.sin(time / 400 + i) * geometry.eyeDistance * 0.02;
            const rotation = (progress - 0.5) * 0.7;
            const leafWidth = geometry.eyeDistance * 0.16;
            const leafHeight = geometry.eyeDistance * 0.28;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.fillStyle = i % 2 === 0 ? '#16a34a' : '#34d399';
            ctx.beginPath();
            ctx.ellipse(0, 0, leafWidth / 2, leafHeight / 2, -0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = Math.max(1, geometry.eyeDistance * 0.012);
            ctx.beginPath();
            ctx.moveTo(0, -leafHeight * 0.36);
            ctx.lineTo(0, leafHeight * 0.36);
            ctx.stroke();
            ctx.restore();
        }
    });
}

function drawGraduationAccessory(ctx, geometry, time) { // Graduation cap face filter (DONE BY NICK)
    const center = {
        x: geometry.forehead.x,
        y: geometry.forehead.y - geometry.eyeDistance * 0.42
    };

    withAccessoryTransform(ctx, center, geometry.angle, () => {
        const capWidth = geometry.eyeDistance * 1.22;
        const capHeight = geometry.eyeDistance * 0.34;
        ctx.fillStyle = '#111827';
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = Math.max(2, geometry.eyeDistance * 0.02);

        ctx.beginPath();
        ctx.moveTo(0, -capHeight * 0.62);
        ctx.lineTo(capWidth / 2, -capHeight * 0.08);
        ctx.lineTo(0, capHeight * 0.48);
        ctx.lineTo(-capWidth / 2, -capHeight * 0.08);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f766e';
        ctx.fillRect(-capWidth * 0.24, capHeight * 0.04, capWidth * 0.48, capHeight * 0.32);

        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = Math.max(2, geometry.eyeDistance * 0.018);
        ctx.beginPath();
        ctx.moveTo(capWidth * 0.08, -capHeight * 0.14);
        ctx.quadraticCurveTo(capWidth * 0.28, capHeight * 0.18, capWidth * 0.25, capHeight * (0.7 + Math.sin(time / 260) * 0.08));
        ctx.stroke();

        ctx.fillStyle = '#facc15';
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

    if (selectedFaceAccessory === 'glasses') {
        drawGlassesAccessory(ctx, geometry);
    } else if (selectedFaceAccessory === 'sparkle-glasses') {
        drawSparkleGlassesAccessory(ctx, geometry, time);
    } else if (selectedFaceAccessory === 'moustache') {
        drawMoustacheAccessory(ctx, geometry);
    } else if (selectedFaceAccessory === 'hat') {
        drawHatAccessory(ctx, geometry);
    } else if (selectedFaceAccessory === 'flower-crown') {
        drawFlowerCrownAccessory(ctx, geometry, time);
    } else if (selectedFaceAccessory === 'halo') {
        drawHaloAccessory(ctx, geometry, time);
    } else if (selectedFaceAccessory === 'blush') {
        drawBlushAccessory(ctx, geometry, time);
    } else if (selectedFaceAccessory === 'party') {
        drawPartyAccessory(ctx, geometry, time);
    } else if (selectedFaceAccessory === 'rp-shades') {
        drawRpShadesAccessory(ctx, geometry);
    } else if (selectedFaceAccessory === 'leaf-crown') {
        drawLeafCrownAccessory(ctx, geometry, time);
    } else if (selectedFaceAccessory === 'graduation') {
        drawGraduationAccessory(ctx, geometry, time);
    }
}

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


