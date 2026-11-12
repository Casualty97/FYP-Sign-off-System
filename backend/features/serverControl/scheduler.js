// Owner: Role 3, Jun Kai.
// Runs the saved policies. Started by backend/server.js only. Once a minute, in AUTO mode:
//  - the policies have just switched the kiosk off (an Active policy ended or a Stop policy began) -> the switch-off
//    is recorded in the automation log (once per switch). Putting the PC itself to sleep and waking it again is the
//    system-level hibernation scheduling of Role 4 (Ryan); policies.status and policies.wakeTimes give that part the
//    stop and start times
//  - the policies say the kiosk runs and the kiosk server is not reachable -> start it
// KIOSK_AUTOMATION=off disables everything (CI, laptops); KIOSK_AUTOMATION=dry-run logs instead of acting.
const control = require('./control');
// <Jun Kai start>
const policies = require('./policies');

const state = { started: false, enabled: true, dryRun: false, lastTick: null, lastStartAttempt: 0, timer: null, lastOn: null };

function automationSetting() {
    const value = String(process.env.KIOSK_AUTOMATION || 'on').toLowerCase();
    return ['off', 'dry-run'].includes(value) ? value : 'on';
}

function tick(now = new Date()) {
    state.lastTick = now.toISOString();
    const list = control.readSchedulesConfig().schedules;
    // worked out in manual mode too, so switching back to automatic at night is not mistaken for a switch-off
    const decision = policies.decide(list, now, control.readAutomation().lastHibernateKey, { lastOn: state.lastOn });
    state.lastOn = decision.on;
    if (control.readModeConfig().mode !== 'auto') return;

    if (decision.switchedOff) {
        // lastHibernateKey (name kept for saved files) marks this switch-off as recorded
        control.setLastHibernateKey(decision.key);
        control.recordEvent('off', `the kiosk switched off: ${policies.offReason(decision.due)}`, state.dryRun);
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
    callback({
        enabled: state.enabled,
        dryRun: state.dryRun,
        mode: control.readModeConfig().mode,
        lastTick: state.lastTick,
        activeSchedules: enabledList.length,
        stopPolicies: enabledList.filter((p) => policies.actionOf(p) === 'stop').length,
        activePolicies: enabledList.filter((p) => policies.actionOf(p) === 'active').length,
        currentWindow: current.on && current.policy ? { schedule: current.policy.schedule_name, until } : null,
        stoppedBy: !current.on && current.policy ? { schedule: current.policy.schedule_name, until } : null,
        nextStart: current.nextStart ? current.nextStart.toISOString() : null,
        nextStop: current.nextStop ? current.nextStop.toISOString() : null,
        events: automation.events.slice(-10).reverse()
    });
}

module.exports = { start, tick, getStatus };
// <Jun Kai end>
