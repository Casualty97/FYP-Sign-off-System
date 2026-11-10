// Owner: Role 4, Ryan.
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const paths = require('../../core/paths');
const { readBluetoothAssets } = require('./store');
const { BluetoothTracker } = require('./tracker');

function numericSetting(raw, fallback, min, max) {
    const value = Number(raw);
    return raw !== undefined && raw !== '' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}
const tracker = new BluetoothTracker({
    threshold: numericSetting(process.env.BLUETOOTH_RSSI_THRESHOLD, -75, -127, 0),
    timeoutMs: numericSetting(process.env.BLUETOOTH_TIMEOUT_MS, 20000, 3000, 600000)
});
let worker = null;
let assets = [];
let assetsReadAt = -Infinity;

function registeredAssets() {
    if (Date.now() - assetsReadAt >= 1000) {
        assets = readBluetoothAssets();
        assetsReadAt = Date.now();
        const activeIds = new Set(assets.filter(asset => asset.active !== false).map(asset => asset.bluetoothId));
        for (const id of tracker.devices.keys()) if (!activeIds.has(id)) tracker.devices.delete(id);
    }
    return assets;
}

function startBluetoothScanner() {
    if (worker) return;
    if (process.env.BLUETOOTH_SCANNER !== 'on') {
        tracker.setScanner('disabled', 'Scanner is disabled. Set BLUETOOTH_SCANNER=on in backend/.env to enable it.');
        return;
    }
    const defaultPython = path.join(paths.ROOT, '..', 'esg-bluetooth-venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
    const python = process.env.BLUETOOTH_PYTHON || defaultPython;
    if (!fs.existsSync(python)) {
        tracker.setScanner('error', 'Python environment was not found. Set BLUETOOTH_PYTHON to its python executable.');
        return;
    }
    tracker.setScanner('starting', 'Starting Bluetooth scanner.');
    worker = spawn(python, ['-u', path.join(__dirname, 'scanner.py')], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const child = worker;
    child.stdin.on('error', () => {}); // The worker may exit before shutdown closes its input.
    const lines = readline.createInterface({ input: child.stdout });
    lines.on('line', line => {
        if (worker !== child) return;
        try {
            const report = JSON.parse(line);
            if (report.type === 'ready') tracker.setScanner('running', 'Scanner is receiving Bluetooth advertisements.');
            else if (report.type === 'heartbeat') tracker.heartbeat();
            else if (report.type === 'advertisement') tracker.report(report, registeredAssets());
            else if (report.type === 'error') {
                tracker.setScanner('error', 'Bluetooth scanning failed. Check Bluetooth is on and see the server terminal.');
                console.error('[Bluetooth]', String(report.message).slice(0, 500));
            }
        } catch (error) {
            tracker.setScanner('error', 'Scanner returned an invalid report. Restart the application.');
            console.error('[Bluetooth] Invalid scanner report:', error.message);
        }
    });
    child.stderr.on('data', chunk => console.error('[Bluetooth]', chunk.toString().slice(0, 1000)));
    child.once('error', error => {
        tracker.setScanner('error', 'Could not launch the Python scanner. Check BLUETOOTH_PYTHON.');
        console.error('[Bluetooth]', error.message);
    });
    child.once('close', () => {
        lines.close();
        if (worker === child) {
            worker = null;
            if (tracker.scannerInfo().status !== 'error') tracker.setScanner('error', 'Scanner stopped. Restart the application.');
        }
    });
    console.log('[Bluetooth] Scanner starting.');
}

function stopBluetoothScanner() {
    const child = worker;
    worker = null;
    if (child) child.stdin.end(); // Closing the pipe also stops scanner.py if Node is terminated on Windows.
    tracker.setScanner('stopped', 'Scanner stopped.');
}
function isDeviceNearby(identifier) {
    const asset = registeredAssets().find(item => item.bluetoothId === String(identifier || '').toUpperCase());
    return !!asset && tracker.assetStatus(asset).isDetected;
}
module.exports = {
    startBluetoothScanner, stopBluetoothScanner, isDeviceNearby,
    getScannerStatus: () => tracker.scannerInfo(),
    enrichBluetoothAssets: list => list.map(asset => tracker.assetStatus(asset)),
    getDeviceRSSI: identifier => tracker.devices.get(String(identifier || '').toUpperCase())?.rssi ?? null,
    getNearbyDevicesList: () => [...tracker.devices.values()].filter(device => isDeviceNearby(device.id)),
    nearbyDevices: tracker.devices, RSSI_THRESHOLD: tracker.threshold
};
