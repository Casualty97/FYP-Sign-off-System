// Owner: Role 3, Jun Kai.
// Incidents panel on the System Health page: the incidents the anomaly detection opened (GET /api/admin/aiops/status
// and /incidents), their evidence and timeline, acknowledge / resolve / verdict, the test incident and the settings form.
// Loaded after health.js: loadHealth() and renderHealthPanels() call loadIncidents(), so it refreshes with the 30-second cycle.
// <Jun Kai start>
let incidentsStatus = null;         // the last answer of GET /status
let incidentsList = [];             // the last answer of GET /incidents?status=all
let incidentsError = null;          // message of the last failed load, cleared by the next good one
let incidentsLoading = false;
let incidentsReloadQueued = false;
let incidentsLoadedAt = 0;
let incidentsRecentOpen = false;    // "Resolved in the last 7 days" open or collapsed, kept for this page view only
let incidentsSettingsBusy = false;
let incidentsSummaryHtml = '';
let incidentsEmptyHtml = '';
let incidentsDetectors = [];        // [{ key, label, description }] from GET /settings
const incidentsRowHtml = new Map(); // id -> the row as last drawn
const incidentsJson = new Map();    // id -> the incident as last loaded; a change refreshes an open timeline
const incidentsEvents = new Map();  // id -> timeline events, or { error }
const incidentsExpanded = new Set();
const incidentsTimelineFull = new Set(); // ids whose long timeline is shown in full

const INCIDENT_SEVERITY = { critical: { tone: 'down', label: 'Critical' }, warn: { tone: 'warn', label: 'Attention' }, info: { tone: 'info', label: 'Info' } };
const INCIDENT_VERDICT_LABEL = { correct: 'Correct', 'not-useful': 'Not useful', 'false-alarm': 'False alarm' };
const INCIDENT_EVENT_LABEL = { opened: 'Opened', seen: 'Seen again', severity: 'Severity raised', acknowledged: 'Acknowledged', resolved: 'Resolved', reopened: 'Reopened', verdict: 'Marked', note: 'Note' };
const INCIDENT_DETECTOR_LABEL = {
    spike: 'Sudden spikes', timeOfDay: 'Unusual for the time of day', drift: 'Slow creep', disk: 'Disk filling up',
    services: 'Services down or slow', tablets: 'Named tablets offline', logs: 'Server errors', test: 'Test'
};
// what the main reading of each kind of evidence is called
const INCIDENT_VALUE_LABEL = { seconds_ago: 'Offline for', template: 'Times seen', errors: 'Errors', disk: 'Disk used', database_latency: 'Answer time' };
// the part a hardware reading belongs to, so the evidence says which one (the test incident's numbers are a made-up sample)
const INCIDENT_PART = { cpu: 'CPU', memory: 'Memory', gpu: 'GPU', disk: 'Disk', sample: 'Sample' };
const INCIDENT_PROCESS_LABEL = { server: 'the admin server', kiosk: 'the kiosk server' };
const INCIDENT_RANK = { critical: 0, warn: 1, info: 2 };
const INCIDENT_SENSITIVITY = [[1, 'Very low'], [2, 'Low'], [3, 'Normal'], [4, 'High'], [5, 'Very high']];
const INCIDENT_FIELD_ID = { enabled: 'incidents-enabled', quietHours: 'incidents-quiet', intervalSeconds: 'incidents-interval', retentionDays: 'incidents-retention', keepIncidentsDays: 'incidents-keep' };
const INCIDENT_ZONES = ['inc-meta', 'inc-timeline']; // the parts of a row that change often: swapped in place so focus and hover survive
const INCIDENT_FRESH_MS = 5000;     // a load this recent is not repeated (health.js asks more than once per cycle)
const INCIDENT_WEEK_MS = 7 * 24 * 3600 * 1000;
const INCIDENT_TIMELINE_FOLD = 8;   // a longer timeline shows its first 2 and last 4 entries until it is opened
const INCIDENT_CHEVRON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

const incidentIsNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const incidentIsOpen = (incident) => incident.status === 'open' || incident.status === 'acknowledged';
const incidentMs = (iso) => { const t = new Date(iso || '').getTime(); return Number.isNaN(t) ? null : t; };

// Server log lines quoted in an incident keep their words but not the emoji some old console messages carry
function incidentText(text) {
    return String(text === null || text === undefined ? '' : text).replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*/gu, '').replace(/ {2,}/g, ' ').trim();
}

function incidentWords(key) {
    const words = String(key || '').replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim().toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

// Critical first, then attention, then info; acknowledged after open; newest first. The order never depends on when
// an incident was last seen, so the rows stay where they are between refreshes.
function incidentOrder(a, b) {
    const rank = (i) => (INCIDENT_RANK[i.severity] === undefined ? 1 : INCIDENT_RANK[i.severity]);
    return rank(a) - rank(b) || (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1)
        || (incidentMs(b.opened_at) || 0) - (incidentMs(a.opened_at) || 0) || Number(b.id) - Number(a.id);
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

function incidentSpan(hours) {
    const h = Number(hours) || 0;
    if (h < 1) return 'under an hour';
    if (h < 48) return `${Math.round(h)} h`;
    return `${Math.round(h / 24)} days`;
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

function incidentAgo(iso, nowMs = Date.now()) {
    const t = incidentMs(iso);
    return t === null ? '–' : healthRelativeTime(Math.max(0, (nowMs - t) / 1000));
}

function incidentSeverityLabel(severity) {
    return (INCIDENT_SEVERITY[severity] || INCIDENT_SEVERITY.warn).label;
}

function incidentDetectorLabel(key) {
    const known = ((incidentsStatus && incidentsStatus.detectors) || []).find((d) => d.key === key);
    return (known && known.label) || INCIDENT_DETECTOR_LABEL[key] || incidentWords(key || 'detector');
}

function incidentsIsAdmin() {
    try { return sessionStorage.getItem('userRole') === 'system_admin'; } catch { return false; }
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

// ---- header pill, summary line, empty state ----

function incidentsStateFor(status, incidents, error) {
    if (error) return { tone: 'down', text: 'Unavailable' };
    if (!status) return { tone: 'muted', text: 'Loading' };
    if (status.enabled === false) return { tone: 'muted', text: 'Detection off' };
    const open = (incidents || []).filter(incidentIsOpen);
    if (open.length) return { tone: open.some((i) => i.severity === 'critical') ? 'down' : 'warn', text: `${open.length} open` };
    // "Learning" only while no detector is looking yet; one or two still learning is normal for days
    const states = (status.detectors || []).filter(incidentDetectorOn).map((d) => d.state);
    if (states.length && !states.includes('ok')) return { tone: 'info', text: states.includes('waiting') ? 'Starting' : 'Learning' };
    return { tone: 'ok', text: 'All clear' };
}

const incidentDetectorOn = (d) => d.enabled !== false && d.state !== 'off';

function incidentsSummaryText(status) {
    const detectors = Array.isArray(status.detectors) ? status.detectors : [];
    const count = (state) => detectors.filter((d) => d.state === state).length;
    const parts = [status.lastTickAt ? `Last check ${incidentClock(status.lastTickAt)}` : 'No check yet'];
    if (detectors.length) parts.push(`${detectors.filter(incidentDetectorOn).length} of ${detectors.length} detectors on`);
    if (count('learning')) parts.push(`${count('learning')} still learning`);
    if (count('no-data')) parts.push(`${count('no-data')} waiting for data`);
    if (count('muted')) parts.push(`${count('muted')} paused`);
    if (count('error')) parts.push(`${count('error')} failed`);
    const data = status.data || status.dataWindow || {};
    const spans = [];
    if (incidentIsNumber(data.sampleHours)) spans.push(`${incidentSpan(data.sampleHours)} of samples`);
    if (incidentIsNumber(data.healthRuns)) spans.push(`${data.healthRuns} health run${data.healthRuns === 1 ? '' : 's'}`);
    if (incidentIsNumber(data.logHours)) spans.push(`${incidentSpan(data.logHours)} of logs`);
    if (spans.length) parts.push(spans.join(', '));
    if (status.quietNow) parts.push('quiet hours (the policies say the kiosk is off)');
    return parts.join(' · ');
}

// How many tablets have a name: from the Tablets check on this page when it ran, else from the detector's note
function incidentsNamedTablets(status) {
    if (status.data && incidentIsNumber(status.data.namedTablets)) return status.data.namedTablets;
    const check = typeof healthTabletCheck === 'function' ? healthTabletCheck() : null;
    const devices = check && check.detail && Array.isArray(check.detail.devices) ? check.detail.devices : null;
    if (devices) return devices.filter((d) => d.name).length;
    const tablets = (status.detectors || []).find((d) => d.key === 'tablets');
    return tablets && /no named tablet/i.test(tablets.note || '') ? 0 : null;
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

function renderIncidentsState() {
    const pill = document.getElementById('incidents-state');
    if (!pill) return;
    const state = incidentsStateFor(incidentsStatus, incidentsList, incidentsError);
    const html = `<span class="ui-dot"></span>${state.text}`;
    if (pill.dataset.state !== html) {
        pill.dataset.state = html;
        pill.className = `ui-pill ui-pill-${state.tone}`;
        pill.innerHTML = html;
    }
}

function renderIncidentsSummary() {
    const box = document.getElementById('incidents-summary');
    if (!box) return;
    let html = '';
    if (incidentsError) html = `<p class="ui-note ui-note-warn">Could not reach the anomaly detection: ${escapeHtmlSafe(incidentsError)}</p>`;
    else if (incidentsStatus && incidentsStatus.enabled === false) html = '<p class="ui-note">Anomaly detection is off. Nothing is compared and no incident is opened. Open Settings to switch it on.</p>';
    else if (incidentsStatus) {
        const failed = incidentsStatus.lastError ? `<p class="ui-note ui-note-warn inc-warn">The last check did not finish: ${escapeHtmlSafe(incidentsStatus.lastError)}</p>` : '';
        html = `${failed}<span>${escapeHtmlSafe(incidentsSummaryText(incidentsStatus))}</span>`;
    }
    if (incidentsSummaryHtml !== html) {
        incidentsSummaryHtml = html;
        box.innerHTML = html;
    }
}

// ---- rows ----

// The numbers behind an incident in plain words. Only the fields listed here are shown: a field a detector adds later
// stays out until it gets a label, so a raw key name never reaches the page.
function incidentEvidenceRows(evidence) {
    const e = evidence && typeof evidence === 'object' ? evidence : {};
    const unit = typeof e.unit === 'string' ? e.unit : '';
    const has = (key) => e[key] !== null && e[key] !== undefined && e[key] !== '';
    const two = (n) => String(n).padStart(2, '0');
    const rows = [];
    const add = (label, text) => { if (text !== null && text !== undefined && String(text) !== '') rows.push([label, String(text)]); };
    const part = INCIDENT_PART[e.metric] || '';
    if (incidentIsNumber(e.value)) add(INCIDENT_VALUE_LABEL[e.metric] || (part ? `${part} now` : 'Reading'), e.metric === 'seconds_ago' ? incidentDuration(e.value * 60) : incidentWithUnit(e.value, unit));
    if (incidentIsNumber(e.baseline)) {
        const spread = incidentIsNumber(e.spread) && e.spread > 0 ? `, usually within ${incidentWithUnit(e.spread, unit)} of it` : '';
        // slow creep compares with the level before the climb started
        const usual = incidentIsNumber(e.slopePerHour) ? `${part || 'Level'} before the climb` : part ? `${part} usually` : 'Usual';
        add(usual, incidentWithUnit(e.baseline, unit) + spread);
    }
    if (incidentIsNumber(e.z)) add('Deviation', `${incidentNumber(Math.abs(e.z))} spreads ${e.z < 0 ? 'below' : 'above'} normal`);
    if (incidentIsNumber(e.windowSeconds) && e.windowSeconds > 0) add('Window', `the last ${incidentDuration(e.windowSeconds)}`);
    if (incidentIsNumber(e.samples) && incidentIsNumber(e.above)) add('Readings over the limit', `${e.above} of ${e.samples}`);
    if (incidentIsNumber(e.hour)) add('Hour compared', `${two(e.hour)}:00 to ${two((e.hour + 1) % 24)}:00`);
    if (has('baselineKind')) {
        const days = incidentIsNumber(e.baselineDays) ? ` (${e.baselineDays} earlier days)` : '';
        add('Compared with', e.baselineKind === 'weekday' ? `the same weekday${days}` : `this hour on earlier days${days}`);
    }
    if (incidentIsNumber(e.slopePerHour)) add('Rise per hour', incidentWithUnit(e.slopePerHour, unit));
    if (incidentIsNumber(e.hours)) add('Rising for', incidentDuration(e.hours * 3600));
    if (incidentIsNumber(e.percent)) add('Disk used', `${incidentNumber(e.percent)} %`);
    if (incidentIsNumber(e.totalGb)) add('Disk size', `${incidentNumber(e.totalGb)} GB`);
    if (incidentIsNumber(e.gbPerDay)) add('Growth per day', `${incidentNumber(e.gbPerDay)} GB`);
    if (incidentIsNumber(e.daysUntilFull)) add('Full in', `about ${incidentDuration(e.daysUntilFull * 86400)}`);
    if (incidentIsNumber(e.spanDays)) add('Measured over', `${incidentNumber(e.spanDays)} days`);
    if (incidentIsNumber(e.runs)) add('Failed checks in a row', incidentNumber(e.runs));
    if (has('since')) add('Since', incidentStamp(e.since));
    if (has('summary')) add('Last answer', e.summary);
    if (has('name')) add('Tablet', e.name);
    if (Array.isArray(e.names) && e.names.length) add('Tablets', e.names.join(', '));
    if (incidentIsNumber(e.limitMinutes)) add('Counts as offline after', incidentDuration(e.limitMinutes * 60));
    if (has('template')) add('Error shape', e.template);
    if (Array.isArray(e.top) && e.top.length) add('Most common', e.top.map((t) => `${t.template} (${t.count})`).join('; '));
    if (has('process')) add('Logged by', INCIDENT_PROCESS_LABEL[e.process] || e.process);
    if (has('firstSeen')) add('First seen', incidentStamp(e.firstSeen));
    return rows;
}

function incidentSparkCaption(points, unit) {
    const values = (Array.isArray(points) ? points : []).map((p) => (p && typeof p === 'object' ? p.v : p)).filter(incidentIsNumber);
    if (values.length < 2) return '';
    return `Last ${values.length} readings: lowest ${incidentWithUnit(Math.min(...values), unit)}, highest ${incidentWithUnit(Math.max(...values), unit)}`;
}

// Inline SVG, no axes: the line is stretched to the box, the strokes keep their width and the last point stays a round dot
function incidentSparkline(points, unit) {
    const values = (Array.isArray(points) ? points : []).map((p) => (p && typeof p === 'object' ? p.v : p)).filter(incidentIsNumber);
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const x = (i) => (3 + (i / (values.length - 1)) * 194).toFixed(1);
    const y = (v) => (32 - ((v - min) / span) * 28).toFixed(1);
    const last = values[values.length - 1];
    const end = `${x(values.length - 1)},${y(last)}`;
    const title = `Last ${values.length} readings, from ${incidentWithUnit(min, unit)} to ${incidentWithUnit(max, unit)}, now ${incidentWithUnit(last, unit)}`;
    return `<svg class="inc-spark" viewBox="0 0 200 36" preserveAspectRatio="none" role="img"><title>${escapeHtmlSafe(title)}</title>`
        + `<polyline points="${values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>`
        + `<polyline points="${end} ${end}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline></svg>`;
}

function incidentTimelineHtml(events, unit, id) {
    if (events === undefined) return '<li class="ui-empty">Loading the timeline</li>';
    if (!Array.isArray(events)) return `<li class="ui-empty">Could not load the timeline: ${escapeHtmlSafe(events && events.error ? events.error : 'unknown error')}</li>`;
    if (!events.length) return '<li class="ui-empty">No events yet</li>';
    const full = incidentsTimelineFull.has(String(id));
    const folded = events.length > INCIDENT_TIMELINE_FOLD && !full;
    const shown = folded ? events.slice(0, 2).concat([null], events.slice(-4)) : events;
    const more = events.length - 6;
    const toggle = events.length > INCIDENT_TIMELINE_FOLD
        ? `<li class="inc-timeline-more"><button type="button" class="health-card-link" data-act="timeline" aria-expanded="${full}">${full ? 'Show fewer entries' : `Show ${more} more entries`}</button></li>`
        : '';
    return shown.map((event) => {
        if (event === null) return toggle;
        const d = event.detail && typeof event.detail === 'object' ? event.detail : {};
        const by = d.by ? `by ${d.by}` : '';
        const detector = d.severity ? `by the detector (${incidentSeverityLabel(d.severity).toLowerCase()})` : 'by the detector';
        let type = INCIDENT_EVENT_LABEL[event.type] || incidentWords(event.type || 'event');
        let text = '';
        switch (event.type) {
            case 'opened': text = d.test ? `${by || 'by an admin'} as a test` : detector; break;
            case 'reopened': text = detector; break;
            case 'seen': text = `${incidentIsNumber(d.occurrences) ? `${d.occurrences} times so far` : ''}${incidentIsNumber(d.value) ? `, now ${incidentWithUnit(d.value, unit)}` : ''}`.replace(/^, /, ''); break;
            case 'severity': type = `Severity raised to ${incidentSeverityLabel(d.to)}`; text = d.from ? `from ${incidentSeverityLabel(d.from).toLowerCase()}` : ''; break;
            case 'acknowledged': text = by; break;
            case 'resolved':
                if (d.auto) text = d.reason === 'detector-off' ? 'Closed because its detector was switched off' : 'Resolved itself: the readings went back to normal';
                else text = [by, d.note ? `note: ${d.note}` : ''].filter(Boolean).join(', ');
                break;
            case 'verdict': type = `Marked ${(INCIDENT_VERDICT_LABEL[d.verdict] || d.verdict || '').toLowerCase()}`; text = by; break;
            case 'note': text = d.note || ''; break;
            default: text = '';
        }
        return `<li><span class="ui-time">${escapeHtmlSafe(incidentStamp(event.at))}</span><span class="ui-type">${escapeHtmlSafe(type)}</span><span class="ui-detail">${escapeHtmlSafe(text)}</span></li>`;
    }).join('') + (full ? toggle : '');
}

function incidentMetaHtml(incident, nowMs) {
    const parts = [incidentDetectorLabel(incident.detector), `opened ${incidentWhen(incident.opened_at, nowMs)}`];
    if (Number(incident.occurrences) > 1) parts.push(`seen ${Number(incident.occurrences)} times`);
    if (incident.status === 'resolved') {
        const by = incident.resolved_by === 'auto' ? ' by itself' : incident.resolved_by ? ` by ${incident.resolved_by}` : '';
        parts.push(`resolved ${incidentWhen(incident.resolved_at, nowMs)}${by}`);
    } else {
        parts.push(`last seen ${incidentAgo(incident.last_seen_at, nowMs)}`);
    }
    let html = escapeHtmlSafe(parts.join(' · '));
    if (incident.verdict) html += ` ${uiPill('muted', `Marked ${(INCIDENT_VERDICT_LABEL[incident.verdict] || incident.verdict).toLowerCase()}`)}`;
    return html;
}

function incidentDetailHtml(incident) {
    const id = String(incident.id);
    const evidence = incident.evidence && typeof incident.evidence === 'object' ? incident.evidence : {};
    const unit = typeof evidence.unit === 'string' ? evidence.unit : '';
    const rows = incidentEvidenceRows(evidence);
    const spark = incidentSparkline(evidence.points, unit);
    const kv = rows.length
        ? `<dl class="ui-kv">${rows.map(([k, v]) => `<dt>${escapeHtmlSafe(k)}</dt><dd>${escapeHtmlSafe(incidentText(v))}</dd>`).join('')}</dl>`
        : '<p class="ui-help">No numbers were stored for this incident.</p>';
    const verdicts = Object.entries(INCIDENT_VERDICT_LABEL).map(([key, label]) => {
        const chosen = incident.verdict === key;
        return `<button type="button" class="ui-btn ui-btn-secondary${chosen ? ' is-chosen' : ''}" data-act="verdict" data-verdict="${key}" aria-pressed="${chosen}">${label}</button>`;
    }).join('');
    return `<div class="inc-detail" id="incident-detail-${id}">
                <div>
                    <div class="ui-section-title">Evidence</div>
                    ${kv}${spark}${spark ? `<span class="ui-fact-hint">${escapeHtmlSafe(incidentSparkCaption(evidence.points, unit))}</span>` : ''}
                </div>
                <div>
                    <div class="ui-section-title">Timeline</div>
                    <div class="inc-timeline"><ul class="ui-events">${incidentTimelineHtml(incidentsEvents.get(id), unit, id)}</ul></div>
                    <div class="inc-verdict">
                        <div class="ui-section-title">Was this incident useful?</div>
                        <div class="ui-row">${verdicts}</div>
                    </div>
                </div>
            </div>`;
}

function renderIncidentRow(incident, nowMs = Date.now()) {
    const id = String(incident.id);
    const severity = INCIDENT_SEVERITY[incident.severity] || INCIDENT_SEVERITY.warn;
    const expanded = incidentsExpanded.has(id);
    const title = escapeHtmlSafe(incidentText(incident.title || 'Incident'));
    const classes = ['inc-row', `is-${INCIDENT_SEVERITY[incident.severity] ? incident.severity : 'warn'}`];
    if (incident.status === 'acknowledged') classes.push('is-acknowledged');
    if (incident.status === 'resolved') classes.push('is-resolved');
    const pills = uiPill(severity.tone, severity.label) + (incident.status === 'acknowledged' ? uiPill('muted', 'Acknowledged') : '');
    const actions = [
        incident.status === 'open' ? '<button type="button" class="ui-btn ui-btn-secondary" data-act="acknowledge">Acknowledge</button>' : '',
        incidentIsOpen(incident) ? '<button type="button" class="ui-btn ui-btn-secondary" data-act="resolve">Resolve</button>' : '',
        `<button type="button" class="ui-btn ui-btn-icon inc-toggle" data-act="toggle" aria-expanded="${expanded}" aria-controls="incident-detail-${id}" aria-label="Details of ${title}" title="Details">${INCIDENT_CHEVRON}</button>`
    ].join('');
    return `<div class="${classes.join(' ')}" data-id="${id}">
            <div class="inc-pills">${pills}</div>
            <div class="inc-main">
                <div class="inc-title">${title}</div>
                <div class="inc-meta">${incidentMetaHtml(incident, nowMs)}</div>
                ${incident.explanation ? `<div class="inc-text">${escapeHtmlSafe(incidentText(incident.explanation))}</div>` : ''}
            </div>
            <div class="inc-actions ui-row">${actions}</div>
            ${expanded ? incidentDetailHtml(incident) : `<div class="inc-detail" id="incident-detail-${id}" hidden></div>`}
        </div>`;
}

// The zones that differ between two drawings of the same row, or null when something else changed too
function incidentsZoneDiff(before, after) {
    let a = before;
    let b = after;
    const updates = [];
    for (const zone of INCIDENT_ZONES) {
        const re = new RegExp(`<div class="${zone}">([\\s\\S]*?)</div>`);
        const ma = re.exec(a);
        const mb = re.exec(b);
        if (!ma && !mb) continue;
        if (!ma || !mb) return null;
        if (ma[1] !== mb[1]) updates.push([zone, mb[1]]);
        a = a.replace(ma[0], zone);
        b = b.replace(mb[0], zone);
    }
    return a === b ? updates : null;
}

function incidentsElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
}

// Keyed by incident id: a row is redrawn only when its text changed, and only its changed zones when nothing else did
function incidentsPatchRows(container, incidents, nowMs) {
    const byId = new Map([...container.children].map((el) => [el.dataset.id, el]));
    const keep = new Set();
    incidents.forEach((incident, i) => {
        const id = String(incident.id);
        const html = renderIncidentRow(incident, nowMs);
        const before = incidentsRowHtml.get(id);
        let el = byId.get(id);
        if (el && before !== html) {
            const zones = before ? incidentsZoneDiff(before, html) : null;
            const targets = zones ? zones.map(([zone, inner]) => [el.querySelector(`.${zone}`), inner]) : null;
            if (targets && targets.every(([node]) => node)) {
                targets.forEach(([node, inner]) => { node.innerHTML = inner; });
            } else {
                const fresh = incidentsElement(html);
                el.replaceWith(fresh);
                el = fresh;
            }
        } else if (!el) {
            el = incidentsElement(html);
        }
        incidentsRowHtml.set(id, html);
        keep.add(id);
        if (container.children[i] !== el) container.insertBefore(el, container.children[i] || null);
    });
    for (const [id, el] of byId) if (!keep.has(id)) el.remove();
}

// Focus lost to a redraw comes back to the same button of the same row (or its first action)
function incidentsFocusMemo() {
    const active = document.activeElement;
    const row = active && active.closest ? active.closest('.inc-row') : null;
    if (!row) return null;
    return { id: row.dataset.id, act: active.dataset.act || '', verdict: active.dataset.verdict || '' };
}

function incidentsRefocus(memo) {
    if (!memo || document.activeElement !== document.body) return;
    const row = document.querySelector(`#health-incidents-card .inc-row[data-id="${memo.id}"]`);
    if (!row) return;
    const same = memo.act ? row.querySelector(`[data-act="${memo.act}"]${memo.verdict ? `[data-verdict="${memo.verdict}"]` : ''}`) : null;
    const target = same || row.querySelector('.inc-actions .ui-btn');
    if (target) target.focus();
}

function renderIncidentsList(nowMs) {
    const list = document.getElementById('incidents-list');
    if (!list || !incidentsStatus) return;
    const open = incidentsList.filter(incidentIsOpen).sort(incidentOrder);
    if (open.length) {
        const empty = list.querySelector('.inc-empty');
        if (empty) empty.remove();
        incidentsEmptyHtml = '';
        incidentsPatchRows(list, open, nowMs);
        return;
    }
    const html = `<div class="inc-empty"><strong>No open incidents.</strong><span>${escapeHtmlSafe(incidentsWatchingText(incidentsStatus, incidentsNamedTablets(incidentsStatus)))}</span></div>`;
    if (incidentsEmptyHtml !== html) {
        incidentsEmptyHtml = html;
        list.innerHTML = html;
    }
}

function renderIncidentsRecent(nowMs) {
    const box = document.getElementById('incidents-recent');
    if (!box || !incidentsStatus) return;
    const rows = incidentsList.filter((i) => i.status === 'resolved' && (incidentMs(i.resolved_at) || 0) >= nowMs - INCIDENT_WEEK_MS);
    if (!rows.length) {
        if (box.innerHTML) box.innerHTML = '';
        return;
    }
    if (!box.querySelector('.inc-recent-list')) {
        box.innerHTML = '<div class="inc-recent-head"><div class="ui-section-title">Resolved in the last 7 days</div>'
            + '<button type="button" class="ui-btn ui-btn-secondary" data-act="recent" aria-expanded="false"></button></div>'
            + '<div class="inc-list inc-recent-list" hidden></div>';
    }
    const button = box.querySelector('[data-act="recent"]');
    const list = box.querySelector('.inc-recent-list');
    const text = incidentsRecentOpen ? 'Hide' : `Show ${rows.length}`;
    if (button.textContent !== text) button.textContent = text;
    button.setAttribute('aria-expanded', String(incidentsRecentOpen));
    list.hidden = !incidentsRecentOpen;
    if (incidentsRecentOpen) incidentsPatchRows(list, rows, nowMs);
    else if (list.children.length) list.innerHTML = '';
}

function renderIncidents() {
    if (!document.getElementById('incidents-list')) return;
    const memo = incidentsFocusMemo();
    const nowMs = Date.now();
    renderIncidentsState();
    renderIncidentsSummary();
    renderIncidentsList(nowMs);
    renderIncidentsRecent(nowMs);
    incidentsRefocus(memo);
}

// ---- loading ----

async function loadIncidentEvents(id) {
    const key = String(id);
    try {
        const data = await incidentsFetch(`/api/admin/aiops/incidents/${encodeURIComponent(key)}`);
        incidentsEvents.set(key, Array.isArray(data.events) ? data.events : []);
    } catch (error) {
        incidentsEvents.set(key, { error: error.message });
    }
}

// Forget what belongs to incidents the server no longer lists
function incidentsForgetGone(incidents) {
    const ids = new Set(incidents.map((i) => String(i.id)));
    for (const map of [incidentsRowHtml, incidentsJson, incidentsEvents]) for (const id of [...map.keys()]) if (!ids.has(id)) map.delete(id);
    for (const set of [incidentsExpanded, incidentsTimelineFull]) for (const id of [...set]) if (!ids.has(id)) set.delete(id);
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
        incidentsList = Array.isArray(list.incidents) ? list.incidents : [];
        incidentsError = null;
        incidentsForgetGone(incidentsList);
        const changed = incidentsList.filter((i) => incidentsExpanded.has(String(i.id)) && incidentsJson.get(String(i.id)) !== JSON.stringify(i));
        for (const incident of incidentsList) incidentsJson.set(String(incident.id), JSON.stringify(incident));
        await Promise.all(changed.map((i) => loadIncidentEvents(i.id)));
    } catch (error) {
        console.warn('[aiops] Could not load the incidents:', error.message);
        incidentsError = error.message;
    } finally {
        incidentsLoadedAt = Date.now();
        incidentsLoading = false;
        renderIncidents();
        if (incidentsReloadQueued) {
            incidentsReloadQueued = false;
            loadIncidents(true);
        }
    }
}

// ---- actions ----

async function toggleIncidentDetail(id) {
    const key = String(id);
    const open = !incidentsExpanded.has(key);
    if (open) incidentsExpanded.add(key);
    else incidentsExpanded.delete(key);
    renderIncidents();
    if (open && !incidentsEvents.has(key)) {
        await loadIncidentEvents(key);
        renderIncidents();
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
        incidentsEvents.delete(String(id)); // the timeline grew: fetched again with the list
    } catch (error) {
        if (error.status !== 404) showNotification(error.message, 'error');
    } finally {
        if (button) button.disabled = false;
        await loadIncidents(true);
    }
}

function toggleIncidentsRecent() {
    incidentsRecentOpen = !incidentsRecentOpen;
    renderIncidents();
    const button = document.querySelector('#incidents-recent [data-act="recent"]');
    if (button) button.focus();
}

async function raiseTestIncident() {
    const button = document.getElementById('incidents-test-btn');
    if (button) button.disabled = true;
    try {
        await incidentsFetch('/api/admin/aiops/test-incident', { method: 'POST', body: '{}' });
        showNotification('Test incident opened. It resolves itself in 10 minutes.', 'success');
        await loadIncidents(true);
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        if (button) button.disabled = false;
    }
}

function bindIncidentsPanel() {
    const card = document.getElementById('health-incidents-card');
    if (!card || card.dataset.bound) return;
    card.dataset.bound = '1';
    card.addEventListener('click', (event) => {
        const button = event.target.closest('[data-act]');
        if (!button || button.disabled) return;
        const row = button.closest('.inc-row');
        const id = row ? row.dataset.id : null;
        switch (button.dataset.act) {
            case 'toggle': toggleIncidentDetail(id); break;
            case 'acknowledge': incidentAction(id, 'acknowledge', button); break;
            case 'resolve': incidentAction(id, 'resolve', button); break;
            case 'verdict': incidentAction(id, 'verdict', button, { verdict: button.dataset.verdict }); break;
            case 'recent': toggleIncidentsRecent(); break;
            case 'timeline':
                if (incidentsTimelineFull.has(String(id))) incidentsTimelineFull.delete(String(id));
                else incidentsTimelineFull.add(String(id));
                renderIncidents();
                break;
            default: break;
        }
    });
    const settings = document.getElementById('incidents-settings');
    if (!settings) return;
    settings.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            toggleIncidentSettings(false);
        }
    });
    settings.addEventListener('change', (event) => {
        const box = event.target.closest('input[data-field="enabled"]');
        const row = box && box.closest('.inc-detector');
        if (row) row.classList.toggle('is-off', !box.checked);
    });
}

// ---- settings form ----

function toggleIncidentSettings(force) {
    const panel = document.getElementById('incidents-settings');
    const button = document.getElementById('incidents-settings-btn');
    if (!panel) return;
    bindIncidentsPanel();
    const open = typeof force === 'boolean' ? force : panel.hidden;
    const hadFocus = panel.contains(document.activeElement);
    panel.hidden = !open;
    if (button) button.setAttribute('aria-expanded', String(open));
    if (open) fillIncidentSettings();
    else if (hadFocus && button) button.focus();
}

function incidentsSettingsHelp(text, isError) {
    const help = document.getElementById('incidents-settings-help');
    if (!help) return;
    help.textContent = text;
    help.classList.toggle('is-error', !!isError);
    if (isError) help.setAttribute('role', 'alert');
    else help.removeAttribute('role');
}

function incidentsSetFormEnabled(on) {
    const panel = document.getElementById('incidents-settings');
    if (panel) panel.querySelectorAll('input, select').forEach((el) => { el.disabled = !on; });
    const save = document.getElementById('incidents-settings-save');
    if (save) save.disabled = !on;
}

function incidentsClearInvalid() {
    const panel = document.getElementById('incidents-settings');
    if (panel) panel.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}

// A saved value outside the preset list (a hand-edited file) gets its own option instead of being lost
function incidentsSelectValue(id, value, label) {
    const select = document.getElementById(id);
    if (!select) return;
    const text = String(value);
    if (![...select.options].some((option) => option.value === text)) select.add(new Option(label, text));
    select.value = text;
}

function renderIncidentDetectors(chosen) {
    const box = document.getElementById('incidents-detectors');
    if (!box) return;
    box.innerHTML = incidentsDetectors.map((d) => {
        const conf = (chosen && chosen[d.key]) || {};
        const on = conf.enabled !== false;
        const key = escapeHtmlSafe(d.key);
        const label = escapeHtmlSafe(d.label || incidentWords(d.key));
        const options = INCIDENT_SENSITIVITY.map(([value, name]) => `<option value="${value}"${Number(conf.sensitivity) === value || (!incidentIsNumber(conf.sensitivity) && value === 3) ? ' selected' : ''}>${name}</option>`).join('');
        return `<div class="inc-detector${on ? '' : ' is-off'}" data-key="${key}">
                    <label class="inc-detector-main">
                        <span class="ui-switch"><input type="checkbox" data-detector="${key}" data-field="enabled"${on ? ' checked' : ''} aria-label="${label}"><span class="ui-switch-track"></span></span>
                        <span class="inc-detector-text"><strong>${label}</strong><small>${escapeHtmlSafe(d.description || '')}</small></span>
                    </label>
                    <select class="ui-select" data-detector="${key}" data-field="sensitivity" aria-label="Sensitivity of ${label}">${options}</select>
                </div>`;
    }).join('');
}

async function fillIncidentSettings() {
    const admin = incidentsIsAdmin();
    incidentsSetFormEnabled(false);
    incidentsClearInvalid();
    incidentsSettingsHelp('Loading the saved settings', false);
    try {
        const data = await incidentsFetch('/api/admin/aiops/settings');
        const settings = data.settings || {};
        incidentsDetectors = Array.isArray(data.detectors) && data.detectors.length
            ? data.detectors
            : Object.keys(INCIDENT_DETECTOR_LABEL).filter((key) => key !== 'test').map((key) => ({ key, label: INCIDENT_DETECTOR_LABEL[key], description: '' }));
        renderIncidentDetectors(settings.detectors || {});
        const enabled = document.getElementById('incidents-enabled');
        if (enabled) enabled.checked = settings.enabled !== false;
        const quiet = document.getElementById('incidents-quiet');
        if (quiet) quiet.checked = settings.quietHours !== false;
        const interval = Number(settings.intervalSeconds) || 60;
        const retention = Number(settings.retentionDays) || 30;
        const keep = Number(settings.keepIncidentsDays) || 90;
        incidentsSelectValue('incidents-interval', interval, `${incidentDuration(interval)} (current)`);
        incidentsSelectValue('incidents-retention', retention, `${retention} days (current)`);
        incidentsSelectValue('incidents-keep', keep, `${keep} days (current)`);
        incidentsSetFormEnabled(admin);
        incidentsSettingsHelp(admin ? '' : 'Only a system administrator can change these.', false);
    } catch (error) {
        incidentsSettingsHelp(`Could not load the settings: ${error.message}`, true);
    }
}

function readIncidentSettings() {
    const checked = (id) => { const el = document.getElementById(id); return !!(el && el.checked); };
    const number = (id) => { const el = document.getElementById(id); return el ? Number(el.value) : null; };
    const detectors = {};
    document.querySelectorAll('#incidents-detectors .inc-detector').forEach((row) => {
        const on = row.querySelector('[data-field="enabled"]');
        const sensitivity = row.querySelector('[data-field="sensitivity"]');
        detectors[row.dataset.key] = { enabled: !!(on && on.checked), sensitivity: sensitivity ? Number(sensitivity.value) : 3 };
    });
    return {
        enabled: checked('incidents-enabled'),
        quietHours: checked('incidents-quiet'),
        intervalSeconds: number('incidents-interval'),
        retentionDays: number('incidents-retention'),
        keepIncidentsDays: number('incidents-keep'),
        detectors
    };
}

// The control behind a dotted field name from a 400 answer ('intervalSeconds', 'detectors.spike.sensitivity')
function incidentsFieldControl(field) {
    const parts = String(field || '').split('.');
    if (parts[0] === 'detectors' && parts.length === 3 && /^[A-Za-z]+$/.test(parts[1]) && /^[a-z]+$/i.test(parts[2])) {
        return document.querySelector(`#incidents-detectors [data-detector="${parts[1]}"][data-field="${parts[2]}"]`);
    }
    return INCIDENT_FIELD_ID[parts[0]] ? document.getElementById(INCIDENT_FIELD_ID[parts[0]]) : null;
}

async function saveIncidentSettings() {
    if (incidentsSettingsBusy || !incidentsIsAdmin()) return;
    const payload = readIncidentSettings();
    const buttons = [document.getElementById('incidents-settings-save'), document.getElementById('incidents-settings-cancel')].filter(Boolean);
    incidentsSettingsBusy = true;
    buttons.forEach((b) => { b.disabled = true; });
    incidentsClearInvalid();
    incidentsSettingsHelp('', false);
    try {
        await incidentsFetch('/api/admin/aiops/settings', { method: 'PUT', body: JSON.stringify(payload) });
        showNotification('Anomaly detection settings saved', 'success');
        toggleIncidentSettings(false);
        loadIncidents(true);
    } catch (error) {
        incidentsSettingsHelp(error.message, true);
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
// <Jun Kai end>
