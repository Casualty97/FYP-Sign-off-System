// Feedback (kiosk) page script, split from the former feedback.js by section (move only, nothing changed inside).
// File 14 of 17: back buttons. Owner: Role 1.
// Load order (classic scripts, one shared global scope): core, bear, lostFound, flowPages, faceDetect, faceFilters, init, inactivity, questions, submit, photo, overlays, navigation, backNavigation, events, config, language.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: Nick (6)   <- counted from the "DONE BY" style markers below
// Current team owner: Role 1, Zihan. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
// ==================== 9. BACK NAVIGATION FUNCTIONS ====================

// From Consent to Landing
function goBackToLanding() {
    showLandingPages();
    resetInactivityTimer();
}

// From Details to Consent
function goBackToConsent() {
    selectedRetention = LONG_TERM_RETENTION;
    showLandingPages();
    resetInactivityTimer();
}

// From Feedback to Details
function goBackToDetails() {
    showFlowPage('details-page');
    resetInactivityTimer();
}

// Home button reset from feedback form done by nick
function goHomeFromFeedbackForm() {
    // Clear boomerang state when returning home - changes made by nick
    stopBoomerangPreview();
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    selectedRetention = LONG_TERM_RETENTION;
    selectedTheme = 'nature';
    userData = {};
    photoData = null;
    captureMode = 'photo';
    boomerangFrames = [];
    clearRestorableBoomerang();
    selectedFaceAccessory = 'none'; // Reset face filter when returning home (DONE BY NICK)
    userData.selectedFaceAccessory = 'none'; // Reset filter analytics state (DONE BY NICK)
    updateCaptureModeButtons();
    updateFaceAccessoryButtons();
    setupKeepsakeDownload({}); // Clear previous visitor download state (DONE BY NICK)

    document.querySelectorAll('form').forEach(form => form.reset());
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));


    const charCount = document.getElementById('char-count');
    if (charCount) charCount.textContent = '0';

    clearValidationMessages();
    showLandingPages();
    resetInactivityTimer();
}

// From Pledge to Feedback
function goBackToFeedback() {
    showFlowPage('feedback-page');
    resetInactivityTimer();
}

// From Photo/Upload to Pledge
function goBackToPledge() {
    // Stop boomerang preview when leaving photo flow - changes made by nick
    stopBoomerangPreview();

    // Stop camera stream if active (for desktop)
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    showFlowPage('pledge-page');
    
    resetInactivityTimer();
}

// // From Style to Photo/Upload
// function goBackToPhoto() {
//     // Hide style page
//     document.getElementById('style-page').style.display = 'none';
    
//     // Show appropriate photo page based on device
//     if (currentDevice === 'mobile') {
//         document.getElementById('file-upload-page').style.display = 'flex';
//     } else {
//         document.getElementById('photo-page').style.display = 'flex';
//         // Reinitialize camera for desktop
//         initializeCamera();
//     }
    
//     resetInactivityTimer();
// }


