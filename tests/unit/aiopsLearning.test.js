// Owner: Role 3, Jun Kai.
// Unit tests for learning from the verdicts (backend/features/aiops/learning.js) and the runner hook that applies it.
// Run: npm run test:unit
// <Jun Kai start>
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const learning = require('../../backend/features/aiops/learning');
const incidents = require('../../backend/features/aiops/incidents');
const settings = require('../../backend/features/aiops/settings');
const { createRunner } = require('../../backend/features/aiops/engine');

const NOW = Date.parse('2026-11-12T06:00:00Z');
const DAY = 86400000;
const v = (verdict, minutesAgo) => ({ verdict, at: NOW - minutesAgo * 60000 });

test('three false alarms in a row make a detector one step less sensitive, and only new verdicts count next time', () => {
    const first = learning.learnStep([v('false-alarm', 30), v('not-useful', 20), v('false-alarm', 10)], {}, NOW);
    assert.deepEqual([first.changed, first.offset, first.countedAt], [true, -1, NOW - 10 * 60000]);
    assert.equal(learning.learnStep([v('false-alarm', 30), v('not-useful', 20), v('false-alarm', 10)], first, NOW).changed, false, 'the same verdicts never count twice');
    const mixed = learning.learnStep([v('false-alarm', 9), v('correct', 8), v('false-alarm', 7)], first, NOW);
    assert.equal(mixed.changed, false, 'a mixed run changes nothing');
    const second = learning.learnStep([v('false-alarm', 6), v('false-alarm', 5), v('not-useful', 4)], first, NOW);
    assert.equal(second.offset, -2);
    const floor = learning.learnStep([v('false-alarm', 3), v('false-alarm', 2), v('false-alarm', 1)], second, NOW);
    assert.equal(floor.changed, false, 'at most two steps below the admin level');
});

test('three Correct in a row bring it back one step, never above the admin level, and old verdicts do not count', () => {
    const back = learning.learnStep([v('correct', 3), v('correct', 2), v('correct', 1)], { offset: -2, countedAt: NOW - DAY }, NOW);
    assert.deepEqual([back.changed, back.offset], [true, -1]);
    assert.equal(learning.learnStep([v('correct', 3), v('correct', 2), v('correct', 1)], {}, NOW).changed, false, 'already at the admin level');
    const old = [v('false-alarm', 31 * 24 * 60), v('false-alarm', 32 * 24 * 60), v('false-alarm', 33 * 24 * 60)];
    assert.equal(learning.learnStep(old, {}, NOW).changed, false, 'verdicts older than 30 days are ignored');
    assert.equal(learning.learnStep([v('false-alarm', 1), v('false-alarm', 2)], {}, NOW).changed, false, 'two are not enough');
});

test('the detectors run with the learned levels; the saved settings and a switched-off learning stay untouched', () => {
    const saved = settings.repair({});
    const state = { spike: { offset: -2 }, logs: { offset: -1 } };
    const effective = learning.apply(saved, state);
    assert.equal(effective.detectors.spike.sensitivity, 1);
    assert.equal(effective.detectors.logs.sensitivity, 2);
    assert.equal(effective.detectors.disk.sensitivity, 3);
    assert.equal(saved.detectors.spike.sensitivity, 3, 'the input is not changed');
    assert.equal(learning.apply({ ...saved, learnFromVerdicts: false }, state).detectors.spike.sensitivity, 3);
    assert.deepEqual([learning.effectiveSensitivity(1, -2), learning.effectiveSensitivity(5, 3)], [1, 5]);
    assert.equal(settings.DEFAULTS.learnFromVerdicts, true);
});

test('a third false alarm from the incidents panel tunes the detector, and the status says so', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiops-learning-'));
    let t = NOW;
    let state = {};
    const store = incidents.memoryStore();
    const runner = createRunner({
        db: () => ({ all: (sql, params, callback) => callback(null, []) }),
        store: () => store,
        recorder: () => ({ start() {}, runs: () => [], latest: () => null, getStatus: () => ({}) }),
        hardware: () => ({ read: () => ({ intervalSeconds: 60 }) }),
        control: () => ({ readModeConfig: () => ({ mode: 'manual' }), readSchedulesConfig: () => ({ schedules: [] }) }),
        policies: () => ({ status: () => ({ on: true }) }),
        tabletNames: () => ({ all: () => ({}) }),
        settings: () => settings.DEFAULTS,
        audit: () => {},
        files: () => [path.join(dir, 'a.jsonl')],
        learning: { read: () => JSON.parse(JSON.stringify(state)), write: (next) => { state = next; } },
        now: () => new Date(t)
    });
    try {
        const ids = [];
        for (let i = 0; i < 3; i++) ids.push(await store.insert({ fingerprint: `spike:high:cpu:${i}`, detector: 'spike', kind: 'high', subject: 'cpu', title: 'CPU spike', status: 'open', opened_at: new Date(t).toISOString(), last_seen_at: new Date(t).toISOString() }));
        await runner.setVerdict(ids[0], 'false-alarm', 'admin');
        t += 60000;
        await runner.setVerdict(ids[1], 'not-useful', 'admin');
        assert.deepEqual(state, {}, 'two verdicts: nothing learned yet');
        t += 60000;
        await runner.setVerdict(ids[2], 'false-alarm', 'admin');
        assert.equal(state.spike.offset, -1);
        const spike = runner.getStatus().detectors.find((d) => d.key === 'spike');
        assert.deepEqual([spike.sensitivity, spike.tuned.sensitivity], [3, 2]);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
// <Jun Kai end>
