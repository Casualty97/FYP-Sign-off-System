// Owner: Role 3, Jun Kai. Previous team: none marked.
// Part 17/30 of the admin page: feedback deletion (load order in admin.html).
// ==================== 16. FEEDBACK DELETION ====================

let currentDeleteSource = 'feedback';

// Delete feedback with password verification
async function deleteFeedback(feedbackId) {
    currentDeleteFeedbackId = feedbackId;
    currentDeleteSource = 'feedback';
    showDeletePasswordModal();
}

// Delete archived feedback (same modal, refreshes the archive table afterwards)
async function deleteArchiveFeedback(feedbackId) {
    currentDeleteFeedbackId = feedbackId;
    currentDeleteSource = 'archive';
    showDeletePasswordModal();
}

// Show delete password modal
function showDeletePasswordModal() {
    const modal = document.createElement('div');
    modal.className = 'delete-access-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div class="password-prompt" style="
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 90%;
            max-width: 400px;
            text-align: center;
        ">
            <div class="modal-icon" style="font-size: 48px; margin-bottom: 20px;">🗑️</div>
            <h3 style="margin-bottom: 10px; color: #1e293b;">Delete Feedback</h3>
            <p style="color: #64748b; margin-bottom: 25px; font-size: 14px;">
                Please enter your password to confirm deletion of feedback ID: ${currentDeleteFeedbackId}
            </p>
            
            <div class="form-group" style="margin-bottom: 20px; text-align: left;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                    Your Password
                </label>
                <input type="password" id="delete-access-password" 
                    placeholder="Enter your account password" 
                    style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;">
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button type="button" onclick="closeDeleteModal()" style="
                    flex: 1;
                    padding: 12px;
                    background: #64748b;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">Cancel</button>
                <button type="button" onclick="verifyDeleteAccess()" style="
                    flex: 1;
                    padding: 12px;
                    background: linear-gradient(135deg, #dc2626, #b91c1c);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">Delete Feedback</button>
            </div>
            
            <div id="delete-access-error" style="
                color: #dc2626;
                font-size: 13px;
                margin-top: 15px;
                display: none;
            "></div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Verify delete access with password
async function verifyDeleteAccess() {
    const password = document.getElementById('delete-access-password').value;
    const errorDiv = document.getElementById('delete-access-error');
    const username = sessionStorage.getItem('loggedUser');
    
    if (!password) {
        errorDiv.textContent = 'Please enter your password';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!username) {
        errorDiv.textContent = 'User session not found. Please login again.';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/admin/verify-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await performFeedbackDeletion(currentDeleteFeedbackId);
            closeDeleteModal();
        } else {
            errorDiv.textContent = data.error || 'Invalid password. Please try again.';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Error verifying password:', error);
        errorDiv.textContent = 'Error verifying password';
        errorDiv.style.display = 'block';
    }
}

// Perform the actual feedback deletion
async function performFeedbackDeletion(feedbackId) {
    console.log('🗑️ Deleting feedback ID:', feedbackId);
    
    try {
        const response = await fetch(`/api/admin/feedback/${feedbackId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete feedback');
        }
        
        if (data.success) {
            alert('✅ Feedback deleted successfully!');
            if (currentDeleteSource === 'archive') loadArchiveData(); else loadFeedbackData();
        } else {
            alert('❌ Failed to delete feedback: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting feedback:', error);
        alert('❌ Error deleting feedback: ' + error.message);
    }
}

// Close delete modal
function closeDeleteModal() {
    const modal = document.querySelector('.delete-access-modal');
    if (modal) {
        modal.remove();
    }
    currentDeleteFeedbackId = null;
}

