// Owner: Role 3, Jun Kai. Previous team: Bernissa (2), Caeden (1).
// Part 28/30 of the admin page: server schedules and server control (load order in admin.html).
// ==================== 30. SERVER SCHEDULE MANAGEMENT (DONE BY BERNISSA) ====================

// Global variables for schedule management
let schedulesData = [];
let currentScheduleId = null;

// Initialize schedule management when page loads
function startServerStatusPolling() {
    if (window.statusCheckInterval) clearInterval(window.statusCheckInterval);
    window.statusCheckInterval = setInterval(checkServerStatus, 10000);
    if (window.automationStatusInterval) clearInterval(window.automationStatusInterval);
    window.automationStatusInterval = setInterval(loadAutomationStatus, 60000);
}

document.addEventListener('DOMContentLoaded', function() {
    // Only when a session was restored; a fresh login goes through showPage('server-schedule')
    if (document.getElementById('server-schedule-page') && sessionStorage.getItem('loggedUser')) {
        loadSchedules();
        loadServerMode();
        checkServerStatus();
        startServerStatusPolling();
    }
});

// Schedule loading function

function loadSchedules() {
    console.log('📊 Loading server schedules...');
    
    showLoading('#schedules-table-body', 'Loading schedules...');
    
    fetch('/api/admin/server-schedules', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            schedulesData = data.schedules;
            renderSchedulesTable(data.schedules);
            loadAutomationStatus();
        } else {
            showError('#schedules-table-body', 'Failed to load schedules');
        }
    })
    .catch(error => {
        console.error('❌ Error loading schedules:', error);
        showError('#schedules-table-body', 'Error loading schedules');
    });
}

function renderSchedulesTable(schedules) {
    const tbody = document.getElementById('schedules-table-body');
    
    if (!schedules || schedules.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">
                    No schedules found. Click "Add Schedule" to create one.
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    schedules.forEach(schedule => {
        const typeBadge = getScheduleTypeBadge(schedule.schedule_type);
        const statusBadge = schedule.is_active ? 
            '<span class="status-badge active">Active</span>' : 
            '<span class="status-badge inactive">Inactive</span>';
        
        // Pass specific_date to formatDaysDisplay
        const daysDisplay = formatDaysDisplay(schedule.days_of_week, schedule.schedule_type, schedule.specific_date);
        const startTime = schedule.start_time || '-';
        const endTime = schedule.end_time || '-';
        
        html += `
            <tr data-schedule-id="${schedule.id}">
                <td><strong>${schedule.schedule_name}</strong></td>
                <td>${typeBadge}</td>
                <td>${daysDisplay}</td>
                <td><span class="time-badge">${startTime}</span></td>
                <td><span class="time-badge">${endTime}</span></td>
                <td>${statusBadge}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="toggleScheduleStatus(${schedule.id}, ${!schedule.is_active})" 
                                title="${schedule.is_active ? 'Disable' : 'Enable'}">
                            ${schedule.is_active ? '⏸️' : '▶️'}
                        </button>
                        <button class="btn-edit" onclick="editSchedule(${schedule.id})" title="Edit">
                            ✏️
                        </button>
                        <button class="btn-delete" onclick="deleteSchedule(${schedule.id})" title="Delete">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Schedule CRUD operations

function showAddScheduleModal() {
    currentScheduleId = null;
    
    // Reset form
    const form = document.getElementById('schedule-form');
    if (form) {
        form.reset();
        // Clear specific date
        document.getElementById('specific-date').value = '';
        // Clear all day checkboxes
        for (let i = 1; i <= 7; i++) {
            const checkbox = document.getElementById(`day-${i}`);
            if (checkbox) checkbox.checked = false;
        }
        // Set default values
        document.getElementById('schedule-type').value = 'daily';
        document.getElementById('is-active').checked = true;
        updateFormFields(); // Update based on schedule type
    }
    
    // Show modal
    const modal = document.getElementById('schedule-modal');
    if (modal) {
        modal.style.display = 'block';
        modal.querySelector('.modal-title').textContent = 'Add New Schedule';
        modal.querySelector('.modal-submit-btn').textContent = 'Create Schedule';
    }
}

function editSchedule(scheduleId) {
    const schedule = schedulesData.find(s => s.id == scheduleId);
    if (!schedule) return;
    
    currentScheduleId = scheduleId;
    
    // Fill form with schedule data
    document.getElementById('schedule-name').value = schedule.schedule_name;
    document.getElementById('schedule-type').value = schedule.schedule_type;
    document.getElementById('start-time').value = schedule.start_time;
    document.getElementById('end-time').value = schedule.end_time || '';
    document.getElementById('is-active').checked = schedule.is_active == 1;
    
    // Clear specific date first
    document.getElementById('specific-date').value = '';
    
    // Set specific date if available
    if (schedule.specific_date) {
        // Format date to YYYY-MM-DD
        const date = new Date(schedule.specific_date);
        if (!isNaN(date.getTime())) {
            document.getElementById('specific-date').value = date.toISOString().split('T')[0];
        }
    }
    
    // Clear all day checkboxes first
    for (let i = 1; i <= 7; i++) {
        const checkbox = document.getElementById(`day-${i}`);
        if (checkbox) checkbox.checked = false;
    }
    
    // Set days checkboxes for weekly schedule
    if (schedule.schedule_type === 'weekly' && schedule.days_of_week) {
        const days = schedule.days_of_week.split(',').map(d => d.trim());
        days.forEach(day => {
            const checkbox = document.getElementById(`day-${day}`);
            if (checkbox) checkbox.checked = true;
        });
    }
    
    // Update form fields based on type
    updateFormFields();
    
    // Show modal
    const modal = document.getElementById('schedule-modal');
    if (modal) {
        modal.style.display = 'block';
        modal.querySelector('.modal-title').textContent = 'Edit Schedule';
        modal.querySelector('.modal-submit-btn').textContent = 'Update Schedule';
    }
}

// function to validate times
function validateTimes() {
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    
    if (startTime && endTime) {
        if (startTime === endTime) {
            showNotification('Start and stop time cannot be the same. A stop time earlier than the start means the next day.', 'error');
            return false;
        }
    }
    return true;
}

function saveSchedule() {
    const form = document.getElementById('schedule-form');
    if (!form) return;
    
    // Validate times first
    if (!validateTimes()) {
        return;
    }
    
    // Validate form
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Collect form data
    const formData = {
        schedule_name: document.getElementById('schedule-name').value,
        schedule_type: document.getElementById('schedule-type').value,
        start_time: document.getElementById('start-time').value,
        end_time: document.getElementById('end-time').value,
        is_active: document.getElementById('is-active').checked
    };
    
    // Collect days of week for weekly schedule
    if (formData.schedule_type === 'weekly') {
        const selectedDays = [];
        for (let i = 1; i <= 7; i++) {
            const checkbox = document.getElementById(`day-${i}`);
            if (checkbox && checkbox.checked) {
                selectedDays.push(i);
            }
        }
        formData.days_of_week = selectedDays.join(',');
        
        // Validate that at least one day is selected
        if (selectedDays.length === 0) {
            showNotification('Please select at least one day for weekly schedule', 'error');
            return;
        }
    } else {
        formData.days_of_week = '';
    }
    
    // Handle specific date
    if (formData.schedule_type === 'specific_date') {
        const specificDate = document.getElementById('specific-date').value;
        if (!specificDate) {
            showNotification('Please select a specific date', 'error');
            return;
        }
        formData.specific_date = specificDate;
    } else {
        formData.specific_date = null;
    }
    
    // Validate that all required fields are present
    if (!formData.schedule_name || !formData.schedule_type || !formData.start_time || !formData.end_time) {
        showNotification('Schedule name, type, and times are required', 'error');
        return;
    }
    
    // Determine URL and method
    const url = currentScheduleId ? 
        `/api/admin/server-schedules/${currentScheduleId}` : 
        '/api/admin/server-schedules';
    
    const method = currentScheduleId ? 'PUT' : 'POST';
    
    // Show loading
    showLoading('body', 'Saving schedule...');
    
    // Send request
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(data.message || 'Schedule saved successfully', 'success');
            closeModal('schedule-modal');
            loadSchedules(); // Reload schedules
        } else {
            showNotification(data.error || 'Failed to save schedule', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error saving schedule:', error);
        showNotification('Error saving schedule', 'error');
    })
    .finally(() => {
        hideLoading();
    });
}

function deleteSchedule(scheduleId) {
    if (!confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
        return;
    }
    
    fetch(`/api/admin/server-schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(data.message || 'Schedule deleted successfully', 'success');
            loadSchedules(); // Reload schedules
        } else {
            showNotification(data.error || 'Failed to delete schedule', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error deleting schedule:', error);
        showNotification('Error deleting schedule', 'error');
    });
}

function toggleScheduleStatus(scheduleId, newStatus) {
    fetch(`/api/admin/server-schedules/${scheduleId}/toggle`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: newStatus })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(data.message || 'Schedule status updated', 'success');
            loadSchedules(); // Reload schedules
        } else {
            showNotification(data.error || 'Failed to update schedule status', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error toggling schedule status:', error);
        showNotification('Error updating schedule status', 'error');
    });
}

// Quick actions

function enableAllSchedules() {
    if (!confirm('Enable all schedules?')) return;
    
    fetch('/api/admin/server-schedules/enable-all', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(`All ${data.enabled_count} schedules enabled`, 'success');
            loadSchedules(); // Reload schedules
        } else {
            showNotification(data.error || 'Failed to enable schedules', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error enabling schedules:', error);
        showNotification('Error enabling schedules', 'error');
    });
}

function disableAllSchedules() {
    if (!confirm('Disable all schedules?')) return;
    
    fetch('/api/admin/server-schedules/disable-all', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(`All ${data.disabled_count} schedules disabled`, 'success');
            loadSchedules(); // Reload schedules
        } else {
            showNotification(data.error || 'Failed to disable schedules', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error disabling schedules:', error);
        showNotification('Error disabling schedules', 'error');
    });
}

// ==================== SERVER CONTROL MODE FUNCTIONS (BERNISSA) ====================

// Load current server control mode on page load
async function loadServerMode() {
    try {
        const response = await fetch('/api/admin/server/mode');
        const data = await response.json();
        
        if (data.success) {
            const isAuto = data.mode === 'auto';
            const toggle = document.getElementById('auto-mode-toggle');
            if (toggle) {
                toggle.checked = isAuto;
                updateModeUI(isAuto);
            }
            
            console.log(`✅ Loaded server mode: ${data.mode.toUpperCase()}`);
        }
        
    } catch (error) {
        console.error('❌ Error loading server mode:', error);
        showNotification('Failed to load server mode', 'error');
    }
}

// Toggle between auto and manual mode
async function toggleServerMode() {
    const toggle = document.getElementById('auto-mode-toggle');
    if (!toggle) return;
    
    const isAuto = toggle.checked;
    const newMode = isAuto ? 'auto' : 'manual';
    
    console.log(`🔄 Switching to ${newMode.toUpperCase()} mode...`);
    
    try {
        const response = await fetch('/api/admin/server/mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: newMode })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Switched to ${newMode.toUpperCase()} mode`, 'success');
            updateModeUI(isAuto);
            
            // Refresh server status
            checkServerStatus();
            loadAutomationStatus();
            
            if (!isAuto) {
                showNotification('Manual mode: Start/Stop buttons now available', 'info');
            } else {
                showNotification('Auto mode: Schedules will control the server', 'info');
            }
        } else {
            showNotification(data.error || 'Failed to change mode', 'error');
            // Revert toggle
            toggle.checked = !isAuto;
        }
        
    } catch (error) {
        console.error('❌ Error changing mode:', error);
        showNotification('Error changing mode', 'error');
        // Revert toggle
        toggle.checked = !isAuto;
    }
}

// Update UI based on current mode
function updateModeUI(isAuto) {
    const modeStatus = document.getElementById('mode-status');
    const modeDesc = document.getElementById('mode-description');
    const modeHint = document.getElementById('mode-hint');
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const stopBtn = document.getElementById('stop-btn');
    
    if (!modeStatus || !modeDesc) return;
    
    if (isAuto) {
        // AUTO MODE
        modeStatus.textContent = '🤖 AUTO MODE';
        modeStatus.className = 'mode-auto';
        modeDesc.textContent = 'Schedules control the server automatically';
        if (modeHint) {
            modeHint.textContent = '⚠️ Switch to MANUAL MODE to use Start/Stop buttons';
            modeHint.style.color = '#856404';
        }
        if (startBtn) startBtn.disabled = true;
        if (restartBtn) restartBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = true;
    } else {
        // MANUAL MODE
        modeStatus.textContent = '✋ MANUAL MODE';
        modeStatus.className = 'mode-manual';
        modeDesc.textContent = 'You control the server with Start/Stop buttons';
        if (modeHint) {
            modeHint.textContent = '💡 Manual mode active - schedules are temporarily disabled';
            modeHint.style.color = '#004085';
        }
        if (startBtn) startBtn.disabled = false;
        if (restartBtn) restartBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = false;
    }
}

// Check current kiosk service status
async function checkServerStatus() {
    if (!sessionStorage.getItem('loggedUser')) return;
    try {
        const response = await fetch('/api/admin/server/status');
        const data = await response.json();
        
        const statusIndicator = document.getElementById('server-status-indicator');
        
        if (!statusIndicator) return;
        if (data.success) updateDailyOperationButton(data.kiosk_running === true);
        
        if (data.success) {
            if (data.kiosk_running) {
                statusIndicator.innerHTML = '<span class="status-running">🟢 Kiosk Running</span>';
            } else {
                statusIndicator.innerHTML = '<span class="status-stopped">🔴 Kiosk Stopped</span>';
            }
        } else {
            statusIndicator.innerHTML = '<span class="status-error">⚠️ Status Unknown</span>';
        }
        
    } catch (error) {
        console.error('❌ Error checking status:', error);
        const statusIndicator = document.getElementById('server-status-indicator');
        if (statusIndicator) {
            statusIndicator.innerHTML = '<span class="status-error">⚠️ Cannot check status</span>';
        }
    }
}

// One-button End Day / Start Day kiosk control for admins (Done by Caeden)
function updateDailyOperationButton(isRunning) {
    const button = document.getElementById('daily-operation-toggle-btn');
    const hint = document.getElementById('daily-operation-hint');

    if (!button) return;

    button.disabled = false;
    button.dataset.running = isRunning ? 'true' : 'false';
    button.textContent = isRunning ? 'End Day: Turn Kiosk Off' : 'Start Day: Turn Kiosk On';
    button.className = isRunning ? 'btn-danger' : 'btn-primary';

    if (hint) {
        hint.textContent = isRunning
            ? 'Kiosk is running. End Day switches to manual mode, stops the kiosk server and hibernates this PC.'
            : 'Kiosk is stopped. Start Day switches to manual mode and starts the kiosk server.';
    }
}

async function setServerModeForDailyOperation() {
    const response = await fetch('/api/admin/server/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'manual' })
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to switch to manual mode');
    }

    const toggle = document.getElementById('auto-mode-toggle');
    if (toggle) toggle.checked = false;
    updateModeUI(false);
}

async function toggleDailyOperation() {
    const button = document.getElementById('daily-operation-toggle-btn');
    const statusResponse = await fetch('/api/admin/server/status');
    const statusData = await statusResponse.json();
    const isRunning = statusData.success ? statusData.kiosk_running === true : button?.dataset?.running === 'true';
    const action = isRunning ? 'end the day, stop the kiosk and hibernate this PC (the wall and tablets go dark until it is woken)' : 'start the day and turn the kiosk on';

    if (!confirm(`Are you sure you want to ${action}?`)) return;

    if (button) {
        button.disabled = true;
        button.textContent = isRunning ? 'Turning Off...' : 'Turning On...';
    }

    try {
        await setServerModeForDailyOperation();

        const response = await fetch(isRunning ? '/api/admin/server/stop' : '/api/admin/server/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Daily operation failed');
        }

        showNotification(data.message || (isRunning ? 'End Day complete. Kiosk is off.' : 'Start Day complete. Kiosk is on.'), 'success');
        setTimeout(() => checkServerStatus(), 2000);
    } catch (error) {
        console.error('Daily operation error:', error);
        showNotification(error.message || 'Daily operation failed', 'error');
        checkServerStatus();
    }
}

// Start/stop server functions with manual mode check
function startServer() {
    // Check if in manual mode
    const toggle = document.getElementById('auto-mode-toggle');
    const isAuto = toggle ? toggle.checked : true;
    
    if (isAuto) {
        showNotification('Switch to MANUAL MODE first to manually control the server', 'warning');
        return;
    }
    
    console.log('▶️ Starting server manually...');
    
    fetch('/api/admin/server/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Server started successfully', 'success');
            // Wait a moment then check status
            setTimeout(() => checkServerStatus(), 2000);
        } else {
            showNotification(data.error || 'Failed to start server', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error starting server:', error);
        showNotification('Error starting server', 'error');
    });
}

function restartServer() {
    const toggle = document.getElementById('auto-mode-toggle');
    const isAuto = toggle ? toggle.checked : true;

    if (isAuto) {
        showNotification('Switch to MANUAL MODE first to restart the server', 'warning');
        return;
    }

    if (!confirm('Restart the kiosk application now?')) return;

    console.log('🔄 Restarting server manually...');

    fetch('/api/admin/server/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Restart initiated. The application will relaunch shortly.', 'success');
        } else {
            showNotification(data.error || 'Failed to restart server', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error restarting server:', error);
        showNotification('Error restarting server', 'error');
    });
}

function stopServer() {
    // Check if in manual mode
    const toggle = document.getElementById('auto-mode-toggle');
    const isAuto = toggle ? toggle.checked : true;
    
    if (isAuto) {
        showNotification('Switch to MANUAL MODE first to manually control the server', 'warning');
        return;
    }
    
    if (!confirm('Stop the kiosk server? This PC hibernates right after, so the wall and tablets go dark until it is woken up.')) return;
    
    console.log('⏹️ Stopping server manually...');
    
    fetch('/api/admin/server/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(data.message || 'Server stopped successfully', 'success');
            // Wait a moment then check status
            setTimeout(() => checkServerStatus(), 2000);
        } else {
            showNotification(data.error || 'Failed to stop server', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error stopping server:', error);
        showNotification('Error stopping server', 'error');
    });
}

// Utility functions

function getScheduleTypeBadge(type) {
    const badges = {
        'daily': '<span class="badge badge-info">Daily</span>',
        'weekly': '<span class="badge badge-info">Weekly</span>',
        'specific_date': '<span class="badge badge-info">Specific</span>'
    };
    return badges[type] || '<span class="badge">Unknown</span>';
}

function formatDaysDisplay(daysString, scheduleType, specificDate) {
    if (scheduleType === 'specific_date' && specificDate) {
        // Format the date nicely
        const date = new Date(specificDate);
        return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    if (scheduleType !== 'weekly' || !daysString) {
        return scheduleType === 'daily' ? 'Everyday' : '-';
    }
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = daysString.split(',').map(d => parseInt(d.trim()));
    
    if (days.length === 7) return 'Everyday';
    if (days.length === 5 && days.includes(2) && days.includes(3) && 
        days.includes(4) && days.includes(5) && days.includes(6)) {
        return 'Weekdays';
    }
    
    return days.map(day => dayNames[day - 1] || day).join(', ');
}

function updateFormFields() {
    const scheduleType = document.getElementById('schedule-type').value;
    
    // Show/hide days selection for weekly
    const daysSection = document.getElementById('weekly-days-section');
    if (daysSection) {
        daysSection.style.display = scheduleType === 'weekly' ? 'block' : 'none';
    }
    
    // Show/hide specific date for specific_date
    const specificDateSection = document.getElementById('specific-date-section');
    if (specificDateSection) {
        specificDateSection.style.display = scheduleType === 'specific_date' ? 'block' : 'none';
    }
}

// Helper functions

function showNotification(message, type = 'info') {
    // Remove any existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function showLoading(selector, message = 'Loading...') {
    const element = document.querySelector(selector);
    if (element) {
        element.classList.add('loading');
        element.setAttribute('data-loading-text', message);
    }
}

function hideLoading() {
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(element => {
        element.classList.remove('loading');
    });
}

function showError(selector, message) {
    const element = document.querySelector(selector);
    if (element) {
        element.classList.remove('loading');
        const safeMessage = escapeHtml(message);
        element.innerHTML = element.tagName === 'TBODY'
            ? `<tr><td colspan="10" class="table-error">${safeMessage}</td></tr>`
            : `<p class="table-error">${safeMessage}</p>`;
    }
    showNotification(message, 'error');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialisation

// Export functions for use in other modules
window.serverScheduleManager = {
    loadSchedules,
    showAddScheduleModal,
    editSchedule,
    saveSchedule,
    deleteSchedule,
    toggleScheduleStatus,
    enableAllSchedules,
    disableAllSchedules,
    startServer,
    stopServer,
    toggleDailyOperation,
    restartServer,
    loadServerMode,
    toggleServerMode,
    checkServerStatus
};



// ==================== AUTOMATION OVERVIEW (Role 3) ====================
// What the scheduler will do next, from GET /api/admin/server/automation

function formatPlannedTime(iso) {
    if (!iso) return '–';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '–';
    const now = new Date();
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
    const time = date.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (dayDiff === 0) return `Today ${time}`;
    if (dayDiff === 1) return `Tomorrow ${time}`;
    return `${date.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}

function setAutomationText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setAutomationState(label, tone) {
    const pill = document.getElementById('automation-state');
    if (!pill) return;
    pill.className = `status-indicator status-${tone}`;
    pill.innerHTML = `<span class="status-dot"></span>${label}`;
}

async function loadAutomationStatus() {
    if (!document.getElementById('automation-card')) return;
    try {
        const response = await fetch('/api/admin/server/automation');
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load automation status');
        renderAutomationStatus(data.automation);
    } catch (error) {
        console.error('❌ Error loading automation status:', error);
        setAutomationText('automation-summary', 'Automation status is not available right now.');
        setAutomationState('Unavailable', 'offline');
    }
}

function renderAutomationStatus(a) {
    const isAuto = a.mode === 'auto';
    if (!a.enabled) {
        setAutomationState('Off on this machine', 'offline');
        setAutomationText('automation-summary', 'Automation is switched off here (KIOSK_AUTOMATION=off). Schedules are saved but nothing runs them.');
    } else if (!isAuto) {
        setAutomationState('Paused', 'warning');
        setAutomationText('automation-summary', 'Manual mode: switch to AUTO MODE below and the schedules will hibernate and wake the PC.');
    } else if (!a.activeSchedules) {
        setAutomationState('No schedules', 'warning');
        setAutomationText('automation-summary', 'AUTO MODE is on but no schedule is active. Add or enable one to automate the day.');
    } else if (a.dryRun) {
        setAutomationState('Dry run', 'warning');
        setAutomationText('automation-summary', 'Dry run: actions are only logged (KIOSK_AUTOMATION=dry-run).');
    } else {
        setAutomationState('Running', 'online');
        setAutomationText('automation-summary', a.currentWindow
            ? `Kiosk hours are open (${a.currentWindow.schedule}) until ${formatPlannedTime(a.currentWindow.until)}.`
            : `${a.activeSchedules} active schedule${a.activeSchedules === 1 ? '' : 's'}. The PC hibernates at the stop time and wakes before the start time.`);
    }

    setAutomationText('automation-next-stop', isAuto && a.enabled ? formatPlannedTime(a.nextStop) : '–');
    setAutomationText('automation-next-start', isAuto && a.enabled ? formatPlannedTime(a.nextStart) : '–');

    const wake = a.wake || {};
    if (!wake.supported) {
        setAutomationText('automation-wake-status', 'Windows only');
        setAutomationText('automation-wake-detail', 'Wake timers need the Windows Task Scheduler');
    } else if (wake.dryRun) {
        setAutomationText('automation-wake-status', 'Dry run');
        setAutomationText('automation-wake-detail', `${wake.triggers || 0} trigger(s) would be set`);
    } else if (wake.error) {
        setAutomationText('automation-wake-status', 'Not set');
        setAutomationText('automation-wake-detail', wake.error);
    } else if (wake.task && wake.task.exists) {
        setAutomationText('automation-wake-status', wake.wakeTimersAllowed === false ? 'Set, timers blocked' : 'Set');
        setAutomationText('automation-wake-detail', wake.wakeTimersAllowed === false
            ? 'Windows power settings block wake timers: run the install script as administrator'
            : (wake.task.nextRun ? `Next wake ${wake.task.nextRun}` : 'Scheduled task present'));
    } else {
        setAutomationText('automation-wake-status', a.activeSchedules ? 'Missing' : 'Not needed');
        setAutomationText('automation-wake-detail', a.activeSchedules ? 'Created when a schedule is saved while automation is on' : 'No active schedule');
    }

    setAutomationText('automation-last-tick', a.lastTick ? `Checked ${formatPlannedTime(a.lastTick)}` : (a.enabled ? 'Starting…' : 'Off'));
    setAutomationText('automation-mode-hint', isAuto ? 'AUTO MODE: schedules apply' : 'Manual mode: schedules paused');

    const list = document.getElementById('automation-events');
    if (!list) return;
    const labels = { hibernate: 'Hibernated the PC', start: 'Starting the kiosk', 'start-ok': 'Kiosk started', 'start-failed': 'Kiosk start failed' };
    if (!a.events || !a.events.length) {
        list.innerHTML = '<li class="automation-empty">No automatic actions recorded yet</li>';
        return;
    }
    list.innerHTML = a.events.map((event) => {
        const when = new Date(event.at).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
        const tone = event.type === 'start-failed' ? 'danger' : (event.type === 'hibernate' ? 'info' : 'success');
        return `<li class="automation-event automation-event-${tone}">
                    <span class="automation-event-time">${escapeHtmlSafe(when)}</span>
                    <span class="automation-event-type">${escapeHtmlSafe(labels[event.type] || event.type)}${event.dryRun ? ' (dry run)' : ''}</span>
                    <span class="automation-event-detail">${escapeHtmlSafe(event.detail || '')}</span>
                </li>`;
    }).join('');
}
