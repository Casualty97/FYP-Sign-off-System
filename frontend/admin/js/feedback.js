// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 5 of 30: feedback data table and sorting. Owner: Role 3.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: Caeden (1)   <- counted from the "DONE BY" style markers below
// Current team owner: Role 3, Jun Kai. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
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
    
    // Reset to page 1
    feedbackCurrentPage = 1;
    
    // Reset decryption when filters change
    decryptedEmailMap = {};
    isAnyEmailDecrypted = false;
    
    // Render filtered data
    renderFeedbackPage();
}

// Update feedback count displays
 
function updateFeedbackCounts(total, filtered, activeFilters) {
    const elements = {
        'feedback-filtered-count': filtered,
        'feedback-total-count': total,
        'feedback-results-count': filtered,
        'feedback-total-records': total,
        'feedback-active-filters-count': activeFilters
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
    
    // Show/hide results info bar
    const infoBar = document.getElementById('feedback-results-info-bar');
    if (infoBar) {
        infoBar.style.display = activeFilters > 0 ? 'block' : 'none';
    }
}

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

// Render current page of feedback (25 records)
function renderFeedbackPage() {
    const tbody = document.getElementById('feedback-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Get current user role
    const userRole = sessionStorage.getItem('userRole');
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredFeedbackData.length / feedbackItemsPerPage);
    const startIndex = (feedbackCurrentPage - 1) * feedbackItemsPerPage;
    const endIndex = startIndex + feedbackItemsPerPage;
    const pageData = filteredFeedbackData.slice(startIndex, endIndex);
    
    // Collect encrypted IDs from current page ONLY
    encryptedFeedbackIds = [];
    pageData.forEach(item => {
        if (item.email_encrypted && 
            item.email_encrypted.trim() !== '' && 
            item.email_encrypted.toLowerCase() !== 'no email provided') {
            encryptedFeedbackIds.push(item.id);
        }
    });
    
    // Show no data message
    if (filteredFeedbackData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 40px; color: #64748b;">
                    ${allFeedbackData.length === 0 
                        ? 'No feedback data available.'
                        : 'No results match your filters. Try adjusting your search criteria.'}
                </td>
            </tr>
        `;
        updateFeedbackPaginationControls(0, 0);
        updateEncryptionButtons();
        return;
    }
    
    // Render each row with proper styling
    pageData.forEach(feedback => {
        const row = tbody.insertRow();
        row.setAttribute('data-feedback-id', feedback.id);
        row.setAttribute('data-retention', feedback.data_retention || 'longterm');
        
        // Name
        row.insertCell(0).textContent = feedback.name || 'Anonymous';
        
        // Email - WITH ICONS AND COLORS
        const emailCell = row.insertCell(1);
        emailCell.className = 'email-cell';
        
        if (decryptedEmailMap[feedback.id]) {
            // Decrypted - GREEN with unlock icon
            emailCell.innerHTML = `<span class="text-success font-weight-600">🔓 ${decryptedEmailMap[feedback.id]}</span>`;
        } else if (feedback.email_encrypted && 
                   feedback.email_encrypted.trim() !== '' && 
                   feedback.email_encrypted.toLowerCase() !== 'no email provided') {
            // Encrypted - GRAY with lock icon
            emailCell.innerHTML = `<span class="text-muted">🔒 [Encrypted]</span>`;
        } else {
            // No email - LIGHT GRAY
            emailCell.innerHTML = `<span class="text-light-gray">No email provided</span>`;
        }
        
        // Visits
        row.insertCell(2).textContent = feedback.visits || 1;
        
        // Pledge
        const pledgeCell = row.insertCell(3);
        if (feedback.pledge && feedback.pledge.trim() !== '') {
            pledgeCell.innerHTML = `<button class="btn-view" onclick="viewPledge(${feedback.id}, decodeURIComponent('${encodeURIComponent(feedback.pledge)}'))">View</button>`;
        } else {
            pledgeCell.innerHTML = '<span class="text-muted font-size-12">No pledge</span>';
        }

        // User Feedback preview
        const feedbackPreviewCell = row.insertCell(4);
        const feedbackPreview = getFeedbackAnswerPreview(feedback);
        if (feedbackPreview) {
            feedbackPreviewCell.innerHTML = `<span title="${escapeHtml(feedbackPreview)}" style="display: block; max-width: 260px; white-space: normal; line-height: 1.35;">${escapeHtml(feedbackPreview)}</span>`;
        } else {
            feedbackPreviewCell.innerHTML = '<span class="text-muted font-size-12">No typed feedback</span>';
        }
        
        // Questions & Answers
        const qaCell = row.insertCell(5);
        if (feedback.question_answers && feedback.question_answers.length > 0) {
            qaCell.innerHTML = `<button class="btn-view" onclick="viewQuestionAnswers(${feedback.id})">View</button>`;
        } else {
            qaCell.innerHTML = '<span class="text-muted font-size-12">No answers</span>';
        }
        
        // Data Retention WITH BADGES
        const retentionCell = row.insertCell(6);
        const retention = feedback.data_retention || 'longterm';
        if (retention === '7days' || retention === '7day') {
            retentionCell.innerHTML = '<span class="badge badge-warning">7 DAYS</span>';
        } else {
            retentionCell.innerHTML = '<span class="badge badge-permanent">LONG-TERM</span>';
        }
        
        // Raw Photo
        const rawPhotoCell = row.insertCell(7);
        if (feedback.photo_path) {
            rawPhotoCell.innerHTML = `<button class="btn-view" onclick="viewRawPhoto(${feedback.id})">View</button>`;
        } else {
            rawPhotoCell.innerHTML = '<span class="text-muted font-size-12">No raw photo</span>';
        }
        
        // Processed Photo
        const processedPhotoCell = row.insertCell(8);
        if (feedback.processed_photo_path) {
            processedPhotoCell.innerHTML = `<button class="btn-view" onclick="viewProcessedPhoto(${feedback.id})">View</button>`;
        } else {
            processedPhotoCell.innerHTML = '<span class="text-muted font-size-12">No processed photo</span>';
        }
        
        // Date
        row.insertCell(9).textContent = new Date(feedback.date).toLocaleString('en-SG', {
            timeZone: 'Asia/Singapore',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Actions
        const actionsCell = row.insertCell(10);
        
        // IT_staff: View only, cannot delete
        if (userRole === 'IT_staff') {
            actionsCell.innerHTML = `<span class="text-muted font-size-12">View only</span>`;
        } 
        // IT_admin and system_admin: Can delete
        else if (userRole === 'IT_admin' || userRole === 'system_admin') {
            actionsCell.innerHTML = `<button class="btn-delete" onclick="deleteFeedback(${feedback.id})">🗑️ Delete</button>`;
        }
        // Default fallback
        else {
            actionsCell.innerHTML = `<span class="text-muted font-size-12">-</span>`;
        }
    });
    
    updateFeedbackPaginationControls(filteredFeedbackData.length, totalPages);
    updateEncryptionButtons();
}

// Update pagination controls
function updateFeedbackPaginationControls(totalItems, totalPages) {
    const prevBtn = document.getElementById('prev-feedback-btn');
    const nextBtn = document.getElementById('next-feedback-btn');
    const pageInfo = document.getElementById('feedback-page-info');
    
    if (prevBtn) prevBtn.disabled = feedbackCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = feedbackCurrentPage >= totalPages || totalPages === 0;
    
    if (pageInfo) {
        pageInfo.textContent = totalPages > 0 
            ? `Page ${feedbackCurrentPage} of ${totalPages} (${totalItems} total)`
            : 'Page 1 of 0 (0 total)';
    }
}

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

