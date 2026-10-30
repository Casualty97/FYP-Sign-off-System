// Feedback (kiosk) page script, split from the former feedback.js by section (move only, nothing changed inside).
// File 15 of 17: global event listeners, cleanup, pledgeboard link. Owner: Role 1.
// Load order (classic scripts, one shared global scope): core, bear, lostFound, flowPages, faceDetect, faceFilters, init, inactivity, questions, submit, photo, overlays, navigation, backNavigation, events, config, language.
// ==================== 10. EVENT LISTENERS & CLEANUP ====================

// Clean up camera when leaving page
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    if (idleWarningTimer) {
        clearTimeout(idleWarningTimer);
    }
    if (idleWarningInterval) {
        clearInterval(idleWarningInterval);
    }
});

// Add event listeners for user interactions to reset timer
document.addEventListener('click', resetInactivityTimer);
document.addEventListener('keypress', resetInactivityTimer);
document.addEventListener('mousemove', resetInactivityTimer);
document.addEventListener('touchstart', resetInactivityTimer);

// ==================== 11. PLEDGEBOARD NAVIGATION ====================

// Navigate to PLEDGEBOARD page
function viewPledgeboard() {
    window.location.href = '/pledgeboard';
}

