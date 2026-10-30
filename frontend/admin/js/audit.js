// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 2 of 30: audit logs. Owner: shared.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ==================== 3. AUDIT LOGS MANAGEMENT ====================

// Load all audit logs
async function loadAuditLogs() {
    try {
        console.log('📋 Loading audit logs...');
        const response = await fetch(`/api/admin/audit-logs?limit=10000&offset=0`);
        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            throw new Error(response.ok
                ? 'Server returned an invalid upload response.'
                : `Server returned an HTML error page (${response.status}). Please check the backend console.`);
        }
        
        if (response.ok && data.success) {
            allAuditLogs = data.logs || [];
            console.log(`✅ Loaded ${allAuditLogs.length} audit logs`);
            
            // Populate filter dropdowns
            populateUserFilter();
            
            // Reset to first page
            currentAuditPage = 1;
            
            // Apply filters and display
            filterAuditLogs();
            
            // Update total count
            document.getElementById('total-logs').textContent = allAuditLogs.length;
        }
    } catch (error) {
        console.error('❌ Error loading audit logs:', error);
        allAuditLogs = [];
        filteredAuditLogs = [];
        updateAuditTable([]);
    }
}

// Populate user filter dropdown with unique users
function populateUserFilter() {
    const userFilter = document.getElementById('filter-user');
    if (!userFilter) return;
    
    // Get unique usernames
    const uniqueUsers = [...new Set(allAuditLogs.map(log => log.admin_username))].filter(Boolean).sort();
    
    // Clear existing options except "All Users"
    userFilter.innerHTML = '<option value="">All Users</option>';
    
    // Add user options
    uniqueUsers.forEach(username => {
        const option = document.createElement('option');
        option.value = username;
        option.textContent = username;
        userFilter.appendChild(option);
    });
}

// Filter audit logs based on all criteria
function filterAuditLogs() {
    const searchTerm = document.getElementById('audit-search-input')?.value.toLowerCase() || '';
    const filterAction = document.getElementById('filter-action')?.value || '';
    const filterUser = document.getElementById('filter-user')?.value || '';
    const filterTargetType = document.getElementById('filter-target-type')?.value || '';
    const filterIp = document.getElementById('filter-ip')?.value.toLowerCase() || '';
    const filterDateFrom = document.getElementById('filter-date-from')?.value || '';
    const filterDateTo = document.getElementById('filter-date-to')?.value || '';
    
    filteredAuditLogs = allAuditLogs.filter(log => {
        // Global search filter - searches ALL columns
        const searchMatch = !searchTerm || 
            (log.admin_username && log.admin_username.toLowerCase().includes(searchTerm)) ||
            (log.action && log.action.toLowerCase().includes(searchTerm)) ||
            (log.target_type && log.target_type.toLowerCase().includes(searchTerm)) ||
            (log.target_id && log.target_id.toString().toLowerCase().includes(searchTerm)) ||
            (log.ip_address && log.ip_address.toLowerCase().includes(searchTerm)) ||
            (log.user_agent && log.user_agent.toLowerCase().includes(searchTerm)) ||
            (log.created_at && new Date(log.created_at).toLocaleString().toLowerCase().includes(searchTerm));
        
        // Action filter
        const actionMatch = !filterAction || (log.action && log.action.includes(filterAction));
        
        // User filter
        const userMatch = !filterUser || (log.admin_username === filterUser);
        
        // Target Type filter
        const targetMatch = !filterTargetType || (log.target_type === filterTargetType);
        
        // IP Address filter
        const ipMatch = !filterIp || (log.ip_address && log.ip_address.toLowerCase().includes(filterIp));
        
        // Date range filter
        let dateMatch = true;
        if (filterDateFrom || filterDateTo) {
            const logDate = new Date(log.created_at);
            logDate.setHours(0, 0, 0, 0); // Reset time for date comparison
            
            if (filterDateFrom) {
                const fromDate = new Date(filterDateFrom);
                fromDate.setHours(0, 0, 0, 0);
                dateMatch = dateMatch && logDate >= fromDate;
            }
            
            if (filterDateTo) {
                const toDate = new Date(filterDateTo);
                toDate.setHours(23, 59, 59, 999);
                dateMatch = dateMatch && logDate <= toDate;
            }
        }
        
        return searchMatch && actionMatch && userMatch && targetMatch && ipMatch && dateMatch;
    });
    
    // Apply sorting
    sortFilteredLogs();
    
    // Reset to first page when filtering
    currentAuditPage = 1;
    
    // Update UI
    updateFilterIndicators();
    displayAuditLogsPage();
    updateAuditPagination(filteredAuditLogs.length);
    updateResultsCounts();
}

// Sort filtered logs
function sortFilteredLogs() {
    filteredAuditLogs.sort((a, b) => {
        let aVal = a[currentSortField];
        let bVal = b[currentSortField];
        
        // Handle dates
        if (currentSortField === 'created_at') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        }
        
        // Handle nulls
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        // Compare
        if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

// Sort audit logs by column
function sortAuditLogs(field) {
    if (currentSortField === field) {
        // Toggle direction
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // New field, default to ascending
        currentSortField = field;
        currentSortDirection = 'asc';
    }
    
    // Update sort indicators
    document.querySelectorAll('.sort-indicator').forEach(el => {
        el.className = 'sort-indicator';
    });
    
    const indicator = document.getElementById(`sort-${field}`);
    if (indicator) {
        indicator.className = `sort-indicator ${currentSortDirection}`;
    }
    
    // Re-filter (which includes sorting)
    filterAuditLogs();
}

// Display current page of filtered audit logs
function displayAuditLogsPage() {
    const startIndex = (currentAuditPage - 1) * auditLogsPerPage;
    const endIndex = startIndex + auditLogsPerPage;
    const pageData = filteredAuditLogs.slice(startIndex, endIndex);
    
    updateAuditTable(pageData);
}

// Update audit logs table
function updateAuditTable(logs) {
    const tbody = document.getElementById('audit-logs-body');
    if (!tbody) return;
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <div class="empty-state-title">No audit logs found</div>
                    <div class="empty-state-text">
                        ${allAuditLogs.length === 0 
                            ? 'No audit logs have been recorded yet.' 
                            : 'Try adjusting your filters to see more results.'}
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = logs.map(log => `
        <tr>
            <td>${new Date(log.created_at).toLocaleString()}</td>
            <td><strong>${escapeHtml(log.admin_username)}</strong></td>
            <td><span class="badge badge-${getAuditBadgeType(log.action)}">${escapeHtml(log.action)}</span></td>
            <td>${log.target_type ? `${escapeHtml(log.target_type)} #${log.target_id}` : '–'}</td>
            <td style="font-size: 12px; color: #64748b;">${escapeHtml(log.ip_address) || '–'}</td>
        </tr>
    `).join('');
}

// Get badge type for action
function getAuditBadgeType(action) {
    if (action.includes('DELETE')) return 'warning';
    if (action.includes('LOGIN') || action.includes('DOWNLOAD') || action.includes('EMAIL')) return 'security';
    if (action.includes('ADD') || action.includes('EDIT')) return 'active';
    return 'system';
}

