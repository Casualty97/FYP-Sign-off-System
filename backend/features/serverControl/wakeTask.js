// Owner: Role 3, Jun Kai.
// Windows wake timer: one scheduled task ("ESG Kiosk Wake") with WakeToRun and one trigger for every moment the
// kiosk policies switch the kiosk on in the next 14 days, firing a few minutes early so the PC is awake when the
// scheduler starts the kiosk. The scheduler rebuilds it on every policy change and once a day.
// Wake timers must be allowed in the power plan (the install script sets that); the task itself only runs
// "cmd.exe /c exit". On other platforms everything here is a no-op.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const paths = require('../../core/paths');
// <Jun Kai start>
const policies = require('./policies');
// <Jun Kai end>

const TASK_NAME = 'ESG Kiosk Wake';
const LEAD_MINUTES = 3;
// <Jun Kai start>
const HORIZON_DAYS = 14;
const MAX_TRIGGERS = 40; // Task Scheduler allows 48 triggers per task
// <Jun Kai end>
const XML_FILE = path.join(paths.DATA, 'esg-kiosk-wake.xml');
const WAKE_TIMERS_SETTING = ['238c9fa8-0aad-41ed-83f4-97be242c8f20', 'bd3b718a-0680-4d9d-8ab2-e1d2b4ac806d']; // Sleep > Allow wake timers

let dryRun = false;
let lastResult = { supported: process.platform === 'win32', synced: null, triggers: 0, error: null };

function setDryRun(value) { dryRun = !!value; }
const pad = (n) => String(n).padStart(2, '0');

// <Jun Kai start>
// One-time triggers from the real on/off timeline, so a Stop day (a holiday) never wakes the PC
let lastDropped = 0;
function buildTriggers(schedules, now = new Date()) {
    const { times, dropped } = policies.wakeTimes(schedules, now, { days: HORIZON_DAYS, leadMinutes: LEAD_MINUTES, max: MAX_TRIGGERS });
    lastDropped = dropped;
    if (dropped) console.warn(`⚠️ Wake timer: ${dropped} switch-on time(s) beyond the first ${MAX_TRIGGERS} wait for the next daily refresh`);
    const stamp = (t) => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}:00`;
    return times.map((t) => `<TimeTrigger><StartBoundary>${stamp(t)}</StartBoundary><Enabled>true</Enabled></TimeTrigger>`);
}
// <Jun Kai end>

function buildTaskXml(triggers) {
    return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Wakes the ESG kiosk PC ${LEAD_MINUTES} minutes before each time the kiosk policies switch the kiosk on (next ${HORIZON_DAYS} days, refreshed daily). Managed by the kiosk server: edits made here are overwritten.</Description>
  </RegistrationInfo>
  <Triggers>
    ${triggers.join('\n    ')}
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <WakeToRun>true</WakeToRun>
    <ExecutionTimeLimit>PT5M</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>cmd.exe</Command>
      <Arguments>/c exit</Arguments>
    </Exec>
  </Actions>
</Task>
`;
}

function schtasks(args, callback) {
    execFile('schtasks', args, { windowsHide: true }, (err, stdout, stderr) => callback(err, String(stdout || ''), String(stderr || '')));
}

// Create or replace the task from the active schedules; delete it when none is left
function sync(schedules, callback = () => {}) {
    if (process.platform !== 'win32') return callback(null);
    const triggers = buildTriggers(schedules);
    if (dryRun) {
        lastResult = { supported: true, synced: new Date().toISOString(), triggers: triggers.length, error: null, dryRun: true };
        console.log(`⏰ [dry run] wake timer task would have ${triggers.length} trigger(s)`);
        return callback(null);
    }
    // <Jun Kai start>
    if (!triggers.length) return remove('no policy switches the kiosk on', callback);
    const key = triggers.join('');
    // <Jun Kai end>
    try {
        fs.writeFileSync(XML_FILE, '﻿' + buildTaskXml(triggers), { encoding: 'utf16le' });
    } catch (error) {
        lastResult = { ...lastResult, error: error.message };
        return callback(error);
    }
    schtasks(['/Create', '/TN', TASK_NAME, '/XML', XML_FILE, '/F'], (err, stdout, stderr) => {
        // <Jun Kai start>
        lastResult = { supported: true, synced: new Date().toISOString(), triggers: triggers.length, dropped: lastDropped, error: err ? (stderr.trim() || err.message) : null };
        // <Jun Kai end>
        if (err) console.error('⚠️ Could not update the wake timer task:', lastResult.error);
        // <Jun Kai start>
        else if (key !== lastTriggerKey) console.log(`⏰ Wake timer task updated: ${triggers.length} trigger${triggers.length === 1 ? '' : 's'}`);
        else console.debug(`⏰ Wake timer task refreshed, no change (${triggers.length} trigger${triggers.length === 1 ? '' : 's'})`);
        if (!err) lastTriggerKey = key;
        // <Jun Kai end>
        callback(err);
    });
}

// <Jun Kai start>
let lastTriggerKey = null; // the wake-ups last written, so a refresh that changes nothing stays quiet

// Removes the task when there is one (an error from schtasks only means there was none)
function remove(reason, callback = () => {}) {
    if (process.platform !== 'win32') return callback(null);
    if (dryRun) {
        lastResult = { supported: true, synced: new Date().toISOString(), triggers: 0, error: null, dryRun: true };
        console.log(`⏰ [dry run] wake timer task would be removed: ${reason}`);
        return callback(null);
    }
    schtasks(['/Delete', '/TN', TASK_NAME, '/F'], (err) => {
        lastResult = { supported: true, synced: new Date().toISOString(), triggers: 0, error: null };
        if (!err) console.log(`⏰ Wake timer task removed: ${reason}`);
        lastTriggerKey = '';
        callback(null);
    });
}

// Manual mode pauses the policies, so nothing may wake the PC; switching back to AUTO rebuilds the task
function clear(callback) {
    remove('manual mode pauses the policies', callback);
}
// <Jun Kai end>

// Task present? next run? are wake timers allowed in the active power plan?
function status(callback) {
    if (process.platform !== 'win32') return callback({ ...lastResult, supported: false, task: null, wakeTimersAllowed: null });
    schtasks(['/Query', '/TN', TASK_NAME, '/FO', 'LIST', '/V'], (err, stdout) => {
        const task = err
            ? { exists: false }
            : {
                exists: true,
                nextRun: ((stdout.match(/^Next Run Time:\s*(.+)$/m) || [])[1] || '').trim() || null,
                state: ((stdout.match(/^Status:\s*(.+)$/m) || [])[1] || '').trim() || null
            };
        execFile('powercfg', ['/q', 'SCHEME_CURRENT', ...WAKE_TIMERS_SETTING], { windowsHide: true }, (pErr, pOut) => {
            const m = String(pOut || '').match(/Current AC Power Setting Index:\s*0x([0-9a-f]+)/i);
            const setting = pErr || !m ? null : parseInt(m[1], 16); // 1 = enabled, 0 = disabled, 2 = important wake timers only
            callback({ ...lastResult, task, wakeTimersSetting: setting, wakeTimersAllowed: setting === null ? null : setting === 1 });
        });
    });
}

module.exports = { TASK_NAME, LEAD_MINUTES, setDryRun, buildTriggers, buildTaskXml, sync, clear, status };
