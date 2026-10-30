// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 6 of 30: archive data table. Owner: Role 3.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: no markers in this file   <- counted from the "DONE BY" style markers below
// Current team owner: Role 3, Jun Kai. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
// ==================== 6. ARCHIVE DATA MANAGEMENT (ARCHIVED) ====================


// Load ALL archive data (archive_status = 'archived')
async function loadArchiveData() {
    try {
        console.log('📚 Loading archive data (archived)...');
        
        const response = await fetch('/api/admin/archive', {
            headers: {
                'x-username': sessionStorage.getItem('loggedUser')
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            allArchiveData = data.feedback || [];
            archiveCurrentPage = 1;
            
            console.log(`✅ Loaded ${allArchiveData.length} archive records`);
            
            // Reset decryption
            decryptedArchiveEmailMap = {};
            isAnyArchiveEmailDecrypted = false;
            
            // Apply filters
            filterArchiveData();
        } else {
            throw new Error(data.error || 'Failed to load archive data');
        }
    } catch (error) {
        console.error('❌ Error loading archive:', error);
        
        // Show error in table
        const tbody = document.getElementById('archive-table-body');
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
        
        updateArchivePaginationControls(0, 0);
    }
}

// Filter archive data (same logic as feedback)
function filterArchiveData() {
    const searchTerm = document.getElementById('archive-search-input')?.value.toLowerCase() || '';
    const dateFrom = document.getElementById('archive-filter-date-from')?.value || '';
    const dateTo = document.getElementById('archive-filter-date-to')?.value || '';
    const emailFilter = document.getElementById('archive-filter-email')?.value || '';
    const visitsFilter = document.getElementById('archive-filter-visits')?.value || '';
    const retentionFilter = document.getElementById('archive-filter-retention')?.value || '';
    
    // Count active filters
    let activeFiltersCount = 0;
    if (searchTerm) activeFiltersCount++;
    if (dateFrom || dateTo) activeFiltersCount++;
    if (emailFilter) activeFiltersCount++;
    if (visitsFilter) activeFiltersCount++;
    if (retentionFilter) activeFiltersCount++;
    
    // Filter ALL data
    filteredArchiveData = allArchiveData.filter(item => {
        let matches = true;
        
        // Global search
        if (searchTerm) {
            const searchableText = [
                item.name || '',
                String(item.visits || ''),
                item.pledge || '',
                item.date ? new Date(item.date).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }) : ''
            ].join(' ').toLowerCase();
            
            matches = matches && searchableText.includes(searchTerm);
        }
        
        // Date range — boundaries computed in Singapore time
        if (dateFrom || dateTo) {
            const itemDate = new Date(item.date);
            if (dateFrom) {
                matches = matches && itemDate >= startOfDaySGT(dateFrom);
            }
            if (dateTo) {
                matches = matches && itemDate <= endOfDaySGT(dateTo);
            }
        }
        
        // Email filter
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
        
        // Visits
        if (visitsFilter) {
            const visits = parseInt(item.visits) || 0;
            if (visitsFilter === '6+') {
                matches = matches && visits >= 6;
            } else {
                matches = matches && visits === parseInt(visitsFilter);
            }
        }
        
        // Retention
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
    updateArchiveCounts(allArchiveData.length, filteredArchiveData.length, activeFiltersCount);
    
    // Reset to page 1
    archiveCurrentPage = 1;
    
    // Reset decryption
    decryptedArchiveEmailMap = {};
    isAnyArchiveEmailDecrypted = false;
    
    // Render
    renderArchivePage();
}

// Update archive count displays
function updateArchiveCounts(total, filtered, activeFilters) {
    const elements = {
        'archive-filtered-count': filtered,
        'archive-total-count': total,
        'archive-results-count': filtered,
        'archive-total': total,
        'archive-active-filters-count': activeFilters
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
    
    const infoBar = document.getElementById('archive-results-info-bar');
    if (infoBar) {
        infoBar.style.display = activeFilters > 0 ? 'block' : 'none';
    }
}

// Render current page of archive (SAME STYLING AS FEEDBACK)
function renderArchivePage() {
    const tbody = document.getElementById('archive-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Get current user role
    const userRole = sessionStorage.getItem('userRole');
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredArchiveData.length / archiveItemsPerPage);
    const startIndex = (archiveCurrentPage - 1) * archiveItemsPerPage;
    const endIndex = startIndex + archiveItemsPerPage;
    const pageData = filteredArchiveData.slice(startIndex, endIndex);
    
    // Collect encrypted IDs from current page
    encryptedArchiveIds = [];
    pageData.forEach(item => {
        if (item.email_encrypted && 
            item.email_encrypted.trim() !== '' && 
            item.email_encrypted.toLowerCase() !== 'no email provided') {
            encryptedArchiveIds.push(item.id);
        }
    });
    
    // Show no data message
    if (filteredArchiveData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 40px; color: #64748b;">
                    ${allArchiveData.length === 0 
                        ? 'No archived feedback found. Feedback moved by the archive rules will appear here.'
                        : 'No results match your filters. Try adjusting your search criteria.'}
                </td>
            </tr>
        `;
        updateArchivePaginationControls(0, 0);
        updateArchiveEncryptionButtons();
        return;
    }
    
    // Render each row - EXACT SAME STYLING AS FEEDBACK
    pageData.forEach(feedback => {
        const row = tbody.insertRow();
        row.setAttribute('data-feedback-id', feedback.id);
        row.setAttribute('data-retention', feedback.data_retention || 'longterm');
        
        // Checkbox - only for system_admin
        const checkboxCell = row.insertCell(0);
        checkboxCell.className = 'checkbox-col';
        if (userRole === 'system_admin') {
            checkboxCell.innerHTML = `<input type="checkbox" class="archive-select-checkbox" value="${feedback.id}" onchange="updateArchiveSelectionCount()">`;
        } else {
            checkboxCell.innerHTML = `<span class="text-muted">-</span>`;
        }
        
        // Name
        row.insertCell(1).textContent = feedback.name || 'Anonymous';
        
        // Email - WITH ICONS AND COLORS (same as feedback)
        const emailCell = row.insertCell(2);
        emailCell.className = 'email-cell';
        
        if (decryptedArchiveEmailMap[feedback.id]) {
            emailCell.innerHTML = `<span class="text-success font-weight-600">🔓 ${decryptedArchiveEmailMap[feedback.id]}</span>`;
        } else if (feedback.email_encrypted && 
                   feedback.email_encrypted.trim() !== '' && 
                   feedback.email_encrypted.toLowerCase() !== 'no email provided') {
            emailCell.innerHTML = `<span class="text-muted">🔒 [Encrypted]</span>`;
        } else {
            emailCell.innerHTML = `<span class="text-light-gray">No email provided</span>`;
        }
        
        // Visits
        row.insertCell(3).textContent = feedback.visits || 1;
        
        // Pledge
        const pledgeCell = row.insertCell(4);
        if (feedback.pledge && feedback.pledge.trim() !== '') {
            pledgeCell.innerHTML = `<button class="btn-view" onclick="viewPledge(${feedback.id}, decodeURIComponent('${encodeURIComponent(feedback.pledge)}'))">View</button>`;
        } else {
            pledgeCell.innerHTML = '<span class="text-muted font-size-12">No pledge</span>';
        }
        
        // Questions & Answers
        const qaCell = row.insertCell(5);
        if (feedback.question_answers && feedback.question_answers.length > 0) {
            qaCell.innerHTML = `<button class="btn-view" onclick="viewQuestionAnswers(${feedback.id})">View</button>`;
        } else {
            qaCell.innerHTML = '<span class="text-muted font-size-12">No answers</span>';
        }
        
        // Data Retention WITH BADGES (same as feedback)
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
        
        // Actions - ROLE-BASED DELETE BUTTON
        const actionsCell = row.insertCell(10);
        
        // IT_staff: View only, cannot delete
        if (userRole === 'IT_staff') {
            actionsCell.innerHTML = `<span class="text-muted font-size-12">View only</span>`;
        } 
        // IT_admin and system_admin: Can delete
        else if (userRole === 'IT_admin' || userRole === 'system_admin') {
            actionsCell.innerHTML = `<button class="btn-delete" onclick="deleteArchiveFeedback(${feedback.id})">🗑️ Delete</button>`;
        }
        // Default fallback
        else {
            actionsCell.innerHTML = `<span class="text-muted font-size-12">-</span>`;
        }
    });
    
    updateArchivePaginationControls(filteredArchiveData.length, totalPages);
    updateArchiveEncryptionButtons();
}

// Update archive pagination controls
function updateArchivePaginationControls(totalItems, totalPages) {
    const prevBtn = document.getElementById('prev-archive-btn');
    const nextBtn = document.getElementById('next-archive-btn');
    const pageInfo = document.getElementById('archive-page-info');
    
    if (prevBtn) prevBtn.disabled = archiveCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = archiveCurrentPage >= totalPages || totalPages === 0;
    
    if (pageInfo) {
        pageInfo.textContent = totalPages > 0 
            ? `Page ${archiveCurrentPage} of ${totalPages} (${totalItems} total)`
            : 'Page 1 of 0 (0 total)';
    }
}

// Navigate archive pages
function prevArchivePage() {
    if (archiveCurrentPage > 1) {
        archiveCurrentPage--;
        decryptedArchiveEmailMap = {};
        isAnyArchiveEmailDecrypted = false;
        renderArchivePage();
    }
}

function nextArchivePage() {
    const totalPages = Math.ceil(filteredArchiveData.length / archiveItemsPerPage);
    if (archiveCurrentPage < totalPages) {
        archiveCurrentPage++;
        decryptedArchiveEmailMap = {};
        isAnyArchiveEmailDecrypted = false;
        renderArchivePage();
    }
}

