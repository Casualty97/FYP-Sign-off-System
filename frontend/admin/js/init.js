// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 20 of 30: initialisation, event handlers, utilities. Owner: shared.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ==================== 25. INITIALIZATION & EVENT HANDLERS ====================

// Check if user is already logged in
window.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking login status...');
    const loggedUser = sessionStorage.getItem('loggedUser');
    if (loggedUser) {
        console.log('User already logged in:', loggedUser);
        const userRole = sessionStorage.getItem('userRole');
        updateUIForUser(loggedUser, userRole);
        
        // Load user's theme settings on page load
        console.log('🎨 Loading user theme settings...');
        
        // Load theme from localStorage
        if (typeof loadThemeSettings === 'function') {
            loadThemeSettings();
        }
        
        // Load individual page settings
        if (typeof loadIndividualPageSettings === 'function') {
            loadIndividualPageSettings();
        }
        
        // Apply the theme
        if (typeof applyThemeSettings === 'function') {
            applyThemeSettings();
            console.log('✅ User theme applied on page load');
        }
        
        // Load dashboard data
        loadDashboardData();

        // Initialize the tree stage preview so the current leaf count is shown
        // when the admin tree settings section is available on the page.
        if (document.getElementById('currentLeafCount')) {
            initTreeStageMode();
            updateAutoStagePreview();
        }
        
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'block';
    } else {
        console.log('No user logged in');
    }
});

// ==================== 19. UTILITY FUNCTIONS ====================

// Add spinner animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

