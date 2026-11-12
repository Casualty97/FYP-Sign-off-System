// Owner: Role 3, Jun Kai.
// System health page: GET /api/admin/health, one card per check, the tablets table and the server details.
// <Jun Kai start>
// Since supervisor meeting 03 (4 Nov 2026) each admin chooses which checks the page shows and runs
// (GET/PUT /api/admin/health/layout). Placeholder cards hold the layout while the checks run, so nothing jumps.
let healthRefreshTimer = null;
let healthLoading = false;
let healthReloadQueued = false;
let healthLayout = null;   // { options: [{ key, label, description }], hidden: [keys] }
let healthLast = null;     // the last answer from GET /api/admin/health
let healthError = null;    // the message of the last failed check run, cleared by the next good one
let healthCardMarkup = []; // the HTML of each card as last drawn, in page order

const HEALTH_STATUS_LABEL = { ok: 'Healthy', warn: 'Attention', down: 'Down', unknown: 'Unknown' };
const HEALTH_STATUS_TONE = { ok: 'ok', warn: 'warn', down: 'down', unknown: 'muted' };
const HEALTH_ICON_NAME = { database: 'database', kiosk: 'monitor', disk: 'disk', server: 'server', ollama: 'brain', email: 'mail', tablets: 'tablet', automation: 'clock' };
const HEALTH_ORDER = ['database', 'kiosk', 'ollama', 'email', 'disk', 'server', 'automation', 'tablets'];
const HEALTH_LABEL = {
    database: 'MySQL database', kiosk: 'Kiosk server (:3003)', ollama: 'Ollama (local LLM)', email: 'Email (SMTP)',
    disk: 'Disk space', server: 'Server PC', automation: 'Schedules', tablets: 'Tablets'
};
// <Jun Kai end>

function healthRelativeTime(secondsAgo) {
    if (secondsAgo === null || secondsAgo === undefined) return '–';
    if (secondsAgo < 90) return `${Math.max(0, Math.round(secondsAgo))} s ago`;
    if (secondsAgo < 3600) return `${Math.round(secondsAgo / 60)} min ago`;
    if (secondsAgo < 86400) return `${Math.round(secondsAgo / 3600)} h ago`;
    return `${Math.round(secondsAgo / 86400)} d ago`;
}

function healthDetailLines(check) {
    const d = check.detail || {};
    switch (check.key) {
        case 'database': return [d.database ? `Database ${d.database} on ${d.host}` : null, d.hint];
        case 'ollama': return [d.models && d.models.length ? `Models: ${d.models.join(', ')}` : null, d.url ? `Endpoint ${d.url}` : null, d.hint];
        // <Jun Kai start>
        // the full folder path is long, so the card names the drive and the path sits in the tooltip
        case 'disk': return [d.path ? { text: `Project drive ${healthDriveName(d.path)}`, title: d.path } : null];
        // <Jun Kai end>
        case 'kiosk': return [d.status ? `Probe: ${d.status}` : null, d.hint];
        case 'email': return [d.sender ? `Sender ${d.sender}` : null, d.error ? `Error: ${d.error}` : null, d.hint];
        // <Jun Kai start>
        // CPU and memory are the summary; the graphs and the forecast live on the Hardware page
        case 'server': return [
            d.uptime ? `PC up ${d.uptime}, app up ${d.processUptime} using ${d.processMemoryMb} MB` : null,
            { link: 'Graphs and forecast on the Hardware page', page: 'hardware' }
        ];
        // <Jun Kai end>
        case 'tablets': return [d.devices && d.devices.length ? `Online means a report in the last ${Math.round((d.onlineWindowSeconds || 180) / 60)} minutes` : 'Tablets report from the feedback page once a minute'];
        case 'automation': return [d.nextStop ? `Next stop ${formatPlannedTime(d.nextStop)}` : null, d.nextStart ? `Next start ${formatPlannedTime(d.nextStart)}` : null];
        default: return [];
    }
}

// <Jun Kai start>
function healthDriveName(path) {
    const drive = /^([A-Za-z]:)[\\/]/.exec(String(path));
    return drive ? drive[1] : String(path);
}

function healthCacheKey() {
    try { return `healthHidden:${sessionStorage.getItem('loggedUser') || ''}`; } catch { return 'healthHidden:'; }
}

// The last choice is kept in this browser only to draw the right placeholders before the server answers
function healthCachedHidden() {
    try {
        const value = JSON.parse(localStorage.getItem(healthCacheKey()) || '[]');
        return Array.isArray(value) ? value.filter((key) => HEALTH_ORDER.includes(key)) : [];
    } catch {
        return [];
    }
}

function healthRememberHidden(hidden) {
    try { localStorage.setItem(healthCacheKey(), JSON.stringify(hidden)); } catch { /* private window: fine */ }
}

const healthHidden = () => (healthLayout ? healthLayout.hidden : healthCachedHidden());
const healthVisibleKeys = () => HEALTH_ORDER.filter((key) => !healthHidden().includes(key));

function renderHealthCard(check) {
    const tone = HEALTH_STATUS_TONE[check.status] || 'muted';
    const lines = healthDetailLines(check).filter(Boolean).map((line) => {
        if (typeof line === 'string') return `<div>${escapeHtmlSafe(line)}</div>`;
        if (line.link) return `<div><button type="button" class="health-card-link" data-page="${escapeHtmlSafe(line.page)}">${escapeHtmlSafe(line.link)}</button></div>`;
        return `<div title="${escapeHtmlSafe(line.title)}">${escapeHtmlSafe(line.text)}</div>`;
    }).join('');
    const label = escapeHtmlSafe(check.label);
    return `
        <div class="health-card health-${check.status}" data-key="${escapeHtmlSafe(check.key)}">
            <div class="health-card-top">
                <div class="health-card-icon">${uiIcon(HEALTH_ICON_NAME[check.key] || 'server', 18)}</div>
                <div class="health-card-heading">
                    <div class="health-card-title">${label}</div>
                    <div class="health-card-side">${uiPill(tone, HEALTH_STATUS_LABEL[check.status] || check.status)}</div>
                </div>
            </div>
            <div class="health-card-summary">${escapeHtmlSafe(check.summary || '')}${check.cached ? '<span class="health-cached">cached</span>' : ''}</div>
            ${lines ? `<div class="health-card-detail">${lines}</div>` : ''}
        </div>`;
}

function renderHealthPlaceholder(key) {
    return `
        <div class="health-card is-skeleton" data-key="${key}" aria-busy="true">
            <div class="health-card-top">
                <div class="health-card-icon">${uiIcon(HEALTH_ICON_NAME[key] || 'server', 18)}</div>
                <div class="health-card-heading">
                    <div class="health-card-title">${escapeHtmlSafe(HEALTH_LABEL[key] || key)}</div>
                    <div class="health-card-side">${uiPill('muted', 'Checking')}</div>
                </div>
            </div>
            <span class="health-skel" style="width: 64%"></span>
            <span class="health-skel" style="width: 42%"></span>
        </div>`;
}

// Cards for the checks this admin shows: the last result when there is one, a placeholder otherwise.
// Checks are hidden and shown again under Customise only (the cards have no cross since 9 Nov 2026).
function renderHealthCards() {
    const cards = document.getElementById('health-cards');
    if (!cards) return;
    bindHealthControls();
    const visible = healthVisibleKeys();
    if (!visible.length) {
        cards.innerHTML = '<div class="health-empty">Nothing is monitored on this page.<br><button type="button" class="ui-btn ui-btn-secondary" onclick="showAllHealthOptions()">Show all</button></div>';
    } else {
        const byKey = new Map(((healthLast && healthLast.checks) || []).map((check) => [check.key, check]));
        const markup = visible.map((key) => (byKey.has(key) ? renderHealthCard(byKey.get(key)) : renderHealthPlaceholder(key)).trim());
        // the 30-second refresh swaps only the cards whose text changed, so hover and the rest of the grid stay still
        const sameCards = [...cards.children].map((el) => el.dataset.key).join(',') === visible.join(',');
        if (sameCards) {
            markup.forEach((html, i) => { if (healthCardMarkup[i] !== html) cards.children[i].outerHTML = html; });
        } else {
            cards.innerHTML = markup.join('');
        }
        healthCardMarkup = markup;
    }
}

// The Tablets list is the one panel under the cards; it follows the Tablets check in Customise
function renderHealthPanels() {
    const showTablets = healthVisibleKeys().includes('tablets');
    const tablets = document.getElementById('health-tablets-card');
    if (tablets) tablets.hidden = !showTablets;
    const tabletCheck = ((healthLast && healthLast.checks) || []).find((c) => c.key === 'tablets');
    if (showTablets && tabletCheck) renderHealthTablets(tabletCheck);
}

// The top pill counts only the checks on the page
function renderHealthSummary() {
    const overall = document.getElementById('health-overall');
    const text = document.getElementById('health-summary-text');
    const at = document.getElementById('health-checked-at');
    if (!overall) return;
    const visible = healthVisibleKeys();
    if (!visible.length) {
        overall.className = 'ui-pill ui-pill-muted';
        overall.innerHTML = '<span class="ui-dot"></span>Nothing selected';
        if (text) text.textContent = 'Open Customise to choose what this page monitors.';
        if (at) at.textContent = '';
        return;
    }
    if (healthError) {
        overall.className = 'ui-pill ui-pill-down';
        overall.innerHTML = '<span class="ui-dot"></span>Checks unavailable';
        if (text) text.textContent = `Could not run the checks: ${healthError}`;
        return;
    }
    if (!healthLast) return;
    const checks = healthLast.checks.filter((check) => visible.includes(check.key));
    const counts = { ok: 0, warn: 0, down: 0, unknown: 0 };
    for (const check of checks) counts[check.status] = (counts[check.status] || 0) + 1;
    const state = counts.down ? 'down' : counts.warn ? 'warn' : 'ok';
    overall.className = `ui-pill ui-pill-${HEALTH_STATUS_TONE[state]}`;
    overall.innerHTML = `<span class="ui-dot"></span>${state === 'ok' ? 'All systems operational' : state === 'warn' ? 'Needs attention' : 'Something is down'}`;
    const parts = [];
    if (counts.down) parts.push(`${counts.down} down`);
    if (counts.warn) parts.push(`${counts.warn} need${counts.warn === 1 ? 's' : ''} attention`);
    if (counts.unknown) parts.push(`${counts.unknown} unknown`);
    if (text) text.textContent = parts.length ? `${counts.ok} healthy, ${parts.join(', ')}.` : `All ${counts.ok} checks healthy.`;
    if (at) at.textContent = `Checked at ${new Date(healthLast.checkedAt).toLocaleTimeString('en-SG', { hour12: false })}`;
}
// <Jun Kai end>

// <Jun Kai start>
let healthRenaming = null; // the tablet whose name is being typed
let healthRenameError = '';
const HEALTH_NAME_ORDER = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function healthTabletCheck() {
    return ((healthLast && healthLast.checks) || []).find((c) => c.key === 'tablets') || null;
}

// same order as the server: named tablets first in number order, the rest as they came
function healthSortDevices(devices) {
    return devices.slice().sort((a, b) => {
        if (!a.name || !b.name) return (a.name ? 0 : 1) - (b.name ? 0 : 1);
        return HEALTH_NAME_ORDER.compare(a.name, b.name);
    });
}

function healthDeviceCell(d) {
    const agent = String(d.user_agent || '');
    const kind = /android/i.test(agent) ? 'Android tablet' : /iphone|ipad/i.test(agent) ? 'iOS device' : /windows/i.test(agent) ? 'Windows PC' : 'Browser';
    const deviceName = d.label || d.device_id;
    const id = escapeHtmlSafe(d.device_id);
    if (healthRenaming === d.device_id) {
        return `<form class="health-rename" data-device="${id}" novalidate>
                    <input class="ui-input" type="text" maxlength="40" autocomplete="off" value="${escapeHtmlSafe(d.name || '')}" placeholder="${escapeHtmlSafe(deviceName)}" aria-label="Name for ${escapeHtmlSafe(deviceName)}" aria-describedby="health-rename-help"${healthRenameError ? ' aria-invalid="true"' : ''}>
                    <div class="ui-help${healthRenameError ? ' is-error' : ''}" id="health-rename-help"${healthRenameError ? ' role="alert"' : ''}>${escapeHtmlSafe(healthRenameError || 'A name or a number. Leave it empty to use the device name.')}</div>
                    <button type="submit" class="ui-btn ui-btn-primary">Save</button>
                    <button type="button" class="ui-btn ui-btn-secondary" data-rename-cancel>Cancel</button>
                </form>`;
    }
    const shown = d.name || deviceName;
    return `<div class="health-device-cell">
                <div class="health-device-text">
                    <div class="health-device">${escapeHtmlSafe(shown)}</div>
                    <div class="ui-muted">${d.name ? `<span class="health-nowrap">${escapeHtmlSafe(deviceName)}</span> · ` : ''}<span class="health-nowrap">${escapeHtmlSafe(kind)}</span></div>
                </div>
                <button type="button" class="ui-btn ui-btn-icon health-rename-btn" data-rename="${id}" aria-label="Rename ${escapeHtmlSafe(shown)}" title="Rename">${uiIcon('edit', 15)}</button>
            </div>`;
}

function renderHealthTablets(check, force) {
    const body = document.getElementById('health-tablets');
    if (!body) return;
    bindHealthTablets();
    // the 30-second refresh must not wipe a name that is being typed; the table catches up when it closes
    if (!force && healthRenaming && body.querySelector('.health-rename')) return;
    const devices = (check && check.detail && check.detail.devices) || [];
    if (!devices.length) {
        body.innerHTML = `<tr><td colspan="4" class="ui-empty">${escapeHtmlSafe(check && check.summary ? check.summary : 'No tablet has reported yet')}</td></tr>`;
        return;
    }
    body.innerHTML = devices.map((d) => `<tr class="${d.online ? '' : 'health-row-offline'}">
                    <td>${healthDeviceCell(d)}</td>
                    <td>${escapeHtmlSafe(d.page || '–')}</td>
                    <td>${d.online ? uiPill('ok', 'Online') : `${uiPill('muted', 'Offline')}<div class="ui-muted health-ago">${escapeHtmlSafe(healthRelativeTime(d.seconds_ago))}</div>`}</td>
                    <td class="ui-muted">${escapeHtmlSafe(d.ip || '–')}</td>
                </tr>`).join('');
}

function bindHealthTablets() {
    const body = document.getElementById('health-tablets');
    if (!body || body.dataset.bound) return;
    body.dataset.bound = '1';
    body.addEventListener('click', (event) => {
        const open = event.target.closest('[data-rename]');
        if (open) startHealthRename(open.dataset.rename);
        else if (event.target.closest('[data-rename-cancel]')) stopHealthRename();
    });
    body.addEventListener('submit', (event) => {
        const form = event.target.closest('.health-rename');
        if (!form) return;
        event.preventDefault();
        saveHealthRename(form);
    });
    body.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && event.target.closest('.health-rename')) {
            event.preventDefault();
            stopHealthRename();
        }
    });
}

function startHealthRename(deviceId) {
    healthRenaming = deviceId;
    healthRenameError = '';
    renderHealthTablets(healthTabletCheck(), true);
    const input = document.querySelector('#health-tablets .health-rename input');
    if (input) {
        input.focus();
        input.select();
    }
}

function stopHealthRename() {
    const deviceId = healthRenaming;
    healthRenaming = null;
    healthRenameError = '';
    renderHealthTablets(healthTabletCheck(), true);
    const button = deviceId && document.querySelector(`#health-tablets [data-rename="${deviceId}"]`);
    if (button) button.focus();
}

async function saveHealthRename(form) {
    const deviceId = form.dataset.device;
    const typed = form.querySelector('input').value;
    form.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
        const response = await fetch(`/api/admin/health/tablets/${encodeURIComponent(deviceId)}/name`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: typed })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Could not save the name');
        const check = healthTabletCheck();
        const devices = (check && check.detail && check.detail.devices) || [];
        const device = devices.find((d) => d.device_id === deviceId);
        if (device) {
            device.name = data.name;
            check.detail.devices = healthSortDevices(devices);
        }
        showNotification(data.name ? `Tablet renamed to "${data.name}"` : 'The tablet shows its device name again', 'success');
        stopHealthRename();
    } catch (error) {
        healthRenameError = error.message;
        renderHealthTablets(healthTabletCheck(), true);
        const input = document.querySelector('#health-tablets .health-rename input');
        if (input) {
            input.value = typed;
            input.focus();
            input.select();
        }
    }
}
// <Jun Kai end>

// <Jun Kai start>
function renderHealth(health) {
    healthLast = health;
    healthError = null;
    // another tab or admin session may have changed the saved choice: the server's list wins
    if (Array.isArray(health.hidden) && healthLayout && health.hidden.join(',') !== healthLayout.hidden.join(',')) {
        healthLayout.hidden = HEALTH_ORDER.filter((key) => health.hidden.includes(key));
        healthRememberHidden(healthLayout.hidden);
        renderHealthOptions();
    }
    renderHealthCards();
    renderHealthPanels();
    renderHealthSummary();
}

async function loadHealthLayout() {
    try {
        const response = await fetch('/api/admin/health/layout', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Could not load the monitoring options');
        healthLayout = { options: data.options, hidden: data.hidden || [] };
        healthRememberHidden(healthLayout.hidden);
    } catch (error) {
        console.error('❌ Could not load the health layout:', error);
        healthLayout = { options: HEALTH_ORDER.map((key) => ({ key, label: HEALTH_LABEL[key], description: '' })), hidden: healthCachedHidden() };
    }
    renderHealthOptions();
}

async function loadHealth(refresh) {
    if (!document.getElementById('health-page')) return;
    if (healthLoading) {
        healthReloadQueued = true;
        return;
    }
    healthLoading = true;
    const button = document.getElementById('health-refresh-btn');
    if (button) button.disabled = true;
    try {
        if (!healthLast) {
            renderHealthCards();
            renderHealthPanels();
        }
        if (!healthLayout) {
            const before = healthHidden().join(',');
            await loadHealthLayout();
            if (!healthLast && healthHidden().join(',') !== before) {
                renderHealthCards();
                renderHealthPanels();
            }
        }
        if (!healthVisibleKeys().length) {
            renderHealthSummary();
            return;
        }
        const response = await fetch('/api/admin/health' + (refresh === 'email' ? '?refresh=email' : ''), { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Health checks failed');
        renderHealth(data.health);
    } catch (error) {
        console.error('❌ Error loading health:', error);
        healthError = error.message;
        const text = document.getElementById('health-summary-text');
        if (text) text.textContent = `Could not run the checks: ${error.message}`;
        const overall = document.getElementById('health-overall');
        if (overall) { overall.className = 'ui-pill ui-pill-down'; overall.innerHTML = '<span class="ui-dot"></span>Checks unavailable'; }
        const at = document.getElementById('health-checked-at');
        if (at && at.textContent.startsWith('Checked at')) at.textContent = at.textContent.replace('Checked at', 'Cards show the last good check at');
    } finally {
        healthLoading = false;
        if (button) button.disabled = false;
        if (healthReloadQueued) {
            healthReloadQueued = false;
            loadHealth();
        }
    }
}

// Customise: which checks this admin keeps on the page
function toggleHealthCustomise(force) {
    const panel = document.getElementById('health-customise');
    const button = document.getElementById('health-customise-btn');
    if (!panel) return;
    const open = typeof force === 'boolean' ? force : panel.hidden;
    const hadFocus = panel.contains(document.activeElement);
    panel.hidden = !open;
    if (button) button.setAttribute('aria-expanded', String(open));
    if (open) renderHealthOptions();
    else if (hadFocus && button) button.focus();
}

function renderHealthOptions() {
    const hidden = healthHidden();
    const count = document.getElementById('health-hidden-count');
    if (count) {
        count.hidden = !hidden.length;
        count.textContent = `${hidden.length} hidden`;
    }
    const box = document.getElementById('health-options');
    if (!box || !healthLayout) return;
    bindHealthControls();
    // already drawn: update the switches in place, so a keyboard user keeps focus on the one they changed
    const drawn = [...box.querySelectorAll('input[data-key]')];
    if (drawn.length === healthLayout.options.length && drawn.every((input, i) => input.dataset.key === healthLayout.options[i].key)) {
        drawn.forEach((input) => {
            const on = !hidden.includes(input.dataset.key);
            input.checked = on;
            input.closest('.health-option').classList.toggle('is-off', !on);
        });
        return;
    }
    box.innerHTML = healthLayout.options.map((option) => {
        const on = !hidden.includes(option.key);
        const label = escapeHtmlSafe(option.label);
        return `<label class="health-option${on ? '' : ' is-off'}">
                    <span class="health-option-icon">${uiIcon(HEALTH_ICON_NAME[option.key] || 'server', 16)}</span>
                    <span class="health-option-text"><strong>${label}</strong><small>${escapeHtmlSafe(option.description || '')}</small></span>
                    <span class="ui-switch"><input type="checkbox" data-key="${escapeHtmlSafe(option.key)}" ${on ? 'checked' : ''} aria-label="Show ${label}"><span class="ui-switch-track"></span></span>
                </label>`;
    }).join('');
}

function bindHealthControls() {
    const cards = document.getElementById('health-cards');
    if (cards && !cards.dataset.bound) {
        cards.dataset.bound = '1';
        cards.addEventListener('click', (event) => {
            const link = event.target.closest('[data-page]');
            if (link) showPage(link.dataset.page);
        });
    }
    const panel = document.getElementById('health-customise');
    if (panel && !panel.dataset.bound) {
        panel.dataset.bound = '1';
        panel.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') toggleHealthCustomise(false);
        });
    }
    const options = document.getElementById('health-options');
    if (options && !options.dataset.bound) {
        options.dataset.bound = '1';
        options.addEventListener('change', (event) => {
            const box = event.target.closest('input[data-key]');
            if (box) setHealthOption(box.dataset.key, box.checked);
        });
    }
}

function setHealthOption(key, show) {
    const hidden = healthHidden().filter((k) => k !== key);
    if (!show) hidden.push(key);
    saveHealthHidden(hidden);
}

function showAllHealthOptions() {
    saveHealthHidden([]);
}

async function saveHealthHidden(hidden) {
    const previous = healthHidden().slice();
    if (!healthLayout) healthLayout = { options: HEALTH_ORDER.map((key) => ({ key, label: HEALTH_LABEL[key], description: '' })), hidden: previous };
    healthLayout.hidden = HEALTH_ORDER.filter((key) => hidden.includes(key));
    healthRememberHidden(healthLayout.hidden);
    renderHealthCards();
    renderHealthPanels();
    renderHealthSummary();
    renderHealthOptions();
    try {
        const response = await fetch('/api/admin/health/layout', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hidden: healthLayout.hidden })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Could not save your choice');
        // checks that were switched off did not run, so fetch them now
        if (previous.some((key) => !healthLayout.hidden.includes(key))) loadHealth();
    } catch (error) {
        console.error('❌ Could not save the health layout:', error);
        showNotification(error.message, 'error');
        // show what the server really kept (another save may have gone through in between)
        healthLayout = null;
        await loadHealthLayout();
        renderHealthCards();
        renderHealthPanels();
        renderHealthSummary();
    }
}
// <Jun Kai end>

function startHealthPolling() {
    if (healthRefreshTimer) clearInterval(healthRefreshTimer);
    healthRefreshTimer = setInterval(() => {
        const page = document.getElementById('health-page');
        if (page && page.classList.contains('active') && sessionStorage.getItem('loggedUser')) loadHealth();
    }, 30000);
}
