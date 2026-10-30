// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 23 of 30: pledgeboard management. Owner: Role 2.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: XY (Xuanyang) (2)   <- counted from the "DONE BY" style markers below
// Current team owner: Role 2, Wei Jie. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
// ==================== 26. PLEDGEBOARD MANAGEMENT ====================

// Load pledgeboard data from API
async function loadAdminPledgeboard() {
    try {
        const response = await fetch('/api/pledgeboard/admin/pledges?status=all');
        const data = await response.json();
        
        if (data.success) {
            allPledgeboardData = data.pledges;
            filteredPledgeboardData = data.pledges;
            pledgeboardCurrentPage = 1;
            renderPledgeboardPage();
        } else {
            console.error('Failed to load pledgeboard:', data.message);
        }
    } catch (error) {
        console.error('Error loading pledgeboard:', error);
    }
}

// Filter pledgeboard data by search term
function filterPledgeboardData() {
    const searchInput = document.getElementById('pledgeboard-search-input');
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        filteredPledgeboardData = allPledgeboardData;
    } else {
        filteredPledgeboardData = allPledgeboardData.filter(pledge => 
            pledge.name.toLowerCase().includes(searchTerm) ||
            pledge.pledge.toLowerCase().includes(searchTerm)
        );
    }
    
    pledgeboardCurrentPage = 1;
    renderPledgeboardPage();
}

// Clear pledgeboard search
function clearPledgeboardSearch() {
    const searchInput = document.getElementById('pledgeboard-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    filteredPledgeboardData = allPledgeboardData;
    pledgeboardCurrentPage = 1;
    renderPledgeboardPage();
}

// Render current page of pledgeboard
function renderPledgeboardPage() {
    const tableBody = document.getElementById('pledgeboard-table-body');
    const countSpan = document.getElementById('pledgeboard-count');
    
    if (!tableBody) return;
    
    // Update count
    if (countSpan) {
        countSpan.textContent = filteredPledgeboardData.length;
    }
    
    if (filteredPledgeboardData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">
                    No pledges found
                </td>
            </tr>
        `;
        updatePledgeboardPaginationControls();
        return;
    }
    
    // Calculate pagination
    const startIndex = (pledgeboardCurrentPage - 1) * pledgeboardItemsPerPage;
    const endIndex = startIndex + pledgeboardItemsPerPage;
    const pageData = filteredPledgeboardData.slice(startIndex, endIndex);
    
    // Render pledges for current page
    tableBody.innerHTML = pageData.map((pledge, pageIndex) => {
        const date = new Date(pledge.created_at).toLocaleDateString();
        const actualRank = startIndex + pageIndex + 1; // Rank across all pages
        const status = pledge.moderation_status || 'approved';
        const sentiment = pledge.metadata?.pledgeSentiment || 'neutral';
        
        // Add medal for top 3 (only on first page)
        let rankDisplay = `<span style="font-size: 14px;">#${actualRank}</span>`;
        if (pledgeboardCurrentPage === 1) {
            if (pageIndex === 0) rankDisplay = '<span style="font-size: 18px;">🥇</span> <span style="font-size: 14px;">#1</span>';
            else if (pageIndex === 1) rankDisplay = '<span style="font-size: 18px;">🥈</span> <span style="font-size: 14px;">#2</span>';
            else if (pageIndex === 2) rankDisplay = '<span style="font-size: 18px;">🥉</span> <span style="font-size: 14px;">#3</span>';
        }
        
        return `
            <tr class="data-row">
                <td style="font-weight: 600; text-align: center;">${rankDisplay}</td>
                <td>${escapeHtml(pledge.name)}</td>
                <td style="max-width: 400px;">${escapeHtml(pledge.pledge)}</td>
                <td style="font-weight: 600; color: #6366F1; text-align: center;">
                    ❤️ ${pledge.like_count || 0}
                </td>
                <td>
                    <span class="pledge-status-badge pledge-status-${escapeHtml(status)}">${escapeHtml(status)}</span>
                    <small class="pledge-sentiment-label">${escapeHtml(sentiment)}</small>
                </td>
                <td>${date}</td>
                <td>${renderPledgeModerationButtons(pledge.id, status, sentiment)}</td>
            </tr>
        `;
    }).join('');
    
    updatePledgeboardPaginationControls();
}

// Pledge moderation controls for negative/admin-reviewed pledges (DONE BY XY)
function renderPledgeModerationButtons(feedbackId, currentStatus, sentiment) {
    if (sentiment !== 'negative' && currentStatus === 'approved') {
        return '<span class="pledge-auto-approved">Auto-approved</span>';
    }

    const statuses = [
        { value: 'approved', label: 'Approve' },
        { value: 'rejected', label: 'Reject' },
        { value: 'pending', label: 'Pending' }
    ];

    return `
        <div class="pledge-moderation-actions">
            ${statuses.map(status => `
                <button
                    type="button"
                    class="pledge-moderation-btn pledge-moderation-${status.value}"
                    onclick="updatePledgeModerationStatus(${Number(feedbackId)}, '${status.value}')"
                    ${currentStatus === status.value ? 'disabled' : ''}
                >${status.label}</button>
            `).join('')}
        </div>
    `;
}

// Save pledge moderation status from admin page (DONE BY XY)
async function updatePledgeModerationStatus(feedbackId, status) {
    try {
        const response = await fetch(`/api/pledgeboard/admin/pledges/${feedbackId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                username: sessionStorage.getItem('loggedUser') || 'admin'
            })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to update pledge status');
        }

        const updateRow = pledge => (
            Number(pledge.id) === Number(feedbackId)
                ? {
                    ...pledge,
                    moderation_status: status,
                    metadata: {
                        ...(pledge.metadata || {}),
                        pledgeStatus: status
                    }
                }
                : pledge
        );

        allPledgeboardData = allPledgeboardData.map(updateRow);
        filteredPledgeboardData = filteredPledgeboardData.map(updateRow);
        renderPledgeboardPage();
    } catch (error) {
        console.error('Error updating pledge moderation status:', error);
        alert('Error updating pledge status: ' + error.message);
    }
}

// Update pledgeboard pagination controls
function updatePledgeboardPaginationControls() {
    const totalPages = Math.ceil(filteredPledgeboardData.length / pledgeboardItemsPerPage);
    const pageInfo = document.getElementById('pledgeboard-page-info');
    const prevBtn = document.getElementById('prev-pledgeboard-btn');
    const nextBtn = document.getElementById('next-pledgeboard-btn');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${pledgeboardCurrentPage} of ${totalPages} (${filteredPledgeboardData.length} total)`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = pledgeboardCurrentPage === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = pledgeboardCurrentPage >= totalPages;
    }
}

// Navigate to previous pledgeboard page
function prevPledgeboardPage() {
    if (pledgeboardCurrentPage > 1) {
        pledgeboardCurrentPage--;
        renderPledgeboardPage();
    }
}

// Navigate to next pledgeboard page
function nextPledgeboardPage() {
    const totalPages = Math.ceil(filteredPledgeboardData.length / pledgeboardItemsPerPage);
    if (pledgeboardCurrentPage < totalPages) {
        pledgeboardCurrentPage++;
        renderPledgeboardPage();
    }
}

