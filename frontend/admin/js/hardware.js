// Owner: Role 3, Jun Kai.
// Hardware page: a card per part from GET /api/admin/hardware/overview (the cards pick what the graph shows: every
// part together or one part with its own numbers), Chart.js line graphs with the
// forecast from GET /api/admin/hardware/series?range=..., the table view and the sampling settings (a forecast
// longer than the stored history is marked as a rough guide, and saving one asks first).
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
// a colour per part, the same on its card and its line (checked for colour-blind readers)
const HARDWARE_COLORS = { cpu: '#1f6fd0', memory: '#14a88a', gpu: '#a0408f', disk: '#1e293b' };
const HARDWARE_NAMES = { cpu: 'CPU', memory: 'Memory', gpu: 'GPU', disk: 'Disk' };
const HARDWARE_PART_TEXT = {
    all: 'Every part on one graph. Click a part on the left to see it on its own.',
    cpu: 'Average use. The dashed line is the forecast, the shaded band its typical error.',
    memory: 'Share of the installed memory in use.',
    gpu: 'Busiest GPU engine, as Task Manager reports it.',
    disk: 'Used space on the project drive.'
};
let hardwarePart = 'all';
let hardwareDiskText = HARDWARE_PART_TEXT.disk;
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
    horizon: { key: 'forecastHours', words: [[8760, 'year'], [720, 'month'], [24, 'day'], [1, 'hour']] }
};
let hardwareLimits = { intervalSeconds: [15, 600], retentionDays: [1, 365], forecastHours: [1, 8760] };
// Custom graph ranges such as "3mo" (the last 3 months): the server works out the exact seconds and the bucket size
const HARDWARE_RANGE_UNITS = { h: ['hour', 3600], d: ['day', 86400], w: ['week', 604800], mo: ['month', 2629800], y: ['year', 31557600] };
const HARDWARE_RANGE_MAX = { h: 43824, d: 1826, w: 260, mo: 60, y: 5 }; // 5 years in each unit
const HARDWARE_RANGE_SAME = { '1d': '24h', '1w': '7d' };
let hardwareRetentionDays = 30;
let hardwareIntervalSeconds = 60;
let hardwareSaved = null; // the settings as last loaded, to tell what a save changes
let hardwarePendingSave = null; // the settings waiting behind the long-forecast reminder

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

// "3mo" -> { amount: 3, unit: 'mo' }, or null for a preset or anything else
function hardwareCustomRange(key) {
    const m = /^(\d{1,5})(h|d|w|mo|y)$/.exec(String(key || ''));
    return m && !HARDWARE_RANGES[key] ? { amount: Number(m[1]), unit: m[2] } : null;
}

// 3 months -> "3 months"; with short, 1 month -> "month" (for "last month")
function hardwareRangeWords(amount, unit, short) {
    const word = HARDWARE_RANGE_UNITS[unit][0];
    if (amount === 1) return short ? word : `1 ${word}`;
    return `${amount} ${word}s`;
}

// 43200 -> "12 hours", 86400 -> "day"
function hardwareBucketWords(seconds) {
    for (const [size, word] of [[604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']]) {
        if (seconds % size === 0) return seconds === size ? word : `${seconds / size} ${word}s`;
    }
    return `${seconds} seconds`;
}

// Ticks for a custom range: round steps up to two months, then the first day of every 1, 2, 3, 6 or 12 months
function hardwareTickPlan(seconds) {
    if (seconds >= 60 * 86400) {
        const months = seconds / HARDWARE_RANGE_UNITS.mo[1];
        return { months: [1, 2, 3, 6, 12].find((k) => months / k <= 8) || 12, label: 'month' };
    }
    const step = [600, 1800, 3600, 7200, 14400, 21600, 43200, 86400, 172800, 432000, 604800, 1209600].map((s) => s * 1000).find((s) => (seconds * 1000) / s <= 8) || 1209600000;
    return { step, label: step >= 86400000 ? 'date' : seconds > 86400 ? 'datetime' : 'time' };
}

// What the graphs need to know about a range: the preset values, or worked out for a custom one
function hardwareRangeInfo(key, data) {
    const preset = HARDWARE_RANGES[key];
    if (preset) return { ...preset, plan: { step: preset.tick, label: key === '7d' || key === '30d' ? 'datetime' : 'time' } };
    const custom = hardwareCustomRange(key) || { amount: 1, unit: 'd' };
    const seconds = (data && data.seconds) || custom.amount * HARDWARE_RANGE_UNITS[custom.unit][1];
    const bucket = data && data.bucketSeconds;
    return {
        seconds,
        text: `Averages per ${bucket ? hardwareBucketWords(bucket) : 'period'}, last ${hardwareRangeWords(custom.amount, custom.unit, true)}`,
        forecast: seconds >= 86400,
        plan: hardwareTickPlan(seconds)
    };
}

function hardwareTickLabel(ms, label) {
    const d = new Date(ms);
    if (label === 'month') return d.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' });
    if (label === 'date') return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
    return hardwareTimeLabel(ms, label === 'datetime');
}

// Round ticks on the time axis, aligned to local time (month ticks on the 1st, counted from January)
function hardwareBuildTicks(scale) {
    const plan = (scale.chart && scale.chart.$hardwarePlan) || hardwareRangeInfo(hardwareRange).plan;
    const ticks = [];
    if (plan.months) {
        const d = new Date(scale.min);
        d.setHours(0, 0, 0, 0);
        d.setDate(1);
        if (d.getTime() < scale.min) d.setMonth(d.getMonth() + 1);
        while (d.getMonth() % plan.months !== 0) d.setMonth(d.getMonth() + 1);
        for (; d.getTime() <= scale.max; d.setMonth(d.getMonth() + plan.months)) ticks.push({ value: d.getTime() });
    } else {
        const offset = new Date(scale.min).getTimezoneOffset() * 60000;
        for (let t = Math.ceil((scale.min - offset) / plan.step) * plan.step + offset; t <= scale.max; t += plan.step) ticks.push({ value: t });
    }
    scale.ticks = ticks;
}

// Draws the "now" hairline that separates measured values from the forecast, and the hover crosshair
const hardwareGuidePlugin = {
    id: 'hardwareGuide',
    // under the lines: hatching where there were no samples, and the 85 % and 95 % limits
    beforeDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales.x || !scales.y) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
        ctx.clip();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1;
        for (const [from, to] of chart.$hardwareSpans || []) {
            const x1 = Math.max(chartArea.left, scales.x.getPixelForValue(from));
            const x2 = Math.min(chartArea.right, scales.x.getPixelForValue(to));
            if (x2 - x1 < 3) continue;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x1, chartArea.top, x2 - x1, chartArea.bottom - chartArea.top);
            ctx.clip();
            const height = chartArea.bottom - chartArea.top;
            ctx.beginPath();
            for (let x = x1 - height; x < x2; x += 7) { ctx.moveTo(x, chartArea.bottom); ctx.lineTo(x + height, chartArea.top); }
            ctx.stroke();
            ctx.restore();
        }
        ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.setLineDash([3, 4]);
        for (const [value, color, label] of [[85, '#b45309', '85% amber'], [95, '#b91c1c', '95% red']]) {
            const y = scales.y.getPixelForValue(value);
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(chartArea.left, y);
            ctx.lineTo(chartArea.right, y);
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.fillText(label, chartArea.right - 6, y - 4);
        }
        ctx.restore();
    },
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
    const color = HARDWARE_COLORS[key] || HARDWARE_ACCENT;
    const series = (label, dash) => ({
        label, data: [], borderColor: color, borderWidth: 2, borderDash: dash, borderCapStyle: 'round', borderJoinStyle: 'round',
        pointRadius: 0, pointHitRadius: 16, pointHoverRadius: 4, pointHoverBackgroundColor: color, pointHoverBorderColor: theme.card, pointHoverBorderWidth: 2,
        tension: 0.25, spanGaps: false, fill: false
    });
    const band = (fill) => ({ label: 'band', data: [], borderWidth: 0, pointRadius: 0, pointHitRadius: 0, pointHoverRadius: 0, backgroundColor: `${color}1f`, fill, isBand: true, tension: 0.25 });
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
                    ticks: { maxRotation: 0, autoSkip: true, color: theme.muted, font: { size: 11 }, padding: 6, callback(value) { const plan = (this.chart && this.chart.$hardwarePlan) || hardwareRangeInfo(hardwareRange).plan; return hardwareTickLabel(value, plan.label); } },
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
    // the graph with every part: the four datasets of each part, one after the other
    const canvas = document.getElementById('hardware-all-chart');
    if (canvas && !hardwareCharts.all) {
        const config = hardwareChartConfig('cpu');
        config.data.datasets = HARDWARE_METRICS.flatMap((key) => hardwareChartConfig(key).data.datasets.map((d) => ({ ...d, label: d.isBand ? 'band' : `${HARDWARE_NAMES[key]} ${d.label.toLowerCase()}` })));
        hardwareCharts.all = new Chart(canvas, config);
    } else if (hardwareCharts.all) hardwareCharts.all.resize();
    return true;
}

function renderHardwareSeries(data) {
    const points = data.points || [];
    const rangeKey = data.range || hardwareRange;
    const range = hardwareRangeInfo(rangeKey, data);
    const forecast = data.forecast || {};
    const theme = hardwareTheme();
    const now = Date.now();
    const lastT = points.length ? points[points.length - 1].t : null;
    // a forecast made from daily averages has one point per day, so it is not drawn on a range under two days; on a
    // range longer than a month a short forecast would be an invisible sliver: it is drawn once it spans a twelfth of it
    const dailyOnShortRange = forecast.basis === 'daily' && range.forecast && range.seconds < 2 * 86400;
    const showForecast = range.forecast && lastT !== null && !dailyOnShortRange && (range.seconds <= 31 * 86400 || (forecast.horizonHours || 0) * 3600 >= range.seconds / 12);
    const horizonLimit = lastT === null ? now : lastT + range.seconds * 1000; // the forecast never squeezes the history
    hardwareLastPoints = points;
    // a range longer than the samples are kept can never fill, so the graphs start at the oldest sample instead
    const rangeStart = now - range.seconds * 1000;
    const firstT = points.length ? points[0].t : null;
    const beyondKept = range.seconds > hardwareRetentionDays * 86400;
    const clipped = beyondKept && firstT !== null && firstT > rangeStart;
    const xMin = clipped ? firstT : rangeStart;
    const note = document.getElementById('hardware-series-note');
    if (note) {
        const shown = points.length ? range.text : `${range.text} (no samples yet)`;
        const text = dailyOnShortRange ? `${shown}. The forecast looks ${hardwareSpell('horizon', forecast.horizonHours)} ahead: choose 7 days or longer to see it` : shown;
        const kept = `Samples are kept for ${hardwareSpell('retention', hardwareRetentionDays)}`;
        note.textContent = !beyondKept ? text : clipped ? `${text}. ${kept}, so the graphs start on ${hardwareTickLabel(firstT, 'date')}.` : `${text}. ${kept}.`;
    }
    if (typeof Chart === 'undefined') {
        for (const key of HARDWARE_METRICS) {
            const empty = document.getElementById(`hardware-${key}-empty`);
            if (empty) { empty.hidden = false; empty.textContent = 'The graph library did not load (no internet). Use Table view.'; }
        }
        return;
    }
    // the server sends only the periods that have samples: a hole longer than a few periods (the PC hibernating
    // overnight) gets an empty point, so the line breaks there instead of drawing straight across the night
    const gapMs = Math.max(data.bucketSeconds || 0, hardwareIntervalSeconds) * 3000;
    const gapAfter = new Set(points.filter((p, i) => i + 1 < points.length && points[i + 1].t - p.t > gapMs).map((p) => p.t));
    // stretches of the range with no samples at all (the PC asleep or the server stopped): the graphs hatch them
    const spans = [];
    let seen = xMin;
    for (const p of points) { if (p.t - seen > gapMs) spans.push([seen, p.t]); seen = Math.max(seen, p.t); }
    if (points.length && now - seen > gapMs) spans.push([seen, now]);
    for (const key of HARDWARE_METRICS) {
        const chart = hardwareCharts[key];
        if (!chart) continue;
        const history = points.flatMap((p) => (gapAfter.has(p.t) ? [{ x: p.t, y: p[key] }, { x: p.t + 1, y: null }] : [{ x: p.t, y: p[key] }]));
        const [measured, projected, low, high] = chart.data.datasets;
        measured.data = history;
        let horizonEnd = now;
        const fc = forecast[key];
        const lastValue = history.length ? history[history.length - 1].y : null;
        const shown = fc && fc.points ? fc.points.filter((p) => p.t <= horizonLimit) : [];
        if (showForecast && key === 'disk' && forecast.disk && forecast.disk.gbPerDay !== null && lastValue !== null && forecast.disk.totalGb) {
            const hours = Math.min(forecast.horizonHours || 24, range.seconds / 3600);
            const end = lastT + hours * 3600000;
            // a disk that is not growing stays level: space freed by a clean-up is not a trend to continue
            const perDay = forecast.disk.daysUntilFull === null ? 0 : forecast.disk.gbPerDay;
            const endValue = Math.min(100, Math.max(0, lastValue + (perDay / forecast.disk.totalGb) * 100 * (hours / 24)));
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
        chart.$hardwareSpans = spans;
        chart.$hardwareRange = rangeKey;
        // ticks follow the span actually drawn: a forecast or a clipped start changes it
        const span = (horizonEnd - xMin) / 1000;
        chart.$hardwarePlan = clipped || span > range.seconds * 1.25 ? hardwareTickPlan(span) : range.plan;
        chart.options.scales.x.min = xMin;
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
    const together = hardwareCharts.all;
    if (together) {
        const parts = HARDWARE_METRICS.map((key) => hardwareCharts[key]).filter(Boolean);
        parts.forEach((chart, i) => chart.data.datasets.forEach((d, j) => { together.data.datasets[i * 4 + j].data = d.data; }));
        const xMax = Math.max(now, ...parts.map((chart) => chart.options.scales.x.max));
        const forecastFrom = parts.map((chart) => chart.$hardwareNow).find(Boolean) || null;
        const span = (xMax - xMin) / 1000;
        together.$hardwareNow = forecastFrom;
        together.$hardwareTheme = theme;
        together.$hardwareSpans = spans;
        together.$hardwareRange = rangeKey;
        together.$hardwarePlan = clipped || span > range.seconds * 1.25 ? hardwareTickPlan(span) : range.plan;
        together.options.scales.x.min = xMin;
        together.options.scales.x.max = xMax;
        together.options.scales.x.ticks.color = theme.muted;
        together.options.scales.y.ticks.color = theme.muted;
        together.options.scales.y.grid.color = theme.grid;
        together.update(hardwareDrawn ? 'none' : undefined);
        const empty = document.getElementById('hardware-all-empty');
        if (empty) empty.hidden = points.length > 0;
    }
    hardwareDrawn = true;
}

// The card of each part: Normal, High or Critical, by the same limits as the lines on the graph
function renderHardwareKeys(overview) {
    const latest = overview.latest || {};
    const now = { cpu: latest.cpu, memory: latest.memory && latest.memory.percent, gpu: latest.gpu && latest.gpu.percent, disk: latest.disk && latest.disk.percent };
    for (const key of HARDWARE_METRICS) {
        const pill = document.getElementById(`hardware-${key}-pill`);
        if (!pill) continue;
        const value = now[key];
        const known = value !== null && value !== undefined;
        const tone = known ? hardwareTone(value) : 'muted';
        pill.className = `ui-pill ui-pill-${tone}`;
        pill.innerHTML = `<span class="ui-dot"></span>${known ? { ok: 'Normal', warn: 'High', down: 'Critical' }[tone] : 'No reading'}`;
    }
}

// Under the graph of one part: now, average, peak and lowest of the range shown, and its forecast.
// Also the short forecast line on each card.
function renderHardwareFacts(latest) {
    const text = (id) => { const el = document.getElementById(id); return el ? el.textContent : ''; };
    const percent = (v) => (v === null || v === undefined ? '–' : `${Number(v).toFixed(0)}%`);
    const now = { cpu: latest && latest.cpu, memory: latest && latest.memory && latest.memory.percent, gpu: latest && latest.gpu && latest.gpu.percent, disk: latest && latest.disk && latest.disk.percent };
    for (const key of HARDWARE_METRICS) {
        const rows = hardwareLastPoints.filter((p) => p[key] !== null && p[key] !== undefined);
        let low = null; let high = null; let sum = 0;
        for (const p of rows) { if (!low || p[key] < low[key]) low = p; if (!high || p[key] > high[key]) high = p; sum += p[key]; }
        const label = key === 'disk' ? 'Disk full in' : text(`hardware-fc-${key}-label`);
        const value = text(`hardware-fc-${key}`);
        const facts = [
            ['Now', percent(now[key]), latest && latest.at ? `sampled ${hardwareAgo(latest.at)}` : ''],
            ['Average in this range', rows.length ? percent(sum / rows.length) : '–', `${rows.length} points`],
            ['Peak in this range', high ? percent(high[key]) : '–', high ? `at ${hardwareTimeLabel(high.t, true)}` : ''],
            ['Lowest in this range', low ? percent(low[key]) : '–', low ? `at ${hardwareTimeLabel(low.t, true)}` : ''],
            [label, value, text(`hardware-fc-${key}-hint`)]
        ];
        const box = document.getElementById(`hardware-${key}-facts`);
        if (box) box.innerHTML = facts.map(([l, v, h]) => `<div><span class="ui-fact-label">${escapeHtmlSafe(l)}</span><span class="ui-fact-value">${escapeHtmlSafe(v)}</span><span class="ui-fact-hint">${escapeHtmlSafe(h)}</span></div>`).join('');
        const next = document.getElementById(`hardware-${key}-next`);
        if (next) next.textContent = value === '–' || !value ? 'forecast not ready' : key === 'disk' ? (value === 'Not growing' ? 'not growing' : `full in ${value}`) : `${value} ${label.replace(/^\S+ /, '')}`;
    }
    hardwarePartWords();
}

function hardwarePartWords() {
    const title = document.getElementById('hardware-main-title');
    const words = document.getElementById('hardware-main-text');
    if (title) title.textContent = hardwareTableOpen ? 'Values' : hardwarePart === 'all' ? 'All parts' : HARDWARE_NAMES[hardwarePart];
    if (words) words.textContent = hardwareTableOpen ? 'The same averages as the graph, every part, newest first.' : hardwarePart === 'disk' ? hardwareDiskText : HARDWARE_PART_TEXT[hardwarePart];
}

// The cards on the left are the switch: every part on one graph, or one part with its own numbers
function setHardwarePart(part) {
    if (part !== 'all' && !HARDWARE_METRICS.includes(part)) return;
    hardwarePart = part;
    document.querySelectorAll('#hardware-page .hw-key').forEach((key) => key.setAttribute('aria-pressed', String(key.dataset.part === part)));
    document.querySelectorAll('#hardware-page .hw-plot').forEach((panel) => { panel.hidden = panel.dataset.partPanel !== part; });
    hardwarePartWords();
    ensureHardwareCharts();
}

// The number and the line under it on each part card
function renderHardwareCards(overview) {
    const latest = overview.latest;
    const sampler = overview.sampler || {};
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const gb = (mb) => (mb / 1024).toFixed(1);
    const pill = document.getElementById('hardware-sampler-pill');
    const pillState = sampler.lastError ? ['down', 'Sampler error'] : sampler.running ? ['ok', `Sampling every ${sampler.intervalSeconds} s`] : ['muted', 'Sampler off'];
    if (pill) { pill.className = `ui-pill ui-pill-${pillState[0]}`; pill.innerHTML = `<span class="ui-dot"></span>${escapeHtmlSafe(pillState[1])}`; }
    if (!latest) {
        for (const key of HARDWARE_METRICS) set(`hardware-${key}-value`, '–');
        const waiting = sampler.lastError ? sampler.lastError : 'Waiting for the first sample (about 10 seconds after the server starts)';
        set('hardware-cpu-hint', waiting);
        set('hardware-memory-hint', '');
        set('hardware-disk-hint', '');
        set('hardware-gpu-hint', HARDWARE_GPU_SOURCE[sampler.gpu && sampler.gpu.source] || '');
        return;
    }
    const ago = hardwareAgo(latest.at);
    set('hardware-cpu-value', latest.cpu === null || latest.cpu === undefined ? '–' : latest.cpu.toFixed(0));
    set('hardware-cpu-hint', latest.cpu === null || latest.cpu === undefined ? 'No CPU reading in the last sample' : `Average over the last interval, sampled ${ago}`);
    set('hardware-memory-value', latest.memory ? latest.memory.percent.toFixed(0) : '–');
    set('hardware-memory-hint', latest.memory ? `${gb(latest.memory.usedMb)} of ${gb(latest.memory.totalMb)} GB in use` : '');
    set('hardware-disk-value', latest.disk ? latest.disk.percent.toFixed(0) : '–');
    set('hardware-disk-hint', latest.disk ? `${latest.disk.usedGb} of ${latest.disk.totalGb} GB used on the project drive` : '');
    if (latest.gpu && latest.gpu.percent !== null && latest.gpu.percent !== undefined) {
        set('hardware-gpu-value', latest.gpu.percent.toFixed(0));
        const memoryText = latest.gpu.memoryUsedMb ? `${gb(latest.gpu.memoryUsedMb)} GB${latest.gpu.memoryTotalMb ? ` of ${gb(latest.gpu.memoryTotalMb)} GB` : ''} memory in use` : '';
        const name = sampler.gpu && sampler.gpu.name ? sampler.gpu.name : '';
        set('hardware-gpu-hint', [name, memoryText].filter(Boolean).join(', '));
    } else {
        set('hardware-gpu-value', '–');
        set('hardware-gpu-hint', HARDWARE_GPU_SOURCE[sampler.gpu && sampler.gpu.source] || 'No GPU reading on this PC');
    }
}

function renderHardwareForecast(forecast, latest) {
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const horizon = hardwareSpell('horizon', (forecast && forecast.horizonHours) || 24);
    // beyond a week the server forecasts from daily averages: the value is the usual level, not "now plus a trend"
    const daily = !!forecast && forecast.basis === 'daily';
    set('hardware-forecast-method', forecast && forecast.method ? `Method: ${forecast.method}` : '');
    for (const key of ['cpu', 'memory', 'gpu']) {
        set(`hardware-fc-${key}-label`, `${key === 'cpu' ? 'CPU' : key === 'gpu' ? 'GPU' : 'Memory'} in ${horizon}`);
        const fc = forecast && forecast[key];
        if (!fc || !fc.points || !fc.points.length) {
            const waiting = daily ? `Needs 6 days with samples (${forecast.basedOnPoints || 0} so far)` : 'Needs an hour of unbroken samples; the count restarts when the PC wakes';
            set(`hardware-fc-${key}`, '–');
            set(`hardware-fc-${key}-hint`, key === 'gpu' && latest && !latest.gpu ? 'No GPU reading' : waiting);
            continue;
        }
        const end = fc.points[fc.points.length - 1];
        const current = latest && (key === 'cpu' ? latest.cpu : latest[key] && latest[key].percent);
        const likely = `likely between ${end.low.toFixed(0)} and ${end.high.toFixed(0)}%`;
        set(`hardware-fc-${key}`, `${end.value.toFixed(0)}%`);
        set(`hardware-fc-${key}-hint`, daily ? `usual daily average, ${likely}` : `${current === null || current === undefined ? '' : `now ${Number(current).toFixed(0)}%, `}${likely}`);
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
    const fitDays = disk ? Math.round(disk.spanDays) : 0;
    const fitWords = fitDays >= 1 ? `of the last ${fitDays === 1 ? 'day' : `${fitDays} days`}` : 'measured so far';
    hardwareDiskText = disk && disk.daysUntilFull === null ? 'Used space on the project drive. It is not growing, so the dashed line stays level.' : `Used space on the project drive. The dashed line continues the growth ${fitWords}.`;
    const note = document.getElementById('hardware-forecast-rough');
    if (note) {
        const check = forecast && forecast.check;
        note.hidden = !(check && check.rough);
        note.textContent = check && check.rough ? `Rough guide. ${hardwareRoughLines(check).slice(0, 2).join(' ')}` : '';
    }
}

// 300 hours -> "13 days": how far back the samples go
function hardwareHistoryWords(hours) {
    if (!hours || hours < 1) return 'less than an hour';
    if (hours < 48) return `${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'}`;
    return `${Math.round(hours / 24)} days`;
}

function hardwareDateWords(iso) {
    return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Why a forecast is only a rough guide, in plain sentences: the note in the Forecast card shows the first two,
// the reminder before saving shows all of them. check comes from the server (forecast.horizonCheck).
function hardwareRoughLines(check) {
    const horizon = hardwareSpell('horizon', check.horizonHours);
    const lines = [`The samples on this PC go back ${hardwareHistoryWords(check.historyHours)} and the forecast looks ${horizon} ahead. A forecast is dependable for about as far ahead as the samples go back.`];
    if (check.reason === 'retention') lines.push(`Samples are kept for ${hardwareSpell('retention', check.retentionDays)}, so the history can never reach ${horizon}. Set "Keep samples for" to at least ${hardwareSpell('retention', check.neededRetentionDays)} to let it get there.`);
    else if (check.dependableAt) lines.push(`While the sampler keeps running it becomes dependable around ${hardwareDateWords(check.dependableAt)}.`);
    lines.push('Until then CPU, memory and GPU show their usual level and range, and the disk line continues the growth measured so far.');
    return lines;
}

function renderHardwareSettings(overview) {
    const settings = overview.settings || {};
    const sampler = overview.sampler || {};
    const stored = overview.stored || {};
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    if (overview.limits) hardwareLimits = { ...hardwareLimits, ...overview.limits };
    hardwareRetentionDays = settings.retentionDays || 30;
    hardwareIntervalSeconds = settings.intervalSeconds || 60;
    hardwareSaved = { ...settings };
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
        ['Oldest sample', stored.oldestAt ? `${hardwareDateWords(stored.oldestAt)} (${hardwareHistoryWords((Date.now() - new Date(stored.oldestAt).getTime()) / 3600000)} ago)` : 'none yet'],
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
        renderHardwareCards(overview.overview);
        renderHardwareKeys(overview.overview);
        renderHardwareSettings(overview.overview);
        const series = await seriesResponse.json();
        if (!seriesResponse.ok || !series.success) throw new Error(series.error || 'Series failed');
        renderHardwareSeries(series);
        renderHardwareForecast(series.forecast, overview.overview.latest);
        renderHardwareFacts(overview.overview.latest);
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

function hardwareRangeButtons(key) {
    const custom = hardwareCustomRange(key);
    document.querySelectorAll('#hardware-range .hw-seg-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.range === (custom ? 'custom' : key)));
    const button = document.getElementById('hardware-range-custom-btn');
    if (button) button.textContent = custom ? hardwareRangeWords(custom.amount, custom.unit) : 'Custom';
}

// A preset ("7d") or a custom range ("3mo"); a custom range that equals a preset uses the preset button
function setHardwareRange(range) {
    closeHardwareRangeForm(false);
    const key = HARDWARE_RANGE_SAME[range] || range;
    if (!HARDWARE_RANGES[key] && !hardwareCustomRange(key)) return;
    hardwareRangeButtons(key);
    if (key === hardwareRange) return;
    hardwareRange = key;
    loadHardware();
}

function toggleHardwareRangeForm() {
    const form = document.getElementById('hardware-range-form');
    if (!form) return;
    if (!form.hidden) {
        closeHardwareRangeForm(true);
        return;
    }
    bindHardwareRangeForm();
    const current = hardwareCustomRange(hardwareRange);
    const amount = document.getElementById('hardware-range-amount');
    document.getElementById('hardware-range-unit').value = current ? current.unit : 'mo';
    amount.value = String(current ? current.amount : 3);
    hardwareRangeHint('');
    form.hidden = false;
    document.getElementById('hardware-range-custom-btn').setAttribute('aria-expanded', 'true');
    amount.focus();
    amount.select();
}

function closeHardwareRangeForm(focusButton) {
    const form = document.getElementById('hardware-range-form');
    if (!form || form.hidden) return;
    form.hidden = true;
    const button = document.getElementById('hardware-range-custom-btn');
    if (!button) return;
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) button.focus();
}

function hardwareRangeHint(error) {
    const hint = document.getElementById('hardware-range-hint');
    const amount = document.getElementById('hardware-range-amount');
    if (hint) {
        hint.textContent = error || 'From 1 hour to 5 years.';
        hint.classList.toggle('is-error', !!error);
    }
    if (amount && error) amount.setAttribute('aria-invalid', 'true');
    else if (amount) amount.removeAttribute('aria-invalid');
}

function applyHardwareCustomRange(event) {
    if (event) event.preventDefault();
    const amountInput = document.getElementById('hardware-range-amount');
    const unit = document.getElementById('hardware-range-unit').value;
    const amount = Number(amountInput.value);
    let error = '';
    if (!amountInput.value.trim() || !Number.isInteger(amount) || amount < 1) error = 'Enter a whole number.';
    else if (amount > HARDWARE_RANGE_MAX[unit]) error = 'Choose up to 5 years.';
    if (error) {
        hardwareRangeHint(error);
        amountInput.focus();
        return;
    }
    setHardwareRange(`${amount}${unit}`);
    const button = document.getElementById('hardware-range-custom-btn');
    if (button) button.focus();
}

// Escape and a click outside close the custom range form
function bindHardwareRangeForm() {
    const form = document.getElementById('hardware-range-form');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        closeHardwareRangeForm(true);
    });
    document.addEventListener('mousedown', (event) => {
        const wrap = document.getElementById('hardware-range-wrap');
        if (!form.hidden && wrap && !wrap.contains(event.target)) closeHardwareRangeForm(false);
    });
}

function toggleHardwareTable() {
    hardwareTableOpen = !hardwareTableOpen;
    const table = document.getElementById('hardware-table-card');
    const charts = document.getElementById('hardware-charts');
    const button = document.getElementById('hardware-table-btn');
    if (table) table.hidden = !hardwareTableOpen;
    if (charts) charts.hidden = hardwareTableOpen;
    if (button) button.textContent = hardwareTableOpen ? 'Graph view' : 'Table view';
    hardwarePartWords();
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
    // a forecast that reaches further than the samples go back is a rough guide: the admin is told before it is saved
    const riskier = !hardwareSaved || payload.forecastHours !== hardwareSaved.forecastHours || payload.retentionDays < hardwareSaved.retentionDays;
    const check = riskier ? await hardwareHorizonCheck(payload) : null;
    if (check && check.rough && openHardwareHorizonDialog(check, payload)) return;
    await putHardwareSettings(payload);
}

// null when the server could not say (the save itself then reports a server that is down)
async function hardwareHorizonCheck(payload) {
    const button = document.getElementById('hardware-settings-save');
    if (button) button.disabled = true;
    try {
        const response = await fetch(`/api/admin/hardware/forecast-check?forecastHours=${payload.forecastHours}&retentionDays=${payload.retentionDays}`, { cache: 'no-store' });
        const data = await response.json();
        return response.ok && data.success ? data.check : null;
    } catch (error) {
        return null;
    } finally {
        if (button) button.disabled = false;
    }
}

// The reminder: "Go back" keeps the form as it is, "Save anyway" saves it. Returns false when it cannot be shown.
function openHardwareHorizonDialog(check, payload) {
    const dialog = document.getElementById('hardware-horizon-dialog');
    const page = document.getElementById('hardware-page');
    if (!dialog || typeof dialog.showModal !== 'function' || !page || !page.classList.contains('active')) return false;
    if (!dialog.dataset.bound) {
        dialog.dataset.bound = '1';
        dialog.addEventListener('close', () => { hardwarePendingSave = null; dialog.classList.remove('is-closing'); });
    }
    const title = document.getElementById('hardware-horizon-title');
    const list = document.getElementById('hardware-horizon-list');
    if (title) title.textContent = `A forecast ${hardwareSpell('horizon', check.horizonHours)} ahead will be a rough guide`;
    if (list) list.innerHTML = hardwareRoughLines(check).map((line) => `<li>${escapeHtmlSafe(line)}</li>`).join('');
    hardwarePendingSave = payload;
    dialog.classList.remove('is-closing');
    if (!dialog.open) dialog.showModal();
    const back = document.getElementById('hardware-horizon-back');
    if (back) back.focus();
    return true;
}

function closeHardwareHorizonDialog() {
    const dialog = document.getElementById('hardware-horizon-dialog');
    if (!dialog || !dialog.open) return;
    if (HARDWARE_REDUCE_MOTION) {
        dialog.close();
        return;
    }
    dialog.classList.add('is-closing');
    setTimeout(() => { if (dialog.open) dialog.close(); }, 150);
}

async function confirmHardwareHorizon() {
    const payload = hardwarePendingSave;
    closeHardwareHorizonDialog();
    if (payload) await putHardwareSettings(payload);
}

async function putHardwareSettings(payload) {
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
