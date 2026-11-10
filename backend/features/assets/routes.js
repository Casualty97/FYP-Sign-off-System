// Owner: Role 4, Ryan.
const express = require('express');
const auth = require('../../core/auth');
const store = require('./store');
const bluetooth = require('./bluetooth');
const { UUID } = require('./tracker');
const router = express.Router();

function response(assets) {
    return { success: true, assets: bluetooth.enrichBluetoothAssets(assets), scanner: bluetooth.getScannerStatus() };
}
router.get('/assets', auth.requireAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { res.json(response(store.readBluetoothAssets())); }
    catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
router.post('/assets', auth.requireAdmin, express.json(), (req, res) => {
    const body = req.body || {};
    const bluetoothId = String(body.bluetoothId || body.bluetooth_id || body.id || '').trim().toUpperCase();
    if (!UUID.test(bluetoothId) && !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(bluetoothId)) {
        return res.status(400).json({ success: false, error: 'Enter a complete 128-bit service UUID or a legacy Bluetooth MAC address.' });
    }
    const payload = { bluetoothId, active: body.active !== false && body.active !== 'false' };
    for (const field of ['name', 'category', 'location', 'notes']) payload[field] = String(body[field] || '').trim().slice(0, field === 'notes' ? 1000 : 160);
    try { res.json(response(store.addBluetoothAsset(payload))); }
    catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
router.delete('/assets/:bluetoothId', auth.requireAdmin, (req, res) => {
    try { res.json(response(store.removeBluetoothAsset(req.params.bluetoothId))); }
    catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
module.exports = router;
