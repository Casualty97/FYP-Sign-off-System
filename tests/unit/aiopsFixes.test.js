// Owner: Role 3, Jun Kai.
// Unit tests for the fixes the incident panel can run with a System Admin's approval (backend/features/aiops/fixes.js):
// the memory store, a fake clock and a fake kiosk start, so nothing is ever started. Run: npm run test:unit
// <Jun Kai start>
const test = require('node:test');
const assert = require('node:assert/strict');
const incidents = require('../../backend/features/aiops/incidents');
const fixes = require('../../backend/features/aiops/fixes');

const START = Date.parse('2026-11-12T02:00:00Z');
const MINUTE = 60 * 1000;

const kioskDown = (over = {}) => ({
    fingerprint: 'services:down:kiosk', detector: 'services', kind: 'down', subject: 'kiosk', severity: 'critical', status: 'open',
    title: 'Kiosk server down (2 checks in a row)', opened_at: new Date(START).toISOString(), last_seen_at: new Date(START).toISOString(), ...over
});

// a fixer over the memory store; the kiosk start is a promise the test settles by hand; world.kioskUp and
// world.wanted are what the kiosk probe and the policies answer
function setup({ automation = 'on', conf = {}, lastAttempt = 0 } = {}) {
    let t = START;
    const store = incidents.memoryStore();
    const calls = { start: 0, noted: [], audits: [], probes: 0 };
    let settle = null;
    const shared = { last: lastAttempt };
    const world = { kioskUp: false, wanted: true };
    const fixer = fixes.createFixer({
        store,
        settings: () => ({ offerFixes: true, fixes: { 'start-kiosk': 'ask' }, ...conf }),
        actions: { 'start-kiosk': () => { calls.start++; return new Promise((resolve) => { settle = resolve; }); } },
        stillNeeded: { 'start-kiosk': async () => { calls.probes++; return !world.kioskUp; } },
        allowAuto: () => world.wanted,
        lastAttempt: () => shared.last,
        noteAttempt: (at) => { calls.noted.push(at); shared.last = at; },
        gapMs: () => 5 * MINUTE,
        automation: () => automation,
        audit: (action, by, id) => calls.audits.push({ action, by, id }),
        now: () => new Date(t)
    });
    return {
        store, fixer, calls, shared, world,
        advance: (ms) => { t += ms; },
        settle: (result) => settle(result),
        types: async (id) => (await store.events(id)).map((e) => e.type)
    };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('only a kiosk server that is down gets the start fix', () => {
    assert.equal(fixes.fixFor(kioskDown()), 'start-kiosk');
    assert.equal(fixes.fixFor(kioskDown({ subject: 'database' })), null);
    assert.equal(fixes.fixFor(kioskDown({ kind: 'slow' })), null);
    assert.equal(fixes.fixFor({ detector: 'spike', kind: 'high', subject: 'cpu' }), null);
    assert.equal(fixes.fixFor(null), null);
});

test('modes and KIOSK_AUTOMATION fall back to the safe value', () => {
    assert.equal(fixes.modeOf({ fixes: { 'start-kiosk': 'auto' } }, 'start-kiosk'), 'auto');
    assert.equal(fixes.modeOf({ fixes: { 'start-kiosk': 'sometimes' } }, 'start-kiosk'), 'ask');
    assert.equal(fixes.modeOf({}, 'start-kiosk'), 'ask');
    assert.equal(fixes.automationSetting('off'), 'off');
    assert.equal(fixes.automationSetting('DRY-RUN'), 'dry-run');
    assert.equal(fixes.automationSetting('yes please'), 'on');
    assert.equal(fixes.automationSetting(undefined), 'on');
});

test('an automatic run is due at once in Automatic, after 5 minutes in "Ask, then automatic", never on an example', () => {
    const open = kioskDown();
    assert.equal(fixes.autoDue(open, 'ask', START, null), false);
    assert.equal(fixes.autoDue(open, 'auto', START, null), true);
    assert.equal(fixes.autoDue(open, 'delayed', START + 4 * MINUTE, null), false);
    assert.equal(fixes.autoDue(open, 'delayed', START + 5 * MINUTE, null), true);
    assert.equal(fixes.autoDue(open, 'auto', START + 20 * MINUTE, START + 15 * MINUTE), false, 'not again within 10 minutes');
    assert.equal(fixes.autoDue(open, 'auto', START + 26 * MINUTE, START + 15 * MINUTE), true);
    assert.equal(fixes.autoDue(kioskDown({ fingerprint: 'example:kiosk:abc' }), 'auto', START, null), false);
    assert.equal(fixes.autoDue(kioskDown({ status: 'resolved' }), 'auto', START, null), false);
    assert.equal(fixes.autoDue(kioskDown({ status: 'acknowledged' }), 'delayed', START + 30 * MINUTE, null), false, 'Acknowledge holds the countdown');
    assert.equal(fixes.autoDue(kioskDown({ status: 'acknowledged' }), 'auto', START, null), false);
});

test('fixStatus: on offer, starting, started (until the incident can close), failed, and a start with no answer', () => {
    const fixAt = (minutes, detail = { by: 'systemadmin', automatic: false }) => ({ at: new Date(START + minutes * MINUTE).toISOString(), detail });
    const doneAt = (minutes, detail) => ({ at: new Date(START + minutes * MINUTE).toISOString(), detail });
    const now = (minutes) => START + minutes * MINUTE;
    assert.deepEqual(fixes.fixStatus({ nowMs: now(0) }), { state: 'offer' });
    assert.equal(fixes.fixStatus({ running: true, lastFix: fixAt(0), nowMs: now(0) }).state, 'running');
    assert.equal(fixes.fixStatus({ lastFix: fixAt(0), nowMs: now(1) }).state, 'running', 'the answer is not in yet');
    const lost = fixes.fixStatus({ lastFix: fixAt(0), nowMs: now(3) });
    assert.equal(lost.state, 'failed');
    assert.match(lost.message, /restarted/);

    const ok = fixes.fixStatus({ lastFix: fixAt(0), lastDone: doneAt(0.5, { ok: true, message: 'Server started successfully' }), nowMs: now(5), confirmMs: 15 * MINUTE });
    assert.deepEqual(ok, { state: 'started', at: new Date(START + 0.5 * MINUTE).toISOString(), by: 'systemadmin', automatic: false, message: 'Server started successfully', example: false, dryRun: false });
    const later = fixes.fixStatus({ lastFix: fixAt(0), lastDone: doneAt(0.5, { ok: true }), nowMs: now(20), confirmMs: 15 * MINUTE });
    assert.equal(later.state, 'offer', 'still open long after a good start: offered again');
    assert.equal(later.last.by, 'systemadmin');

    const bad = fixes.fixStatus({ lastFix: fixAt(0, { by: 'automatic (approved in Settings)', automatic: true }), lastDone: doneAt(0.5, { ok: false, message: 'did not come up' }), nowMs: now(1) });
    assert.equal(bad.state, 'failed');
    assert.equal(bad.automatic, true);
    assert.equal(bad.message, 'did not come up');
    const example = fixes.fixStatus({ lastFix: fixAt(0), lastDone: doneAt(0, { ok: true, example: true, message: 'Example incident: nothing was run' }), nowMs: now(0) });
    assert.equal(example.state, 'started');
    assert.equal(example.example, true);
    assert.deepEqual(fixes.fixStatus({ lastFix: fixAt(0), lastDone: doneAt(0, { ok: true, example: true }), nowMs: now(20), confirmMs: 15 * MINUTE }), { state: 'offer' }, 'an example started nothing, so it never "did not bring it back"');
    assert.deepEqual(fixes.fixStatus({ lastFix: fixAt(0), lastDone: doneAt(0, { ok: true, dryRun: true }), nowMs: now(20), confirmMs: 15 * MINUTE }), { state: 'offer' });
});

test('an approved fix answers at once, starts the kiosk once and records the result on the timeline', async () => {
    const s = setup();
    const id = await s.store.insert(kioskDown());
    const answer = await s.fixer.run(id, 'start-kiosk', 'systemadmin');
    assert.deepEqual(answer, { started: true, done: false });
    await flush();
    assert.equal(s.calls.start, 1);
    assert.deepEqual(s.calls.noted, [START], 'the shared start record is written before the start');
    assert.equal(s.fixer.isRunning(id), true);
    await assert.rejects(s.fixer.run(id, 'start-kiosk', 'systemadmin'), (error) => error.status === 409 && /already running/.test(error.message));

    s.settle({ success: true, message: 'Server started successfully' });
    await flush(); await flush();
    assert.equal(s.fixer.isRunning(id), false);
    assert.deepEqual(await s.types(id), ['fix', 'fix-done']);
    const [fix, done] = await s.store.events(id);
    assert.deepEqual(fix.detail, { fix: 'start-kiosk', by: 'systemadmin', automatic: false, example: false, dryRun: false });
    assert.equal(done.detail.ok, true);
    assert.equal(done.detail.message, 'Server started successfully');
    assert.deepEqual(s.calls.audits, [{ action: 'AIOPS_INCIDENT_FIX', by: 'systemadmin', id }]);
});

test('a failed start is recorded as not ok, with the reason', async () => {
    const s = setup();
    const id = await s.store.insert(kioskDown());
    await s.fixer.run(id, 'start-kiosk', 'systemadmin');
    await flush();
    s.settle({ success: false, error: 'Kiosk server did not become reachable within 30 seconds of the start command' });
    await flush(); await flush();
    const done = (await s.store.events(id)).find((e) => e.type === 'fix-done');
    assert.equal(done.detail.ok, false);
    assert.match(done.detail.message, /within 30 seconds/);
});

test('an approval runs whatever KIOSK_AUTOMATION says, like Start kiosk; off and dry-run only hold what runs by itself', async () => {
    for (const automation of ['off', 'dry-run']) {
        const s = setup({ automation });
        const id = await s.store.insert(kioskDown());
        assert.deepEqual(await s.fixer.run(id, 'start-kiosk', 'systemadmin'), { started: true, done: false }, `approved with ${automation}`);
        await flush();
        assert.equal(s.calls.start, 1, `the kiosk is started with ${automation}`);
        s.settle({ success: true, message: 'Server started successfully' });
        await flush(); await flush();
        assert.equal((await s.store.events(id)).find((e) => e.type === 'fix').detail.dryRun, false);
    }

    const off = setup({ automation: 'off' });
    const id = await off.store.insert(kioskDown());
    await assert.rejects(off.fixer.run(id, 'start-kiosk', 'automatic (approved in Settings)', { automatic: true }), (error) => error.status === 409 && /KIOSK_AUTOMATION=off/.test(error.message));
    assert.equal(off.calls.start, 0, 'nothing runs by itself with off');
    assert.deepEqual(await off.types(id), [], 'nothing on the timeline');

    const dry = setup({ automation: 'dry-run', conf: { fixes: { 'start-kiosk': 'auto' } } });
    const id2 = await dry.store.insert(kioskDown());
    assert.equal(await dry.fixer.sweep(), 1, 'a dry run still goes through the motions');
    assert.equal(dry.calls.start, 0);
    assert.deepEqual(dry.calls.noted, [], 'a dry run is not a start attempt');
    const done = (await dry.store.events(id2)).find((e) => e.type === 'fix-done');
    assert.equal(done.detail.dryRun, true);
    assert.match(done.detail.message, /Dry run/);
});

test('an example incident only records the fix, even with fixes off and KIOSK_AUTOMATION=off', async () => {
    const s = setup({ automation: 'off', conf: { offerFixes: false } });
    const id = await s.store.insert(kioskDown({ fingerprint: 'example:kiosk:abc' }));
    assert.deepEqual(await s.fixer.run(id, 'start-kiosk', 'systemadmin'), { started: true, done: true, example: true, dryRun: false });
    assert.equal(s.calls.start, 0, 'nothing is started for an example');
    assert.deepEqual(s.calls.noted, []);
    const done = (await s.store.events(id)).find((e) => e.type === 'fix-done');
    assert.equal(done.detail.example, true);
    assert.match(done.detail.message, /nothing was run/);
});

test('the fix is refused on a resolved incident, on one it does not fit and while fixes are switched off', async () => {
    const s = setup();
    const resolved = await s.store.insert(kioskDown({ status: 'resolved' }));
    await assert.rejects(s.fixer.run(resolved, 'start-kiosk', 'a'), (error) => error.status === 400);
    const database = await s.store.insert(kioskDown({ fingerprint: 'services:down:database', subject: 'database' }));
    await assert.rejects(s.fixer.run(database, 'start-kiosk', 'a'), (error) => error.status === 400 && /does not apply/.test(error.message));
    const kiosk = await s.store.insert(kioskDown());
    await assert.rejects(s.fixer.run(kiosk, 'restart-everything', 'a'), (error) => error.status === 400);
    assert.equal(await s.fixer.run(999, 'start-kiosk', 'a'), null, 'an unknown incident');

    const off = setup({ conf: { offerFixes: false } });
    const id = await off.store.insert(kioskDown());
    await assert.rejects(off.fixer.run(id, 'start-kiosk', 'a'), (error) => error.status === 409 && /switched off/.test(error.message));
    assert.equal(s.calls.start + off.calls.start, 0);
});

test('the sweep runs a fix made Automatic, keeps the shared gap to any other start and does not retry at once', async () => {
    const s = setup({ conf: { fixes: { 'start-kiosk': 'auto' } }, lastAttempt: START - 2 * MINUTE });
    const id = await s.store.insert(kioskDown());
    assert.equal(await s.fixer.sweep(), 0, 'the policies started the kiosk 2 minutes ago: wait');
    s.advance(4 * MINUTE);
    assert.equal(await s.fixer.sweep(), 1);
    await flush();
    assert.equal(s.calls.start, 1);
    assert.deepEqual(s.calls.audits, [{ action: 'AIOPS_INCIDENT_FIX_AUTO', by: 'automatic (approved in Settings)', id }]);
    s.settle({ success: false, error: 'did not come up' });
    await flush(); await flush();

    s.advance(6 * MINUTE);
    assert.equal(await s.fixer.sweep(), 0, 'not again within 10 minutes of the last automatic run');
    s.advance(5 * MINUTE);
    assert.equal(await s.fixer.sweep(), 1, 'tried again after 10 minutes while it is still down');
});

test('"Ask, then automatic" waits 5 minutes from the opening; Ask first and examples never run by themselves', async () => {
    const s = setup({ conf: { fixes: { 'start-kiosk': 'delayed' } } });
    await s.store.insert(kioskDown());
    await s.store.insert(kioskDown({ fingerprint: 'example:kiosk:abc' }));
    s.advance(4 * MINUTE);
    assert.equal(await s.fixer.sweep(), 0);
    s.advance(MINUTE);
    assert.equal(await s.fixer.sweep(), 1, 'only the real incident');
    await flush();
    assert.equal(s.calls.start, 1);

    const ask = setup();
    await ask.store.insert(kioskDown());
    ask.advance(60 * MINUTE);
    assert.equal(await ask.fixer.sweep(), 0);

    const off = setup({ automation: 'off', conf: { fixes: { 'start-kiosk': 'auto' } } });
    await off.store.insert(kioskDown());
    assert.equal(await off.fixer.sweep(), 0, 'KIOSK_AUTOMATION=off: nothing runs by itself');
    assert.equal(ask.calls.start + off.calls.start, 0);
});

test('an automatic start first checks the kiosk is still down, and waits while the policies keep the kiosk off', async () => {
    const s = setup({ conf: { fixes: { 'start-kiosk': 'auto' } } });
    const id = await s.store.insert(kioskDown());
    s.world.kioskUp = true; // started by hand, the incident closes at the next checks
    assert.equal(await s.fixer.sweep(), 0);
    assert.equal(s.calls.probes, 1);
    assert.deepEqual(await s.types(id), [], 'nothing run, nothing recorded');

    s.world.kioskUp = false;
    s.world.wanted = false; // automatic server mode, and no policy keeps the kiosk on now
    assert.equal(await s.fixer.sweep(), 0);
    assert.equal(s.calls.probes, 1, 'not even probed');
    s.world.wanted = true;
    assert.equal(await s.fixer.sweep(), 1);
    await flush();
    assert.equal(s.calls.start, 1);
});

test('describeFix tells the page what is on offer', async () => {
    const s = setup();
    const id = await s.store.insert(kioskDown());
    const incident = await s.store.get(id);
    const fix = fixes.describeFix(incident, { offerFixes: true, fixes: { 'start-kiosk': 'delayed' } }, s.fixer);
    assert.equal(fix.key, 'start-kiosk');
    assert.equal(fix.mode, 'delayed');
    assert.equal(fix.offered, true);
    assert.equal(fix.running, false);
    assert.equal(fixes.describeFix(incident, { offerFixes: false }, s.fixer).offered, false);
    assert.equal(fixes.describeFix({ ...incident, fingerprint: 'example:kiosk:x' }, { offerFixes: false }, s.fixer).offered, true);
    assert.equal(fixes.describeFix({ ...incident, subject: 'email' }, {}, s.fixer), null);
});
// <Jun Kai end>
