// Owner: Role 4, Ryan.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalizeId = value => String(value || '').trim().toUpperCase();

class BluetoothTracker {
    constructor({ now = Date.now, timeoutMs = 20000, threshold = -75 } = {}) {
        this.now = now;
        this.timeoutMs = timeoutMs;
        this.threshold = threshold;
        this.devices = new Map();
        this.scanner = { status: 'disabled', message: 'Bluetooth scanner is disabled.' };
        this.lastHeartbeat = null;
        this.changedAt = this.now();
    }
    setScanner(status, message) {
        this.scanner = { status, message };
        this.changedAt = this.now();
        if (status === 'running') this.lastHeartbeat = this.now();
    }
    heartbeat() { this.lastHeartbeat = this.now(); }
    scannerInfo() {
        const stale = (this.scanner.status === 'running' && this.now() - this.lastHeartbeat > 15000)
            || (this.scanner.status === 'starting' && this.now() - this.changedAt > 15000);
        return {
            ...(stale ? { status: 'error', message: 'Scanner heartbeat was lost. Restart the application.' } : this.scanner),
            threshold: this.threshold, timeoutMs: this.timeoutMs
        };
    }
    report(advertisement, assets) {
        if (!advertisement || !Number.isInteger(advertisement.rssi) || advertisement.rssi < -127 || advertisement.rssi > 0) return false;
        const services = new Set((Array.isArray(advertisement.service_uuids) ? advertisement.service_uuids : []).filter(id => UUID.test(id)).map(normalizeId));
        let matched = false;
        for (const asset of assets) {
            const id = normalizeId(asset.bluetoothId);
            if (asset.active === false || !services.has(id)) continue;
            this.devices.set(id, {
                id, name: String(advertisement.name || '').slice(0, 160),
                rssi: advertisement.rssi, lastSeen: this.now(), source: 'ble',
                address: String(advertisement.address || '').slice(0, 80)
            });
            matched = true;
        }
        return matched;
    }
    assetStatus(asset) {
        const id = normalizeId(asset.bluetoothId);
        const reading = this.devices.get(id);
        const scanner = this.scannerInfo();
        const fresh = !!reading && this.now() - reading.lastSeen < this.timeoutMs;
        let status;
        if (asset.active === false) status = 'inactive';
        else if (!UUID.test(id)) status = 'unsupported_id';
        else if (scanner.status !== 'running') status = 'scanner_unavailable';
        else if (!fresh) status = 'not_detected';
        else status = reading.rssi >= this.threshold ? 'nearby' : 'weak_signal';
        return {
            ...asset, status, isDetected: status === 'nearby',
            lastSeen: reading ? new Date(reading.lastSeen).toISOString() : null,
            rssi: reading?.rssi ?? null, readingFresh: fresh && scanner.status === 'running',
            nearbyName: reading?.name || null, source: reading?.source || null,
            observedAddress: reading?.address || null
        };
    }
}
module.exports = { BluetoothTracker, normalizeId, UUID };
