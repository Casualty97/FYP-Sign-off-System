// Owner: Role 4, Ryan.
const test = require('node:test');
const assert = require('node:assert/strict');
const { BluetoothTracker } = require('../../backend/features/assets/tracker');
const ID = '7b9e1001-4c6a-4f52-9a83-28b176db1020';
const asset = { bluetoothId: ID.toUpperCase(), name: 'Test asset' };

function setup() {
    let clock = 1000000;
    const tracker = new BluetoothTracker({ now: () => clock });
    tracker.setScanner('running', 'Running');
    const report = fields => tracker.report({ service_uuids: [ID], rssi: -52, address: 'A', ...fields }, [asset]);
    return { tracker, report, advance: ms => { clock += ms; tracker.heartbeat(); } };
}

test('registration alone has no detection timestamp', () => {
    const { tracker } = setup();
    const state = tracker.assetStatus({ ...asset, addedAt: '2026-11-11T00:00:00Z' });
    assert.equal(state.status, 'not_detected');
    assert.equal(state.lastSeen, null);
    assert.equal(state.rssi, null);
});
test('service identity survives a change of radio address and name', () => {
    const { tracker, report, advance } = setup();
    assert.equal(report(), true);
    assert.equal(tracker.assetStatus(asset).isDetected, true);
    advance(1000);
    report({ address: 'B', name: null });
    const state = tracker.assetStatus(asset);
    assert.equal(tracker.devices.size, 1);
    assert.equal(state.observedAddress, 'B');
    assert.equal(state.lastSeen, new Date(1001000).toISOString());
});
test('threshold includes the boundary and treats weak fresh readings separately', () => {
    const { tracker, report } = setup();
    report({ rssi: -75 });
    assert.equal(tracker.assetStatus(asset).status, 'nearby');
    report({ rssi: -76 });
    assert.equal(tracker.assetStatus(asset).status, 'weak_signal');
    assert.equal(tracker.assetStatus(asset).readingFresh, true);
    assert.equal(tracker.assetStatus(asset).isDetected, false);
});
test('expired detections retain actual last-seen time and recover with a fresh packet', () => {
    const { tracker, report, advance } = setup();
    report();
    const lastSeen = tracker.assetStatus(asset).lastSeen;
    advance(20000);
    const stale = tracker.assetStatus(asset);
    assert.equal(stale.status, 'not_detected');
    assert.equal(stale.readingFresh, false);
    assert.equal(stale.lastSeen, lastSeen);
    report();
    assert.equal(tracker.assetStatus(asset).status, 'nearby');
});
test('a failed or stalled scanner never counts a tablet as detected nearby', () => {
    const { tracker, report } = setup();
    report();
    tracker.setScanner('error', 'Adapter off');
    assert.equal(tracker.assetStatus(asset).status, 'scanner_unavailable');
    assert.equal(tracker.assetStatus(asset).isDetected, false);
    const stalled = new BluetoothTracker({ now: () => 0 });
    stalled.setScanner('running', 'Running');
    stalled.now = () => 15001;
    assert.equal(stalled.scannerInfo().status, 'error');
    stalled.setScanner('starting', 'Starting');
    stalled.now = () => 30002;
    assert.equal(stalled.scannerInfo().status, 'error');
});
test('unknown services, invalid RSSI, and inactive assets never create detections', () => {
    const { tracker, report } = setup();
    assert.equal(report({ service_uuids: ['00000000-0000-4000-8000-000000000001'] }), false);
    for (const rssi of [null, '-52', NaN, 1, -128]) assert.equal(report({ rssi }), false);
    tracker.report({ service_uuids: [ID], rssi: -50 }, [{ ...asset, active: false }]);
    assert.equal(tracker.devices.size, 0);
    assert.equal(tracker.assetStatus({ bluetoothId: '02:00:00:00:00:01' }).status, 'unsupported_id');
});
