// Owner: Role 1, Zihan. Previous team: Nick (8).
// Part 7/17 of the feedback page: initialisation and setup (load order in feedback.html).
// ==================== 2. INITIALIZATION & SETUP FUNCTIONS ====================

// Load dynamic QR code from server
async function loadDynamicQRCode() {
    try {
        const response = await fetch('/api/generate-qr');
        const data = await response.json();
        
        if (data.success && data.qrSvg) {
            const qrContainer = document.querySelector('.qr-code');
            if (qrContainer) {
                // Replace the dummy QR code with dynamic one
                qrContainer.innerHTML = data.qrSvg;
                
                console.log('Dynamic QR code loaded:', data.url);
            }
        }
    } catch (error) {
        console.log('Using static QR code (fallback):', error.message);
        // Keep the existing dummy QR code if dynamic loading fails
    }
}

function startQrRefreshLoop() {
    if (qrRefreshTimer) {
        clearInterval(qrRefreshTimer);
    }

    qrRefreshTimer = setInterval(() => {
        loadDynamicQRCode();
    }, 25000);
}

function setLandingVisitorCount(totalVisitors, nextVisitorNumber) { // Render start-screen live visitor count (DONE BY NICK)
    const totalText = formatVisitorCount(totalVisitors);
    const nextText = formatVisitorCount(nextVisitorNumber);

    document.querySelectorAll('.landing-visitor-count').forEach((element) => {
        element.classList.remove('is-loaded');
        void element.offsetWidth;
        element.classList.add('is-loaded');
    });
    document.querySelectorAll('[data-visitor-count-value]').forEach((element) => {
        element.textContent = totalText;
    });
    document.querySelectorAll('[data-next-visitor-value]').forEach((element) => {
        element.textContent = nextText;
    });
}

async function loadLandingVisitorCount() { // Fetch live count for landing page (DONE BY NICK)
    try {
        const response = await fetch('/api/feedback/visitor-count', {
            headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Visitor count unavailable');
        }

        setLandingVisitorCount(data.totalVisitors, data.nextVisitorNumber);
    } catch (error) {
        try {
            const treeResponse = await fetch('/api/tree', {
                headers: { 'Cache-Control': 'no-cache' }
            });
            const treeVisitors = await treeResponse.json();
            const totalVisitors = Array.isArray(treeVisitors) ? treeVisitors.length : null;
            setLandingVisitorCount(totalVisitors, Number.isFinite(Number(totalVisitors)) ? Number(totalVisitors) + 1 : null);
        } catch (fallbackError) {
            console.warn('Landing visitor count unavailable:', error.message, fallbackError.message);
            setLandingVisitorCount(null, null);
        }
    }
}

function startLandingVisitorCountLoop() { // Keep start-screen count live (DONE BY NICK)
    if (landingVisitorCountTimer) {
        clearInterval(landingVisitorCountTimer);
    }

    loadLandingVisitorCount();
    landingVisitorCountTimer = setInterval(loadLandingVisitorCount, 30000);
}

// Detect if user is on mobile or desktop
function detectDeviceType() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    currentDevice = isMobile ? 'mobile' : 'desktop';
    console.log('Detected device:', currentDevice);
    
    // Update UI classes for device-specific styling
    document.body.classList.add(`device-${currentDevice}`);
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    applyFormUIConfig();
    kioskParametersLoadPromise = loadKioskParameters();
    
    // Check if mobile
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Add class to body to show content after scaling is ready
        setTimeout(() => {
            document.body.classList.add('scale-applied');
            
            // Force reflow to ensure smooth transition
            void document.body.offsetHeight;
        }, 50);
    }
    
    // Handle page transitions
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // When page changes, ensure scaling is maintained
                if (isMobile && !document.body.classList.contains('scale-applied')) {
                    document.body.classList.add('scale-applied');
                }
            }
        });
    });
    
    // Observe body for page changes
    observer.observe(document.body, {
        childList: true,
        subtree: false
    });
});

document.addEventListener('DOMContentLoaded', function() {
    // Load dynamic QR code
    loadDynamicQRCode();
    startQrRefreshLoop();
    startLandingVisitorCountLoop(); // Start-screen live visitor count (DONE BY NICK)
    initializeProgressIndicators();
    updateCaptureModeButtons();
    
    // Detect device type
    detectDeviceType();
    
    const pledgeTextarea = document.getElementById('pledge-text');
    if (pledgeTextarea) {
        pledgeTextarea.addEventListener('input', function() {
            document.getElementById('char-count').textContent = this.value.length;
    updatePledgeCoach();
    resetInactivityTimer(); // Reset timer on user input
        });
    }

    document.querySelectorAll('input[name="pledge-topics"]').forEach((topicInput) => {
        topicInput.addEventListener('change', function() {
            syncPledgeTopicField();
            updatePledgeCoach();
            resetInactivityTimer();
        });
    });

    updatePledgeCoach();

    // Add event listener for capture button
    const captureBtn = document.getElementById('capture-btn');
    if (captureBtn) {
        captureBtn.addEventListener('click', capturePhoto);
    }
    //for invert camera done by nick
    const invertBtn = document.getElementById('invert-btn');
if (invertBtn) {
    invertBtn.addEventListener('click', toggleMirror);
}

    // Beauty filter setting done by nick
    setupBeautyFilterSettings();
    setupFaceAccessorySelector();
    setupRpBearCompanion(); // changes made by nick
    setupLostFoundModal(); // changes made by nick

    // Load overlay options from database
    loadOverlayOptions();
    
    // Load feedback questions from database
    loadFeedbackQuestions();

    // Start inactivity timer
    startInactivityTimer();

    if (isCelebrationDemoMode()) {
        Promise.resolve(kioskParametersLoadPromise)
            .finally(() => window.setTimeout(showCelebrationDemoIfRequested, 120));
    }
});


