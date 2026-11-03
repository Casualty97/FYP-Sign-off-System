// Owner: Role 3, Jun Kai.
// Admin health API, mounted at /api/admin/health (session required).
const express = require('express');
const auth = require('../../core/auth');
const checks = require('./checks');

const router = express.Router();

// GET /api/admin/health[?refresh=email]  every check at once; refresh=email re-runs the (cached) SMTP login test
router.get('/', auth.requireAuth, async (req, res) => {
    try {
        const health = await checks.runAll({ refreshEmail: req.query.refresh === 'email' });
        res.json({ success: true, health });
    } catch (error) {
        console.error('❌ Health checks failed:', error);
        res.status(500).json({ success: false, error: 'Health checks failed: ' + error.message });
    }
});

module.exports = router;
