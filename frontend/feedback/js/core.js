// Feedback (kiosk) page script, split from the former feedback.js by section (move only, nothing changed inside).
// File 1 of 17: previous-team index, state, constants, pledge topic helpers, flow constants. Owner: Role 1.
// Load order (classic scripts, one shared global scope): core, bear, lostFound, flowPages, faceDetect, faceFilters, init, inactivity, questions, submit, photo, overlays, navigation, backNavigation, events, config, language.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: XY (Xuanyang) (42), Preti (40), Nick (26), Caeden (8), Yu Kang (4), Bernissa (3), Nadhirah (1)   <- counted from the "DONE BY" style markers below
// Current team owner: Role 1, Zihan. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
// ============================================================
// XY CHANGE SUMMARY (DONE BY XY)
// ============================================================
//
// 1. PLEDGE TOPIC BADGE ASSIGNMENT
//    userData.pledgeTopic             - Store selected pledge topic for badge mapping (DONE BY XY)
//    function submitPledge()          - Validate pledge topic before continuing to photo flow (DONE BY XY)
//
// 2. OPTIONAL PLEDGE FLOW
//    function skipPledge()            - Let visitors continue without making a pledge (DONE BY XY)
//    userData.pledgeSkipped           - Mark skipped pledge submissions for Feedback Contributor badge (DONE BY XY)
//    function continueAfterPledgeChoice - Shared navigation after pledge or skip choice (DONE BY XY)
//
// 3. REWARD MESSAGE CLEANUP
//    const BADGE_LEAF_REWARDS         - Active reward messages for Feedback Contributor plus 6 topic badges (DONE BY XY)
//    Removed inactive badges          - Eco Warrior and Commitment Champion removed from reward map (DONE BY XY)
//
// 4. KIOSK-GUIDED FEEDBACK FLOW
//    const FLOW_STEPS                 - Step progress labels: Consent > Details > Feedback > Pledge > Photo > Confirm (DONE BY XY)
//    function initializeProgressIndicators - Add shared step progress indicator to feedback pages (DONE BY XY)
//    function showFlowPage()          - Central page switching with progress updates (DONE BY XY)
//
// 5. FRIENDLY VALIDATION AND PUBLIC FORM CLEANUP
//    function showFieldError()        - Show clear inline validation messages beside missing fields (DONE BY XY)
//    function showFormAlert()         - Show page-level validation guidance for kiosk users (DONE BY XY)
//    Removed class/course handling    - Public form no longer asks for school-only details (DONE BY XY)
//
// 6. ONE-MINUTE KIOSK IDLE RESET
//    const INACTIVITY_TIMEOUT         - Reset idle kiosk sessions after 1 minute (DONE BY XY)
//    function showIdleWarning()       - Show 10-second reset warning before clearing the form (DONE BY XY)
//    function stayOnForm()            - Let active users keep going from the idle warning (DONE BY XY)
//
// 7. ADMIN-CONTROLLED CONSENT AND PLEDGE TEXT
//    getTemporaryRetentionDays        - Read temporary retention duration from contentSettings (DONE BY XY)
//    applyParameterOverrides          - Apply editable retention wording and pledge examples on visitor pages (DONE BY XY)
//    updateConfirmationDetails        - Show configured retention label on confirmation screen (DONE BY XY)
//
// 8. KIOSK CELEBRATION MOMENT
//    setupCelebrationMoment()         - Shows badge reveal, flying leaf, mini tree and keepsake preview after submission (DONE BY XY)
//    loadCelebrationImpactCounters()  - Loads pledge and tree counters for the thank-you celebration panel (DONE BY XY)
//    renderCelebrationLeaves()        - Creates browser-only mini leaves for the celebration tree preview (DONE BY XY)
//

// ============================================================
// YU KANG CHANGE SUMMARY (Done by Yu Kang)
// ============================================================
//
// 1. TOKEN-BASED QR FEEDBACK FLOW
//    loadDynamicQRCode()             - Fetches the kiosk QR SVG from /api/generate-qr (Done by Yu Kang)
//    startQrRefreshLoop()            - Refreshes the kiosk QR every 25 seconds to reduce screenshot reuse (Done by Yu Kang)
//    qr-description text             - Static text under the kiosk QR (Done by Yu Kang)
//

// CAEDEN CHANGE SUMMARY (DONE BY CAEDEN)
// ============================================================
//
// 1. KIOSK PARAMETER CONFIG CONSUMPTION
//    let kioskParameters              - Store parameters loaded from /api/parameters (DONE BY CAEDEN)
//    function loadKioskParameters     - Fetch admin-configured text and visual parameters (DONE BY CAEDEN)
//    function applyParameterOverrides - Apply editable English prompts, thank-you text and feedback background (DONE BY CAEDEN)
//    function loadOverlayOptions      - Preselect configured default overlay after parameter load (DONE BY CAEDEN)
//    feature flags                    - Toggle pledge, capture, upload, beauty filter and social share UI (DONE BY CAEDEN)
//    validation rules                 - Centralize details, pledge and photo upload validation from config (DONE BY CAEDEN)
//
// FIND COMMAND
//    rg -n "DONE BY CAEDEN|CAEDEN CHANGE SUMMARY" frontend backend

// ============================================================

// ============================================================
// FEEDBACK.JS - TABLE OF CONTENTS (CTRL+F SEARCHABLE)
// ============================================================
// 
// 1. GLOBAL VARIABLES & CONSTANTS
//    let selectedRetention            - Selected retention option (DONE BY PRETI)
//    let selectedTheme                - Currently selected overlay theme (DONE BY PRETI)
//    let userData                     - Object storing user input and answers (DONE BY PRETI)
//    let stream                       - Camera video stream object 
//    let photoData                    - Base64 encoded photo data 
//    let currentDevice                - 'desktop' or 'mobile' device type (DONE BY PRETI)
//    let inactivityTimer              - Timer for inactivity timeout (DONE BY PRETI)
//    let idleWarningTimer             - Timer for 10-second idle warning modal (DONE BY XY)
//    let idleWarningInterval          - Countdown interval for idle warning modal (DONE BY XY)
//    const INACTIVITY_TIMEOUT         - 1 minute timeout duration (DONE BY XY)
//    const IDLE_WARNING_SECONDS       - Warning countdown before kiosk reset (DONE BY XY)
//    let countdownSeconds             - Countdown seconds loaded from backend (DONE BY BERNISSA)
//    let overlayData                  - Store full overlay data including file paths (DONE BY PRETI)
//    const FLOW_STEPS                 - Step progress labels and matching page ids (DONE BY XY)
//    const FLOW_PAGE_IDS              - All feedback flow page ids for shared navigation (DONE BY XY)
//
// 2. INITIALIZATION & SETUP FUNCTIONS
//    async function loadDynamicQRCode() - Load dynamic QR code from server (DONE BY PRETI)
//    function detectDeviceType()      - Detect mobile/desktop device (DONE BY PRETI)
//    DOMContentLoaded                 - Application bootstrap (DONE BY PRETI)
//
// 3. INACTIVITY TIMER FUNCTIONS
//    function startInactivityTimer()  - Start 1-minute countdown (DONE BY XY)
//    function resetInactivityTimer()  - Reset on user interaction (DONE BY XY)
//    function showIdleWarning()       - Warn before automatic kiosk reset (DONE BY XY)
//    function hideIdleWarning()       - Hide idle warning modal (DONE BY XY)
//    function stayOnForm()            - Continue current session from idle warning (DONE BY XY)
//    function returnToLandingPage()   - Return to start when timeout (DONE BY XY)
//    function showTimeoutNotification() - Show timeout message (DONE BY PRETI)
//
// 4. QUESTION MANAGEMENT FUNCTIONS
//    async function loadFeedbackQuestions() - Load questions from database (DONE BY PRETI)
//    function updateFeedbackForm()    - Update form with questions (DONE BY PRETI)
//    function createQuestionElement() - Create question UI (DONE BY PRETI)
//    function selectQuestionRating()  - Handle star rating (DONE BY PRETI)
//    function initializeQuestionEventListeners() - Setup question events (DONE BY PRETI)
//    function showNoQuestionsMessage() - Show message if no questions (DONE BY PRETI)
//    function getQuestionType()       - Determine question type (DONE BY PRETI)
//    function validateRequiredQuestions() - Validate required answers with inline messages (DONE BY XY)
// 
// 5. FORM SUBMISSION FUNCTIONS
//    function submitFeedback()        - Submit feedback form with friendlier validation (DONE BY XY)
//    function submitDetails()         - Submit public user details without class/course field (DONE BY XY)
//    function submitPledge()          - Submit pledge and redirect (DONE BY XY)
//
// 6. PHOTO HANDLING FUNCTIONS
//    function handlePhotoUpload()     - Handle file upload (mobile) 
//    function continueToStyleFromUpload() - Continue from upload to style (DONE BY PRETI)
//    function retakePhotoFromUpload() - Retake photo from upload page (DONE BY PRETI)
//    async function initializeCamera() - Initialize camera (desktop only) (DONE BY PRETI)
//    async function capturePhoto()    - Capture with countdown/redirect (DONE BY PRETI)
//    function takePhoto()             - Take photo from camera stream (DONE BY PRETI)
//    function continueToStyle()       - Go to style page after photo (DONE BY PRETI)
//    function saveOriginalPhoto()     - Save original to server (DONE BY PRETI)
//    function saveProcessedPhoto()    - Save processed photo to server (DONE BY PRETI)
//
// 7. OVERLAY & THEME FUNCTIONS
//    async function loadOverlayOptions() - Load overlays from database (DONE BY PRETI)
//    function loadDefaultOverlayOptions() - Fallback default overlays (DONE BY PRETI)
//    function generateColorFromThemeId() - Generate consistent colors (DONE BY PRETI)
//    function selectTheme()           - Select theme and update preview (DONE BY PRETI)
//    function updateThemePreview()    - Update theme preview image (DONE BY PRETI)
//    function updatePreviewWithCutout() - Update preview with positioning (DONE BY PRETI)
//    function processFinalPhoto()     - Process final photo with overlay (DONE BY PRETI)
//
// 8. PAGE NAVIGATION FUNCTIONS
//    function showConsentPage()       - Show consent page with progress tracking (DONE BY XY)
//    function selectOption()          - Select retention option (DONE BY XY)
//    function showDetailsPage()       - Show details page with validation guidance (DONE BY XY)
//    function retakePhotoFromStyle()  - Retake photo from style page (DONE BY PRETI)
//    function confirmStyle()          - Confirm and go to confirmation 
//    function updateConfirmationDetails() - Update confirmation page 
//    function goBackToStyle()         - Go back to style page 
//    function finalSubmit()           - Final submission with saving (DONE BY PRETI)
//    function submitAnother()         - Reset and start new submission 
//
// 9. BACK NAVIGATION FUNCTIONS
//    function goBackToLanding()       - Consent to Landing (DONE BY PRETI)
//    function goBackToConsent()       - Details to Consent 
//    function goBackToDetails()       - Feedback to Details 
//    function goBackToFeedback()      - Pledge to Feedback 
//    function goBackToPledge()        - Photo/Upload to Pledge 
//
// 10. EVENT LISTENERS & CLEANUP
//     window.addEventListener('beforeunload') - Clean up camera and timers 
//     document.addEventListener('click') - Reset inactivity timer (DONE BY PRETI)
//     document.addEventListener('keypress') - Reset inactivity timer (DONE BY PRETI)
//     document.addEventListener('mousemove') - Reset inactivity timer (DONE BY PRETI)
//     document.addEventListener('touchstart') - Reset inactivity timer (DONE BY PRETI)
//
// 11. PLEDGEBOARD NAVIGATION
//     function viewPledgeboard()       - Navigate to pledgeboard page (DONE BY PRETI)
//
// 12. FORM UI CONFIGURATION
//     async function applyFormUIConfig() - Load and apply form UI settings from server (DONE BY NADH)
//     async function loadCountdownTimer() - Load countdown timer setting from server (DONE BY BERNISSA)

// ==================== 1. GLOBAL VARIABLES & CONSTANTS ====================
const LONG_TERM_RETENTION = 'longterm';
let selectedRetention = LONG_TERM_RETENTION;
let selectedTheme = 'nature';
let userData = {};
let stream = null;
let photoData = null;
// Boomerang capture state - changes made by nick
let captureMode = 'photo';
let boomerangFrames = [];
let restorableBoomerangFrames = []; // Keeps captured GIF frames when visitor previews a still photo (DONE BY NICK)
let boomerangPreviewInterval = null;
let boomerangPreviewPaused = false; // Boomerang preview pause/resume state (DONE BY NICK)
let boomerangPreviewPhotoElement = null; // Remember current GIF preview target (DONE BY NICK)
const BOOMERANG_FRAME_COUNT = 10;
const DEFAULT_BOOMERANG_FRAME_DELAY_MS = 90; // Admin-controlled boomerang default - changes made by nick
const BOOMERANG_GIF_MAX_FRAMES = 18; // Email-friendly animated GIF frame cap - changes made by nick
const BOOMERANG_QUALITY_PRESETS = { compact: 10, medium: 18, high: 24 }; // Admin quality presets (DONE BY NICK)
const GIF_RED_LEVELS = 6; // Balanced GIF colour palette to reduce boomerang discoloration - changes made by nick
const GIF_GREEN_LEVELS = 7; // Extra green level keeps skin and nature overlays less posterized - changes made by nick
const GIF_BLUE_LEVELS = 6; // More blue levels fixes purple/green cast in emailed GIFs - changes made by nick
let currentDevice = 'desktop'; // 'desktop' or 'mobile'
let inactivityTimer = null;
let idleWarningTimer = null;
let idleWarningInterval = null;
const INACTIVITY_TIMEOUT = 60000; // 1 minute kiosk reset timeout
const IDLE_WARNING_SECONDS = 10;
let countdownSeconds = null; // Loaded from backend when needed (DONE BY BERNISSA)
let overlayData = {}; // Store full overlay data including file paths from database 
let kioskParameters = {};
let kioskParametersLoadPromise = null;
let isMirrored = false; // to invert camera done by nick
let beautyFilterEnabled = true; // beauty filter toggle done by nick
let beautyFilterStrength = 'medium'; // visitor beauty filter strength - changes made by nick
let selectedFaceAccessory = 'none';
let faceLandmarker = null;
let faceLandmarkerLoadPromise = null;
let faceAccessoryAnimationFrame = null;
let latestFaceAccessoryLandmarks = null;
let latestFaceAccessoryVideoTime = -1;
const LOST_FOUND_PROGRESS_KEY = 'rpLostFoundFeedbackProgress'; // changes made by nick
const LOST_FOUND_PENDING_KEY = 'rpPendingLostFoundReports'; // changes made by nick
let lostFoundPhotoDataUrl = null; // Optional Lost & Found item photo payload (DONE BY NICK)
let lostFoundPhotoName = ''; // Original Lost & Found item photo filename (DONE BY NICK)
let lostFoundPhotoReadPromise = Promise.resolve(true); // Wait for Lost & Found photo reads before saving (DONE BY NICK)
const RP_BEAR_VOICE_KEY = 'rpBearVoiceEnabled'; // RP guide voice preference (DONE BY NICK)
let rpBearVoiceEnabled = localStorage.getItem(RP_BEAR_VOICE_KEY) === 'true'; // RP guide audio toggle (DONE BY NICK)
const MEDIAPIPE_TASKS_VISION_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0';
const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm';
const FACE_LANDMARKER_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
// Swipeable animated face filter options - changes made by nick
const FACE_ACCESSORY_OPTIONS = [
    { id: 'none', label: 'No filter' },
    { id: 'glasses', label: 'Glasses' },
    { id: 'sparkle-glasses', label: 'Sparkle glasses' },
    { id: 'moustache', label: 'Moustache' },
    { id: 'hat', label: 'Hat' },
    { id: 'flower-crown', label: 'Flower crown' },
    { id: 'halo', label: 'Halo glow' },
    { id: 'blush', label: 'Blush' },
    { id: 'party', label: 'Party pop' },
    { id: 'rp-shades', label: 'RP shades' },
    { id: 'leaf-crown', label: 'Leaf crown' },
    { id: 'graduation', label: 'Graduation cap' }
];
const FACE_ACCESSORY_IDS = FACE_ACCESSORY_OPTIONS.map(option => option.id);
let faceFilterScrollTimer = null;
let qrRefreshTimer = null;
let landingVisitorCountTimer = null; // Live visitor count refresh loop (DONE BY NICK)
const BEAUTY_FILTER_PRESETS = {
    light: {
        liveFilter: 'brightness(1.08) contrast(0.92) saturate(1.12)',
        baseFilter: 'brightness(1.08) contrast(0.92) saturate(1.12)',
        smoothFilter: 'blur(3px) brightness(1.08) contrast(0.88) saturate(1.08)',
        detailFilter: 'contrast(1.02) saturate(1.04)',
        faceSmoothFilter: 'blur(6px) brightness(1.08) contrast(0.88) saturate(1.06)',
        smoothAlpha: 0.18,
        faceSmoothAlpha: 0.1,
        detailAlpha: 0.08,
        tintAlpha: 0.04,
        faceSlimRatio: 0.94
    },
    medium: {
        liveFilter: 'brightness(1.2) contrast(0.82) saturate(1.28) blur(0.8px)',
        baseFilter: 'brightness(1.2) contrast(0.82) saturate(1.28)',
        smoothFilter: 'blur(7px) brightness(1.18) contrast(0.78) saturate(1.2)',
        detailFilter: 'contrast(1.02) saturate(1.08)',
        faceSmoothFilter: 'blur(12px) brightness(1.16) contrast(0.78) saturate(1.12)',
        smoothAlpha: 0.38,
        faceSmoothAlpha: 0.18,
        detailAlpha: 0.12,
        tintAlpha: 0.08,
        faceSlimRatio: 0.84
    },
    strong: {
        liveFilter: 'brightness(1.28) contrast(0.74) saturate(1.38) blur(1.1px)',
        baseFilter: 'brightness(1.28) contrast(0.74) saturate(1.38)',
        smoothFilter: 'blur(10px) brightness(1.24) contrast(0.72) saturate(1.28)',
        detailFilter: 'contrast(1.03) saturate(1.1)',
        faceSmoothFilter: 'blur(16px) brightness(1.22) contrast(0.72) saturate(1.16)',
        smoothAlpha: 0.48,
        faceSmoothAlpha: 0.24,
        detailAlpha: 0.14,
        tintAlpha: 0.1,
        faceSlimRatio: 0.78
    }
}; // visitor-adjustable beauty filter presets - changes made by nick
const PLEDGE_COACH_TOPIC_SUGGESTIONS = {
    'climate-change': 'Take public transport or walk for 2 trips this week.',
    'renewable-energy': 'Switch off unused lights and chargers every day this week.',
    'sustainable-living': 'Bring a reusable bottle for 3 school days this week.',
    'ocean-conservation': 'Avoid single-use plastic for lunch 3 times this week.',
    'ethical-governance': 'Share one responsible sustainability habit with a friend this week.',
    'community-impact': 'Invite one friend to join a green habit with me this week.'
};
let pledgeCoachSuggestion = '';

const PLEDGE_TOPIC_LABELS = {
    'climate-change': 'Climate Change',
    'renewable-energy': 'Renewable Energy',
    'sustainable-living': 'Sustainable Living',
    'ocean-conservation': 'Ocean Conservation',
    'ethical-governance': 'Ethical Governance',
    'community-impact': 'Community Impact'
};

function getSelectedPledgeTopics() {
    return Array.from(document.querySelectorAll('input[name="pledge-topics"]:checked'))
        .map(input => input.value)
        .filter(value => PLEDGE_TOPIC_LABELS[value]);
}

function syncPledgeTopicField() {
    const selectedTopics = getSelectedPledgeTopics();
    const hiddenTopic = document.getElementById('pledge-topic');
    if (hiddenTopic) hiddenTopic.value = selectedTopics[0] || '';
    return selectedTopics;
}

function formatPledgeTopicLabel(topic) {
    return PLEDGE_TOPIC_LABELS[topic] || String(topic || '')
        .split('-')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatPledgeTopicList(topics) {
    const labels = (Array.isArray(topics) ? topics : [])
        .map(formatPledgeTopicLabel)
        .filter(Boolean);
    return labels.join(', ');
}

const FLOW_STEPS = [
    { key: 'details', label: 'Details', pageIds: ['details-page'] },
    { key: 'feedback', label: 'Feedback', pageIds: ['feedback-page'] },
    { key: 'pledge', label: 'Pledge', pageIds: ['pledge-page'] },
    { key: 'photo', label: 'Photo', pageIds: ['photo-choice-page', 'photo-page', 'file-upload-page', 'style-page'] },
    { key: 'confirm', label: 'Confirm', pageIds: ['confirmation-page'] }
];
const FLOW_PAGE_IDS = FLOW_STEPS.flatMap(step => step.pageIds).concat(['thankyou-page']);
const FLOW_SLIDE_TRANSITION_MS = 380; // Smooth multi-step form slide timing - changes made by nick
let activeFlowPageId = null; // Track current visible form step for slide direction - changes made by nick
let flowSlideTransitionTimer = null; // Prevent overlapping page transition cleanup - changes made by nick
