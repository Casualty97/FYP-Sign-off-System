// Owner: Role 2, Wei Jie.
// Unit tests for the tree leaves' badges (GET /api/tree, backend/features/tree/routes.js): a visitor who chose
// several pledge topics in the pledge form gets one "Multiple pledges" leaf, brown by default. The route runs with
// a stand-in database (no real database is used). Run: npm run test:unit
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
// The route reports each request on the console; quiet here, as that output upsets the test runner's own messages.
console.log = () => {};
console.debug = () => {};
// GET /api/tree also adds the leaves the Visitor Data Archive kept on the tree (features/archive/archivedLeaves.js),
// read through backend/core/db's pool. That module is a stand-in here (as in archivedLeaves.test.js), so the real
// pool is never opened: without MySQL it would keep retrying for 5 minutes and hold this test open.
// keptRows: the archived_leaves rows it answers with; dbAsked: the SQL it was asked.
let keptRows = [];
const dbAsked = [];
const dbPath = require.resolve('../../backend/core/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { pool: { promise: () => ({ query: async (sql) => {
    dbAsked.push(sql);
    return [/FROM archived_leaves/.test(sql) ? keptRows : []];
} }) } } };
const tree = require('../../backend/features/tree/routes');
const { BADGE_CONFIGS } = require('../../backend/features/email/service');

const year = new Date().getFullYear();
const row = (id, name, metadata) => ({
    feedback_id: id, name, visit_count: 1, user_created_at: `${year}-03-01T00:00:00.000Z`, created_at: `${year}-03-01T00:00:00.000Z`,
    comment: 'I will bring my own bottle.', data_retention: 'longterm', metadata: JSON.stringify(metadata), answer_values: null
});
const ROWS = [
    row(1, 'Several', { pledgeTopic: 'climate-change', pledgeTopics: ['climate-change', 'ocean-conservation', 'community-impact'] }),
    row(2, 'One', { pledgeTopic: 'ocean-conservation', pledgeTopics: ['ocean-conservation'] }),
    row(3, 'Older', { pledgeTopic: 'renewable-energy' }), // saved before several topics could be chosen
    row(4, 'None', {}),
    row(5, 'Twice the same', { pledgeTopics: ['climate-change', 'climate-change'] })
];

// The leaves GET /api/tree returns, in its order.
async function leafList() {
    tree.setDatabase({
        all: (sql, params, callback) => (typeof params === 'function' ? params : callback)(null, /vip/i.test(sql) ? [] : ROWS),
        get: (sql, params, callback) => (typeof params === 'function' ? params : callback)(null, {})
    });
    const app = express();
    app.use('/api/tree', tree.router);
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/tree`);
        assert.equal(response.status, 200);
        return await response.json();
    } finally {
        server.close();
    }
}
const leaves = async () => Object.fromEntries((await leafList()).map(leaf => [leaf.name, leaf]));

test('several pledge topics: one "Multiple pledges" leaf, brown, naming every badge', async () => {
    const leaf = (await leaves()).Several;
    assert.ok(dbAsked.some(sql => /FROM archived_leaves/.test(sql)), 'the kept leaves were looked up, from the stand-in');
    assert.equal(leaf.badgeKey, 'multi-pledge');
    assert.equal(leaf.badgeColor, '#8b5a2b');
    assert.deepEqual(leaf.badgeKeys, ['climate-champion', 'ocean-guardian', 'social-champion']);
    assert.match(leaf.badgeName, /^Multiple pledges: Climate Champion, Ocean Guardian, Social Champion$/);
    assert.deepEqual(leaf.pledgeTopics, ['climate-change', 'ocean-conservation', 'community-impact']);
});

test('one pledge topic (or none, or the same one twice): its own badge, as before', async () => {
    const all = await leaves();
    assert.equal(all.One.badgeKey, 'ocean-guardian');
    assert.equal(all.Older.badgeKey, 'renewable-innovator');
    assert.equal(all.None.badgeKey, 'feedback-completer');
    assert.equal(all['Twice the same'].badgeKey, 'climate-champion');
    assert.deepEqual(all.One.badgeKeys, ['ocean-guardian']);
});

test('leaves the Visitor Data Archive kept are on the tree in order, and several pledges stay brown "Multiple pledges"', async () => {
    keptRows = [
        { feedback_id: 90, created_at: new Date(`${year}-02-01T00:00:00.000Z`), label: 'J. T.', badge_key: 'climate-champion', badge_keys: 'climate-champion,ocean-guardian', is_vip: 0 },
        { feedback_id: 91, created_at: new Date(`${year}-02-02T00:00:00.000Z`), label: 'Visitor', badge_key: 'ocean-guardian', badge_keys: null, is_vip: 0 }
    ];
    try {
        const list = await leafList();
        assert.deepEqual(list.map(leaf => leaf.id), [90, 91, 1, 2, 3, 4, 5], 'kept and live leaves by created_at, then id');
        const [several, one] = list;
        assert.deepEqual(
            [several.archived, several.badgeKey, several.badgeColor, several.badgeKeys, several.badgeName, several.pledgeSnippet, several.privacyLabel],
            [true, 'multi-pledge', '#8b5a2b', ['climate-champion', 'ocean-guardian'], 'Multiple pledges: Climate Champion, Ocean Guardian', '', 'Details archived']);
        assert.deepEqual([one.archived, one.badgeKey, one.badgeColor, one.badgeKeys], [true, 'ocean-guardian', BADGE_CONFIGS['ocean-guardian'].color, ['ocean-guardian']]);
        assert.equal(list.find(leaf => leaf.id === 1).badgeKey, 'multi-pledge', 'the live leaves are as before');
        assert.equal(list.filter(leaf => leaf.archived).length, 2);
    } finally {
        keptRows = [];
    }
});
