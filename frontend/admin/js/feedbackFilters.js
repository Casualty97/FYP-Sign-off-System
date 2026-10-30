// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 7 of 30: filter controls for the feedback and archive tabs. Owner: Role 3.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: no markers in this file   <- counted from the "DONE BY" style markers below
// Current team owner: Role 3, Jun Kai. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
// ==================== 7. FILTER CONTROLS (BOTH TABS) ====================

function toggleFeedbackAdvancedFilters() {
    const panel = document.getElementById('feedback-advanced-filters-panel');
    const icon = document.getElementById('feedback-filter-toggle-icon');
    if (panel && icon) {
        const isHidden = panel.style.display === 'none' || !panel.style.display;
        panel.style.display = isHidden ? 'block' : 'none';
        icon.textContent = isHidden ? '▲' : '▼';
    }
}

function toggleArchiveAdvancedFilters() {
    const panel = document.getElementById('archive-advanced-filters-panel');
    const icon = document.getElementById('archive-filter-toggle-icon');
    if (panel && icon) {
        const isHidden = panel.style.display === 'none' || !panel.style.display;
        panel.style.display = isHidden ? 'block' : 'none';
        icon.textContent = isHidden ? '▲' : '▼';
    }
}

function setFeedbackDateRangePreset(preset) {
    const fromInput = document.getElementById('feedback-filter-date-from');
    const toInput = document.getElementById('feedback-filter-date-to');
    if (!fromInput || !toInput) return;

    // Get current SGT date components
    const { year: y, month: m, day: d, dayOfWeek: dow } = getSGTDateComponents();
    
    // Create a shifted-SGT Date for today
    const sgtToday = new Date(Date.now() + SGT_OFFSET_MS);
    const todayStr = formatDateToSGTString(sgtToday);

    let fromStr;
    
    if (preset === 'today') {
        // Today only
        fromStr = todayStr;
        
    } else if (preset === 'week') {
        // FIXED: Current calendar week (Monday to Sunday) in SGT
        // dow: 0=Sun, 1=Mon, 2=Tue, ... 6=Sat
        // Calculate days since Monday:
        // If today is Sunday (dow=0), days since Monday = 6
        // Otherwise, days since Monday = dow - 1
        const daysSinceMonday = dow === 0 ? 6 : dow - 1;
        
        // Go back to Monday of this week
        const mondayDate = new Date(Date.UTC(y, m, d - daysSinceMonday));
        fromStr = formatDateToSGTString(mondayDate);
        
    } else if (preset === 'month') {
        // From 1st of current month to today
        fromStr = y + '-' + String(m + 1).padStart(2, '0') + '-01';
    }

    fromInput.value = fromStr;
    toInput.value = todayStr;
    filterFeedbackData();
}

function setArchiveDateRangePreset(preset) {
    const fromInput = document.getElementById('archive-filter-date-from');
    const toInput = document.getElementById('archive-filter-date-to');
    if (!fromInput || !toInput) return;

    // Get current SGT date components
    const { year: y, month: m, day: d, dayOfWeek: dow } = getSGTDateComponents();
    
    // Create a shifted-SGT Date for today
    const sgtToday = new Date(Date.now() + SGT_OFFSET_MS);
    const todayStr = formatDateToSGTString(sgtToday);

    let fromStr;
    
    if (preset === 'today') {
        // Today only
        fromStr = todayStr;
        
    } else if (preset === 'week') {
        // FIXED: Current calendar week (Monday to Sunday) in SGT
        const daysSinceMonday = dow === 0 ? 6 : dow - 1;
        const mondayDate = new Date(Date.UTC(y, m, d - daysSinceMonday));
        fromStr = formatDateToSGTString(mondayDate);
        
    } else if (preset === 'month') {
        // From 1st of current month to today
        fromStr = y + '-' + String(m + 1).padStart(2, '0') + '-01';
    }

    fromInput.value = fromStr;
    toInput.value = todayStr;
    filterArchiveData();
}

function clearAllFeedbackFilters() {
    ['feedback-search-input', 'feedback-filter-date-from', 'feedback-filter-date-to',
     'feedback-filter-email', 'feedback-filter-visits', 'feedback-filter-retention'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    feedbackCurrentPage = 1;
    filterFeedbackData();
}

function clearAllArchiveFilters() {
    ['archive-search-input', 'archive-filter-date-from', 'archive-filter-date-to',
     'archive-filter-email', 'archive-filter-visits', 'archive-filter-retention'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    archiveCurrentPage = 1;
    filterArchiveData();
}

