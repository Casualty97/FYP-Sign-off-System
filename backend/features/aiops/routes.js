// Owner: Role 3, Jun Kai.
// Admin anomaly detection API, mounted at /api/admin/aiops (session required; the settings and run-now need a
// system_admin): the engine status with the incident counts, the incidents and their timeline, acknowledge /
// resolve / verdict, the settings, one check now and a test incident.
// <Jun Kai start>
const express = require('express');
const auth = require('../../core/auth');
const { logAudit } = require('../../core/audit');
const settings = require('./settings');
const engine = require('./engine');
const { ACTIONS } = require('./advisor');
const learning = require('./learning');

const router = express.Router();
const STATUSES = ['open', 'resolved', 'all'];
const NO_COUNTS = { open: 0, acknowledged: 0, resolvedToday: 0 };

const who = (req) => req.session.user.username;
const idOf = (value) => (/^\d{1,9}$/.test(String(value)) ? Number(value) : null);
const notFound = (res) => res.status(404).json({ success: false, error: 'No incident with that id' });

// a known status wins (the verdict check), a missing table is 503, anything else a plain 500 (the detail goes to the log)
function fail(res, error, what) {
    if (error && error.status) return res.status(error.status).json({ success: false, error: error.message, ...(error.field ? { field: error.field } : {}) });
    if (error && error.missingTable) return res.status(503).json({ success: false, error: engine.MISSING_TABLES });
    console.error(`[aiops] could not ${what}: ${error && error.message ? error.message : 'unknown error'}`);
    return res.status(500).json({ success: false, error: `Could not ${what}` });
}

// GET /api/admin/aiops/status  engine state, detectors, data window and the incident counts (zero when the counts
// cannot be read: the status still shows lastError)
router.get('/status', auth.requireAuth, async (req, res) => {
    try {
        const status = engine.getStatus();
        const counts = await engine.counts().catch(() => NO_COUNTS);
        res.json({ success: true, status: { ...status, counts } });
    } catch (error) { fail(res, error, 'load the status'); }
});

// GET /api/admin/aiops/incidents?status=open|resolved|all&limit=50  open first, newest first
router.get('/incidents', auth.requireAuth, async (req, res) => {
    const status = req.query.status === undefined ? 'open' : String(req.query.status);
    if (!STATUSES.includes(status)) return res.status(400).json({ success: false, error: 'status must be open, resolved or all' });
    try {
        const incidents = await engine.store.list({ status, limit: req.query.limit });
        // the newest advice of each incident rides along, so the page sees it arrive (the incident row itself does not change)
        const advice = await engine.store.latestEvents(incidents.map((i) => i.id), 'advice');
        res.json({
            success: true,
            incidents: incidents.map((i) => ({ ...i, advice: advice[i.id] ? { at: advice[i.id].at, ...advice[i.id].detail } : null, adviceBusy: engine.advisor.isBusy(i.id) }))
        });
    } catch (error) { fail(res, error, 'list the incidents'); }
});

// GET /api/admin/aiops/incidents/:id  one incident with its timeline
router.get('/incidents/:id', auth.requireAuth, async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) return notFound(res);
    try {
        const incident = await engine.store.get(id);
        if (!incident) return notFound(res);
        res.json({ success: true, incident, events: await engine.store.events(id) });
    } catch (error) { fail(res, error, 'load the incident'); }
});

// The three admin actions share one shape; the engine answers null for an unknown id
function action(what, run) {
    return async (req, res) => {
        const id = idOf(req.params.id);
        if (!id) return notFound(res);
        try {
            const incident = await run(id, req);
            if (!incident) return notFound(res);
            res.json({ success: true, incident });
        } catch (error) { fail(res, error, what); }
    };
}

// POST /api/admin/aiops/incidents/:id/acknowledge
router.post('/incidents/:id/acknowledge', auth.requireAuth, action('acknowledge the incident', (id, req) => engine.acknowledge(id, who(req))));
// POST /api/admin/aiops/incidents/:id/resolve  { note }
router.post('/incidents/:id/resolve', auth.requireAuth, action('resolve the incident', (id, req) => engine.resolve(id, who(req), (req.body || {}).note)));
// POST /api/admin/aiops/incidents/:id/verdict  { verdict: 'correct' | 'not-useful' | 'false-alarm' }
router.post('/incidents/:id/verdict', auth.requireAuth, action('save the verdict', (id, req) => engine.setVerdict(id, (req.body || {}).verdict, who(req))));

// POST /api/admin/aiops/incidents/:id/advice  ask the advisor again (at most every 30 s per incident); it answers in
// the background and the advice shows on the next list
router.post('/incidents/:id/advice', auth.requireAuth, async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) return notFound(res);
    try {
        const incident = await engine.store.get(id);
        if (!incident) return notFound(res);
        if (incident.status === 'resolved') return res.status(400).json({ success: false, error: 'This incident is resolved: there is nothing to advise on' });
        const result = engine.advisor.request(id, { force: true });
        if (!result.queued && result.reason === 'off') return res.status(409).json({ success: false, error: 'The advisor is switched off in the settings' });
        if (!result.queued && result.reason === 'soon') return res.status(429).json({ success: false, error: 'The advisor was asked a moment ago: wait half a minute' });
        res.json({ success: true, queued: true });
    } catch (error) { fail(res, error, 'ask the advisor'); }
});

// GET /api/admin/aiops/advisor  the advisor's state, its step list and the models Ollama has (empty when it is not running)
router.get('/advisor', auth.requireAuth, async (req, res) => {
    const status = engine.advisor.getStatus();
    let models = [];
    try {
        const response = await fetch(`${status.url}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (response.ok) models = ((await response.json()).models || []).map((m) => m && m.name).filter((name) => typeof name === 'string');
    } catch { /* Ollama not running: the page offers the saved model only */ }
    res.json({ success: true, advisor: status, actions: ACTIONS, models });
});

// GET /api/admin/aiops/settings  the settings, their limits and the detector list
router.get('/settings', auth.requireAuth, (req, res) => {
    res.json({ success: true, settings: settings.read(), limits: settings.LIMITS, detectors: settings.DETECTORS, learned: learning.read() });
});

// PUT /api/admin/aiops/settings  (system_admin) the whole settings object, or only the keys that change
router.put('/settings', auth.requireAdmin, (req, res) => {
    const result = settings.validate(req.body);
    if (result.error) return res.status(400).json({ success: false, error: result.error, field: result.field });
    try {
        // a level the admin saves wins over what the verdicts taught that detector
        const before = settings.read();
        const changed = settings.DETECTORS.map((x) => x.key).filter((key) => before.detectors[key].sensitivity !== result.settings.detectors[key].sensitivity);
        if (changed.length) learning.resetFor(changed);
        settings.write(result.settings);
        engine.applySettings(result.settings);
        logAudit('AIOPS_SETTINGS_UPDATE', who(req), 'aiops', null, req);
        res.json({ success: true, settings: result.settings });
    } catch (error) { fail(res, error, 'save the settings'); }
});

// POST /api/admin/aiops/run-now  (system_admin) one check now; result.skipped is 'disabled' while the master switch is off
router.post('/run-now', auth.requireAdmin, async (req, res) => {
    try {
        res.json({ success: true, result: await engine.runNow() });
    } catch (error) { fail(res, error, 'run the check'); }
});

// POST /api/admin/aiops/test-incident  a sample incident so the admin sees the flow; it resolves itself after 10 minutes
router.post('/test-incident', auth.requireAuth, async (req, res) => {
    try {
        res.json({ success: true, incident: await engine.openTest(who(req)) });
    } catch (error) { fail(res, error, 'open the test incident'); }
});

module.exports = router;
// <Jun Kai end>
