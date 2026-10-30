// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 1 of 30: previous-team index, session timeout, 401 handling, login/logout, global state. Owner: shared.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: Preti (289), Yu Kang (22), XY (Xuanyang) (20), Caeden (13), Nick (6), Bernissa (3), Nadhirah (2), Zah (1)   <- counted from the "DONE BY" style markers below
// Current team owner: shared. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
// ============================================================
// YU KANG — Feedback Analysis Options & LocalGPT (Done by Yu Kang)
// - Feedback analysis modes available in the admin UI:
//   * rule-based: server-side heuristic rules
//   * xenova: Xenova transformer integration (remote or local)
//   * localgpt: on-prem LocalGPT fallback for private/offline inference
// - LocalGPT note: LocalGPT runs models locally/offline to avoid external API calls
//   and preserve visitor data privacy when required.
//
// - Flagged feedback analysis:
//   * Added keyword-based flagging for potential issues (e.g. "bad", "worst", "disappointed") (Done by Yu Kang)
//   * Admin dashboard highlights flagged feedback for review (Done by Yu Kang)
//
// ============================================================
// XY CHANGE SUMMARY (DONE BY XY)
// ============================================================
//
// 1. LIVE PULSE ADMIN ACCESS
//    function openPulsePage()         - Open public Live Pulse dashboard from admin page (DONE BY XY)
//    showPage('pulse')                - Added admin Live Pulse launcher page navigation (DONE BY XY)
//
// 2. BADGE EMAIL TEMPLATE MANAGEMENT
//    const DEFAULT_BADGE_EMAIL_BADGES - Active badge fallback list for admin editor (DONE BY XY)
//    function loadBadgeEmailTemplates - Load editable badge email templates from admin API (DONE BY XY)
//    function saveBadgeEmailTemplates - Save per-badge subject, message and highlights (DONE BY XY)
//    function renderBadgeTemplateBadgeList - Render active badge picker cards (DONE BY XY)
//
// 3. ACTIVE BADGE CLEANUP
//    Badge editor list              - Shows Feedback Contributor plus 6 pledge-topic badges only (DONE BY XY)
//    Removed inactive badges         - Eco Warrior and Commitment Champion removed from editor fallback list (DONE BY XY)
//
// 4. TREE LEAF FALL PARAMETER ADMIN
//    populateParameterForm           - Load leaf fall threshold and duration into admin controls (DONE BY XY)
//    collectParameterForm            - Save leaf fall threshold and duration to tree parameters (DONE BY XY)
//
// 5. CONSENT AND PLEDGE TEXT PARAMETERS
//    populateParameterForm           - Load temporary retention days and editable pledge examples (DONE BY XY)
//    collectParameterForm            - Save contentSettings for retention duration and pledge example text (DONE BY XY)
//
// 6. DAILY LEAVES AND PLEDGES DASHBOARD
//    loadDailyLeafPledgeData          - Fetch last 6 days of leaf and pledge counts from admin API (DONE BY XY)
//    createDailyLeafPledgeChart       - Render bar/line chart comparing leaves and pledges per day (DONE BY XY)
//    setDailyLeafPledgeChartType      - Switch Daily Leaves & Pledges between bar and line chart (DONE BY XY)
//    updateDailyLeafPledgeSummary     - Render totals and daily handover summary cards (DONE BY XY)
//
// 7. PLEDGE MODERATION UI
//    renderPledgeModerationButtons    - Add Approve, Reject and Pending admin controls (DONE BY XY)
//    updatePledgeModerationStatus     - Save pledge moderation status from admin page (DONE BY XY)
//
//
// FIND COMMAND
//    rg -n "XY CHANGE SUMMARY|DONE BY XY" frontend backend
//
// CAEDEN CHANGE SUMMARY (DONE BY CAEDEN)
// ============================================================
//
// 1. PARAMETER ADJUSTMENT ADMIN BEHAVIOR
//    showPage('parameter-adjustment') - Load parameter settings when opening the admin section (DONE BY CAEDEN)
//    function loadParameters          - Fetch saved editable kiosk parameters from admin API (DONE BY CAEDEN)
//    function saveParameters          - Persist feature flags, validation rules, text, email, tree, photo and visual asset parameters (DONE BY CAEDEN)
//    function uploadParameterBackground - Upload and activate a feedback background image (DONE BY CAEDEN)
//    function resetParametersToDefaults - Restore parameter defaults from admin UI (DONE BY CAEDEN)
//    function translateAdminTextToEnglish - Translate visitor pledge and answer text to English in admin popups (Done by Caeden)
//    function runConfiguredArchiveNow - Run configurable feedback auto-archive update from admin UI (Done by Caeden)
//    function toggleDailyOperation    - One-button End Day / Start Day kiosk control (Done by Caeden)
//
// 2. DASHBOARD INTERVENTION ALERTS
//    function loadInterventionAlerts  - Fetch food waste, pledge, negative feedback and upload risk alerts for dashboard (DONE BY CAEDEN)
//    function renderInterventionAlerts - Render severity, metric and suggested staff action cards (DONE BY CAEDEN)
//    loadDashboardData                - Load chart data and intervention alerts together on dashboard refresh (DONE BY CAEDEN)
//
// FIND COMMAND
//    rg -n "DONE BY CAEDEN|CAEDEN CHANGE SUMMARY" frontend backend
// ============================================================
// NICK CHANGE SUMMARY (DONE BY NICK)
// ============================================================
//
// 1. ESG JOURNEY PASSPORT
//    function loadJourneyPassport     - Fetch visitor milestone passports for repeat engagement tracking (DONE BY NICK)
//    function renderJourneyPassport   - Render passport summary, stamps, topic badges and top visitor journeys (DONE BY NICK)
//
// FIND COMMAND
//    rg -n "DONE BY NICK|NICK CHANGE SUMMARY" frontend backend
// ============================================================
// YU KANG CHANGE SUMMARY (DONE BY YU KANG)
// ============================================================
//
// 1. TREE BACKGROUND IMAGE SELECTION
//    loadAvailableTreeBackgrounds()   - Fetch and display all tree background images from ./assets/Tree/background (DONE BY YU KANG)
//    selectTreeBackground()           - Apply selected tree background and persist to visualAssets.treeBackground (DONE BY YU KANG)
//    window.selectedTreeBackground    - Global state for currently selected background image (DONE BY YU KANG)
//    param-treeBackgroundList         - UI grid picker for browsing available tree background images (DONE BY YU KANG)
//    treeBackgroundPreview            - Live preview display of selected/current tree background (DONE BY YU KANG)
//
// 2. TREE LEAF MANAGEMENT
//    uploadLeafImage()                - Upload custom leaf image to ./assets/Tree/leaf (DONE BY YU KANG)
//    adjustLeafScale()                - Adjust displayed leaf size on /tree page with scale slider (DONE BY YU KANG)
//    revertLeafImage()                - Restore previous leaf image with one-click revert button (DONE BY YU KANG)
//    loadAvailableLeafImages()        - Fetch existing leaf images from ./assets/Tree/leaf directory (DONE BY YU KANG)
//    selectExistingLeaf()             - Browse and apply existing leaf images without re-uploading (DONE BY YU KANG)
//
// 3. TREE STAGES
//    loadTreeStageSelection()          - Load tree stage dropdown for admin control (DONE BY YU KANG)
//    param-treeStage                  - UI selector for tree growth stage progression (DONE BY YU KANG)
//
// 4. AI FEEDBACK ANALYSIS
//    loadAIInsightSummary()            - Fetch AI-powered feedback analysis and insights (DONE BY YU KANG)
//    renderAIInsights()               - Display top concerns, compliments, weekly summary and admin actions (DONE BY YU KANG)
//
// 5. LOCAL AI PLEDGE SENTIMENT
//    pledge auto-approval             - Auto-approve positive and neutral pledges (DONE BY Yu Kang)
//    local transformer fallback       - Use local @xenova/transformers AI when rules are unclear (DONE BY Yu Kang)
//
//
// FIND COMMAND
//    rg -n "YU KANG CHANGE SUMMARY|DONE BY YU KANG" frontend backend
// ============================================================


// ============================================================
// ADMIN.JS - TABLE OF CONTENTS (CTRL+F SEARCHABLE)
// ============================================================
// 
// 0. SESSION TIMEOUT & AUTO-LOGOUT ENHANCEMENT (DONE BY PRETI)
//    const SESSION_TIMEOUT_MS         - Session timeout duration (30 minutes) (DONE BY PRETI)
//    const WARNING_BEFORE_TIMEOUT_MS  - Warning time before timeout (2 minutes) (DONE BY PRETI)
//    const ACTIVITY_CHECK_INTERVAL_MS - Activity check interval (1 minute) (DONE BY PRETI)
//    let lastActivityTime             - Track last user activity timestamp (DONE BY PRETI)
//    let sessionWarningShown          - Flag for session warning modal state (DONE BY PRETI)
//    let activityCheckInterval        - Interval timer for activity checks (DONE BY PRETI)
//    let sessionTimeoutModal          - Reference to timeout warning modal (DONE BY PRETI)
//    function resetActivityTimer()    - Reset activity timer on user interaction (DONE BY PRETI)
//    function initActivityTracking()  - Initialize activity event listeners (DONE BY PRETI)
//    function checkSessionTimeout()   - Check if session has timed out (DONE BY PRETI)
//    function startSessionMonitoring() - Start session timeout monitoring (DONE BY PRETI)
//    function stopSessionMonitoring() - Stop session timeout monitoring (DONE BY PRETI)
//    function showSessionWarningModal() - Show session timeout warning modal (DONE BY PRETI)
//    function updateCountdown()       - Update countdown timer in warning modal (DONE BY PRETI)
//    function closeSessionWarningModal() - Close session warning modal (DONE BY PRETI)
//    function handleSessionTimeout()  - Handle session timeout and logout (DONE BY PRETI)
//    window.fetch                     - Global fetch interceptor for 401 detection (DONE BY PRETI)
//
// 1. GLOBAL VARIABLES & STATE MANAGEMENT (DONE BY PRETI)
//    let currentDownloadType          - Track current download operation type (DONE BY PRETI)
//    let currentDeleteFeedbackId      - Track feedback ID pending deletion (DONE BY PRETI)
//    let currentEmailViewingId        - Track email ID being viewed (DONE BY PRETI)
//    let currentAuditPage             - Current audit logs pagination page (DONE BY PRETI)
//    let auditLogsPerPage             - Items per page for audit logs (DONE BY PRETI)
//    let currentSortField             - Current audit sort column (DONE BY PRETI)
//    let currentSortDirection         - Audit sort direction (DONE BY PRETI)
//    let allAuditLogs                 - Store all loaded audit logs (DONE BY PRETI)
//    let filteredAuditLogs            - Store filtered audit logs (DONE BY PRETI)
//    let allFeedbackData              - ALL not_archived records (DONE BY PRETI)
//    let filteredFeedbackData         - Filtered feedback results (DONE BY PRETI)
//    let feedbackCurrentPage          - Current feedback page (DONE BY PRETI)
//    const feedbackItemsPerPage       - Items per page for feedback (25) (DONE BY PRETI)
//    let allArchiveData               - ALL archived records (DONE BY PRETI)
//    let filteredArchiveData          - Filtered archive results (DONE BY PRETI)
//    let archiveCurrentPage           - Current archive page (DONE BY PRETI)
//    const archiveItemsPerPage        - Items per page for archive (25) (DONE BY PRETI)
//    let allPledgeboardData           - ALL pledgeboard records (DONE BY PRETI)
//    let filteredPledgeboardData      - Filtered pledgeboard results (DONE BY PRETI)
//    let pledgeboardCurrentPage       - Current pledgeboard page (DONE BY PRETI)
//    const pledgeboardItemsPerPage    - Items per page for pledgeboard (25) (DONE BY PRETI)
//    let decryptedEmailMap            - Map of decrypted emails {feedbackId: email} (DONE BY PRETI)
//    let isAnyEmailDecrypted          - Flag for feedback decryption state (DONE BY PRETI)
//    let encryptedFeedbackIds         - Array of encrypted feedback IDs (current page) (DONE BY PRETI)
//    let decryptedArchiveEmailMap     - Map of decrypted archive emails (DONE BY PRETI)
//    let isAnyArchiveEmailDecrypted   - Flag for archive decryption state (DONE BY PRETI)
//    let encryptedArchiveIds          - Array of encrypted archive IDs (current page) (DONE BY PRETI)
//    let dataExportUnlocked           - Track data export session unlock status (DONE BY PRETI)
//    let dataExportUnlockTime         - Track data export unlock timestamp (DONE BY PRETI)
//    window.questionsDataMap          - Store question data for edit functions (DONE BY PRETI)
//    function showNotification()      - Show notification message to user (DONE BY PRETI)
//
// 2. AUTHENTICATION & SESSION MANAGEMENT (DONE BY PRETI)
//    async function handleLogin()     - Admin login with API authentication (DONE BY PRETI)
//    function handleLogout()          - Log out admin user with audit logging and cleanup (DONE BY PRETI)
//    function updateUIForUser()       - Update UI based on user role (DONE BY PRETI)
//    function formatRoleName()        - Format role names for display (DONE BY PRETI)
//
// 3. AUDIT LOGS MANAGEMENT (DONE BY PRETI)
//    async function loadAuditLogs()   - Load all audit log entries (DONE BY PRETI)
//    function populateUserFilter()    - Populate user filter dropdown (DONE BY PRETI)
//    function filterAuditLogs()       - Filter logs by search, action, user, target, IP, date (DONE BY PRETI)
//    function sortFilteredLogs()      - Sort filtered logs by current sort field (DONE BY PRETI)
//    function sortAuditLogs()         - Handle column header clicks for sorting (DONE BY PRETI)
//    function displayAuditLogsPage()  - Display current page of filtered logs (DONE BY PRETI)
//    function updateAuditTable()      - Update audit logs table display (DONE BY PRETI)
//    function getAuditBadgeType()     - Determine badge style based on action type (DONE BY PRETI)
//    function updateAuditPagination() - Update pagination controls (DONE BY PRETI)
//    function prevAuditPage()         - Navigate to previous audit page (DONE BY PRETI)
//    function nextAuditPage()         - Navigate to next audit page (DONE BY PRETI)
//    function toggleAdvancedFilters() - Show/hide advanced filter panel (DONE BY PRETI)
//    function clearAllFilters()       - Reset all filters to default (DONE BY PRETI)
//    function setDateRangePreset()    - Set date range (today/week/month) (DONE BY PRETI)
//    function updateFilterIndicators() - Highlight active filters (DONE BY PRETI)
//    function updateResultsCounts()   - Update result count displays (DONE BY PRETI)
//    async function downloadAuditExcel() - Download filtered logs as CSV/Excel (DONE BY PRETI)
//
// 4. DASHBOARD MANAGEMENT (DONE BY PRETI)
//    let visitorTrendsChart           - Visitor trends chart instance (DONE BY PRETI)
//    let feedbackDistributionChart    - Feedback distribution chart instance (DONE BY PRETI)
//    let currentChartRange            - Current chart time range (DONE BY PRETI)
//    async function loadDashboardData() - Load dashboard statistics and start kiosk monitoring (DONE BY PRETI)
//    function updateEnhancedDashboardStats() - Update dashboard stat cards (DONE BY PRETI)
//    async function updateSystemStatus() - Check and update System Status section (Kiosk, DB) (DONE BY PRETI)
//    function animateValue()          - Animate number value changes (DONE BY PRETI)
//    function updateLastUpdated()     - Update last updated timestamp (DONE BY PRETI)
//    function getDefaultStats()       - Get fallback statistics for offline mode (DONE BY PRETI)
//    function refreshDashboard()      - Refresh dashboard data (DONE BY PRETI)
//    async function loadChartData()   - Load chart data for dashboard (DONE BY PRETI)
//    async function loadVisitorTrendsData() - Load visitor trends chart data (DONE BY PRETI)
//    async function loadFeedbackDistributionData() - Load feedback distribution data (DONE BY PRETI)
//    function createVisitorTrendsChart() - Create visitor trends chart (DONE BY PRETI)
//    function createEmptyVisitorTrendsChart() - Create empty placeholder chart (DONE BY PRETI)
//    function createVisitorTrendsChartWithSampleData() - Create chart with sample data (DONE BY PRETI)
//    function createFeedbackDistributionChart() - Create feedback distribution chart (DONE BY PRETI)

// 5. FEEDBACK DATA MANAGEMENT (NOT_ARCHIVED) (DONE BY PRETI)
//    async function loadFeedbackData() - Load ALL feedback data (not_archived) (DONE BY PRETI)
//    function filterFeedbackData()    - Filter feedback based on all active filters (DONE BY PRETI)
//    function updateFeedbackCounts()  - Update feedback count displays (DONE BY PRETI)
//    function renderFeedbackPage()    - Render current page of feedback (25 records) (DONE BY PRETI)
//    function updateFeedbackPaginationControls() - Update feedback pagination controls (DONE BY PRETI)
//    function prevFeedbackPage()      - Navigate to previous feedback page (DONE BY PRETI)
//    function nextFeedbackPage()      - Navigate to next feedback page (DONE BY PRETI)
//    function refreshFeedbackData()   - Refresh feedback data (DONE BY PRETI)
//
// 6. ARCHIVE DATA MANAGEMENT (ARCHIVED) (DONE BY PRETI)
//    async function loadArchiveData() - Load ALL archive data (archived) (DONE BY PRETI)
//    function filterArchiveData()     - Filter archive data (DONE BY PRETI)
//    function updateArchiveCounts()   - Update archive count displays (DONE BY PRETI)
//    function renderArchivePage()     - Render current page of archive (25 records) (DONE BY PRETI)
//    function updateArchivePaginationControls() - Update archive pagination controls (DONE BY PRETI)
//    function prevArchivePage()       - Navigate to previous archive page (DONE BY PRETI)
//    function nextArchivePage()       - Navigate to next archive page (DONE BY PRETI)
//    function refreshArchiveData()    - Refresh archive data (DONE BY PRETI)
//
// 7. FILTER CONTROLS (BOTH TABS) (DONE BY PRETI)
//    function toggleFeedbackAdvancedFilters() - Toggle feedback advanced filters panel (DONE BY PRETI)
//    function toggleArchiveAdvancedFilters() - Toggle archive advanced filters panel (DONE BY PRETI)
//    function setFeedbackDateRangePreset() - Set feedback date range preset (DONE BY PRETI)
//    function setArchiveDateRangePreset() - Set archive date range preset (DONE BY PRETI)
//    function clearAllFeedbackFilters() - Clear all feedback filters (DONE BY PRETI)
//    function clearAllArchiveFilters() - Clear all archive filters (DONE BY PRETI)
//
// 8. ENCRYPTION MANAGEMENT (PAGE-SPECIFIC) (DONE BY PRETI)
//    function updateEncryptionButtons() - Update feedback encryption buttons (DONE BY PRETI)
//    function updateArchiveEncryptionButtons() - Update archive encryption buttons (DONE BY PRETI)
//    async function decryptAllEmails() - Decrypt emails on current feedback page (DONE BY PRETI)
//    async function decryptAllArchiveEmails() - Decrypt emails on current archive page (DONE BY PRETI)
//    function reEncryptAllEmails()    - Re-encrypt feedback emails (DONE BY PRETI)
//    function reEncryptAllArchiveEmails() - Re-encrypt archive emails (DONE BY PRETI)
//
// 9. PLEDGE & CONTENT VIEWING (DONE BY PRETI)
//    function viewPledge()            - Display pledge content in popup (DONE BY PRETI)
//    function closePledgePopup()      - Close pledge popup (DONE BY PRETI)
//    async function viewQuestionAnswers() - Load and display question answers (DONE BY PRETI)
//    function createQuestionAnswersPopup() - Create Q&A popup interface (DONE BY PRETI)
//    function formatAnswer()          - Format answer based on question type (DONE BY PRETI)
//    function closeQAPopup()          - Close Q&A popup (DONE BY PRETI)
//
// 10. PHOTO MANAGEMENT (DONE BY PRETI)
//     async function viewRawPhoto()   - View raw photo without password (DONE BY PRETI)
//     async function viewProcessedPhoto() - View processed photo without password (DONE BY PRETI)
//     function showRawPhotoPopup()    - Show raw photo popup (DONE BY PRETI)
//     function showProcessedPhotoPopup() - Show processed photo popup (DONE BY PRETI)
//     function createPhotoPopup()     - Create photo viewing popup (DONE BY PRETI)
//     function handlePhotoError()     - Handle photo loading errors (DONE BY PRETI)
//     function downloadPhoto()        - Download photo file (DONE BY PRETI)
//     function closePhotoPopup()      - Close photo popup (DONE BY PRETI)
//
// 11. EMAIL MANAGEMENT (DONE BY PRETI)
//     function showPasswordPrompt()   - Custom password prompt with hidden input (DONE BY PRETI)
//     function showEmailPopup()       - Display decrypted email in popup (DONE BY PRETI)
//     function closeEmailModal()      - Close email modal (DONE BY PRETI)
//     function closeEmailPopup()      - Close email display popup (DONE BY PRETI)
//
// 12. OVERLAY MANAGEMENT (DONE BY PRETI)
//     async function loadOverlayData() - Load overlay themes from API (DONE BY PRETI)
//     function showOverlayMessage()   - Display overlay status message (DONE BY PRETI)
//     function createOverlaysTable()  - Placeholder for creating overlays table (DONE BY PRETI)
//     function updateOverlayTable()   - Update overlay grid display (DONE BY PRETI)
//     function viewOverlay()          - View overlay image in popup (DONE BY PRETI)
//     function closeOverlayPreview()  - Close overlay preview (DONE BY PRETI)
//     function handleOverlayImageError() - Handle overlay image loading errors (DONE BY PRETI)
//     function downloadOverlay()      - Download overlay image (DONE BY PRETI)
//     function showAddOverlayModal()  - Show add overlay modal (System Admin only) (DONE BY PRETI)
//     function closeAddOverlayModal() - Close add overlay modal (DONE BY PRETI)
//     async function handleAddOverlay() - Handle overlay creation with file upload (DONE BY PRETI)
//     async function deleteOverlay()  - Request overlay deletion (System Admin only) (DONE BY PRETI)
//     async function performOverlayDeletion() - Execute overlay deletion (DONE BY PRETI)
// 
// 13. USER MANAGEMENT (DONE BY PRETI)
//     let currentUserTab              - Track current tab ('active' or 'deleted') (DONE BY PRETI)
//     function switchUserTab()        - Switch between Active/Deleted users tabs (DONE BY PRETI)
//     async function loadUserManagementData() - Load users based on current tab (DONE BY PRETI)
//     async function loadActiveUsers() - Load active admin users (DONE BY PRETI)
//     async function loadDeletedUsers() - Load deleted admin users (DONE BY PRETI)
//     function updateActiveUsersTable() - Update active users table (DONE BY PRETI)
//     function updateDeletedUsersTable() - Update deleted users table (DONE BY PRETI)
//     function updateUserManagementTable() - Legacy wrapper for backward compatibility (DONE BY PRETI)
//     function addUser()              - Open add user modal (System Admin only) (DONE BY PRETI)
//     async function handleAddUser()  - Submit new user creation (DONE BY PRETI)
//     function closeAddUserModal()    - Close add user modal (DONE BY PRETI)
//     function editUser()             - Edit user details (System Admin only) (DONE BY PRETI)
//     async function handleEditUser() - Submit user edit changes (DONE BY PRETI)
//     function closeEditUserModal()   - Close edit user modal (DONE BY PRETI)
//     async function deleteUser()     - Request user deletion (System Admin only) (DONE BY PRETI)
//     async function performUserDeletion() - Execute user soft deletion (DONE BY PRETI)
//     async function restoreUser()    - Recover a deleted user (DONE BY PRETI)
//     async function permanentDeleteUser() - Permanently delete user (DONE BY PRETI)
//
// 14. QUESTION MANAGEMENT (DONE BY PRETI)
//     async function loadQuestionManagementData() - Load all questions from API (DONE BY PRETI)
//     function updateQuestionManagementTable() - Render question table with data (DONE BY PRETI)
//     function formatQuestionType()   - Format question type for display (DONE BY PRETI)
//     function showAddQuestionModal() - Show add question modal (DONE BY PRETI)
//     function closeAddQuestionModal() - Close add question modal (DONE BY PRETI)
//     function toggleOptionsField()   - Toggle options field visibility (DONE BY PRETI)
//     function addOptionField()       - Add option input field for multichoice/dropdown (DONE BY PRETI)
//     function removeOptionField()    - Remove option input field (DONE BY PRETI)
//     async function handleAddQuestion() - Submit new question creation (DONE BY PRETI)
//     function editQuestionById()     - Edit question by ID (DONE BY PRETI)
//     function editQuestion()         - Show edit question modal (DONE BY PRETI)
//     async function handleEditQuestion() - Submit question edit changes (DONE BY PRETI)
//     function closeEditQuestionModal() - Close edit question modal (DONE BY PRETI)
//     async function deleteQuestion() - Request question deletion (DONE BY PRETI)
//
// 15. DATA EXPORT MANAGEMENT (DONE BY PRETI)
//     function initDataExportPage()   - Initialize data export page (DONE BY PRETI)
//     async function unlockDataExport() - Verify admin password and unlock data export session (DONE BY PRETI)
//     function updateExportSessionInfo() - Update export session info display (DONE BY PRETI)
//     async function downloadExport() - Execute file download (DONE BY PRETI)
//
// 16. FEEDBACK DELETION (DONE BY PRETI)
//     async function deleteFeedback() - Delete feedback item (DONE BY PRETI)
//     async function deleteArchiveFeedback() - Delete archive feedback item (DONE BY PRETI)
//     function showDeletePasswordModal() - Show password verification modal (DONE BY PRETI)
//     async function verifyDeleteAccess() - Verify delete access with password (DONE BY PRETI)
//     async function performFeedbackDeletion() - Execute feedback deletion (DONE BY PRETI)
//     function closeDeleteModal()     - Close delete modal (DONE BY PRETI)
//
// 17. NAVIGATION & PAGE MANAGEMENT (DONE BY PRETI)
//     function showPage()             - Show selected page and hide others (DONE BY PRETI)
//     function initializeArchivePage() - Initialize archive page (DONE BY PRETI)
//
// 18. DIGITAL TREE MANAGEMENT (DONE BY PRETI)
//     async function loadDigitalTreeData() - Load digital tree data from API (DONE BY PRETI)
//     function updateDigitalTreeTable() - Update digital tree table display (DONE BY PRETI)
//     function refreshTreeData()      - Refresh tree data (DONE BY PRETI)
//     function escapeHtml()           - Escape HTML for safe display (DONE BY PRETI)
//     function saveTreeParameters()     - Save tree parameters (stage and background) (DONE BY Yu Kang)
//
// 19. UTILITY FUNCTIONS (DONE BY PRETI)
//     const style                     - Style element for dynamic CSS (DONE BY PRETI)
//
// 20. THEME SETTINGS - HELPER FUNCTIONS (DONE BY PRETI)
//     function expandSelectorPatterns() - Expand CSS selector patterns (DONE BY PRETI)
//     function expandPattern()        - Expand individual selector pattern (DONE BY PRETI)
//     function validateSelectors()    - Validate CSS selectors exist (DONE BY PRETI)
//     function suggestCorrection()    - Suggest selector correction (DONE BY PRETI)
//     function levenshteinDistance()  - Calculate string similarity (DONE BY PRETI)
//
// 21. THEME CONFIGURATION (DONE BY PRETI)
//     const themeConfig               - Theme configuration object (DONE BY PRETI)
//     function getColorOptionsForSection() - Get color options for section (DONE BY PRETI)
//     function getSelectorsForOption() - Get selectors for color option (DONE BY PRETI)
//
// 22. THEME MANAGEMENT FUNCTIONS (DONE BY PRETI)
//     let themeSettings               - Store theme settings (DONE BY PRETI)
//     let currentSection              - Track current theme section (DONE BY PRETI)
//     function initThemeSettings()    - Initialize theme settings (DONE BY PRETI)
//     function loadThemeSettings()    - Load theme settings from localStorage (DONE BY PRETI)
//     function migrateOldColors()     - Migrate old color scheme (DONE BY PRETI)
//     function getCustomDefaultColors() - Get custom default colors (DONE BY PRETI)
//     function getDefaultThemeSettings() - Get default theme settings (DONE BY PRETI)
//     function saveIndividualPageSettings() - Save individual page settings (DONE BY PRETI)
//     function loadIndividualPageSettings() - Load individual page settings (DONE BY PRETI)
//     function saveThemeSettings()    - Save theme settings to localStorage (DONE BY PRETI)
//     function showSaveMessage()      - Show save confirmation message (DONE BY PRETI)
//     function renderSectionList()    - Render theme section list (DONE BY PRETI))
//     function selectSection()        - Select theme section (DONE BY PRETI)
//     function updateSectionTitle()   - Update section title display ( DONE BY PRETI)
//     function renderThemeControls()  - Render theme control UI (DONE BY PRETI)
//     function createColorGroup()     - Create color control group (DONE BY PRETI)
//     function createColorControl()   - Create individual color control (DONE BY PRETI)
//     function updateColor()          - Update color value (DONE BY PRETI)
//     function updateColorFromHex()   - Update color from hex input (DONE BY PRETI)
//     function toggleGlobalThemeOverride() - Toggle global theme override (DONE BY PRETI)
//     function resetSectionToGlobal() - Reset section to global theme (DONE BY PRETI)
//     async function resetAllToDefaults() - Reset all settings to defaults (DONE BY PRETI)
//     function updatePreview()        - Update theme preview ((DONE BY PRETI)
//     function applyThemeSettings()   - Apply theme settings to DOM (DONE BY PRETI)
//
// 23. SAVED THEMES MANAGEMENT (DONE BY PRETI)
//     let savedThemesCache            - Cache of user's saved themes (DONE BY PRETI)
//     let currentThemeData            - Store current theme data for saving (DONE BY PRETI)
//     async function loadSavedThemes() - Load user's saved themes (DONE BY PRETI)
//     function updateSavedThemesUI()  - Update saved themes UI (DONE BY PRETI)
//     function createSavedThemeCard() - Create saved theme card element (DONE BY PRETI)
//     function extractPreviewColors() - Extract preview colors from theme (DONE BY PRETI)
//     function captureCurrentThemeData() - Capture current theme data (DONE BY PRETI)
//     async function saveCurrentTheme() - Save current theme (DONE BY PRETI)
//     function clearSaveThemeForm()   - Clear save theme form (DONE BY PRETI)
//     function applyThemeData()       - Apply theme data to settings (DONE BY PRETI)
//     async function activateSavedTheme() - Activate saved theme (DONE BY PRETI)
//     async function renameSavedTheme() - Rename saved theme (DONE BY PRETI)
//     function createRenameModal()    - Create rename modal (DONE BY PRETI)
//     async function performRename()  - Perform theme rename (DONE BY PRETI)
//     function closeRenameModal()     - Close rename modal (DONE BY PRETI)
//     async function deleteSavedTheme() - Delete saved theme (DONE BY PRETI)
//     async function refreshSavedThemes() - Refresh saved themes list (DONE BY PRETI)
//     async function loadActiveThemeOnLogin() - Load active theme on login (DONE BY PRETI)
//     function applyDefaultTheme()    - Apply default theme (DONE BY PRETI)
//     function initSavedThemesSection() - Initialize saved themes section (DONE BY PRETI)
//     function showConfirmDialog()    - Show confirmation dialog (DONE BY PRETI)
//
// 24. ARCHIVE DELETION FUNCTIONS (System Admin Only) (DONE BY PRETI)
//     function initializeDeletionControls() - Initialize deletion controls (DONE BY PRETI)
//     function toggleSelectAllArchive() - Toggle select all checkboxes (DONE BY PRETI)
//     function updateArchiveSelectionCount() - Update selection count display (DONE BY PRETI)
//     function setQuickDeleteDate()   - Set quick delete date (DONE BY PRETI)
//     async function previewBulkDelete() - Preview bulk delete operation (DONE BY PRETI)
//     async function deleteSelectedArchive() - Delete selected archive items (DONE BY PRETI)
//     async function bulkDeleteByDate() - Bulk delete by date (DONE BY PRETI)
//     function showDeletionConfirmationModal() - Show deletion confirmation modal (DONE BY PRETI)
//     function refreshArchiveData()   - Refresh archive data (DONE BY PRETI)
//
// 25. INITIALIZATION & EVENT HANDLERS
//     (Window onload and initialization code)
//
// 26. PLEDGEBOARD MANAGEMENT (DONE BY PRETI)
//     async function loadAdminPledgeboard() - Load pledgeboard data (DONE BY PRETI)
//     function filterPledgeboardData() - Filter pledgeboard data (DONE BY PRETI)
//     function clearPledgeboardSearch() - Clear pledgeboard search (DONE BY PRETI)
//     function renderPledgeboardPage() - Render pledgeboard page (DONE BY PRETI)
//     function updatePledgeboardPaginationControls() - Update pledgeboard pagination (DONE BY PRETI)
//     function prevPledgeboardPage()  - Navigate to previous pledgeboard page (DONE BY PRETI)
//     function nextPledgeboardPage()  - Navigate to next pledgeboard page (DONE BY PRETI)
//
// 27. FORM MANAGEMENT (DONE BY NADH)
//     function setFormStatus()        - Set form status message 
//     async function loadFormUISettings() - Load form UI settings 
//     async function saveFormUISettings() - Save form UI settings 
//
// 28. EMAIL MANAGEMENT (DONE BY NADH)
//     function setEmailStatus()       - Set email status message 
//     function renderEmailFields()    - Render email configuration fields 
//     async function loadEmailConfig() - Load email configuration 
//     async function saveEmailConfig() - Save email configuration 
//     async function sendTestEmail()  - Send test email 
//
// 29. TIMER COUNTDOWN MANAGEMENT (DONE BY BERNISSA)
//     const TIMER_API_URL             - Timer API endpoint 
//     function getTimerCountdownEls() - Get timer countdown UI elements 
//     async function loadTimerCountdownSetting() - Load timer countdown setting 
//     async function saveTimerCountdownSetting() - Save timer countdown setting 
//     function validateTimerCountdown() - Validate timer countdown input 
//
// 30. SERVER SCHEDULE MANAGEMENT (DONE BY BERNISSA)
//     let schedulesData               - Store schedules data 
//     let currentScheduleId           - Track current schedule ID 
//     function loadSchedules()        - Load server schedules 
//     function renderSchedulesTable() - Render schedules table 
//     function showAddScheduleModal() - Show add schedule modal 
//     function editSchedule()         - Edit schedule 
//     function validateTimes()        - Validate schedule times 
//     function saveSchedule()         - Save schedule 
//     function deleteSchedule()       - Delete schedule 
//     function toggleScheduleStatus() - Toggle schedule active status 
//     function enableAllSchedules()   - Enable all schedules 
//     function disableAllSchedules()  - Disable all schedules 
//     async function loadServerMode() - Load server control mode 
//     async function toggleServerMode() - Toggle server control mode 
//     function updateModeUI()         - Update mode UI display 
//     async function checkServerStatus() - Check server status 
//     function startServer()          - Start kiosk server 
//     function stopServer()           - Stop kiosk server 
//     function getScheduleTypeBadge() - Get schedule type badge HTML 
//     function formatDaysDisplay()    - Format days display string 
//     function updateFormFields()     - Update form fields 
//     function showNotification()     - Show notification message (duplicate) 
//     function showLoading()          - Show loading indicator 
//     function hideLoading()          - Hide loading indicator 
//     function closeModal()           - Close modal by ID 
//
// 31. VIP MANAGEMENT (DONE BY ZAH)
//     let vipData                     - Array storing VIP names 
//     const VIP_API_BASE              - VIP API base URL 
//     const VIP_API                   - API endpoint helpers for VIP operations 
//     function getVipElements()       - Get VIP UI elements 
//     function escapeHtmlSafe()       - Escape HTML for safe rendering 
//     function formatVipDate()        - Format VIP date for display 
//     async function fetchVipJson()   - Fetch helper for VIP API calls 
//     function renderVipList()        - Render VIP list UI 
//     async function loadVipData()    - Load VIPs from API 
//     function loadVipManagementData() - Loader used by showPage('vip') 
//     async function addVip()         - Add VIP name 
//
// 32. KIOSK AUTO-RELOAD ON START/STOP (DONE BY BERNISSA)
//     let lastKioskActive             - Track last kiosk active state 
//     async function watchKioskService() - Watch kiosk service and reload on state change 

// ==================== SESSION TIMEOUT & AUTO-LOGOUT ENHANCEMENT ====================
// This code adds automatic logout when session expires

// Session timeout configuration
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes (matches server session)
const WARNING_BEFORE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes warning before timeout
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000; // Check activity every minute

let lastActivityTime = Date.now();
let sessionWarningShown = false;
let activityCheckInterval = null;
let sessionTimeoutModal = null;

// ==================== ACTIVITY TRACKING ====================

/**
 * Reset activity timer on user interaction
 */
function resetActivityTimer() {
    lastActivityTime = Date.now();
    sessionWarningShown = false;
    
    // Close warning modal if it's showing
    if (sessionTimeoutModal) {
        closeSessionWarningModal();
    }
}

/**
 * Track user activity events
 */
function initActivityTracking() {
    // Track various user interactions
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
        document.addEventListener(event, resetActivityTimer, { passive: true });
    });
    
    console.log('✅ Activity tracking initialized');
}

/**
 * Check session timeout and show warning
 */
function checkSessionTimeout() {
    // Only check if user is logged in
    const loggedUser = sessionStorage.getItem('loggedUser');
    if (!loggedUser) {
        return;
    }
    
    const timeSinceLastActivity = Date.now() - lastActivityTime;
    const timeUntilTimeout = SESSION_TIMEOUT_MS - timeSinceLastActivity;
    
    // Show warning if approaching timeout
    if (timeUntilTimeout <= WARNING_BEFORE_TIMEOUT_MS && timeUntilTimeout > 0 && !sessionWarningShown) {
        showSessionWarningModal(timeUntilTimeout);
        sessionWarningShown = true;
    }
    
    // Auto-logout if timed out
    if (timeUntilTimeout <= 0) {
        handleSessionTimeout();
    }
}

/**
 * Start session timeout monitoring
 */
function startSessionMonitoring() {
    // Reset timer
    lastActivityTime = Date.now();
    sessionWarningShown = false;
    
    // Clear existing interval if any
    if (activityCheckInterval) {
        clearInterval(activityCheckInterval);
    }
    
    // Start checking session timeout
    activityCheckInterval = setInterval(checkSessionTimeout, ACTIVITY_CHECK_INTERVAL_MS);
    
    console.log('✅ Session monitoring started');
}

/**
 * Stop session timeout monitoring
 */
function stopSessionMonitoring() {
    if (activityCheckInterval) {
        clearInterval(activityCheckInterval);
        activityCheckInterval = null;
    }
    
    console.log('🛑 Session monitoring stopped');
}

// ==================== SESSION TIMEOUT WARNING MODAL ====================

/**
 * Show session timeout warning modal
 */
function showSessionWarningModal(timeRemaining) {
    const minutesRemaining = Math.ceil(timeRemaining / 60000);
    
    // Create modal if it doesn't exist
    if (!sessionTimeoutModal) {
        sessionTimeoutModal = document.createElement('div');
        sessionTimeoutModal.id = 'session-timeout-modal';
        sessionTimeoutModal.innerHTML = `
            <div class="modal-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            ">
                <div class="modal-content" style="
                    background: white;
                    padding: 30px;
                    border-radius: 8px;
                    max-width: 400px;
                    text-align: center;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                ">
                    <div style="font-size: 48px; margin-bottom: 20px;">⏰</div>
                    <h2 style="margin: 0 0 15px 0; color: #333;">Session Timeout Warning</h2>
                    <p style="color: #666; margin-bottom: 25px;">
                        Your session will expire in <strong id="timeout-countdown">${minutesRemaining}</strong> minute(s) due to inactivity.
                    </p>
                    <p style="color: #666; margin-bottom: 25px; font-size: 14px;">
                        Click "Stay Logged In" to continue your session, or you will be automatically logged out.
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="session-stay-btn" style="
                            background: #10b981;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 16px;
                        ">Stay Logged In</button>
                        <button id="session-logout-btn" style="
                            background: #ef4444;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 16px;
                        ">Logout Now</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(sessionTimeoutModal);
        
        // Add event listeners
        document.getElementById('session-stay-btn').addEventListener('click', () => {
            resetActivityTimer();
            // Make a keep-alive request to refresh server session
            fetch('/api/admin/keep-alive', { method: 'POST' }).catch(() => {});
            closeSessionWarningModal();
        });
        
        document.getElementById('session-logout-btn').addEventListener('click', () => {
            handleLogout();
        });
        
        // Start countdown update
        updateCountdown(timeRemaining);
    } else {
        sessionTimeoutModal.style.display = 'block';
        updateCountdown(timeRemaining);
    }
}

/**
 * Update countdown timer in warning modal
 */
function updateCountdown(timeRemaining) {
    const countdownElement = document.getElementById('timeout-countdown');
    if (countdownElement) {
        const minutesRemaining = Math.ceil(timeRemaining / 60000);
        countdownElement.textContent = minutesRemaining;
    }
}

/**
 * Close session timeout warning modal
 */
function closeSessionWarningModal() {
    if (sessionTimeoutModal) {
        sessionTimeoutModal.style.display = 'none';
    }
}

/**
 * Handle session timeout - auto logout
 */
function handleSessionTimeout() {
    console.log('⏰ Session timeout - auto logout');
    
    // Clear session monitoring
    stopSessionMonitoring();
    
    // Show timeout message
    alert('⏰ Your session has expired due to inactivity. You will be logged out.');
    
    // Perform logout
    handleLogout();
}

// ==================== GLOBAL FETCH INTERCEPTOR FOR 401 DETECTION ====================

/**
 * Wrap the original fetch to detect 401 errors and auto-logout
 */
const originalFetch = window.fetch;
window.fetch = function(...args) {
    return originalFetch.apply(this, args)
        .then(response => {
            // Check if response is 401 Unauthorized
            if (response.status === 401) {
                const loggedUser = sessionStorage.getItem('loggedUser');
                
                // Only auto-logout if we think we're logged in
                if (loggedUser) {
                    console.log('🔒 401 Unauthorized detected - session expired');
                    
                    // Show message
                    setTimeout(() => {
                        alert('🔒 Your session has expired. Please log in again.');
                        handleLogout();
                    }, 100);
                }
            }
            
            // Reset activity timer on successful API calls
            if (response.ok && sessionStorage.getItem('loggedUser')) {
                resetActivityTimer();
            }
            
            return response;
        })
        .catch(error => {
            // Re-throw the error for normal error handling
            throw error;
        });
};

// ==================== ENHANCED LOGIN/LOGOUT FUNCTIONS ====================

/**
 * Enhanced handleLogin - start session monitoring after successful login
 * This wraps around the existing handleLogin function
 */
const originalHandleLogin = window.handleLogin;
if (originalHandleLogin) {
    window.handleLogin = async function(event) {
        const result = await originalHandleLogin.call(this, event);
        
        // If login was successful, start session monitoring
        if (sessionStorage.getItem('loggedUser')) {
            initActivityTracking();
            startSessionMonitoring();
        }
        
        return result;
    };
} else {
    console.warn('⚠️ Original handleLogin not found - session monitoring may not start automatically');
}

/**
 * Enhanced handleLogout - stop session monitoring on logout
 * This wraps around the existing handleLogout function
 */
const originalHandleLogout = window.handleLogout;
if (originalHandleLogout) {
    window.handleLogout = function() {
        stopSessionMonitoring();
        closeSessionWarningModal();
        originalHandleLogout.call(this);
    };
} else {
    console.warn('⚠️ Original handleLogout not found');
}

// ==================== SESSION TIMEOUT INITIALIZATION ====================

/**
 * Initialize session timeout on page load if user is already logged in
 */
window.addEventListener('DOMContentLoaded', () => {
    const loggedUser = sessionStorage.getItem('loggedUser');
    if (loggedUser) {
        console.log('🔐 User already logged in, starting session monitoring...');
        initActivityTracking();
        startSessionMonitoring();
    }
});

console.log('✅ Session timeout & auto-logout enhancement loaded');

// ==================== 1. GLOBAL VARIABLES & STATE MANAGEMENT ====================

// Download modals
let currentDownloadType = null;

// Feedback deletion tracking
let currentDeleteFeedbackId = null;

// Email viewing
let currentEmailViewingId = null;

// Audit logs pagination and filtering
let currentAuditPage = 1;
let auditLogsPerPage = 50;
let currentSortField = 'created_at';
let currentSortDirection = 'desc';
let allAuditLogs = [];
let filteredAuditLogs = [];

// Lost and found reports - changes made by nick
let allLostFoundReports = [];
let filteredLostFoundReports = [];
let nickUsageAnalytics = null; // Nick feature usage analytics cache (DONE BY NICK)

// Global variables for feedback (not_archived)
let allFeedbackData = []; // ALL not_archived records
let filteredFeedbackData = []; // Filtered results
let feedbackCurrentPage = 1;
const feedbackItemsPerPage = 25;

// Global variables for archive (archived)
let allArchiveData = []; // ALL archived records
let filteredArchiveData = []; // Filtered results
let archiveCurrentPage = 1;
const archiveItemsPerPage = 25;

// Decryption state (per-page only)

// Global variables for pledgeboard
let allPledgeboardData = []; // ALL pledgeboard records
let filteredPledgeboardData = []; // Filtered results
let pledgeboardCurrentPage = 1;
const pledgeboardItemsPerPage = 25;
let decryptedEmailMap = {}; // {feedbackId: decryptedEmail}
let isAnyEmailDecrypted = false;
let encryptedFeedbackIds = [];

// Archive decryption state (separate)
let decryptedArchiveEmailMap = {};
let isAnyArchiveEmailDecrypted = false;
let encryptedArchiveIds = [];

// Data export session
let dataExportUnlocked = false;
let dataExportUnlockTime = null;


// Question management - store question data to avoid JSON.stringify issues in onclick
window.questionsDataMap = new Map();


// ==================== 2. AUTHENTICATION & SESSION MANAGEMENT ====================

// Handle login
async function handleLogin(event) {
    console.log('Login function called');
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    console.log('Username:', username, 'Password:', password ? '***' : 'empty');
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }
    
    try {
        console.log('Attempting API login...');
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success) {
            console.log('✅ Login successful');
            // Store logged in user
            sessionStorage.setItem('loggedUser', data.user.username);
            sessionStorage.setItem('userRole', data.user.role);
            await loadActiveThemeOnLogin();

            // Load active theme on login
            setTimeout(() => {
                loadActiveThemeOnLogin();
            }, 500);
            
            // Update UI and apply role-based access
            updateUIForUser(data.user.username, data.user.role);
            
            // Load dashboard data
            await loadDashboardData();
            
            // Show dashboard
            document.getElementById('login-page').style.display = 'none';
            document.getElementById('admin-dashboard').style.display = 'block';
        } else {
            console.log('❌ Login failed:', data.error);
            alert(data.error || 'Invalid username or password');
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        alert('Login failed. Please check your connection and try again.');
    }
}

// Handle logout
function handleLogout() {
    const username = sessionStorage.getItem('loggedUser');
    
    // Log the logout
    fetch('/api/admin/logout-audit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username: username })
    }).catch(() => {});
    
    sessionStorage.clear();
    
    // Reload page to ensure clean state for next login
    window.location.reload();
}

// Update UI for user role
function updateUIForUser(username, role) {
    // Update user info in header
    document.getElementById('logged-username').textContent = username;
    document.getElementById('logged-role').textContent = formatRoleName(role);
    document.querySelector('.user-avatar').textContent = username[0].toUpperCase();
    
    // MAIN section: Always visible for ALL roles
    // Contains: Dashboard, Feedback Data, Digital Tree, Pledgeboard, Style & Theme Settings
    const mainSection = document.getElementById('main-section');
    if (mainSection) {
        mainSection.style.display = 'block';
    }
    
    // ADMINISTRATION section: ONLY visible for system_admin
    // Contains: Overlay Management, Question Management, User Management, Archive, Audit Logs, Data Export
    const adminSection = document.getElementById('admin-section');
    if (role === 'system_admin') {
        if (adminSection) adminSection.style.display = 'block';
    } else {
        // Hide for IT_staff and IT_admin
        if (adminSection) adminSection.style.display = 'none';
    }
    
    // Show/hide ONLY decrypt/download buttons based on role
    // Filter buttons should be visible for ALL roles
    const decryptButtons = document.querySelectorAll('#decrypt-emails-btn, #decrypt-archive-all-btn, #re-encrypt-btn, #re-encrypt-archive-all-btn');
    if (role === 'system_admin') {
        decryptButtons.forEach(btn => btn.style.display = 'inline-block');
    } else {
        decryptButtons.forEach(btn => btn.style.display = 'none');
    }
    
    // If current page is an admin page and user is not system admin, redirect to dashboard
    const currentPage = document.querySelector('.page.active');
    if (currentPage && !currentPage.id.includes('dashboard') && role !== 'system_admin') {
        showPage('dashboard');
    }
}

// Format role name for display
