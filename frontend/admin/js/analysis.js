// Owner: Role 3, Jun Kai. Previous team: Yu Kang (12).
// Part 10/30 of the admin page: feedback sentiment analysis (load order in admin.html).
// ==================== Feedback Sentiment Analysis ====================

// Switch between feedback report tabs
function switchFeedbackTab(tabId) {

    // Hide all contents
    document.querySelectorAll('.feedback-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Remove active from buttons
    document.querySelectorAll('.feedback-tab').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabId).classList.add('active');

    // Activate clicked button
    event.currentTarget.classList.add('active');
}


// Escape HTML to prevent XSS
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


async function loadFlaggedFeedback() {
    const tbody = document.getElementById('flagged-feedback-table-body');
    const summary = document.getElementById('flagged-feedback-summary');

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 24px; color: #64748b;">
                Loading flagged feedback...
            </td>
        </tr>
    `;

    try {
        const response = await fetch('/api/admin/flagged-feedback', {
            credentials: 'include',
            headers: {
                'x-username': sessionStorage.getItem('loggedUser')
            }
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to load flagged feedback');
        }

        renderFlaggedFeedback(data.flagged || [], data.feedbackCount || 0);

        if (summary) {
            const flaggedItems = Number(data.flaggedCount || 0);
            const flaggedFeedback = Number(data.feedbackCount || 0);
            summary.textContent = `${flaggedItems} flagged text item(s) found across ${flaggedFeedback} feedback submission(s). These submissions are hidden from /tree page.`;
        }
    } catch (error) {
        console.error('Error loading flagged feedback:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 24px; color: #ef4444;">
                    Unable to load flagged feedback<br>
                    <small>${escapeHtmlSafe(error.message)}</small>
                </td>
            </tr>
        `;

        if (summary) {
            summary.textContent = 'Flagged feedback could not be loaded. Check the server logs if this repeats.';
        }
    }
}

function renderFlaggedFeedback(items, feedbackCount) {
    const tbody = document.getElementById('flagged-feedback-table-body');
    if (!tbody) return;

    if (!items.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 24px; color: #64748b;">
                    No flagged feedback found.
                </td>
            </tr>
        `;
        return;
    }

    // Aggregate items by feedback_id so we display one row per feedback entry.
    const grouped = {};
    items.forEach(item => {
        const id = item.feedback_id || 'unknown';
        if (!grouped[id]) {
            grouped[id] = {
                feedback_id: id,
                name: item.name || 'Anonymous',
                date: item.date || '-',
                matchedKeywords: [],
                answers: [],
                comment: ''
            };
        }

        // collect keywords
        if (Array.isArray(item.matchedKeywords)) {
            grouped[id].matchedKeywords.push(...item.matchedKeywords);
        }

        // distinguish answer vs comment
        if ((item.source || '').toLowerCase() === 'answer') {
            if (item.text) grouped[id].answers.push(item.text);
        } else {
            // treat other sources (including Comment) as pledge/comment text
            if (item.text) grouped[id].comment = grouped[id].comment ? grouped[id].comment + ' ' + item.text : item.text;
        }
    });

    const rows = Object.values(grouped).map(entry => {
        const uniqueKeywords = Array.from(new Set(entry.matchedKeywords || []));
        const keywordBadges = (uniqueKeywords || []).map(k => `<span class="flagged-keyword-badge">${escapeHtmlSafe(k)}</span>`).join('');
        const feedbackText = (entry.answers || []).join('; ');
        const pledgeText = entry.comment || '';

        return `
            <tr data-feedback-id="${escapeHtmlSafe(entry.feedback_id)}">
                <td>${escapeHtmlSafe(entry.date)}</td>
                <td>${escapeHtmlSafe(entry.name)}</td>
                <td>Feedback</td>
                <td><div class="flagged-keyword-list">${keywordBadges}</div></td>
                <td class="flagged-feedback-text">${escapeHtmlSafe(feedbackText)}</td>
                <td class="flagged-pledge-text">${escapeHtmlSafe(pledgeText)}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rows;

    const summary = document.getElementById('flagged-feedback-summary');
    if (summary) {
        summary.textContent = `${Object.keys(grouped).length} flagged text item(s) found across ${Number(feedbackCount || 0)} feedback submission(s). These submissions are hidden from /tree page.`;
    }
}

// Update feedback analysis title based on selected mode (Done by Yu Kang)
function updateAnalysisTitle() {
    const select = document.getElementById('analysis-mode');
    const title = document.getElementById('feedback-analysis-header');

    if (!select || !title) return;

    const selectedText =
        select.options[select.selectedIndex].text;

    title.textContent =
        `Feedback Analysis (${selectedText})`;
}

// Done by Yu Kang
// Analyze and display all feedback answer values
async function analyzeFeedbackDataLegacy() {
    const resultsContainer = document.getElementById('feedback-analysis-results');
    const output = document.getElementById('feedback-analysis-output');

    if (!resultsContainer || !output) {
        return;
    }

    resultsContainer.style.display = 'block';
    output.innerHTML = `
        <div style="padding: 20px; color: #64748b; text-align: center;">
            Analyzing feedback sentiment...
        </div>
    `;

    try {
        const response = await fetch('/api/admin/feedback-insight-summary', {
            headers: {
                'x-username': sessionStorage.getItem('loggedUser')
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to analyze feedback');
        }

        const { positive, neutral, negative, total } = data.sentiment;
        
        output.innerHTML = `
            <div style="display: flex; gap: 30px; align-items: center;">
                <div style="flex: 1; position: relative; height: 300px;">
                    <canvas id="sentimentChart"></canvas>
                </div>
                <div style="flex: 0.6; padding: 20px; background: #f8fafc; border-radius: 8px;">
                    <div style="margin-bottom: 15px; font-size: 14px;">
                        <div style="color: #475569; margin-bottom: 12px;">
                            <strong style="color: #10b981;">✓ Positive:</strong> ${positive} (${total > 0 ? ((positive/total)*100).toFixed(1) : 0}%)
                        </div>
                        <div style="color: #475569; margin-bottom: 12px;">
                            <strong style="color: #f59e0b;">◆ Neutral:</strong> ${neutral} (${total > 0 ? ((neutral/total)*100).toFixed(1) : 0}%)
                        </div>
                        <div style="color: #475569;">
                            <strong style="color: #ef4444;">✗ Negative:</strong> ${negative} (${total > 0 ? ((negative/total)*100).toFixed(1) : 0}%)
                        </div>
                    </div>
                    <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 13px; color: #64748b;">
                        <strong>Total answers analyzed:</strong> ${total}
                    </div>
                </div>
            </div>
        `;

        // Create sentiment chart
        //setTimeout(() => createSentimentChart(positive, neutral, negative), 100);
        requestAnimationFrame(() => {
            createSentimentChart(positive, neutral, negative);
        });
        
    } catch (error) {
        console.error('Error analyzing feedback sentiment:', error);
        output.innerHTML = `
            <div style="padding: 20px; color: #ef4444; text-align: center;">
                Error analyzing feedback sentiment<br>
                <small>${escapeHtml(error.message)}</small>
            </div>
        `;
    }
}

// Render AI Insight Summary category cards (Done by Yu Kang)
function renderInsightPanel(title, items, accentColor, emptyText) {
    const content = items.length
        ? items.map(item => `
            <div style="padding: 12px 0; border-top: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px;">
                    <strong style="color: #0f172a;">${escapeHtml(item.label)}</strong>
                    <span style="color: ${accentColor}; font-weight: 800;">${Number(item.count || 0)}</span>
                </div>
                ${(item.examples || []).map(example => `
                    <blockquote style="margin: 8px 0 0; padding-left: 10px; border-left: 3px solid ${accentColor}; color: #475569; font-size: 13px; line-height: 1.5;">
                        ${escapeHtml(example.text)}
                    </blockquote>
                `).join('')}
            </div>
        `).join('')
        : `<p style="margin: 12px 0 0; color: #64748b;">${escapeHtml(emptyText)}</p>`;

    return `
        <section style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
            <h4 style="margin: 0; color: ${accentColor};">${escapeHtml(title)}</h4>
            ${content}
        </section>
    `;
}

// Render AI Insight Summary suggested admin action cards (Done by Yu Kang)
function renderActionPanel(title, items) {
    const content = items.length
        ? items.map(item => `
            <div style="padding: 12px 0; border-top: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px;">
                    <strong style="color: #0f172a;">${escapeHtml(item.title)}</strong>
                    <span style="font-size: 12px; color: #1d4ed8; font-weight: 800;">${escapeHtml(item.priority || 'Medium')}</span>
                </div>
                <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.5;">${escapeHtml(item.action)}</p>
            </div>
        `).join('')
        : '<p style="margin: 12px 0 0; color: #64748b;">No action needed yet.</p>';

    return `
        <section style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
            <h4 style="margin: 0; color: #1d4ed8;">${escapeHtml(title)}</h4>
            ${content}
        </section>
    `;
}

function getFeedbackInsightsBySentiment(sentiment) {
    const items = Array.isArray(window.latestFeedbackInsightItems) ? window.latestFeedbackInsightItems : [];
    return items.filter(item => String(item.sentiment || '').toLowerCase() === sentiment);
}

function closeFeedbackInsightsModal() {
    const modal = document.getElementById('feedback-insights-modal');
    if (modal) {
        modal.remove();
    }
}

// Filter feedback items by date range (Done by Yu Kang)
function filterFeedbackItemsByDate(items, fromDate, toDate) {
    return items.filter(item => {
        if (!item.date) return false;

        const itemDate = new Date(item.date);

        if (fromDate) {
            const start = new Date(fromDate);
            start.setHours(0, 0, 0, 0);

            if (itemDate < start) return false;
        }

        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);

            if (itemDate > end) return false;
        }

        return true;
    });
}

// Open modal to view feedback insights by sentiment (Done by Yu Kang)
function openFeedbackInsightsModal(sentiment) {
    const normalizedSentiment = String(sentiment || '').toLowerCase();
    let items = getFeedbackInsightsBySentiment(normalizedSentiment);
    const titleMap = {
        positive: 'Positive Feedback',
        neutral: 'Neutral Feedback',
        negative: 'Negative Feedback'
    };
    const colorMap = {
        positive: '#10b981',
        neutral: '#f59e0b',
        negative: '#ef4444'
    };

    closeFeedbackInsightsModal();

    const modal = document.createElement('div');
    modal.id = 'feedback-insights-modal';
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10020;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(15, 23, 42, 0.72);
        padding: 20px;
    `;

    const content = items.length
        ? items.map(item => `
            <div style="padding: 14px 0; border-top: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; flex-wrap: wrap;">
                    <strong style="color: #0f172a;">${escapeHtml(item.source || 'Feedback')}</strong>
                    <span style="font-size: 12px; color: #64748b;">${escapeHtml(item.date || '')}</span>
                </div>
                ${item.question ? `<div style="margin-bottom: 6px; color: #1d4ed8; font-size: 13px; font-weight: 600;">${escapeHtml(item.question)}</div>` : ''}
                <div style="color: #475569; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(item.text || '')}</div>
            </div>
        `).join('')
        : `<div style="padding: 18px 0; color: #64748b;">No ${escapeHtml(normalizedSentiment)} feedback was found for the selected analysis window.</div>`;

    modal.innerHTML = `
        <div style="width: min(920px, 100%); max-height: 86vh; background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.35); display: flex; flex-direction: column; overflow: hidden;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 22px; border-bottom: 1px solid #e2e8f0; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);">
                <div>
                    <h3 style="margin: 0; color: #0f172a; font-size: 20px;">${escapeHtml(titleMap[normalizedSentiment] || 'Feedback')}</h3>
                    <div style="margin-top: 4px; color: ${colorMap[normalizedSentiment] || '#64748b'}; font-weight: 700; font-size: 13px;">${items.length} item(s)</div>
                </div>
                <button type="button" onclick="closeFeedbackInsightsModal()" style="background: transparent; border: 0; color: #64748b; font-size: 28px; line-height: 1; cursor: pointer; padding: 4px 8px;">&times;</button>
            </div>

            <div style="padding:18px 22px; border-bottom:1px solid #e2e8f0; display:flex; gap:14px; align-items:end; flex-wrap:wrap;">
                <div>
                    <label style="display:block; font-size:12px; color:#64748b; margin-bottom:4px;">
                        From
                    </label>
                    <input type="date" id="feedbackDateFrom" style="padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px;">
                </div>

                <div>
                    <label style="display:block; font-size:12px; color:#64748b; margin-bottom:4px;">
                        To
                    </label>
                    <input type="date" id="feedbackDateTo" style="padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px;">
                </div>

                <button id="applyFeedbackDateFilter" class="btn-primary">
                    Apply
                </button>

                <button id="clearFeedbackDateFilter" class="btn-primary">
                    Clear
                </button>
            </div>

            <div id="feedbackModalContent" style="padding:20px 22px 22px; overflow:auto; background:#fff;">
                ${content}
            </div>
        </div>
    `;

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeFeedbackInsightsModal();
        }
    });

    document.body.appendChild(modal);

    // Add event listener for the "Apply" button to filter feedback items by date
    modal.querySelector('#applyFeedbackDateFilter').addEventListener('click', () => {
        const from = modal.querySelector('#feedbackDateFrom').value;
        const to = modal.querySelector('#feedbackDateTo').value;
        const filtered = filterFeedbackItemsByDate(items, from, to);

        renderItems(filtered);

        const count = modal.querySelector('h3')
            .nextElementSibling;

        count.textContent = `${filtered.length} item(s)`;
    });

    // Add event listener for the "Clear" button to reset the date filters
    modal.querySelector('#clearFeedbackDateFilter').addEventListener('click', () => {
        modal.querySelector('#feedbackDateFrom').value = '';
        modal.querySelector('#feedbackDateTo').value = '';

        renderItems(items);

        modal.querySelector('h3').nextElementSibling.textContent = `${items.length} item(s)`;
    });

    // Add event listeners for date filter buttons
    const contentContainer = modal.querySelector('#feedbackModalContent');
    const renderItems = (filteredItems) => {

        contentContainer.innerHTML = filteredItems.length
            ? filteredItems.map(item => `
                <div style="padding: 14px 0; border-top: 1px solid #e2e8f0;">
                    <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; flex-wrap: wrap;">
                        <strong style="color: #0f172a;">${escapeHtml(item.source || 'Feedback')}</strong>
                        <span style="font-size: 12px; color: #64748b;">${escapeHtml(item.date || '')}</span>
                    </div>

                    ${item.question ? `<div style="margin-bottom: 6px; color: #1d4ed8; font-size: 13px; font-weight: 600;">${escapeHtml(item.question)}</div>`: ''}
                    <div style="color: #475569; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(item.text || '')}</div>
                </div>`).join(''): `<div style="padding:20px;color:#64748b;text-align:center;">No feedback found.</div>`;
    };
}

// Analyze feedback into AI Insight Summary (Done by Yu Kang)
let feedbackAnalysisAbortController = null;
let feedbackAnalysisRunId = 0;

async function analyzeFeedbackData() {
     updateAnalysisTitle();

    const resultsContainer = document.getElementById('feedback-analysis-results');
    const output = document.getElementById('feedback-analysis-output');
    const analyzeButton = document.getElementById('analyze-feedback-btn');

    if (!resultsContainer || !output) return;

    if (feedbackAnalysisAbortController) {
        feedbackAnalysisAbortController.abort();
    }

    const runId = ++feedbackAnalysisRunId;
    const controller = new AbortController();
    feedbackAnalysisAbortController = controller;

    resultsContainer.style.display = 'block';
    output.innerHTML = '<div style="padding: 20px; color: #64748b; text-align: center;">Analyzing feedback insights...</div>';
    if (analyzeButton) {
        analyzeButton.disabled = true;
        analyzeButton.dataset.originalText = analyzeButton.dataset.originalText || analyzeButton.textContent;
        analyzeButton.textContent = 'Analyzing...';
    }

    try {
        const analysisMode = document.getElementById('analysis-mode')?.value || 'rule-based';

        const response = await fetch(`/api/admin/feedback-insight-summary?mode=${encodeURIComponent(analysisMode)}`, {
            signal: controller.signal,
            credentials: 'include',
            headers: {
                'x-username': sessionStorage.getItem('loggedUser')
            }
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to analyze feedback');
        }

        const { positive = 0, neutral = 0, negative = 0, total = 0 } = data.sentiment || {};
        const insights = data.insights || {};
        const weeklySummary = insights.weeklySummary || {};
        const analyzedItems = Array.isArray(data.analyzedItems) ? data.analyzedItems : [];

        const totalResponses = total;
        const dominantSentiment = (positive > negative) ? 'positive' : (negative > positive) ? 'negative' : 'neutral';

        // Get the actual top concern/compliment from the arrays
        const topConcern = (insights.topConcerns && insights.topConcerns.length > 0) 
            ? insights.topConcerns[0].label : 'No repeated concern detected';
        const topCompliment = (insights.topCompliments && insights.topCompliments.length > 0) 
            ? insights.topCompliments[0].label : 'No repeated compliment detected';

        const customSummaryText = totalResponses === 0
            ? 'No visitor comments were available for analysis.' : `Overall, ${totalResponses} visitor text response(s) were analyzed. The overall tone is ${dominantSentiment}. The most repeated concern is ${topConcern.toLowerCase()}, while the strongest positive signal is ${topCompliment.toLowerCase()}.`;


        // Extract timeline data (expects data.timeline = array of { date, positive, neutral, negative })
        let timeline = Array.isArray(data.timeline) ? data.timeline : [];
        if (timeline.length === 0 && analyzedItems.length > 0) {
            timeline = buildTimelineFromItems(analyzedItems);
        }
        console.log('📊 Timeline for line chart:', timeline);

        output.innerHTML = `
            <style>
                .btn-range {
                    padding: 4px 12px;
                    border: 1px solid #cbd5e1;
                    border-radius: 4px;
                    background: #fff;
                    cursor: pointer;
                    font-size: 12px;
                    transition: background 0.2s;
                }
                .btn-range.active {
                    background: #3b82f6;
                    color: #fff;
                    border-color: #3b82f6;
                }
                .btn-range:hover:not(.active) {
                    background: #e2e8f0;
                }
            </style>

            <div style="display: grid; grid-template-columns: minmax(280px, 0.9fr) minmax(320px, 1.1fr); gap: 22px; align-items: stretch;">
                <div style="position: relative; height: 300px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                    <canvas id="sentimentChart"></canvas>
                </div>

                <div style="padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h4 style="margin: 0 0 10px; color: #0f172a;">AI Insight Summary</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px;">
                        <button type="button" onclick="openFeedbackInsightsModal('positive')" style="border: 1px solid rgba(16, 185, 129, 0.35); background: rgba(16, 185, 129, 0.12); color: #047857; border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 800; cursor: pointer;">Positive ${positive}</button>
                        <button type="button" onclick="openFeedbackInsightsModal('neutral')" style="border: 1px solid rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.12); color: #92400e; border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 800; cursor: pointer;">Neutral ${neutral}</button>
                        <button type="button" onclick="openFeedbackInsightsModal('negative')" style="border: 1px solid rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.12); color: #991b1b; border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 800; cursor: pointer;">Negative ${negative}</button>
                    </div>
                    <!--<div style=" 
                        display: inline-block;
                        margin-bottom: 12px;
                        padding: 6px 10px;
                        background: #e2e8f0;
                        border-radius: 999px;
                        font-size: 12px;
                        font-weight: 600;
                        color: #334155;
                    ">
                        Analysis Engine: ${escapeHtml((data.mode || 'rule-based').toUpperCase())}
                    </div> -->

                    <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">${escapeHtml(customSummaryText)}</p>
                    <div style="margin-bottom: 15px; font-size: 14px;">
                        <div style="color: #475569; margin-bottom: 12px;"><strong style="color: #10b981;">Positive:</strong> ${positive} (${total > 0 ? ((positive / total) * 100).toFixed(1) : 0}%)</div>
                        <div style="color: #475569; margin-bottom: 12px;"><strong style="color: #f59e0b;">Neutral:</strong> ${neutral} (${total > 0 ? ((neutral / total) * 100).toFixed(1) : 0}%)</div>
                        <div style="color: #475569;"><strong style="color: #ef4444;">Negative:</strong> ${negative} (${total > 0 ? ((negative / total) * 100).toFixed(1) : 0}%)</div>
                    </div>
                    <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 13px; color: #64748b;">
                        <strong>Total text responses analyzed:</strong> ${total}<br>
                        <strong>Window:</strong> All Time<br>
                        <strong>Pledge mentions:</strong> ${Number(weeklySummary.pledgeMentions || 0)}
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 18px;">
                ${renderInsightPanel('Top Concerns', insights.topConcerns || [], '#ef4444', 'No repeated concern detected.')}
                ${renderInsightPanel('Top Compliments', insights.topCompliments || [], '#10b981', 'No repeated compliment detected.')}
                ${renderActionPanel('Suggested Admin Actions', insights.suggestedActions || [])}
            </div>

            <div style="margin-top: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                <h4 id="feedbackDemographicsHeading" style="margin: 0 0 12px;">Feedback Demographics (All Time)</h4>

                <div style="display: flex; gap: 8px; align-items: center;">
                    <label for="timeRangeSelect" style="font-size: 13px; font-weight: 500;">Range:</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span style="font-size: 13px; font-weight: 500;"></span>
                        <div class="btn-group" id="timeRangeButtons" style="display: flex; gap: 4px;">
                            <button class="btn-range" data-range="weekly">Weekly</button>
                            <button class="btn-range" data-range="monthly">Monthly</button>
                            <button class="btn-range" data-range="yearly">Yearly</button>
                            <button class="btn-range active" data-range="all">All Time</button>
                        </div>
                    </div>
                </div>

                <div style="position: relative; height: 250px;">
                    <canvas id="sentimentLineChart"></canvas>
                </div>
            </div>

        `;

        setTimeout(() => {
            createSentimentChart(positive, neutral, negative); 
            window.latestFeedbackInsightItems = analyzedItems;

            // --- Handle range button --- 
            const buttons = document.querySelectorAll('.btn-range');
            const defaultRange = 'all';

            // Function to update chart and active state
            function setRange(range) {
                window.currentTimeRange = range;
                updateLineChartForRange(range);
            }

            buttons.forEach(btn => {
                btn.addEventListener('click', function() {
                    // Remove all active class
                    buttons.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    setRange(this.dataset.range);
                })
            });

            const defaultBtn = document.querySelector(`.btn-range[data-range="all"]`);
            if (defaultBtn) defaultBtn.classList.add('active');
            setRange(defaultRange);
        }, 100);

    } catch (error) {
        if (error.name === 'AbortError') {
            return;
        }

        console.error('Error analyzing feedback insights:', error);
        output.innerHTML = `
            <div style="padding: 20px; color: #ef4444; text-align: center;">
                Error analyzing feedback insights<br>
                <small>${escapeHtml(error.message)}</small>
            </div>
        `;
    } finally {
        if (feedbackAnalysisAbortController === controller) {
            feedbackAnalysisAbortController = null;
        }

        if (analyzeButton && feedbackAnalysisRunId === runId) {
            analyzeButton.disabled = false;
            analyzeButton.textContent = analyzeButton.dataset.originalText || 'Analyze Feedback';
        }
    }
}

// Create sentiment analysis line chart (added by Yu Kang)
function createSentimentLineChart(timelineData) {
    const canvas = document.getElementById('sentimentLineChart');
    if (!canvas) {
        console.warn('Line chart canvas not found');
        return;
    }
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded');
        return;
    }

    // Destroy existing instance
    if (window.sentimentLineChartInstance) {
        window.sentimentLineChartInstance.destroy();
    }

    // If no timeline data, show a placeholder
    if (!timelineData || timelineData.length === 0) {
        const ctx = canvas.getContext('2d');
        window.sentimentLineChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['No data'],
                datasets: [
                    { label: 'Positive', data: [0], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)' },
                    { label: 'Neutral', data: [0], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)' },
                    { label: 'Negative', data: [0], borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
        return;
    }

    // Extract labels (dates) and data series
    const labels = timelineData.map(item => item.date);
    const positiveData = timelineData.map(item => item.positive || 0);
    const neutralData = timelineData.map(item => item.neutral || 0);
    const negativeData = timelineData.map(item => item.negative || 0);

    const ctx = canvas.getContext('2d');
    window.sentimentLineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Positive',
                    data: positiveData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Neutral',
                    data: neutralData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.05)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Negative',
                    data: negativeData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    display: true,
                    title: { display: true, text: 'Date' },
                    ticks: { maxTicksLimit: 15 }
                },
                y: {
                    display: true,
                    title: { display: true, text: 'Count' },
                    beginAtZero: true
                }
            }
        }
    });
}

// Build timeline data from analyzed items if timeline is not provided (Done by Yu Kang)
function buildTimelineFromItems(items) {
    const dateMap = {};

    items.forEach(item => {
        // Use item.date (from backend) or fallback to item.created_at
        const dateStr = item.date || item.created_at || '';
        if (!dateStr) return;

        // Extract date part (YYYY-MM-DD)
        const date = dateStr.split('T')[0] || dateStr.split(' ')[0];
        if (!date) return;

        if (!dateMap[date]) {
            dateMap[date] = { positive: 0, neutral: 0, negative: 0 };
        }

        const sentiment = (item.sentiment || '').toLowerCase();
        if (sentiment === 'positive') dateMap[date].positive += 1;
        else if (sentiment === 'neutral') dateMap[date].neutral += 1;
        else if (sentiment === 'negative') dateMap[date].negative += 1;
    });

    // Convert to array and sort by date
    return Object.entries(dateMap)
        .map(([date, counts]) => ({ date, ...counts }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

// Filter feedback items based on selected time range (Done by Yu Kang)
function filterItemsByRange(items, range) {
    const now = new Date();
    let cutoffDate = new Date(0); // default: all time

    switch (range) {
        case 'weekly':
            cutoffDate = new Date(now);
            cutoffDate.setDate(now.getDate() - 7);
            break;
        case 'monthly':
            cutoffDate = new Date(now);
            cutoffDate.setMonth(now.getMonth() - 1);
            break;
        case 'yearly':
            cutoffDate = new Date(now);
            cutoffDate.setFullYear(now.getFullYear() - 1);
            break;
        case 'all':
        default:
            return items; // no filter
    }

    return items.filter(item => {
        const dateStr = item.date || item.created_at || '';
        if (!dateStr) return false;
        const itemDate = new Date(dateStr);
        return itemDate >= cutoffDate;
    });
}

// Update line chart based on selected time range (Done by Yu Kang)
function updateLineChartForRange(range) {
    const items = window.latestFeedbackInsightItems || [];
    if (items.length === 0) {
        createSentimentLineChart([]);
        return;
    }

    const filteredItems = filterItemsByRange(items, range);
    const timeline = buildTimelineFromItems(filteredItems);
    createSentimentLineChart(timeline);

    // Update the heading to show the current range
    const heading = document.getElementById('feedbackDemographicsHeading');
    if (heading) {
        const rangeLabel = range.charAt(0).toUpperCase() + range.slice(1);
        heading.textContent = `Feedback Demographics (${rangeLabel})`;
    }
}


// Create sentiment analysis doughnut chart (added by Yu Kang)
function createSentimentChart(positive, neutral, negative) {
    const canvas = document.getElementById('sentimentChart');
    if (!canvas) {
        console.error('❌ Sentiment chart canvas not found');
        return;
    }

    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js library is not loaded');
        return;
    }

    const ctx = canvas.getContext('2d');

    positive = Number(positive) || 0;
    neutral = Number(neutral) || 0;
    negative = Number(negative) || 0;

    console.log('📊 Creating chart:', {
        positive,
        neutral,
        negative
    });


    // Destroy existing chart if any
    if (window.sentimentChartInstance) {
        window.sentimentChartInstance.destroy();
    }

    window.sentimentChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Positive', 'Neutral', 'Negative'],
            datasets: [{
                data: [positive, neutral, negative],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: [
                    'rgb(16, 185, 129)',
                    'rgb(245, 158, 11)',
                    'rgb(239, 68, 68)'
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
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const value = context.parsed || 0;
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return context.label + ': ' + value + ' (' + percentage + ')%';
                        }
                    }
                }
            }
        }
    });

    console.log('✅ Sentiment chart created successfully');
}


