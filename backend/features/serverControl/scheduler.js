// Owner: Role 3, Jun Kai.
// Runs the saved policies. Started by backend/server.js only. Once a minute, in AUTO mode:
//  - the policies have just switched the kiosk off (an Active policy ended or a Stop policy began) -> hibernate the
//    PC (once per switch)
//  - the policies say the kiosk runs and the kiosk server is not reachable -> start it (this is also what brings the
//    kiosk back after the Windows wake timer resumes the PC)
// KIOSK_AUTOMATION=off disables everything (CI, laptops); KIOSK_AUTOMATION=dry-run logs instead of acting.
const control = require('./control');
const wakeTask = require('./wakeTask');
// <Jun Kai start>
const policies = require('./policies');

const state = { started: false, enabled: true, dryRun: false, lastTick: null, lastStartAttempt: 0, timer: null, wakeSyncDay: null, lastOn: null };

function automationSetting() {
    const value = String(process.env.KIOSK_AUTOMATION || 'on').toLowerCase();
    return ['off', 'dry-run'].includes(value) ? value : 'on';
}

// The wake task covers 14 days, so rebuild it on the first tick of each day (also right after the PC resumes)
function syncWakeDaily(list, now) {
    const today = policies.localYmd(now);
    if (state.wakeSyncDay === today) return;
    state.wakeSyncDay = today;
    wakeTask.sync(list);
}

function tick(now = new Date()) {
    state.lastTick = now.toISOString();
    const list = control.readSchedulesConfig().schedules;
    syncWakeDaily(list, now);
    // worked out in manual mode too, so switching back to automatic at night is not mistaken for a switch-off
    const decision = policies.decide(list, now, control.readAutomation().lastHibernateKey, { lastOn: state.lastOn });
    state.lastOn = decision.on;
    if (control.readModeConfig().mode !== 'auto') return;

    if (decision.hibernate) {
        control.setLastHibernateKey(decision.key);
        control.hibernateNow(`the kiosk switched off: ${policies.offReason(decision.due)}`, { dryRun: state.dryRun });
        return;
    }

    if (decision.on && Date.now() - state.lastStartAttempt > 5 * 60 * 1000) {
        control.resolveKioskStatus((status) => {
            if (status.running) return;
            state.lastStartAttempt = Date.now();
            control.recordEvent('start', `"${decision.winner.policy.schedule_name}" is in force and the kiosk server is not reachable`, state.dryRun);
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
    control.onSchedulesChanged((list) => wakeTask.sync(list));
    syncWakeDaily(control.readSchedulesConfig().schedules, new Date());
    console.log(`⏰ Kiosk automation ${state.dryRun ? 'in DRY RUN (actions are only logged)' : 'on'}: policies apply in AUTO mode`);
    setTimeout(() => {
        tick();
        state.timer = setInterval(() => tick(), 60000);
    }, 5000);
}

function getStatus(callback) {
    const now = new Date();
    const list = control.readSchedulesConfig().schedules;
    const enabledList = list.filter(policies.isEnabled);
    const current = policies.status(list, now);
    const automation = control.readAutomation();
    const until = current.until ? current.until.toISOString() : null;
    wakeTask.status((wake) => {
        callback({
            enabled: state.enabled,
            dryRun: state.dryRun,
            mode: control.readModeConfig().mode,
            lastTick: state.lastTick,
            activeSchedules: enabledList.length,
            stopPolicies: enabledList.filter((p) => policies.actionOf(p) === 'stop').length,
            activePolicies: enabledList.filter((p) => policies.actionOf(p) === 'active').length,
            wakeNeeded: policies.wakeTimes(list, now).times.length > 0,
            currentWindow: current.on && current.policy ? { schedule: current.policy.schedule_name, until } : null,
            stoppedBy: !current.on && current.policy ? { schedule: current.policy.schedule_name, until } : null,
            nextStart: current.nextStart ? current.nextStart.toISOString() : null,
            nextStop: current.nextStop ? current.nextStop.toISOString() : null,
            events: automation.events.slice(-10).reverse(),
            wake
        });
    });
}

module.exports = { start, tick, getStatus };
// <Jun Kai end>
