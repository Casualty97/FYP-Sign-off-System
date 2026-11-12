// Owner: Role 3, Jun Kai.
// Incidents panel on the System Health page: the incidents the anomaly detection opened, as a numbered list (needs a
// look, being handled, resolved this week) beside the chosen incident's story: what happened, why it might be and what
// to do, with the fix the app can run once a System Admin approves it, then "Was this right?" and its history. The
// settings open in a drawer; a fix asks once more in a dialog. Loaded after health.js: loadHealth() and
// renderHealthPanels() call loadIncidents(), so it refreshes with the 30-second cycle. Every part is patched in place,
// so the selection, the focus, an open history and the scroll position survive the refresh.
// <Jun Kai start>
let incidentsStatus = null;          // the last answer of GET /status
let incidentsList = [];              // the last answer of GET /incidents?status=all
let incidentsError = null;           // message of the last failed load, cleared by the next good one
let incidentsLoading = false;
let incidentsReloadQueued = false;
let incidentsLoadedAt = 0;
let incidentsSelected = null;        // id of the incident in the detail panel (a string), or null
let incidentsShowAllResolved = false;
let incidentsAdvisorOn = true;
let incidentsAdviceTimer = null;     // refreshes every 5 s while an advice is being prepared
let incidentsFixTimer = null;        // refreshes every 4 s while a fix is starting
let incidentsSettingsBusy = false;
let incidentsSettingsData = null;    // the last answer of GET /settings, for the drawer
let incidentsDrawerDirty = false;
let incidentsApproveFor = null;      // { id, fix, example } waiting in the approve dialog
const incidentsJson = new Map();     // id -> the list entry as last loaded; a change reloads its story
const incidentsDetail = new Map();   // id -> { data } or { error } from GET /incidents/:id
const incidentsDetailStale = new Set();
const incidentsDetailLoading = new Set();
const incidentsHistoryOpen = new Set();
const incidentsTimelineFull = new Set();
const incidentsBusiest = new Map();  // 'cpu' | 'memory' -> { at, list } | { at, error } | { loading }
const incidentsBusiestFor = new Set(); // incidents whose busiest list was asked for since they were chosen
const incidentsZones = new Map();    // zone -> its HTML as last drawn
const incidentsDrawn = new WeakMap(); // element -> its HTML as last drawn

const INCIDENT_SEVERITY = { critical: { tone: 'down', label: 'Critical' }, warn: { tone: 'warn', label: 'Attention' }, info: { tone: 'info', label: 'Info' } };
const INCIDENT_VERDICT_LABEL = { correct: 'Correct', 'not-useful': 'Not useful', 'false-alarm': 'False alarm' };
const INCIDENT_DETECTOR_LABEL = {
    spike: 'Sudden spikes', timeOfDay: 'Unusual for the time of day', drift: 'Slow creep', disk: 'Disk filling up',
    services: 'Services down or slow', tablets: 'Named tablets offline', logs: 'Server errors', test: 'Test'
};
const INCIDENT_LIKELY = { high: 'Most likely', medium: 'Possible', low: 'Less likely' };
const INCIDENT_SENSITIVITY = ['Very low', 'Low', 'Normal', 'High', 'Very high'];
const INCIDENT_METRIC_LABEL = { cpu: 'CPU', memory: 'Memory', gpu: 'GPU', disk: 'Disk' };
const INCIDENT_SERVICE_LABEL = { kiosk: 'Kiosk server', database: 'Database', email: 'Mail login' };
const INCIDENT_PROCESS_LABEL = { server: 'the admin server', kiosk: 'the kiosk server' };
const INCIDENT_VALUE_LABEL = { seconds_ago: 'Offline for', template: 'Times seen', errors: 'Errors', disk: 'Used', database_latency: 'Answer time' };
const INCIDENT_FIX_DONE = { 'start-kiosk': 'start the kiosk server' };
const INCIDENT_MODE_SHORT = { ask: 'Ask first', delayed: 'Auto after 5 min', auto: 'Automatic' };
const INCIDENT_MODE_SENTENCE = {
    ask: 'Waits for a System Admin to press Approve on the incident.',
    delayed: 'Waits for an approval. If nobody approves within 5 minutes of the incident opening, it runs by itself. Acknowledge stops the countdown.',
    auto: 'Runs by itself as soon as the incident opens, at most once every 10 minutes, and never while the policies keep the kiosk off.'
};
const INCIDENT_RANK = { critical: 0, warn: 1, info: 2 };
const INCIDENT_FIELD_ID = { enabled: 'incidents-enabled', learnFromVerdicts: 'incidents-learn', offerFixes: 'incidents-offer-fixes', quietHours: 'incidents-quiet', intervalSeconds: 'incidents-interval', retentionDays: 'incidents-retention', keepIncidentsDays: 'incidents-keep' };
const INCIDENT_FRESH_MS = 5000;      // a load this recent is not repeated (health.js asks more than once per cycle)
const INCIDENT_WEEK_MS = 7 * 24 * 3600 * 1000;
const INCIDENT_RESOLVED_CAP = 5;
const INCIDENT_TIMELINE_FOLD = 8;    // a longer history shows its first 2 and last 4 entries until it is opened
const INCIDENT_BUSIEST_FRESH_MS = 60 * 1000;
const INCIDENT_NARROW = '(max-width: 960px)';
const INCIDENT_CHEVRON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';
const INCIDENT_WRENCH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>';
const INCIDENT_CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const INCIDENT_ALERT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

const incidentIsNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const incidentIsOpen = (incident) => incident.status === 'open' || incident.status === 'acknowledged';
const incidentMs = (iso) => { const t = new Date(iso || '').getTime(); return Number.isNaN(t) ? null : t; };
const incidentDetectorOn = (d) => d.enabled !== false && d.state !== 'off';
const incidentFind = (id) => incidentsList.find((i) => String(i.id) === String(id)) || null;
const incidentsNarrow = window.matchMedia ? window.matchMedia(INCIDENT_NARROW) : null;

// ---- words and numbers ----

// Server log lines quoted in an incident keep their words but not the emoji some old console messages carry
function incidentText(text) {
    return String(text === null || text === undefined ? '' : text).replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*/gu, '').replace(/ {2,}/g, ' ').trim();
}

function incidentWords(key) {
    const words = String(key || '').replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim().toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function incidentJoin(parts) {
    if (parts.length < 2) return parts.join('');
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function incidentNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString('en-SG');
}

function incidentWithUnit(value, unit) {
    const text = incidentNumber(value);
    return text && unit ? `${text} ${unit}` : text;
}

function incidentDuration(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    const unit = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    if (s < 90) return unit(Math.round(s), 'second');
    if (s < 5400) return unit(Math.round(s / 60), 'minute');
    if (s < 172800) return unit(Math.round(s / 3600), 'hour');
    return unit(Math.round(s / 86400), 'day');
}

// "45 s", "5 min", "9 h", "6 days"
function incidentShort(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    if (s < 90) return `${Math.round(s)} s`;
    if (s < 5400) return `${Math.round(s / 60)} min`;
    if (s < 172800) return `${Math.round(s / 3600)} h`;
    const d = Math.round(s / 86400);
    return `${d} day${d === 1 ? '' : 's'}`;
}

function incidentSpan(hours) {
    const h = Number(hours) || 0;
    if (h < 1) return 'under an hour';
    if (h < 48) return `${Math.round(h)} h`;
    return `${Math.round(h / 24)} days`;
}

function incidentMb(mb) {
    const n = Number(mb) || 0;
    return n >= 1024 ? `${(n / 1024).toFixed(1)} GB` : `${Math.round(n)} MB`;
}

function incidentClock(iso) {
    const t = incidentMs(iso);
    return t === null ? '–' : new Date(t).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// "14:02" today, "Mon 09:10" this week, "3 Nov 09:10" before that
function incidentWhen(iso, nowMs = Date.now()) {
    const t = incidentMs(iso);
    if (t === null) return '–';
    const date = new Date(t);
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((startOfDay(new Date(nowMs)) - startOfDay(date)) / 86400000);
    const time = incidentClock(iso);
    if (days === 0) return time;
    if (days > 0 && days < 7) return `${date.toLocaleDateString('en-SG', { weekday: 'short' })} ${time}`;
    return `${date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })} ${time}`;
}

function incidentStamp(iso) {
    const t = incidentMs(iso);
    return t === null ? '–' : `${new Date(t).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })} ${incidentClock(iso)}`;
}

// how long an open incident has been going: "just now", "25 min", "3 h", "2 days"
function incidentAge(iso, nowMs) {
    const t = incidentMs(iso);
    if (t === null) return '';
    const s = Math.max(0, (nowMs - t) / 1000);
    return s < 90 ? 'just now' : incidentShort(s);
}

// "5 min ago", "3 h ago", "yesterday", "4 days ago"
function incidentAgoText(iso, nowMs) {
    const t = incidentMs(iso);
    if (t === null) return '';
    const s = Math.max(0, (nowMs - t) / 1000);
    if (s < 90) return 'just now';
    if (s < 5400) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const startOfDay = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
    const days = Math.round((startOfDay(nowMs) - startOfDay(t)) / 86400000);
    return days <= 1 ? 'yesterday' : `${days} days ago`;
}

function incidentDetectorLabel(key) {
    const known = ((incidentsStatus && incidentsStatus.detectors) || []).find((d) => d.key === key);
    return (known && known.label) || INCIDENT_DETECTOR_LABEL[key] || incidentWords(key || 'detector');
}

function incidentsIsAdmin() {
    try { return sessionStorage.getItem('userRole') === 'system_admin'; } catch { return false; }
}

function incidentsUsername() {
    try { return sessionStorage.getItem('loggedUser') || 'you'; } catch { return 'you'; }
}

// GET by default; options make it a JSON request. Throws an Error with .status (and .field on a 400 from PUT /settings).
async function incidentsFetch(url, options) {
    const request = options ? { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } } : { cache: 'no-store' };
    const response = await fetch(url, request);
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok || !data || !data.success) {
        const error = new Error((data && data.error) || `Request failed (${response.status})`);
        error.status = response.status;
        if (data && data.field) error.field = data.field;
        throw error;
    }
    return data;
}

// Puts html into the element only when it changed, so a refresh leaves focus and hover alone
function incidentsPut(el, html) {
    if (!el || incidentsDrawn.get(el) === html) return;
    incidentsDrawn.set(el, html);
    el.innerHTML = html;
}

// ---- header chips, summary line, notes ----

function incidentsStateFor(status, incidents, error) {
    if (error) return { tone: 'down', text: 'Unavailable' };
    if (!status) return { tone: 'muted', text: 'Loading' };
    if (status.enabled === false) return { tone: 'muted', text: 'Detection off' };
    // "Learning" only while no detector is looking yet; one or two still learning is normal for days
    const states = (status.detectors || []).filter(incidentDetectorOn).map((d) => d.state);
    if (states.length && !states.includes('ok')) return { tone: 'info', text: states.includes('waiting') ? 'Starting' : 'Learning' };
    return { tone: 'ok', text: 'All clear' };
}

function renderIncidentsChips() {
    const open = incidentsList.filter((i) => i.status === 'open');
    const handled = incidentsList.filter((i) => i.status === 'acknowledged');
    let html = '';
    if (!incidentsError && incidentsStatus && (open.length || handled.length)) {
        if (open.length) html += `<span class="inc-chip is-${open.some((i) => i.severity === 'critical') ? 'down' : 'warn'}">${open.length} need${open.length === 1 ? 's' : ''} a look</span>`;
        if (handled.length) html += `<span class="inc-chip is-muted">${handled.length} being handled</span>`;
    } else {
        const state = incidentsStateFor(incidentsStatus, incidentsList, incidentsError);
        html = uiPill(state.tone, state.text);
    }
    incidentsPut(document.getElementById('incidents-chips'), html);
}

function incidentsSummaryText(status) {
    const detectors = Array.isArray(status.detectors) ? status.detectors : [];
    const count = (state) => detectors.filter((d) => d.state === state).length;
    const parts = [status.lastTickAt ? `Last check ${incidentClock(status.lastTickAt)}` : 'No check yet'];
    if (detectors.length) parts.push(`${detectors.filter(incidentDetectorOn).length} of ${detectors.length} detectors on`);
    const every = Number(status.intervalSeconds);
    if (every) parts.push(`checked every ${every === 60 ? 'minute' : every % 60 === 0 ? `${every / 60} minutes` : `${every} s`}`);
    const learning = count('learning');
    const noData = count('no-data');
    if (learning) parts.push(`${learning} still learning`);
    if (noData) parts.push(`${noData} waiting for data`);
    if (count('muted')) parts.push(`${count('muted')} paused`);
    if (count('error')) parts.push(`${count('error')} failed`);
    const tuned = detectors.filter((d) => d.tuned).length;
    if (tuned) parts.push(`${tuned} tuned by your answers`);
    // how much history the learning detectors have so far
    const data = status.data || {};
    if (learning || noData) {
        const spans = [];
        if (incidentIsNumber(data.sampleHours)) spans.push(`${incidentSpan(data.sampleHours)} of samples`);
        if (incidentIsNumber(data.healthRuns)) spans.push(`${data.healthRuns} health run${data.healthRuns === 1 ? '' : 's'}`);
        if (incidentIsNumber(data.logHours)) spans.push(`${incidentSpan(data.logHours)} of logs`);
        if (spans.length) parts.push(spans.join(', '));
    }
    if (status.quietNow) parts.push('quiet hours (the policies say the kiosk is off)');
    return parts.join(' · ');
}

function renderIncidentsSummary() {
    incidentsPut(document.getElementById('incidents-summary'), incidentsStatus && !incidentsError ? escapeHtmlSafe(incidentsSummaryText(incidentsStatus)) : '');
    let note = '';
    if (incidentsError) note = `<div class="ui-note ui-note-warn">Could not reach the anomaly detection: ${escapeHtmlSafe(incidentsError)}</div>`;
    else if (incidentsStatus && incidentsStatus.enabled === false) note = '<div class="ui-note">Anomaly detection is off: nothing is compared and no incident is opened. <button type="button" class="health-card-link" data-act="settings">Open Settings</button> to switch it on.</div>';
    else if (incidentsStatus && incidentsStatus.lastError) note = `<div class="ui-note ui-note-warn">The last check did not finish: ${escapeHtmlSafe(incidentsStatus.lastError)}</div>`;
    incidentsPut(document.getElementById('incidents-note'), note);
}

// How many tablets have a name: from the detector status, else the Tablets check on this page
function incidentsNamedTablets(status) {
    if (status.data && incidentIsNumber(status.data.namedTablets)) return status.data.namedTablets;
    const check = typeof healthTabletCheck === 'function' ? healthTabletCheck() : null;
    const devices = check && check.detail && Array.isArray(check.detail.devices) ? check.detail.devices : null;
    return devices ? devices.filter((d) => d.name).length : null;
}

function incidentsWatchingText(status, namedTablets) {
    const on = new Set((status.detectors || []).filter(incidentDetectorOn).map((d) => d.key));
    const parts = [];
    const hardware = ['spike', 'timeOfDay', 'drift'].some((key) => on.has(key));
    if (hardware && on.has('disk')) parts.push('CPU, memory, GPU and disk');
    else if (hardware) parts.push('CPU, memory and GPU');
    else if (on.has('disk')) parts.push('disk');
    if (on.has('services')) parts.push('3 services');
    if (on.has('tablets')) {
        if (namedTablets === 0) parts.push('no named tablet yet (name one in the Tablets panel to watch it)');
        else if (namedTablets === null || namedTablets === undefined) parts.push('the named tablets');
        else parts.push(`${namedTablets} named tablet${namedTablets === 1 ? '' : 's'}`);
    }
    if (on.has('logs')) parts.push('the server logs');
    if (!parts.length) return 'Every detector is switched off. Open Settings to choose what to watch.';
    return `Watching ${incidentJoin(parts)}.`;
}

// ---- the list ----

// Critical first, then attention, then info; newest first. The order never depends on when an incident was last
// seen, so the rows stay where they are between refreshes.
function incidentOrder(a, b) {
    const rank = (i) => (INCIDENT_RANK[i.severity] === undefined ? 1 : INCIDENT_RANK[i.severity]);
    return rank(a) - rank(b) || (incidentMs(b.opened_at) || 0) - (incidentMs(a.opened_at) || 0) || Number(b.id) - Number(a.id);
}

function incidentsGroups(nowMs) {
    const open = incidentsList.filter((i) => i.status === 'open').sort(incidentOrder);
    const handled = incidentsList.filter((i) => i.status === 'acknowledged').sort(incidentOrder);
    const resolvedAll = incidentsList.filter((i) => i.status === 'resolved' && (incidentMs(i.resolved_at) || 0) >= nowMs - INCIDENT_WEEK_MS)
        .sort((a, b) => (incidentMs(b.resolved_at) || 0) - (incidentMs(a.resolved_at) || 0) || Number(b.id) - Number(a.id));
    const resolved = incidentsShowAllResolved ? resolvedAll : resolvedAll.slice(0, INCIDENT_RESOLVED_CAP);
    // the chosen incident stays in the list even past the first five
    if (incidentsSelected && !resolved.some((i) => String(i.id) === incidentsSelected)) {
        const chosen = resolvedAll.find((i) => String(i.id) === incidentsSelected);
        if (chosen) resolved.push(chosen);
    }
    return { open, handled, resolved, resolvedTotal: resolvedAll.length };
}

// "Fixed by an approved start" when a fix worked before it closed
function incidentResolvedHow(incident) {
    const run = incident.fixRun;
    if (run && run.ok) return run.automatic ? 'Fixed by an automatic start' : 'Fixed by an approved start';
    return incidentDetectorLabel(incident.detector);
}

function incidentFixTag(incident, nowMs) {
    const fix = incident.fix;
    if (!fix) return '';
    switch (fix.state) {
        case 'running': return '<span class="inc-tag-fix">Starting</span>';
        case 'started':
            // an example or a dry run only recorded the approval
            if (incident.example || fix.dryRun) return `<span class="inc-tag-ok">Approved ${escapeHtmlSafe(incidentAgoText(fix.at, nowMs))}</span>`;
            return `<span class="inc-tag-ok">Started ${escapeHtmlSafe(incidentAgoText(fix.at, nowMs))}</span>`;
        case 'failed': return '<span class="inc-tag-bad">Fix did not work</span>';
        default: return '<span class="inc-tag-fix">Fix available</span>';
    }
}

function incidentRowParts(incident, nowMs) {
    const id = String(incident.id);
    const resolved = incident.status === 'resolved';
    const tone = resolved ? 'resolved' : INCIDENT_SEVERITY[incident.severity] ? incident.severity : 'warn';
    const meta = [];
    if (resolved) {
        meta.push(escapeHtmlSafe(incidentResolvedHow(incident)), escapeHtmlSafe(incidentAgoText(incident.resolved_at, nowMs)));
        if (incident.verdict) meta.push(`<strong>${escapeHtmlSafe(INCIDENT_VERDICT_LABEL[incident.verdict] || incident.verdict)}</strong>`);
    } else {
        meta.push(escapeHtmlSafe(incidentDetectorLabel(incident.detector)), escapeHtmlSafe(incidentAge(incident.opened_at, nowMs)));
        if (incident.status === 'acknowledged') meta.push(`<strong>Acknowledged by ${escapeHtmlSafe(incident.acknowledged_by || 'an admin')}</strong>`);
        const tag = incidentFixTag(incident, nowMs);
        if (tag) meta.push(tag);
    }
    const example = incident.example ? '<span class="inc-tag-example">Example</span>' : '';
    const selected = incidentsSelected === id;
    return {
        cls: `inc-item is-${tone}`,
        current: selected ? 'true' : 'false',
        inner: `<span class="inc-dot" aria-hidden="true"></span><span class="inc-item-text"><span class="inc-item-title"><span class="inc-num">#${id}</span>${escapeHtmlSafe(incidentText(incident.title || 'Incident'))}</span><span class="inc-item-meta">${example}${meta.join(' · ')}</span></span>`
    };
}

function incidentsListSkeleton(list) {
    if (list.dataset.ready) return;
    list.dataset.ready = '1';
    list.innerHTML = [['needs', 'Needs a look'], ['handled', 'Being handled'], ['resolved', 'Resolved this week']].map(([key, title]) => `
        <div class="inc-group" data-group="${key}"${key === 'needs' ? '' : ' hidden'}>
            <div class="inc-group-title">${title}</div>
            <div class="inc-group-rows"></div>
            ${key === 'needs' ? '<div class="inc-group-empty" hidden>Nothing needs a look right now.</div>' : ''}
            ${key === 'resolved' ? '<button type="button" class="health-card-link inc-group-more" data-act="resolved-all" hidden></button>' : ''}
        </div>`).join('');
}

// Keyed by incident id and patched in place: a row keeps its element (and so its focus) while its text changes, and
// a row that moves to another group is moved, not redrawn. The detail panel may sit between rows on a narrow screen.
function incidentsPatchList(groups, nowMs) {
    const list = document.getElementById('incidents-list');
    if (!list) return;
    incidentsListSkeleton(list);
    const existing = new Map([...list.querySelectorAll('.inc-item')].map((el) => [el.dataset.id, el]));
    const placed = new Set();
    const any = groups.open.length + groups.handled.length + groups.resolved.length > 0;
    for (const [key, items] of [['needs', groups.open], ['handled', groups.handled], ['resolved', groups.resolved]]) {
        const group = list.querySelector(`.inc-group[data-group="${key}"]`);
        const rows = group.querySelector('.inc-group-rows');
        let prev = null;
        for (const incident of items) {
            const id = String(incident.id);
            let el = existing.get(id);
            if (!el) {
                el = document.createElement('button');
                el.type = 'button';
                el.dataset.id = id;
                el.dataset.act = 'select';
            }
            const parts = incidentRowParts(incident, nowMs);
            if (el.className !== parts.cls) el.className = parts.cls;
            if (el.getAttribute('aria-current') !== parts.current) el.setAttribute('aria-current', parts.current);
            incidentsPut(el, parts.inner);
            let ref = prev ? prev.nextSibling : rows.firstChild;
            while (ref && ref !== el && !(ref.classList && ref.classList.contains('inc-item'))) ref = ref.nextSibling;
            if (ref !== el) rows.insertBefore(el, ref);
            placed.add(id);
            prev = el;
        }
        group.hidden = key === 'needs' ? false : !items.length;
        const empty = group.querySelector('.inc-group-empty');
        if (empty) {
            empty.hidden = items.length > 0;
            empty.textContent = any ? 'Nothing needs a look right now.' : 'No incidents.';
        }
        const more = group.querySelector('.inc-group-more');
        if (more) {
            more.hidden = groups.resolvedTotal <= INCIDENT_RESOLVED_CAP;
            const text = incidentsShowAllResolved ? 'Show fewer' : `Show all ${groups.resolvedTotal}`;
            if (more.textContent !== text) more.textContent = text;
        }
    }
    for (const [id, el] of existing) if (!placed.has(id)) el.remove();
}

// The selected incident stays chosen while it exists, whichever group it moves to; else the first that needs a look
function incidentsPickSelection(groups) {
    if (incidentsSelected && incidentFind(incidentsSelected)) return;
    const first = groups.open[0] || groups.handled[0] || null;
    incidentsSelected = first ? String(first.id) : null;
}

// Wide screen: the detail is the right column. Narrow screen: it opens right under the chosen row.
function incidentsPlaceDetail() {
    const detail = document.getElementById('incidents-detail');
    const layout = document.getElementById('incidents-layout');
    const list = document.getElementById('incidents-list');
    if (!detail || !layout || !list) return;
    const row = incidentsSelected ? list.querySelector(`.inc-item[data-id="${incidentsSelected}"]`) : null;
    if (incidentsNarrow && incidentsNarrow.matches && row) {
        if (row.nextElementSibling !== detail) row.after(detail);
    } else if (detail.parentElement !== layout || detail.previousElementSibling !== list) {
        list.after(detail);
    }
}

// ---- the detail panel: what happened ----

// The numbers that matter for each kind of incident, as up to four tiles. A resolved incident's numbers are from when
// it was open, so they lose "now" and the red (the page puts "At the time" above them).
function incidentFacts(incident) {
    const e = incident.evidence && typeof incident.evidence === 'object' ? incident.evidence : {};
    const unit = typeof e.unit === 'string' ? e.unit : '';
    const past = incident.status === 'resolved';
    const tiles = [];
    const add = (label, value, hint = '', tone = '') => { if (value !== '' && value !== null && value !== undefined) tiles.push({ label, value: String(value), hint, tone: past ? '' : tone }); };
    const metric = INCIDENT_METRIC_LABEL[e.metric] || 'Reading';
    const now = past ? metric : `${metric} now`;
    const spread = incidentIsNumber(e.spread) && e.spread > 0 ? `± ${incidentWithUnit(e.spread, unit)}` : '';
    switch (incident.detector) {
        case 'spike':
        case 'timeOfDay':
            if (incidentIsNumber(e.value)) add(now, incidentWithUnit(e.value, unit));
            if (incidentIsNumber(e.baseline)) add(incident.detector === 'timeOfDay' ? 'Usually at this hour' : 'Usually', incidentWithUnit(e.baseline, unit), spread);
            if (incidentIsNumber(e.z)) add('How far off', `${Math.abs(e.z) >= 10 ? Math.round(Math.abs(e.z)) : incidentNumber(Math.abs(e.z))}×`, 'its usual swing');
            if (incidentIsNumber(e.windowSeconds)) add('For', incidentShort(e.windowSeconds), incidentIsNumber(e.samples) && incidentIsNumber(e.above) ? `${e.above} of ${e.samples} readings` : '');
            break;
        case 'drift':
            if (incidentIsNumber(e.value)) add(now, incidentWithUnit(e.value, unit));
            if (incidentIsNumber(e.slopePerHour)) add('Rising', `${incidentWithUnit(e.slopePerHour, unit)} an hour`);
            if (incidentIsNumber(e.hours)) add('For', incidentShort(e.hours * 3600));
            // the detector's baseline is the level of the first third of the window, before the climb began
            if (incidentIsNumber(e.baseline)) add('Before the climb', `about ${incidentWithUnit(e.baseline, unit)}`);
            break;
        case 'disk':
            if (incidentIsNumber(e.value) && unit === 'GB') add('Used', `${incidentNumber(e.value)} GB`, incidentIsNumber(e.percent) && incidentIsNumber(e.totalGb) ? `${incidentNumber(e.percent)} % of ${incidentNumber(e.totalGb)} GB` : '');
            else if (incidentIsNumber(e.percent)) add('Used', `${incidentNumber(e.percent)} %`);
            if (incidentIsNumber(e.gbPerDay)) add('Growth', `${incidentNumber(e.gbPerDay)} GB a day`, incidentIsNumber(e.spanDays) ? `over ${incidentNumber(e.spanDays)} days` : '');
            if (incidentIsNumber(e.daysUntilFull)) add('Full in', `about ${incidentShort(e.daysUntilFull * 86400)}`);
            if (incidentIsNumber(e.totalGb) && incidentIsNumber(e.value) && unit === 'GB') add('Free', `${incidentNumber(e.totalGb - e.value)} GB`);
            break;
        case 'services': {
            const down = incident.kind === 'down' || e.status === 'down';
            if (down) add(INCIDENT_SERVICE_LABEL[incident.subject] || incidentWords(incident.subject || 'service'), 'Down', '', 'bad');
            else if (incidentIsNumber(e.value)) add('Answer time', incidentWithUnit(e.value, unit || 'ms'));
            if (!down && incidentIsNumber(e.baseline)) add('Usually', incidentWithUnit(e.baseline, unit || 'ms'), spread);
            if (!down && incidentIsNumber(e.z)) add('How far off', `${Math.abs(e.z) >= 10 ? Math.round(Math.abs(e.z)) : incidentNumber(Math.abs(e.z))}×`, 'its usual swing');
            if (incidentIsNumber(e.runs)) add(down ? 'Failed checks' : 'Slow checks', `${e.runs} in a row`);
            if (e.since) add('Since', incidentClock(e.since));
            // the page itself comes from the admin server, so it is running (said only while it matters)
            if (down && incident.subject === 'kiosk' && !past) add('Admin server', 'Running');
            else if (e.summary) add('Last answer', incidentText(e.summary));
            break;
        }
        case 'tablets':
            if (e.name) add('Tablet', e.name);
            if (Array.isArray(e.names) && e.names.length) add('Tablets', e.names.join(', '));
            if (incidentIsNumber(e.value)) add('Offline for', incidentShort(e.value * 60));
            if (incidentIsNumber(e.limitMinutes)) add('Counts as offline after', `${e.limitMinutes} min`);
            break;
        case 'logs':
            if (incidentIsNumber(e.value) && e.metric === 'errors') add('Errors', incidentNumber(e.value), incidentIsNumber(e.windowSeconds) ? `in ${incidentShort(e.windowSeconds)}` : '');
            else if (incidentIsNumber(e.value)) add(INCIDENT_VALUE_LABEL[e.metric] || 'Times seen', incidentNumber(e.value));
            if (incidentIsNumber(e.baseline)) add('Usually', `about ${incidentNumber(e.baseline)}`);
            if (e.process) add('Logged by', INCIDENT_PROCESS_LABEL[e.process] || e.process);
            if (e.firstSeen) add('First seen', incidentStamp(e.firstSeen));
            break;
        case 'test':
            // a test incident's numbers are made up, and the tiles say so
            if (incidentIsNumber(e.value)) add('Reading (made up)', incidentWithUnit(e.value, unit));
            if (incidentIsNumber(e.baseline)) add('Usual (made up)', incidentWithUnit(e.baseline, unit));
            break;
        default: break;
    }
    return tiles.slice(0, 4);
}

// The numbers behind an incident in plain words, for a kind that has no tiles. Only the fields listed here are shown,
// so a raw key name never reaches the page.
function incidentEvidenceRows(evidence) {
    const e = evidence && typeof evidence === 'object' ? evidence : {};
    const unit = typeof e.unit === 'string' ? e.unit : '';
    const rows = [];
    const add = (label, text) => { if (text !== null && text !== undefined && String(text) !== '') rows.push([label, String(text)]); };
    if (incidentIsNumber(e.value)) add(INCIDENT_VALUE_LABEL[e.metric] || 'Reading', incidentWithUnit(e.value, unit));
    if (incidentIsNumber(e.baseline)) add('Usual', incidentWithUnit(e.baseline, unit));
    if (incidentIsNumber(e.windowSeconds) && e.windowSeconds > 0) add('Window', `the last ${incidentDuration(e.windowSeconds)}`);
    if (e.since) add('Since', incidentStamp(e.since));
    if (e.summary) add('Last answer', e.summary);
    return rows;
}

// A line chart drawn to the box. The labels are HTML laid over it, so the stretched SVG never bends the text.
function incidentChartHtml(incident, floor, nowMs) {
    const e = incident.evidence && typeof incident.evidence === 'object' ? incident.evidence : {};
    const unit = typeof e.unit === 'string' ? e.unit : '';
    const points = (Array.isArray(e.points) ? e.points : []).filter((p) => p && typeof p === 'object' && incidentIsNumber(p.v));
    if (points.length < 2) return '';
    const values = points.map((p) => p.v);
    const band = ['spike', 'timeOfDay'].includes(incident.detector) && incidentIsNumber(e.baseline) && incidentIsNumber(e.spread) && e.spread > 0
        ? [Math.max(0, e.baseline - e.spread), e.baseline + e.spread] : null;
    const marks = values.concat(band || [], incidentIsNumber(floor) ? [floor] : []);
    let lo = Math.min(...marks);
    let hi = Math.max(...marks);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.14;
    lo = lo >= 0 ? Math.max(0, lo - pad) : lo - pad;
    hi += pad;
    const W = 600;
    const H = 120;
    const x = (i) => ((i / (points.length - 1)) * W).toFixed(1);
    const y = (v) => (H - ((v - lo) / (hi - lo)) * H).toFixed(1);
    const top = (v) => (((hi - v) / (hi - lo)) * 100).toFixed(2);
    const last = points[points.length - 1];
    const label = INCIDENT_METRIC_LABEL[e.metric] || incidentWords(e.metric || 'reading');
    const title = `${label}: ${points.length} readings from ${incidentWithUnit(Math.min(...values), unit)} to ${incidentWithUnit(Math.max(...values), unit)}, last ${incidentWithUnit(last.v, unit)}`;
    const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${escapeHtmlSafe(title)}">`
        + (band ? `<rect class="inc-chart-band" x="0" y="${y(band[1])}" width="${W}" height="${(Number(y(band[0])) - Number(y(band[1]))).toFixed(1)}"></rect>` : '')
        + (incidentIsNumber(floor) ? `<line class="inc-chart-floor" x1="0" x2="${W}" y1="${y(floor)}" y2="${y(floor)}"></line>` : '')
        + `<polyline class="inc-chart-line" points="${points.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')}"></polyline></svg>`;
    // the floor label sits on the side of its line that the end of the graph leaves free
    const tags = (band ? `<span class="inc-chart-tag is-band" style="top: ${top(band[1])}%">usual ${incidentNumber(band[0])}–${incidentWithUnit(band[1], unit)}</span>` : '')
        + (incidentIsNumber(floor) ? `<span class="inc-chart-tag is-floor${last.v > floor ? ' is-below' : ''}" style="top: ${top(floor)}%">${incidentWithUnit(floor, unit)} floor</span>` : '');
    // the right edge says how old the last reading is (an example incident's readings age)
    const firstT = incidentIsNumber(points[0].t) ? points[0].t : null;
    const lastT = incidentIsNumber(last.t) ? last.t : null;
    const axis = firstT !== null && lastT !== null
        ? `<div class="inc-chart-axis"><span>${escapeHtmlSafe(incidentAgoText(new Date(firstT).toISOString(), nowMs))}</span><span>${nowMs - lastT < 120000 ? 'now' : escapeHtmlSafe(incidentAgoText(new Date(lastT).toISOString(), nowMs))}</span></div>`
        : '';
    return `<div class="inc-chart"><div class="inc-chart-plot">${svg}${tags}<span class="inc-chart-dot" style="top: ${top(last.v)}%" aria-hidden="true"></span></div>${axis}</div>`;
}

function incidentHappenedHtml(incident, floor, nowMs) {
    const e = incident.evidence && typeof incident.evidence === 'object' ? incident.evidence : {};
    const story = incident.explanation ? `<div class="inc-story">${escapeHtmlSafe(incidentText(incident.explanation))}</div>` : '';
    const chart = incidentChartHtml(incident, floor, nowMs);
    const facts = incidentFacts(incident);
    let numbers = '';
    if (facts.length) {
        numbers = (incident.status === 'resolved' ? '<div class="inc-facts-caption">At the time</div>' : '') + `<div class="inc-facts">${facts.map((f) => `<div class="inc-fact${f.tone ? ` is-${f.tone}` : ''}"><div class="inc-fact-label">${escapeHtmlSafe(f.label)}</div><div class="inc-fact-value">${escapeHtmlSafe(f.value)}</div>${f.hint ? `<div class="inc-fact-hint">${escapeHtmlSafe(f.hint)}</div>` : ''}</div>`).join('')}</div>`;
    } else {
        const rows = incidentEvidenceRows(e);
        if (rows.length) numbers = `<dl class="ui-kv inc-kv">${rows.map(([k, v]) => `<dt>${escapeHtmlSafe(k)}</dt><dd>${escapeHtmlSafe(incidentText(v))}</dd>`).join('')}</dl>`;
    }
    // a new kind of error carries its own text; a burst carries the most common ones (top)
    const top = Array.isArray(e.top) && e.top[0] && typeof e.top[0].template === 'string' ? e.top[0] : null;
    let quote = '';
    if (typeof e.template === 'string' && e.template) quote = `<div class="inc-quote"><span>The error</span><code>${escapeHtmlSafe(incidentText(e.template))}</code></div>`;
    else if (top) quote = `<div class="inc-quote"><span>The most common error${incidentIsNumber(top.count) ? ` (${top.count} times)` : ''}</span><code>${escapeHtmlSafe(incidentText(top.template))}</code></div>`;
    return story + chart + numbers + quote || '<div class="inc-loading">No numbers were stored for this incident.</div>';
}

// ---- why it might be ----

function incidentWhyHtml(incident) {
    const advice = incident.advice && typeof incident.advice === 'object' ? incident.advice : null;
    const open = incidentIsOpen(incident);
    const busy = incident.adviceBusy === true;
    const canAsk = open && incidentsAdvisorOn && !incident.example;
    const askButton = (text) => `<button type="button" class="health-card-link" data-act="advice" data-id="${incident.id}"${busy ? ' disabled' : ''}>${text}</button>`;
    if (!advice) {
        if (busy) return '<div class="inc-muted">The advisor is looking at this incident. Its answer shows here in a moment.</div>';
        if (!open) return '<div class="inc-muted">No advice was given.</div>';
        if (!incidentsAdvisorOn) return '<div class="inc-muted">The advisor is switched off in Settings.</div>';
        return `<div class="inc-muted">No advice yet. ${canAsk ? askButton('Ask the advisor') : ''}</div>`;
    }
    const causes = (Array.isArray(advice.causes) ? advice.causes : []).map((c) => `<div class="inc-cause"><span class="inc-likely is-${escapeHtmlSafe(c.likelihood || 'medium')}">${escapeHtmlSafe(INCIDENT_LIKELY[c.likelihood] || 'Possible')}</span><span>${escapeHtmlSafe(c.cause || '')}</span></div>`).join('');
    let source;
    if (advice.source === 'example') source = 'Example advice, written for this example incident';
    else if (advice.source === 'llm') source = `From the local AI (${advice.model || 'model'}) at ${incidentWhen(advice.at)}`;
    else source = `Rule-based at ${incidentWhen(advice.at)}: the local AI was not available`;
    const again = canAsk ? ` · ${askButton(busy ? 'Asking' : 'Ask again')}` : '';
    return `${advice.summary ? `<div class="inc-story">${escapeHtmlSafe(advice.summary)}</div>` : ''}
            ${causes ? `<div class="inc-causes">${causes}</div>` : ''}
            <div class="inc-source">${escapeHtmlSafe(source)}${again}</div>`;
}

// ---- what to do ----

// **bold**, [[Key]] and {busiest} in the steps written by the server (playbooks.js); the text is escaped first
function incidentStepHtml(text, busiest) {
    let html = escapeHtmlSafe(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[\[(.+?)\]\]/g, '<kbd>$1</kbd>');
    if (busiest !== undefined) html = html.replace('{busiest}', busiest);
    return html;
}

function incidentBusiestList(list, kind) {
    return incidentJoin(list.map((p) => {
        const amount = kind === 'memory' ? incidentMb(p.memoryMb) : `${p.cpu} %`;
        return p.keep
            ? `<strong>${escapeHtmlSafe(p.name)}</strong> (${escapeHtmlSafe(amount)}, ${escapeHtmlSafe(p.keep)}: leave it running)`
            : `<strong>${escapeHtmlSafe(p.name)}</strong> (${escapeHtmlSafe(amount)})`;
    }));
}

// One ordered list; the step with the busiest programmes is left out when they cannot be read (and on a resolved
// incident, where "right now" means nothing)
function incidentStepsList(steps, live = true) {
    const items = [];
    for (const step of Array.isArray(steps) ? steps : []) {
        if (!step || typeof step.text !== 'string') continue;
        if (!step.live) {
            items.push(`<li>${incidentStepHtml(step.text)}</li>`);
            continue;
        }
        if (!live) continue;
        const state = incidentsBusiest.get(step.live);
        if (state && state.list && state.list.length) {
            items.push(`<li>${incidentStepHtml(step.text, incidentBusiestList(state.list, step.live))} <button type="button" class="health-card-link inc-step-refresh" data-act="busiest" data-kind="${step.live}"${state.loading ? ' disabled' : ''}>${state.loading ? 'Checking' : 'Check again'}</button></li>`);
        } else if (!state || state.loading) {
            items.push(`<li><span class="inc-checking">Checking which programmes ${step.live === 'memory' ? 'use the most memory' : 'are the busiest'} right now</span></li>`);
        }
    }
    return items.length ? `<ol class="inc-steps">${items.join('')}</ol>` : '';
}

function incidentLiveKind(help) {
    const steps = help ? (help.steps || []).concat(help.fallback ? help.fallback.steps || [] : []) : [];
    const live = steps.find((s) => s && s.live);
    return live ? live.live : null;
}

function incidentFixCard(tone, icon, title, text, button) {
    return `<div class="inc-fixcard${tone ? ` is-${tone}` : ''}">
                <span class="inc-fixcard-icon">${icon}</span>
                <span class="inc-fixcard-text"><strong>${escapeHtmlSafe(title)}</strong><span>${escapeHtmlSafe(text)}</span></span>
                ${button || ''}
            </div>`;
}

// The fix card at the top of "What to do": on offer, starting, started or failed. An approval always runs (like Start
// kiosk on Server Schedule); KIOSK_AUTOMATION only decides what may run by itself.
function incidentFixHtml(incident, data) {
    const fix = data && data.fix;
    if (!fix || incident.status === 'resolved') return '';
    if (!data.help || !data.help.fix) return '';
    const status = fix.status || { state: 'offer' };
    const admin = incidentsIsAdmin();
    const who = status.automatic ? 'Started by itself (Automatic in Settings)' : status.by ? `Approved by ${status.by}` : 'Approved';
    const approve = (text) => (admin ? `<button type="button" class="ui-btn ui-btn-primary" data-act="approve" data-id="${incident.id}">${text}</button>` : '');
    const lower = fix.label.charAt(0).toLowerCase() + fix.label.slice(1);
    const notes = [];
    let card;
    switch (status.state) {
        case 'running':
            card = incidentFixCard('busy', '<span class="inc-spinner" aria-hidden="true"></span>', `${fix.label}: starting`, 'This takes up to 30 seconds. The result shows here and in the history.', '');
            break;
        case 'started':
            if (status.example) card = incidentFixCard('done', INCIDENT_CHECK, 'Example: nothing was started', 'On a real incident the kiosk server would start now, and this incident would close by itself once the next checks see it.', '');
            else if (status.dryRun) card = incidentFixCard('done', INCIDENT_CHECK, 'Dry run: nothing was started', 'KIOSK_AUTOMATION=dry-run in backend/.env only records what would run by itself. An approval on this card still runs.', '');
            else card = incidentFixCard('done', INCIDENT_CHECK, `Done at ${incidentClock(status.at)}: ${status.message || lower}`, `${who}. This incident closes by itself once the next health checks see it working, usually within ${fix.confirmMinutes || 15} minutes.`, '');
            break;
        case 'failed':
            card = incidentFixCard('bad', INCIDENT_ALERT, 'The fix did not work', status.message || 'No reason was given.', approve('Try again'));
            notes.push(`${who} at ${incidentClock(status.at)}. The steps below are what to try next.`);
            break;
        default:
            card = incidentFixCard('', INCIDENT_WRENCH, `The app can fix this: ${lower}`, fix.describe || '', approve(fix.example ? 'Approve' : 'Approve and start'));
            if (status.last) notes.push(`The start at ${incidentClock(status.last.at)} did not bring it back.`);
            notes.push(admin ? "Needs a System Admin's approval. Who approved it and what happened go into the incident's history and Audit Logs." : 'A System Admin can approve this fix. Who approved it and what happened go into the history and Audit Logs.');
            if (fix.example) notes.push('Example incident: approving only writes to its history. Nothing is started.');
            else if (fix.mode !== 'ask' && fix.automation === 'off') notes.push('This PC does not start programmes by itself (KIOSK_AUTOMATION=off), so it waits for an approval.');
            else if (incident.status === 'acknowledged' && fix.mode !== 'ask') notes.push('Acknowledged: nothing runs by itself while someone is on it.');
            else if (fix.mode === 'delayed') notes.push('If nobody approves it, it runs by itself 5 minutes after the incident opened (set in Settings).');
            else if (fix.mode === 'auto') notes.push('Set to Automatic in Settings: it runs by itself within a minute.');
    }
    return card + (notes.length ? `<div class="inc-fix-notes">${notes.map((n) => `<div>${escapeHtmlSafe(n)}</div>`).join('')}</div>` : '');
}

// What happened to a resolved incident, from its history
function incidentDoneHtml(events) {
    const lines = [];
    for (const event of Array.isArray(events) ? events : []) {
        const d = event.detail && typeof event.detail === 'object' ? event.detail : {};
        const at = incidentStamp(event.at);
        const fixText = INCIDENT_FIX_DONE[d.fix] || 'the fix';
        if (event.type === 'acknowledged') lines.push(`Acknowledged by ${d.by || 'an admin'} at ${at}.`);
        else if (event.type === 'fix') lines.push(d.automatic ? `The app ran "${fixText}" by itself at ${at} (Automatic in Settings).` : `${d.by || 'An admin'} approved "${fixText}" at ${at}.`);
        else if (event.type === 'fix-done') lines.push(d.example ? 'Example: nothing was run.' : d.ok ? `It worked: ${d.message || 'done'}.` : `It did not work: ${d.message || 'no reason given'}.`);
        else if (event.type === 'resolved') {
            if (d.auto) lines.push(d.reason === 'detector-off' ? `Closed at ${at} because its detector was switched off.` : `Closed by itself at ${at}: the readings went back to normal.`);
            else lines.push(`Resolved by ${d.by || 'an admin'} at ${at}${d.note ? `: ${d.note}` : '.'}`);
        }
    }
    if (!lines.length) return '<div class="inc-muted">Nothing was recorded.</div>';
    return `<ul class="inc-done">${lines.map((l) => `<li>${escapeHtmlSafe(incidentText(l))}</li>`).join('')}</ul>`;
}

function incidentStepsHtml(incident, entry) {
    if (!entry) return '<div class="inc-loading">Loading the steps</div>';
    if (entry.error) return `<div class="ui-note ui-note-warn">Could not load the steps: ${escapeHtmlSafe(entry.error)}</div>`;
    const data = entry.data || {};
    const help = data.help || { steps: [] };
    if (incident.status === 'resolved') {
        const steps = incidentStepsList((help.steps || []).concat(help.fallback ? help.fallback.steps : []), false);
        return incidentDoneHtml(data.events) + (steps ? `<details class="inc-next"><summary>Steps for next time</summary>${steps}</details>` : '');
    }
    const parts = [];
    const steps = incidentStepsList(help.steps);
    if (steps) parts.push(steps);
    if (help.fallback) {
        const failed = data.fix && data.fix.status && data.fix.status.state === 'failed';
        const list = incidentStepsList(help.fallback.steps);
        if (list) parts.push(`<div class="inc-steps-sub">${failed ? 'What to try next' : escapeHtmlSafe(help.fallback.title)}</div>${list}`);
    }
    if (!data.fix && data.fixKind) parts.push('<div class="inc-steps-foot">The app could do this itself, but fixes are switched off in Settings.</div>');
    else if (!data.fix && help.action !== 'none') parts.push('<div class="inc-steps-foot">No automatic fix for this one: a person has to do these steps.</div>');
    return parts.join('');
}

// ---- was this right, history ----

function incidentVerdictHtml(incident) {
    const buttons = Object.entries(INCIDENT_VERDICT_LABEL).map(([key, label]) => {
        const chosen = incident.verdict === key;
        return `<button type="button" class="ui-btn ui-btn-secondary" data-act="verdict" data-id="${incident.id}" data-verdict="${key}" aria-pressed="${chosen}">${label}</button>`;
    }).join('');
    let hint = 'Your answer tunes this detector';
    if (incident.example) hint = 'Examples never tune a detector';
    else if (incident.detector === 'test') hint = 'A test incident tunes nothing';
    else if (incidentsStatus && incidentsStatus.learnFromVerdicts === false) hint = 'Your answer is kept with the incident';
    return `<span class="inc-verdict-label">Was this right?</span><span class="inc-verdict-btns" role="group" aria-label="Was this right?">${buttons}</span><span class="inc-verdict-hint">${hint}</span>`;
}

function incidentTimelineHtml(events, unit, id) {
    if (!Array.isArray(events)) return '<li class="ui-empty">Loading the history</li>';
    if (!events.length) return '<li class="ui-empty">No events yet</li>';
    const full = incidentsTimelineFull.has(String(id));
    const folded = events.length > INCIDENT_TIMELINE_FOLD && !full;
    const shown = folded ? events.slice(0, 2).concat([null], events.slice(-4)) : events;
    const toggle = events.length > INCIDENT_TIMELINE_FOLD
        ? `<li class="inc-timeline-more"><button type="button" class="health-card-link" data-act="timeline" data-id="${id}" aria-expanded="${full}">${full ? 'Show fewer entries' : `Show ${events.length - 6} more entries`}</button></li>`
        : '';
    const label = (severity) => (INCIDENT_SEVERITY[severity] || INCIDENT_SEVERITY.warn).label;
    return shown.map((event) => {
        if (event === null) return toggle;
        const d = event.detail && typeof event.detail === 'object' ? event.detail : {};
        const by = d.by ? `by ${d.by}` : '';
        const detector = d.severity ? `by the detector (${label(d.severity).toLowerCase()})` : 'by the detector';
        let type = incidentWords(event.type || 'event');
        let text = '';
        switch (event.type) {
            case 'opened': type = 'Opened'; text = d.test ? `${by || 'by an admin'} as a test` : detector; break;
            case 'reopened': type = 'Reopened'; text = detector; break;
            case 'seen': type = 'Seen again'; text = `${incidentIsNumber(d.occurrences) ? `${d.occurrences} times so far` : ''}${incidentIsNumber(d.value) ? `, now ${incidentWithUnit(d.value, unit)}` : ''}`.replace(/^, /, ''); break;
            case 'severity': type = `Severity raised to ${label(d.to)}`; text = d.from ? `from ${label(d.from).toLowerCase()}` : ''; break;
            case 'acknowledged': type = 'Acknowledged'; text = by; break;
            case 'resolved':
                type = 'Resolved';
                if (d.auto) text = d.reason === 'detector-off' ? 'Closed because its detector was switched off' : 'Resolved itself: the readings went back to normal';
                else text = [by, d.note ? `note: ${d.note}` : ''].filter(Boolean).join(', ');
                break;
            case 'verdict': type = `Marked ${(INCIDENT_VERDICT_LABEL[d.verdict] || d.verdict || '').toLowerCase()}`; text = by; break;
            case 'note': type = 'Note'; text = d.note || ''; break;
            case 'advice':
                type = 'Advice';
                text = d.source === 'llm' ? `from the local AI (${d.model || 'model'}) in ${incidentIsNumber(d.seconds) ? d.seconds : '?'} s` : d.source === 'example' ? 'example advice' : 'rule-based: the local AI was not available';
                break;
            case 'fix':
                type = d.automatic ? 'Fix ran by itself' : 'Fix approved';
                text = `${by}${d.example ? ' (example: nothing runs)' : d.dryRun ? ' (dry run)' : ''}`;
                break;
            case 'fix-done': type = d.ok ? 'Fix worked' : 'Fix did not work'; text = d.message || ''; break;
            default: text = '';
        }
        return `<li><span class="ui-time">${escapeHtmlSafe(incidentStamp(event.at))}</span><span class="ui-type">${escapeHtmlSafe(type)}</span><span class="ui-detail">${escapeHtmlSafe(incidentText(text))}</span></li>`;
    }).join('') + (full ? toggle : '');
}

// ---- the detail panel ----

const INCIDENT_DETAIL_SKELETON = `
    <div class="inc-d-head">
        <div data-zone="title"></div>
        <div class="inc-d-actions" data-zone="actions"></div>
    </div>
    <div class="inc-d-meta" data-zone="meta"></div>
    <section class="inc-sec"><h4 class="inc-sec-title"><span class="inc-sec-num">1</span>What happened</h4><div data-zone="happened"></div></section>
    <section class="inc-sec"><h4 class="inc-sec-title"><span class="inc-sec-num">2</span>Why it might be</h4><div data-zone="why"></div></section>
    <section class="inc-sec"><h4 class="inc-sec-title" data-zone="todo-title"></h4><div data-zone="fix"></div><div data-zone="steps"></div></section>
    <div class="inc-verdict" data-zone="verdict"></div>
    <div class="inc-history"><div data-zone="history-toggle"></div><ul class="ui-events" data-zone="history"></ul></div>`;

function incidentTitleHtml(incident) {
    const severity = INCIDENT_SEVERITY[incident.severity] || INCIDENT_SEVERITY.warn;
    const chips = [`<span class="inc-idchip">#${incident.id}</span>`];
    if (incident.status === 'resolved') chips.push(uiPill('muted', 'Resolved'));
    else {
        chips.push(uiPill(severity.tone, severity.label));
        if (incident.status === 'acknowledged') chips.push(uiPill('muted', 'Acknowledged'));
    }
    if (incident.example) chips.push('<span class="inc-tag-example">Example</span>');
    return `<div class="inc-d-chips">${chips.join('')}</div><h4 class="inc-d-title">${escapeHtmlSafe(incidentText(incident.title || 'Incident'))}</h4>`;
}

function incidentActionsHtml(incident) {
    if (incident.status === 'open') {
        return `<button type="button" class="ui-btn ui-btn-primary" data-act="acknowledge" data-id="${incident.id}">Acknowledge</button>`
            + `<button type="button" class="ui-btn ui-btn-secondary" data-act="resolve" data-id="${incident.id}">Resolve</button>`;
    }
    if (incident.status === 'acknowledged') return `<button type="button" class="ui-btn ui-btn-primary" data-act="resolve" data-id="${incident.id}">Resolve</button>`;
    return '';
}

function incidentMetaText(incident, nowMs) {
    const parts = [incidentDetectorLabel(incident.detector)];
    if (incident.status === 'resolved') {
        parts.push(`opened ${incidentWhen(incident.opened_at, nowMs)}`);
        const by = incident.resolved_by === 'auto' ? 'by itself' : incident.resolved_by ? `by ${incident.resolved_by}` : '';
        parts.push(`resolved ${incidentWhen(incident.resolved_at, nowMs)} ${by}`.trim());
    } else {
        const every = Number(incidentsStatus && incidentsStatus.intervalSeconds) || 60;
        const going = nowMs - (incidentMs(incident.last_seen_at) || 0) <= Math.max(3 * every, 180) * 1000;
        parts.push(`started ${incidentAgoText(incident.opened_at, nowMs)}, ${going ? 'still going' : `last seen ${incidentAgoText(incident.last_seen_at, nowMs)}`}`);
        if (incident.status === 'acknowledged') parts.push(`acknowledged by ${incident.acknowledged_by || 'an admin'} at ${incidentWhen(incident.acknowledged_at, nowMs)}`);
    }
    if (Number(incident.occurrences) > 1) parts.push(`seen ${Number(incident.occurrences)} times`);
    return parts.join(' · ');
}

function incidentClearHtml() {
    if (incidentsError) return `<div class="inc-clear"><div class="inc-clear-title">Could not load the incidents</div><div class="inc-clear-text">${escapeHtmlSafe(incidentsError)}</div></div>`;
    if (!incidentsStatus) return '<div class="inc-clear"><div class="inc-clear-text">Loading the incidents</div></div>';
    if (incidentsStatus.enabled === false) return '<div class="inc-clear"><div class="inc-clear-title">Anomaly detection is off</div><div class="inc-clear-text">Nothing is compared and no incident is opened.</div><button type="button" class="ui-btn ui-btn-secondary" data-act="settings">Open Settings</button></div>';
    return `<div class="inc-clear"><span class="inc-clear-icon">${INCIDENT_CHECK}</span><div class="inc-clear-title">No open incidents</div><div class="inc-clear-text">${escapeHtmlSafe(incidentsWatchingText(incidentsStatus, incidentsNamedTablets(incidentsStatus)))}</div></div>`;
}

// Zones are swapped only when their own HTML changed, so the buttons in the others keep focus; zones with buttons
// carry clock times, never "x min ago", so they do not change every minute
function renderIncidentDetail(nowMs) {
    const box = document.getElementById('incidents-detail');
    if (!box) return;
    const incident = incidentsSelected ? incidentFind(incidentsSelected) : null;
    if (!incident) {
        if (box.dataset.for !== '') {
            box.dataset.for = '';
            incidentsZones.clear();
            incidentsDrawn.delete(box);
        }
        box.classList.add('is-clear');
        incidentsPut(box, incidentClearHtml());
        return;
    }
    const id = String(incident.id);
    if (box.dataset.for !== id) {
        box.dataset.for = id;
        box.classList.remove('is-clear');
        incidentsDrawn.delete(box);
        box.innerHTML = INCIDENT_DETAIL_SKELETON;
        incidentsZones.clear();
    }
    const entry = incidentsDetail.get(id);
    const data = entry && entry.data ? entry.data : null;
    const events = data && Array.isArray(data.events) ? data.events : null;
    const unit = incident.evidence && typeof incident.evidence.unit === 'string' ? incident.evidence.unit : '';
    const historyOpen = incidentsHistoryOpen.has(id);
    const zones = {
        title: incidentTitleHtml(incident),
        actions: incidentActionsHtml(incident),
        meta: escapeHtmlSafe(incidentMetaText(incident, nowMs)),
        happened: incidentHappenedHtml(incident, data ? data.floor : null, nowMs),
        why: incidentWhyHtml(incident),
        'todo-title': `<span class="inc-sec-num">3</span>${incident.status === 'resolved' ? 'What was done' : 'What to do'}`,
        fix: incidentFixHtml(incident, data),
        steps: incidentStepsHtml(incident, entry),
        verdict: incidentVerdictHtml(incident),
        'history-toggle': `<button type="button" class="inc-history-btn" data-act="history" data-id="${id}" aria-expanded="${historyOpen}">${INCIDENT_CHEVRON}History${events ? ` · ${events.length} event${events.length === 1 ? '' : 's'}` : ''}</button>`,
        history: historyOpen ? incidentTimelineHtml(events, unit, id) : ''
    };
    for (const [zone, html] of Object.entries(zones)) {
        if (incidentsZones.get(zone) === html) continue;
        const el = box.querySelector(`[data-zone="${zone}"]`);
        if (!el) continue;
        el.innerHTML = html;
        incidentsZones.set(zone, html);
    }
    const history = box.querySelector('[data-zone="history"]');
    if (history) history.hidden = !historyOpen;
}

function renderIncidents() {
    if (!document.getElementById('incidents-list')) return;
    const nowMs = Date.now();
    incidentsPickSelection(incidentsGroups(nowMs));
    const groups = incidentsGroups(nowMs); // again: a chosen resolved incident past the first five joins its group
    renderIncidentsChips();
    renderIncidentsSummary();
    incidentsPatchList(groups, nowMs);
    renderIncidentDetail(nowMs);
    // with nothing to list, the "No open incidents" panel takes the whole width
    const layout = document.getElementById('incidents-layout');
    if (layout) layout.classList.toggle('is-empty', !incidentsSelected && !(groups.open.length + groups.handled.length + groups.resolved.length));
    incidentsPlaceDetail();
}

// ---- loading ----

async function loadIncidentDetail(id) {
    const key = String(id);
    if (incidentsDetailLoading.has(key)) return;
    incidentsDetailLoading.add(key);
    try {
        const data = await incidentsFetch(`/api/admin/aiops/incidents/${encodeURIComponent(key)}`);
        incidentsDetail.set(key, { data });
    } catch (error) {
        // a refresh that fails keeps the story already shown
        const before = incidentsDetail.get(key);
        if (!before || before.error) incidentsDetail.set(key, { error: error.message });
    } finally {
        incidentsDetailLoading.delete(key);
        incidentsDetailStale.delete(key);
        if (key === incidentsSelected) {
            renderIncidentDetail(Date.now());
            incidentsAfterDetail(key);
        }
    }
}

// After the story arrives: the busiest programmes (once per choice) and, while a fix is starting, a closer watch
function incidentsAfterDetail(key) {
    const entry = incidentsDetail.get(key);
    const data = entry && entry.data;
    if (!data) return;
    const kind = incidentLiveKind(data.help);
    if (kind && data.incident && incidentIsOpen(data.incident) && !incidentsBusiestFor.has(key)) {
        incidentsBusiestFor.add(key);
        const cached = incidentsBusiest.get(kind);
        if (!cached || !cached.at || Date.now() - cached.at > INCIDENT_BUSIEST_FRESH_MS) loadIncidentBusiest(kind);
    }
    if (data.fix && data.fix.status && data.fix.status.state === 'running') incidentsWatchFix(key);
}

// One PowerShell read on the server PC, so only on a choice or "Check again", never on the 30-second refresh
async function loadIncidentBusiest(kind) {
    const before = incidentsBusiest.get(kind) || {};
    incidentsBusiest.set(kind, { ...before, loading: true });
    renderIncidentDetail(Date.now());
    try {
        const data = await incidentsFetch(`/api/admin/aiops/processes?by=${kind === 'memory' ? 'memory' : 'cpu'}`);
        incidentsBusiest.set(kind, { at: Date.now(), list: Array.isArray(data.programmes) ? data.programmes : [] });
    } catch (error) {
        incidentsBusiest.set(kind, { at: Date.now(), error: error.message });
    }
    renderIncidentDetail(Date.now());
}

// Forget what belongs to incidents the server no longer lists
function incidentsForgetGone() {
    const ids = new Set(incidentsList.map((i) => String(i.id)));
    for (const map of [incidentsJson, incidentsDetail]) for (const id of [...map.keys()]) if (!ids.has(id)) map.delete(id);
    for (const set of [incidentsHistoryOpen, incidentsTimelineFull, incidentsDetailStale]) for (const id of [...set]) if (!ids.has(id)) set.delete(id);
}

// Status and list in parallel; called by health.js on its 30-second cycle and after every action (force)
async function loadIncidents(force) {
    const card = document.getElementById('health-incidents-card');
    if (!card || card.hidden) return;
    if (incidentsLoading) {
        incidentsReloadQueued = incidentsReloadQueued || force === true;
        return;
    }
    if (force !== true && Date.now() - incidentsLoadedAt < INCIDENT_FRESH_MS) return;
    incidentsLoading = true;
    bindIncidentsPanel();
    try {
        const [status, list] = await Promise.all([
            incidentsFetch('/api/admin/aiops/status'),
            incidentsFetch('/api/admin/aiops/incidents?status=all&limit=100')
        ]);
        incidentsStatus = status.status || {};
        if (incidentsStatus.advisor) incidentsAdvisorOn = incidentsStatus.advisor.on !== false;
        incidentsList = Array.isArray(list.incidents) ? list.incidents : [];
        incidentsError = null;
        incidentsForgetGone();
        // a changed list entry means its story changed too (new events, a fix result)
        for (const incident of incidentsList) {
            const key = String(incident.id);
            const json = JSON.stringify(incident);
            if (incidentsJson.has(key) && incidentsJson.get(key) !== json) incidentsDetailStale.add(key);
            incidentsJson.set(key, json);
        }
    } catch (error) {
        console.warn('[aiops] Could not load the incidents:', error.message);
        incidentsError = error.message;
    } finally {
        incidentsLoadedAt = Date.now();
        incidentsLoading = false;
        renderIncidents();
        if (incidentsSelected && (!incidentsDetail.has(incidentsSelected) || incidentsDetailStale.has(incidentsSelected))) loadIncidentDetail(incidentsSelected);
        if (incidentsList.some((i) => i.adviceBusy)) incidentsWatchAdvice();
        if (incidentsReloadQueued) {
            incidentsReloadQueued = false;
            loadIncidents(true);
        }
    }
}

// while any advice is being prepared, the list refreshes every 5 seconds (for at most 3 minutes)
function incidentsWatchAdvice() {
    if (incidentsAdviceTimer) return;
    const until = Date.now() + 3 * 60 * 1000;
    incidentsAdviceTimer = setInterval(() => {
        const card = document.getElementById('health-incidents-card');
        if (Date.now() > until || !card || card.hidden || !incidentsList.some((i) => i.adviceBusy)) {
            clearInterval(incidentsAdviceTimer);
            incidentsAdviceTimer = null;
            return;
        }
        loadIncidents(true);
    }, 5000);
}

// while a fix is starting, the incident is looked at every 4 seconds (for at most 90 seconds)
function incidentsWatchFix(key) {
    if (incidentsFixTimer) return;
    const until = Date.now() + 90 * 1000;
    incidentsFixTimer = setInterval(() => {
        const entry = incidentsDetail.get(key);
        const state = entry && entry.data && entry.data.fix && entry.data.fix.status ? entry.data.fix.status.state : null;
        const card = document.getElementById('health-incidents-card');
        if (Date.now() > until || state !== 'running' || incidentsSelected !== key || !card || card.hidden) {
            clearInterval(incidentsFixTimer);
            incidentsFixTimer = null;
            loadIncidents(true);
            return;
        }
        loadIncidentDetail(key);
    }, 4000);
}

// ---- actions ----

function selectIncident(id, focusRow) {
    const key = String(id);
    if (incidentsSelected !== key) {
        incidentsSelected = key;
        incidentsBusiestFor.clear();
        renderIncidents();
        if (!incidentsDetail.has(key) || incidentsDetailStale.has(key)) loadIncidentDetail(key);
        else incidentsAfterDetail(key);
    }
    if (focusRow) {
        const row = document.querySelector(`#incidents-list .inc-item[data-id="${key}"]`);
        if (row) row.focus();
    }
}

async function incidentAction(id, action, button, body) {
    const key = encodeURIComponent(String(id));
    const url = action === 'acknowledge' ? `/api/admin/aiops/incidents/${key}/acknowledge`
        : action === 'resolve' ? `/api/admin/aiops/incidents/${key}/resolve`
            : `/api/admin/aiops/incidents/${key}/verdict`;
    if (button) button.disabled = true;
    try {
        await incidentsFetch(url, { method: 'POST', body: JSON.stringify(body || {}) });
        incidentsDetailStale.add(String(id));
    } catch (error) {
        if (error.status !== 404) showNotification(error.message, 'error');
    } finally {
        if (button) button.disabled = false;
        await loadIncidents(true);
    }
}

async function askIncidentAdvice(id, button) {
    if (button) button.disabled = true;
    try {
        await incidentsFetch(`/api/admin/aiops/incidents/${encodeURIComponent(String(id))}/advice`, { method: 'POST', body: '{}' });
    } catch (error) {
        showNotification(error.message, 'error');
    }
    await loadIncidents(true);
    incidentsWatchAdvice();
}

function bindIncidentsPanel() {
    const card = document.getElementById('health-incidents-card');
    if (!card || card.dataset.bound) return;
    card.dataset.bound = '1';
    card.addEventListener('click', (event) => {
        const el = event.target.closest('[data-act]');
        if (!el || el.disabled || !card.contains(el)) return;
        const id = el.dataset.id || incidentsSelected;
        switch (el.dataset.act) {
            case 'select': selectIncident(el.dataset.id); break;
            case 'acknowledge': incidentAction(id, 'acknowledge', el); break;
            case 'resolve': incidentAction(id, 'resolve', el); break;
            case 'verdict': incidentAction(id, 'verdict', el, { verdict: el.dataset.verdict }); break;
            case 'advice': askIncidentAdvice(id, el); break;
            case 'approve': openIncidentApprove(id); break;
            case 'busiest': loadIncidentBusiest(el.dataset.kind); break;
            case 'settings': openIncidentSettings(); break;
            case 'history':
                if (incidentsHistoryOpen.has(String(id))) incidentsHistoryOpen.delete(String(id));
                else incidentsHistoryOpen.add(String(id));
                renderIncidentDetail(Date.now());
                break;
            case 'timeline':
                if (incidentsTimelineFull.has(String(id))) incidentsTimelineFull.delete(String(id));
                else incidentsTimelineFull.add(String(id));
                renderIncidentDetail(Date.now());
                break;
            case 'resolved-all':
                incidentsShowAllResolved = !incidentsShowAllResolved;
                renderIncidents();
                break;
            default: break;
        }
    });
    // Up and Down move through the list, Home and End jump to its ends
    const list = document.getElementById('incidents-list');
    if (list) {
        list.addEventListener('keydown', (event) => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            const rows = [...list.querySelectorAll('.inc-item')];
            const at = rows.indexOf(document.activeElement);
            if (at < 0 || !rows.length) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.min(rows.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)));
            selectIncident(rows[next].dataset.id, true);
        });
    }
    if (incidentsNarrow) {
        const place = () => incidentsPlaceDetail();
        if (incidentsNarrow.addEventListener) incidentsNarrow.addEventListener('change', place);
        else if (incidentsNarrow.addListener) incidentsNarrow.addListener(place);
    }
}

// ---- the approve dialog ----

function openIncidentApprove(id) {
    const dialog = document.getElementById('incidents-approve-dialog');
    const entry = incidentsDetail.get(String(id));
    const fix = entry && entry.data ? entry.data.fix : null;
    if (!dialog || typeof dialog.showModal !== 'function' || !fix || !incidentsIsAdmin()) return;
    if (!dialog.dataset.bound) {
        dialog.dataset.bound = '1';
        dialog.addEventListener('close', () => { dialog.classList.remove('is-closing'); incidentsApproveFor = null; });
        dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeIncidentApprove(); });
    }
    incidentsApproveFor = { id: String(id), fix: fix.key, example: !!fix.example };
    document.getElementById('incidents-approve-title').textContent = `Approve the fix for incident #${id}?`;
    document.getElementById('incidents-approve-sub').innerHTML = fix.example
        ? `<strong>Example incident.</strong> Nothing is started: the approval is only written to this example's history.`
        : `<strong>${escapeHtmlSafe(fix.label)}.</strong> ${escapeHtmlSafe(fix.describe || '')} Nothing else is changed.`;
    const rows = [
        ['Approved by', `${incidentsUsername()} (System Admin)`],
        ['Written to', "the incident's history and Audit Logs"],
        ['Afterwards', fix.example ? 'nothing changes: it is an example' : 'the incident closes by itself once the next checks see the kiosk']
    ];
    document.getElementById('incidents-approve-kv').innerHTML = rows.map(([k, v]) => `<dt>${escapeHtmlSafe(k)}</dt><dd>${escapeHtmlSafe(v)}</dd>`).join('');
    const error = document.getElementById('incidents-approve-error');
    error.hidden = true;
    error.textContent = '';
    const go = document.getElementById('incidents-approve-go');
    go.disabled = false;
    go.textContent = fix.example ? 'Approve' : 'Approve and start';
    dialog.classList.remove('is-closing');
    if (!dialog.open) dialog.showModal();
    document.getElementById('incidents-approve-cancel').focus();
}

function closeIncidentApprove() {
    const dialog = document.getElementById('incidents-approve-dialog');
    if (!dialog || !dialog.open) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        dialog.close();
        return;
    }
    dialog.classList.add('is-closing');
    setTimeout(() => { if (dialog.open) dialog.close(); }, 150);
}

async function confirmIncidentApprove() {
    const pending = incidentsApproveFor;
    if (!pending) return;
    const go = document.getElementById('incidents-approve-go');
    const error = document.getElementById('incidents-approve-error');
    go.disabled = true;
    try {
        const result = await incidentsFetch(`/api/admin/aiops/incidents/${encodeURIComponent(pending.id)}/fix`, { method: 'POST', body: JSON.stringify({ fix: pending.fix }) });
        closeIncidentApprove();
        incidentsDetailStale.add(pending.id);
        await loadIncidentDetail(pending.id);
        loadIncidents(true);
        if (result && result.done === false) incidentsWatchFix(pending.id);
    } catch (failure) {
        // shown in the dialog itself: a toast would sit under it
        error.textContent = failure.message;
        error.hidden = false;
        go.disabled = false;
    }
}

// ---- the settings drawer ----

function incidentsSettingsStatus(text, tone) {
    const help = document.getElementById('incidents-settings-help');
    if (!help) return;
    help.textContent = text;
    help.classList.toggle('is-error', tone === 'error');
    help.classList.toggle('is-dirty', tone === 'dirty');
    if (tone === 'error') help.setAttribute('role', 'alert');
    else help.setAttribute('role', 'status');
}

function incidentsMarkDirty() {
    if (incidentsDrawerDirty || !incidentsSettingsData) return;
    incidentsDrawerDirty = true;
    incidentsSettingsStatus('Unsaved changes', 'dirty');
}

function incidentLevelSentence(level, sensitivity) {
    if (!level || !Array.isArray(level.short)) return '';
    const i = Math.min(5, Math.max(1, Number(sensitivity) || 3)) - 1;
    const value = (Array.isArray(level.long) ? level.long : level.short)[i];
    return String(level.sentence || '').replace('{v}', value);
}

function renderIncidentFixes(data, settings) {
    const box = document.getElementById('incidents-fixes');
    if (!box) return;
    const modes = settings.fixes || {};
    box.innerHTML = (Array.isArray(data.fixes) ? data.fixes : []).map((fix) => {
        const key = escapeHtmlSafe(fix.key);
        const mode = modes[fix.key] || 'ask';
        const options = (fix.modes || []).map((m) => `<label class="inc-mode"><input type="radio" name="inc-fix-${key}" value="${escapeHtmlSafe(m.key)}" data-fix="${key}"${m.key === mode ? ' checked' : ''}><span title="${escapeHtmlSafe(m.label)}">${escapeHtmlSafe(INCIDENT_MODE_SHORT[m.key] || m.label)}</span></label>`).join('');
        return `<div class="inc-fixrow" data-fix="${key}">
                    <div class="inc-fixrow-name">${escapeHtmlSafe(fix.label)}</div>
                    <div class="inc-fixrow-for">For: ${escapeHtmlSafe(fix.forIncident || 'its incident')}</div>
                    <div class="inc-modes" role="radiogroup" aria-label="${escapeHtmlSafe(fix.label)}: when it runs">${options}</div>
                    <div class="inc-fixrow-note" data-note="${key}">${escapeHtmlSafe(INCIDENT_MODE_SENTENCE[mode] || '')}</div>
                </div>`;
    }).join('');
}

function renderIncidentDetectors(data, settings) {
    const box = document.getElementById('incidents-detectors');
    if (!box) return;
    const learned = settings.learnFromVerdicts === false ? {} : data.learned || {};
    const levels = data.levels || {};
    const detectors = Array.isArray(data.detectors) && data.detectors.length
        ? data.detectors
        : Object.keys(INCIDENT_DETECTOR_LABEL).filter((key) => key !== 'test').map((key) => ({ key, label: INCIDENT_DETECTOR_LABEL[key], description: '' }));
    box.innerHTML = detectors.map((d) => {
        const conf = (settings.detectors && settings.detectors[d.key]) || {};
        const on = conf.enabled !== false;
        const sensitivity = Math.min(5, Math.max(1, Number(conf.sensitivity) || 3));
        const key = escapeHtmlSafe(d.key);
        const label = escapeHtmlSafe(d.label || incidentWords(d.key));
        const level = levels[d.key] || null;
        const tuned = learned[d.key] && learned[d.key].offset ? Math.min(5, Math.max(1, sensitivity + Number(learned[d.key].offset))) : null;
        const steps = INCIDENT_SENSITIVITY.map((name, i) => {
            const value = i + 1;
            const number = level && Array.isArray(level.short) ? level.short[i] : '';
            return `<label class="inc-level${tuned === value ? ' is-tuned' : ''}"><input type="radio" name="inc-level-${key}" value="${value}" data-detector="${key}" data-field="sensitivity"${value === sensitivity ? ' checked' : ''}><span><b>${name}</b>${number ? `<small>${escapeHtmlSafe(number)}</small>` : ''}</span></label>`;
        }).join('');
        const tunedNote = tuned ? `<div class="inc-det-tuned">Tuned to ${INCIDENT_SENSITIVITY[tuned - 1]} by your answers${learned[d.key].reason ? `: ${escapeHtmlSafe(learned[d.key].reason)}` : ''}. Saving a level resets it.</div>` : '';
        return `<div class="inc-det${on ? '' : ' is-off'}" data-key="${key}">
                    <label class="inc-det-head">
                        <span class="ui-switch"><input type="checkbox" data-detector="${key}" data-field="enabled" aria-label="${label}"${on ? ' checked' : ''}><span class="ui-switch-track"></span></span>
                        <span class="inc-toggle-text"><strong>${label}</strong><small>${escapeHtmlSafe(d.description || '')}</small></span>
                    </label>
                    <div class="inc-levels" role="radiogroup" aria-label="Sensitivity of ${label}">${steps}</div>
                    <div class="inc-det-sentence" data-sentence="${key}">${escapeHtmlSafe(incidentLevelSentence(level, sensitivity))}</div>
                    ${tunedNote}
                </div>`;
    }).join('');
}

// A saved value outside the preset list (a hand-edited file) gets its own option instead of being lost
function incidentsSelectValue(id, value, label) {
    const select = document.getElementById(id);
    if (!select) return;
    const text = String(value);
    if (![...select.options].some((option) => option.value === text)) select.add(new Option(label, text));
    select.value = text;
}

function renderIncidentExamplesBox() {
    const button = document.getElementById('incidents-examples-btn');
    const text = document.getElementById('incidents-examples-text');
    if (!button || !text) return;
    const count = Number(incidentsStatus && incidentsStatus.examples) || 0;
    button.textContent = count ? 'Remove example incidents' : 'Show example incidents';
    button.disabled = !incidentsIsAdmin();
    text.textContent = count
        ? `${count} example incident${count === 1 ? ' is' : 's are'} in the list, labelled Example. Removing them deletes only the examples.`
        : 'Seven made-up incidents that show every part of this panel: a chart, the advice, step-by-step help, a fix waiting for approval, an acknowledged one and two resolved ones. They are labelled Example, never run anything and never tune a detector.';
}

function incidentsApplyFixesState() {
    const offer = document.getElementById('incidents-offer-fixes');
    const box = document.getElementById('incidents-fixes');
    const note = document.getElementById('incidents-fixes-note');
    const automation = incidentsSettingsData ? incidentsSettingsData.automation : 'on';
    const admin = incidentsIsAdmin();
    const on = !!(offer && offer.checked);
    if (box) {
        box.classList.toggle('is-off', !on);
        box.querySelectorAll('input').forEach((input) => { input.disabled = !admin || !on || automation === 'off'; });
    }
    if (note) {
        const text = automation === 'off'
            ? 'This PC does not start programmes by itself (KIOSK_AUTOMATION=off in backend/.env), so a fix waits for an approval whatever is chosen here. An approval on the incident still runs, like Start kiosk on Server Schedule.'
            : automation === 'dry-run' ? 'KIOSK_AUTOMATION=dry-run in backend/.env: what would run by itself is only recorded. An approval on the incident still runs.' : '';
        note.textContent = text;
        note.hidden = !text;
    }
}

async function fillIncidentSettings() {
    const admin = incidentsIsAdmin();
    const loading = document.getElementById('incidents-drawer-loading');
    const body = document.getElementById('incidents-drawer-body');
    if (loading) { loading.hidden = false; loading.textContent = 'Loading the saved settings'; }
    if (body) body.querySelectorAll('section').forEach((s) => { s.hidden = true; });
    document.getElementById('incidents-drawer-admin').hidden = admin;
    document.getElementById('incidents-settings-save').disabled = true;
    incidentsSettingsData = null;
    incidentsDrawerDirty = false;
    incidentsSettingsStatus('', '');
    const result = document.getElementById('incidents-examples-result');
    if (result) { result.textContent = ''; result.classList.remove('is-error'); }
    try {
        const data = await incidentsFetch('/api/admin/aiops/settings');
        const settings = data.settings || {};
        document.getElementById('incidents-enabled').checked = settings.enabled !== false;
        document.getElementById('incidents-learn').checked = settings.learnFromVerdicts !== false;
        document.getElementById('incidents-offer-fixes').checked = settings.offerFixes !== false;
        document.getElementById('incidents-quiet').checked = settings.quietHours !== false;
        document.getElementById('incidents-advisor').checked = !settings.advisor || settings.advisor.enabled !== false;
        renderIncidentFixes(data, settings);
        renderIncidentDetectors(data, settings);
        const interval = Number(settings.intervalSeconds) || 60;
        const retention = Number(settings.retentionDays) || 30;
        const keep = Number(settings.keepIncidentsDays) || 90;
        incidentsSelectValue('incidents-interval', interval, `${incidentDuration(interval)} (current)`);
        incidentsSelectValue('incidents-retention', retention, `${retention} days (current)`);
        incidentsSelectValue('incidents-keep', keep, `${keep} days (current)`);
        incidentsSettingsData = data;
        if (body) {
            body.querySelectorAll('section').forEach((s) => { s.hidden = false; });
            body.querySelectorAll('input, select').forEach((el) => { el.disabled = !admin; el.removeAttribute('aria-invalid'); });
        }
        incidentsApplyFixesState();
        renderIncidentExamplesBox();
        document.getElementById('incidents-settings-save').disabled = !admin;
        if (loading) loading.hidden = true;
        await fillIncidentAdvisorModels((settings.advisor && settings.advisor.model) || 'qwen2.5:3b');
        document.getElementById('incidents-advisor-model').disabled = !admin;
    } catch (error) {
        if (loading) loading.textContent = `Could not load the settings: ${error.message}`;
    }
}

async function fillIncidentAdvisorModels(saved) {
    const select = document.getElementById('incidents-advisor-model');
    if (!select) return;
    let models = [];
    let help = '';
    try {
        const data = await incidentsFetch('/api/admin/aiops/advisor');
        models = Array.isArray(data.models) ? data.models : [];
        if (!models.length) help = 'Ollama is not running or has no models: the advisor gives rule-based advice until it is.';
    } catch (error) {
        help = `Could not ask Ollama for its models: ${error.message}`;
    }
    const names = [...new Set([saved, ...models])];
    select.innerHTML = names.map((name) => `<option value="${escapeHtmlSafe(name)}"${name === saved ? ' selected' : ''}>${escapeHtmlSafe(name)}${models.includes(name) ? '' : ' (not on this PC)'}</option>`).join('');
    const note = document.getElementById('incidents-advisor-help');
    if (note) note.textContent = help;
}

function bindIncidentsDrawer(drawer) {
    if (drawer.dataset.bound) return;
    drawer.dataset.bound = '1';
    // Esc closes it like Cancel: the changes are discarded
    drawer.addEventListener('cancel', (event) => { event.preventDefault(); closeIncidentSettings(); });
    // a click on the dimmed page beside the drawer closes it too
    drawer.addEventListener('click', (event) => { if (event.target === drawer) closeIncidentSettings(); });
    drawer.addEventListener('close', () => { drawer.classList.remove('is-closing'); });
    drawer.addEventListener('change', (event) => {
        const input = event.target;
        if (input.dataset.field === 'sensitivity') {
            const card = input.closest('.inc-det');
            const sentence = card && card.querySelector('.inc-det-sentence');
            const levels = (incidentsSettingsData && incidentsSettingsData.levels) || {};
            if (sentence) sentence.textContent = incidentLevelSentence(levels[input.dataset.detector], input.value);
        } else if (input.dataset.field === 'enabled') {
            const card = input.closest('.inc-det');
            if (card) card.classList.toggle('is-off', !input.checked);
        } else if (input.dataset.fix) {
            const row = input.closest('.inc-fixrow');
            const note = row && row.querySelector('.inc-fixrow-note');
            if (note) note.textContent = INCIDENT_MODE_SENTENCE[input.value] || '';
        } else if (input.id === 'incidents-offer-fixes') {
            incidentsApplyFixesState();
        }
        if (input.closest('.inc-drawer-body') && !input.closest('.inc-examples')) incidentsMarkDirty();
    });
}

async function openIncidentSettings() {
    const drawer = document.getElementById('incidents-drawer');
    if (!drawer || typeof drawer.showModal !== 'function') return;
    bindIncidentsDrawer(drawer);
    drawer.classList.remove('is-closing');
    if (!drawer.open) drawer.showModal();
    await fillIncidentSettings();
}

function closeIncidentSettings() {
    const drawer = document.getElementById('incidents-drawer');
    if (!drawer || !drawer.open || drawer.classList.contains('is-closing')) return;
    incidentsDrawerDirty = false;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        drawer.close();
        return;
    }
    drawer.classList.add('is-closing');
    setTimeout(() => { if (drawer.open) drawer.close(); }, 180);
}

function readIncidentSettings() {
    const checked = (id) => { const el = document.getElementById(id); return !!(el && el.checked); };
    const number = (id) => { const el = document.getElementById(id); return el ? Number(el.value) : null; };
    const detectors = {};
    document.querySelectorAll('#incidents-detectors .inc-det').forEach((card) => {
        const on = card.querySelector('[data-field="enabled"]');
        const level = card.querySelector('[data-field="sensitivity"]:checked');
        detectors[card.dataset.key] = { enabled: !!(on && on.checked), sensitivity: level ? Number(level.value) : 3 };
    });
    const fixes = {};
    document.querySelectorAll('#incidents-fixes .inc-fixrow').forEach((row) => {
        const mode = row.querySelector('input[data-fix]:checked');
        if (mode) fixes[row.dataset.fix] = mode.value;
    });
    return {
        enabled: checked('incidents-enabled'),
        learnFromVerdicts: checked('incidents-learn'),
        offerFixes: checked('incidents-offer-fixes'),
        fixes,
        detectors,
        advisor: { enabled: checked('incidents-advisor'), model: (document.getElementById('incidents-advisor-model') || {}).value || 'qwen2.5:3b' },
        quietHours: checked('incidents-quiet'),
        intervalSeconds: number('incidents-interval'),
        retentionDays: number('incidents-retention'),
        keepIncidentsDays: number('incidents-keep')
    };
}

// The control behind a dotted field name from a 400 answer ('intervalSeconds', 'detectors.spike.sensitivity', 'fixes.start-kiosk')
function incidentsFieldControl(field) {
    const parts = String(field || '').split('.');
    if (parts[0] === 'detectors' && parts.length === 3 && /^[A-Za-z]+$/.test(parts[1])) {
        return parts[2] === 'sensitivity'
            ? document.querySelector(`#incidents-detectors [data-detector="${parts[1]}"][data-field="sensitivity"]:checked`)
            : document.querySelector(`#incidents-detectors [data-detector="${parts[1]}"][data-field="enabled"]`);
    }
    if (parts[0] === 'fixes' && /^[a-z-]+$/.test(parts[1] || '')) return document.querySelector(`#incidents-fixes input[data-fix="${parts[1]}"]:checked`);
    if (parts[0] === 'advisor') return document.getElementById(parts[1] === 'model' ? 'incidents-advisor-model' : 'incidents-advisor');
    return INCIDENT_FIELD_ID[parts[0]] ? document.getElementById(INCIDENT_FIELD_ID[parts[0]]) : null;
}

async function saveIncidentSettings() {
    if (incidentsSettingsBusy || !incidentsIsAdmin() || !incidentsSettingsData) return;
    const payload = readIncidentSettings();
    const buttons = [document.getElementById('incidents-settings-save'), document.getElementById('incidents-settings-cancel')].filter(Boolean);
    incidentsSettingsBusy = true;
    buttons.forEach((b) => { b.disabled = true; });
    document.querySelectorAll('#incidents-drawer [aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    incidentsSettingsStatus('Saving', '');
    try {
        await incidentsFetch('/api/admin/aiops/settings', { method: 'PUT', body: JSON.stringify(payload) });
        closeIncidentSettings();
        showNotification('Incident settings saved', 'success');
        loadIncidents(true);
    } catch (error) {
        // shown in the drawer itself: a toast would sit under it
        incidentsSettingsStatus(error.message, 'error');
        const control = incidentsFieldControl(error.field);
        if (control) {
            control.setAttribute('aria-invalid', 'true');
            control.focus();
        }
    } finally {
        incidentsSettingsBusy = false;
        buttons.forEach((b) => { b.disabled = false; });
    }
}

async function toggleIncidentExamples() {
    if (!incidentsIsAdmin()) return;
    const button = document.getElementById('incidents-examples-btn');
    const result = document.getElementById('incidents-examples-result');
    const shown = Number(incidentsStatus && incidentsStatus.examples) > 0;
    button.disabled = true;
    result.classList.remove('is-error');
    try {
        const data = await incidentsFetch('/api/admin/aiops/examples', { method: shown ? 'DELETE' : 'POST', body: '{}' });
        result.textContent = shown ? `Removed ${data.removed} example incident${data.removed === 1 ? '' : 's'}.` : `Added ${data.made} example incidents to the list. Close this panel to look at them.`;
        // the most urgent example is shown first
        if (!shown) incidentsSelected = null;
        await loadIncidents(true);
    } catch (error) {
        result.textContent = error.message;
        result.classList.add('is-error');
    } finally {
        renderIncidentExamplesBox();
    }
}

async function raiseTestIncident() {
    const button = document.getElementById('incidents-test-btn');
    if (button) button.disabled = true;
    try {
        const data = await incidentsFetch('/api/admin/aiops/test-incident', { method: 'POST', body: '{}' });
        incidentsSettingsStatus('Test incident opened. It closes by itself in 10 minutes.', '');
        if (data.incident && data.incident.id) incidentsSelected = String(data.incident.id);
        await loadIncidents(true);
    } catch (error) {
        incidentsSettingsStatus(error.message, 'error');
    } finally {
        if (button) button.disabled = false;
    }
}
// <Jun Kai end>
