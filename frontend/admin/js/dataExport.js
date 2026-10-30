// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 16 of 30: data export. Owner: Role 3.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: no markers in this file   <- counted from the "DONE BY" style markers below
// Current team owner: Role 3, Jun Kai. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
// ==================== 15. DATA EXPORT MANAGEMENT ====================

// Initialize data export page when tab is clicked
function initDataExportPage() {
    const userRole = sessionStorage.getItem('userRole');
    
    // Check if user is system admin
    if (userRole !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        showPage('dashboard');
        return false;
    }
    
    // Pre-fill username
    const username = sessionStorage.getItem('loggedUser');
    document.getElementById('export-username').value = username;
    
    // Show password panel by default
    document.getElementById('data-export-password-panel').style.display = 'flex';
    document.getElementById('data-export-cards').style.display = 'none';
    
    return true;
}

// Unlock data export with password
async function unlockDataExport(event) {
    event.preventDefault();
    
    const username = sessionStorage.getItem('loggedUser');
    const userRole = sessionStorage.getItem('userRole');
    const password = document.getElementById('export-password').value;
    const errorDiv = document.getElementById('export-unlock-error');
    
    // Check if user is system admin
    if (userRole !== 'system_admin') {
        errorDiv.textContent = 'Access denied. System Administrator privileges required.';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!password) {
        errorDiv.textContent = 'Please enter your password';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/admin/data-export/unlock', {
            method: 'POST',
            credentials: 'same-origin', // Include session cookie
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store unlock status
            dataExportUnlocked = true;
            dataExportUnlockTime = new Date();
            
            // Hide password panel, show export cards
            document.getElementById('data-export-password-panel').style.display = 'none';
            document.getElementById('data-export-cards').style.display = 'block';
            
            // Update session info
            updateExportSessionInfo(30); // 30 minutes
            
            // Clear password field
            document.getElementById('export-password').value = '';
            errorDiv.style.display = 'none';
            
            console.log('✅ Data export unlocked for 30 minutes');
        } else {
            errorDiv.textContent = data.error || 'Invalid password';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Error unlocking data export:', error);
        errorDiv.textContent = 'Error connecting to server';
        errorDiv.style.display = 'block';
    }
}

// Update session info display
function updateExportSessionInfo(expiresInMinutes) {
    const infoElement = document.getElementById('export-session-info');
    if (infoElement) {
        const expiryTime = new Date(Date.now() + expiresInMinutes * 60000);
        infoElement.textContent = `Session expires at ${expiryTime.toLocaleTimeString()}`;
    }
}

// Download export file (CSV or ZIP)
async function downloadExport(exportType) {
    try {
        const username = sessionStorage.getItem('loggedUser');
        const userRole = sessionStorage.getItem('userRole');
        
        if (!username || userRole !== 'system_admin') {
            alert('System Administrator privileges required');
            return;
        }
        
        console.log(`🔥 Downloading export: ${exportType}`);
        
        const response = await fetch(`/api/admin/data-export/${exportType}`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Download failed');
        }
        
        // Get filename from Content-Disposition header or create default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'export.csv';
        
        if (contentDisposition) {
            const match = contentDisposition.match(/filename=(.+)/);
            if (match) {
                filename = match[1].replace(/['"]/g, '');
            }
        }
        
        // Download file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log(`✅ Download complete: ${filename}`);
        
    } catch (error) {
        console.error('❌ Download error:', error);
        alert('Error downloading export: ' + error.message);
    }
}

