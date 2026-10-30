// Owner: shared. Previous team: Nick (16).
// Part 3/17 of the feedback page: lost and found modal and pending reports (load order in feedback.html).
function updateLostFoundShortcut(pageId) { // changes made by nick
    const shortcut = document.getElementById('lost-found-shortcut');
    if (!shortcut) return;
    shortcut.hidden = !FLOW_PAGE_IDS.includes(pageId);
}

function collectLostFoundFeedbackProgress() { // changes made by nick
    const formValues = {};
    document.querySelectorAll('input, textarea, select').forEach((field) => {
        if (!field.id && !field.name) return;
        if (field.closest('#lost-found-modal')) return;

        const key = field.id || field.name;
        if (field.type === 'checkbox') {
            if (!formValues[key]) formValues[key] = [];
            if (field.checked) formValues[key].push(field.value);
            return;
        }
        if (field.type === 'radio') {
            if (field.checked) formValues[key] = field.value;
            return;
        }
        formValues[key] = field.value;
    });

    return {
        savedAt: new Date().toISOString(),
        activePageId: activeFlowPageId || getVisibleFlowPageId(),
        selectedRetention,
        selectedTheme,
        captureMode,
        selectedFaceAccessory,
        userData: { ...userData },
        hasPhoto: Boolean(photoData || userData.processedPhoto || userData.photoId || userData.processedPhotoId),
        formValues
    };
}

function saveLostFoundFeedbackProgress() { // changes made by nick
    try {
        sessionStorage.setItem(LOST_FOUND_PROGRESS_KEY, JSON.stringify(collectLostFoundFeedbackProgress()));
    } catch (error) {
        console.warn('Unable to save feedback progress before Lost & Found:', error);
    }
}

function openLostFoundModal() { // changes made by nick
    saveLostFoundFeedbackProgress();
    hideIdleWarning();

    const modal = document.getElementById('lost-found-modal');
    const status = document.getElementById('lost-found-status');
    const itemInput = document.getElementById('lost-found-item');
    if (!modal) return;

    if (status) status.textContent = '';
    updateLostFoundSyncStatus();
    modal.style.display = 'flex';
    document.body.classList.add('lost-found-open');
    if (itemInput) itemInput.focus();
    resetInactivityTimer();
}

function closeLostFoundModal() { // changes made by nick
    const modal = document.getElementById('lost-found-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    document.body.classList.remove('lost-found-open');
    resetInactivityTimer();
}

function updateLostFoundSyncStatus() { // Offline Lost & Found queue status (DONE BY NICK)
    const panel = document.getElementById('lost-found-sync-panel');
    const label = document.getElementById('lost-found-sync-status');
    if (!panel || !label) return;

    const pendingCount = getPendingLostFoundReports().length;
    panel.hidden = pendingCount === 0;
    label.textContent = pendingCount === 0
        ? 'No queued reports.'
        : `${pendingCount} report${pendingCount === 1 ? '' : 's'} waiting to sync.`;
}

function clearLostFoundPhoto(clearInput = true) { // Clear optional item photo preview (DONE BY NICK)
    lostFoundPhotoDataUrl = null;
    lostFoundPhotoName = '';
    lostFoundPhotoReadPromise = Promise.resolve(true);
    const input = document.getElementById('lost-found-photo');
    const preview = document.getElementById('lost-found-photo-preview');
    const previewImg = document.getElementById('lost-found-photo-preview-img');
    if (clearInput && input) input.value = '';
    if (previewImg) previewImg.removeAttribute('src');
    if (preview) preview.hidden = true;
}

function setupLostFoundPhotoPreview() { // Optional item photo reader (DONE BY NICK)
    const input = document.getElementById('lost-found-photo');
    const preview = document.getElementById('lost-found-photo-preview');
    const previewImg = document.getElementById('lost-found-photo-preview-img');
    const status = document.getElementById('lost-found-status');
    if (!input || !preview || !previewImg) return;

    input.addEventListener('change', () => {
        const file = input.files?.[0];
        clearLostFoundPhoto(false); // Keep the selected file available while FileReader loads it (DONE BY NICK)
        if (!file) return;

        const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
        const maxBytes = 2 * 1024 * 1024;
        if (!allowedTypes.has(file.type)) {
            clearLostFoundPhoto();
            if (status) status.textContent = 'Please upload a PNG, JPEG, GIF, or WebP item photo.';
            return;
        }
        if (file.size > maxBytes) {
            clearLostFoundPhoto();
            if (status) status.textContent = 'Item photo must be 2MB or smaller.';
            return;
        }

        const reader = new FileReader();
        if (status) status.textContent = 'Preparing item photo...';
        lostFoundPhotoReadPromise = new Promise((resolve) => {
            reader.onload = () => {
                lostFoundPhotoDataUrl = String(reader.result || '');
                lostFoundPhotoName = file.name;
                previewImg.src = lostFoundPhotoDataUrl;
                preview.hidden = false;
                if (status) status.textContent = 'Item photo attached.';
                resolve(true);
            };
            reader.onerror = () => {
                clearLostFoundPhoto();
                if (status) status.textContent = 'Could not read that item photo. Try another image.';
                resolve(false);
            };
            reader.readAsDataURL(file);
        });
    });
}

function getPendingLostFoundReports() { // changes made by nick
    try {
        return JSON.parse(localStorage.getItem(LOST_FOUND_PENDING_KEY) || '[]');
    } catch (error) {
        console.warn('Unable to read pending Lost & Found reports:', error);
        return [];
    }
}

function savePendingLostFoundReport(report, feedbackProgress) { // changes made by nick
    try {
        const pendingReports = getPendingLostFoundReports();
        pendingReports.push({
            report,
            feedbackProgress,
            queuedAt: new Date().toISOString()
        });
        localStorage.setItem(LOST_FOUND_PENDING_KEY, JSON.stringify(pendingReports.slice(-50)));
        updateLostFoundSyncStatus();
    } catch (error) {
        console.warn('Unable to queue Lost & Found report locally:', error);
        const photoFreeReport = { ...report, itemPhotoDataUrl: null, itemPhotoName: '' };
        try {
            const pendingReports = getPendingLostFoundReports();
            pendingReports.push({
                report: photoFreeReport,
                feedbackProgress,
                queuedAt: new Date().toISOString()
            });
            localStorage.setItem(LOST_FOUND_PENDING_KEY, JSON.stringify(pendingReports.slice(-50)));
            updateLostFoundSyncStatus();
        } catch (fallbackError) {
            console.warn('Unable to queue photo-free Lost & Found report locally:', fallbackError);
        }
    }
}

async function postLostFoundReport(report, feedbackProgress) { // changes made by nick
    const response = await fetch('/api/feedback/lost-found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, feedbackProgress })
    });
    const responseText = await response.text();
    let data = {};

    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
        data = { error: responseText.slice(0, 140) };
    }

    if (!response.ok || !data.success) {
        throw new Error(data.error || `Server returned ${response.status}`);
    }

    return data;
}

function lostFoundReportNeedsPhotoWarning(report, result) { // Detect old backend responses that ignored the uploaded item photo (DONE BY NICK)
    return Boolean(report?.itemPhotoDataUrl) && !Boolean(result?.itemPhotoPath);
}

async function syncPendingLostFoundReports() { // changes made by nick
    const pendingReports = getPendingLostFoundReports();
    if (!pendingReports.length) return;

    const remainingReports = [];
    for (const pending of pendingReports) {
        try {
            await postLostFoundReport(pending.report, pending.feedbackProgress);
        } catch (error) {
            remainingReports.push(pending);
        }
    }

    localStorage.setItem(LOST_FOUND_PENDING_KEY, JSON.stringify(remainingReports));
    updateLostFoundSyncStatus();
}

async function submitLostFoundReport(event) { // changes made by nick
    event.preventDefault();

    const type = document.querySelector('input[name="lost-found-type"]:checked')?.value || 'lost';
    const item = document.getElementById('lost-found-item')?.value.trim() || '';
    const location = document.getElementById('lost-found-location')?.value.trim() || '';
    const contact = document.getElementById('lost-found-contact')?.value.trim() || '';
    const details = document.getElementById('lost-found-details')?.value.trim() || '';
    const status = document.getElementById('lost-found-status');

    if (!item || !location || !contact) {
        if (status) status.textContent = 'Please fill in the item, location, and contact fields.';
        return;
    }

    let feedbackProgress = null;
    let report = null;

    try {
        const hasSelectedPhoto = Boolean(document.getElementById('lost-found-photo')?.files?.[0]);
        if (status) status.textContent = hasSelectedPhoto ? 'Saving report and photo...' : 'Saving report...';
        await lostFoundPhotoReadPromise;

        feedbackProgress = collectLostFoundFeedbackProgress();
        report = {
            type,
            item,
            location,
            contact,
            details,
            itemPhotoDataUrl: lostFoundPhotoDataUrl,
            itemPhotoName: lostFoundPhotoName,
            activePageId: feedbackProgress.activePageId,
            submittedAt: new Date().toISOString()
        };

        const result = await postLostFoundReport(report, feedbackProgress);
        await syncPendingLostFoundReports();
        if (status) {
            status.textContent = lostFoundReportNeedsPhotoWarning(report, result)
                ? `Report saved, but the server did not save the photo. Please restart the kiosk/backend server, then submit again. Tracking code: ${result.trackingCode || result.reportId}.`
                : `Report saved. Tracking code: ${result.trackingCode || result.reportId}. You can return to your feedback form now.`;
        }
        const form = document.getElementById('lost-found-form');
        if (form) form.reset();
        clearLostFoundPhoto();
        const lostOption = document.querySelector('input[name="lost-found-type"][value="lost"]');
        if (lostOption) lostOption.checked = true;
    } catch (error) {
        console.warn('Unable to save Lost & Found report:', error);
        if (report && feedbackProgress) savePendingLostFoundReport(report, feedbackProgress);
        if (status) {
            status.textContent = 'Saved on this kiosk. It will sync to admin when the server is available.';
        }
    }
    updateLostFoundSyncStatus();
    resetInactivityTimer();
}

function setupLostFoundModal() { // changes made by nick
    const modal = document.getElementById('lost-found-modal');
    if (!modal) return;

    syncPendingLostFoundReports();
    setupLostFoundPhotoPreview();
    updateLostFoundSyncStatus();

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeLostFoundModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'flex') {
            closeLostFoundModal();
        }
    });
}
