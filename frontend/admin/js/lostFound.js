// Owner: shared. Previous team: Nick (12).
// Part 3/30 of the admin page: lost and found reports (load order in admin.html).
// ==================== LOST AND FOUND REPORTS ====================
async function loadNickUsageAnalytics() { // Load Nick feature usage analytics (DONE BY NICK)
    try {
        const response = await fetch('/api/admin/nick-usage-analytics');
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Unable to load Nick usage analytics.');
        }
        nickUsageAnalytics = data.analytics || null;
        updateNickUsageAnalytics();
    } catch (error) {
        console.error('Error loading Nick usage analytics:', error);
        nickUsageAnalytics = null;
        updateNickUsageAnalytics();
    }
}

function countObjectValues(values = {}) { // Utility for Nick analytics totals (DONE BY NICK)
    return Object.values(values).reduce((sum, value) => sum + Number(value || 0), 0);
}

function updateNickUsageAnalytics() { // Render Nick usage analytics cards (DONE BY NICK)
    const analytics = nickUsageAnalytics || {};
    const captures = analytics.captures || {};
    const lostFound = analytics.lostFound || {};

    const captureTotal = Number(captures.photo || 0) + Number(captures.boomerang || 0);
    const filterTotal = countObjectValues(analytics.filterUses || {});

    const setMetric = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    };

    setMetric('nick-analytics-captures', captureTotal);
    setMetric('nick-analytics-boomerangs', captures.boomerang || 0);
    setMetric('nick-analytics-filters', filterTotal);
    setMetric('nick-analytics-lost-found-photos', `${lostFound.withPhotos || 0}/${lostFound.total || 0}`);
}

function downloadLostFoundCsv() { // Download Lost & Found CSV export (DONE BY NICK)
    window.location.href = '/api/admin/lost-found-reports/export.csv';
}

// Load Lost & Found reports for the Administration page - changes made by nick
async function loadLostFoundReports() {
    const tbody = document.getElementById('lost-found-reports-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px; color: #64748b;">
                    Loading Lost & Found reports...
                </td>
            </tr>
        `;
    }

    loadNickUsageAnalytics();

    try {
        const response = await fetch('/api/admin/lost-found-reports');
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Unable to load Lost & Found reports.');
        }

        allLostFoundReports = data.reports || [];
        filterLostFoundReports();
    } catch (error) {
        console.error('Error loading Lost & Found reports:', error);
        allLostFoundReports = [];
        filteredLostFoundReports = [];
        updateLostFoundReportTable();
        showNotification(error.message || 'Failed to load Lost & Found reports', 'error');
    }
}

function filterLostFoundReports() { // changes made by nick
    const searchTerm = document.getElementById('lost-found-search-input')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('lost-found-type-filter')?.value || '';
    const statusFilter = document.getElementById('lost-found-status-filter')?.value || '';

    filteredLostFoundReports = allLostFoundReports.filter((report) => {
        const haystack = [
            report.tracking_code,
            report.report_type,
            report.item_description,
            report.location_text,
            report.contact_info,
            report.details,
            report.current_page,
            report.status
        ].join(' ').toLowerCase();

        return (!searchTerm || haystack.includes(searchTerm)) &&
            (!typeFilter || report.report_type === typeFilter) &&
            (!statusFilter || report.status === statusFilter);
    });

    updateLostFoundReportTable();
}

function formatLostFoundStatus(status) { // changes made by nick
    const normalized = String(status || 'new').toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getLostFoundBadgeType(status) { // changes made by nick
    if (status === 'resolved') return 'active';
    if (status === 'reviewed') return 'security';
    return 'warning';
}

function getLostFoundPhotoPath(report) { // Robust admin photo path support for Lost & Found reports (DONE BY NICK)
    const rawPath = report?.item_photo_path
        || report?.itemPhotoPath
        || report?.item_photo_url
        || report?.photo_path
        || report?.photoPath
        || '';
    const photoPath = String(rawPath || '').trim();

    if (!photoPath) return '';
    if (/^(https?:)?\/\//i.test(photoPath) || photoPath.startsWith('data:image/')) return photoPath;

    const normalizedPath = photoPath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalizedPath.startsWith('uploads/')) return `/${normalizedPath}`;
    if (normalizedPath.startsWith('lost-found/')) return `/uploads/${normalizedPath}`;
    return `/uploads/lost-found/${normalizedPath}`;
}

function renderLostFoundPhotoCell(report) { // Admin preview link for uploaded Lost & Found item photos (DONE BY NICK)
    const photoPath = getLostFoundPhotoPath(report);
    if (!photoPath) return '<span class="text-muted">No photo</span>';

    const photoName = report?.item_photo_original_name
        || report?.itemPhotoOriginalName
        || 'Uploaded item photo';
    const escapedPath = escapeHtml(photoPath);
    const escapedName = escapeHtml(photoName);

    return `<a class="lost-found-photo-link" href="${escapedPath}" target="_blank" rel="noopener" title="${escapedName}">
                <img src="${escapedPath}" alt="${escapedName}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.textContent='Photo unavailable'; this.parentElement.classList.add('is-missing');">
                <span>View photo</span>
           </a>`;
}

function updateLostFoundReportTable() { // changes made by nick
    const tbody = document.getElementById('lost-found-reports-body');
    const summary = document.getElementById('lost-found-summary');
    if (!tbody) return;

    if (summary) {
        const total = allLostFoundReports.length;
        const shown = filteredLostFoundReports.length;
        summary.textContent = `${shown} of ${total} report${total === 1 ? '' : 's'} shown`;
    }

    if (!filteredLostFoundReports.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <div class="empty-state-title">No Lost & Found reports found</div>
                    <div class="empty-state-text">
                        ${allLostFoundReports.length === 0
                            ? 'Reports submitted from the feedback form will appear here.'
                            : 'Try changing the search or filters.'}
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredLostFoundReports.map((report) => {
        const status = String(report.status || 'new').toLowerCase();
        const date = report.created_at ? new Date(report.created_at).toLocaleString() : '-';
        const pageLabel = report.current_page ? `<span class="lost-found-page-label">Page: ${escapeHtml(report.current_page)}</span>` : '';
        const trackingCode = report.tracking_code || `LF-${String(report.id || 0).padStart(5, '0')}`;
        const photoCell = renderLostFoundPhotoCell(report);

        return `
            <tr>
                <td>${escapeHtml(date)}</td>
                <td><strong>${escapeHtml(trackingCode)}</strong></td>
                <td><span class="badge badge-${getLostFoundBadgeType(status)}">${escapeHtml(report.report_type || '-')}</span></td>
                <td><strong>${escapeHtml(report.item_description || '-')}</strong>${pageLabel}</td>
                <td>${photoCell}</td>
                <td>${escapeHtml(report.location_text || '-')}</td>
                <td>${escapeHtml(report.contact_info || '-')}</td>
                <td class="lost-found-details-cell">${escapeHtml(report.details || '-')}</td>
                <td><span class="badge badge-${getLostFoundBadgeType(status)}">${escapeHtml(formatLostFoundStatus(status))}</span></td>
                <td class="lost-found-actions-cell">
                    <button class="btn-secondary" onclick="updateLostFoundReportStatus(${Number(report.id)}, 'reviewed')" ${status === 'reviewed' || status === 'resolved' ? 'disabled' : ''}>Mark Reviewed</button>
                    <button class="btn-primary" onclick="updateLostFoundReportStatus(${Number(report.id)}, 'resolved')" ${status === 'resolved' ? 'disabled' : ''}>Mark Resolved</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function updateLostFoundReportStatus(reportId, status) { // changes made by nick
    try {
        const response = await fetch(`/api/admin/lost-found-reports/${encodeURIComponent(reportId)}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Unable to update report status.');
        }

        showNotification('Lost & Found report updated', 'success');
        await loadLostFoundReports();
    } catch (error) {
        console.error('Error updating Lost & Found report:', error);
        showNotification(error.message || 'Failed to update report', 'error');
    }
}

// Update pagination
function updateAuditPagination(total) {
    const totalPages = Math.ceil(total / auditLogsPerPage);
    document.getElementById('audit-page-info').textContent = `Page ${currentAuditPage} of ${totalPages || 1}`;
    document.getElementById('prev-audit-btn').disabled = currentAuditPage <= 1;
    document.getElementById('next-audit-btn').disabled = currentAuditPage >= totalPages;
}

// Previous page
function prevAuditPage() {
    if (currentAuditPage > 1) {
        currentAuditPage--;
        displayAuditLogsPage();
        updateAuditPagination(filteredAuditLogs.length);
    }
}

// Next page
function nextAuditPage() {
    const totalPages = Math.ceil(filteredAuditLogs.length / auditLogsPerPage);
    if (currentAuditPage < totalPages) {
        currentAuditPage++;
        displayAuditLogsPage();
        updateAuditPagination(filteredAuditLogs.length);
    }
}

// Toggle advanced filters panel
function toggleAdvancedFilters() {
    const panel = document.getElementById('advanced-filters-panel');
    const icon = document.getElementById('filter-toggle-icon');
    
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        icon.classList.add('rotated');
    } else {
        panel.style.display = 'none';
        icon.classList.remove('rotated');
    }
}

// Clear all filters
function clearAllFilters() {
    // Clear search
    const searchInput = document.getElementById('audit-search-input');
    if (searchInput) searchInput.value = '';
    
    // Clear all filter dropdowns
    const filterAction = document.getElementById('filter-action');
    if (filterAction) filterAction.value = '';
    
    const filterUser = document.getElementById('filter-user');
    if (filterUser) filterUser.value = '';
    
    const filterTargetType = document.getElementById('filter-target-type');
    if (filterTargetType) filterTargetType.value = '';
    
    const filterIp = document.getElementById('filter-ip');
    if (filterIp) filterIp.value = '';
    
    // Clear date filters
    const filterDateFrom = document.getElementById('filter-date-from');
    if (filterDateFrom) filterDateFrom.value = '';
    
    const filterDateTo = document.getElementById('filter-date-to');
    if (filterDateTo) filterDateTo.value = '';
    
    // Re-filter
    filterAuditLogs();
}

// Set date range preset
function setDateRangePreset(preset) {
    const filterDateFrom = document.getElementById('filter-date-from');
    const filterDateTo = document.getElementById('filter-date-to');
    if (!filterDateFrom || !filterDateTo) return;

    // Singapore calendar days, same helpers as the feedback presets
    const sgt = getSGTDateComponents();
    const todaySGT = new Date(Date.UTC(sgt.year, sgt.month, sgt.day));
    const startDate = new Date(todaySGT);
    if (preset === 'week') startDate.setUTCDate(startDate.getUTCDate() - 7);
    if (preset === 'month') startDate.setUTCMonth(startDate.getUTCMonth() - 1);

    filterDateTo.value = formatDateToSGTString(todaySGT);
    filterDateFrom.value = formatDateToSGTString(startDate);
    filterAuditLogs();
}

// Update filter indicators (highlight active filters)
function updateFilterIndicators() {
    // Count active filters
    let activeCount = 0;
    
    const searchInput = document.getElementById('audit-search-input');
    const filterAction = document.getElementById('filter-action');
    const filterUser = document.getElementById('filter-user');
    const filterTargetType = document.getElementById('filter-target-type');
    const filterIp = document.getElementById('filter-ip');
    const filterDateFrom = document.getElementById('filter-date-from');
    const filterDateTo = document.getElementById('filter-date-to');
    
    // Check and highlight each filter
    if (searchInput && searchInput.value) {
        activeCount++;
    }
    
    if (filterAction && filterAction.value) {
        activeCount++;
        filterAction.classList.add('has-value');
    } else if (filterAction) {
        filterAction.classList.remove('has-value');
    }
    
    if (filterUser && filterUser.value) {
        activeCount++;
        filterUser.classList.add('has-value');
    } else if (filterUser) {
        filterUser.classList.remove('has-value');
    }
    
    if (filterTargetType && filterTargetType.value) {
        activeCount++;
        filterTargetType.classList.add('has-value');
    } else if (filterTargetType) {
        filterTargetType.classList.remove('has-value');
    }
    
    if (filterIp && filterIp.value) {
        activeCount++;
        filterIp.classList.add('has-value');
    } else if (filterIp) {
        filterIp.classList.remove('has-value');
    }
    
    if (filterDateFrom && filterDateFrom.value) {
        activeCount++;
        filterDateFrom.classList.add('has-value');
    } else if (filterDateFrom) {
        filterDateFrom.classList.remove('has-value');
    }
    
    if (filterDateTo && filterDateTo.value) {
        activeCount++;
        filterDateTo.classList.add('has-value');
    } else if (filterDateTo) {
        filterDateTo.classList.remove('has-value');
    }
    
    // Update active filters count
    const activeFiltersCount = document.getElementById('active-filters-count');
    if (activeFiltersCount) {
        activeFiltersCount.textContent = activeCount;
    }
    
    // Show/hide results info bar
    const resultsInfoBar = document.getElementById('results-info-bar');
    if (resultsInfoBar) {
        if (activeCount > 0 || filteredAuditLogs.length !== allAuditLogs.length) {
            resultsInfoBar.style.display = 'flex';
        } else {
            resultsInfoBar.style.display = 'none';
        }
    }
}

// Update results counts
function updateResultsCounts() {
    const filteredCount = document.getElementById('filtered-count');
    const totalCount = document.getElementById('total-count');
    const resultsCount = document.getElementById('results-count');
    const totalLogs = document.getElementById('total-logs');
    
    if (filteredCount) filteredCount.textContent = filteredAuditLogs.length;
    if (totalCount) totalCount.textContent = allAuditLogs.length;
    if (resultsCount) resultsCount.textContent = filteredAuditLogs.length;
    if (totalLogs) totalLogs.textContent = allAuditLogs.length;
}

// Download audit logs as Excel
async function downloadAuditExcel() {
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        return;
    }
    
    try {
        // Prepare data for Excel (use filtered results)
        const excelData = filteredAuditLogs.map(log => ({
            'Time': new Date(log.created_at).toLocaleString(),
            'User': log.admin_username,
            'Action': log.action,
            'Target Type': log.target_type || '',
            'Target ID': log.target_id || '',
            'IP Address': log.ip_address || '',
            'User Agent': log.user_agent || ''
        }));
        
        if (excelData.length === 0) {
            alert('No audit logs to download. Try adjusting your filters.');
            return;
        }
        
        // Convert to CSV
        const headers = Object.keys(excelData[0]);
        const csvContent = [
            headers.join(','),
            ...excelData.map(row => 
                headers.map(header => {
                    const value = String(row[header] || '');
                    // Escape quotes and wrap in quotes if contains comma or quotes
                    return value.includes(',') || value.includes('"') || value.includes('\n')
                        ? `"${value.replace(/"/g, '""')}"` 
                        : value;
                }).join(',')
            )
        ].join('\n');
        
        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`✅ Downloaded ${excelData.length} audit logs`);
        
        // Log the download action
        const loggedUsername = sessionStorage.getItem('loggedUser');
        if (loggedUsername) {
            try {
                await fetch('/api/admin/logout-audit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: loggedUsername
                    })
                });
            } catch (err) {
                console.error('Failed to log download action:', err);
            }
        }
        
    } catch (error) {
        console.error('❌ Error downloading audit logs:', error);
        alert('Error downloading audit logs: ' + error.message);
    }
}

