// Owner: Role 3, Jun Kai.
// Windows wake timer: one scheduled task ("ESG Kiosk Wake") with WakeToRun and one trigger per active schedule,
// firing a few minutes before each start time so the PC is awake when the scheduler starts the kiosk.
// Wake timers must be allowed in the power plan (the install script sets that); the task itself only runs
// "cmd.exe /c exit". On other platforms everything here is a no-op.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const paths = require('../../core/paths');

const TASK_NAME = 'ESG Kiosk Wake';
const LEAD_MINUTES = 3;
const XML_FILE = path.join(paths.DATA, 'esg-kiosk-wake.xml');
const DAY_TAGS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WAKE_TIMERS_SETTING = ['238c9fa8-0aad-41ed-83f4-97be242c8f20', 'bd3b718a-0680-4d9d-8ab2-e1d2b4ac806d']; // Sleep > Allow wake timers

let dryRun = false;
let lastResult = { supported: process.platform === 'win32', synced: null, triggers: 0, error: null };

function setDryRun(value) { dryRun = !!value; }
const pad = (n) => String(n).padStart(2, '0');

// 'HH:MM' minus the lead; `wrapped` means it moved to the previous day
function wakeTime(text) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || '').trim());
    if (!m) return null;
    const minutes = Number(m[1]) * 60 + Number(m[2]) - LEAD_MINUTES;
    const total = minutes < 0 ? minutes + 24 * 60 : minutes;
    return { h: Math.floor(total / 60), min: total % 60, wrapped: minutes < 0 };
}

function buildTriggers(schedules, now = new Date()) {
    const triggers = [];
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    for (const s of schedules) {
        if (s.is_active === false) continue;
        const t = wakeTime(s.start_time);
        if (!t) continue;
        const boundary = (ymd) => `${ymd}T${pad(t.h)}:${pad(t.min)}:00`;
        if (s.schedule_type === 'daily') {
            triggers.push(`<CalendarTrigger><StartBoundary>${boundary(today)}</StartBoundary><Enabled>true</Enabled><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>`);
        } else if (s.schedule_type === 'weekly') {
            let days = String(s.days_of_week || '').split(',').map((d) => Number(d.trim())).filter((d) => d >= 1 && d <= 7);
            if (t.wrapped) days = days.map((d) => (d === 1 ? 7 : d - 1)); // wake the evening before
            if (!days.length) continue;
            const dayTags = [...new Set(days)].map((d) => `<${DAY_TAGS[d - 1]} />`).join('');
            triggers.push(`<CalendarTrigger><StartBoundary>${boundary(today)}</StartBoundary><Enabled>true</Enabled><ScheduleByWeek><DaysOfWeek>${dayTags}</DaysOfWeek><WeeksInterval>1</WeeksInterval></ScheduleByWeek></CalendarTrigger>`);
        } else if (s.schedule_type === 'specific_date' && s.specific_date) {
            let ymd = String(s.specific_date).slice(0, 10);
            if (t.wrapped) {
                const d = new Date(`${ymd}T12:00:00`);
                d.setDate(d.getDate() - 1);
                ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            }
            if (new Date(boundary(ymd)) > now) {
                triggers.push(`<TimeTrigger><StartBoundary>${boundary(ymd)}</StartBoundary><Enabled>true</Enabled></TimeTrigger>`);
            }
        }
    }
    return triggers;
}

function buildTaskXml(triggers) {
    return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Wakes the ESG kiosk PC ${LEAD_MINUTES} minutes before each start time set in the kiosk admin page. Managed by the kiosk server: edits made here are overwritten.</Description>
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
    if (!triggers.length) {
        return schtasks(['/Delete', '/TN', TASK_NAME, '/F'], () => {
            lastResult = { supported: true, synced: new Date().toISOString(), triggers: 0, error: null };
            callback(null);
        });
    }
    try {
        fs.writeFileSync(XML_FILE, '﻿' + buildTaskXml(triggers), { encoding: 'utf16le' });
    } catch (error) {
        lastResult = { ...lastResult, error: error.message };
        return callback(error);
    }
    schtasks(['/Create', '/TN', TASK_NAME, '/XML', XML_FILE, '/F'], (err, stdout, stderr) => {
        lastResult = { supported: true, synced: new Date().toISOString(), triggers: triggers.length, error: err ? (stderr.trim() || err.message) : null };
        if (err) console.error('⚠️ Could not update the wake timer task:', lastResult.error);
        else console.log(`⏰ Wake timer task updated: ${triggers.length} trigger${triggers.length === 1 ? '' : 's'}`);
        callback(err);
    });
}

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

module.exports = { TASK_NAME, LEAD_MINUTES, setDryRun, buildTriggers, buildTaskXml, sync, status };
