// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 12 of 30: decrypted email popup. Owner: Role 3.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ==================== 11. EMAIL MANAGEMENT ====================

// Custom password prompt with hidden input (replacement for native prompt)
// Returns a Promise that resolves with the password or null if cancelled
function showPasswordPrompt(message) {
    return new Promise((resolve) => {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        // Create prompt box
        const promptBox = document.createElement('div');
        promptBox.style.cssText = `
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            width: 90%;
            max-width: 400px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;
        
        promptBox.innerHTML = `
            <div style="margin-bottom: 20px;">
                <div style="font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 8px; white-space: pre-line;">${message}</div>
            </div>
            <input type="password" id="password-prompt-input" 
                placeholder="Enter password" 
                style="
                    width: 100%;
                    padding: 10px 12px;
                    border: 2px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 14px;
                    box-sizing: border-box;
                    margin-bottom: 15px;
                "
            />
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="password-prompt-cancel" style="
                    padding: 8px 16px;
                    background: #e2e8f0;
                    color: #475569;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">Cancel</button>
                <button id="password-prompt-ok" style="
                    padding: 8px 16px;
                    background: #0A1E81;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">OK</button>
            </div>
        `;
        
        modal.appendChild(promptBox);
        document.body.appendChild(modal);
        
        const input = document.getElementById('password-prompt-input');
        const okBtn = document.getElementById('password-prompt-ok');
        const cancelBtn = document.getElementById('password-prompt-cancel');
        
        // Focus input
        setTimeout(() => input.focus(), 100);
        
        // Handle OK button
        const handleOk = () => {
            const password = input.value;
            modal.remove();
            resolve(password || null);
        };
        
        // Handle Cancel button
        const handleCancel = () => {
            modal.remove();
            resolve(null);
        };
        
        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
        
        // Handle Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleOk();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
        });
        
        // Handle click outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        });
    });
}

// Show email in popup
function showEmailPopup(feedbackId, decryptedEmail) {
    const emailPopup = document.createElement('div');
    emailPopup.className = 'email-popup';
    emailPopup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1001;
    `;

    emailPopup.innerHTML = `
        <div class="email-container" style="
            background: white;
            padding: 25px;
            border-radius: 12px;
            max-width: 500px;
            max-height: 300px;
            text-align: center;
            position: relative;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #1e293b;">Decrypted Email - ID: ${feedbackId}</h3>
                <button onclick="closeEmailPopup()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                    padding: 5px 10px;
                ">×</button>
            </div>
            
            <div style="
                background: #f8fafc;
                padding: 20px;
                border-radius: 8px;
                border: 2px solid #e2e8f0;
                margin-bottom: 20px;
                word-break: break-all;
            ">
                <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;">Decrypted Email:</div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b;">${decryptedEmail}</div>
            </div>
            
            <div style="font-size: 12px; color: #64748b; margin-bottom: 15px;">
                Email accessed by: ${sessionStorage.getItem('loggedUser')} at ${new Date().toLocaleTimeString()}
            </div>
            
            <button onclick="closeEmailPopup()" style="
                padding: 8px 16px;
                background: #0A1E81;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
            ">
                Close
            </button>
        </div>
    `;

    document.body.appendChild(emailPopup);
}

// Close email modal
function closeEmailModal() {
    const modal = document.querySelector('.email-access-modal');
    if (modal) {
        modal.remove();
    }
    currentEmailViewingId = null;
}

// Close email popup
function closeEmailPopup() {
    const popup = document.querySelector('.email-popup');
    if (popup) {
        popup.remove();
    }
}

