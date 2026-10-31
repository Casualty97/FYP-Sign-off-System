// Owner: Role 3, Jun Kai.
// Health checks behind the admin System Health page. Every check answers
// { key, label, status: ok | warn | down | unknown, summary, detail, latencyMs } and never throws.
const os = require('os');
const fs = require('fs');
const http = require('http');
const https = require('https');
const db = require('../../core/db');
const paths = require('../../core/paths');
const serverControl = require('../serverControl/control');
const scheduler = require('../serverControl/scheduler');
const emailService = require('../email/service');

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const EMAIL_CACHE_MS = 5 * 60 * 1000; // an SMTP verify talks to Gmail, so keep the result for a while
const TABLET_ONLINE_SECONDS = 180;

const query = (fn, sql, params) => new Promise((resolve, reject) => db[fn](sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));
const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms))
]);
async function timed(fn) {
    const started = process.hrtime.bigint();
    const value = await fn();
    return { value, ms: Math.round(Number(process.hrtime.bigint() - started) / 1e6) };
}

function getJson(url, ms) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.get(url, { timeout: ms }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
                catch { resolve({ status: res.statusCode, body: null }); }
            });
        });
        req.on('timeout', () => req.destroy(new Error(`timed out after ${ms} ms`)));
        req.on('error', reject);
    });
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d) return `${d}d ${h}h`;
    return h ? `${h}h ${m}m` : `${m}m`;
}

// ---------------------------------------------------------------- the checks
async function checkDatabase() {
    const base = { key: 'database', label: 'MySQL database' };
    try {
        const { value, ms } = await timed(() => withTimeout(query('get', 'SELECT VERSION() AS version, DATABASE() AS name', []), 5000, 'MySQL'));
        return { ...base, status: ms > 1000 ? 'warn' : 'ok', summary: `MySQL ${value.version} answered in ${ms} ms`, detail: { database: value.name, host: process.env.DB_HOST || 'localhost' }, latencyMs: ms };
    } catch (error) {
        return { ...base, status: 'down', summary: 'Not reachable', detail: { error: error.message, hint: 'Check that the MySQL84 service is running' }, latencyMs: null };
    }
}

async function checkOllama() {
    const base = { key: 'ollama', label: 'Ollama (local LLM)' };
    try {
        const { value, ms } = await timed(() => getJson(`${OLLAMA_URL}/api/tags`, 4000));
        const models = Array.isArray(value.body && value.body.models) ? value.body.models.map((m) => m.name) : [];
        if (value.status !== 200) return { ...base, status: 'down', summary: `Answered HTTP ${value.status}`, detail: { url: OLLAMA_URL }, latencyMs: ms };
        return {
            ...base,
            status: models.length ? 'ok' : 'warn',
            summary: models.length ? `${models.length} model${models.length === 1 ? '' : 's'} ready, ${ms} ms` : 'Running but no model is pulled',
            detail: { url: OLLAMA_URL, models, hint: models.length ? null : 'Run "ollama pull qwen2.5:3b" (or the model chosen in Feedback Reports)' },
            latencyMs: ms
        };
    } catch (error) {
        return { ...base, status: 'down', summary: 'Not running', detail: { url: OLLAMA_URL, error: error.message, hint: 'Start Ollama; the qwen, gemma and localgpt analysis modes need it' }, latencyMs: null };
    }
}

async function checkDisk() {
    const base = { key: 'disk', label: 'Disk space' };
    try {
        const stats = await fs.promises.statfs(paths.ROOT);
        const total = stats.blocks * stats.bsize;
        const free = stats.bavail * stats.bsize;
        const usedPercent = total ? Math.round((1 - free / total) * 100) : 0;
        const gb = (n) => (n / 1024 ** 3).toFixed(1);
        return {
            ...base,
            status: usedPercent >= 95 ? 'down' : usedPercent >= 85 ? 'warn' : 'ok',
            summary: `${gb(free)} GB free of ${gb(total)} GB (${usedPercent}% used)`,
            detail: { path: paths.ROOT, freeBytes: free, totalBytes: total, usedPercent },
            latencyMs: null
        };
    } catch (error) {
        return { ...base, status: 'unknown', summary: 'Could not read the disk', detail: { error: error.message }, latencyMs: null };
    }
}

function checkKiosk() {
    const base = { key: 'kiosk', label: 'Kiosk server (:3003)' };
    return new Promise((resolve) => {
        const started = Date.now();
        serverControl.resolveKioskStatus((result) => {
            const ms = Date.now() - started;
            resolve(result.running
                ? { ...base, status: 'ok', summary: `Reachable, ${ms} ms`, detail: { status: result.status, source: result.source }, latencyMs: ms }
                : { ...base, status: 'down', summary: 'Not reachable', detail: { status: result.status, source: result.source, hint: 'Start it from Server Schedule or check logs/' }, latencyMs: ms });
        });
    });
}

let emailCache = { at: 0, result: null };
async function checkEmail(force = false) {
    const base = { key: 'email', label: 'Email (SMTP)' };
    if (!force && emailCache.result && Date.now() - emailCache.at < EMAIL_CACHE_MS) return { ...emailCache.result, cached: true };
    let result;
    try {
        const { value, ms } = await timed(() => withTimeout(emailService.checkEmailService(), 15000, 'SMTP check'));
        result = value.available && value.verified
            ? { ...base, status: 'ok', summary: `${value.service || 'SMTP'} login works, ${ms} ms`, detail: { provider: value.service, sender: value.sender }, latencyMs: ms }
            : { ...base, status: 'down', summary: 'Cannot log in to the mail server', detail: { sender: value.sender, error: value.error || 'verification failed', hint: 'Check Email Management' }, latencyMs: ms };
    } catch (error) {
        result = { ...base, status: 'down', summary: 'Cannot reach the mail server', detail: { error: error.message }, latencyMs: null };
    }
    emailCache = { at: Date.now(), result };
    return result;
}

function cpuTimes() {
    let idle = 0;
    let total = 0;
    for (const cpu of os.cpus()) {
        for (const value of Object.values(cpu.times)) total += value;
        idle += cpu.times.idle;
    }
    return { idle, total };
}

async function checkServer() {
    const before = cpuTimes();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const after = cpuTimes();
    const busy = after.total - before.total;
    const cpuPercent = busy ? Math.round((1 - (after.idle - before.idle) / busy) * 100) : 0;
    const totalMem = os.totalmem();
    const memoryPercent = Math.round((1 - os.freemem() / totalMem) * 100);
    const rss = process.memoryUsage().rss;
    return {
        key: 'server',
        label: 'Server PC',
        status: cpuPercent >= 95 || memoryPercent >= 95 ? 'warn' : 'ok',
        summary: `CPU ${cpuPercent}%, memory ${memoryPercent}%, up ${formatUptime(os.uptime())}`,
        detail: {
            hostname: os.hostname(),
            platform: `${os.type()} ${os.release()}`,
            node: process.version,
            cpuPercent,
            cpuCount: os.cpus().length,
            memoryPercent,
            memoryTotalGb: (totalMem / 1024 ** 3).toFixed(1),
            processMemoryMb: Math.round(rss / 1024 ** 2),
            processUptime: formatUptime(process.uptime()),
            localTime: new Date().toLocaleString('en-SG', { hour12: false }),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        latencyMs: null
    };
}

let heartbeatTableWarned = false;
async function checkTablets() {
    const base = { key: 'tablets', label: 'Tablets' };
    try {
        const rows = await query('all', `
            SELECT device_id, label, page, battery_level, charging, user_agent, ip, first_seen, last_seen,
                   TIMESTAMPDIFF(SECOND, last_seen, NOW()) AS seconds_ago
            FROM device_heartbeats
            ORDER BY last_seen DESC
            LIMIT 50`, []);
        const devices = rows.map((r) => ({ ...r, online: r.seconds_ago <= TABLET_ONLINE_SECONDS }));
        const online = devices.filter((d) => d.online);
        const lowBattery = online.filter((d) => d.battery_level !== null && d.battery_level <= 20 && !d.charging);
        let status = 'ok';
        let summary = `${online.length} online of ${devices.length} known`;
        if (!devices.length) { status = 'unknown'; summary = 'No tablet has reported yet'; }
        else if (!online.length) { status = 'warn'; summary = `None of the ${devices.length} known tablets reported in the last 3 minutes`; }
        else if (lowBattery.length) { status = 'warn'; summary += `, ${lowBattery.length} low on battery`; }
        return { ...base, status, summary, detail: { devices, onlineWindowSeconds: TABLET_ONLINE_SECONDS }, latencyMs: null };
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
            if (!heartbeatTableWarned) { heartbeatTableWarned = true; console.warn('⚠️ device_heartbeats table is missing: run npm run db:migrate'); }
            return { ...base, status: 'unknown', summary: 'Heartbeat table missing: run npm run db:migrate', detail: { devices: [] }, latencyMs: null };
        }
        return { ...base, status: 'unknown', summary: 'Could not read the heartbeats', detail: { devices: [], error: error.message }, latencyMs: null };
    }
}

function checkAutomation() {
    const base = { key: 'automation', label: 'Schedules & hibernation' };
    return new Promise((resolve) => {
        scheduler.getStatus((a) => {
            let status = 'ok';
            let summary = `${a.activeSchedules} active schedule${a.activeSchedules === 1 ? '' : 's'}, AUTO mode`;
            if (!a.enabled) { status = 'unknown'; summary = 'Automation is off on this machine'; }
            else if (a.mode !== 'auto') { status = 'warn'; summary = 'Manual mode: schedules are paused'; }
            else if (!a.activeSchedules) { status = 'warn'; summary = 'AUTO mode but no active schedule'; }
            else if (a.wake && a.wake.supported && a.wake.task && !a.wake.task.exists) { status = 'warn'; summary += ', wake timer missing'; }
            else if (a.wake && a.wake.wakeTimersAllowed === false) { status = 'warn'; summary += ', wake timers blocked by Windows'; }
            resolve({
                ...base,
                status,
                summary,
                detail: {
                    mode: a.mode,
                    nextStop: a.nextStop,
                    nextStart: a.nextStart,
                    wakeTask: a.wake && a.wake.task ? (a.wake.task.exists ? 'set' : 'missing') : 'not available',
                    lastEvent: a.events && a.events[0] ? a.events[0] : null
                },
                latencyMs: null
            });
        });
    });
}

async function runAll({ refreshEmail = false } = {}) {
    const checks = await Promise.all([
        checkDatabase(), checkKiosk(), checkDisk(), checkServer(), checkOllama(), checkEmail(refreshEmail), checkTablets(), checkAutomation()
    ]);
    const counts = { ok: 0, warn: 0, down: 0, unknown: 0 };
    for (const check of checks) counts[check.status] = (counts[check.status] || 0) + 1;
    return {
        checkedAt: new Date().toISOString(),
        overall: counts.down ? 'down' : counts.warn ? 'warn' : 'ok',
        counts,
        checks
    };
}

module.exports = { runAll, checkDatabase, checkOllama, checkDisk, checkKiosk, checkEmail, checkServer, checkTablets, checkAutomation, OLLAMA_URL };
