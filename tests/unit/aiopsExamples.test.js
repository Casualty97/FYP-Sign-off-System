// Owner: Role 3, Jun Kai.
// Unit tests for the example incidents ("Show example incidents" in the incident settings, backend/features/aiops/
// examples.js): what they show, and that they never teach the advisor, tune a detector, resolve themselves or run a fix.
// Run: npm run test:unit
// <Jun Kai start>
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const incidents = require('../../backend/features/aiops/incidents');
const examples = require('../../backend/features/aiops/examples');
const settings = require('../../backend/features/aiops/settings');
const { createAdvisor } = require('../../backend/features/aiops/advisor');
const { createRunner } = require('../../backend/features/aiops/engine');

const NOW = new Date('2026-11-12T06:00:00Z');
const MINUTE = 60 * 1000;

test('seven examples, oldest first, labelled by their fingerprint and evidence, with every state of the panel', async () => {
    const store = incidents.memoryStore();
    assert.equal(await examples.createExamples(store, 'systemadmin', NOW), 7);
    const all = await store.list({ status: 'all' });
    assert.equal(all.length, 7);
    assert.ok(all.every((i) => i.fingerprint.startsWith('example:') && i.evidence.example === true));
    const byStatus = (status) => all.filter((i) => i.status === status).length;
    assert.deepEqual([byStatus('open'), byStatus('acknowledged'), byStatus('resolved')], [4, 1, 2]);

    const ids = Object.fromEntries(all.map((i) => [i.fingerprint.split(':')[1], i.id]));
    assert.ok(ids.errors < ids['kiosk-old'] && ids['kiosk-old'] < ids.memory && ids.memory < ids.kiosk && ids.cpu === Math.max(...Object.values(ids)), 'the newest gets the highest number');
    const cpu = await store.get(ids.cpu);
    assert.ok(cpu.evidence.points.length > 10, 'the CPU example has a chart');
    assert.match(cpu.explanation, /usual swing ± 4 %/);
    const kioskOld = await store.get(ids['kiosk-old']);
    assert.equal(kioskOld.resolved_by, 'auto');
    assert.deepEqual((await store.events(ids['kiosk-old'])).map((e) => e.type), ['opened', 'advice', 'fix', 'fix-done', 'resolved', 'verdict']);
    assert.equal(await store.countByFingerprintPrefix('example:'), 7);
});

test('showing them again replaces the old set; removing them leaves real incidents alone', async () => {
    const store = incidents.memoryStore();
    const real = await store.insert({ fingerprint: 'spike:cpu:-', detector: 'spike', kind: 'cpu', severity: 'warn', status: 'open', title: 'Real one', opened_at: NOW, last_seen_at: NOW });
    await store.addEvent(real, 'opened', {}, NOW);
    await examples.createExamples(store, 'a', NOW);
    await examples.createExamples(store, 'a', new Date(NOW.getTime() + MINUTE));
    assert.equal(await store.countByFingerprintPrefix('example:'), 7, 'still seven, not fourteen');
    assert.equal(await examples.removeExamples(store), 7);
    const left = await store.list({ status: 'all' });
    assert.deepEqual(left.map((i) => i.id), [real]);
    assert.equal((await store.events(real)).length, 1);
});

test('examples never count as earlier confirmed incidents or verdicts', async () => {
    const store = incidents.memoryStore();
    await examples.createExamples(store, 'a', NOW);
    assert.deepEqual(await store.examples('services', 3, null), [], 'the resolved "Correct" kiosk example does not teach the advisor');
    assert.deepEqual(await store.verdicts('services', 0), []);
    assert.deepEqual(await store.verdicts('logs', 0), [], 'nor does the false alarm tune the errors detector');
});

test('the SQL store deletes and counts only by an exact prefix', async () => {
    const calls = [];
    const db = {
        run: (sql, params, callback) => { calls.push({ sql, params }); callback(null, { affectedRows: 2, changes: 2 }); },
        get: (sql, params, callback) => { calls.push({ sql, params }); callback(null, { n: 7 }); },
        all: (sql, params, callback) => callback(null, [])
    };
    const store = incidents.sqlStore(db);
    assert.equal(await store.deleteByFingerprintPrefix('%'), 0);
    assert.equal(await store.deleteByFingerprintPrefix('exa_mple:'), 0);
    assert.equal(await store.countByFingerprintPrefix(''), 0);
    assert.equal(calls.length, 0, 'a pattern never reaches the database');
    await store.deleteByFingerprintPrefix('example:');
    assert.ok(calls.every((c) => c.params.includes('example:%')));
    assert.match(calls[0].sql, /DELETE FROM incident_events/, 'the timeline goes first');
    assert.equal(await store.countByFingerprintPrefix('example:'), 7);
});

test('a check never closes an example, and the advisor never asks the model about one', async () => {
    const store = incidents.memoryStore();
    let t = NOW.getTime();
    await examples.createExamples(store, 'a', new Date(t));
    const engine = incidents.createEngine({
        store, now: () => new Date(t), load: async () => ({}), detect: () => ({ anomalies: [], states: {}, notes: {} }),
        settings: () => ({ ...settings.DEFAULTS, clearAfterMinutes: 1 })
    });
    t += 60 * MINUTE;
    await engine.tick();
    const open = await store.listOpen();
    assert.equal(open.length, 5, 'four open and one acknowledged, as they were made');

    let asked = 0;
    const advisor = createAdvisor({ store, settings: () => settings.DEFAULTS, ask: async () => { asked++; return { summary: 'x', causes: [], action: 'none', why: '' }; }, now: () => t });
    assert.equal(await advisor.sweep(), 0);
    advisor.request(open[0].id, { force: true });
    await advisor.drain();
    assert.equal(asked, 0);
});

test('through the runner: a verdict on an example tunes nothing', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiops-examples-'));
    const writes = [];
    try {
        const store = incidents.memoryStore();
        const runner = createRunner({
            db: () => ({ all: (sql, params, callback) => callback(null, []) }),
            store: () => store,
            recorder: () => ({ start() {}, runs: () => [], getStatus: () => ({}) }),
            hardware: () => ({ read: () => ({ intervalSeconds: 60 }) }),
            control: () => ({ readModeConfig: () => ({ mode: 'manual' }), readSchedulesConfig: () => ({ schedules: [] }) }),
            policies: () => ({ status: () => ({ on: true }) }),
            tabletNames: () => ({ all: () => ({}) }),
            settings: () => settings.DEFAULTS,
            learning: { read: () => ({}), write: (state) => writes.push(state) },
            audit: () => {},
            files: () => [path.join(dir, 'a.jsonl'), path.join(dir, 'b.jsonl')],
            now: () => NOW
        });
        assert.equal(await runner.createExamples('systemadmin'), 7);
        assert.equal(await runner.countExamples(), 7);
        const cpu = (await store.listOpen()).find((i) => i.detector === 'spike');
        for (let i = 0; i < 4; i++) await runner.setVerdict(cpu.id, 'false-alarm', 'systemadmin');
        assert.deepEqual(writes, []);
        assert.equal(await runner.removeExamples(), 7);
        assert.equal(await runner.countExamples(), 0);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
// <Jun Kai end>
