// Owner: Role 3, Jun Kai. Previous team: Bernissa (schedule and mode files), Yu Kang (kiosk status probe).
// Kiosk server control shared by the admin routes and the automation scheduler: the schedule, mode and
// automation-log files, the kiosk status probe, the start and hibernate actions, and the schedule maths.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec, spawn } = require('child_process');
const paths = require('../../core/paths');
const { readJson, writeJsonAtomic } = require('../../core/jsonFile');

const SCHEDULE_CONFIG_PATH = process.env.SCHEDULE_CONFIG_PATH || paths.dataFile('kiosk-schedules.json');
const MODE_FILE = paths.dataFile('server-control-mode.json');
const AUTOMATION_FILE = paths.dataFile('server-automation.json');
const MAX_EVENTS = 50;

const kioskControlConfig = {
    windowsPidFile: path.join(paths.BACKEND, 'kioskServer.pid'),
    kioskScriptPath: path.join(paths.BACKEND, 'kioskServer.js'),
    kioskPort: 3003
};

const localStamp = () => new Date().toLocaleString('sv-SE');
const scheduleListeners = [];

// ---------------------------------------------------------------- schedule + mode files
function readSchedulesConfig() {
    if (!fs.existsSync(SCHEDULE_CONFIG_PATH)) {
        const empty = { schedules: [], last_updated: localStamp() };
        try { writeJsonAtomic(SCHEDULE_CONFIG_PATH, empty); } catch (error) { console.error('❌ Could not create the schedules file:', error.message); }
        return empty;
    }
    const config = readJson(SCHEDULE_CONFIG_PATH, null);
    if (!config || !Array.isArray(config.schedules)) {
        console.error('❌ Schedules file is not valid JSON; treating it as empty until it is saved again');
        return { schedules: [], last_updated: null };
    }
    return config;
}

function writeSchedulesConfig(config) {
    try {
        config.last_updated = localStamp();
        writeJsonAtomic(SCHEDULE_CONFIG_PATH, config);
    } catch (error) {
        console.error('❌ Error writing schedules config:', error);
        return false;
    }
    for (const listener of scheduleListeners) {
        try { listener(config.schedules); } catch (error) { console.error('⚠️ Schedule listener failed:', error.message); }
    }
    return true;
}

// Called after every schedule save (the scheduler uses it to refresh the Windows wake timer)
function onSchedulesChanged(listener) {
    scheduleListeners.push(listener);
}

// Manual is the safe default: in auto mode the scheduler hibernates the PC
function readModeConfig() {
    const config = readJson(MODE_FILE, null);
    if (config && ['auto', 'manual'].includes(config.mode)) return config;
    return { mode: 'manual', last_updated: new Date().toISOString(), updated_by: 'system' };
}

function writeModeConfig(config) {
    try {
        config.last_updated = new Date().toISOString();
        writeJsonAtomic(MODE_FILE, config);
        console.log(`✅ Mode file updated: ${config.mode}`);
        return true;
    } catch (error) {
        console.error('❌ Error writing mode file:', error);
        return false;
    }
}

// ---------------------------------------------------------------- automation log
function readAutomation() {
    const data = readJson(AUTOMATION_FILE, null);
    return data && Array.isArray(data.events) ? data : { events: [], lastHibernateKey: null };
}

function saveAutomation(data) {
    try { writeJsonAtomic(AUTOMATION_FILE, data); } catch (error) { console.error('⚠️ Could not write the automation log:', error.message); }
}

function recordEvent(type, detail, dryRun = false) {
    const data = readAutomation();
    data.events.push({ at: new Date().toISOString(), type, detail, dryRun: !!dryRun });
    if (data.events.length > MAX_EVENTS) data.events = data.events.slice(-MAX_EVENTS);
    saveAutomation(data);
    console.log(`🤖 Automation ${dryRun ? '[dry run] ' : ''}${type}: ${detail}`);
}

function setLastHibernateKey(key) {
    const data = readAutomation();
    data.lastHibernateKey = key;
    saveAutomation(data);
}

// ---------------------------------------------------------------- kiosk status
function probeKioskHttp(callback) {
    const hostsToTry = ['127.0.0.1', '::1', 'localhost'];

    function tryHost(index) {
        if (index >= hostsToTry.length) {
            callback({ running: false, status: 'unreachable', source: 'http-probe' });
            return;
        }
        const host = hostsToTry[index];
        const formattedHost = host.includes(':') ? `[${host}]` : host;
        let settled = false; // a timeout followed by the 'error' event must not advance twice
        const next = (result) => {
            if (settled) return;
            settled = true;
            if (result) callback(result); else tryHost(index + 1);
        };
        const probe = http.get(`http://${formattedHost}:${kioskControlConfig.kioskPort}/feedback`, (probeRes) => {
            const reachable = probeRes.statusCode >= 200 && probeRes.statusCode < 500;
            probeRes.resume();
            next(reachable ? { running: true, status: `reachable (${host})`, source: 'http-probe' } : null);
        });
        probe.setTimeout(1500, () => { probe.destroy(); next(null); });
        probe.on('error', () => next(null));
    }

    tryHost(0);
}

function resolveKioskStatus(callback) {
    if (process.platform === 'win32') {
        probeKioskHttp(callback);
        return;
    }
    exec('systemctl is-active kiosk.service', (err, stdout) => {
        const status = (stdout || '').trim();
        if (!err && status) {
            callback({ running: status === 'active', status, source: 'systemctl' });
            return;
        }
        probeKioskHttp(callback);
    });
}

let lastKioskStatusLogKey = null;
let lastKioskStatusLogAt = 0;

function logKioskStatusIfNeeded(result) {
    const now = Date.now();
    const logKey = `${result.status}|${result.source}`;
    if (logKey !== lastKioskStatusLogKey || now - lastKioskStatusLogAt >= 60000) {
        console.log(`📊 Kiosk service status: ${result.status} (${result.source})`);
        lastKioskStatusLogKey = logKey;
        lastKioskStatusLogAt = now;
    }
}

// ---------------------------------------------------------------- actions
// Starts the kiosk server if it is not reachable. callback({ success, message | error, ... })
function startKiosk(callback) {
    if (process.platform !== 'win32') {
        exec('sudo systemctl start kiosk.service', (err, stdout, stderr) => {
            if (err) {
                console.error('❌ Failed to start server:', stderr);
                return callback({ success: false, error: 'Failed to start server', platform: 'linux' });
            }
            callback({ success: true, message: 'Server started successfully', platform: 'linux' });
        });
        return;
    }

    resolveKioskStatus((statusInfo) => {
        if (statusInfo.running) {
            return callback({ success: true, message: 'Server is already running', platform: 'windows', source: statusInfo.source });
        }
        try {
            const child = spawn(process.execPath, [kioskControlConfig.kioskScriptPath], {
                cwd: paths.BACKEND,
                detached: true,
                stdio: 'ignore',
                windowsHide: true
            });
            child.unref();
            fs.writeFileSync(kioskControlConfig.windowsPidFile, String(child.pid));
        } catch (error) {
            console.error('❌ Failed to start Windows kiosk server:', error);
            return callback({ success: false, error: 'Failed to start server on Windows', platform: 'windows' });
        }
        // A cold start loads the AI modules first, so keep checking for up to 30 s
        const verifyStarted = (attempt) => {
            resolveKioskStatus((verifyInfo) => {
                if (verifyInfo.running) {
                    return callback({ success: true, message: 'Server started successfully', platform: 'windows', source: verifyInfo.source });
                }
                if (attempt < 15) return setTimeout(() => verifyStarted(attempt + 1), 2000);
                callback({
                    success: false,
                    error: 'Kiosk server did not become reachable within 30 seconds of the start command',
                    platform: 'windows',
                    status: verifyInfo.status
                });
            });
        };
        setTimeout(() => verifyStarted(1), 1500);
    });
}

// Hibernates the PC. Processes survive hibernation, so nothing needs to be stopped first.
function hibernateNow(reason, { dryRun = false } = {}) {
    recordEvent('hibernate', reason, dryRun);
    if (dryRun) return;
    const batFile = path.join(paths.ROOT, 'hibernate.bat');
    let command;
    if (process.platform === 'win32') command = fs.existsSync(batFile) ? `cmd.exe /c "${batFile}"` : 'shutdown /h';
    else command = 'systemctl hibernate';
    exec(command, (err, stdout, stderr) => {
        if (err) console.error('❌ Hibernate command failed:', err.message);
        if (stderr) console.error('❌ Hibernate command output:', stderr);
    });
}

// ---------------------------------------------------------------- schedule maths (pure, local clock)
// Times are what the admin typed, read on the wall PC's own clock. days_of_week uses 1 = Sunday ... 7 = Saturday.
const DAY_MS = 24 * 60 * 60 * 1000;

function parseTime(text) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || '').trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    return h > 23 || min > 59 ? null : { h, min };
}

function localYmd(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function appliesOn(schedule, day) {
    if (schedule.is_active === false) return false;
    if (schedule.schedule_type === 'daily') return true;
    if (schedule.schedule_type === 'weekly') {
        const days = String(schedule.days_of_week || '').split(',').map((d) => Number(d.trim())).filter(Boolean);
        return days.includes(day.getDay() + 1);
    }
    if (schedule.schedule_type === 'specific_date') return localYmd(day) === String(schedule.specific_date || '').slice(0, 10);
    return false;
}

// The window a schedule opens on `day`: starts that day, ends the same day or (stop before start) the next day
function windowOn(schedule, day) {
    const start = parseTime(schedule.start_time);
    const end = parseTime(schedule.end_time);
    if (!start || !end || !appliesOn(schedule, day)) return null;
    const startAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), start.h, start.min, 0, 0);
    let endAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), end.h, end.min, 0, 0);
    if (endAt <= startAt) endAt = new Date(endAt.getTime() + DAY_MS);
    return { schedule, startAt, endAt };
}

function windowsAround(schedules, now, daysBack, daysAhead) {
    const windows = [];
    for (let offset = -daysBack; offset <= daysAhead; offset++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
        for (const schedule of schedules) {
            const window = windowOn(schedule, day);
            if (window) windows.push(window);
        }
    }
    return windows.sort((a, b) => a.startAt - b.startAt);
}

// The window the kiosk should be running in right now, or null
function shouldBeRunning(schedules, now) {
    return windowsAround(schedules, now, 1, 0).find((w) => w.startAt <= now && now < w.endAt) || null;
}

// Windows whose stop time passed within the last `graceMs` (the scheduler ticks once a minute)
function stopsDue(schedules, now, graceMs = 90 * 1000) {
    return windowsAround(schedules, now, 1, 0).filter((w) => w.endAt <= now && now - w.endAt < graceMs);
}

function stopKey(window) {
    return `${window.schedule.id}|${window.endAt.toISOString()}`;
}

function nextTransitions(schedules, now) {
    const windows = windowsAround(schedules, now, 1, 14);
    const starts = windows.map((w) => w.startAt).filter((d) => d > now).sort((a, b) => a - b);
    const stops = windows.map((w) => w.endAt).filter((d) => d > now).sort((a, b) => a - b);
    return { current: shouldBeRunning(schedules, now), nextStart: starts[0] || null, nextStop: stops[0] || null };
}

module.exports = {
    SCHEDULE_CONFIG_PATH, MODE_FILE, AUTOMATION_FILE, kioskControlConfig,
    readSchedulesConfig, writeSchedulesConfig, onSchedulesChanged, readModeConfig, writeModeConfig,
    readAutomation, recordEvent, setLastHibernateKey,
    resolveKioskStatus, logKioskStatusIfNeeded, startKiosk, hibernateNow,
    parseTime, appliesOn, windowOn, shouldBeRunning, stopsDue, stopKey, nextTransitions
};
