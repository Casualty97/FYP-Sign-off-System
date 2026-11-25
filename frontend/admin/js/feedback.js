// Owner: Role 3, Jun Kai. Previous team: Caeden (1).
// Part 5/30 of the admin page: feedback data table and sorting (load order in admin.html).
// ==================== 5. FEEDBACK DATA MANAGEMENT (NOT_ARCHIVED) ====================


// Load ALL feedback data (archive_status = 'not_archived')
async function loadFeedbackData() {
    try {
        console.log('📊 Loading feedback data (not_archived)...');
        
        const response = await fetch('/api/admin/feedback', {
            headers: {
                'x-username': sessionStorage.getItem('loggedUser')
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            allFeedbackData = data.feedback || [];
            feedbackCurrentPage = 1;
            
            console.log(`✅ Loaded ${allFeedbackData.length} feedback records`);
            
            // Reset decryption
            decryptedEmailMap = {};
            isAnyEmailDecrypted = false;
            
            // Apply filters
            filterFeedbackData();
        } else {
            throw new Error(data.error || 'Failed to load feedback data');
        }
    } catch (error) {
        console.error('❌ Error loading feedback:', error);
        
        // Show error in table
        const tbody = document.getElementById('feedback-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 40px; color: #ef4444;">
                        ❌ Error connecting to server<br>
                        <small class="text-muted">${error.message}</small>
                    </td>
                </tr>
            `;
        }
        
        updateFeedbackPaginationControls(0, 0);
    }
}

// ── Singapore-time helpers ──────────────────────────────────────────────────
// SGT = UTC+8. All date-picker values are plain "YYYY-MM-DD" strings.
// These functions convert date-picker strings into UTC epoch timestamps
// corresponding to the START or END of that calendar day in Singapore.
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;   // 8 hours in ms

/**
 * Get current Singapore date components
 * @returns {Object} { year, month (0-based), day, dayOfWeek (0=Sun, 1=Mon...) }
 */
function getSGTDateComponents() {
    const sgt = new Date(Date.now() + SGT_OFFSET_MS);
    return {
        year: sgt.getUTCFullYear(),
        month: sgt.getUTCMonth(),      // 0-based
        day: sgt.getUTCDate(),
        dayOfWeek: sgt.getUTCDay()     // 0=Sunday, 1=Monday, etc.
    };
}

/**
 * Convert YYYY-MM-DD string to start of day in SGT (returned as UTC Date)
 * midnight SGT = previous-day 16:00 UTC
 */
function startOfDaySGT(dateStr) {
    return new Date(new Date(dateStr + 'T00:00:00Z').getTime() - SGT_OFFSET_MS);
}

/**
 * Convert YYYY-MM-DD string to end of day in SGT (returned as UTC Date)
 * 23:59:59.999 SGT = same-day 15:59:59.999 UTC
 */
function endOfDaySGT(dateStr) {
    return new Date(new Date(dateStr + 'T23:59:59.999Z').getTime() - SGT_OFFSET_MS);
}

/**
 * Format a shifted-SGT Date object to YYYY-MM-DD string
 */
function formatDateToSGTString(sgtDate) {
    return sgtDate.getUTCFullYear() + '-' +
           String(sgtDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
           String(sgtDate.getUTCDate()).padStart(2, '0');
}
// ────────────────────────────────────────────────────────────────────────────

// Filter feedback data based on all active filters
function filterFeedbackData() {
    const searchTerm = document.getElementById('feedback-search-input')?.value.toLowerCase() || '';
    const dateFrom = document.getElementById('feedback-filter-date-from')?.value || '';
    const dateTo = document.getElementById('feedback-filter-date-to')?.value || '';
    const emailFilter = document.getElementById('feedback-filter-email')?.value || '';
    const visitsFilter = document.getElementById('feedback-filter-visits')?.value || '';
    const retentionFilter = document.getElementById('feedback-filter-retention')?.value || '';
    
    // Count active filters
    let activeFiltersCount = 0;
    if (searchTerm) activeFiltersCount++;
    if (dateFrom || dateTo) activeFiltersCount++;
    if (emailFilter) activeFiltersCount++;
    if (visitsFilter) activeFiltersCount++;
    if (retentionFilter) activeFiltersCount++;
    
    // Filter ALL data
    filteredFeedbackData = allFeedbackData.filter(item => {
        let matches = true;
        
        // Global search filter
        if (searchTerm) {
            const searchableText = [
                item.name || '',
                String(item.visits || ''),
                item.pledge || '',
                item.date ? new Date(item.date).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }) : ''
            ].join(' ').toLowerCase();
            
            matches = matches && searchableText.includes(searchTerm);
        }
        
        // Date range filter — boundaries computed in Singapore time
        if (dateFrom || dateTo) {
            const itemDate = new Date(item.date);
            if (dateFrom) {
                matches = matches && itemDate >= startOfDaySGT(dateFrom);
            }
            if (dateTo) {
                matches = matches && itemDate <= endOfDaySGT(dateTo);
            }
        }
        
        // Email filter proper detection
        if (emailFilter) {
            const hasEmail = item.email_encrypted && 
                            item.email_encrypted.trim() !== '' && 
                            item.email_encrypted.toLowerCase() !== 'no email provided';
            
            if (emailFilter === 'has_email') {
                matches = matches && hasEmail;
            } else if (emailFilter === 'no_email') {
                matches = matches && !hasEmail;
            }
        }
        
        // Visits filter
        if (visitsFilter) {
            const visits = parseInt(item.visits) || 0;
            if (visitsFilter === '6+') {
                matches = matches && visits >= 6;
            } else {
                matches = matches && visits === parseInt(visitsFilter);
            }
        }
        
        // Data retention filter - Handle both formats
        if (retentionFilter) {
            const itemRetention = (item.data_retention || '').toLowerCase();
            const filterValue = retentionFilter.toLowerCase();
            
            if (filterValue === '7days' || filterValue === '7day') {
                matches = matches && (itemRetention === '7days' || itemRetention === '7day');
            } else if (filterValue === 'longterm') {
                matches = matches && itemRetention === 'longterm';
            }
        }
        
        return matches;
    });
    
    // Update UI counts
    updateFeedbackCounts(allFeedbackData.length, filteredFeedbackData.length, activeFiltersCount);

    // Keep the column sort the admin chose
    if (feedbackSortColumn) {
        filteredFeedbackData.sort((a, b) => compareValues(a[feedbackSortColumn], b[feedbackSortColumn], feedbackSortColumn));
        if (!feedbackSortAsc) filteredFeedbackData.reverse();
    }
    
    // Reset to page 1
    feedbackCurrentPage = 1;
    
    // Reset decryption when filters change
    decryptedEmailMap = {};
    isAnyEmailDecrypted = false;
    
    // Render filtered data
    renderFeedbackPage();
}

// <Jun Kai start>
// The Feedback page since the admin redesign (Feedback A): filters as chips, compact rows, and a side panel that shows
// one submission. Loading, filtering, sorting, paging and the email buttons are the code above and in encryption.js;
// this part only draws.

// Shows which filters are set: a set chip is tinted, the date chip names its range, and Clear filters appears
function updateFeedbackCounts(total, filtered, activeFilters) {
    const clear = document.getElementById('feedback-clear-filters');
    if (clear) clear.hidden = activeFilters === 0;
    for (const id of ['feedback-filter-email', 'feedback-filter-visits', 'feedback-filter-retention']) {
        const select = document.getElementById(id);
        if (select) select.classList.toggle('is-set', select.value !== '');
    }
    const from = document.getElementById('feedback-filter-date-from')?.value || '';
    const to = document.getElementById('feedback-filter-date-to')?.value || '';
    const label = document.getElementById('feedback-date-label');
    const day = (text) => new Date(text + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
    if (label) label.textContent = from && to ? (from === to ? day(from) : `${day(from)} to ${day(to)}`) : from ? `From ${day(from)}` : to ? `Until ${day(to)}` : 'Any date';
    document.getElementById('feedback-date-button')?.classList.toggle('is-set', !!(from || to));
}

function clearFeedbackDateRange() {
    for (const id of ['feedback-filter-date-from', 'feedback-filter-date-to']) {
        const input = document.getElementById(id);
        if (input) input.value = '';
    }
    filterFeedbackData();
}
// <Jun Kai end>

// Show the user's typed feedback directly in the admin feedback table. (DONE BY CAEDEN)
function getFeedbackAnswerPreview(feedback) {
    const answers = Array.isArray(feedback.question_answers) ? feedback.question_answers : [];
    const textAnswers = answers
        .filter(answer => answer && String(answer.answer_value || '').trim() !== '')
        .filter(answer => String(answer.question_type || '').toLowerCase() === 'text')
        .map(answer => String(answer.answer_value).trim());

    const values = textAnswers.length > 0
        ? textAnswers
        : answers
            .filter(answer => answer && String(answer.answer_value || answer.option_label || '').trim() !== '')
            .map(answer => String(answer.option_label || answer.answer_value).trim());

    if (values.length === 0) {
        return null;
    }

    const preview = values.join(' | ');
    return preview.length > 120 ? `${preview.slice(0, 117)}...` : preview;
}

// <Jun Kai start>
const FEEDBACK_AVATAR_HUES = [262, 168, 334, 28, 214, 150, 12, 232];
let feedbackPanelId = null; // the submission the side panel shows, null while it is closed

function feedbackHasEmail(feedback) {
    const text = String(feedback.email_encrypted || '').trim();
    return text !== '' && text.toLowerCase() !== 'no email provided';
}

function feedbackInitials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

function feedbackDateText(feedback) {
    const date = new Date(feedback.date);
    if (Number.isNaN(date.getTime())) return 'Date unknown';
    return date.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// the line under a visitor's name: the email once it is decrypted, "Encrypted" while it is locked, or "No email"
function feedbackEmailLine(feedback) {
    if (decryptedEmailMap[feedback.id]) return `<span class="fb-email fb-email-open">${uiIcon('unlock', 12)}${escapeHtmlSafe(decryptedEmailMap[feedback.id])}</span>`;
    if (feedbackHasEmail(feedback)) return `<span class="fb-email">${uiIcon('lock', 12)}Encrypted</span>`;
    return '<span class="fb-email fb-email-none">No email</span>';
}

function feedbackKeptBadge(feedback) {
    const retention = feedback.data_retention || 'longterm';
    return retention === '7days' || retention === '7day'
        ? '<span class="badge badge-warning">7 days</span>'
        : '<span class="badge badge-permanent">Long-term</span>';
}

// a small picture made by the server (GET /api/admin/feedback/:id/thumb/:kind), so a page of 25 rows does not load 50 full photos
function feedbackThumb(feedback, kind) {
    const has = kind === 'raw' ? feedback.photo_path : feedback.processed_photo_path;
    const what = kind === 'raw' ? 'Raw photo' : 'Processed photo';
    if (!has) return `<span class="fb-thumb fb-thumb-none" title="No ${what.toLowerCase()}">${uiIcon('image', 14)}</span>`;
    return `<img class="fb-thumb" loading="lazy" decoding="async" width="40" height="40" src="/api/admin/feedback/${Number(feedback.id)}/thumb/${kind}" alt="${what} of ${escapeHtmlSafe(feedback.name || 'Anonymous')}" onerror="this.replaceWith(Object.assign(document.createElement('span'), { className: 'fb-thumb fb-thumb-none', title: 'The photo file is missing' }))">`;
}

function feedbackCanDelete() {
    const role = sessionStorage.getItem('userRole');
    return role === 'IT_admin' || role === 'system_admin';
}

// Render current page of feedback (25 records)
function renderFeedbackPage() {
    const tbody = document.getElementById('feedback-table-body');
    if (!tbody) return;

    const totalPages = Math.ceil(filteredFeedbackData.length / feedbackItemsPerPage);
    const startIndex = (feedbackCurrentPage - 1) * feedbackItemsPerPage;
    const pageData = filteredFeedbackData.slice(startIndex, startIndex + feedbackItemsPerPage);

    // the encrypted emails of this page only: Decrypt works page by page
    encryptedFeedbackIds = pageData.filter(feedbackHasEmail).map((item) => item.id);

    if (filteredFeedbackData.length === 0) {
        const none = allFeedbackData.length === 0;
        tbody.innerHTML = `<tr><td colspan="8" class="ui-empty">${none ? 'No feedback yet. A submission shows here as soon as a visitor sends one.' : 'No submission matches these filters. <button type="button" class="fb-link" onclick="clearAllFeedbackFilters()">Clear filters</button>'}</td></tr>`;
        updateFeedbackPaginationControls(0, 0);
        updateEncryptionButtons();
        syncFeedbackPanel();
        return;
    }

    const canDelete = feedbackCanDelete();
    tbody.innerHTML = pageData.map((feedback) => {
        const id = Number(feedback.id);
        const name = feedback.name || 'Anonymous';
        const pledge = String(feedback.pledge || '').trim();
        const typed = getFeedbackAnswerPreview(feedback);
        const answers = Array.isArray(feedback.question_answers) ? feedback.question_answers.length : 0;
        return `<tr data-feedback-id="${id}" data-retention="${escapeHtmlSafe(feedback.data_retention || 'longterm')}" tabindex="0" aria-label="Open the submission of ${escapeHtmlSafe(name)}"${id === feedbackPanelId ? ' class="is-open"' : ''}>
            <td><span class="fb-who"><span class="fb-avatar" style="--fb-hue: ${FEEDBACK_AVATAR_HUES[id % FEEDBACK_AVATAR_HUES.length]}" aria-hidden="true">${escapeHtmlSafe(feedbackInitials(name))}</span><span class="fb-who-text"><b>${escapeHtmlSafe(name)}</b>${feedbackEmailLine(feedback)}</span></span></td>
            <td class="fb-num">${Number(feedback.visits) || 1}</td>
            <td class="fb-wrap">${pledge ? `<span class="fb-clamp">${escapeHtmlSafe(pledge)}</span>` : '<span class="ui-muted">No pledge</span>'}</td>
            <td class="fb-wrap">${typed ? `<span class="fb-clamp">${escapeHtmlSafe(typed)}</span>` : '<span class="ui-muted">No typed feedback</span>'}${answers ? `<button type="button" class="fb-link" data-fb-answers>${answers} ${answers === 1 ? 'answer' : 'answers'}</button>` : ''}</td>
            <td>${feedbackKeptBadge(feedback)}</td>
            <td><span class="fb-thumbs">${feedbackThumb(feedback, 'raw')}${feedbackThumb(feedback, 'processed')}</span></td>
            <td class="ui-time fb-date-cell">${escapeHtmlSafe(feedbackDateText(feedback))}</td>
            <td><span class="ui-actions">${canDelete ? `<button type="button" class="ui-btn ui-btn-icon ui-danger" data-fb-delete title="Delete this submission" aria-label="Delete the submission of ${escapeHtmlSafe(name)}">${uiIcon('trash', 15)}</button>` : ''}</span></td>
        </tr>`;
    }).join('');

    updateFeedbackPaginationControls(filteredFeedbackData.length, totalPages);
    updateEncryptionButtons();
    syncFeedbackPanel();
}

// one listener for the whole list: a click or Enter on a row opens its panel, the bin deletes, "3 answers" opens the panel at the answers
function feedbackRowAction(event) {
    const row = event.target.closest('tr[data-feedback-id]');
    if (!row) return;
    const id = Number(row.dataset.feedbackId);
    if (event.type === 'keydown') {
        if ((event.key !== 'Enter' && event.key !== ' ') || event.target !== row) return;
        event.preventDefault();
        return openFeedbackPanel(id);
    }
    if (event.target.closest('[data-fb-delete]')) return deleteFeedback(id);
    if (event.target.closest('a, input, select')) return;
    openFeedbackPanel(id, event.target.closest('[data-fb-answers]') ? 'answers' : undefined);
}

function updateFeedbackPaginationControls(totalItems, totalPages) {
    const prevBtn = document.getElementById('prev-feedback-btn');
    const nextBtn = document.getElementById('next-feedback-btn');
    const pageInfo = document.getElementById('feedback-page-info');

    if (prevBtn) prevBtn.disabled = feedbackCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = feedbackCurrentPage >= totalPages || totalPages === 0;

    if (pageInfo) {
        const first = (feedbackCurrentPage - 1) * feedbackItemsPerPage + 1;
        const last = Math.min(totalItems, feedbackCurrentPage * feedbackItemsPerPage);
        const filtered = totalItems !== allFeedbackData.length ? ` (${allFeedbackData.length} in total)` : '';
        pageInfo.textContent = totalItems > 0 ? `Showing ${first} to ${last} of ${totalItems}${filtered}` : 'Nothing to show';
    }
}

// ---- the side panel: one submission in full

function feedbackPanelPhoto(feedback, kind) {
    const rel = kind === 'raw' ? feedback.photo_path : feedback.processed_photo_path;
    const what = kind === 'raw' ? 'Raw photo' : 'Processed photo';
    if (!rel) return `<figure class="fb-photo-box"><div class="fb-photo fb-photo-none">${uiIcon('image', 22)}<span>No ${what.toLowerCase()}</span></div><figcaption><span>${what}</span></figcaption></figure>`;
    const url = '/uploads/' + String(rel).split('/').map(encodeURIComponent).join('/');
    const ext = (String(rel).match(/\.[a-z0-9]+$/i) || ['.png'])[0];
    const open = kind === 'raw' ? 'viewRawPhoto' : 'viewProcessedPhoto';
    return `<figure class="fb-photo-box">
        <button type="button" class="fb-photo" onclick="${open}(${Number(feedback.id)})" title="Open the full photo"><img src="${escapeHtmlSafe(url)}" loading="lazy" decoding="async" alt="${what} of ${escapeHtmlSafe(feedback.name || 'Anonymous')}" onerror="this.closest('.fb-photo').classList.add('fb-photo-missing')"></button>
        <figcaption><span>${what}</span><button type="button" class="fb-link" data-fb-download="${escapeHtmlSafe(url)}" data-fb-file="feedback_${Number(feedback.id)}_${kind}_photo${escapeHtmlSafe(ext)}">Download</button></figcaption>
    </figure>`;
}

function feedbackPanelHtml(feedback) {
    const id = Number(feedback.id);
    const name = feedback.name || 'Anonymous';
    const pledge = String(feedback.pledge || '').trim();
    const typed = getFeedbackAnswerPreview(feedback);
    const answers = Array.isArray(feedback.question_answers) ? feedback.question_answers : [];
    const index = filteredFeedbackData.findIndex((item) => Number(item.id) === id);
    const retention = feedback.data_retention || 'longterm';
    const admin = sessionStorage.getItem('userRole') === 'system_admin';
    const email = decryptedEmailMap[feedback.id]
        ? `<span class="fb-email fb-email-open">${uiIcon('unlock', 12)}${escapeHtmlSafe(decryptedEmailMap[feedback.id])}</span>`
        : feedbackHasEmail(feedback)
            ? `<span class="fb-email">${uiIcon('lock', 12)}Encrypted</span>${admin ? ' <button type="button" class="fb-link" onclick="decryptAllEmails()">Decrypt this page</button>' : ''}`
            : 'No email provided';
    const answerRows = answers.map((answer, n) => {
        const value = answer && (answer.option_label || answer.answer_value);
        return `<li><small>${escapeHtmlSafe(answer.question_text || `Question ${n + 1}`)}</small><span>${value ? formatAnswer(String(value), String(answer.question_type || '').toLowerCase()) : '<em>No answer</em>'}</span></li>`;
    }).join('');
    return `
        <header class="fb-panel-head">
            <div>
                <h3 id="feedback-panel-title" tabindex="-1">${escapeHtmlSafe(name)}</h3>
                <p>Submitted ${escapeHtmlSafe(feedbackDateText(feedback))}</p>
            </div>
            <button type="button" class="ui-btn ui-btn-icon" onclick="closeFeedbackPanel()" title="Close" aria-label="Close this submission">${uiIcon('close', 16)}</button>
        </header>
        <div class="fb-panel-body">
            <div class="fb-photos">${feedbackPanelPhoto(feedback, 'raw')}${feedbackPanelPhoto(feedback, 'processed')}</div>
            <section>
                <h4>Pledge</h4>
                ${pledge
                    ? `<div class="fb-text fb-quote" id="feedback-panel-pledge">${escapeHtmlSafe(pledge)}</div>
                       <button type="button" class="fb-link" onclick="translateAdminTextToEnglish('feedback-panel-pledge', 'feedback-panel-pledge-english', this)">Translate to English</button>
                       <div class="fb-text fb-translated" id="feedback-panel-pledge-english" aria-live="polite"></div>`
                    : '<div class="fb-text ui-muted">No pledge</div>'}
            </section>
            <section>
                <h4>Typed feedback</h4>
                <div class="fb-text${typed ? '' : ' ui-muted'}">${typed ? escapeHtmlSafe(typed) : 'No typed feedback'}</div>
            </section>
            <section id="feedback-panel-answers">
                <h4>Questions and answers</h4>
                ${answerRows ? `<ul class="fb-answers">${answerRows}</ul>` : '<div class="fb-text ui-muted">No answers</div>'}
            </section>
            <dl class="ui-kv fb-facts">
                <dt>Email</dt><dd>${email}</dd>
                <dt>Visits</dt><dd>${Number(feedback.visits) || 1}</dd>
                <dt>Data retention</dt><dd>${retention === '7days' || retention === '7day' ? '7 days' : 'Long-term use'}</dd>
                <dt>Submitted</dt><dd>${escapeHtmlSafe(feedbackDateText(feedback))}</dd>
            </dl>
        </div>
        <footer class="fb-panel-foot">
            ${feedbackCanDelete() ? `<button type="button" class="ui-btn ui-btn-danger" onclick="deleteFeedback(${id})">${uiIcon('trash', 15)}Delete this submission</button>` : '<span class="ui-muted">View only</span>'}
            <span class="fb-spacer"></span>
            <button type="button" class="ui-btn ui-btn-secondary" onclick="stepFeedbackPanel(-1)"${index <= 0 ? ' disabled' : ''}>Previous</button>
            <button type="button" class="ui-btn ui-btn-secondary" onclick="stepFeedbackPanel(1)"${index < 0 || index >= filteredFeedbackData.length - 1 ? ' disabled' : ''}>Next</button>
        </footer>`;
}

// part: 'answers' scrolls the panel to the questions and answers
function openFeedbackPanel(feedbackId, part) {
    const id = Number(feedbackId);
    const feedback = filteredFeedbackData.find((item) => Number(item.id) === id);
    const panel = document.getElementById('feedback-panel');
    if (!feedback || !panel) return;
    feedbackPanelId = id;
    panel.innerHTML = feedbackPanelHtml(feedback);
    panel.hidden = false;
    document.querySelectorAll('#feedback-table-body tr.is-open').forEach((row) => row.classList.remove('is-open'));
    document.querySelector(`#feedback-table-body tr[data-feedback-id="${id}"]`)?.classList.add('is-open');
    if (part === 'answers') document.getElementById('feedback-panel-answers')?.scrollIntoView({ block: 'start' });
    else panel.querySelector('.fb-panel-body').scrollTop = 0;
    document.getElementById('feedback-panel-title')?.focus({ preventScroll: true });
}

function closeFeedbackPanel() {
    const panel = document.getElementById('feedback-panel');
    const id = feedbackPanelId;
    feedbackPanelId = null;
    if (panel) { panel.hidden = true; panel.innerHTML = ''; }
    const row = id === null ? null : document.querySelector(`#feedback-table-body tr[data-feedback-id="${id}"]`);
    document.querySelectorAll('#feedback-table-body tr.is-open').forEach((open) => open.classList.remove('is-open'));
    if (row) row.focus({ preventScroll: true }); // back to where the reader was in the list
}

// Previous / Next walk the filtered list in its current order, turning the page of the table when needed
function stepFeedbackPanel(step) {
    const index = filteredFeedbackData.findIndex((item) => Number(item.id) === feedbackPanelId);
    const next = filteredFeedbackData[index + step];
    if (index < 0 || !next) return;
    const page = Math.floor((index + step) / feedbackItemsPerPage) + 1;
    if (page !== feedbackCurrentPage) {
        feedbackCurrentPage = page;
        feedbackPanelId = Number(next.id);
        renderFeedbackPage();
    }
    openFeedbackPanel(next.id);
}

// after the list was drawn again (a filter, a sort, emails decrypted, a delete): the open panel follows, or closes when its submission is gone
function syncFeedbackPanel() {
    if (feedbackPanelId === null) return;
    const panel = document.getElementById('feedback-panel');
    const feedback = filteredFeedbackData.find((item) => Number(item.id) === feedbackPanelId);
    if (!feedback) return closeFeedbackPanel();
    if (!panel || panel.hidden) return;
    const scroll = panel.querySelector('.fb-panel-body')?.scrollTop || 0;
    panel.innerHTML = feedbackPanelHtml(feedback);
    const body = panel.querySelector('.fb-panel-body');
    if (body) body.scrollTop = scroll;
}

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('feedback-table-body');
    if (tbody) { tbody.addEventListener('click', feedbackRowAction); tbody.addEventListener('keydown', feedbackRowAction); }
    const panel = document.getElementById('feedback-panel');
    if (panel) panel.addEventListener('click', (event) => {
        const download = event.target.closest('[data-fb-download]');
        if (download) downloadPhoto(download.dataset.fbDownload, download.dataset.fbFile);
    });
    // icons of the fixed markup (uiKit.js is loaded before this file)
    document.querySelectorAll('#feedback-data-page [data-fb-icon]').forEach((slot) => { slot.innerHTML = uiIcon(slot.dataset.fbIcon, slot.tagName === 'BUTTON' ? 15 : 14); });
    // the date chip's small window opens under the chip
    const pop = document.getElementById('feedback-date-pop');
    const chip = document.getElementById('feedback-date-button');
    if (pop && chip) pop.addEventListener('toggle', (event) => {
        if (event.newState !== 'open') return;
        const at = chip.getBoundingClientRect();
        pop.style.top = `${Math.round(at.bottom + 6)}px`;
        pop.style.left = `${Math.round(Math.max(8, Math.min(at.left, window.innerWidth - pop.offsetWidth - 8)))}px`;
    });
});
// Esc closes the panel, unless a window above it (photo viewer, pledge, answers, email, delete check) is open: that one closes first
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || feedbackPanelId === null) return;
    if (document.querySelector('.photo-popup, .pledge-popup, .qa-popup, .email-popup, .delete-access-modal, #ui-info-pop:popover-open, #feedback-date-pop:popover-open')) return;
    closeFeedbackPanel();
});
// <Jun Kai end>

// Navigate to previous page
function prevFeedbackPage() {
    if (feedbackCurrentPage > 1) {
        feedbackCurrentPage--;
        decryptedEmailMap = {}; // Reset decryption
        isAnyEmailDecrypted = false;
        renderFeedbackPage();
    }
}

// Navigate to next page
function nextFeedbackPage() {
    const totalPages = Math.ceil(filteredFeedbackData.length / feedbackItemsPerPage);
    if (feedbackCurrentPage < totalPages) {
        feedbackCurrentPage++;
        decryptedEmailMap = {}; // Reset decryption
        isAnyEmailDecrypted = false;
        renderFeedbackPage();
    }
}

// Refresh feedback data
function refreshFeedbackData() {
    loadFeedbackData();
}

// ==================== 5b. SORTING (FEEDBACK & ARCHIVE) ====================

let feedbackSortColumn = null;
let feedbackSortAsc = true;
let archiveSortColumn = null;
let archiveSortAsc = true;

// Map HTML column keys to the actual data property names returned by the API
const sortKeyMap = {
    name: 'name',
    email: 'email_encrypted',
    total_visits: 'visits',
    data_retention: 'data_retention',
    data_retention_days: 'data_retention',
    created_at: 'date'
};

function sortFeedbackData(columnKey) {
    const field = sortKeyMap[columnKey] || columnKey;

    if (feedbackSortColumn === field) {
        feedbackSortAsc = !feedbackSortAsc;
    } else {
        feedbackSortColumn = field;
        feedbackSortAsc = true;
    }

    // Update sort indicator arrows
    document.querySelectorAll('[id^="feedback-sort-"]').forEach(el => el.textContent = '');
    const indicator = document.getElementById('feedback-sort-' + columnKey);
    if (indicator) indicator.textContent = feedbackSortAsc ? ' ▲' : ' ▼';

    filteredFeedbackData.sort((a, b) => compareValues(a[field], b[field], field));
    if (!feedbackSortAsc) filteredFeedbackData.reverse();

    feedbackCurrentPage = 1;
    renderFeedbackPage();
}

function sortArchiveData(columnKey) {
    const field = sortKeyMap[columnKey] || columnKey;

    if (archiveSortColumn === field) {
        archiveSortAsc = !archiveSortAsc;
    } else {
        archiveSortColumn = field;
        archiveSortAsc = true;
    }

    document.querySelectorAll('[id^="archive-sort-"]').forEach(el => el.textContent = '');
    const indicator = document.getElementById('archive-sort-' + columnKey);
    if (indicator) indicator.textContent = archiveSortAsc ? ' ▲' : ' ▼';

    filteredArchiveData.sort((a, b) => compareValues(a[field], b[field], field));
    if (!archiveSortAsc) filteredArchiveData.reverse();

    archiveCurrentPage = 1;
    renderArchivePage();
}

function compareValues(a, b, field) {
    // Nulls always sort to the end
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;

    // Date fields: compare as timestamps
    if (field === 'date') return new Date(a) - new Date(b);

    // Numeric fields: compare as numbers
    if (field === 'visits') return Number(a) - Number(b);

    // Everything else: case-insensitive string compare
    return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
}

