// Owner: Role 3, Jun Kai.
// Kiosk saves and an archive's delete step take turns, and the visitor's save always goes first. Works across both
// server processes (server.js and kioskServer.js) through the visitor_save_gate table:
// - a save adds a 'save' row, waits while a delete step is running (that step backs off within one statement), then saves;
// - a delete step waits until no save is running, adds a 'delete' row, and before every statement and just before its
//   commit looks for a 'save' row: when one appears it rolls back, waits for the saves, then runs again from the start.
// <Jun Kai start>
const SAVE_TTL_MS = 2 * 60 * 1000;               // a save's row is renewed while the save runs; one left by a stopped server expires
const SAVE_RENEW_MS = 30 * 1000;
const SAVE_MAX_MS = 15 * 60 * 1000;              // a save stuck longer than this (a hung model download) stops holding deletes back
const DELETE_TTL_MS = 10 * 60 * 1000;            // a row left by a server that stopped stops counting after this
const SAVE_WAIT_MS = 30 * 1000;                  // a save never waits longer than this for a delete step
const DELETE_WAIT_MS = SAVE_TTL_MS + 30 * 1000;  // a delete step waits this long for running saves, so an orphan row expires first
const MAX_TRIES = 10;
const SAVE_POLL_MS = 100;
const DELETE_POLL_MS = 250;
const KIOSK_BUSY_MESSAGE = 'Visitors kept submitting at the kiosk while the archive was deleting, so nothing was deleted. Run the archive again.';

const db = () => require('../../core/db'); // loaded on first use, so the logic below can be tested without a database
const query = async (sql, params) => (await db().pool.promise().query(sql, params))[0];

const sqlStore = {
    async add(holder, ttlMs) {
        const result = await query('INSERT INTO visitor_save_gate (holder, expires_at) VALUES (?, UTC_TIMESTAMP(3) + INTERVAL ? SECOND)', [holder, Math.ceil(ttlMs / 1000)]);
        return result.insertId;
    },
    async renew(id, ttlMs) {
        await query('UPDATE visitor_save_gate SET expires_at = UTC_TIMESTAMP(3) + INTERVAL ? SECOND WHERE id = ?', [Math.ceil(ttlMs / 1000), id]);
    },
    async remove(id) {
        await query('DELETE FROM visitor_save_gate WHERE id = ? OR expires_at < UTC_TIMESTAMP(3) - INTERVAL 1 DAY', [id]);
    },
    async active(holder) {
        return (await query('SELECT 1 FROM visitor_save_gate WHERE holder = ? AND expires_at > UTC_TIMESTAMP(3) LIMIT 1', [holder])).length > 0;
    }
};

const reported = new Set();
function reportOnce(error) {
    const code = (error && (error.code || error.message)) || 'unknown';
    if (reported.has(code)) return;
    reported.add(code);
    console.warn(`Visitor save gate: ${code}${error && error.code === 'ER_NO_SUCH_TABLE' ? ' (run npm run db:migrate)' : ''}; kiosk saves carry on without it.`);
}

const sleeper = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const repeater = (fn, ms) => {
    const timer = setInterval(fn, ms);
    if (timer.unref) timer.unref();
    return () => clearInterval(timer);
};
const busyError = () => Object.assign(new Error(KIOSK_BUSY_MESSAGE), { kioskBusy: true });

// store: { add(holder, ttlMs) -> id, renew(id, ttlMs), remove(id), active(holder) -> boolean }; sleep, now and every are
// swapped in by the tests
function createGate(store, { sleep = sleeper, now = () => Date.now(), every = repeater } = {}) {
    // Kiosk side: await it before the save, then call the returned function once the save is done or has failed.
    // Never throws: when the gate is unavailable the save simply goes ahead.
    async function enterSave() {
        let id = null;
        let stopRenewing = () => {};
        try {
            id = await store.add('save', SAVE_TTL_MS);
            const startedAt = now();
            stopRenewing = every(() => {
                if (now() - startedAt > SAVE_MAX_MS) return stopRenewing();
                Promise.resolve().then(() => store.renew(id, SAVE_TTL_MS)).catch(reportOnce);
            }, SAVE_RENEW_MS);
            const giveUpAt = now() + SAVE_WAIT_MS;
            while (now() < giveUpAt && await store.active('delete')) await sleep(SAVE_POLL_MS);
        } catch (error) {
            reportOnce(error);
        }
        let released = false;
        return () => {
            if (released || id === null) return;
            released = true;
            stopRenewing();
            Promise.resolve().then(() => store.remove(id)).catch(reportOnce);
        };
    }

    // Archive side: work(checkpoint) runs one delete transaction and awaits checkpoint() before every statement and once
    // more before its commit; checkpoint throws while a save is running, so the transaction rolls back and is run again.
    // An admin waiting on the page passes smaller limits, so a busy kiosk answers "try again" instead of hanging.
    async function deleteStep(work, { maxTries = MAX_TRIES, waitMs = DELETE_WAIT_MS } = {}) {
        for (let attempt = 1; attempt <= maxTries; attempt++) {
            const giveUpAt = now() + waitMs;
            while (await store.active('save')) {
                if (now() >= giveUpAt) throw busyError();
                await sleep(DELETE_POLL_MS);
            }
            const id = await store.add('delete', DELETE_TTL_MS);
            try {
                return await work(async () => {
                    if (await store.active('save')) throw Object.assign(new Error('a kiosk save started'), { saveGateBackoff: true });
                });
            } catch (error) {
                if (!error || !error.saveGateBackoff) throw error;
            } finally {
                await Promise.resolve().then(() => store.remove(id)).catch(reportOnce);
            }
        }
        throw busyError();
    }

    return { enterSave, deleteStep };
}

const gate = createGate(sqlStore);

module.exports = { enterSave: gate.enterSave, deleteStep: gate.deleteStep, createGate, KIOSK_BUSY_MESSAGE, MAX_TRIES, SAVE_TTL_MS, SAVE_RENEW_MS, SAVE_MAX_MS, SAVE_WAIT_MS, DELETE_WAIT_MS };
// <Jun Kai end>
