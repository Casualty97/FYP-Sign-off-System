// Owner: Role 4, Ryan.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const { BluetoothTracker } = require('../../backend/features/assets/tracker');

test('asset HTTP routes require admin access and expose real reading state', async t => {
    const filename = path.resolve(__dirname, '../../backend/features/assets/routes.js');
    const realRequire = createRequire(filename);
    let records = [];
    const tracker = new BluetoothTracker();
    tracker.setScanner('running', 'Running');
    const store = {
        readBluetoothAssets: () => records,
        addBluetoothAsset: asset => { records = [asset]; return records; },
        removeBluetoothAsset: id => { records = records.filter(asset => asset.bluetoothId !== id.toUpperCase()); return records; }
    };
    // Exercise the real admin guard; only database and radio dependencies are replaced.
    const authFilename = path.resolve(__dirname, '../../backend/core/auth.js');
    const authRequire = createRequire(authFilename);
    const authModule = { exports: {} };
    vm.runInNewContext(fs.readFileSync(authFilename, 'utf8'), {
        module: authModule, process: { env: {} }, Buffer,
        require: name => name === './db' ? {} : name === '../features/assets/bluetooth'
            ? { isDeviceNearby: () => false } : authRequire(name)
    }, { filename: authFilename });
    const guards = authModule.exports;
    const moduleUnderTest = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module: moduleUnderTest,
        require: name => name === '../../core/auth' ? guards : name === './store' ? store : name === './bluetooth'
            ? { enrichBluetoothAssets: list => list.map(asset => tracker.assetStatus(asset)), getScannerStatus: () => tracker.scannerInfo() }
            : realRequire(name)
    }, { filename });
    const app = realRequire('express')();
    app.use((req, res, next) => {
        if (req.headers['x-test-role']) req.session = { user: { role: req.headers['x-test-role'] === 'admin' ? 'system_admin' : 'viewer' } };
        next();
    });
    app.use('/api/admin', moduleUnderTest.exports);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/api/admin/assets`;
    for (const method of ['GET', 'POST', 'DELETE']) {
        const result = await fetch(method === 'DELETE' ? url + '/test' : url, { method });
        assert.equal(result.status, 403);
        assert.equal((await result.json()).error, 'Admin access required');
    }
    const forbidden = await fetch(url, { headers: { 'x-test-role': 'viewer' } });
    assert.equal(forbidden.status, 403);
    const headers = { 'x-test-role': 'admin', 'Content-Type': 'application/json' };
    let result = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ bluetoothId: 'not-a-uuid' }) });
    assert.equal(result.status, 400);
    const id = '7b9e1001-4c6a-4f52-9a83-28b176db1020';
    result = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ bluetoothId: id, name: '<Test>', notes: 'saved' }) });
    assert.equal(result.status, 200);
    let body = await result.json();
    assert.equal(body.assets[0].lastSeen, null);
    tracker.report({ service_uuids: [id], rssi: -52, name: 'Test', address: 'temporary' }, records);
    result = await fetch(url, { headers });
    assert.equal(result.headers.get('cache-control'), 'no-store');
    body = await result.json();
    assert.equal(body.assets[0].isDetected, true);
    assert.equal(body.assets[0].rssi, -52);
    assert.ok(body.assets[0].lastSeen);
    assert.equal(body.scanner.status, 'running');
    result = await fetch(url + '/' + id, { method: 'DELETE', headers });
    assert.equal((await result.json()).assets.length, 0);
});
