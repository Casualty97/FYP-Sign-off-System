// Owner: Role 3, Jun Kai.
// Unit tests for the tablet names on the System Health page. Run: npm run test:unit
// <Jun Kai start>
const test = require('node:test');
const assert = require('node:assert/strict');
const tabletNames = require('../../backend/features/health/tabletNames');

test('clean tidies the spaces, and an empty name means the device name again', () => {
    assert.deepEqual(tabletNames.clean('  Tablet   1 '), { name: 'Tablet 1' });
    assert.deepEqual(tabletNames.clean(''), { name: null });
    assert.deepEqual(tabletNames.clean('   '), { name: null });
    assert.deepEqual(tabletNames.clean(null), { name: null });
    assert.deepEqual(tabletNames.clean('7'), { name: '7' });
});

test('clean refuses long names, hidden characters and anything that is not text', () => {
    assert.match(tabletNames.clean('x'.repeat(tabletNames.MAX_LENGTH + 1)).error, /characters or fewer/);
    assert.equal(tabletNames.clean('x'.repeat(tabletNames.MAX_LENGTH)).name.length, tabletNames.MAX_LENGTH);
    assert.match(tabletNames.clean('Tab' + String.fromCharCode(7) + 'let').error, /cannot be shown/);
    assert.match(tabletNames.clean(12).error, /must be text/);
    assert.match(tabletNames.clean({ name: 'x' }).error, /must be text/);
});

test('takenBy finds the same name on another tablet, whatever the case', () => {
    const names = { 'dev-aaaaaa': 'Tablet 1', 'dev-bbbbbb': 'Entrance' };
    assert.equal(tabletNames.takenBy(names, 'dev-cccccc', 'tablet 1'), 'dev-aaaaaa');
    assert.equal(tabletNames.takenBy(names, 'dev-aaaaaa', 'Tablet 1'), null, 'keeping its own name is fine');
    assert.equal(tabletNames.takenBy(names, 'dev-cccccc', 'Tablet 2'), null);
});

test('sortDevices puts named tablets first in number order and keeps the rest as they came', () => {
    const devices = [
        { device_id: 'dev-new', name: null },
        { device_id: 'dev-10', name: 'Tablet 10' },
        { device_id: 'dev-old', name: null },
        { device_id: 'dev-2', name: 'tablet 2' },
        { device_id: 'dev-1', name: 'Tablet 1' }
    ];
    assert.deepEqual(tabletNames.sortDevices(devices).map((d) => d.device_id), ['dev-1', 'dev-2', 'dev-10', 'dev-new', 'dev-old']);
    assert.equal(devices[0].device_id, 'dev-new', 'the input list is not changed');
});

test('isDeviceId accepts what the kiosk heartbeat accepts', () => {
    assert.equal(tabletNames.isDeviceId('dev-267pfd6lmw1py7q4'), true);
    assert.equal(tabletNames.isDeviceId('smoke-tablet-01'), true);
    assert.equal(tabletNames.isDeviceId('x'), false);
    assert.equal(tabletNames.isDeviceId('../etc'), false);
});
// <Jun Kai end>
