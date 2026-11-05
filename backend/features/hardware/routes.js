// Owner: Role 3, Jun Kai.
// Admin hardware API, mounted at /api/admin/hardware (session required):
//   GET  /overview            latest sample, sampler status and settings (the stat tiles)
//   GET  /series?range=24h    averaged samples for the graphs plus the forecast
//   GET  /settings  PUT /settings   interval, retention, forecast horizon
// <Jun Kai start>
const express = require('express');
const auth = require('../../core/auth');
const db = require('../../core/db');
const sampler = require('./sampler');
const settings = require('./settings');
const forecast = require('./forecast');

const router = express.Router();
const all = (sql, params) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

// range -> [seconds back, bucket seconds]; the bucket keeps every answer under ~200 points
const RANGES = { '1h': [3600, 60], '6h': [6 * 3600, 300], '24h': [24 * 3600, 600], '7d': [7 * 86400, 3600], '30d': [30 * 86400, 4 * 3600] };
const FORECAST_BUCKET_SECONDS = 600;
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

async function buildForecast(horizonHours) {
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
        method: `Holt linear trend (double exponential smoothing) over the unbroken run of 10-minute averages in the last ${Math.round(windowSeconds / 3600)} hours; disk: straight-line fit over the last 30 days. Statistics only, no AI.`,
        horizonHours,
        windowHours: Math.round(windowSeconds / 3600),
        stepSeconds: FORECAST_BUCKET_SECONDS,
        basedOnPoints: history.length,
        cpu: stamp(forecast.holtForecast(history.map((p) => p.cpu), steps)),
        memory: stamp(forecast.holtForecast(history.map((p) => p.memory), steps)),
        gpu: stamp(forecast.holtForecast(history.map((p) => p.gpu), steps)),
        disk: forecast.diskForecast(diskPoints, diskTotal)
    };
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
        const counts = await all('SELECT COUNT(*) AS total, SUM(sampled_at >= UTC_TIMESTAMP() - INTERVAL 1 DAY) AS day FROM hardware_samples', []);
        res.json({ success: true, overview: { latest, sampler: { ...status, lastSample: undefined }, settings: settings.read(), stored: { total: Number(counts[0].total), last24h: Number(counts[0].day || 0) }, serverTime: new Date().toISOString() } });
    } catch (error) { fail(res, error, 'overview'); }
});

router.get('/series', auth.requireAuth, async (req, res) => {
    try {
        const range = typeof req.query.range === 'string' && Object.prototype.hasOwnProperty.call(RANGES, req.query.range) ? req.query.range : '24h';
        const [secondsBack, bucketSeconds] = RANGES[range];
        const points = await bucketedRows(secondsBack, bucketSeconds);
        const current = settings.read();
        res.json({ success: true, range, bucketSeconds, points, forecast: await buildForecast(current.forecastHours), serverTime: new Date().toISOString() });
    } catch (error) { fail(res, error, 'series'); }
});

router.get('/settings', auth.requireAuth, (req, res) => {
    res.json({ success: true, settings: settings.read(), limits: settings.LIMITS });
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
