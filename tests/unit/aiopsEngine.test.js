// Owner: Role 3, Jun Kai.
// Unit tests for the runner that drives anomaly detection inside server.js (backend/features/aiops/engine.js): a fake
// clock, a fake database that only answers the runner's own queries, the memory store and the real detectors.
// Run: npm run test:unit
// <Jun Kai start>
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const incidents = require('../../backend/features/aiops/incidents');
const settings = require('../../backend/features/aiops/settings');
const { createRunner } = require('../../backend/features/aiops/engine');

const START = Date.parse('2026-11-11T02:00:00Z'); // 10:00 in Singapore
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// world: what the fakes answer; the test changes it between checks. overrides: other fakes for createRunner
function setup(world = {}, overrides = {}) {
    let t = START;
    const w = { mode: 'manual', kioskOn: true, samplesError: null, ...world };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiops-engine-'));
    const store = incidents.memoryStore();
    const db = {
        all(sql, params, callback) {
            if (w.samplesError) return callback(new Error(w.samplesError));
            return callback(null, []); // no hardware samples: the hardware detectors report "no data"
        }
    };
    const runner = createRunner({
        db: () => db,
        store: () => store,
        recorder: () => ({ start() {}, runs: () => [], latest: () => null, getStatus: () => ({ lastRunAt: null, lastError: null, runCount: 0 }) }),
        hardware: () => ({ read: () => ({ intervalSeconds: 60 }) }),
        control: () => ({ readModeConfig: () => ({ mode: w.mode }), readSchedulesConfig: () => ({ schedules: [] }) }),
        policies: () => ({ status: () => ({ on: w.kioskOn }) }),
        settings: () => settings.DEFAULTS,
        audit: () => {},
        files: () => [path.join(dir, 'app-events-server.jsonl'), path.join(dir, 'app-events-kiosk.jsonl')],
        now: () => new Date(t),
        ...overrides
    });
    return {
        runner, store, world: w,
        advance: (ms) => { t += ms; },
        // one check a minute, like the timer
        async minutes(n) { let last; for (let i = 0; i < n; i++) { t += MINUTE; last = await runner.runNow(); } return last; },
        cleanup: () => fs.rmSync(dir, { recursive: true, force: true })
    };
}

test('the hardware detectors wait 15 minutes after a start and again after a wake-up from hibernation', async () => {
    const s = setup();
    try {
        let result = await s.minutes(1);
        assert.equal(result.states.spike, 'muted');
        assert.equal(result.states.timeOfDay, 'muted');
        assert.match(result.notes.spike, /started or woke up 1 min ago/);
        assert.equal(result.states.disk, 'no-data', 'the other detectors run at once');

        result = await s.minutes(13);
        assert.equal(result.states.spike, 'muted', 'still settling 14 minutes in');
        result = await s.minutes(1);
        assert.equal(result.states.spike, 'no-data', 'looking again from minute 15 (there are no samples in this test)');

        s.advance(15 * HOUR); // the PC hibernated overnight: no check ran
        result = await s.minutes(1);
        assert.equal(result.states.spike, 'muted', 'a long pause between two checks counts as a wake-up');
        assert.match(result.notes.spike, /woke up 0 min ago/);
        result = await s.minutes(15);
        assert.equal(result.states.spike, 'no-data');
    } finally { s.cleanup(); }
});

test('an incident the tablets detector of an earlier version left open is closed at the next check', async () => {
    const s = setup();
    try {
        const at = new Date(START - HOUR).toISOString();
        const id = await s.store.insert({ fingerprint: 'tablets:offline:tab-000001', detector: 'tablets', kind: 'offline', subject: 'tab-000001', severity: 'warn',
            status: 'open', title: 'Tablet 1 offline for 15 h', opened_at: at, last_seen_at: at, occurrences: 1 });
        const result = await s.minutes(1);
        assert.equal(result.resolved, 1);
        const closed = await s.store.get(id);
        assert.deepEqual([closed.status, closed.resolved_by], ['resolved', 'auto']);
        assert.deepEqual((await s.store.events(id)).at(-1).detail, { auto: true, reason: 'detector-off' });
        const status = s.runner.getStatus();
        assert.equal(status.detectors.length, 6);
        assert.equal(status.detectors.some((d) => d.key === 'tablets'), false, 'the status lists no tablets detector');
        assert.equal('namedTablets' in status.data, false);
    } finally { s.cleanup(); }
});

test('before the first check every detector is waiting, and a failed check keeps its error for the status', async () => {
    const s = setup();
    try {
        assert.deepEqual(s.runner.getStatus().detectors.map((d) => d.state), Array(6).fill('waiting'));
        s.world.samplesError = 'connection lost'; // the fake database now fails the sample queries
        const original = console.warn;
        console.warn = () => {};
        try {
            await assert.rejects(() => s.minutes(1));
        } finally { console.warn = original; }
        assert.equal(s.runner.getStatus().lastError, 'connection lost', 'the status carries the message');
        s.world.samplesError = null;
        await s.minutes(1);
        assert.equal(s.runner.getStatus().lastError, null, 'the next good check clears it');
    } finally { s.cleanup(); }
});

test('with Anomaly detection off nothing is compared, but the advisor still looks at the open incidents', async () => {
    let sweeps = 0;
    const advisor = () => ({ sweep: async () => { sweeps++; return 0; }, request: () => ({ queued: false }), isBusy: () => false, getStatus: () => ({ on: true, localAi: true }) });
    const s = setup({}, { settings: () => ({ ...settings.DEFAULTS, enabled: false }), advisor });
    try {
        const result = await s.minutes(2);
        assert.equal(result.skipped, 'disabled');
        assert.equal(sweeps, 2, 'one advice sweep after every check, as with detection on');
    } finally { s.cleanup(); }
});
// <Jun Kai end>
