// Owner: Role 1, Zihan. Previous team: none marked.
// Part 15/17 of the feedback page: global event listeners, cleanup, pledgeboard link (load order in feedback.html).
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

