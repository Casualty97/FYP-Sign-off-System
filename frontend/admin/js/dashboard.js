// Owner: Role 3, Jun Kai. Previous team: XY (Xuanyang) (2).
// Part 4/30 of the admin page: dashboard, charts, alerts, journey passport (load order in admin.html).
// ==================== 4. DASHBOARD MANAGEMENT ====================
// Global chart instances
let visitorTrendsChart = null;
let feedbackDistributionChart = null;
let dailyLeafPledgeChart = null;
let dailyLeafPledgeChartType = 'bar';
let dailyLeafPledgeChartData = { labels: [], leafData: [], pledgeData: [] };
let currentChartRange = 'week';

// ==================== ENHANCED DASHBOARD DATA LOADING ====================
// Enhanced dashboard data loading with chart data
async function loadDashboardData() {
    try {
        console.log('📊 [PRETI] Loading enhanced dashboard data...');
        const response = await fetch('/api/admin/dashboard');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[PRETI] Dashboard API response:', data);
        
        if (data.success) {
            updateEnhancedDashboardStats(data.stats);
            await updateSystemStatus(data.recentActivity); // Check all system statuses (System Status section)
            
            await Promise.all([
                loadChartData(), // Load chart data separately
                loadInterventionAlerts(),
                loadJourneyPassport()
            ]);
            updateLastUpdated();
        } else {
            console.error('[PRETI] Failed to load dashboard data:', data.error);
            showNotification('Error loading dashboard data', 'error');
        }
    } catch (error) {
        console.error('❌ [PRETI] Error loading dashboard data:', error);
        updateEnhancedDashboardStats(getDefaultStats());
        showNotification('Error connecting to server', 'error');
    }
}

// Update dashboard statistics with enhanced metrics
function updateEnhancedDashboardStats(stats) {
    console.log('📈 Updating dashboard stats (feedback only):', stats);
    
    // This Month's Feedback
    const feedbackMonthEl = document.getElementById('feedback-month-value');
    if (feedbackMonthEl) {
        const monthFeedback = stats.feedbackThisMonth ?? stats.feedbackSubmissions ?? 0;
        animateValue(feedbackMonthEl, 0, monthFeedback, 1000);
    }
    
    // Today's Feedback
    const feedbackTodayEl = document.getElementById('feedback-today-value');
    if (feedbackTodayEl) {
        const todayFeedback = stats.feedbackToday ?? 0;
        animateValue(feedbackTodayEl, 0, todayFeedback, 1000);
    }
}

// Update system status section - CHECK ALL SERVICES LIVE
async function updateSystemStatus(activity) {
    console.log('🔄 Checking all system statuses...');
    
    // Track overall system health
    let allSystemsOk = true;
    let statusMessages = [];
    
    // Check Kiosk Server Status
    try {
        const kioskResponse = await fetch('/api/admin/server/status');
        const kioskData = await kioskResponse.json();
        const kioskStatusEl = document.getElementById('kiosk-server-status');
        
        if (kioskStatusEl) {
            if (kioskData.success && kioskData.kiosk_running) {
                kioskStatusEl.className = 'status-badge status-online';
                kioskStatusEl.textContent = 'Online';
                statusMessages.push('Kiosk Server: Online');
            } else {
                kioskStatusEl.className = 'status-badge status-offline';
                kioskStatusEl.textContent = 'Offline';
                allSystemsOk = false;
                statusMessages.push('Kiosk Server: Offline');
            }
        }
    } catch (error) {
        console.error('❌ Error checking kiosk status:', error);
        const kioskStatusEl = document.getElementById('kiosk-server-status');
        if (kioskStatusEl) {
            kioskStatusEl.className = 'status-badge status-error';
            kioskStatusEl.textContent = 'Error';
            allSystemsOk = false;
        }
    }
    
    // Check Database Status
    try {
        const dbResponse = await fetch('/api/test-db');
        const dbData = await dbResponse.json();
        const dbStatusEl = document.getElementById('database-status');
        
        if (dbStatusEl) {
            if (dbData.message && dbData.message.includes('working')) {
                dbStatusEl.className = 'status-badge status-online';
                dbStatusEl.textContent = 'Connected';
                statusMessages.push('Database: Connected');
            } else {
                dbStatusEl.className = 'status-badge status-error';
                dbStatusEl.textContent = 'Error';
                allSystemsOk = false;
                statusMessages.push('Database: Error');
            }
        }
    } catch (error) {
        console.error('❌ Error checking database status:', error);
        const dbStatusEl = document.getElementById('database-status');
        if (dbStatusEl) {
            dbStatusEl.className = 'status-badge status-offline';
            dbStatusEl.textContent = 'Disconnected';
            allSystemsOk = false;
        }
    }
    
    // Update Overall System Status
    const overallStatusEl = document.getElementById('overall-system-status');
    if (overallStatusEl) {
        if (allSystemsOk) {
            overallStatusEl.className = 'status-indicator status-online';
            overallStatusEl.innerHTML = '<span class="status-dot"></span>All Systems Operational';
        } else {
            overallStatusEl.className = 'status-indicator status-warning';
            overallStatusEl.innerHTML = '<span class="status-dot"></span>System Issues Detected';
        }
    }
    
    console.log('✅ System status check complete:', statusMessages);
}

function getInterventionAlertIcon(severity) {
    if (severity === 'high') return '!';
    if (severity === 'medium') return 'i';
    return 'OK';
}

function formatInterventionSeverity(severity) {
    const normalized = String(severity || 'low').toLowerCase();
    if (normalized === 'high') return 'High';
    if (normalized === 'medium') return 'Medium';
    return 'Low';
}

function renderInterventionAlerts(alerts) {
    const list = document.getElementById('intervention-alerts-list');
    const count = document.getElementById('intervention-alerts-count');
    if (!list) return;

    const safeAlerts = Array.isArray(alerts) ? alerts : [];
    const actionableAlerts = safeAlerts.filter(alert => alert.severity !== 'low' || alert.id !== 'monitoring-normal');

    if (count) {
        count.textContent = actionableAlerts.length > 0
            ? `${actionableAlerts.length} active`
            : 'No urgent alerts';
        count.className = actionableAlerts.some(alert => alert.severity === 'high')
            ? 'intervention-alerts-count severity-high'
            : (actionableAlerts.length > 0 ? 'intervention-alerts-count severity-medium' : 'intervention-alerts-count severity-low');
    }

    if (safeAlerts.length === 0) {
        list.innerHTML = '<p class="intervention-alert-empty">No intervention alerts available yet.</p>';
        return;
    }

    list.innerHTML = safeAlerts.map(alert => {
        const severity = String(alert.severity || 'low').toLowerCase();
        const severityLabel = formatInterventionSeverity(severity);
        return `
            <article class="intervention-alert intervention-alert--${escapeHtmlSafe(severity)}">
                <div class="intervention-alert-icon" aria-hidden="true">${escapeHtmlSafe(getInterventionAlertIcon(severity))}</div>
                <div class="intervention-alert-body">
                    <div class="intervention-alert-topline">
                        <h4>${escapeHtmlSafe(alert.title || 'Intervention alert')}</h4>
                        <span class="intervention-alert-severity">${severityLabel}</span>
                    </div>
                    <p class="intervention-alert-message">${escapeHtmlSafe(alert.message || '')}</p>
                    <p class="intervention-alert-action">${escapeHtmlSafe(alert.suggestedAction || '')}</p>
                </div>
                <div class="intervention-alert-metric">${escapeHtmlSafe(alert.metric || '')}</div>
            </article>
        `;
    }).join('');
}

async function loadInterventionAlerts() {
    const list = document.getElementById('intervention-alerts-list');
    const count = document.getElementById('intervention-alerts-count');

    try {
        if (count) {
            count.textContent = 'Checking...';
            count.className = 'intervention-alerts-count';
        }

        const response = await fetch('/api/admin/intervention-alerts', {
            credentials: 'include',
            cache: 'no-store'
        });
        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
            ? await response.json()
            : { success: false, error: 'Intervention alerts endpoint is not available. Restart the backend server to load the new route.' };

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to load intervention alerts');
        }

        renderInterventionAlerts(data.alerts || []);
    } catch (error) {
        console.error('Error loading intervention alerts:', error);
        if (count) {
            count.textContent = 'Unavailable';
            count.className = 'intervention-alerts-count severity-high';
        }
        if (list) {
            list.innerHTML = `<p class="intervention-alert-empty intervention-alert-error">${escapeHtmlSafe(error.message || 'Unable to load intervention alerts. Check server logs if this repeats.')}</p>`;
        }
    }
}

function setPassportStatus(text, className = '') {
    const status = document.getElementById('journey-passport-status');
    if (!status) return;
    status.textContent = text;
    status.className = `journey-passport-status ${className}`.trim();
}

function updatePassportMetric(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function renderJourneyPassport(passport) {
    const list = document.getElementById('journey-passport-list');
    const breakdown = document.getElementById('journey-passport-breakdown');
    if (!list) return;

    const summary = passport?.summary || {};
    const topPassports = Array.isArray(passport?.topPassports) ? passport.topPassports : [];
    const stampBreakdown = Array.isArray(passport?.stampBreakdown) ? passport.stampBreakdown : [];
    const topicBreakdown = Array.isArray(passport?.topicBreakdown) ? passport.topicBreakdown : [];

    updatePassportMetric('passport-holder-count', summary.passportHolders || 0);
    updatePassportMetric('passport-repeat-count', summary.repeatVisitors || 0);
    updatePassportMetric('passport-stamp-count', summary.totalStamps || 0);
    updatePassportMetric('passport-average-count', summary.averageStamps || 0);

    setPassportStatus(topPassports.length > 0 ? `${topPassports.length} shown` : 'No passports yet', topPassports.length > 0 ? 'is-ready' : '');

    if (breakdown) {
        const activeStamps = stampBreakdown.filter(stamp => Number(stamp.count || 0) > 0);
        const activeTopics = topicBreakdown.filter(topic => Number(topic.count || 0) > 0);
        if (activeStamps.length === 0 && activeTopics.length === 0) {
            breakdown.innerHTML = '<p class="journey-passport-empty">Passport stamp breakdown will appear after visitor milestones are earned.</p>';
        } else {
            const stampHtml = activeStamps.map(stamp => `
                <span class="journey-breakdown-chip">
                    ${escapeHtmlSafe(stamp.label || 'Stamp')}
                    <strong>${escapeHtmlSafe(String(stamp.count || 0))}</strong>
                </span>
            `).join('');
            const topicHtml = activeTopics.map(topic => `
                <span class="journey-breakdown-chip journey-breakdown-topic">
                    ${escapeHtmlSafe(topic.label || 'Topic')}
                    <strong>${escapeHtmlSafe(String(topic.count || 0))}</strong>
                </span>
            `).join('');
            breakdown.innerHTML = `
                <div class="journey-breakdown-group" aria-label="Milestone stamp totals">${stampHtml}</div>
                ${topicHtml ? `<div class="journey-breakdown-group" aria-label="Topic badge totals">${topicHtml}</div>` : ''}
            `;
        }
    }

    if (topPassports.length === 0) {
        list.innerHTML = '<p class="journey-passport-empty">No visitor passport milestones available yet.</p>';
        return;
    }

    list.innerHTML = topPassports.map(visitor => {
        const stamps = Array.isArray(visitor.stamps) ? visitor.stamps : [];
        const topicBadges = Array.isArray(visitor.topicBadges) ? visitor.topicBadges : [];
        const lastSeen = visitor.lastSeen ? new Date(visitor.lastSeen).toLocaleDateString() : 'No date';
        const stampHtml = stamps.map(stamp => `
            <span class="journey-stamp" title="${escapeHtmlSafe(stamp.detail || '')}">
                ${escapeHtmlSafe(stamp.label || 'Stamp')}
            </span>
        `).join('');
        const topicHtml = topicBadges.map(badge => `
            <span class="journey-stamp journey-stamp-topic">
                ${escapeHtmlSafe(badge.label || 'Topic Badge')}
            </span>
        `).join('');

        return `
            <article class="journey-passport-item">
                <div class="journey-passport-avatar" aria-hidden="true">${escapeHtmlSafe(String(visitor.name || 'V').trim().charAt(0).toUpperCase() || 'V')}</div>
                <div class="journey-passport-body">
                    <div class="journey-passport-topline">
                        <h4>${escapeHtmlSafe(visitor.name || 'Anonymous Visitor')}</h4>
                        <span>${escapeHtmlSafe(String(visitor.stampCount || 0))} stamp${Number(visitor.stampCount || 0) === 1 ? '' : 's'}</span>
                    </div>
                    <div class="journey-passport-meta">
                        ${escapeHtmlSafe(String(visitor.feedbackCount || 0))} feedback &bull;
                        ${escapeHtmlSafe(String(visitor.pledgeCount || 0))} pledge${Number(visitor.pledgeCount || 0) === 1 ? '' : 's'} &bull;
                        ${escapeHtmlSafe(String(visitor.likedPledgeCount || 0))} like${Number(visitor.likedPledgeCount || 0) === 1 ? '' : 's'} &bull;
                        Last seen ${escapeHtmlSafe(lastSeen)}
                    </div>
                    <div class="journey-passport-progress" aria-label="Passport completion">
                        <span style="width:${Math.max(0, Math.min(100, Number(visitor.progressPercent || 0)))}%"></span>
                    </div>
                    <div class="journey-passport-stamps">
                        ${stampHtml || '<span class="journey-stamp journey-stamp-muted">First milestone pending</span>'}
                        ${topicHtml}
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

async function loadJourneyPassport() {
    try {
        setPassportStatus('Loading...');
        const response = await fetch('/api/admin/journey-passport', {
            credentials: 'include',
            cache: 'no-store'
        });
        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
            ? await response.json()
            : { success: false, error: 'Journey passport endpoint is not available. Restart the backend server to load the new route.' };

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to load journey passport');
        }

        renderJourneyPassport(data.passport || {});
    } catch (error) {
        console.error('Error loading journey passport:', error);
        setPassportStatus('Unavailable', 'is-error');
        const list = document.getElementById('journey-passport-list');
        const breakdown = document.getElementById('journey-passport-breakdown');
        if (list) {
            list.innerHTML = `<p class="journey-passport-empty journey-passport-error">${escapeHtmlSafe(error.message || 'Unable to load journey passport data.')}</p>`;
        }
        if (breakdown) {
            breakdown.innerHTML = '';
        }
    }
}





// Animate number counting
function animateValue(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16); // 60 FPS
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.round(current).toLocaleString();
    }, 16);
}

// Update last updated timestamp
function updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const lastUpdatedElement = document.querySelector('.last-updated');
    if (lastUpdatedElement) {
        lastUpdatedElement.textContent = `Last updated: ${timeString}`;
    }
}

// Get default statistics for offline mode
function getDefaultStats() {
    return {
        feedbackToday: 0,
        feedbackThisMonth: 0,
        feedbackSubmissions: 0
    };
}

// Refresh dashboard
function refreshDashboard() {
    const btn = document.querySelector('#dashboard-page .refresh-btn svg');
    if (btn) {
        btn.style.animationPlayState = 'running';
        setTimeout(() => {
            btn.style.animationPlayState = 'paused';
        }, 1000);
    }
    loadDashboardData();
    showNotification('Dashboard refreshed', 'success');
}

// ==================== CHART FUNCTIONALITY ====================

// Load chart data from API
// ==================== CHART FUNCTIONALITY (UPDATED FOR REAL DATA) ====================

// Load chart data from REAL database
async function loadChartData() {
    try {
        console.log('📊 Loading REAL chart data from database...');
        await loadVisitorTrendsData();
        await loadFeedbackDistributionData();
        await loadDailyLeafPledgeData();
    } catch (error) {
        console.error('❌ Error loading chart data:', error);
        showNotification('Failed to load chart data', 'error');
    }
}

// Load feedback trends data from REAL database
async function loadVisitorTrendsData() {
    try {
        console.log('📈 Fetching REAL feedback trends from database...');
        
        const response = await fetch('/api/admin/visitor-trends?range=' + currentChartRange);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.data) {
                console.log('✅ Got REAL feedback trends data');
                
                const hasData = data.data.feedbackData.some(f => f > 0);
                
                if (!hasData) {
                    console.log('ℹ️  No feedback data yet - showing empty chart');
                }
                
                // Only pass feedback data (no visitor data)
                createVisitorTrendsChart(
                    data.data.labels, 
                    data.data.feedbackData
                );
                return;
            }
        }
        
        console.log('⚠️  Feedback trends API not available - showing empty chart');
        createEmptyVisitorTrendsChart();
        
    } catch (error) {
        console.error('❌ Error loading feedback trends:', error);
        createEmptyVisitorTrendsChart();
    }
}

// Load feedback distribution data from REAL database
async function loadFeedbackDistributionData() {
    try {
        console.log('🍩 Fetching REAL feedback distribution from database...');
        
        const response = await fetch('/api/admin/feedback-stats');
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.stats) {
                console.log('✅ Got REAL feedback stats');
                
                const hasData = Object.values(data.stats).some(v => v > 0);
                
                if (!hasData) {
                    console.log('ℹ️  No feedback data yet - showing empty chart');
                }
                
                createFeedbackDistributionChart(data.stats);
                return;
            }
        }
        
        console.log('⚠️  Feedback stats API not available - showing empty chart');
        createEmptyFeedbackDistributionChart();
        
    } catch (error) {
        console.error('❌ Error loading feedback distribution:', error);
        createEmptyFeedbackDistributionChart();
    }
}

async function loadDailyLeafPledgeData() {
    try {
        console.log('Fetching daily leaf and pledge counts...');

        const response = await fetch('/api/admin/leaf-pledge-trends?days=6');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        if (data.success && data.data) {
            dailyLeafPledgeChartData = {
                labels: data.data.labels || [],
                leafData: data.data.leafData || [],
                pledgeData: data.data.pledgeData || []
            };
            createDailyLeafPledgeChart(data.data.labels, data.data.leafData, data.data.pledgeData);
            updateDailyLeafPledgeSummary(data.data);
            return;
        }

        throw new Error(data.error || 'Invalid daily leaf and pledge data');
    } catch (error) {
        console.error('Error loading daily leaf and pledge counts:', error);
        dailyLeafPledgeChartData = { labels: [], leafData: [], pledgeData: [] };
        createDailyLeafPledgeChart([], [], []);
        updateDailyLeafPledgeSummary({ labels: [], leafData: [], pledgeData: [], totalLeaves: 0, totalPledges: 0 });
    }
}

function getVisitorTrendsCanvas() {
    const activePage = document.querySelector('.page.active');
    const activePageId = activePage ? activePage.id : '';

    if (activePageId === 'feedback-report-page') {
        return document.getElementById('feedbackTrendChart') || document.getElementById('visitorTrendsChart');
    }

    if (activePageId === 'dashboard-page') {
        return document.getElementById('visitorTrendsChart') || document.getElementById('feedbackTrendChart');
    }

    return document.getElementById('visitorTrendsChart') || document.getElementById('feedbackTrendChart');
}

// Create feedback trends chart (feedback only - no visitor data)
function createVisitorTrendsChart(labels, feedbackData) {
    const ctx = getVisitorTrendsCanvas();
    if (!ctx) {
        console.warn('visitorTrendsChart canvas not found');
        return;
    }
    
    if (visitorTrendsChart) {
        visitorTrendsChart.destroy();
    }
    
    visitorTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Feedback',
                    data: feedbackData,
                    borderColor: 'rgb(99, 102, 241)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: 'rgb(99, 102, 241)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleColor: '#fff',
                    titleFont: {
                        size: 13,
                        weight: 'bold'
                    },
                    bodyColor: '#fff',
                    bodyFont: {
                        size: 12
                    },
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return ' ' + context.dataset.label + ': ' + context.parsed.y;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        precision: 0,
                        font: {
                            size: 11
                        }
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
    
    console.log('✅ Visitor trends chart created with REAL data');
}

// Fallback for empty visitor trends
function createEmptyVisitorTrendsChart() {
    const labels = [];
    const emptyData = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        labels.push(`${dayName}\n${dateLabel}`);
        emptyData.push(0);
    }
    
    createVisitorTrendsChart(labels, emptyData, emptyData);
}

// Fallback to sample data (only if API completely fails)
function createVisitorTrendsChartWithSampleData() {
    const labels = [];
    const visitorData = [];
    const feedbackData = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
        visitorData.push(Math.floor(Math.random() * 50) + 30);
        feedbackData.push(Math.floor(Math.random() * 30) + 10);
    }
    
    createVisitorTrendsChart(labels, visitorData, feedbackData);
}

// Create feedback distribution chart
function createFeedbackDistributionChart(stats) {
    const ctx = document.getElementById('feedbackDistributionChart');
    if (!ctx) {
        console.warn('feedbackDistributionChart canvas not found');
        return;
    }
    
    if (feedbackDistributionChart) {
        feedbackDistributionChart.destroy();
    }
    
    feedbackDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [
                'With Email',
                'Without Email', 
                'With Photo',
                'Long-term Storage'
            ],
            datasets: [{
                data: [
                    stats.withEmail || 0,
                    stats.withoutEmail || 0,
                    stats.withPhoto || 0,
                    stats.longterm || 0
                ],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(156, 163, 175, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(245, 158, 11, 0.8)'
                ],
                borderColor: [
                    'rgb(16, 185, 129)',
                    'rgb(156, 163, 175)',
                    'rgb(59, 130, 246)',
                    'rgb(245, 158, 11)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleColor: '#fff',
                    titleFont: {
                        size: 13,
                        weight: 'bold'
                    },
                    bodyColor: '#fff',
                    bodyFont: {
                        size: 12
                    },
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return ` ${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    console.log('✅ Feedback distribution chart created with REAL data');
}

// Switch Daily Leaves & Pledges between bar and line chart (DONE BY XY)
function setDailyLeafPledgeChartType(type) {
    if (!['bar', 'line'].includes(type)) return;

    dailyLeafPledgeChartType = type;

    document.getElementById('daily-leaf-bar-btn')?.classList.toggle('active', type === 'bar');
    document.getElementById('daily-leaf-line-btn')?.classList.toggle('active', type === 'line');

    createDailyLeafPledgeChart(
        dailyLeafPledgeChartData.labels,
        dailyLeafPledgeChartData.leafData,
        dailyLeafPledgeChartData.pledgeData
    );
}

// Build the correct dataset style for bar or line chart display (DONE BY XY)
function createDailyLeafPledgeDataset(label, data, color, fillColor) {
    if (dailyLeafPledgeChartType === 'line') {
        return {
            label,
            data,
            borderColor: color,
            backgroundColor: fillColor,
            borderWidth: 3,
            fill: false,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 2
        };
    }

    return {
        label,
        data,
        backgroundColor: fillColor,
        borderColor: color,
        borderWidth: 1,
        borderRadius: 8
    };
}

function createDailyLeafPledgeChart(labels, leafData, pledgeData) {
    const ctx = document.getElementById('dailyLeafPledgeChart');
    if (!ctx) {
        console.warn('dailyLeafPledgeChart canvas not found');
        return;
    }

    if (dailyLeafPledgeChart) {
        dailyLeafPledgeChart.destroy();
    }

    dailyLeafPledgeChart = new Chart(ctx, {
        type: dailyLeafPledgeChartType,
        data: {
            labels,
            datasets: [
                createDailyLeafPledgeDataset('Leaves', leafData, 'rgb(22, 163, 74)', 'rgba(34, 197, 94, 0.72)'),
                createDailyLeafPledgeDataset('Pledges', pledgeData, 'rgb(2, 132, 199)', 'rgba(14, 165, 233, 0.72)')
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function updateDailyLeafPledgeSummary(data) {
    const totalLeavesEl = document.getElementById('daily-leaf-total');
    const totalPledgesEl = document.getElementById('daily-pledge-total');
    const listEl = document.getElementById('daily-leaf-list');

    if (totalLeavesEl) totalLeavesEl.textContent = Number(data.totalLeaves || 0).toLocaleString();
    if (totalPledgesEl) totalPledgesEl.textContent = Number(data.totalPledges || 0).toLocaleString();
    if (!listEl) return;

    const labels = data.labels || [];
    const leafData = data.leafData || [];
    const pledgeData = data.pledgeData || [];

    if (!labels.length) {
        listEl.innerHTML = '<p class="daily-leaf-empty">No daily leaf or pledge data available yet.</p>';
        return;
    }

    listEl.innerHTML = labels.map((label, index) => {
        const displayDate = escapeHtmlSafe(String(label).replace('\n', ' '));
        const leaves = Number(leafData[index] || 0);
        const pledges = Number(pledgeData[index] || 0);
        return `
            <div class="daily-leaf-item">
                <div class="daily-leaf-date">${displayDate}</div>
                <div class="daily-leaf-counts">
                    <span>Leaves <strong>${leaves.toLocaleString()}</strong></span>
                    <span>Pledges <strong>${pledges.toLocaleString()}</strong></span>
                </div>
            </div>
        `;
    }).join('');
}

// Fallback for empty feedback distribution
function createEmptyFeedbackDistributionChart() {
    const stats = {
        withEmail: 0,
        withoutEmail: 0,
        withPhoto: 0,
        longterm: 0
    };
    createFeedbackDistributionChart(stats);
}

// Fallback to sample data (only if API completely fails)
function createFeedbackDistributionChartWithSampleData() {
    const stats = {
        withEmail: 45,
        withoutEmail: 15,
        withPhoto: 50,
        longterm: 55
    };
    createFeedbackDistributionChart(stats);
}

// Update chart range
function updateChartRange(range) {
    currentChartRange = range;
    
    document.querySelectorAll('.chart-control-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadVisitorTrendsData();
    
    showNotification(`Chart updated to ${range} view`, 'info');
}


// ==================== INITIALIZATION ====================

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.warn('⚠️ Chart.js not loaded. Please add it to your HTML.');
        console.warn('Add this line to your admin.html <head>:');
        console.warn('<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>');
    } else {
        console.log('✅ Chart.js is loaded and ready');
    }
});

/* ==================== HELPER FUNCTIONS ====================
 * These can be used throughout the admin panel
 */

// Format number with commas
function formatNumber(num) {
    return num.toLocaleString();
}

// Calculate percentage
function calculatePercentage(value, total) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
}

// Format date for display
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format time for display
function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

console.log('✅ Enhanced dashboard JavaScript loaded - Updated version with working charts');

