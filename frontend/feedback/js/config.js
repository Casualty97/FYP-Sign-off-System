// Feedback (kiosk) page script, split from the former feedback.js by section (move only, nothing changed inside).
// File 16 of 17: form UI config and kiosk parameters from the admin. Owner: Role 1 + Role 3.
// Load order (classic scripts, one shared global scope): core, bear, lostFound, flowPages, faceDetect, faceFilters, init, inactivity, questions, submit, photo, overlays, navigation, backNavigation, events, config, language.
// ==================== FORM UI CONFIGURATION ====================
// Load and apply form UI settings from server config

async function applyFormUIConfig() {
  try {
    const response = await fetch('/api/feedback/form-ui');
    const config = await response.json();

    // Apply background (CSS variable)
    if (config.background) {
      document.documentElement.style.setProperty('--form-bg', config.background);
    }

    // Apply landing page title
    if (config.landingTitle) {
      setText('form-landing-title', config.landingTitle);
    }

    // Apply landing page subtitle
    if (config.landingSubtitle) {
      setText('form-landing-subtitle', config.landingSubtitle);
    }

    const qrEnabled = Boolean(config.showLandingPageQRCode);
    const qrPage = document.getElementById('land-page-qrcode');
    const noQrPage = document.getElementById('land-page-no-qrcode');

    if (qrPage) {
      qrPage.style.display = qrEnabled ? 'block' : 'none';
    }

    if (noQrPage) {
      noQrPage.style.display = qrEnabled ? 'none' : 'block';
    }
  } catch (error) {
    console.error('Error applying form UI configuration:', error);
  }
}

async function loadKioskParameters() {
  try {
    const response = await fetch('/api/parameters');
    const data = await response.json();
    if (!response.ok || !data.success) return;

    kioskParameters = data.parameters || {};
    applyParameterOverrides();
  } catch (error) {
    console.warn('Parameter config unavailable:', error);
  }
}

function getTemporaryRetentionDays() {
    const days = Number(kioskParameters.contentSettings?.temporaryRetentionDays);
    return Number.isFinite(days) && days > 0 ? Math.round(days) : 7;
}

function formatRetentionDays(days) {
    return `${days} ${days === 1 ? 'Day' : 'Days'}`;
}

function getTemporaryRetentionLabel() {
    return formatRetentionDays(getTemporaryRetentionDays());
}

function clampLayoutNumber(value, min, max, fallback) {
    const number = Number(value);
    const safeNumber = Number.isFinite(number) ? number : fallback;
    return Math.min(max, Math.max(min, safeNumber));
}

function applyLandingLayoutSettings(layout = {}) {
    const root = document.documentElement;
    const textScale = clampLayoutNumber(layout.landingTextScale, 0.75, 1.4, 1);
    const panelWidth = clampLayoutNumber(layout.landingPanelWidth, 360, 1000, 600);
    const panelMinHeight = clampLayoutNumber(layout.landingPanelMinHeight, 0, 900, 0);
    const panelPadding = clampLayoutNumber(layout.landingPanelPadding, 20, 120, 60);
    const panelX = clampLayoutNumber(layout.landingPanelOffsetX, -360, 360, 0);
    const panelY = clampLayoutNumber(layout.landingPanelOffsetY, -220, 220, 0);
    const buttonX = clampLayoutNumber(layout.startButtonOffsetX, -220, 220, 0);
    const buttonY = clampLayoutNumber(layout.startButtonOffsetY, -160, 160, 0);
    const buttonWidth = clampLayoutNumber(layout.startButtonWidth, 180, 600, 280);
    const buttonHeight = clampLayoutNumber(layout.startButtonHeight, 44, 120, 64);
    const pledgeButtonX = clampLayoutNumber(layout.pledgeboardButtonOffsetX, -220, 220, 0);
    const pledgeButtonY = clampLayoutNumber(layout.pledgeboardButtonOffsetY, -160, 160, 0);
    const pledgeButtonWidth = clampLayoutNumber(layout.pledgeboardButtonWidth, 180, 900, 600);
    const pledgeButtonHeight = clampLayoutNumber(layout.pledgeboardButtonHeight, 44, 140, 64);

    root.style.setProperty('--landing-text-scale', textScale);
    root.style.setProperty('--landing-title-size', `${Math.round(48 * textScale)}px`);
    root.style.setProperty('--landing-mobile-title-size', `${Math.round(28 * textScale)}px`);
    root.style.setProperty('--landing-subtitle-size', `${Math.round(18 * textScale)}px`);
    root.style.setProperty('--landing-brand-size', `${Math.round(16 * textScale)}px`);
    root.style.setProperty('--landing-control-size', `${Math.round(14 * textScale)}px`);
    root.style.setProperty('--landing-button-size', `${Math.round(16 * textScale)}px`);
    root.style.setProperty('--landing-panel-width', `${panelWidth}px`);
    root.style.setProperty('--landing-panel-min-height', `${panelMinHeight}px`);
    root.style.setProperty('--landing-panel-padding', `${panelPadding}px`);
    root.style.setProperty('--landing-panel-x', `${panelX}px`);
    root.style.setProperty('--landing-panel-y', `${panelY}px`);
    root.style.setProperty('--landing-panel-mobile-x', `${Math.round(panelX * 0.45)}px`);
    root.style.setProperty('--landing-panel-mobile-y', `${Math.round(panelY * 0.45)}px`);
    root.style.setProperty('--start-button-x', `${buttonX}px`);
    root.style.setProperty('--start-button-y', `${buttonY}px`);
    root.style.setProperty('--start-button-width', `${buttonWidth}px`);
    root.style.setProperty('--start-button-height', `${buttonHeight}px`);
    root.style.setProperty('--start-button-mobile-width', `${Math.round(buttonWidth * 0.75)}px`);
    root.style.setProperty('--start-button-mobile-height', `${Math.round(buttonHeight * 0.85)}px`);
    root.style.setProperty('--pledgeboard-button-x', `${pledgeButtonX}px`);
    root.style.setProperty('--pledgeboard-button-y', `${pledgeButtonY}px`);
    root.style.setProperty('--pledgeboard-button-width', `${pledgeButtonWidth}px`);
    root.style.setProperty('--pledgeboard-button-height', `${pledgeButtonHeight}px`);
    root.style.setProperty('--pledgeboard-button-mobile-width', `${Math.round(pledgeButtonWidth * 0.75)}px`);
    root.style.setProperty('--pledgeboard-button-mobile-height', `${Math.round(pledgeButtonHeight * 0.85)}px`);
}

function normalizeStyleHexColor(value, fallback = '#4a7c59') {
    const color = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function shadeHexColor(hex, amount) {
    const safeHex = normalizeStyleHexColor(hex);
    const raw = safeHex.slice(1);
    const channels = [0, 2, 4].map((offset) => {
        const value = parseInt(raw.slice(offset, offset + 2), 16);
        return Math.max(0, Math.min(255, value + amount));
    });
    return `#${channels.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function applyParameterOverrides() {
    const messages = kioskParameters.feedbackMessages || {};
    const content = kioskParameters.contentSettings || {};
    const campaign = kioskParameters.campaignSettings || {};
    const feedbackStyle = kioskParameters.feedbackPageStyle || {};
    const assets = kioskParameters.visualAssets || {};
    const layout = kioskParameters.layoutSettings || {};
    const photo = kioskParameters.photoSettings || {};
    const badgeLeafStyles = getConfiguredBadgeLeafStyles();
    const flags = getFeatureFlags();
    const rules = getValidationRules();
    const retentionDays = getTemporaryRetentionDays();
    const retentionLabel = formatRetentionDays(retentionDays);

    applyLandingLayoutSettings(layout);

    const feedbackBackground = feedbackStyle.backgroundCss || assets.feedbackBackground;
    if (feedbackBackground) {
        document.documentElement.style.setProperty('--form-bg', feedbackBackground);
    }
    const cardOpacity = Math.min(1, Math.max(0.55, Number(feedbackStyle.cardOpacity) || 0.9));
    const accentColor = normalizeStyleHexColor(feedbackStyle.accentColor, '#4a7c59');
    document.documentElement.style.setProperty('--feedback-card-opacity', cardOpacity.toFixed(2));
    document.documentElement.style.setProperty('--feedback-accent-color', accentColor);
    document.documentElement.style.setProperty('--feedback-accent-dark', shadeHexColor(accentColor, -36));
    document.documentElement.style.setProperty('--celebration-leaf-scale', badgeLeafStyles.leafScale);

    const pledgePage = document.getElementById('pledge-page');
    if (pledgePage) pledgePage.dataset.featureEnabled = String(flags.pledgeEnabled !== false);

    const photoPage = document.getElementById('photo-page');
    if (photoPage) photoPage.dataset.featureEnabled = String(flags.cameraCaptureEnabled !== false);

    const uploadPage = document.getElementById('file-upload-page');
    if (uploadPage) uploadPage.dataset.featureEnabled = String(flags.photoUploadEnabled !== false);

    const floatingLanguageSelector = document.querySelector('.floating-language-selector');
    if (floatingLanguageSelector) {
        floatingLanguageSelector.hidden = flags.floatingLanguageSelectorEnabled !== true;
    }

    const photoInput = document.getElementById('photo-input');
    if (photoInput && Array.isArray(rules.allowedPhotoFormats)) {
        photoInput.accept = rules.allowedPhotoFormats.map(format => `image/${format === 'jpg' ? 'jpeg' : format}`).join(',');
    }

    const beautyFilterPanels = document.querySelectorAll('#beauty-filter-setting-panel, #upload-beauty-filter-setting-panel');
    const beautyFeatureEnabled = flags.beautyFilterEnabled !== false && photo.beautyFilterEnabled !== false;
    beautyFilterPanels.forEach((panel) => {
        panel.hidden = !beautyFeatureEnabled;
    });
    if (!beautyFeatureEnabled) {
        setBeautyFilterSetting('off');
    } else if (photo.beautyFilterStrength && BEAUTY_FILTER_PRESETS[photo.beautyFilterStrength]) {
        setBeautyFilterSetting(photo.beautyFilterStrength);
    } else {
        updateBeautyFilterSettings();
    }

    if (currentLanguage === 'en') {
        setText('consent-description', messages.consentPrompt);
        setText('option-7days-title', retentionLabel);
        setText('option-7days-description', `Your feedback data will be deleted after ${retentionDays} ${retentionDays === 1 ? 'day' : 'days'}.`);
        setText('privacy-notice-text', `${retentionLabel} Retention: Your photo and email is retained for ${retentionDays} ${retentionDays === 1 ? 'day' : 'days'} then deleted. Your name and pledge may be displayed publicly.`);
        setText('details-description', messages.detailsPrompt);
        setText('feedback-description', messages.feedbackPrompt);
        setText('pledge-description', messages.pledgePrompt);
        if (campaign.enabled === true && campaign.title) {
            setText('pledge-examples-header', `${campaign.title}: Smart Pledge Coach`);
        }
        setText('thankyou-title', messages.thankYouTitle);
        setText('thankyou-message', messages.thankYouMessage || messages.thankYouSubtitle);
        setText('thankyou-footer-text', messages.thankYouFooter);
    }
}

function getFeatureFlags() {
    // Feature toggles loaded from admin-controlled parameter config (DONE BY CAEDEN)
    return {
        cameraCaptureEnabled: true,
        photoUploadEnabled: true,
        beautyFilterEnabled: true,
        pledgeEnabled: true,
        badgeEmailEnabled: true,
        thankYouEmailEnabled: true,
        socialSharingEnabled: true,
        floatingLanguageSelectorEnabled: false,
        ...(kioskParameters.featureFlags || {})
    };
}

function getValidationRules() {
    // Centralized validation rules loaded from admin-controlled parameter config (DONE BY CAEDEN)
    return {
        nameRequired: true,
        nameMinLength: 2,
        nameMaxLength: 80,
        emailRequired: true,
        emailPattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        requiredQuestionsEnabled: true,
        pledgeRequired: true,
        pledgeMinLength: 5,
        pledgeMaxLength: 500,
        pledgeTopicRequired: true,
        photoRequired: true,
        dailySubmissionLimitPerEmail: 1,
        maxPhotoFileSizeMb: 5,
        allowedPhotoFormats: ['jpeg', 'jpg', 'png', 'webp'],
        ...(kioskParameters.validationRules || {})
    };
}

function matchesConfiguredPattern(value, pattern) {
    try {
        return new RegExp(pattern).test(value);
    } catch (error) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }
}

// Load countdown timer setting from server (DONE BY BERNISSA)
async function loadCountdownTimer() {
    try {
        console.log('Loading countdown timer setting...');
        const response = await fetch('/api/feedback/countdown-timer');
        const data = await response.json();
        
        if (data.success && typeof data.countdown_seconds === 'number') {
            countdownSeconds = data.countdown_seconds >= 0 ? data.countdown_seconds : 3;
            console.log(`Countdown timer loaded: ${countdownSeconds} seconds`);
        } else {
            console.warn('Invalid countdown data, using default');
            countdownSeconds = 3;
        }
    } catch (error) {
        console.error('Error loading countdown timer:', error);
        countdownSeconds = 3; // Fallback to default 3 seconds
    }
}

