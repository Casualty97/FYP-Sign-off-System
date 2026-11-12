// Owner: Role 3, Jun Kai.
// Settings of the Hardware page: how often to sample, how long to keep samples, how far to forecast
// (1 hour up to 1 year; routes.js tells the page when a forecast reaches further than the samples go back).
// Kept in backend/data/hardware-settings.json (seeded from backend/config/defaults).
// <Jun Kai start>
const paths = require('../../core/paths');
const { readJson, writeJsonAtomic } = require('../../core/jsonFile');

const FILE_NAME = 'hardware-settings.json';
const DEFAULTS = { intervalSeconds: 60, retentionDays: 30, forecastHours: 24 };
const LIMITS = { intervalSeconds: [15, 600], retentionDays: [1, 365], forecastHours: [1, 8760] };

function clamp(key, value) {
    const [min, max] = LIMITS[key];
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULTS[key];
    return Math.min(max, Math.max(min, Math.round(n)));
}

function read() {
    const stored = readJson(paths.dataFile(FILE_NAME), {});
    const settings = {};
    for (const key of Object.keys(DEFAULTS)) settings[key] = clamp(key, stored[key] ?? DEFAULTS[key]);
    return settings;
}

// Returns { settings } or { error } without writing anything
function validate(body) {
    if (!body || typeof body !== 'object') return { error: 'Send the settings as a JSON object' };
    const settings = {};
    for (const key of Object.keys(DEFAULTS)) {
        const value = body[key] ?? DEFAULTS[key];
        const n = Number(value);
        const [min, max] = LIMITS[key];
        if (!Number.isFinite(n)) return { error: `${key} must be a number` };
        if (n < min || n > max) return { error: `${key} must be between ${min} and ${max}` };
        settings[key] = Math.round(n);
    }
    return { settings };
}

function write(settings) {
    writeJsonAtomic(paths.dataFile(FILE_NAME), settings);
    return settings;
}

module.exports = { read, write, validate, DEFAULTS, LIMITS };
// <Jun Kai end>
