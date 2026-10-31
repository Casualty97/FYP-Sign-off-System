// Owner: Role 3, Jun Kai.
// System health page: GET /api/admin/health, one card per check, the tablets table and the server details.
let healthRefreshTimer = null;
let healthLoading = false;

const HEALTH_STATUS_LABEL = { ok: 'Healthy', warn: 'Attention', down: 'Down', unknown: 'Unknown' };
const HEALTH_STATUS_TONE = { ok: 'ok', warn: 'warn', down: 'down', unknown: 'muted' };
const HEALTH_ICON_NAME = { database: 'database', kiosk: 'monitor', disk: 'disk', server: 'server', ollama: 'brain', email: 'mail', tablets: 'tablet', automation: 'clock' };

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
        case 'disk': return [d.path ? `Drive of ${d.path}` : null];
        case 'kiosk': return [d.status ? `Probe: ${d.status}` : null, d.hint];
        case 'email': return [d.sender ? `Sender ${d.sender}` : null, d.error ? `Error: ${d.error}` : null, d.hint];
        case 'server': return [`${d.hostname}, ${d.platform}, Node ${d.node}`, `${d.cpuCount} CPUs, ${d.memoryTotalGb} GB memory, the app uses ${d.processMemoryMb} MB`];
        case 'tablets': return [d.devices && d.devices.length ? `Online means a report in the last ${Math.round((d.onlineWindowSeconds || 180) / 60)} minutes` : 'Tablets report from the feedback page once a minute'];
        case 'automation': return [d.nextStop ? `Next stop ${formatPlannedTime(d.nextStop)}` : null, d.nextStart ? `Next start ${formatPlannedTime(d.nextStart)}` : null, d.wakeTask ? `Wake timer: ${d.wakeTask}` : null];
        default: return [];
    }
}

function renderHealthCard(check) {
    const tone = HEALTH_STATUS_TONE[check.status] || 'muted';
    const lines = healthDetailLines(check).filter(Boolean).map((line) => `<div>${escapeHtmlSafe(line)}</div>`).join('');
    return `
        <div class="health-card health-${check.status}">
            <div class="health-card-top">
                <div class="health-card-icon">${uiIcon(HEALTH_ICON_NAME[check.key] || 'server', 18)}</div>
                <div class="health-card-heading">
                    <div class="health-card-title">${escapeHtmlSafe(check.label)}</div>
                    ${uiPill(tone, HEALTH_STATUS_LABEL[check.status] || check.status)}
                </div>
            </div>
            <div class="health-card-summary">${escapeHtmlSafe(check.summary || '')}${check.cached ? '<span class="health-cached">cached</span>' : ''}</div>
            ${lines ? `<div class="health-card-detail">${lines}</div>` : ''}
        </div>`;
}

function renderHealthTablets(check) {
    const body = document.getElementById('health-tablets');
    if (!body) return;
    const devices = (check && check.detail && check.detail.devices) || [];
    if (!devices.length) {
        body.innerHTML = `<tr><td colspan="5" class="ui-empty">${escapeHtmlSafe(check && check.summary ? check.summary : 'No tablet has reported yet')}</td></tr>`;
        return;
    }
    body.innerHTML = devices.map((d) => {
        const battery = d.battery_level === null || d.battery_level === undefined ? null : Number(d.battery_level);
        const batteryTone = battery === null ? 'muted' : battery <= 20 ? 'low' : battery <= 50 ? 'mid' : 'good';
        const batteryCell = battery === null
            ? '<span class="ui-muted">not reported</span>'
            : `<span class="health-battery"><span class="health-battery-bar health-battery-${batteryTone}" style="display:block;width:${battery}%"></span></span>${battery}%${d.charging ? ', charging' : ''}`;
        const agent = String(d.user_agent || '');
        const kind = /android/i.test(agent) ? 'Android tablet' : /iphone|ipad/i.test(agent) ? 'iOS device' : /windows/i.test(agent) ? 'Windows PC' : 'Browser';
        return `<tr class="${d.online ? '' : 'health-row-offline'}">
                    <td><div class="health-device">${escapeHtmlSafe(d.label || d.device_id)}</div><div class="ui-muted">${kind}</div></td>
                    <td>${escapeHtmlSafe(d.page || '–')}</td>
                    <td>${batteryCell}</td>
                    <td>${d.online ? uiPill('ok', 'Online') : uiPill('muted', healthRelativeTime(d.seconds_ago))}</td>
                    <td class="ui-muted">${escapeHtmlSafe(d.ip || '–')}</td>
                </tr>`;
    }).join('');
}

function renderHealthServer(check) {
    const list = document.getElementById('health-server-details');
    const time = document.getElementById('health-server-time');
    if (!list || !check) return;
    const d = check.detail || {};
    const rows = [
        ['Host', `${d.hostname || '–'} (${d.platform || '–'})`],
        ['Node.js', d.node || '–'],
        ['CPU', `${d.cpuPercent}% of ${d.cpuCount} CPUs`],
        ['Memory', `${d.memoryPercent}% of ${d.memoryTotalGb} GB`],
        ['Application memory', `${d.processMemoryMb} MB`],
        ['Application running for', d.processUptime || '–'],
        ['PC running for', (check.summary || '').replace(/.*up /, '') || '–']
    ];
    list.innerHTML = rows.map(([k, v]) => `<dt>${escapeHtmlSafe(k)}</dt><dd>${escapeHtmlSafe(String(v))}</dd>`).join('');
    if (time) time.textContent = d.localTime ? `Local time ${d.localTime} (${d.timeZone})` : '';
}

function renderHealth(health) {
    const overall = document.getElementById('health-overall');
    const text = document.getElementById('health-summary-text');
    const at = document.getElementById('health-checked-at');
    const cards = document.getElementById('health-cards');
    if (!overall || !cards) return;
    overall.className = `ui-pill ui-pill-${HEALTH_STATUS_TONE[health.overall] || 'muted'}`;
    overall.innerHTML = `<span class="ui-dot"></span>${health.overall === 'ok' ? 'All systems operational' : health.overall === 'warn' ? 'Needs attention' : 'Something is down'}`;
    const parts = [];
    if (health.counts.down) parts.push(`${health.counts.down} down`);
    if (health.counts.warn) parts.push(`${health.counts.warn} need${health.counts.warn === 1 ? 's' : ''} attention`);
    if (health.counts.unknown) parts.push(`${health.counts.unknown} unknown`);
    if (text) text.textContent = parts.length ? `${health.counts.ok} healthy, ${parts.join(', ')}.` : `All ${health.counts.ok} checks healthy.`;
    if (at) at.textContent = `Checked at ${new Date(health.checkedAt).toLocaleTimeString('en-SG', { hour12: false })}`;
    const order = ['database', 'kiosk', 'ollama', 'email', 'disk', 'server', 'automation', 'tablets'];
    cards.innerHTML = [...health.checks].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).map(renderHealthCard).join('');
    renderHealthTablets(health.checks.find((c) => c.key === 'tablets'));
    renderHealthServer(health.checks.find((c) => c.key === 'server'));
}

async function loadHealth(refresh) {
    if (!document.getElementById('health-page') || healthLoading) return;
    healthLoading = true;
    const button = document.getElementById('health-refresh-btn');
    if (button) button.disabled = true;
    try {
        const response = await fetch('/api/admin/health' + (refresh === 'email' ? '?refresh=email' : ''), { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Health checks failed');
        renderHealth(data.health);
    } catch (error) {
        console.error('❌ Error loading health:', error);
        const text = document.getElementById('health-summary-text');
        if (text) text.textContent = `Could not run the checks: ${error.message}`;
    } finally {
        healthLoading = false;
        if (button) button.disabled = false;
    }
}

function startHealthPolling() {
    if (healthRefreshTimer) clearInterval(healthRefreshTimer);
    healthRefreshTimer = setInterval(() => {
        const page = document.getElementById('health-page');
        if (page && page.classList.contains('active') && sessionStorage.getItem('loggedUser')) loadHealth();
    }, 30000);
}
