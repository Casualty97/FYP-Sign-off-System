// Owner: Role 3, Jun Kai.
// Runs the saved schedules. Started by backend/server.js only. Once a minute, in AUTO mode:
//  - a schedule's stop time has just passed and no other schedule is open -> hibernate the PC (once per stop)
//  - a schedule window is open and the kiosk server is not reachable -> start it (this is also what brings the
//    kiosk back after the Windows wake timer resumes the PC in the morning)
// KIOSK_AUTOMATION=off disables everything (CI, laptops); KIOSK_AUTOMATION=dry-run logs instead of acting.
const control = require('./control');
const wakeTask = require('./wakeTask');

const state = { started: false, enabled: true, dryRun: false, lastTick: null, lastStartAttempt: 0, timer: null };

function automationSetting() {
    const value = String(process.env.KIOSK_AUTOMATION || 'on').toLowerCase();
    return ['off', 'dry-run'].includes(value) ? value : 'on';
}

function tick(now = new Date()) {
    state.lastTick = now.toISOString();
    if (control.readModeConfig().mode !== 'auto') return;

    const schedules = control.readSchedulesConfig().schedules.filter((s) => s.is_active !== false);
    if (!schedules.length) return;
    const running = control.shouldBeRunning(schedules, now);
    const lastKey = control.readAutomation().lastHibernateKey;
    const due = control.stopsDue(schedules, now).filter((w) => control.stopKey(w) !== lastKey);

    if (due.length && !running) {
        control.setLastHibernateKey(control.stopKey(due[0]));
        control.hibernateNow(`"${due[0].schedule.schedule_name}" stop time ${due[0].schedule.end_time}`, { dryRun: state.dryRun });
        return;
    }

    if (running && Date.now() - state.lastStartAttempt > 5 * 60 * 1000) {
        control.resolveKioskStatus((status) => {
            if (status.running) return;
            state.lastStartAttempt = Date.now();
            control.recordEvent('start', `"${running.schedule.schedule_name}" is open and the kiosk server is not reachable`, state.dryRun);
            if (state.dryRun) return;
            control.startKiosk((result) => {
                control.recordEvent(result.success ? 'start-ok' : 'start-failed', result.message || result.error);
            });
        });
    }
}

function start() {
    if (state.started) return;
    state.started = true;
    const setting = automationSetting();
    state.enabled = setting !== 'off';
    state.dryRun = setting === 'dry-run';
    if (!state.enabled) {
        console.log('⏸️  Kiosk automation is off on this machine (KIOSK_AUTOMATION=off)');
        return;
    }
    wakeTask.setDryRun(state.dryRun);
    control.onSchedulesChanged((schedules) => wakeTask.sync(schedules));
    wakeTask.sync(control.readSchedulesConfig().schedules);
    console.log(`⏰ Kiosk automation ${state.dryRun ? 'in DRY RUN (actions are only logged)' : 'on'}: schedules apply in AUTO mode`);
    setTimeout(() => {
        tick();
        state.timer = setInterval(() => tick(), 60000);
    }, 5000);
}

function getStatus(callback) {
    const now = new Date();
    const schedules = control.readSchedulesConfig().schedules.filter((s) => s.is_active !== false);
    const transitions = control.nextTransitions(schedules, now);
    const automation = control.readAutomation();
    wakeTask.status((wake) => {
        callback({
            enabled: state.enabled,
            dryRun: state.dryRun,
            mode: control.readModeConfig().mode,
            lastTick: state.lastTick,
            activeSchedules: schedules.length,
            currentWindow: transitions.current
                ? { schedule: transitions.current.schedule.schedule_name, until: transitions.current.endAt.toISOString() }
                : null,
            nextStart: transitions.nextStart ? transitions.nextStart.toISOString() : null,
            nextStop: transitions.nextStop ? transitions.nextStop.toISOString() : null,
            events: automation.events.slice(-10).reverse(),
            wake
        });
    });
}

module.exports = { start, tick, getStatus };
