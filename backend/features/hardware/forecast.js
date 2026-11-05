// Owner: Role 3, Jun Kai.
// Usage forecasting for the Hardware page, statistics only (no AI, as agreed with the supervisor):
// Holt's linear trend (double exponential smoothing) for CPU, memory and GPU, a straight-line fit for
// the disk. Pure functions, unit-tested in tests/unit/forecast.test.js.
// <Jun Kai start>
const ALPHAS = [0.2, 0.35, 0.5, 0.65, 0.8];
const BETAS = [0.02, 0.05, 0.1, 0.2, 0.3];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// One pass of Holt's method. Returns the final level and trend plus the one-step-ahead error.
function holt(values, alpha, beta) {
    let level = values[0];
    let trend = 0; // learned from the data: one noisy first difference must not steer the whole forecast
    let squaredError = 0;
    for (let t = 1; t < values.length; t++) {
        const predicted = level + trend;
        squaredError += (values[t] - predicted) ** 2;
        const previousLevel = level;
        level = alpha * values[t] + (1 - alpha) * predicted;
        trend = beta * (level - previousLevel) + (1 - beta) * trend;
    }
    return { level, trend, rmse: values.length > 1 ? Math.sqrt(squaredError / (values.length - 1)) : 0 };
}

// Tries a small grid of smoothing factors and keeps the pair with the smallest one-step error
function fitHolt(values) {
    let best = null;
    for (const alpha of ALPHAS) {
        for (const beta of BETAS) {
            const fit = holt(values, alpha, beta);
            if (!best || fit.rmse < best.rmse) best = { ...fit, alpha, beta };
        }
    }
    return best;
}

// values: evenly spaced readings, oldest first; steps: how many future points to produce.
// Only the unbroken run of readings up to the latest one is used (a gap such as a night in hibernation is
// not a step). Returns null with fewer than 6 readings. The band grows with the horizon (typical error * sqrt(h)).
function holtForecast(values, steps, { min = 0, max = 100 } = {}) {
    let start = values.length;
    while (start > 0 && Number.isFinite(values[start - 1])) start--;
    const clean = values.slice(start);
    if (clean.length < 6 || steps < 1) return null;
    const fit = fitHolt(clean);
    const points = [];
    for (let h = 1; h <= steps; h++) {
        const value = clamp(fit.level + h * fit.trend, min, max);
        const halfBand = 1.28 * fit.rmse * Math.sqrt(h);
        points.push({ value: round1(value), low: round1(clamp(value - halfBand, min, max)), high: round1(clamp(value + halfBand, min, max)) });
    }
    return { points, rmse: round1(fit.rmse), trendPerStep: round1(fit.trend), alpha: fit.alpha, beta: fit.beta };
}

// Least-squares line through { t (ms), v } points: slope in value per ms
function linearTrend(points) {
    const clean = points.filter((p) => Number.isFinite(p.v) && Number.isFinite(p.t));
    if (clean.length < 2) return null;
    const n = clean.length;
    const t0 = clean[0].t;
    let sumT = 0; let sumV = 0; let sumTT = 0; let sumTV = 0;
    for (const p of clean) {
        const t = p.t - t0;
        sumT += t; sumV += p.v; sumTT += t * t; sumTV += t * p.v;
    }
    const denominator = n * sumTT - sumT * sumT;
    if (denominator === 0) return null;
    const slope = (n * sumTV - sumT * sumV) / denominator;
    const intercept = (sumV - slope * sumT) / n;
    return { slope, intercept, t0, n };
}

// Disk: growth in GB per day and the days left before the drive is full (null when not growing)
function diskForecast(points, totalGb) {
    const fit = linearTrend(points);
    if (!fit || !totalGb) return null;
    const gbPerDay = Math.round(fit.slope * 86400000 * 100) / 100;
    const lastUsed = points[points.length - 1].v;
    const freeGb = totalGb - lastUsed;
    const daysUntilFull = gbPerDay >= 0.01 ? freeGb / gbPerDay : null;
    return {
        gbPerDay,
        daysUntilFull: daysUntilFull === null ? null : Math.max(0, Math.round(daysUntilFull)),
        spanDays: round1((points[points.length - 1].t - points[0].t) / 86400000),
        totalGb,
        lastUsedGb: lastUsed
    };
}

// Averages rows into fixed buckets: rows [{ t, ...numbers }] -> [{ t, n, ...averages }]
function bucketAverage(rows, bucketMs, keys) {
    const buckets = new Map();
    for (const row of rows) {
        const t = Math.floor(row.t / bucketMs) * bucketMs;
        let b = buckets.get(t);
        if (!b) { b = { t, n: 0, sums: {}, counts: {} }; buckets.set(t, b); }
        b.n++;
        for (const key of keys) {
            if (!Number.isFinite(row[key])) continue;
            b.sums[key] = (b.sums[key] || 0) + row[key];
            b.counts[key] = (b.counts[key] || 0) + 1;
        }
    }
    return [...buckets.values()].sort((a, b) => a.t - b.t).map((b) => {
        const out = { t: b.t, n: b.n };
        for (const key of keys) out[key] = b.counts[key] ? round1(b.sums[key] / b.counts[key]) : null;
        return out;
    });
}

function round1(n) { return Math.round(n * 10) / 10; }

module.exports = { holt, fitHolt, holtForecast, linearTrend, diskForecast, bucketAverage, clamp };
// <Jun Kai end>
