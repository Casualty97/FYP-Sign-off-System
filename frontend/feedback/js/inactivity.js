// Owner: Role 1, Zihan. Previous team: Nick (4).
// Part 8/17 of the feedback page: inactivity timer and idle reset (load order in feedback.html).
// ==================== 3. INACTIVITY TIMER FUNCTIONS ====================

// Start 1-minute inactivity countdown
function startInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    if (idleWarningTimer) {
        clearTimeout(idleWarningTimer);
    }
    if (idleWarningInterval) {
        clearInterval(idleWarningInterval);
    }
    hideIdleWarning();

    idleWarningTimer = setTimeout(() => {
        showIdleWarning();
    }, Math.max(0, INACTIVITY_TIMEOUT - (IDLE_WARNING_SECONDS * 1000)));

    inactivityTimer = setTimeout(() => {
        returnToLandingPage();
    }, INACTIVITY_TIMEOUT);
    
    console.log('Inactivity timer started: 1 minute');
}

// Reset timer on user interaction
function resetInactivityTimer() {
    if (document.body.classList.contains('submitting-feedback')) {
        return;
    }
    startInactivityTimer();
}

function showIdleWarning() {
    const modal = document.getElementById('idle-timeout-modal');
    const countdown = document.getElementById('idle-countdown');
    if (!modal || !countdown) return;

    let remaining = IDLE_WARNING_SECONDS;
    countdown.textContent = remaining;
    modal.style.display = 'flex';

    idleWarningInterval = setInterval(() => {
        remaining -= 1;
        countdown.textContent = Math.max(0, remaining);
        if (remaining <= 0 && idleWarningInterval) {
            clearInterval(idleWarningInterval);
            idleWarningInterval = null;
        }
    }, 1000);
}

function hideIdleWarning() {
    const modal = document.getElementById('idle-timeout-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function stayOnForm() {
    resetInactivityTimer();
}

// Return to landing page when timeout reached
function returnToLandingPage() {
    console.log('Inactivity timeout reached - returning to landing page');
    // Reset boomerang state on kiosk timeout - changes made by nick
    stopBoomerangPreview();
    
    // Stop camera stream if active
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Clear any existing timer
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    if (idleWarningTimer) {
        clearTimeout(idleWarningTimer);
        idleWarningTimer = null;
    }
    if (idleWarningInterval) {
        clearInterval(idleWarningInterval);
        idleWarningInterval = null;
    }
    hideIdleWarning();
    clearValidationMessages();
    
    // Reset all data
    selectedRetention = LONG_TERM_RETENTION;
    selectedTheme = 'nature';
    selectedFaceAccessory = 'none';
    userData = {};
    photoData = null;
    captureMode = 'photo';
    boomerangFrames = [];
    clearRestorableBoomerang();
    selectedFaceAccessory = 'none'; // Reset face filter between visitors (DONE BY NICK)
    userData.selectedFaceAccessory = 'none'; // Reset filter analytics state (DONE BY NICK)
    updateCaptureModeButtons();
    updateFaceAccessoryButtons();
    setupKeepsakeDownload({}); // Clear previous visitor download state (DONE BY NICK)
    updateFaceAccessoryButtons();
    scrollSelectedFaceFilterIntoView('auto');
    
    // Reset forms
    document.querySelectorAll('form').forEach(form => form.reset());
    syncPledgeTopicField();
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    
    // Reset character counter if it exists
    const charCount = document.getElementById('char-count');
    if (charCount) charCount.textContent = '0';
    
    // Reset proceed button if it exists
    
    showLandingPages();
    
    // Show notification
    showTimeoutNotification();
    
    console.log('✅ Successfully returned to landing page');
}

// Show timeout notification message
function showTimeoutNotification() {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fef3c7;
        border: 2px solid #f59e0b;
        border-radius: 12px;
        padding: 16px 20px;
        color: #92400e;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        max-width: 300px;
    `;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 6V10L12 12" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
                <circle cx="10" cy="10" r="8" stroke="#f59e0b" stroke-width="2"/>
            </svg>
            <span>Session timed out. Please start again.</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}


