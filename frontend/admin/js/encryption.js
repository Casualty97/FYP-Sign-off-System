// Owner: Role 3, Jun Kai. Previous team: none marked.
// Part 8/30 of the admin page: email decrypt / re-encrypt buttons (load order in admin.html).
// ==================== 8. ENCRYPTION MANAGEMENT (PAGE-SPECIFIC) ====================

// Update feedback encryption buttons
function updateEncryptionButtons() {
    const decryptBtn = document.getElementById('decrypt-emails-btn');
    const reEncryptBtn = document.getElementById('re-encrypt-btn');
    const userRole = sessionStorage.getItem('userRole');
    
    if (userRole !== 'system_admin') {
        if (decryptBtn) decryptBtn.style.display = 'none';
        if (reEncryptBtn) reEncryptBtn.style.display = 'none';
        return;
    }
    
    // Decrypt button
    if (encryptedFeedbackIds.length > 0 && !isAnyEmailDecrypted) {
        if (decryptBtn) {
            // <Jun Kai start> UI kit button with an icon (admin redesign)
            decryptBtn.style.display = 'inline-flex';
            decryptBtn.innerHTML = `${uiIcon('unlock', 15)}Decrypt emails (${encryptedFeedbackIds.length})`;
            // <Jun Kai end>
        }
    } else {
        if (decryptBtn) decryptBtn.style.display = 'none';
    }
    
    // Re-encrypt button
    if (isAnyEmailDecrypted) {
        if (reEncryptBtn) {
            // <Jun Kai start> UI kit button with an icon (admin redesign)
            reEncryptBtn.style.display = 'inline-flex';
            const count = Object.keys(decryptedEmailMap).length;
            reEncryptBtn.innerHTML = `${uiIcon('lock', 15)}Lock emails again (${count})`;
            // <Jun Kai end>
        }
    } else {
        if (reEncryptBtn) reEncryptBtn.style.display = 'none';
    }
}

// Update archive encryption buttons
function updateArchiveEncryptionButtons() {
    const decryptBtn = document.getElementById('decrypt-archive-emails-btn');
    const reEncryptBtn = document.getElementById('re-encrypt-archive-btn');
    const userRole = sessionStorage.getItem('userRole');
    
    if (userRole !== 'system_admin') {
        if (decryptBtn) decryptBtn.style.display = 'none';
        if (reEncryptBtn) reEncryptBtn.style.display = 'none';
        return;
    }
    
    // Decrypt button
    if (encryptedArchiveIds.length > 0 && !isAnyArchiveEmailDecrypted) {
        if (decryptBtn) {
            decryptBtn.style.display = 'inline-flex'; // <Jun Kai/> UI kit button with an icon
            decryptBtn.innerHTML = `${uiIcon('unlock', 15)}Decrypt emails (${encryptedArchiveIds.length})`;
        }
    } else {
        if (decryptBtn) decryptBtn.style.display = 'none';
    }
    
    // Re-encrypt button
    if (isAnyArchiveEmailDecrypted) {
        if (reEncryptBtn) {
            reEncryptBtn.style.display = 'inline-flex'; // <Jun Kai/> UI kit button with an icon
            const count = Object.keys(decryptedArchiveEmailMap).length;
            reEncryptBtn.innerHTML = `${uiIcon('lock', 15)}Lock emails again (${count})`;
        }
    } else {
        if (reEncryptBtn) reEncryptBtn.style.display = 'none';
    }
}

//Decrypt all emails on current feedback page (MAX 25)
async function decryptAllEmails() {
    if (sessionStorage.getItem('userRole') !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        return;
    }
    
    if (encryptedFeedbackIds.length === 0) {
        alert('No encrypted emails on this page.');
        return;
    }
    
    const password = await showPasswordPrompt(`🔓 Decrypt ${encryptedFeedbackIds.length} emails on this page? It might take a few seconds/minutes.\n\nEnter your System Admin password:`);
    if (!password) return;
    
    try {
        const username = sessionStorage.getItem('loggedUser');
        let successCount = 0;
        let passwordVerified = false;
        
        for (const feedbackId of encryptedFeedbackIds) {
            const response = await fetch('/api/admin/decrypt-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-username': username
                },
                body: JSON.stringify({ feedbackId, password, username })
            });
            
            const data = await response.json();
            
            // Check first response if password is wrong, stop immediately
            if (!passwordVerified) {
                if (!data.success) {
                    // Wrong password on first attempt
                    alert('❌ Incorrect password. Decryption cancelled.\n\nPlease try again with the correct System Admin password.');
                    console.error('❌ Authentication failed: Invalid password');
                    return; // Exit function don't set isAnyEmailDecrypted
                }
                passwordVerified = true;
            }
            
            if (data.success) {
                decryptedEmailMap[feedbackId] = data.decryptedEmail;
                successCount++;
            } else {
                console.warn(`⚠️ Failed to decrypt email for feedback ID: ${feedbackId}`);
            }
        }
        
        // Only set flag if at least one email was successfully decrypted
        if (successCount > 0) {
            isAnyEmailDecrypted = true;
            renderFeedbackPage();
            console.log(`✅ Successfully decrypted ${successCount} of ${encryptedFeedbackIds.length} emails`);
            
            if (successCount < encryptedFeedbackIds.length) {
                alert(`⚠️ Partially completed: ${successCount} of ${encryptedFeedbackIds.length} emails decrypted.\n\nSome emails could not be decrypted.`);
            }
        } else {
            alert('❌ No emails were decrypted. Please try again.');
            console.error('❌ Decryption failed: No emails were successfully decrypted');
        }
    } catch (error) {
        console.error('❌ Decryption error:', error);
        alert('❌ Network error occurred during decryption.\n\nPlease check your connection and try again.');
    }
}

//Decrypt all emails on current archive page (MAX 25)
async function decryptAllArchiveEmails() {
    if (sessionStorage.getItem('userRole') !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        return;
    }
    
    if (encryptedArchiveIds.length === 0) {
        alert('No encrypted emails on this page.');
        return;
    }
    
    const password = await showPasswordPrompt(`🔓 Decrypt ${encryptedArchiveIds.length} emails on this page? It might take a few seconds/minutes.\n\nEnter your System Admin password:`);
    if (!password) return;
    
    try {
        const username = sessionStorage.getItem('loggedUser');
        let successCount = 0;
        let passwordVerified = false;
        
        for (const feedbackId of encryptedArchiveIds) {
            const response = await fetch('/api/admin/decrypt-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-username': username
                },
                body: JSON.stringify({ feedbackId, password, username })
            });
            
            const data = await response.json();
            
            // Check first response if password is wrong, stop immediately
            if (!passwordVerified) {
                if (!data.success) {
                    // Wrong password on first attempt
                    alert('❌ Incorrect password. Decryption cancelled.\n\nPlease try again with the correct System Admin password.');
                    console.error('❌ Authentication failed: Invalid password');
                    return; // Exit function - don't set isAnyArchiveEmailDecrypted
                }
                passwordVerified = true;
            }
            
            if (data.success) {
                decryptedArchiveEmailMap[feedbackId] = data.decryptedEmail;
                successCount++;
            } else {
                console.warn(`⚠️ Failed to decrypt email for feedback ID: ${feedbackId}`);
            }
        }
        
        // Only set flag if at least one email was successfully decrypted
        if (successCount > 0) {
            isAnyArchiveEmailDecrypted = true;
            renderArchivePage();
            console.log(`✅ Successfully decrypted ${successCount} of ${encryptedArchiveIds.length} archive emails`);
            
            if (successCount < encryptedArchiveIds.length) {
                alert(`⚠️ Partially completed: ${successCount} of ${encryptedArchiveIds.length} emails decrypted.\n\nSome emails could not be decrypted.`);
            }
        } else {
            alert('❌ No emails were decrypted. Please try again.');
            console.error('❌ Decryption failed: No emails were successfully decrypted');
        }
    } catch (error) {
        console.error('❌ Decryption error:', error);
        alert('❌ Network error occurred during decryption.\n\nPlease check your connection and try again.');
    }
}

//Re-encrypt feedback emails
function reEncryptAllEmails() {
    decryptedEmailMap = {};
    isAnyEmailDecrypted = false;
    renderFeedbackPage();
    console.log('🔒 All feedback emails re-encrypted');
}

//Re-encrypt archive emails
function reEncryptAllArchiveEmails() {
    decryptedArchiveEmailMap = {};
    isAnyArchiveEmailDecrypted = false;
    renderArchivePage();
    console.log('🔒 All archive emails re-encrypted');
}

