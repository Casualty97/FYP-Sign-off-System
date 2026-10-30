// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 22 of 30: archive deletion (system admin only). Owner: Role 3.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: no markers in this file   <- counted from the "DONE BY" style markers below
// Current team owner: Role 3, Jun Kai. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
// ==================== 24. ARCHIVE DELETION FUNCTIONS (System Admin Only) ====================

// Show/hide deletion controls based on user role
function initializeDeletionControls() {
    const userRole = sessionStorage.getItem('userRole');
    const deletionControls = document.getElementById('archive-deletion-controls');
    
    if (userRole === 'system_admin' && deletionControls) {
        deletionControls.style.display = 'block';
        console.log('✅ Deletion controls enabled for system_admin');
    } else if (deletionControls) {
        deletionControls.style.display = 'none';
    }
}

// Toggle select all checkboxes in archive
function toggleSelectAllArchive(checkbox) {
    const checkboxes = document.querySelectorAll('.archive-select-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
    updateArchiveSelectionCount();
}

// Update selected count and enable/disable delete button
function updateArchiveSelectionCount() {
    const checkboxes = document.querySelectorAll('.archive-select-checkbox:checked');
    const count = checkboxes.length;
    
    const countDisplay = document.getElementById('selected-count');
    const deleteBtn = document.getElementById('delete-selected-btn');
    
    if (countDisplay) {
        countDisplay.textContent = `${count} selected`;
    }
    
    if (deleteBtn) {
        deleteBtn.disabled = count === 0;
    }
    
    // Update select-all checkbox state
    const selectAllCheckbox = document.getElementById('select-all-archive');
    const allCheckboxes = document.querySelectorAll('.archive-select-checkbox');
    
    if (selectAllCheckbox && allCheckboxes.length > 0) {
        selectAllCheckbox.checked = checkboxes.length === allCheckboxes.length;
        selectAllCheckbox.indeterminate = checkboxes.length > 0 && checkboxes.length < allCheckboxes.length;
    }
}

// Set quick date for bulk deletion
function setQuickDeleteDate(value) {
    const dateInput = document.getElementById('bulk-delete-date');
    if (!dateInput || !value) return;
    
    const now = new Date();
    let targetDate = new Date();
    
    switch (value) {
        case '3months':
            targetDate.setMonth(now.getMonth() - 3);
            break;
        case '6months':
            targetDate.setMonth(now.getMonth() - 6);
            break;
        case '1year':
            targetDate.setFullYear(now.getFullYear() - 1);
            break;
        case '2years':
            targetDate.setFullYear(now.getFullYear() - 2);
            break;
        case '3years':
            targetDate.setFullYear(now.getFullYear() - 3);
            break;
        default:
            return;
    }
    
    // Format date as YYYY-MM-DD
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;
    
    // Automatically preview
    previewBulkDelete();
}

// Preview bulk deletion count
async function previewBulkDelete() {
    const dateInput = document.getElementById('bulk-delete-date');
    const previewDiv = document.getElementById('preview-count');
    const previewNumber = document.getElementById('preview-number');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    
    if (!dateInput || !dateInput.value) {
        alert('Please select a date first');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/archive/preview-deletion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-username': sessionStorage.getItem('loggedUser')
            },
            body: JSON.stringify({
                dateRange: {
                    before: dateInput.value
                }
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (previewNumber) previewNumber.textContent = data.count;
            if (previewDiv) previewDiv.style.display = 'block';
            if (bulkDeleteBtn) bulkDeleteBtn.disabled = data.count === 0;
            
            console.log(`📊 Preview: ${data.count} records will be deleted`);
        } else {
            throw new Error(data.error || 'Failed to preview deletion');
        }
    } catch (error) {
        console.error('❌ Error previewing deletion:', error);
        alert('Error previewing deletion: ' + error.message);
    }
}

// Delete selected archived feedback
async function deleteSelectedArchive() {
    const checkboxes = document.querySelectorAll('.archive-select-checkbox:checked');
    const feedbackIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    if (feedbackIds.length === 0) {
        alert('Please select at least one record to delete');
        return;
    }
    
    // Show confirmation modal
    const modal = showDeletionConfirmationModal(feedbackIds.length, 'selected');
    
    modal.onconfirm = async (password) => {
        try {
            const response = await fetch('/api/admin/archive/delete-selected', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-username': sessionStorage.getItem('loggedUser')
                },
                body: JSON.stringify({
                    feedbackIds: feedbackIds,
                    password: password
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert(`✅ Successfully deleted ${data.deletedCount} record(s)`);
                
                // Uncheck select-all
                const selectAllCheckbox = document.getElementById('select-all-archive');
                if (selectAllCheckbox) selectAllCheckbox.checked = false;
                
                // Reload archive data
                await loadArchiveData();
            } else {
                throw new Error(data.error || 'Failed to delete records');
            }
        } catch (error) {
            console.error('❌ Error deleting selected:', error);
            alert('Error: ' + error.message);
        }
    };
}

// Bulk delete by date
async function bulkDeleteByDate() {
    const dateInput = document.getElementById('bulk-delete-date');
    const previewNumber = document.getElementById('preview-number');
    
    if (!dateInput || !dateInput.value) {
        alert('Please select a date first');
        return;
    }
    
    const count = previewNumber ? parseInt(previewNumber.textContent) : 0;
    
    if (count === 0) {
        alert('No records found before the selected date');
        return;
    }
    
    // Show confirmation modal
    const modal = showDeletionConfirmationModal(count, 'date', dateInput.value);
    
    modal.onconfirm = async (password) => {
        try {
            const response = await fetch('/api/admin/archive/delete-by-date', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-username': sessionStorage.getItem('loggedUser')
                },
                body: JSON.stringify({
                    beforeDate: dateInput.value,
                    password: password
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert(`✅ Successfully deleted ${data.deletedCount} record(s) and ${data.photosDeleted} photo(s)`);
                
                // Reset inputs
                dateInput.value = '';
                const quickSelect = document.getElementById('bulk-delete-quick');
                if (quickSelect) quickSelect.value = '';
                
                // Hide preview
                const previewDiv = document.getElementById('preview-count');
                if (previewDiv) previewDiv.style.display = 'none';
                
                // Disable delete button
                const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
                if (bulkDeleteBtn) bulkDeleteBtn.disabled = true;
                
                // Reload archive data
                await loadArchiveData();
            } else {
                throw new Error(data.error || 'Failed to delete records');
            }
        } catch (error) {
            console.error('❌ Error bulk deleting:', error);
            alert('Error: ' + error.message);
        }
    };
}

// Show deletion confirmation modal
function showDeletionConfirmationModal(count, type, date = null) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'deletion-modal-content';
    
    // Create title based on type
    const title = type === 'date' 
        ? `Delete ${count} Records Before ${new Date(date).toLocaleDateString()}?`
        : `Delete ${count} Selected Record${count !== 1 ? 's' : ''}?`;
    
    modal.innerHTML = `
        <div class="modal-header">
            <h2>⚠️ Confirm Permanent Deletion</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        
        <div class="modal-body">
            <div class="deletion-modal-warning">
                <h3>🚨 WARNING: This action cannot be undone!</h3>
                <p>You are about to permanently delete:</p>
                <ul>
                    <li><strong>${count}</strong> archived feedback ${count !== 1 ? 'entries' : 'entry'}</li>
                    <li>All associated answers and data</li>
                    <li>All associated photos from the filesystem</li>
                    <li>Orphaned user records (if applicable)</li>
                </ul>
                ${type === 'date' ? `<p><strong>All records archived before ${new Date(date).toLocaleDateString()}</strong></p>` : ''}
            </div>
            
            <div class="backup-checkbox-container">
                <label>
                    <input type="checkbox" id="backup-confirm" required>
                    I confirm that I have exported a backup of this data
                </label>
            </div>
            
            <div class="form-group">
                <label for="delete-password"><strong>Enter your password to confirm:</strong></label>
                <input type="password" id="delete-password" class="confirm-delete-input" 
                       placeholder="Enter your password" required>
            </div>
        </div>
        
        <div class="modal-footer">
            <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button class="btn-danger" id="confirm-delete-btn">Delete Permanently</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Focus password input
    const passwordInput = modal.querySelector('#delete-password');
    setTimeout(() => passwordInput && passwordInput.focus(), 100);
    
    // Handle confirmation
    const confirmBtn = modal.querySelector('#confirm-delete-btn');
    const backupCheckbox = modal.querySelector('#backup-confirm');
    
    const callbackObj = {
        onconfirm: null
    };
    
    confirmBtn.onclick = async () => {
        if (!backupCheckbox.checked) {
            alert('Please confirm that you have exported a backup');
            return;
        }
        
        const password = passwordInput.value;
        
        if (!password) {
            alert('Please enter your password');
            return;
        }
        
        // Disable button while processing
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting...';
        
        if (callbackObj.onconfirm) {
            await callbackObj.onconfirm(password);
        }
        
        // Remove modal
        overlay.remove();
    };
    
    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    };
    
    // Close on escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
    
    return callbackObj;
}

// Initialize deletion controls when archive page loads
function refreshArchiveData() {
    console.log('🔄 Refreshing archive data...');
    loadArchiveData();
}

