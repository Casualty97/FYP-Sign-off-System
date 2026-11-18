// Owner: Role 3, Jun Kai.
// Unit tests for "is the kiosk open now?" (backend/features/serverControl/openState.js) and for the PC's own addresses
// (backend/core/localPc.js). Run: npm run test:unit
// <Jun Kai start>
const test = require('node:test');
const assert = require('node:assert/strict');
const openState = require('../../backend/features/serverControl/openState');
const localPc = require('../../backend/core/localPc');

// Thursday 19 Nov 2026, 14:00 in Singapore
const NOW = new Date(2026, 10, 19, 14, 0, 0);
const policy = (over = {}) => ({
    id: 1, schedule_name: 'Every day', action: 'active', is_active: true, schedule_type: 'daily',
    start_time: '09:00', end_time: '18:00', ...over
});
const ask = (over = {}) => openState.work({ now: NOW, env: {}, readMode: () => 'auto', readPolicies: () => [policy()], ...over });

test('open while a policy says the kiosk runs', () => {
    assert.deepEqual(ask(), { open: true });
});

test('closed in off hours, with the time it opens again', () => {
    const evening = ask({ now: new Date(2026, 10, 19, 20, 0, 0) });
    assert.equal(evening.open, false);
    assert.equal(new Date(evening.opensAt).getTime(), new Date(2026, 10, 20, 9, 0, 0).getTime(), 'tomorrow at 9');
    const early = ask({ now: new Date(2026, 10, 19, 7, 30, 0) });
    assert.equal(early.open, false);
    assert.equal(new Date(early.opensAt).getTime(), new Date(2026, 10, 19, 9, 0, 0).getTime(), 'today at 9');
});

test('a policy that is switched off does not close the kiosk, and neither does a PC without policies', () => {
    assert.deepEqual(ask({ now: new Date(2026, 10, 19, 20, 0, 0), readPolicies: () => [policy({ is_active: false })] }), { open: true });
    assert.deepEqual(ask({ readPolicies: () => [] }), { open: true });
    assert.deepEqual(ask({ readPolicies: () => null }), { open: true });
});

test('manual mode keeps the kiosk open, and so does a machine where the automation is off or only logs', () => {
    const evening = new Date(2026, 10, 19, 20, 0, 0);
    assert.deepEqual(ask({ now: evening, readMode: () => 'manual' }), { open: true });
    assert.deepEqual(ask({ now: evening, env: { KIOSK_AUTOMATION: 'off' } }), { open: true });
    assert.deepEqual(ask({ now: evening, env: { KIOSK_AUTOMATION: 'dry-run' } }), { open: true });
    assert.equal(ask({ now: evening, env: { KIOSK_AUTOMATION: 'on' } }).open, false);
});

test('the answer is kept for a few seconds, so many kiosk pages do not make the files be read again and again', () => {
    openState.reset();
    const first = openState.current(1000);
    assert.equal(typeof first.open, 'boolean');
    assert.equal(openState.current(1000 + openState.CACHE_MS - 1), first, 'the same answer inside the time');
    assert.notEqual(openState.current(1000 + openState.CACHE_MS + 1), undefined);
    openState.reset();
});

test('the PC has an address only while a network adapter carries it', () => {
    const adapters = {
        'Wi-Fi': [{ address: '192.168.1.50', family: 'IPv4', internal: false }],
        Loopback: [{ address: '127.0.0.1', family: 'IPv4', internal: true }]
    };
    assert.equal(localPc.hasAddress('192.168.1.50', adapters), true);
    assert.equal(localPc.hasAddress('192.168.1.51', adapters), false);
    assert.equal(localPc.hasAddress('127.0.0.1', adapters), false, 'the loopback adapter is not a network address');
    assert.equal(localPc.hasAddress('localhost', adapters), false);
    assert.equal(localPc.hasAddress('192.168.1.50', {}), false, 'no network yet, right after the power came back');
    assert.equal(localPc.hasAddress('192.168.1.50', { 'Wi-Fi': [{ address: '192.168.1.50', family: 4, internal: false }] }), true, 'Node versions that write the family as a number');
});
// <Jun Kai end>
