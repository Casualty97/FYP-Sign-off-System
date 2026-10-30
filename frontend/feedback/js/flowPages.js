// Owner: Role 1, Zihan. Previous team: Nick (6).
// Part 4/17 of the feedback page: landing and flow page switching, validation messages, progress indicators (load order in feedback.html).

function hideLandingPages() {
    ['land-page-no-qrcode', 'land-page-qrcode'].forEach(id => {
        const page = document.getElementById(id);
        if (page) page.style.display = 'none';
    });
}

function showLandingPages() {
    if (flowSlideTransitionTimer) {
        clearTimeout(flowSlideTransitionTimer);
        flowSlideTransitionTimer = null;
    }

    FLOW_PAGE_IDS.forEach(id => {
        const page = document.getElementById(id);
        if (page) {
            clearFlowSlideClasses(page);
            page.style.display = 'none';
        }
    });
    activeFlowPageId = null; // Reset slide tracking when returning to landing - changes made by nick
    closeLostFoundModal();
    updateRpBearCompanion(null);
    updateLostFoundShortcut(null);
    applyFormUIConfig();
    loadLandingVisitorCount(); // Refresh live visitor count on start screen (DONE BY NICK)
}

function showFlowPage(pageId) {
    // Stop boomerang animation when leaving the style preview - changes made by nick
    if (pageId !== 'style-page') {
        stopBoomerangPreview();
    }
    if (pageId !== 'photo-page') {
        stopFaceAccessoryPreview();
    }

    hideLandingPages();
    const nextPage = document.getElementById(pageId);
    const currentPageId = activeFlowPageId || getVisibleFlowPageId();
    const currentPage = currentPageId ? document.getElementById(currentPageId) : null;

    if (flowSlideTransitionTimer) {
        clearTimeout(flowSlideTransitionTimer);
        flowSlideTransitionTimer = null;
    }

    if (shouldSkipFlowSlideTransition(currentPage, nextPage)) {
        FLOW_PAGE_IDS.forEach(id => {
            const page = document.getElementById(id);
            if (!page) return;
            clearFlowSlideClasses(page);
            page.style.display = id === pageId ? 'flex' : 'none';
        });
        activeFlowPageId = pageId;
        updateProgressIndicator(pageId);
        updateRpBearCompanion(pageId);
        updateLostFoundShortcut(pageId);
        return;
    }

    const isForward = getFlowPageOrderIndex(pageId) >= getFlowPageOrderIndex(currentPageId);

    FLOW_PAGE_IDS.forEach(id => {
        const page = document.getElementById(id);
        if (!page) return;
        clearFlowSlideClasses(page);
        if (id !== currentPageId && id !== pageId) {
            page.style.display = 'none';
        }
    });

    currentPage.style.display = 'flex';
    nextPage.style.display = 'flex';
    currentPage.classList.add('flow-slide-transitioning');
    nextPage.classList.add(
        'flow-slide-transitioning',
        isForward ? 'flow-slide-enter-right' : 'flow-slide-enter-left'
    );

    // Force the browser to apply the off-screen starting position before sliding in.
    void nextPage.offsetWidth;

    requestAnimationFrame(() => {
        currentPage.classList.add(isForward ? 'flow-slide-exit-left' : 'flow-slide-exit-right');
        nextPage.classList.remove(isForward ? 'flow-slide-enter-right' : 'flow-slide-enter-left');
    });

    flowSlideTransitionTimer = window.setTimeout(() => {
        clearFlowSlideClasses(currentPage);
        clearFlowSlideClasses(nextPage);
        currentPage.style.display = 'none';
        nextPage.style.display = 'flex';
        activeFlowPageId = pageId;
        updateRpBearCompanion(pageId);
        updateLostFoundShortcut(pageId);
        flowSlideTransitionTimer = null;
    }, FLOW_SLIDE_TRANSITION_MS);

    activeFlowPageId = pageId;
    updateProgressIndicator(pageId);
    updateRpBearCompanion(pageId);
    updateLostFoundShortcut(pageId);
}

function clearValidationMessages() {
    document.querySelectorAll('.field-error, .form-alert').forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
        el.classList.remove('is-visible'); // Reset inline notice animation state - changes made by nick
    });
    document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    const group = field.closest('.form-group') || field.closest('.question-group');
    if (group) group.classList.add('has-error');

    let error = group ? group.querySelector('.field-error') : null;
    if (!error && group) {
        error = document.createElement('p');
        error.className = 'field-error';
        group.appendChild(error);
    }
    if (error) {
        error.textContent = message;
        error.style.display = 'block';
    }

    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.focus({ preventScroll: true });
}

function showFormAlert(formId, message) {
    const alert = document.getElementById(formId);
    if (!alert) return;
    alert.textContent = message;
    alert.style.display = 'block';
    alert.classList.add('is-visible'); // Styled inline notice instead of browser alert - changes made by nick
    alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showVisitorNotice(formId, message, bearMessage = '') { // Replace disruptive browser alerts with inline notices - changes made by nick
    showFormAlert(formId, message);
    if (bearMessage) {
        nudgeRpBear(bearMessage);
    }
}

function initializeProgressIndicators() {
    FLOW_STEPS.forEach((step) => {
        step.pageIds.forEach(pageId => {
            const page = document.getElementById(pageId);
            const card = page?.querySelector('.consent-card, .feedback-form-card, .photo-card, .style-card');
            if (!card || card.querySelector('.step-progress')) return;

            const progress = document.createElement('nav');
            progress.className = 'step-progress';
            progress.setAttribute('aria-label', 'Feedback progress');
            const progressLabels = getDynamicLanguageText().flowSteps;
            progress.innerHTML = FLOW_STEPS.map(item => `
                <div class="progress-step" data-step="${item.key}">
                    <span class="progress-dot"></span>
                    <span class="progress-label">${progressLabels[item.key] || item.label}</span>
                </div>
            `).join('');
            card.prepend(progress);
        });
    });
}


