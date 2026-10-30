// Feedback (kiosk) page script, split from the former feedback.js by section (move only, nothing changed inside).
// File 10 of 17: details, feedback and pledge submission steps. Owner: Role 1.
// Load order (classic scripts, one shared global scope): core, bear, lostFound, flowPages, faceDetect, faceFilters, init, inactivity, questions, submit, photo, overlays, navigation, backNavigation, events, config, language.
// ==================== 5. FORM SUBMISSION FUNCTIONS ====================

// Submit feedback form with dynamic questions
function submitFeedback(event) {
    event.preventDefault();
    clearValidationMessages();
    
    // Collect all answers
    userData.answers = {};
    
    const allQuestions = document.querySelectorAll('#questions-container .question-group[data-question-id]');
    allQuestions.forEach(question => {
        const questionId = question.getAttribute('data-question-id');
        const questionType = getQuestionType(question);
        
        let answerValue = '';
        
        switch (questionType) {
            case 'text':
                const textarea = question.querySelector('textarea');
                answerValue = textarea ? textarea.value : '';
                break;
                
            case 'yesno':
                const selectedRadio = question.querySelector('input[type="radio"]:checked');
                answerValue = selectedRadio ? selectedRadio.value : '';
                break;
                
            case 'rating':
                const hiddenInput = question.querySelector('input[type="hidden"]');
                answerValue = hiddenInput ? hiddenInput.value : '';
                break;
                
            case 'choice':
                const selectedChoice = question.querySelector('input[type="radio"]:checked');
                answerValue = selectedChoice ? selectedChoice.value : '';
                break;
        }
        
        userData.answers[questionId] = answerValue;
        userData[`q${questionId}`] = answerValue; // for backward compatibility
    });
    
    // Validate required questions
    if (!validateRequiredQuestions()) {
        showFormAlert('feedback-form-alert', getDynamicLanguageText().requiredQuestion);
        nudgeRpBear('One question still needs an answer. I moved you to it.');
        return;
    }

    if (getFeatureFlags().pledgeEnabled === false) {
        cheerRpBear('Feedback captured. Pledge is skipped by settings, so we can move ahead.');
        skipPledge();
        return;
    }

    cheerRpBear('Feedback done. Let us turn that into a small action.');
    showFlowPage('pledge-page');
    resetInactivityTimer();
}

// Submit user details form
function submitDetails(event) {
    event.preventDefault();
    clearValidationMessages();
    const rules = getValidationRules();
    const nameInput = document.getElementById('user-name');
    const emailInput = document.getElementById('user-email');
    userData.name = nameInput.value.trim();
    userData.email = emailInput.value.trim();
    
    if (rules.nameRequired !== false && !userData.name) {
        showFieldError('user-name', 'Please enter your name so we can add it to your submission.');
        nudgeRpBear('Start with your name here. Then we can keep moving.');
        return;
    }

    if (userData.name && userData.name.length < Number(rules.nameMinLength || 0)) {
        showFieldError('user-name', `Please enter at least ${rules.nameMinLength} characters.`);
        nudgeRpBear('Your name needs a little more detail before we continue.');
        return;
    }

    if (userData.name && userData.name.length > Number(rules.nameMaxLength || 9999)) {
        showFieldError('user-name', `Please keep your name within ${rules.nameMaxLength} characters.`);
        nudgeRpBear('That name is a bit too long for the form. Try shortening it.');
        return;
    }

    if (rules.emailRequired !== false && !userData.email) {
        showFieldError('user-email', 'Please enter your email so we can send your RP memory photo.');
        nudgeRpBear('Add your email so your keepsake can find you later.');
        return;
    }

    if (userData.email && !matchesConfiguredPattern(userData.email, rules.emailPattern)) {
        showFieldError('user-email', 'Please enter a valid email address, for example name@example.com.');
        nudgeRpBear('That email looks incomplete. Try something like name@example.com.');
        return;
    }

    cheerRpBear('Details saved. You are ready for the feedback questions.');
    showFlowPage('feedback-page');
    resetInactivityTimer();
}

// Show the photo choice step after pledge instead of forcing photo capture - changes made by nick
function continueAfterPledgeChoice() {
    cheerRpBear(userData.pledgeSkipped ? 'No worries, pledge skipped. Your feedback still matters.' : 'Pledge saved. Now choose your keepsake moment.');
    showFlowPage('photo-choice-page');
    resetInactivityTimer();
}

// Clear optional photo state when the visitor skips photo - changes made by nick
function clearPhotoCaptureData() {
    photoData = null;
    userData.photoId = null;
    userData.processedPhotoId = null;
    userData.processedPhoto = null;
    userData.processedBoomerangFrames = null; // Clear backend GIF frame payload - changes made by nick
    userData.boomerangFrameDelayMs = null; // Clear backend GIF timing payload - changes made by nick
    userData.boomerangQuality = null; // Clear GIF quality metadata (DONE BY NICK)
    boomerangFrames = [];
    clearRestorableBoomerang();
    stopBoomerangPreview();
    stopFaceAccessoryPreview();
}

// Continue into camera/upload when visitor chooses to take photo - changes made by nick
function startPhotoFlow() {
    const flags = getFeatureFlags();
    const rules = getValidationRules();
    userData.photoSkipped = false;

    if (flags.cameraCaptureEnabled === false && flags.photoUploadEnabled === false) {
        if (rules.photoRequired !== false) {
            showVisitorNotice('photo-choice-form-alert', 'Photo capture is currently disabled. Please ask an administrator to disable the photo requirement or re-enable capture.', 'Photo is required, but capture is disabled. A staff member can help.');
            return;
        }
        showFlowPage('confirmation-page');
        updateConfirmationDetails();
        resetInactivityTimer();
        return;
    }

    // MOBILE: Use file upload instead of camera
    if (currentDevice === 'mobile') {
        if (flags.photoUploadEnabled === false) {
            if (rules.photoRequired !== false) {
                showVisitorNotice('photo-choice-form-alert', 'Mobile photo upload is currently disabled. Please ask an administrator to disable the photo requirement or re-enable uploads.', 'Upload is disabled right now. Please ask a staff member for help.');
                return;
            }
            showFlowPage('confirmation-page');
            updateConfirmationDetails();
        } else {
            showFlowPage('file-upload-page');
        }
    } else {
        // DESKTOP: Use camera as before
        if (flags.cameraCaptureEnabled === false) {
            if (rules.photoRequired !== false) {
                showVisitorNotice('photo-choice-form-alert', 'Desktop camera capture is currently disabled. Please ask an administrator to disable the photo requirement or re-enable camera capture.', 'Camera capture is disabled right now. Please ask a staff member for help.');
                return;
            }
            showFlowPage('confirmation-page');
            updateConfirmationDetails();
        } else {
            setRpBearSpeech('Camera time. Try a filter, then I will cheer when your photo is captured.', true);
            showFlowPage('photo-page');
            initializeCamera();
        }
    }

    resetInactivityTimer();
}

// Let visitor skip photo and go straight to confirmation - changes made by nick
function skipPhoto() {
    clearPhotoCaptureData();
    userData.photoSkipped = true;
    userData.captureMode = 'none';
    showFlowPage('confirmation-page');
    updateConfirmationDetails();
    setRpBearSpeech('Photo skipped. I brought you to the final check.', true);
    resetInactivityTimer();
}

// Submit pledge and redirect to appropriate photo method
// Added explicit pledge topic selection support and validation - done by XY
function submitPledge(event) {
    event.preventDefault();
    clearValidationMessages();
    const rules = getValidationRules();
    userData.pledge = document.getElementById('pledge-text').value.trim();
    userData.pledgeTopics = syncPledgeTopicField();
    userData.pledgeTopic = userData.pledgeTopics[0] || '';
    userData.pledgeSkipped = false;

    if (rules.pledgeRequired !== false && !userData.pledge) {
        showFieldError('pledge-text', 'Write one short action you will try. You can also skip the pledge below.');
        nudgeRpBear('Write one short action, or use Skip Pledge if you prefer.');
        return;
    }

    if (userData.pledge && userData.pledge.length < Number(rules.pledgeMinLength || 0)) {
        showFieldError('pledge-text', `Please write at least ${rules.pledgeMinLength} characters.`);
        nudgeRpBear('Your pledge is nearly there. Add a few more words.');
        return;
    }

    if (userData.pledge && userData.pledge.length > Number(rules.pledgeMaxLength || 9999)) {
        showFieldError('pledge-text', `Please keep your pledge within ${rules.pledgeMaxLength} characters.`);
        nudgeRpBear('That pledge is too long. Keep it short and actionable.');
        return;
    }

    if (rules.pledgeTopicRequired !== false && userData.pledgeTopics.length === 0) {
        showFieldError('pledge-topic-options', 'Choose at least one sustainability focus before continuing.');
        nudgeRpBear('Choose one focus area so I know what your pledge supports.');
        return;
    }

    continueAfterPledgeChoice();
}

function skipPledge() {
    userData.pledge = '';
    userData.pledgeTopic = '';
    userData.pledgeTopics = [];
    userData.pledgeSkipped = true;

    const pledgeText = document.getElementById('pledge-text');
    const pledgeTopic = document.getElementById('pledge-topic');
    const charCount = document.getElementById('char-count');
    if (pledgeText) pledgeText.value = '';
    if (pledgeTopic) pledgeTopic.value = '';
    document.querySelectorAll('input[name="pledge-topics"]').forEach(input => {
        input.checked = false;
    });
    if (charCount) charCount.textContent = '0';
    updatePledgeCoach();

    continueAfterPledgeChoice();
}


