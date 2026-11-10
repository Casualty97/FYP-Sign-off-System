// Owner: Role 4, Ryan.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

test('Python worker emits observations, exits on parent EOF, and reports startup failure', t => {
    const executable = process.platform === 'win32' ? 'python' : 'python3';
    const probe = spawnSync(executable, ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8', timeout: 5000 });
    if (probe.status !== 0) { t.skip('Python is unavailable; run this protocol test on the scanner machine.'); return; }
    const python = probe.stdout.trim();
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'esg-scanner-test-'));
    t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
    const script = path.resolve(__dirname, '../../backend/features/assets/scanner.py');
    const stub = `from types import SimpleNamespace\nclass BleakScanner:\n def __init__(self, detection_callback): self.callback = detection_callback\n async def __aenter__(self):\n  self.callback(SimpleNamespace(address='test'), SimpleNamespace(local_name='Test', rssi=-52, service_uuids=['7b9e1001-4c6a-4f52-9a83-28b176db1020']))\n  return self\n async def __aexit__(self, *args): pass\n`;
    fs.writeFileSync(path.join(temporary, 'bleak.py'), stub);
    const run = () => spawnSync(python, ['-B', script], { input: '', encoding: 'utf8', timeout: 5000, env: { ...process.env, PYTHONPATH: temporary } });
    let result = run();
    assert.equal(result.status, 0, result.stderr);
    const messages = result.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.ok(messages.some(message => message.type === 'ready'));
    assert.ok(messages.some(message => message.type === 'advertisement' && message.rssi === -52));
    fs.writeFileSync(path.join(temporary, 'bleak.py'), stub.replace('  return self', "  raise RuntimeError('Adapter off')"));
    result = run();
    assert.equal(result.status, 1, result.stderr);
    const error = result.stdout.trim().split('\n').map(line => JSON.parse(line)).find(message => message.type === 'error');
    assert.equal(error.message, 'Adapter off');
});
