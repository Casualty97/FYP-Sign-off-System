// Owner: Role 3, Jun Kai.
// Admin health API, mounted at /api/admin/health (session required).
const express = require('express');
const auth = require('../../core/auth');
const checks = require('./checks');
// <Jun Kai start>
const layout = require('./layout');
// <Jun Kai end>

const router = express.Router();

// <Jun Kai start>
const userKey = (req) => (req.session && req.session.user && req.session.user.id) || 'anonymous';

// GET /api/admin/health[?refresh=email][&all=1]  the checks this admin shows (all=1: every check, for scripts);
// refresh=email re-runs the (cached) SMTP login test
router.get('/', auth.requireAuth, async (req, res) => {
    try {
        const hidden = layout.hiddenFor(userKey(req));
        const health = await checks.runAll({ refreshEmail: req.query.refresh === 'email', skip: req.query.all === '1' ? [] : hidden });
        res.json({ success: true, health: { ...health, hidden } });
    } catch (error) {
        console.error('❌ Health checks failed:', error);
        res.status(500).json({ success: false, error: 'Health checks failed: ' + error.message });
    }
});

// GET /api/admin/health/layout  every monitoring option and the ones this admin removed
router.get('/layout', auth.requireAuth, (req, res) => {
    res.json({ success: true, options: layout.OPTIONS, hidden: layout.hiddenFor(userKey(req)) });
});

// PUT /api/admin/health/layout  { hidden: ['ollama', ...] }
router.put('/layout', auth.requireAuth, (req, res) => {
    try {
        const saved = layout.setHidden(userKey(req), (req.body || {}).hidden);
        if (!saved) return res.status(400).json({ success: false, error: `hidden must be a list of: ${layout.KEYS.join(', ')}` });
        res.json({ success: true, hidden: saved });
    } catch (error) {
        console.error('❌ Could not save the health layout:', error);
        res.status(500).json({ success: false, error: 'Could not save your choice' });
    }
});
// <Jun Kai end>

module.exports = router;
