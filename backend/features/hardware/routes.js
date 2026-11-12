// Owner: Role 3, Jun Kai.
// Admin hardware API, mounted at /api/admin/hardware (session required):
//   GET  /overview            latest sample, sampler status and settings (the stat tiles)
//   GET  /series?range=24h    averaged samples for the graphs plus the forecast (1h up to 5y, see ranges.js)
//   GET  /settings  PUT /settings   interval, retention, forecast horizon (1 hour to 1 year)
//   GET  /forecast-check?forecastHours=&retentionDays=   would that forecast reach further than the samples go back
// <Jun Kai start>
const express = require('express');
const auth = require('../../core/auth');
const db = require('../../core/db');
const sampler = require('./sampler');
const settings = require('./settings');
const forecast = require('./forecast');
const ranges = require('./ranges');

const router = express.Router();
const all = (sql, params) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

const FORECAST_BUCKET_SECONDS = 600;
// above a week the forecast works on daily averages; they barely move within minutes, so the answer is kept a while
const LONG_HORIZON_HOURS = 168;
const LONG_CACHE_MS = 10 * 60 * 1000;
let longCache = { key: null, at: 0, value: null };
const NUMBER_KEYS = ['cpu', 'memory', 'disk', 'gpu', 'diskUsedGb', 'diskTotalGb', 'memoryUsedMb', 'gpuMemoryUsedMb'];

function fail(res, error, what) {
    if (error.code === 'ER_NO_SUCH_TABLE') return res.status(503).json({ success: false, error: 'Table hardware_samples is missing: run npm run db:migrate' });
    console.error(`❌ Hardware ${what} failed:`, error);
    return res.status(500).json({ success: false, error: `Hardware ${what} failed: ${error.message}` });
}

async function bucketedRows(secondsBack, bucketSeconds) {
    const rows = await all(
        `SELECT FLOOR(UNIX_TIMESTAMP(sampled_at) / ?) * ? AS t, COUNT(*) AS n,
                AVG(cpu_percent) AS cpu, AVG(memory_percent) AS memory, AVG(disk_percent) AS disk, AVG(gpu_percent) AS gpu,
                AVG(disk_used_gb) AS diskUsedGb, MAX(disk_total_gb) AS diskTotalGb, AVG(memory_used_mb) AS memoryUsedMb, AVG(gpu_memory_used_mb) AS gpuMemoryUsedMb
         FROM hardware_samples
         WHERE sampled_at >= UTC_TIMESTAMP() - INTERVAL ? SECOND
         GROUP BY t ORDER BY t`,
        [bucketSeconds, bucketSeconds, secondsBack]
    );
    return rows.map((row) => {
        const point = { t: Number(row.t) * 1000, n: Number(row.n) };
        for (const key of NUMBER_KEYS) point[key] = row[key] === null || row[key] === undefined ? null : Math.round(Number(row[key]) * 10) / 10;
        return point;
    });
}

async function stepForecast(horizonHours) {
    const steps = Math.round((horizonHours * 3600) / FORECAST_BUCKET_SECONDS);
    const windowSeconds = Math.max(24 * 3600, 2 * horizonHours * 3600);
    const buckets = await bucketedRows(windowSeconds, FORECAST_BUCKET_SECONDS);
    // only the unbroken run of buckets up to the latest one: a gap (the PC was hibernated) is not a step
    let cut = buckets.length - 1;
    while (cut > 0 && buckets[cut].t - buckets[cut - 1].t <= FORECAST_BUCKET_SECONDS * 1500) cut--;
    const history = buckets.slice(Math.max(0, cut));
    const lastT = history.length ? history[history.length - 1].t : null;
    const stamp = (series) => series && { ...series, points: series.points.map((p, i) => ({ t: lastT + (i + 1) * FORECAST_BUCKET_SECONDS * 1000, ...p })) };
    const diskPoints = (await bucketedRows(30 * 86400, 3600)).filter((p) => p.diskUsedGb !== null).map((p) => ({ t: p.t, v: p.diskUsedGb }));
    const diskTotal = diskPoints.length ? history.concat().reverse().find((p) => p.diskTotalGb)?.diskTotalGb : null;
    return {
        method: `Holt damped trend (double exponential smoothing) over the unbroken run of 10-minute averages in the last ${Math.round(windowSeconds / 3600)} hours: a trend is trusted for about as long as it has been seen and never carries the value further than the readings moved; disk: straight-line fit over the last 30 days. Statistics only, no AI.`,
        basis: 'steps',
        windowHours: Math.round(windowSeconds / 3600),
        stepSeconds: FORECAST_BUCKET_SECONDS,
        basedOnPoints: history.length,
        cpu: stamp(forecast.holtForecast(history.map((p) => p.cpu), steps)),
        memory: stamp(forecast.holtForecast(history.map((p) => p.memory), steps)),
        gpu: stamp(forecast.holtForecast(history.map((p) => p.gpu), steps)),
        disk: forecast.diskForecast(diskPoints, diskTotal)
    };
}

// More than a week ahead: one average per day that has at least an hour of samples (closed days are left out)
async function dailyForecast(current) {
    const key = [current.forecastHours, current.retentionDays, current.intervalSeconds].join('|');
    if (longCache.key === key && Date.now() - longCache.at < LONG_CACHE_MS) return longCache.value;
    const days = Math.round(current.forecastHours / 24);
    const windowDays = Math.min(current.retentionDays, Math.max(30, 2 * days));
    const enough = Math.ceil(3600 / current.intervalSeconds);
    const daily = (await bucketedRows(windowDays * 86400, 86400)).filter((p) => p.n >= enough);
    const from = Date.now();
    const stamp = (series) => series && { ...series, points: series.points.map((p) => ({ t: from + p.day * 86400000, value: p.value, low: p.low, high: p.high })) };
    const diskPoints = daily.filter((p) => p.diskUsedGb !== null).map((p) => ({ t: p.t, v: p.diskUsedGb }));
    const diskTotal = diskPoints.length ? daily.concat().reverse().find((p) => p.diskTotalGb)?.diskTotalGb : null;
    const value = {
        method: `Daily averages of the last ${windowDays} days (${daily.length} with samples) continued with Holt's damped trend. This far ahead CPU, memory and GPU show their usual level and range, not a prediction for one day; disk: straight-line fit over the same days. Statistics only, no AI.`,
        basis: 'daily',
        windowHours: windowDays * 24,
        stepSeconds: 86400,
        basedOnPoints: daily.length,
        cpu: stamp(forecast.dailyForecast(daily.map((p) => p.cpu), days)),
        memory: stamp(forecast.dailyForecast(daily.map((p) => p.memory), days)),
        gpu: stamp(forecast.dailyForecast(daily.map((p) => p.gpu), days)),
        disk: forecast.diskForecast(diskPoints, diskTotal)
    };
    longCache = { key, at: Date.now(), value };
    return value;
}

// How far back the stored samples go
async function sampleHistory() {
    const rows = await all('SELECT UNIX_TIMESTAMP(MIN(sampled_at)) * 1000 AS oldest FROM hardware_samples', []);
    const oldest = rows[0] && rows[0].oldest !== null && rows[0].oldest !== undefined ? Number(rows[0].oldest) : null;
    return { oldest, hours: oldest === null ? 0 : Math.max(0, (Date.now() - oldest) / 3600000) };
}

// The horizon check plus the dates the page shows: the oldest sample and when the forecast becomes dependable
function describeCheck(current, history) {
    const check = forecast.horizonCheck({ horizonHours: current.forecastHours, historyHours: history.hours, retentionDays: current.retentionDays });
    const start = history.oldest === null ? Date.now() : history.oldest;
    return {
        ...check,
        oldestAt: history.oldest === null ? null : new Date(history.oldest).toISOString(),
        dependableAt: check.reason === 'history' ? new Date(start + current.forecastHours * 3600000).toISOString() : null
    };
}

async function buildForecast(current) {
    const body = current.forecastHours > LONG_HORIZON_HOURS ? await dailyForecast(current) : await stepForecast(current.forecastHours);
    return { ...body, horizonHours: current.forecastHours, check: describeCheck(current, await sampleHistory()) };
}

router.get('/overview', auth.requireAuth, async (req, res) => {
    try {
        const status = sampler.getStatus();
        let latest = status.lastSample;
        if (!latest) {
            const rows = await all('SELECT UNIX_TIMESTAMP(sampled_at) * 1000 AS t, cpu_percent, memory_percent, memory_used_mb, memory_total_mb, disk_percent, disk_used_gb, disk_total_gb, gpu_percent, gpu_memory_used_mb, gpu_memory_total_mb FROM hardware_samples ORDER BY sampled_at DESC LIMIT 1', []);
            const r = rows[0];
            if (r) {
                latest = {
                    at: new Date(Number(r.t)).toISOString(),
                    cpu: r.cpu_percent === null ? null : Number(r.cpu_percent),
                    memory: { percent: Number(r.memory_percent), usedMb: r.memory_used_mb, totalMb: r.memory_total_mb },
                    disk: { percent: Number(r.disk_percent), usedGb: Number(r.disk_used_gb), totalGb: Number(r.disk_total_gb) },
                    gpu: r.gpu_percent === null ? null : { percent: Number(r.gpu_percent), memoryUsedMb: r.gpu_memory_used_mb, memoryTotalMb: r.gpu_memory_total_mb }
                };
            }
        }
        const counts = await all('SELECT COUNT(*) AS total, SUM(sampled_at >= UTC_TIMESTAMP() - INTERVAL 1 DAY) AS day, UNIX_TIMESTAMP(MIN(sampled_at)) * 1000 AS oldest FROM hardware_samples', []);
        const oldest = counts[0].oldest === null || counts[0].oldest === undefined ? null : new Date(Number(counts[0].oldest)).toISOString();
        res.json({ success: true, overview: { latest, sampler: { ...status, lastSample: undefined }, settings: settings.read(), limits: settings.LIMITS, stored: { total: Number(counts[0].total), last24h: Number(counts[0].day || 0), oldestAt: oldest }, serverTime: new Date().toISOString() } });
    } catch (error) { fail(res, error, 'overview'); }
});

router.get('/series', auth.requireAuth, async (req, res) => {
    try {
        const range = ranges.parse(req.query.range === undefined ? '24h' : req.query.range);
        if (!range) return res.status(400).json({ success: false, error: 'range must be 1 hour to 5 years, written like 12h, 10d, 3w, 6mo or 2y' });
        const points = await bucketedRows(range.seconds, range.bucketSeconds);
        const current = settings.read();
        res.json({ success: true, range: range.key, seconds: range.seconds, bucketSeconds: range.bucketSeconds, points, forecast: await buildForecast(current), serverTime: new Date().toISOString() });
    } catch (error) { fail(res, error, 'series'); }
});

router.get('/settings', auth.requireAuth, (req, res) => {
    res.json({ success: true, settings: settings.read(), limits: settings.LIMITS });
});

// Asked by the page before it saves: is a forecast this far ahead dependable with the samples stored so far?
router.get('/forecast-check', auth.requireAuth, async (req, res) => {
    const current = settings.read();
    const result = settings.validate({ ...current, forecastHours: req.query.forecastHours, retentionDays: req.query.retentionDays ?? current.retentionDays });
    if (result.error) return res.status(400).json({ success: false, error: result.error });
    try {
        res.json({ success: true, check: describeCheck(result.settings, await sampleHistory()) });
    } catch (error) { fail(res, error, 'forecast check'); }
});

router.put('/settings', auth.requireAuth, (req, res) => {
    const result = settings.validate(req.body);
    if (result.error) return res.status(400).json({ success: false, error: result.error });
    try {
        settings.write(result.settings);
        sampler.applySettings(result.settings);
        res.json({ success: true, settings: result.settings });
    } catch (error) { fail(res, error, 'settings save'); }
});

module.exports = router;
// <Jun Kai end>
