// Feedback (kiosk) page script, split from the former feedback.js by section (move only, nothing changed inside).
// File 5 of 17: face detection before taking a photo (face-api). Owner: Role 1.
// Load order (classic scripts, one shared global scope): core, bear, lostFound, flowPages, faceDetect, faceFilters, init, inactivity, questions, submit, photo, overlays, navigation, backNavigation, events, config, language.
// facial detection (Done by Yu Kang)
const FACE_API_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
let faceDetectionReady = false;
let faceDetectionLoadPromise = null;

function updateFaceDetectionStatus(message, type = 'info', statusElementId = 'face-detection-status') {
    const statusElement = document.getElementById(statusElementId);
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = `face-detection-status ${type}`;
}

async function ensureFaceDetectionReady() {
    if (faceDetectionReady) {
        return true;
    }

    if (faceDetectionLoadPromise) {
        return faceDetectionLoadPromise;
    }

    if (typeof faceapi === 'undefined') {
        throw new Error('face-api.js is not loaded.');
    }

    updateFaceDetectionStatus('Loading face detection...', 'loading');

    faceDetectionLoadPromise = faceapi.nets.tinyFaceDetector
        .loadFromUri(FACE_API_MODEL_URL)
        .then(() => {
            faceDetectionReady = true;
            updateFaceDetectionStatus('Face detection ready.', 'success');
            return true;
        })
        .catch((error) => {
            console.error('Failed to load face detection model:', error);
            updateFaceDetectionStatus('Face detection unavailable. Check network and try again.', 'error');
            throw new Error('Unable to load face detection model. Please check internet access and retry.');
        })
        .finally(() => {
            faceDetectionLoadPromise = null;
        });

    return faceDetectionLoadPromise;
}

async function detectFaceInCurrentFrame() {
    await ensureFaceDetectionReady();

    const video = document.getElementById('video');
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error('Camera preview is not ready yet.');
    }

    const detection = await faceapi.detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5
        })
    );

    return detection; // return face box for beauty filter done by nick
}

// Feature to detect face in uploaded image (mobile) - done by Yu Kang
async function detectFaceInImageData(dataUrl) {
    await ensureFaceDetectionReady();

    const image = await loadImageElement(dataUrl);
    const detection = await faceapi.detectSingleFace(
        image,
        new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5
        })
    );

    return detection; // return face box for beauty filter done by nick
}

