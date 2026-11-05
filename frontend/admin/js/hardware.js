// Owner: Role 3, Jun Kai.
// Hardware page: stat tiles from GET /api/admin/hardware/overview, four Chart.js line graphs with the
// forecast from GET /api/admin/hardware/series?range=..., the table view and the sampling settings.
// Charts are created once and updated in place, so nothing on the page jumps while data arrives.
// <Jun Kai start>
let hardwareRange = '24h';
let hardwareTimer = null;
let hardwareLoading = false;
let hardwareDrawn = false;
let hardwareTableOpen = false;
let hardwareSettingsFilled = false;
let hardwarePendingReload = false;
let hardwareLastPoints = [];
const hardwareCharts = {};

const HARDWARE_METRICS = ['cpu', 'memory', 'gpu', 'disk'];
const HARDWARE_ACCENT = '#2a78d6';
const HARDWARE_RANGES = {
    '1h': { seconds: 3600, tick: 10 * 60000, text: 'Averages per minute, last hour', forecast: false },
    '6h': { seconds: 6 * 3600, tick: 3600000, text: 'Averages per 5 minutes, last 6 hours', forecast: false },
    '24h': { seconds: 24 * 3600, tick: 4 * 3600000, text: 'Averages per 10 minutes, last 24 hours', forecast: true },
    '7d': { seconds: 7 * 86400, tick: 86400000, text: 'Averages per hour, last 7 days', forecast: true },
    '30d': { seconds: 30 * 86400, tick: 5 * 86400000, text: 'Averages per 4 hours, last 30 days', forecast: true }
};
const HARDWARE_REDUCE_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const HARDWARE_GPU_SOURCE = { 'nvidia-smi': 'nvidia-smi', 'windows-counters': 'Windows performance counters', none: 'No GPU reading on this PC', detecting: 'Looking for a GPU' };
// Sampling card: each select has presets plus Custom; the units turn the typed number into the stored one
const HARDWARE_SETTING_FIELDS = {
    interval: { key: 'intervalSeconds', words: [[60, 'minute'], [1, 'second']] },
    retention: { key: 'retentionDays', words: [[1, 'day']] },
    horizon: { key: 'forecastHours', words: [[24, 'day'], [1, 'hour']] }
};
let hardwareLimits = { intervalSeconds: [15, 600], retentionDays: [1, 365], forecastHours: [1, 168] };

function hardwareTheme() {
    const css = getComputedStyle(document.documentElement);
    const v = (name, fallback) => (css.getPropertyValue(name) || '').trim() || fallback;
    return { text: v('--theme-text-color', '#1e293b'), muted: v('--color-dark-gray', '#64748b'), grid: v('--theme-border-color', '#e2e8f0'), card: v('--theme-card-bg', '#ffffff') };
}

function hardwareTimeLabel(ms, withDate) {
    const d = new Date(ms);
    const time = d.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
    return withDate ? `${d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })} ${time}` : time;
}

function hardwareAgo(iso) {
    if (!iso) return null;
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 90) return `${seconds} s ago`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
    return `${Math.round(seconds / 3600)} h ago`;
}

function hardwareTone(percent) {
    return percent >= 95 ? 'down' : percent >= 85 ? 'warn' : 'ok';
}

// Round ticks on the time axis (every 10 min, hour, 4 h, day or 5 days, aligned to local time)
function hardwareBuildTicks(scale) {
    const step = HARDWARE_RANGES[(scale.chart && scale.chart.$hardwareRange) || hardwareRange].tick;
    const offset = new Date(scale.min).getTimezoneOffset() * 60000;
    const ticks = [];
    for (let t = Math.ceil((scale.min - offset) / step) * step + offset; t <= scale.max; t += step) ticks.push({ value: t });
    scale.ticks = ticks;
}

// Draws the "now" hairline that separates measured values from the forecast, and the hover crosshair
const hardwareGuidePlugin = {
    id: 'hardwareGuide',
    afterDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales.x) return;
        const theme = chart.$hardwareTheme || hardwareTheme();
        const line = (x, color, label) => {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.moveTo(x, chartArea.top);
            ctx.lineTo(x, chartArea.bottom);
            ctx.stroke();
            if (label) {
                ctx.fillStyle = theme.muted;
                ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(label, x + 4, chartArea.top + 11);
            }
        };
        ctx.save();
        if (chart.$hardwareNow) {
            const x = scales.x.getPixelForValue(chart.$hardwareNow);
            if (x >= chartArea.left && x <= chartArea.right) line(x, theme.grid, 'now');
        }
        const active = chart.getActiveElements();
        if (active.length) line(active[0].element.x, theme.muted, null);
        ctx.restore();
    }
};

function hardwareChartConfig(key) {
    const theme = hardwareTheme();
    const series = (label, dash) => ({
        label, data: [], borderColor: HARDWARE_ACCENT, borderWidth: 2, borderDash: dash, borderCapStyle: 'round', borderJoinStyle: 'round',
        pointRadius: 0, pointHitRadius: 16, pointHoverRadius: 4, pointHoverBackgroundColor: HARDWARE_ACCENT, pointHoverBorderColor: theme.card, pointHoverBorderWidth: 2,
        tension: 0.25, spanGaps: false, fill: false
    });
    const band = (fill) => ({ label: 'band', data: [], borderWidth: 0, pointRadius: 0, pointHitRadius: 0, pointHoverRadius: 0, backgroundColor: 'rgba(42, 120, 214, 0.10)', fill, isBand: true, tension: 0.25 });
    return {
        type: 'line',
        data: { datasets: [series('Measured', []), series('Forecast', [5, 4]), band(false), band('-1')] },
        options: {
            parsing: false,
            responsive: true,
            maintainAspectRatio: false,
            animation: HARDWARE_REDUCE_MOTION ? false : { duration: 300 },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            layout: { padding: { top: 6, right: 10 } },
            scales: {
                x: {
                    type: 'linear',
                    afterBuildTicks: hardwareBuildTicks,
                    ticks: { maxRotation: 0, autoSkip: true, color: theme.muted, font: { size: 11 }, padding: 6, callback(value) { const key = (this.chart && this.chart.$hardwareRange) || hardwareRange; return hardwareTimeLabel(value, key === '7d' || key === '30d'); } },
                    grid: { display: false },
                    border: { color: theme.grid }
                },
                y: {
                    min: 0, max: 100,
                    ticks: { stepSize: 25, color: theme.muted, font: { size: 11 }, padding: 6, callback: (value) => `${value}%` },
                    grid: { color: theme.grid, drawTicks: false },
                    border: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    filter: (item) => !item.dataset.isBand,
                    backgroundColor: '#0f172a', titleColor: '#cbd5e1', bodyColor: '#f8fafc', padding: 10, displayColors: false, titleFont: { size: 11, weight: '500' }, bodyFont: { size: 13, weight: '600' },
                    callbacks: {
                        title: (items) => (items.length ? hardwareTimeLabel(items[0].parsed.x, true) : ''),
                        label: (item) => `${item.parsed.y === null || item.parsed.y === undefined ? '–' : `${item.parsed.y.toFixed(1)}%`}  ${item.dataset.label.toLowerCase()}`
                    }
                }
            }
        },
        plugins: [hardwareGuidePlugin]
    };
}

function ensureHardwareCharts() {
    if (typeof Chart === 'undefined') return false;
    for (const key of HARDWARE_METRICS) {
        const canvas = document.getElementById(`hardware-${key}-chart`);
        if (!canvas) continue;
        if (!hardwareCharts[key]) hardwareCharts[key] = new Chart(canvas, hardwareChartConfig(key));
        else hardwareCharts[key].resize();
    }
    return true;
}

function renderHardwareSeries(data) {
    const points = data.points || [];
    const rangeKey = HARDWARE_RANGES[data.range] ? data.range : hardwareRange;
    const range = HARDWARE_RANGES[rangeKey];
    const forecast = data.forecast || {};
    const theme = hardwareTheme();
    const now = Date.now();
    const lastT = points.length ? points[points.length - 1].t : null;
    const showForecast = range.forecast && lastT !== null;
    const horizonLimit = lastT === null ? now : lastT + range.seconds * 1000; // the forecast never squeezes the history
    hardwareLastPoints = points;
    const note = document.getElementById('hardware-series-note');
    if (note) note.textContent = points.length ? range.text : `${range.text} (no samples yet)`;
    if (typeof Chart === 'undefined') {
        for (const key of HARDWARE_METRICS) {
            const empty = document.getElementById(`hardware-${key}-empty`);
            if (empty) { empty.hidden = false; empty.textContent = 'The graph library did not load (no internet). Use Table view.'; }
        }
        return;
    }
    for (const key of HARDWARE_METRICS) {
        const chart = hardwareCharts[key];
        if (!chart) continue;
        const history = points.map((p) => ({ x: p.t, y: p[key] }));
        const [measured, projected, low, high] = chart.data.datasets;
        measured.data = history;
        let horizonEnd = now;
        const fc = forecast[key];
        const lastValue = history.length ? history[history.length - 1].y : null;
        const shown = fc && fc.points ? fc.points.filter((p) => p.t <= horizonLimit) : [];
        if (showForecast && key === 'disk' && forecast.disk && forecast.disk.gbPerDay !== null && lastValue !== null && forecast.disk.totalGb) {
            const hours = Math.min(forecast.horizonHours || 24, range.seconds / 3600);
            const end = lastT + hours * 3600000;
            const endValue = Math.min(100, Math.max(0, lastValue + (forecast.disk.gbPerDay / forecast.disk.totalGb) * 100 * (hours / 24)));
            projected.data = [{ x: lastT, y: lastValue }, { x: end, y: endValue }];
            low.data = []; high.data = [];
            horizonEnd = end;
        } else if (showForecast && shown.length && lastValue !== null) {
            projected.data = [{ x: lastT, y: lastValue }, ...shown.map((p) => ({ x: p.t, y: p.value }))];
            low.data = [{ x: lastT, y: lastValue }, ...shown.map((p) => ({ x: p.t, y: p.low }))];
            high.data = [{ x: lastT, y: lastValue }, ...shown.map((p) => ({ x: p.t, y: p.high }))];
            horizonEnd = shown[shown.length - 1].t;
        } else {
            projected.data = []; low.data = []; high.data = [];
        }
        chart.$hardwareNow = showForecast && projected.data.length ? lastT : null;
        chart.$hardwareTheme = theme;
        chart.$hardwareRange = rangeKey;
        chart.options.scales.x.min = now - range.seconds * 1000;
        chart.options.scales.x.max = horizonEnd;
        chart.options.scales.x.ticks.color = theme.muted;
        chart.options.scales.y.ticks.color = theme.muted;
        chart.options.scales.y.grid.color = theme.grid;
        chart.update(hardwareDrawn ? 'none' : undefined);
        const empty = document.getElementById(`hardware-${key}-empty`);
        if (empty) {
            const hasValue = history.some((p) => p.y !== null && p.y !== undefined);
            empty.hidden = hasValue;
            empty.textContent = key === 'gpu' && !hasValue && points.length ? 'No GPU reading on this PC' : 'Waiting for samples';
        }
    }
    hardwareDrawn = true;
}

function renderHardwareTiles(overview) {
    const latest = overview.latest;
    const sampler = overview.sampler || {};
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const meter = (key, percent) => {
        const el = document.getElementById(`hardware-${key}-meter`);
        if (!el) return;
        el.style.width = percent === null || percent === undefined ? '0%' : `${Math.max(2, percent)}%`;
        el.className = `hw-meter-fill${percent === null || percent === undefined ? '' : ` hw-meter-${hardwareTone(percent)}`}`;
    };
    const gb = (mb) => (mb / 1024).toFixed(1);
    const pill = document.getElementById('hardware-sampler-pill');
    const pillState = sampler.lastError ? ['down', 'Sampler error'] : sampler.running ? ['ok', `Sampling every ${sampler.intervalSeconds} s`] : ['muted', 'Sampler off'];
    if (pill) { pill.className = `ui-pill ui-pill-${pillState[0]}`; pill.innerHTML = `<span class="ui-dot"></span>${escapeHtmlSafe(pillState[1])}`; }
    if (!latest) {
        for (const key of HARDWARE_METRICS) { set(`hardware-${key}-value`, '–'); meter(key, null); }
        const waiting = sampler.lastError ? sampler.lastError : 'Waiting for the first sample (about 10 seconds after the server starts)';
        set('hardware-cpu-hint', waiting);
        set('hardware-memory-hint', '');
        set('hardware-disk-hint', '');
        set('hardware-gpu-hint', HARDWARE_GPU_SOURCE[sampler.gpu && sampler.gpu.source] || '');
        return;
    }
    const ago = hardwareAgo(latest.at);
    set('hardware-cpu-value', latest.cpu === null || latest.cpu === undefined ? '–' : latest.cpu.toFixed(0));
    meter('cpu', latest.cpu);
    set('hardware-cpu-hint', latest.cpu === null || latest.cpu === undefined ? 'No CPU reading in the last sample' : `Average over the last interval, sampled ${ago}`);
    set('hardware-memory-value', latest.memory ? latest.memory.percent.toFixed(0) : '–');
    meter('memory', latest.memory ? latest.memory.percent : null);
    set('hardware-memory-hint', latest.memory ? `${gb(latest.memory.usedMb)} of ${gb(latest.memory.totalMb)} GB in use` : '');
    set('hardware-disk-value', latest.disk ? latest.disk.percent.toFixed(0) : '–');
    meter('disk', latest.disk ? latest.disk.percent : null);
    set('hardware-disk-hint', latest.disk ? `${latest.disk.usedGb} of ${latest.disk.totalGb} GB used on the project drive` : '');
    if (latest.gpu && latest.gpu.percent !== null && latest.gpu.percent !== undefined) {
        set('hardware-gpu-value', latest.gpu.percent.toFixed(0));
        meter('gpu', latest.gpu.percent);
        const memoryText = latest.gpu.memoryUsedMb ? `${gb(latest.gpu.memoryUsedMb)} GB${latest.gpu.memoryTotalMb ? ` of ${gb(latest.gpu.memoryTotalMb)} GB` : ''} memory in use` : '';
        const name = sampler.gpu && sampler.gpu.name ? sampler.gpu.name : '';
        set('hardware-gpu-hint', [name, memoryText].filter(Boolean).join(', '));
    } else {
        set('hardware-gpu-value', '–');
        meter('gpu', null);
        set('hardware-gpu-hint', HARDWARE_GPU_SOURCE[sampler.gpu && sampler.gpu.source] || 'No GPU reading on this PC');
    }
}

function renderHardwareForecast(forecast, latest) {
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const hours = (forecast && forecast.horizonHours) || 24;
    const horizon = hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? '' : 's'}` : `${hours} h`;
    set('hardware-forecast-method', forecast && forecast.method ? forecast.method : 'Statistics only, no AI.');
    for (const key of ['cpu', 'memory', 'gpu']) {
        set(`hardware-fc-${key}-label`, `${key === 'cpu' ? 'CPU' : key === 'gpu' ? 'GPU' : 'Memory'} in ${horizon}`);
        const fc = forecast && forecast[key];
        if (!fc || !fc.points || !fc.points.length) {
            set(`hardware-fc-${key}`, '–');
            set(`hardware-fc-${key}-hint`, key === 'gpu' && latest && !latest.gpu ? 'No GPU reading' : 'Needs about an hour of samples');
            continue;
        }
        const end = fc.points[fc.points.length - 1];
        const current = latest && (key === 'cpu' ? latest.cpu : latest[key] && latest[key].percent);
        set(`hardware-fc-${key}`, `${end.value.toFixed(0)}%`);
        set(`hardware-fc-${key}-hint`, `${current === null || current === undefined ? '' : `now ${Number(current).toFixed(0)}%, `}likely between ${end.low.toFixed(0)} and ${end.high.toFixed(0)}%`);
    }
    const disk = forecast && forecast.disk;
    if (!disk) {
        set('hardware-fc-disk', '–');
        set('hardware-fc-disk-hint', 'Needs a few hours of samples');
    } else if (disk.daysUntilFull === null) {
        set('hardware-fc-disk', 'Not growing');
        set('hardware-fc-disk-hint', `${disk.gbPerDay} GB per day over the last ${disk.spanDays} days`);
    } else {
        set('hardware-fc-disk', disk.daysUntilFull > 3650 ? '10+ years' : `${disk.daysUntilFull} days`);
        set('hardware-fc-disk-hint', `growing ${disk.gbPerDay} GB per day over the last ${disk.spanDays} days`);
    }
}

function renderHardwareSettings(overview) {
    const settings = overview.settings || {};
    const sampler = overview.sampler || {};
    const stored = overview.stored || {};
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    if (overview.limits) hardwareLimits = { ...hardwareLimits, ...overview.limits };
    set('hardware-interval-text', hardwareSpell('interval', settings.intervalSeconds || 60));
    set('hardware-retention-text', hardwareSpell('retention', settings.retentionDays || 30));
    if (!hardwareSettingsFilled) {
        for (const [name, field] of Object.entries(HARDWARE_SETTING_FIELDS)) {
            if (settings[field.key] !== undefined) fillHardwareField(name, settings[field.key]);
        }
        hardwareSettingsFilled = true;
    }
    const details = document.getElementById('hardware-sampler-details');
    if (!details) return;
    const rows = [
        ['GPU reading', `${HARDWARE_GPU_SOURCE[sampler.gpu && sampler.gpu.source] || '–'}${sampler.gpu && sampler.gpu.name ? ` (${sampler.gpu.name})` : ''}`],
        ['Samples stored', `${(stored.total || 0).toLocaleString('en-SG')} in total, ${(stored.last24h || 0).toLocaleString('en-SG')} in the last 24 hours`],
        ['Last sample', sampler.lastSampledAt ? `${hardwareTimeLabel(new Date(sampler.lastSampledAt).getTime(), true)} (${hardwareAgo(sampler.lastSampledAt)})` : 'none yet'],
        ['Last error', sampler.lastError || 'none']
    ];
    details.innerHTML = rows.map(([k, v]) => `<dt>${escapeHtmlSafe(k)}</dt><dd>${escapeHtmlSafe(v)}</dd>`).join('');
}

function renderHardwareTable() {
    const body = document.getElementById('hardware-table-body');
    if (!body) return;
    const cell = (v) => (v === null || v === undefined ? '<td class="ui-muted">–</td>' : `<td>${Number(v).toFixed(1)}</td>`);
    const rows = hardwareLastPoints.slice(-200).reverse();
    body.innerHTML = rows.length
        ? rows.map((p) => `<tr><td class="hw-table-time">${escapeHtmlSafe(hardwareTimeLabel(p.t, true))}</td>${cell(p.cpu)}${cell(p.memory)}${cell(p.gpu)}${cell(p.disk)}<td class="ui-muted">${p.n}</td></tr>`).join('')
        : '<tr><td colspan="6" class="ui-empty">No samples in this range yet</td></tr>';
}

function hardwareShowError(message) {
    const pill = document.getElementById('hardware-sampler-pill');
    if (pill) { pill.className = 'ui-pill ui-pill-down'; pill.innerHTML = `<span class="ui-dot"></span>${escapeHtmlSafe(`Could not load: ${message}`)}`; }
}

async function loadHardware() {
    const page = document.getElementById('hardware-page');
    if (!page) return;
    if (hardwareLoading) { hardwarePendingReload = true; return; }
    hardwareLoading = true;
    ensureHardwareCharts();
    const grid = document.getElementById('hardware-charts');
    const button = document.getElementById('hardware-refresh-btn');
    if (grid && hardwareDrawn) grid.classList.add('is-loading');
    if (button) button.disabled = true;
    try {
        const [overviewResponse, seriesResponse] = await Promise.all([
            fetch('/api/admin/hardware/overview', { cache: 'no-store' }),
            fetch(`/api/admin/hardware/series?range=${encodeURIComponent(hardwareRange)}`, { cache: 'no-store' })
        ]);
        const overview = await overviewResponse.json();
        if (!overviewResponse.ok || !overview.success) throw new Error(overview.error || 'Overview failed');
        renderHardwareTiles(overview.overview);
        renderHardwareSettings(overview.overview);
        const series = await seriesResponse.json();
        if (!seriesResponse.ok || !series.success) throw new Error(series.error || 'Series failed');
        renderHardwareSeries(series);
        renderHardwareForecast(series.forecast, overview.overview.latest);
        if (hardwareTableOpen) renderHardwareTable();
    } catch (error) {
        console.error('❌ Error loading hardware:', error);
        hardwareShowError(error.message);
    } finally {
        hardwareLoading = false;
        if (grid) grid.classList.remove('is-loading');
        if (button) button.disabled = false;
        if (hardwarePendingReload) { hardwarePendingReload = false; loadHardware(); }
    }
}

function setHardwareRange(range) {
    if (!HARDWARE_RANGES[range] || range === hardwareRange) return;
    hardwareRange = range;
    document.querySelectorAll('#hardware-range .hw-seg-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.range === range));
    loadHardware();
}

function toggleHardwareTable() {
    hardwareTableOpen = !hardwareTableOpen;
    const table = document.getElementById('hardware-table-card');
    const charts = document.getElementById('hardware-charts');
    const button = document.getElementById('hardware-table-btn');
    if (table) table.hidden = !hardwareTableOpen;
    if (charts) charts.hidden = hardwareTableOpen;
    if (button) button.textContent = hardwareTableOpen ? 'Graph view' : 'Table view';
    if (hardwareTableOpen) renderHardwareTable();
    else ensureHardwareCharts();
}

// 90 -> "90 seconds", 600 -> "10 minutes", 48 hours -> "2 days"
function hardwareSpell(name, value) {
    for (const [factor, word] of HARDWARE_SETTING_FIELDS[name].words) {
        if (value % factor === 0) {
            const n = value / factor;
            return `${n} ${word}${n === 1 ? '' : 's'}`;
        }
    }
    return String(value);
}

function hardwareFieldParts(name) {
    const get = (suffix) => document.getElementById(`hardware-${name}${suffix}`);
    return { select: get(''), box: get('-custom'), amount: get('-amount'), unit: get('-unit'), hint: get('-hint') };
}

function hardwareShowCustom(name, show) {
    const { box, amount, hint } = hardwareFieldParts(name);
    const [min, max] = hardwareLimits[HARDWARE_SETTING_FIELDS[name].key];
    if (box) box.hidden = !show;
    if (amount) amount.removeAttribute('aria-invalid');
    if (hint) {
        hint.hidden = !show;
        hint.classList.remove('is-error');
        hint.textContent = `From ${hardwareSpell(name, min)} to ${hardwareSpell(name, max)}.`;
    }
}

// the largest unit that divides the value: 180 seconds -> 3 minutes, 36 hours -> 36 hours
function hardwareSetAmount(name, value) {
    const { amount, unit } = hardwareFieldParts(name);
    if (!amount) return;
    let factor = 1;
    if (unit) {
        factor = [...unit.options].map((o) => Number(o.value)).sort((a, b) => b - a).find((f) => value % f === 0) || 1;
        unit.value = String(factor);
    }
    amount.value = String(value / factor);
}

// A saved value goes back into its preset, or into Custom when no preset has it
function fillHardwareField(name, value) {
    const { select } = hardwareFieldParts(name);
    if (!select) return;
    const preset = [...select.options].some((o) => o.value === String(value));
    select.value = preset ? String(value) : 'custom';
    select.dataset.last = String(value);
    if (!preset) hardwareSetAmount(name, value);
    hardwareShowCustom(name, !preset);
}

// onchange of a select: Custom opens the number box with the value that was chosen before
function hardwareSettingChanged(name) {
    const { select, amount } = hardwareFieldParts(name);
    if (!select) return;
    if (select.value !== 'custom') {
        select.dataset.last = select.value;
        hardwareShowCustom(name, false);
        return;
    }
    hardwareSetAmount(name, Number(select.dataset.last) || hardwareLimits[HARDWARE_SETTING_FIELDS[name].key][0]);
    hardwareShowCustom(name, true);
    if (amount) amount.focus();
}

// { value } or { error } for one setting
function readHardwareField(name) {
    const { select, amount, unit } = hardwareFieldParts(name);
    if (select.value !== 'custom') return { value: Number(select.value) };
    const typed = Number(amount.value);
    if (!amount.value.trim() || !Number.isInteger(typed) || typed < 1) return { error: 'Enter a whole number.' };
    const value = typed * (unit ? Number(unit.value) : 1);
    const [min, max] = hardwareLimits[HARDWARE_SETTING_FIELDS[name].key];
    if (value < min || value > max) return { error: `Choose from ${hardwareSpell(name, min)} to ${hardwareSpell(name, max)}.` };
    return { value };
}

function hardwareFieldError(name, message) {
    const { amount, hint } = hardwareFieldParts(name);
    if (hint) {
        hint.hidden = false;
        hint.textContent = message;
        hint.classList.add('is-error');
    }
    if (amount) {
        amount.setAttribute('aria-invalid', 'true');
        amount.focus();
    }
}

async function saveHardwareSettings() {
    const payload = {};
    for (const [name, field] of Object.entries(HARDWARE_SETTING_FIELDS)) {
        const result = readHardwareField(name);
        if (result.error) {
            hardwareFieldError(name, result.error);
            return;
        }
        payload[field.key] = result.value;
    }
    const button = document.getElementById('hardware-settings-save');
    if (button) button.disabled = true;
    try {
        const response = await fetch('/api/admin/hardware/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Save failed');
        showNotification('Sampling settings saved', 'success');
        hardwareSettingsFilled = false;
        loadHardware();
    } catch (error) {
        showNotification(`Could not save the settings: ${error.message}`, 'error');
    } finally {
        if (button) button.disabled = false;
    }
}

function startHardwarePolling() {
    if (hardwareTimer) clearInterval(hardwareTimer);
    hardwareTimer = setInterval(() => {
        const page = document.getElementById('hardware-page');
        if (page && page.classList.contains('active') && sessionStorage.getItem('loggedUser')) loadHardware();
    }, 60000);
}
// <Jun Kai end>
