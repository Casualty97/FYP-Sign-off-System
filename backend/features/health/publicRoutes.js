// Owner: Role 3, Jun Kai.
// Public heartbeat endpoint, mounted at /api/health on both servers. The kiosk page posts once a minute;
// one row per device is kept (upsert), so this never grows with time.
const express = require('express');
const db = require('../../core/db');

const router = express.Router();

// <Jun Kai start>
// POST /api/health/heartbeat  { deviceId, page, label }
router.post('/heartbeat', (req, res) => {
    const body = req.body || {};
    const deviceId = String(body.deviceId || '').trim();
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(deviceId)) {
        return res.status(400).json({ success: false, error: 'deviceId must be 6 to 64 letters, digits, - or _' });
    }
    const page = String(body.page || '').slice(0, 40) || null;
    const label = String(body.label || '').slice(0, 80) || null;
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 255) || null;
    const ip = String(req.ip || '').slice(0, 64) || null;

    const sql = `
        INSERT INTO device_heartbeats (device_id, label, page, user_agent, ip, first_seen, last_seen)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW()) AS fresh
        ON DUPLICATE KEY UPDATE
            label = COALESCE(fresh.label, device_heartbeats.label),
            page = fresh.page,
            user_agent = fresh.user_agent,
            ip = fresh.ip,
            last_seen = NOW()`;
    db.run(sql, [deviceId, label, page, userAgent, ip], (err) => {
        if (err) {
            if (err.code === 'ER_NO_SUCH_TABLE') return res.status(503).json({ success: false, error: 'Heartbeat table missing: run npm run db:migrate' });
            console.error('❌ Heartbeat insert failed:', err.message);
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        res.json({ success: true });
    });
});
// <Jun Kai end>

module.exports = router;
