// Owner: Role 3, Jun Kai.
// Deleted record counts: when visitor records are deleted (Visitor Data Archive, Permanent Data Deletion), how many of
// each kind were made on each Singapore day goes into deleted_record_counts in the same transaction, so running totals
// (the kiosk's visitor number, the tree's year book) keep counting them. Counts only: no names, emails or ids.
// <Jun Kai start>
const { isFeedbackFlagged } = require('../analysis/flagged');
const { toSgtDay } = require('./visitorSchedule');
const saveGate = require('./saveGate');

const TABLE = 'deleted_record_counts';
const KINDS = Object.freeze({
    feedback: 'feedback',     // feedback rows with is_active = 1 (the kiosk's visitor number counts these)
    leaf: 'leaf',             // the same rows without flagged words in the pledge or answers (the tree draws these)
    visitor: 'visitor',       // users rows
    lostFound: 'lost_found'   // lost_found_reports rows
});
const CHUNK_SIZE = 500;
const db = () => require('../../core/db'); // loaded on first use, so the counting below works without a database

// The answers of a feedback row joined exactly like the tree joins them, so the flagged check gives the tree's answer
const ANSWERS_SQL = `SELECT feedback_id, GROUP_CONCAT(answer_value SEPARATOR ' ') AS answer_values
    FROM feedback_answers
    WHERE answer_value IS NOT NULL AND TRIM(answer_value) != '' AND feedback_id IN (?)
    GROUP BY feedback_id`;

// What is read before each delete; the rows are locked (FOR UPDATE), so exactly these rows are counted and deleted.
// A locked feedback row cannot get new answers either (their foreign key needs that row).
const SOURCES = {
    feedback: {
        load: async (tx, ids) => {
            const rows = await tx.all('SELECT id, created_at, is_active, comment FROM feedback WHERE id IN (?) FOR UPDATE', [ids]);
            if (!rows.length) return rows;
            const answers = new Map((await tx.all(ANSWERS_SQL, [rows.map((row) => row.id)])).map((a) => [a.feedback_id, a.answer_values]));
            return rows.map((row) => ({ ...row, answer_values: answers.get(row.id) || null }));
        },
        kinds: (row) => {
            if (Number(row.is_active) !== 1) return [];
            return isFeedbackFlagged([row.comment, row.answer_values]) ? [KINDS.feedback] : [KINDS.feedback, KINDS.leaf];
        }
    },
    users: {
        load: (tx, ids) => tx.all('SELECT id, COALESCE(created_at, last_visit) AS created_at FROM users WHERE id IN (?) FOR UPDATE', [ids]),
        kinds: () => [KINDS.visitor]
    },
    lost_found_reports: {
        load: (tx, ids) => tx.all('SELECT id, created_at FROM lost_found_reports WHERE id IN (?) FOR UPDATE', [ids]),
        kinds: () => [KINDS.lostFound]
    }
};

function chunks(list, size = CHUNK_SIZE) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

// rows -> [[day, kind, count]]: one entry per Singapore day and kind. A row without a readable created_at is skipped.
function tally(rows, kindsOf) {
    const counts = new Map();
    for (const row of rows) {
        const created = row.created_at ? new Date(row.created_at) : null;
        if (!created || Number.isNaN(created.getTime())) continue;
        const day = toSgtDay(created);
        for (const kind of kindsOf(row)) {
            const key = `${day}|${kind}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }
    }
    return [...counts].map(([key, count]) => [...key.split('|'), count]);
}

// tx: { all(sql, params) -> rows, run(sql, params) -> affected rows }, both inside the caller's transaction
async function save(tx, entries) {
    if (!entries.length) return;
    await tx.run(
        `INSERT INTO ${TABLE} (record_day, kind, record_count) VALUES ? AS added
         ON DUPLICATE KEY UPDATE record_count = ${TABLE}.record_count + added.record_count`, [entries]);
}

// Inside the caller's transaction: locks the rows of `table` with these ids, adds their counts, then deletes exactly
// those rows. Returns how many rows went. A missing deleted_record_counts table fails the whole transaction, so a
// delete never happens without its counts.
async function deleteCounted(tx, table, ids) {
    const source = SOURCES[table];
    if (!source) throw new Error(`deleted counts: unknown table ${table}`);
    let deleted = 0;
    for (const part of chunks([...new Set(ids)])) {
        const rows = await source.load(tx, part);
        if (!rows.length) continue;
        await save(tx, tally(rows, source.kinds));
        deleted += await tx.run(`DELETE FROM ${table} WHERE id IN (?)`, [rows.map((row) => row.id)]);
    }
    return deleted;
}

// For the admin routes: one transaction that locks the rows of `table` matching `where`, counts and deletes them,
// taking turns with kiosk saves like the archive does (a save goes first). callback(error, deletedCount, deletedIds)
function deleteWhere(table, where, params, callback) {
    saveGate.deleteStep((checkpoint) => new Promise((resolve, reject) => {
        db().withTransaction((tx, finish) => {
            const all = async (sql, values) => {
                await checkpoint();
                return new Promise((ok, fail) => tx.all(sql, values, (error, rows) => (error ? fail(error) : ok(rows))));
            };
            const run = async (sql, values) => {
                await checkpoint();
                return new Promise((ok, fail) => tx.run(sql, values, function (error) { if (error) fail(error); else ok(this.changes); }));
            };
            (async () => {
                const ids = (await all(`SELECT id FROM ${table} WHERE ${where} FOR UPDATE`, params)).map((row) => row.id);
                const count = await deleteCounted({ all, run }, table, ids);
                await checkpoint();
                return { count, ids };
            })().then((result) => { finish(null, result); }, (error) => { finish(error); });
        }, (error, result) => (error ? reject(error) : resolve(result)));
    }), { maxTries: 3, waitMs: 20 * 1000 }).then((result) => callback(null, result.count, result.ids), (error) => callback(error))
        .catch((error) => console.error(`Deleted record counts: the caller failed after the delete (${error.message})`));
}

// What an admin route answers when a counted delete was refused; null for any other error
function deleteFailure(error) {
    if (error && error.kioskBusy) return { status: 409, message: 'Visitors are saving at the kiosk right now, so nothing was deleted. Try again in a minute.' };
    if (error && error.code === 'ER_NO_SUCH_TABLE') return { status: 503, message: 'The database needs an update before records can be deleted: run npm run db:migrate, then try again.' };
    return null;
}

// The kiosk's visitor number: live feedback plus deleted feedback, read in one statement so both come from the same
// moment (a delete that commits in between is never counted twice)
const VISITOR_NUMBER_SQL = `SELECT (SELECT COUNT(*) FROM feedback WHERE is_active = 1)
    + (SELECT COALESCE(SUM(record_count), 0) FROM ${TABLE} WHERE kind = '${KINDS.feedback}') AS count`;

const reported = new Set();
function readFailed(error) {
    const code = error.code || error.message;
    if (reported.has(code)) return;
    reported.add(code);
    console.warn(`Deleted record counts could not be read (${code}), so totals show the database rows only.${error.code === 'ER_NO_SUCH_TABLE' ? ' Run npm run db:migrate.' : ''}`);
}

// Deleted rows of one kind, all time or for Singapore days from..to ('YYYY-MM-DD', both included). 0 when unreadable.
async function total(kind, { from = null, to = null } = {}) {
    let sql = `SELECT COALESCE(SUM(record_count), 0) AS n FROM ${TABLE} WHERE kind = ?`;
    const params = [kind];
    if (from) { sql += ' AND record_day >= ?'; params.push(from); }
    if (to) { sql += ' AND record_day <= ?'; params.push(to); }
    try {
        const [rows] = await db().pool.promise().query(sql, params);
        return Number(rows[0] && rows[0].n) || 0;
    } catch (error) {
        readFailed(error);
        return 0;
    }
}

// Deleted rows of one kind per Singapore year: Map(year -> { count, firstDay, lastDay }). Empty when unreadable.
async function byYear(kind) {
    try {
        const [rows] = await db().pool.promise().query(
            `SELECT YEAR(record_day) AS year, SUM(record_count) AS n,
                    DATE_FORMAT(MIN(record_day), '%Y-%m-%d') AS first_day, DATE_FORMAT(MAX(record_day), '%Y-%m-%d') AS last_day
             FROM ${TABLE} WHERE kind = ? GROUP BY YEAR(record_day)`, [kind]);
        return new Map(rows.filter((row) => Number(row.n) > 0).map((row) => [Number(row.year), { count: Number(row.n), firstDay: row.first_day, lastDay: row.last_day }]));
    } catch (error) {
        readFailed(error);
        return new Map();
    }
}

// The tree's year book: adds each year's deleted leaves to its leafCount (archivedLeafCount says how many) and lists a
// year whose leaves were all deleted. yearMap: Map(year -> { year, leafCount, firstSubmission, lastSubmission, isCurrentYear })
function mergeYearBook(yearMap, archivedYears, currentYear) {
    for (const [year, archived] of archivedYears) {
        const first = new Date(`${archived.firstDay}T00:00:00+08:00`);
        const last = new Date(`${archived.lastDay}T23:59:59+08:00`);
        const item = yearMap.get(year) || { year, leafCount: 0, firstSubmission: null, lastSubmission: null, isCurrentYear: year === currentYear };
        item.leafCount += archived.count;
        item.archivedLeafCount = archived.count;
        if (!item.firstSubmission || first < new Date(item.firstSubmission)) item.firstSubmission = first.toISOString();
        if (!item.lastSubmission || last > new Date(item.lastSubmission)) item.lastSubmission = last.toISOString();
        yearMap.set(year, item);
    }
    return yearMap;
}

async function addToYearBook(yearMap, currentYear) {
    return mergeYearBook(yearMap, await byYear(KINDS.leaf), currentYear);
}

module.exports = { TABLE, KINDS, SOURCES, ANSWERS_SQL, VISITOR_NUMBER_SQL, tally, deleteCounted, deleteWhere, deleteFailure, total, byYear, mergeYearBook, addToYearBook };
// <Jun Kai end>
