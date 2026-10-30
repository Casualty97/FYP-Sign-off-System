// Owner: Role 1, Zihan. Previous team: Nick (56), Yu Kang (5).
// Part 11/17 of the feedback page: camera, capture, boomerang, beauty filter, saving photos (load order in feedback.html).
// ==================== 6. PHOTO HANDLING FUNCTIONS ====================

// Handle photo upload from file input (mobile) - with face detection validation (Done by Yu Kang)
async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    const rules = getValidationRules();
    const allowedFormats = rules.allowedPhotoFormats || ['jpeg', 'jpg', 'png', 'webp'];
    const maxPhotoFileSizeMb = Number(rules.maxPhotoFileSizeMb) || 5;

    if (!file) {
        return;
    }

    // Validate it's an image file
    const fileExtension = (file.name.split('.').pop() || '').toLowerCase();
    if (!file.type.match('image.*') || !allowedFormats.includes(fileExtension)) {
        showVisitorNotice('upload-form-alert', `Please upload an allowed image file (${allowedFormats.join(', ')}).`, 'That file type is not accepted. Choose a photo file instead.');
        return;
    }

    if (file.size > maxPhotoFileSizeMb * 1024 * 1024) {
        showVisitorNotice('upload-form-alert', `File is too large. Please upload an image smaller than ${maxPhotoFileSizeMb}MB.`, 'That photo is too large. Try a smaller image.');
        return;
    }

    const previewContainer = document.getElementById('photo-preview');
    const continueBtn = document.getElementById('upload-continue-btn');
    const uploadFaceDetectionStatus = document.getElementById('upload-face-detection-status');

    // Reset preview state before validation.
    photoData = null;
    previewContainer.style.display = 'none';
    continueBtn.disabled = true;
    updateFaceDetectionStatus('Checking uploaded photo for a face...', 'loading', uploadFaceDetectionStatus);

    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Error reading the file. Please try again.'));
        reader.readAsDataURL(file);
    }).catch((error) => {
        showVisitorNotice('upload-form-alert', error.message, 'I could not read that file. Try another photo.');
        updateFaceDetectionStatus('Could not read image. Please try again.', 'error', uploadFaceDetectionStatus);
        return null;
    });

    if (!dataUrl) {
        return;
    }

    try {
        const faceDetection = await detectFaceInImageData(dataUrl); // reuse face box for upload beauty filter done by nick
        if (!faceDetection) {
            event.target.value = '';
            updateFaceDetectionStatus('No face detected. Please retake and upload a clearer face photo.', 'error', uploadFaceDetectionStatus);
            showVisitorNotice('upload-form-alert', 'No face detected. Please retake the photo and make sure your face is clearly visible.', 'I could not spot a face in that upload. Try a brighter, clearer photo.');
            return;
        }

        // Apply the local beauty filter to uploaded mobile photos.
        const uploadedImage = await loadImageElement(dataUrl);
        photoData = createBeautyFilteredPhotoDataUrl(uploadedImage, faceDetection);
        // Uploaded mobile photos are treated as normal photos - changes made by nick
        userData.photoSkipped = false;
        userData.captureMode = 'photo';
        userData.boomerangQuality = null; // Uploaded still photos are not GIF quality tracked (DONE BY NICK)
        boomerangFrames = [];
        clearRestorableBoomerang();
        userData.processedBoomerangFrames = null; // Clear backend GIF frames for uploaded still photos - changes made by nick
        userData.boomerangFrameDelayMs = null; // Clear backend GIF timing for uploaded still photos - changes made by nick

        const previewImg = document.getElementById('uploaded-photo-preview');
        previewImg.src = photoData;
        previewContainer.style.display = 'block';
        continueBtn.disabled = false;
        updateFaceDetectionStatus('Face detected. Photo accepted.', 'success', uploadFaceDetectionStatus);
        cheerRpBear('Photo accepted. Nice, now choose a style for it.');

        // Auto-scroll to show preview
        previewContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        resetInactivityTimer();
        
    } catch (error) {
        console.error('Face detection failed for uploaded image:', error);
        event.target.value = '';
        photoData = null;
        previewContainer.style.display = 'none';
        continueBtn.disabled = true;
        updateFaceDetectionStatus('Face detection failed. Please try again.', 'error', uploadFaceDetectionStatus);
        showVisitorNotice('upload-form-alert', `Face detection failed: ${error.message}`, 'The upload check had trouble. Try another clear photo.');
    }
}

// Continue to style page from upload (mobile)
function continueToStyleFromUpload() {
    if (!photoData) {
        showFormAlert('upload-form-alert', 'Please add a clear photo before choosing a style.');
        nudgeRpBear('Add a clear photo first, then I can help you style it.');
        return;
    }

    cheerRpBear('Great upload. Let us make it look good with a frame.');
    showFlowPage('style-page');
    resetInactivityTimer();

    // Update the preview immediately
    updatePreviewWithCutout();
}

// Retake photo from upload page (mobile)
function retakePhotoFromUpload() {
    // Reset file input
    document.getElementById('photo-input').value = '';
    document.getElementById('photo-preview').style.display = 'none';
    document.getElementById('upload-continue-btn').disabled = true;
    updateFaceDetectionStatus('Upload a photo to run face detection.', 'info', 'upload-face-detection-status');
    photoData = null;
    // Clear boomerang preview frames when retaking an uploaded photo - changes made by nick
    boomerangFrames = [];
    clearRestorableBoomerang();
    userData.processedBoomerangFrames = null; // Clear backend GIF frames on upload retake - changes made by nick
    userData.boomerangFrameDelayMs = null; // Clear backend GIF timing on upload retake - changes made by nick
    userData.boomerangQuality = null; // Clear GIF quality metadata on upload retake (DONE BY NICK)

    // Trigger click on file input again
    document.getElementById('photo-input').click();
}

// Beauty filter canvas helpers done by nick
function getBeautyFaceRegion(faceDetection, width, height) {
    if (!faceDetection || !faceDetection.box) {
        return null;
    }

    const box = faceDetection.box;
    const expandedWidth = box.width * 1.48;
    const expandedHeight = box.height * 1.68;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    const faceWidth = Math.min(expandedWidth, width);
    const faceHeight = Math.min(expandedHeight, height);
    const faceX = Math.max(0, Math.min(width - faceWidth, centerX - faceWidth / 2));
    const faceY = Math.max(0, Math.min(height - faceHeight, centerY - faceHeight * 0.46));

    return {
        x: faceX,
        y: faceY,
        width: faceWidth,
        height: faceHeight
    };
}

// Face acne cover and slimming beauty filter done by nick
function drawFaceBeautyPass(ctx, sourceCanvas, faceRegion) {
    if (!faceRegion) {
        return;
    }

    const beautyPreset = getBeautyFilterPreset();
    const centerX = faceRegion.x + faceRegion.width / 2;
    const centerY = faceRegion.y + faceRegion.height / 2;
    const radiusX = faceRegion.width / 2;
    const radiusY = faceRegion.height / 2;
    const passCanvas = document.createElement('canvas');
    const passCtx = passCanvas.getContext('2d');
    passCanvas.width = sourceCanvas.width;
    passCanvas.height = sourceCanvas.height;

    const smoothCanvas = document.createElement('canvas');
    const smoothCtx = smoothCanvas.getContext('2d');
    smoothCanvas.width = sourceCanvas.width;
    smoothCanvas.height = sourceCanvas.height;
    smoothCtx.filter = beautyPreset.faceSmoothFilter;
    smoothCtx.drawImage(sourceCanvas, 0, 0);

    // Cover acne and uneven texture with a feathered face-only smoothing pass done by nick
    passCtx.globalAlpha = 0.62;
    passCtx.drawImage(smoothCanvas, 0, 0);

    // Slim face by redrawing the detected face area slightly narrower done by nick
    const slimWidth = faceRegion.width * beautyPreset.faceSlimRatio;
    const slimX = faceRegion.x + (faceRegion.width - slimWidth) / 2;
    passCtx.globalAlpha = 0.48;
    passCtx.filter = 'brightness(1.06) contrast(0.92) saturate(1.06)';
    passCtx.drawImage(
        sourceCanvas,
        faceRegion.x,
        faceRegion.y,
        faceRegion.width,
        faceRegion.height,
        slimX,
        faceRegion.y,
        slimWidth,
        faceRegion.height
    );

    // Blend a final soft skin-tone veil over the face done by nick
    passCtx.globalAlpha = 0.1;
    passCtx.filter = 'none';
    passCtx.globalCompositeOperation = 'screen';
    passCtx.fillStyle = '#ffd6c6';
    passCtx.fillRect(faceRegion.x, faceRegion.y, faceRegion.width, faceRegion.height);

    // Feather the face pass so there is no visible oval edge done by nick
    passCtx.globalCompositeOperation = 'destination-in';
    const mask = passCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(radiusX, radiusY));
    mask.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
    mask.addColorStop(0.58, 'rgba(0, 0, 0, 0.76)');
    mask.addColorStop(0.82, 'rgba(0, 0, 0, 0.28)');
    mask.addColorStop(1, 'rgba(0, 0, 0, 0)');
    passCtx.fillStyle = mask;
    passCtx.fillRect(
        faceRegion.x - radiusX * 0.2,
        faceRegion.y - radiusY * 0.2,
        faceRegion.width * 1.4,
        faceRegion.height * 1.4
    );

    ctx.drawImage(passCanvas, 0, 0);
}

function drawPhotoWithBeautyFilter(ctx, image, x, y, width, height, faceDetection = null) {
    if (!beautyFilterEnabled) {
        ctx.drawImage(image, x, y, width, height);
        return;
    }

    const beautyPreset = getBeautyFilterPreset();
    const sourceCanvas = document.createElement('canvas');
    const sourceCtx = sourceCanvas.getContext('2d');
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    sourceCtx.drawImage(image, 0, 0, width, height);

    ctx.save();
    ctx.filter = beautyPreset.baseFilter;
    ctx.drawImage(sourceCanvas, x, y, width, height);

    // Stronger beauty smoothing layer done by nick
    ctx.globalAlpha = faceDetection ? beautyPreset.faceSmoothAlpha : beautyPreset.smoothAlpha;
    ctx.filter = beautyPreset.smoothFilter;
    ctx.drawImage(sourceCanvas, x, y, width, height);

    // Restore some edges so the photo does not look overly blurry done by nick
    ctx.globalAlpha = beautyPreset.detailAlpha;
    ctx.filter = beautyPreset.detailFilter;
    ctx.drawImage(sourceCanvas, x, y, width, height);

    // Subtle warm tint for healthier skin tone done by nick
    ctx.globalAlpha = beautyPreset.tintAlpha;
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = '#ffd8c8';
    ctx.fillRect(x, y, width, height);
    ctx.restore();

    const faceRegion = getBeautyFaceRegion(faceDetection, width, height);
    drawFaceBeautyPass(ctx, sourceCanvas, faceRegion);
}

// Scale face detection box coordinates based on image scaling done by nick
function scaleFaceDetectionBox(faceDetection, scale) {
    if (!faceDetection || !faceDetection.box) {
        return faceDetection;
    }

    return {
        ...faceDetection,
        box: {
            x: faceDetection.box.x * scale,
            y: faceDetection.box.y * scale,
            width: faceDetection.box.width * scale,
            height: faceDetection.box.height * scale
        }
    };
}

// Beauty filter for uploaded image data done by nick
function createBeautyFilteredPhotoDataUrl(image, faceDetection = null) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const sourceWidth = image.naturalWidth || image.videoWidth || image.width;
    const sourceHeight = image.naturalHeight || image.videoHeight || image.height;
    const maxProcessedDimension = 1600;
    const scale = Math.min(1, maxProcessedDimension / Math.max(sourceWidth, sourceHeight));

    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);

    const scaledFaceDetection = scale < 1 ? scaleFaceDetectionBox(faceDetection, scale) : faceDetection;
    drawPhotoWithBeautyFilter(ctx, image, 0, 0, canvas.width, canvas.height, scaledFaceDetection);
    return canvas.toDataURL('image/png');
}

// Update photo/boomerang selector buttons - changes made by nick
function updateCaptureModeButtons() {
    const photoModeBtn = document.getElementById('photo-mode-btn');
    const boomerangModeBtn = document.getElementById('boomerang-mode-btn');
    const captureText = document.getElementById('capture-photo-text');

    if (photoModeBtn) {
        const isPhoto = captureMode === 'photo';
        photoModeBtn.classList.toggle('active', isPhoto);
        photoModeBtn.setAttribute('aria-pressed', isPhoto ? 'true' : 'false');
    }

    if (boomerangModeBtn) {
        const isBoomerang = captureMode === 'boomerang';
        boomerangModeBtn.classList.toggle('active', isBoomerang);
        boomerangModeBtn.setAttribute('aria-pressed', isBoomerang ? 'true' : 'false');
    }

    if (captureText) {
        captureText.textContent = captureMode === 'boomerang' ? 'Capture Boomerang' : 'Capture Photo';
    }
}

// Select normal photo or boomerang mode - changes made by nick
function selectCaptureMode(mode) {
    if (!['photo', 'boomerang'].includes(mode)) {
        return;
    }

    captureMode = mode;
    userData.captureMode = mode;
    userData.boomerangQuality = mode === 'boomerang' ? getBoomerangQualityPreset() : null; // Track quality only for boomerangs (DONE BY NICK)
    updateCaptureModeButtons();
    setRpBearSpeech(
        mode === 'boomerang'
            ? 'Boomerang selected. I will save it as a moving GIF for your email.'
            : 'Photo selected. We will capture one polished keepsake.',
        true
    );
    resetInactivityTimer();
}

// Stop looping boomerang preview animation - changes made by nick
function stopBoomerangPreview() {
    if (boomerangPreviewInterval) {
        clearInterval(boomerangPreviewInterval);
        boomerangPreviewInterval = null;
    }
    boomerangPreviewPaused = false;
    boomerangPreviewPhotoElement = null;
    updateBoomerangPreviewControls(false);
}

// Capture one current camera frame for photo or boomerang - changes made by nick
function captureVideoFrameDataUrl(faceDetection = null, faceAccessoryLandmarks = null) {
    const video = document.getElementById('video');
    const canvas = document.getElementById('photo-canvas');
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (isMirrored) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
    }

    drawPhotoWithBeautyFilter(context, video, 0, 0, canvas.width, canvas.height, faceDetection);
    drawFaceAccessory(context, faceAccessoryLandmarks, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
}

// Small delay helper for boomerang frame capture - changes made by nick
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Read admin-controlled boomerang animation speed - changes made by nick
function getBoomerangFrameDelayMs() {
    const configuredDelay = Number(kioskParameters.photoSettings?.boomerangFrameDelayMs);
    if (!Number.isFinite(configuredDelay)) {
        return DEFAULT_BOOMERANG_FRAME_DELAY_MS;
    }

    return Math.max(40, Math.min(300, configuredDelay));
}

function getBoomerangQualityPreset() { // Read admin-controlled boomerang quality (DONE BY NICK)
    const preset = String(kioskParameters.photoSettings?.boomerangQuality || 'medium').toLowerCase();
    return BOOMERANG_QUALITY_PRESETS[preset] ? preset : 'medium';
}

function getBoomerangMaxFrames() { // Quality preset to GIF frame cap (DONE BY NICK)
    return BOOMERANG_QUALITY_PRESETS[getBoomerangQualityPreset()] || BOOMERANG_GIF_MAX_FRAMES;
}

function hasRestorableBoomerang() { // Check if still-photo preview can return to GIF preview (DONE BY NICK)
    return restorableBoomerangFrames.length > 0;
}

function clearRestorableBoomerang() { // Clear stored GIF preview frames when replacing capture (DONE BY NICK)
    restorableBoomerangFrames = [];
}

function updateBoomerangPreviewControls(visible = (userData.captureMode === 'boomerang' && boomerangFrames.length > 0) || hasRestorableBoomerang()) { // Style preview controls (DONE BY NICK)
    const controls = document.getElementById('boomerang-preview-controls');
    const toggleBtn = document.getElementById('boomerang-toggle-preview-btn');
    const retakeBtn = document.getElementById('boomerang-retake-btn');
    const useStillBtn = document.getElementById('boomerang-use-still-btn');
    const useVideoBtn = document.getElementById('boomerang-use-video-btn');
    const showingBoomerang = userData.captureMode === 'boomerang' && boomerangFrames.length > 0;
    const canRestoreBoomerang = userData.captureMode !== 'boomerang' && hasRestorableBoomerang();
    const shouldShowControls = Boolean(visible && (showingBoomerang || canRestoreBoomerang));

    if (controls) controls.hidden = !shouldShowControls;
    if (toggleBtn) {
        toggleBtn.hidden = !showingBoomerang;
        toggleBtn.innerHTML = boomerangPreviewPaused
            ? '<i class="fa-solid fa-play" aria-hidden="true"></i><span>Play GIF Preview</span>'
            : '<i class="fa-solid fa-pause" aria-hidden="true"></i><span>Pause GIF Preview</span>';
    }
    if (retakeBtn) retakeBtn.hidden = !shouldShowControls;
    if (useStillBtn) useStillBtn.hidden = !showingBoomerang;
    if (useVideoBtn) useVideoBtn.hidden = !canRestoreBoomerang;
}

function toggleBoomerangPreviewPlayback() { // Pause or resume animated preview (DONE BY NICK)
    const previewPhoto = boomerangPreviewPhotoElement || document.getElementById('preview-photo');
    if (!previewPhoto || !boomerangFrames.length) return;

    if (boomerangPreviewInterval) {
        clearInterval(boomerangPreviewInterval);
        boomerangPreviewInterval = null;
        boomerangPreviewPaused = true;
        updateBoomerangPreviewControls(true);
        return;
    }

    boomerangPreviewPaused = false;
    startBoomerangPreview(previewPhoto);
}

function switchBoomerangToStillPhoto() { // Convert boomerang capture to still preview (DONE BY NICK)
    if (!boomerangFrames.length) return;
    restorableBoomerangFrames = boomerangFrames.slice(); // Preserve GIF so visitor can switch back (DONE BY NICK)
    photoData = restorableBoomerangFrames[Math.floor(restorableBoomerangFrames.length / 2)] || restorableBoomerangFrames[0];
    boomerangFrames = [];
    userData.captureMode = 'photo';
    userData.boomerangQuality = null;
    userData.processedBoomerangFrames = null;
    userData.boomerangFrameDelayMs = null;
    captureMode = 'photo';
    stopBoomerangPreview();
    updateCaptureModeButtons();
    updatePreviewWithCutout();
    updateBoomerangPreviewControls(true);
    setRpBearSpeech('Switched to a still photo. You can keep this frame or retake it.', true);
    resetInactivityTimer();
}

function switchStillPhotoToBoomerang() { // Restore moving GIF preview after using still photo (DONE BY NICK)
    if (!hasRestorableBoomerang()) return;

    boomerangFrames = restorableBoomerangFrames.slice();
    photoData = boomerangFrames[Math.floor(boomerangFrames.length / 2)] || boomerangFrames[0];
    userData.captureMode = 'boomerang';
    userData.boomerangQuality = getBoomerangQualityPreset();
    userData.processedBoomerangFrames = null;
    userData.boomerangFrameDelayMs = null;
    captureMode = 'boomerang';
    updateCaptureModeButtons();
    updatePreviewWithCutout();
    setRpBearSpeech('Boomerang restored. Your keepsake will move again.', true);
    resetInactivityTimer();
}

// Capture a short forward/backward boomerang sequence - changes made by nick
async function captureBoomerangIfFaceDetected() {
    try {
        updateFaceDetectionStatus('Checking for face...', 'loading');

        const faceDetection = await detectFaceInCurrentFrame();
        if (!faceDetection) {
            updateFaceDetectionStatus('No face detected. Position your face in frame and try again.', 'error');
            showVisitorNotice('photo-form-alert', 'No face detected. Please position your face clearly in the camera frame and capture again.', 'I could not see a face clearly. Move into the frame and try again.');
            return false;
        }

        const cameraContainer = document.getElementById('camera-container');
        if (cameraContainer) {
            cameraContainer.classList.add('boomerang-capturing');
        }

        updateFaceDetectionStatus('Recording boomerang...', 'loading');

        const frames = [];
        const boomerangFrameDelayMs = getBoomerangFrameDelayMs(); // changes made by nick
        for (let i = 0; i < BOOMERANG_FRAME_COUNT; i++) {
            const faceAccessoryLandmarks = await getCurrentFaceAccessoryLandmarks();
            frames.push(captureVideoFrameDataUrl(faceDetection, faceAccessoryLandmarks));
            await wait(boomerangFrameDelayMs);
        }

        boomerangFrames = frames.concat(frames.slice(1, -1).reverse());
        clearRestorableBoomerang();
        userData.photoSkipped = false;
        userData.captureMode = 'boomerang';
        userData.boomerangQuality = getBoomerangQualityPreset(); // Store selected quality for analytics (DONE BY NICK)
        userData.processedBoomerangFrames = null; // Rebuild backend GIF frames from this new recording - changes made by nick
        userData.boomerangFrameDelayMs = null; // Rebuild backend GIF timing from this new recording - changes made by nick
        photoData = frames[Math.floor(frames.length / 2)] || frames[0];

        if (cameraContainer) {
            cameraContainer.classList.remove('boomerang-capturing');
        }

        updateFaceDetectionStatus('Boomerang captured.', 'success');
        cheerRpBear('Boomerang captured. This will move in your email.');

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }

        continueToStyle();
        return true;
    } catch (error) {
        console.error('Boomerang capture failed:', error);
        const cameraContainer = document.getElementById('camera-container');
        if (cameraContainer) {
            cameraContainer.classList.remove('boomerang-capturing');
        }
        updateFaceDetectionStatus('Boomerang capture failed. Please try again.', 'error');
        showVisitorNotice('photo-form-alert', `Boomerang capture failed: ${error.message}`, 'Boomerang capture stumbled. Let us try one more time.');
        return false;
    }
}

//Done by Yu Kang - Capture photo only when a face is detected
function getBeautyFilterPreset() {
    return BEAUTY_FILTER_PRESETS[beautyFilterStrength] || BEAUTY_FILTER_PRESETS.medium;
}

function setBeautyFilterSetting(value) {
    if (value === 'off') {
        beautyFilterEnabled = false;
        beautyFilterStrength = 'medium';
    } else if (BEAUTY_FILTER_PRESETS[value]) {
        beautyFilterEnabled = true;
        beautyFilterStrength = value;
    }

    updateBeautyFilterSettings();
}

// Beauty filter setting state done by nick
function updateBeautyFilterSettings() {
    const video = document.getElementById('video');
    const settingValue = beautyFilterEnabled ? beautyFilterStrength : 'off';
    const settingControls = document.querySelectorAll('#beauty-filter-setting, #upload-beauty-filter-setting');
    userData.beautyFilterStrength = settingValue; // Store visitor beauty setting for Nick analytics (DONE BY NICK)

    if (video) {
        video.style.filter = beautyFilterEnabled ? getBeautyFilterPreset().liveFilter : '';
    }

    settingControls.forEach((control) => {
        control.value = settingValue;
    });
}

function setupBeautyFilterSettings() {
    const settingControls = document.querySelectorAll('#beauty-filter-setting, #upload-beauty-filter-setting');
    settingControls.forEach((control) => {
        control.addEventListener('change', () => {
            setBeautyFilterSetting(control.value);
            resetInactivityTimer();
        });
    });

    updateBeautyFilterSettings();
}

// Initialize camera with mobile device check
async function initializeCamera() {
    if (getFeatureFlags().cameraCaptureEnabled === false) {
        return;
    }

    // Don't initialize camera for mobile users
    if (currentDevice === 'mobile') {
        return;
    }

    try {
        console.log('Initializing camera for device:', currentDevice);
        
        // Stop any existing stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }

        // Get camera stream with device-specific constraints
        const constraints = {
            video: { 
                facingMode: 'user',
                width: { ideal: currentDevice === 'mobile' ? 720 : 1280 },
                height: { ideal: currentDevice === 'mobile' ? 1280 : 720 }
            } 
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);

        const video = document.getElementById('video');
        video.srcObject = stream;
        updateBeautyFilterSettings(); // apply live beauty filter preview done by nick

        // facial detection (Done by Yu Kang)
        await ensureFaceDetectionReady();
        startFaceAccessoryPreview();

        // Show camera
        document.getElementById('camera-container').style.display = 'block';

        console.log('Camera initialized for', currentDevice);
        
        // Add event listener to video for user interaction
        video.addEventListener('click', resetInactivityTimer);
        setRpBearSpeech('Camera is ready. Try a filter, then tap Capture when you like the look.', true);
        
    } catch (error) {
        console.error('Camera error:', error);
        nudgeRpBear('I could not open the camera. Check permission or ask a staff member.');
        if (error.name === 'NotAllowedError') {
            showVisitorNotice('photo-form-alert', 'Camera access was denied. Please allow camera permissions to take a photo.', 'Camera permission is blocked. Please allow access or ask a staff member.');
        }
    }
}

// Capture photo with countdown timer (desktop) or redirect to upload (mobile)
async function capturePhoto() {
    const flags = getFeatureFlags();

    if (flags.cameraCaptureEnabled === false && currentDevice !== 'mobile') {
        showFormAlert('photo-form-alert', 'Camera capture is currently disabled.');
        nudgeRpBear('Camera capture is disabled right now.');
        return;
    }

    // For mobile, redirect to file upload
    if (currentDevice === 'mobile') {
        if (flags.photoUploadEnabled === false) {
            showFormAlert('photo-form-alert', 'Photo upload is currently disabled.');
            nudgeRpBear('Photo upload is disabled right now.');
            return;
        }
        showFlowPage('file-upload-page');
        resetInactivityTimer();
        return;
    }

    try {
        const captureBtn = document.getElementById('capture-btn');
        const countdownOverlay = document.getElementById('countdown-overlay');
        const countdownText = document.getElementById('countdown-text');
        
        if (!stream) {
            showVisitorNotice('photo-form-alert', 'Camera not ready. Please wait for camera to initialize.', 'Camera is still warming up. Give it a moment, then try again.');
            return;
        }

        // Use selected capture mode after countdown finishes - changes made by nick
        const runSelectedCapture = () => {
            return captureMode === 'boomerang'
                ? captureBoomerangIfFaceDetected()
                : capturePhotoIfFaceDetected();
        };

        // Disable capture button during countdown
        captureBtn.disabled = true;
        setRpBearSpeech(captureMode === 'boomerang' ? 'Hold still. I am recording your boomerang.' : 'Smile. I am getting your photo ready.', true);
        
        // Load countdown from backend if not yet loaded
        if (countdownSeconds === null) {
            await loadCountdownTimer();
        }
        
        let countdown = Number.isInteger(countdownSeconds) ? countdownSeconds : 0;
        
        // If admin set to 0, take photo immediately (no countdown overlay)
        if (countdown === 0) {

            // facial detection (Done by Yu Kang)
            await runSelectedCapture();
            captureBtn.disabled = false;
            return;
        }
        
        // Show countdown overlay
        countdownText.textContent = countdown;
        countdownOverlay.style.display = 'flex';
        console.log('Starting countdown:', countdown);

        const countdownInterval = setInterval(async () => {
            countdown--;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                countdownOverlay.style.display = 'none';
                console.log('Countdown finished, taking photo...');
                
                // facial detection (Done by Yu Kang)
                // Take the photo only when a face is detected
                await runSelectedCapture();
                
                // Re-enable capture button
                captureBtn.disabled = false;
                return;
            }
            
            countdownText.textContent = countdown;
            console.log('Countdown:', countdown);
        }, 1000);
    } catch (error) {
        console.error('Error in capturePhoto:', error);
        showVisitorNotice('photo-form-alert', 'Error capturing photo: ' + error.message, 'Photo capture had trouble. Please try again.');
    }
}

// Take photo from camera stream (desktop)
async function takePhoto(faceDetection = null, faceAccessoryLandmarks = null) { // face-aware beauty capture done by nick
    // Normal photo capture shares frame drawing with boomerang - changes made by nick
    photoData = captureVideoFrameDataUrl(faceDetection, faceAccessoryLandmarks);
    userData.photoSkipped = false;
    userData.captureMode = 'photo';
    boomerangFrames = [];
    clearRestorableBoomerang();
    userData.processedBoomerangFrames = null; // Clear backend GIF frames for normal photo mode - changes made by nick
    userData.boomerangFrameDelayMs = null; // Clear backend GIF timing for normal photo mode - changes made by nick
    userData.boomerangQuality = null; // Clear GIF quality metadata for normal photo mode (DONE BY NICK)
    stopFaceAccessoryPreview();
    
    // Stop camera stream after taking photo
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Immediately go to style page (don't save photo yet)
    cheerRpBear('Photo captured. Let us pick a frame.');
    continueToStyle();
}
// mirror function done by nick
function toggleMirror() {
    const video = document.getElementById('video');
    const invertBtn = document.getElementById('invert-btn');

    isMirrored = !isMirrored;

    if (isMirrored) {
        video.classList.add('mirror');
        invertBtn.textContent = '↩️ Normal View';
    } else {
        video.classList.remove('mirror');
        invertBtn.textContent = '🔄 Mirror View';
    }
}

// Continue to style page after photo capture
function continueToStyle() {
    if (photoData) {
        // Update the preview with properly positioned photo
        updatePreviewWithCutout();
        
        showFlowPage('style-page');
        resetInactivityTimer();
    } else {
        showFormAlert('photo-form-alert', 'Please capture a clear photo before choosing a style.');
        nudgeRpBear('Capture a clear photo first, then I will help with the frame.');
    }
}

// Save original photo to server
function saveOriginalPhoto() {
    if (!photoData) return Promise.resolve();
    
    return fetch('/api/feedback/save-photo', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            photo: photoData,
            userName: userData.name || 'anonymous',
            device: currentDevice
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success === false || data.error) {
            throw new Error(data.error || 'Original photo could not be saved.');
        }
        console.log('Original photo saved successfully:', data);
        userData.photoId = data.filename;
        userData.device = currentDevice;
        return data;
    })
    .catch(error => {
        console.error('Error saving original photo:', error);
        throw error;
    });
}

// Save processed photo with overlay to server
function saveProcessedPhoto() {
    if (!userData.processedPhoto) return Promise.resolve();
    
    return fetch('/api/feedback/save-processed-photo', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            photo: userData.processedPhoto,
            boomerangFrames: userData.captureMode === 'boomerang' ? userData.processedBoomerangFrames : null, // Backend creates final GIF from frames - changes made by nick
            boomerangFrameDelayMs: userData.captureMode === 'boomerang' ? userData.boomerangFrameDelayMs : null, // Preserve boomerang playback speed - changes made by nick
            userName: userData.name || 'anonymous',
            device: currentDevice,
            theme: selectedTheme,
            captureMode: userData.captureMode || captureMode,
            expectedFormat: userData.captureMode === 'boomerang' ? 'gif' : 'png' // Force boomerang email keepsake to save as GIF - changes made by nick
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success === false || data.error) {
            throw new Error(data.error || 'Processed photo could not be saved.');
        }
        console.log('Processed photo saved:', data);
        if (userData.captureMode === 'boomerang' && !String(data.filename || '').toLowerCase().endsWith('.gif')) {
            throw new Error('Boomerang was not saved as a GIF. Please try capturing it again.');
        }
        userData.processedPhotoId = data.filename;
        userData.processedPhoto = null; // Avoid resending large GIF/PNG data in final submission - changes made by nick
        userData.processedBoomerangFrames = null; // Avoid resending large boomerang frames in final submission - changes made by nick
        return data;
    })
    .catch(error => {
        console.error('Error saving processed photo:', error);
        throw error;
    });
}


