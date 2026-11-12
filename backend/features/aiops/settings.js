// Owner: Role 3, Jun Kai.
// Settings of the anomaly detection on the System Health page: the master switch, how often the engine looks, how long
// results are kept, which detectors run and how sensitive each one is. Kept in backend/data/aiops-settings.json
// (seeded from backend/config/defaults).
// <Jun Kai start>
const paths = require('../../core/paths');
const { readJson, writeJsonAtomic } = require('../../core/jsonFile');

const FILE_NAME = 'aiops-settings.json';
const DETECTORS = [
    { key: 'spike', label: 'Sudden spikes', description: 'CPU, memory or GPU far above the last 24 hours' },
    { key: 'timeOfDay', label: 'Unusual for the time of day', description: 'Higher than this hour usually is' },
    { key: 'drift', label: 'Slow creep', description: 'Memory or disk use rising steadily for hours' },
    { key: 'disk', label: 'Disk filling up', description: 'Full within days at the current growth, or over 90 %' },
    { key: 'services', label: 'Services down or slow', description: 'MySQL, the kiosk server or the mail login' },
    { key: 'tablets', label: 'Named tablets offline', description: 'A tablet with a name stops reporting' },
    { key: 'logs', label: 'Server errors', description: 'A burst of errors, or a kind of error never seen before' }
];
const DEFAULTS = {
    enabled: true,
    intervalSeconds: 60,
    healthEverySeconds: 300,
    retentionDays: 30,
    keepIncidentsDays: 90,
    quietHours: true,
    cooldownMinutes: 30,
    clearAfterMinutes: 10,
    detectors: Object.fromEntries(DETECTORS.map((d) => [d.key, { enabled: true, sensitivity: 3 }])),
    // AIOps part 2: the local LLM that explains each incident and suggests one step (advisor.js)
    advisor: { enabled: true, model: 'qwen2.5:3b' }
};
// an Ollama model name such as qwen2.5:3b or gemma2:2b
const MODEL = /^[A-Za-z0-9._:/-]{1,80}$/;
// [min, max] like the Hardware settings; sensitivity applies to every detector
const LIMITS = {
    intervalSeconds: [30, 600],
    healthEverySeconds: [60, 3600],
    retentionDays: [1, 365],
    keepIncidentsDays: [7, 730],
    cooldownMinutes: [0, 1440],
    clearAfterMinutes: [1, 120],
    sensitivity: [1, 5]
};

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isSwitch = (key) => typeof DEFAULTS[key] === 'boolean';

function clampInt(value, [min, max], fallback) {
    const n = Number(value);
    return Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : fallback)));
}

// The stored settings with every key repaired (numbers clamped, switches on unless exactly false), so a hand-edited
// file can never break the engine
function repair(stored) {
    const s = isObject(stored) ? stored : {};
    const saved = isObject(s.detectors) ? s.detectors : {};
    const settings = {};
    for (const key of Object.keys(DEFAULTS)) {
        if (key === 'detectors' || key === 'advisor') continue;
        settings[key] = isSwitch(key) ? s[key] !== false : clampInt(s[key], LIMITS[key], DEFAULTS[key]);
    }
    settings.detectors = {};
    for (const { key } of DETECTORS) {
        const d = isObject(saved[key]) ? saved[key] : {};
        settings.detectors[key] = {
            enabled: d.enabled !== false,
            sensitivity: clampInt(d.sensitivity, LIMITS.sensitivity, DEFAULTS.detectors[key].sensitivity)
        };
    }
    const advisor = isObject(s.advisor) ? s.advisor : {};
    settings.advisor = {
        enabled: advisor.enabled !== false,
        model: typeof advisor.model === 'string' && MODEL.test(advisor.model.trim()) ? advisor.model.trim() : DEFAULTS.advisor.model
    };
    return settings;
}

function read() {
    return repair(readJson(paths.dataFile(FILE_NAME), {}));
}

// Each check returns { value } or { error, field } (field is the dotted settings key the page highlights)
const fail = (field, error) => ({ error, field });

function boolField(value, field) {
    return typeof value === 'boolean' ? { value } : fail(field, 'Choose on or off.');
}

function intField(value, [min, max], field) {
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (!Number.isInteger(n) || n < min || n > max) return fail(field, `Enter a whole number from ${min} to ${max}.`);
    return { value: n };
}

// Returns { settings } or { error, field } and writes nothing. Out-of-range values are refused, never clamped.
// Keys the body leaves out keep their previous value; keys the page does not know are ignored.
function validate(body, previous = read()) {
    if (!isObject(body)) return fail('', 'Send the settings as a JSON object.');
    const prev = repair(previous);
    const settings = {};
    for (const key of Object.keys(DEFAULTS)) {
        if (key === 'detectors' || key === 'advisor') continue;
        const value = has(body, key) ? body[key] : prev[key];
        const check = isSwitch(key) ? boolField(value, key) : intField(value, LIMITS[key], key);
        if (check.error) return check;
        settings[key] = check.value;
    }
    settings.detectors = {};
    const sent = isObject(body.detectors) ? body.detectors : {};
    for (const { key } of DETECTORS) {
        const d = { ...prev.detectors[key], ...(isObject(sent[key]) ? sent[key] : {}) };
        const enabled = boolField(d.enabled, `detectors.${key}.enabled`);
        if (enabled.error) return enabled;
        const sensitivity = intField(d.sensitivity, LIMITS.sensitivity, `detectors.${key}.sensitivity`);
        if (sensitivity.error) return sensitivity;
        settings.detectors[key] = { enabled: enabled.value, sensitivity: sensitivity.value };
    }
    const advisor = { ...prev.advisor, ...(isObject(body.advisor) ? body.advisor : {}) };
    const advisorOn = boolField(advisor.enabled, 'advisor.enabled');
    if (advisorOn.error) return advisorOn;
    if (typeof advisor.model !== 'string' || !MODEL.test(advisor.model.trim())) return fail('advisor.model', 'Choose a model name such as qwen2.5:3b.');
    settings.advisor = { enabled: advisorOn.value, model: advisor.model.trim() };
    return { settings };
}

function write(settings) {
    writeJsonAtomic(paths.dataFile(FILE_NAME), settings);
    return settings;
}

module.exports = { read, validate, write, repair, FILE_NAME, DETECTORS, DEFAULTS, LIMITS };
// <Jun Kai end>
