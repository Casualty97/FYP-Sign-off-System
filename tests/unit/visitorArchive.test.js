// Owner: Role 3, Jun Kai.
// Unit tests for the Visitor Data Archive: settings, Singapore dates and the schedule, folder and file rules, the zip writer. Run: npm run test:unit
// <Jun Kai start>
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');
const paths = require('../../backend/core/paths');
const zip = require('../../backend/core/zip');
const settingsStore = require('../../backend/features/archive/visitorSettings');
const schedule = require('../../backend/features/archive/visitorSchedule');
const files = require('../../backend/features/archive/visitorFiles');
const writer = require('../../backend/features/archive/visitorWriter');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'va-unit-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5 }));

const NOW = new Date('2026-11-09T06:32:00.000Z'); // Monday 9 Nov 2026, 14:32 in Singapore
const iso = (date) => (date ? date.toISOString() : date);
const clone = (value) => JSON.parse(JSON.stringify(value));
const defaults = () => clone(settingsStore.DEFAULTS);
// always pass the previous settings, so the real backend/data file is never read
const check = (changes) => settingsStore.validate({ ...defaults(), ...changes }, defaults());

test('the archive helpers load without the database, auth or analysis cache modules', () => {
    const loaded = Object.keys(require.cache).map((file) => file.replace(/\\/g, '/'));
    assert.deepEqual(loaded.filter((file) => /backend\/(core\/(db|auth)|features\/analysis\/cacheStore)\.js$/.test(file)), []);
});

test('the committed defaults file is DEFAULTS and passes validate()', () => {
    const file = JSON.parse(fs.readFileSync(path.join(paths.DEFAULTS, settingsStore.FILE_NAME), 'utf8'));
    assert.deepEqual(file, settingsStore.DEFAULTS);
    assert.deepEqual(settingsStore.validate(file, clone(file)).settings, file);
});

test('keep periods take their whole range and refuse one step past it', () => {
    for (const [unit, [min, max]] of Object.entries(settingsStore.LIMITS.keep)) {
        for (const key of ['feedback', 'lostFound']) {
            const keepFor = (amount) => check({ [key]: { ...defaults()[key], keep: { amount, unit } } });
            assert.ok(keepFor(min).settings, `${key} ${min} ${unit}`);
            assert.ok(keepFor(max).settings, `${key} ${max} ${unit}`);
            assert.equal(keepFor(min - 1).field, `${key}.keep.amount`);
            assert.equal(keepFor(max + 1).field, `${key}.keep.amount`);
        }
    }
    assert.equal(check({ feedback: { enabled: true, keep: { amount: 1.5, unit: 'months' } } }).field, 'feedback.keep.amount');
    assert.equal(check({ feedback: { enabled: true, keep: { amount: 12, unit: 'decades' } } }).field, 'feedback.keep.unit');
    assert.equal(check({ feedback: { enabled: true, keep: { amount: '6', unit: 'months' } } }).settings.feedback.keep.amount, 6, 'a number typed as text is fine');
});

test('schedule, storage and switch values are checked against LIMITS too', () => {
    const { LIMITS } = settingsStore;
    const auto = (changes) => check({ automatic: { ...defaults().automatic, ...changes } });
    for (const key of ['dayOfMonth', 'weekday', 'everyDays']) {
        const [min, max] = LIMITS[key];
        assert.ok(auto({ [key]: min }).settings, `${key} ${min}`);
        assert.ok(auto({ [key]: max }).settings, `${key} ${max}`);
        assert.equal(auto({ [key]: min - 1 }).field, `automatic.${key}`);
        assert.equal(auto({ [key]: max + 1 }).field, `automatic.${key}`);
    }
    for (const frequency of LIMITS.frequency) assert.ok(auto({ frequency }).settings, frequency);
    assert.equal(auto({ frequency: 'hourly' }).field, 'automatic.frequency');
    for (const time of ['', '00:00', '09:30', '23:59']) assert.ok(auto({ time }).settings, time);
    for (const time of ['24:00', '9:30', '12:60', 'noon', null]) assert.equal(auto({ time }).field, 'automatic.time', String(time));

    for (const [unit, [min, max]] of Object.entries(LIMITS.keepFiles)) {
        assert.ok(check({ keepFiles: { amount: min, unit } }).settings, `${min} ${unit}`);
        assert.ok(check({ keepFiles: { amount: max, unit } }).settings, `${max} ${unit}`);
        assert.equal(check({ keepFiles: { amount: max + 1, unit } }).field, 'keepFiles.amount');
    }
    assert.deepEqual(check({ keepFiles: { amount: 0, unit: 'months' } }).settings.keepFiles, { amount: 0, unit: 'months' }, '0 keeps files forever');
    assert.equal(check({ keepFiles: { amount: -1, unit: 'years' } }).field, 'keepFiles.amount');
    assert.equal(check({ keepFiles: { amount: 2, unit: 'days' } }).field, 'keepFiles.unit');

    assert.equal(check({ includePhotos: 'yes' }).field, 'includePhotos');
    assert.equal(check({ deleteAfterArchive: 1 }).field, 'deleteAfterArchive');
    assert.equal(check({ lostFound: { ...defaults().lostFound, onlyResolved: 'true' } }).field, 'lostFound.onlyResolved');

    const outside = path.join(TMP, 'archives');
    assert.equal(check({ folder: '' }).settings.folder, '');
    assert.equal(check({ folder: `  ${outside}  ` }).settings.folder, outside, 'spaces around the path are dropped');
    assert.equal(check({ folder: 'archives' }).field, 'folder');
    assert.equal(check({ folder: path.join(paths.FRONTEND, 'archives') }).field, 'folder');
    assert.equal(check({ folder: path.join(TMP, 'x'.repeat(LIMITS.folderMaxLength + 1)) }).field, 'folder');
    assert.equal(settingsStore.validate('nope', defaults()).error.length > 0, true);
});

test('automatic.enabledAt is set by the server when automatic archiving is switched on', () => {
    const off = defaults();
    const before = Date.now();
    const on = settingsStore.validate({ ...off, automatic: { ...off.automatic, enabled: true, enabledAt: '1999-01-01T00:00:00.000Z' } }, off).settings;
    const at = new Date(on.automatic.enabledAt).getTime();
    assert.ok(at >= before && at <= Date.now(), 'the value the page sent is ignored');

    const stillOn = settingsStore.validate({ ...on, automatic: { ...on.automatic, enabledAt: null, dayOfMonth: 15 } }, on).settings;
    assert.equal(stillOn.automatic.enabledAt, on.automatic.enabledAt, 'staying on keeps the first time');
    assert.equal(settingsStore.validate({ ...on, automatic: { ...on.automatic, enabled: false } }, on).settings.automatic.enabledAt, null);

    const leftOut = settingsStore.validate({ includePhotos: false }, on).settings;
    assert.equal(leftOut.includePhotos, false);
    assert.deepEqual(leftOut.automatic, on.automatic, 'keys the body leaves out keep their saved value');

    const nothingToArchive = { ...off, feedback: { ...off.feedback, enabled: false }, lostFound: { ...off.lostFound, enabled: false }, automatic: { ...off.automatic, enabled: true } };
    assert.equal(settingsStore.validate(nothingToArchive, off).field, 'automatic.enabled');
});

test('automatic archiving is refused with export only, and keys like password are never saved', () => {
    const off = defaults();
    const exportOnly = check({ deleteAfterArchive: false, automatic: { ...off.automatic, enabled: true } });
    assert.equal(exportOnly.field, 'automatic.enabled');
    assert.equal(exportOnly.error, 'Automatic archiving needs Delete the records from the database. With export only, every run would save the same records again.');
    assert.equal(exportOnly.error, settingsStore.EXPORT_ONLY_AUTOMATIC, 'the scheduler uses the same sentence');

    const on = settingsStore.validate({ ...off, automatic: { ...off.automatic, enabled: true } }, off).settings;
    assert.equal(settingsStore.validate({ deleteAfterArchive: false }, on).field, 'automatic.enabled', 'switching to export only while automatic is on');
    assert.equal(settingsStore.validate({ deleteAfterArchive: false, automatic: { enabled: false } }, on).settings.deleteAfterArchive, false);
    assert.equal(check({ deleteAfterArchive: false }).settings.deleteAfterArchive, false, 'export only by hand is fine');

    const saved = check({ password: 'typed-in', somethingElse: 1 }).settings;
    assert.deepEqual(Object.keys(saved).sort(), Object.keys(settingsStore.DEFAULTS).sort());
});

test('read() repairs a hand-edited settings file and write() saves what read() gives back', (t) => {
    const file = path.join(TMP, 'settings', settingsStore.FILE_NAME);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    t.mock.method(paths, 'dataFile', () => file);
    assert.deepEqual(settingsStore.read(), settingsStore.DEFAULTS, 'no file yet: the defaults');

    fs.writeFileSync(file, JSON.stringify({
        feedback: { enabled: 'no', keep: { amount: 999, unit: 'months' } },
        lostFound: { enabled: false, keep: { amount: 0, unit: 'fortnights' }, onlyResolved: 'yes' },
        includePhotos: false,
        automatic: { enabled: true, frequency: 'hourly', dayOfMonth: 31, weekday: 9, everyDays: 0, time: '25:00', enabledAt: 'not a date' },
        folder: 'relative/folder',
        keepFiles: { amount: 50, unit: 'years' }
    }));
    const repaired = settingsStore.read();
    assert.deepEqual(repaired, {
        feedback: { enabled: true, keep: { amount: 120, unit: 'months' } },
        lostFound: { enabled: false, keep: { amount: 1, unit: 'months' }, onlyResolved: false },
        includePhotos: false,
        deleteAfterArchive: true,
        automatic: { enabled: true, frequency: 'monthly', dayOfMonth: 28, weekday: 6, everyDays: 1, time: '', enabledAt: null },
        folder: '',
        keepFiles: { amount: 20, unit: 'years' }
    });
    assert.ok(settingsStore.validate(repaired, repaired).settings, 'the repaired settings are valid');

    t.mock.method(console, 'error', () => {}); // jsonFile reports the broken file; not needed here
    fs.writeFileSync(file, '{ not json');
    assert.deepEqual(settingsStore.read(), settingsStore.DEFAULTS);
    fs.writeFileSync(file, JSON.stringify({ folder: '\\\\nas\\visitor-archives' }));
    assert.equal(settingsStore.read().folder, '', 'a network folder typed into the file falls back to the default folder');

    const off = defaults();
    const saved = settingsStore.validate({ ...off, includePhotos: false, automatic: { ...off.automatic, enabled: true, frequency: 'weekly', time: '07:15' } }, off).settings;
    settingsStore.write(saved);
    assert.deepEqual(settingsStore.read(), saved);
});

test('sgtDayStart and toSgtDay work in Singapore days', () => {
    assert.equal(iso(schedule.sgtDayStart('2025-11-09')), '2025-11-08T16:00:00.000Z');
    assert.equal(iso(schedule.sgtDayStart('2028-02-29')), '2028-02-28T16:00:00.000Z');
    for (const bad of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-2-3', '09/11/2026', '', null, undefined]) {
        assert.equal(schedule.sgtDayStart(bad), null, String(bad));
    }
    assert.equal(schedule.toSgtDay(new Date('2025-11-08T16:00:00.000Z')), '2025-11-09');
    assert.equal(schedule.toSgtDay(new Date('2025-11-08T15:59:59.999Z')), '2025-11-08');
    assert.equal(schedule.toSgtDay(schedule.sgtDayStart('2026-01-01')), '2026-01-01');
});

test('cutoffFor counts back on the Singapore calendar and starts at midnight of that day', () => {
    const cut = (amount, unit, now = NOW) => iso(schedule.cutoffFor({ amount, unit }, now));
    assert.equal(cut(12, 'months'), '2025-11-08T16:00:00.000Z', '12 months: before 9 Nov 2025');
    assert.equal(cut(1, 'years'), '2025-11-08T16:00:00.000Z');
    assert.equal(cut(10, 'days'), '2026-10-29T16:00:00.000Z');
    assert.equal(cut(2, 'weeks'), '2026-10-25T16:00:00.000Z');
    assert.equal(cut(1, 'months', new Date('2026-03-31T02:00:00.000Z')), '2026-02-27T16:00:00.000Z', '31 Mar - 1 month = 28 Feb');
    assert.equal(cut(1, 'months', new Date('2028-03-31T02:00:00.000Z')), '2028-02-28T16:00:00.000Z', 'leap year: 29 Feb');
    assert.equal(cut(1, 'years', new Date('2028-02-29T10:00:00.000Z')), '2027-02-27T16:00:00.000Z');
    // 23:30 on 9 Nov and 00:30 on 10 Nov in Singapore are both 9 Nov in UTC
    assert.equal(cut(1, 'days', new Date('2026-11-09T15:30:00.000Z')), '2026-11-07T16:00:00.000Z');
    assert.equal(cut(1, 'days', new Date('2026-11-09T16:30:00.000Z')), '2026-11-08T16:00:00.000Z');
});

const MONTHLY = { enabled: true, frequency: 'monthly', dayOfMonth: 1, weekday: 1, everyDays: 30, time: '', enabledAt: '2026-10-15T00:00:00.000Z' };

test('monthly: a run missed while the PC was off happens at the next tick, one from before it was switched on never does', () => {
    const lastMonth = { lastAutomaticAt: '2026-10-01T02:00:00.000Z' };
    assert.equal(schedule.isDue(MONTHLY, lastMonth, NOW), true, '1 Nov passed while the server PC hibernated');
    assert.equal(iso(schedule.nextDueAt(MONTHLY, lastMonth, NOW)), iso(NOW));
    const ranThisMonth = { lastAutomaticAt: '2026-11-01T01:00:00.000Z' };
    assert.equal(schedule.isDue(MONTHLY, ranThisMonth, NOW), false);
    assert.equal(iso(schedule.nextDueAt(MONTHLY, ranThisMonth, NOW)), '2026-11-30T16:00:00.000Z', '1 Dec, 00:00 in Singapore');

    const switchedOnLate = { ...MONTHLY, enabledAt: '2026-11-05T00:00:00.000Z' };
    assert.equal(schedule.isDue(switchedOnLate, {}, NOW), false, 'switched on after 1 Nov: waits for 1 Dec');
    assert.equal(iso(schedule.nextDueAt(switchedOnLate, {}, NOW)), '2026-11-30T16:00:00.000Z');
    assert.equal(schedule.isDue({ ...MONTHLY, enabled: false }, lastMonth, NOW), false);
    assert.equal(schedule.nextDueAt({ ...MONTHLY, enabled: false }, lastMonth, NOW), null);
});

test('daily and weekly runs follow the chosen time in Singapore', () => {
    const daily = { ...MONTHLY, frequency: 'daily', time: '02:00', enabledAt: '2026-11-01T00:00:00.000Z' };
    assert.equal(iso(schedule.lastScheduledAt(daily, NOW)), '2026-11-08T18:00:00.000Z', '02:00 on 9 Nov in Singapore');
    assert.equal(schedule.isDue(daily, { lastAutomaticAt: '2026-11-07T18:05:00.000Z' }, NOW), true, '02:00 was missed while hibernating');
    assert.equal(schedule.isDue(daily, { lastAutomaticAt: '2026-11-08T18:05:00.000Z' }, NOW), false);
    assert.equal(iso(schedule.nextDueAt(daily, { lastAutomaticAt: '2026-11-08T18:05:00.000Z' }, NOW)), '2026-11-09T18:00:00.000Z');
    assert.equal(schedule.isDue(daily, { lastAutomaticAt: '2026-11-07T18:05:00.000Z' }, new Date('2026-11-08T18:00:00.000Z')), true, 'due on the minute');

    const weekly = { ...daily, frequency: 'weekly', weekday: 1, time: '09:00' };
    assert.equal(schedule.isDue(weekly, {}, NOW), true, 'Monday 09:00 has passed');
    const mondayMorning = new Date('2026-11-09T00:30:00.000Z'); // 08:30, before this week's run
    assert.equal(iso(schedule.lastScheduledAt(weekly, mondayMorning)), '2026-11-02T01:00:00.000Z');
    assert.equal(schedule.isDue(weekly, { lastAutomaticAt: '2026-11-02T01:05:00.000Z' }, mondayMorning), false);
    assert.equal(iso(schedule.nextDueAt(weekly, { lastAutomaticAt: '2026-11-02T01:05:00.000Z' }, mondayMorning)), '2026-11-09T01:00:00.000Z');
    assert.equal(iso(schedule.nextScheduledAt({ ...weekly, weekday: 0 }, NOW)), '2026-11-15T01:00:00.000Z', 'Sunday is 0');
});

test('custom: every N days after the last run, or after it was switched on', () => {
    const custom = { ...MONTHLY, frequency: 'custom', everyDays: 7, enabledAt: '2026-11-01T00:00:00.000Z' };
    assert.equal(schedule.isDue(custom, {}, NOW), true, '8 days after it was switched on');
    assert.equal(schedule.isDue(custom, { lastAutomaticAt: '2026-11-05T00:00:00.000Z' }, NOW), false);
    assert.equal(iso(schedule.nextDueAt(custom, { lastAutomaticAt: '2026-11-05T00:00:00.000Z' }, NOW)), '2026-11-12T00:00:00.000Z');
    assert.equal(iso(schedule.nextDueAt({ ...custom, time: '03:00' }, { lastAutomaticAt: '2026-11-05T00:00:00.000Z' }, NOW)), '2026-11-11T19:00:00.000Z', '12 Nov at 03:00 in Singapore');
});

test('custom: switched off and on again, it counts from the switch-on, not from an older run', () => {
    // ran on 20 Oct, then automatic archiving was off until 8 Nov
    const custom = { ...MONTHLY, frequency: 'custom', everyDays: 7, enabledAt: '2026-11-08T00:00:00.000Z' };
    const oldRun = { lastAutomaticAt: '2026-10-20T00:00:00.000Z' };
    assert.equal(schedule.isDue(custom, oldRun, NOW), false, 'switching it back on never fires at once');
    assert.equal(iso(schedule.nextDueAt(custom, oldRun, NOW)), '2026-11-15T00:00:00.000Z', '7 days after the switch-on');
    assert.equal(schedule.isDue(custom, oldRun, new Date('2026-11-15T00:00:00.000Z')), true);
    assert.equal(schedule.periodKey(custom, oldRun, NOW), '2026-11-15T00:00:00.000Z', 'failed attempts are counted for that same day');
    assert.equal(iso(schedule.nextDueAt(custom, { lastAutomaticAt: '2026-11-09T01:00:00.000Z' }, NOW)), '2026-11-16T01:00:00.000Z', 'a run after the switch-on counts from that run');
});

test('a failed automatic run is tried again after an hour, at most 3 times per period', () => {
    const key = schedule.periodKey(MONTHLY, {}, NOW);
    let state = schedule.afterFailure({}, key, NOW);
    assert.equal(state.failures.count, 1);
    assert.equal(schedule.isDue(MONTHLY, state, NOW), false, 'waits an hour');
    assert.equal(iso(schedule.nextDueAt(MONTHLY, state, NOW)), '2026-11-09T07:32:00.000Z');
    const later = new Date(NOW.getTime() + schedule.RETRY_AFTER_MS);
    assert.equal(schedule.isDue(MONTHLY, state, later), true);
    state = schedule.afterFailure(schedule.afterFailure(state, key, later), key, later);
    assert.equal(state.failures, null);
    assert.equal(state.lastAutomaticAt, later.toISOString(), 'third failure: this period is given up');
    assert.equal(schedule.isDue(MONTHLY, state, new Date(later.getTime() + 2 * schedule.RETRY_AFTER_MS)), false);
});

test('filesExpired counts calendar months and 0 keeps files forever', () => {
    const keep = (amount, unit) => ({ amount, unit });
    assert.equal(schedule.filesExpired(keep(0, 'years'), '2000-01-01T00:00:00Z', NOW), false);
    assert.equal(schedule.filesExpired(keep(1, 'years'), '2025-11-01T00:00:00Z', NOW), true);
    assert.equal(schedule.filesExpired(keep(1, 'years'), '2025-11-10T00:00:00Z', NOW), false);
    assert.equal(schedule.filesExpired(keep(6, 'months'), '2026-05-08T00:00:00Z', NOW), true);
    assert.equal(schedule.filesExpired(keep(6, 'months'), '2026-05-10T00:00:00Z', NOW), false);
    assert.equal(schedule.filesExpired(keep(6, 'months'), '2026-08-31T00:00:00Z', new Date('2027-02-28T01:00:00Z')), true, '31 Aug + 6 months = 28 Feb');
    assert.equal(schedule.filesExpired(keep(1, 'years'), null, NOW), false);
    assert.equal(schedule.filesExpired(keep(1, 'years'), 'not a date', NOW), false);
});

test('filesExpired: a file stays until the moment its keep period ends (finished_at comes from MySQL as a Date)', () => {
    const yearAgo = new Date('2025-11-09T06:32:00.000Z'); // exactly 1 year before NOW
    const later = new Date(NOW.getTime() + 1000);
    assert.equal(schedule.filesExpired({ amount: 1, unit: 'years' }, yearAgo, NOW), false);
    assert.equal(schedule.filesExpired({ amount: 1, unit: 'years' }, yearAgo, later), true);
    assert.equal(schedule.filesExpired({ amount: 12, unit: 'months' }, yearAgo, later), true, '12 months is the same as 1 year');
    assert.equal(schedule.filesExpired({ amount: 0, unit: 'months' }, yearAgo, later), false, '0 months keeps files forever too');
});

test('resolveUploadPath takes both stored path shapes and never leaves uploads/', () => {
    assert.equal(files.resolveUploadPath('photos/a.png'), path.join(paths.UPLOADS, 'photos', 'a.png'));
    assert.equal(files.resolveUploadPath('processed/b_processed.gif'), path.join(paths.UPLOADS, 'processed', 'b_processed.gif'));
    assert.equal(files.resolveUploadPath('/uploads/lost-found/c.jpg'), path.join(paths.UPLOADS, 'lost-found', 'c.jpg'));
    assert.equal(files.resolveUploadPath('photos\\d.png'), path.join(paths.UPLOADS, 'photos', 'd.png'));
    for (const bad of ['photos/../../package.json', '../package.json', '/uploads/../backend/server.js', 'photos/../..', '/uploads/', '', '   ', null, 42]) {
        assert.equal(files.resolveUploadPath(bad), null, String(bad));
    }
    if (process.platform === 'win32') assert.equal(files.resolveUploadPath('C:/Windows/win.ini'), null);
});

test('planPhotos lists missing files and never reads a path outside uploads/', async () => {
    const plan = await files.planPhotos(
        [
            { id: 1, photo_path: `photos/va-unit-missing-${Date.now()}.png`, processed_photo_path: null, data_retention: 'longterm' },
            { id: 2, photo_path: 'photos/../../package.json', processed_photo_path: '', data_retention: 'longterm' }
        ],
        [{ id: 3, item_photo_path: '/uploads/lost-found/va-unit-missing.png' }],
        true
    );
    assert.equal(plan.photos.length, 0, 'package.json exists, but it is not an upload');
    assert.deepEqual(plan.missing.map((m) => `${m.table}:${m.id}:${m.column}`), ['feedback:1:photo_path', 'feedback:2:photo_path', 'lost_found_reports:3:item_photo_path']);
    assert.ok(plan.sources.every((source) => source.entry === null));
});

test('planPhotos leaves temporary-consent and switched-off photos out of the zip but still lists them for deletion', async () => {
    const uploads = fs.mkdtempSync(path.join(TMP, 'uploads-'));
    for (const [folder, name, size] of [['photos', 'a.png', 10], ['processed', 'a.png', 20], ['photos', 'b.png', 30], ['lost-found', 'c.jpg', 40]]) {
        fs.mkdirSync(path.join(uploads, folder), { recursive: true });
        fs.writeFileSync(path.join(uploads, folder, name), Buffer.alloc(size));
    }
    const feedback = [
        { id: 1, photo_path: 'photos/a.png', processed_photo_path: 'processed/a.png', data_retention: 'longterm' },
        { id: 2, photo_path: 'photos/b.png', processed_photo_path: null, data_retention: '7days' }
    ];
    const lostFound = [{ id: 3, item_photo_path: '/uploads/lost-found/c.jpg' }];
    const original = paths.UPLOADS;
    paths.UPLOADS = uploads; // a temp uploads folder for this test only
    try {
        const plan = await files.planPhotos(feedback, lostFound, true);
        assert.deepEqual(plan.photos.map((p) => p.entry), ['photos/feedback/1-raw.png', 'photos/feedback/1-processed.png', 'photos/lost-found/3.jpg']);
        assert.equal(plan.temporaryTrimmed, 1);
        assert.deepEqual([plan.onDisk, plan.onDiskBytes, plan.includedBytes], [4, 100, 70]);
        assert.equal(plan.sources.length, 4, 'every photo still goes with its record');
        const off = await files.planPhotos(feedback, lostFound, false);
        assert.deepEqual([off.photos.length, off.temporaryTrimmed, off.sources.length, off.onDisk], [0, 0, 4, 4]);
    } finally {
        paths.UPLOADS = original;
    }
});

test('checkFolder refuses relative and web-served folders and accepts a temp folder', async () => {
    assert.match((await files.checkFolder('archives')).problem, /full folder path/);
    for (const served of [path.join(paths.FRONTEND, 'archives'), path.join(paths.UPLOADS, 'archives'), paths.UPLOADS]) {
        assert.match((await files.checkFolder(served)).problem, /served by the web server/, served);
    }
    assert.match((await files.checkFolder(path.join(paths.ROOT, 'backend', 'archives'))).problem, /outside the app folder/);
    assert.equal(files.folderProblem(path.join(paths.DATA, 'archives')), null, 'the default folder is allowed');

    const temp = await files.checkFolder(TMP);
    assert.equal(temp.problem, null);
    assert.equal(temp.exists, true);
    assert.equal(temp.writable, true);
    assert.ok(temp.freeBytes > 0 && temp.totalBytes >= temp.freeBytes);

    const notYet = path.join(TMP, 'not-made-yet', 'archives');
    const planned = await files.checkFolder(notYet);
    assert.equal(planned.problem, null);
    assert.equal(planned.exists, false);
    assert.equal(planned.willCreate, true);
    assert.equal(fs.existsSync(notYet), false, 'checking a folder never creates it');

    const aFile = path.join(TMP, 'not-a-folder.txt');
    fs.writeFileSync(aFile, 'x');
    assert.match((await files.checkFolder(aFile)).problem, /file, not a folder/);
    const byDefault = await files.checkFolder('');
    assert.equal(byDefault.isDefault, true);
    assert.equal(byDefault.path, files.DEFAULT_FOLDER);
});

test('network folders are refused wherever a folder is checked', async () => {
    const network = 'Choose a folder on this PC or on a drive plugged into it. Network folders are not supported.';
    for (const folder of ['\\\\server\\share\\archives', '//server/share/archives', '\\\\?\\C:\\archives', '\\\\.\\C:\\archives', '  \\\\nas\\backup  ']) {
        assert.equal(files.folderTextProblem(folder), network, folder);
        assert.deepEqual(check({ folder }), { error: network, field: 'folder' }, folder);
        assert.equal((await files.checkFolder(folder)).problem, network, folder);
    }
});

test('archive file names and photo entry names are made by the server', () => {
    const dir = fs.mkdtempSync(path.join(TMP, 'names-'));
    assert.equal(files.pickArchiveName(dir, NOW), 'visitor-archive-2026-11-09-1432.zip');
    fs.writeFileSync(path.join(dir, 'visitor-archive-2026-11-09-1432.zip.partial'), '');
    assert.equal(files.pickArchiveName(dir, NOW), 'visitor-archive-2026-11-09-1432-2.zip', 'a leftover partial file counts as taken');
    assert.equal(files.pickArchiveName(dir, NOW, ['VISITOR-ARCHIVE-2026-11-09-1432-2.zip']), 'visitor-archive-2026-11-09-1432-3.zip', 'names in the history count too');
    const listing = ['visitor-archive-2026-11-09-1432.zip.sha256'];
    assert.equal(files.pickArchiveName(path.join(TMP, 'not-made'), NOW, [], listing), 'visitor-archive-2026-11-09-1432-2.zip', 'a run passes the folder listing it read itself');

    assert.equal(files.photoEntryName('feedback', 5, 'photo_path', 'photos/Visitor_kiosk.PNG'), 'photos/feedback/5-raw.png');
    assert.equal(files.photoEntryName('feedback', 5, 'processed_photo_path', 'processed/x_processed.gif'), 'photos/feedback/5-processed.gif');
    assert.equal(files.photoEntryName('lost_found_reports', 7, 'item_photo_path', '/uploads/lost-found/umbrella_1.jpeg'), 'photos/lost-found/7.jpeg');
    assert.equal(files.photoEntryName('feedback', 5, 'photo_path', 'photos/no-extension'), 'photos/feedback/5-raw.bin');
    assert.equal(files.photoEntryName('feedback', 5, 'photo_path', 'photos/odd.toolong'), 'photos/feedback/5-raw.bin');
});

test('CSV cells are quoted, formulas are neutralised and the file starts with a BOM', () => {
    assert.equal(files.csvCell('plain'), '"plain"');
    assert.equal(files.csvCell('say "hi"'), '"say ""hi"""');
    for (const risky of ['=1+1', '+65 1234', '-2', '@SUM(A1)', '\tx', '\rx']) assert.equal(files.csvCell(risky), `"'${risky}"`, JSON.stringify(risky));
    assert.equal(files.csvCell(0), '"0"');
    assert.equal(files.csvCell(-5), '"-5"', 'numbers are not text, so they stay numbers');
    assert.equal(files.csvCell(null), '""');
    assert.equal(files.csvCell(undefined), '""');
    assert.equal(files.csvCell(new Date('2026-11-09T06:32:00Z')), '"2026-11-09T06:32:00.000Z"');
    assert.equal(files.toCsv(['ID', 'Pledge'], [[1, '=cmd'], [2, 'ok']]), '\uFEFF"ID","Pledge"\r\n"1","\'=cmd"\r\n"2","ok"\r\n');
});

const CREATED = new Date('2024-01-02T03:04:05.000Z');
// made up, and low entropy so the gitleaks scan in CI leaves it alone
const FINGERPRINT = 'f00df00df00df00d';
const META = {
    archiveId: 77, createdAt: NOW, createdBy: 'systemadmin', trigger: 'manual',
    criteria: { types: ['feedback', 'lostFound'], feedbackBefore: new Date('2025-11-08T16:00:00Z'), lostFoundBefore: new Date('2025-11-08T16:00:00Z'), onlyResolved: false },
    photosIncluded: true, deleteAfterArchive: true, encryption: { keyFingerprint: FINGERPRINT, developmentKey: false }
};
const ENTRY_NAMES = ['README.txt', 'data/visitors.json', 'data/feedback.json', 'data/lost-found.json', 'data/questions.json', 'csv/feedback.csv',
    'csv/answers.csv', 'csv/lost-found.csv', 'photos/feedback/5-raw.png', 'photos/feedback/5-processed.jpg', 'manifest.json'];
const fakeEncrypt = (text) => `enc:${Buffer.from(text).toString('hex')}`;

// one visitor with two submissions (only one goes in), one lost & found report and two photo files
// (includePhotos false: the photos still go with the records, but none of them is put in the zip)
function makeSelection({ includePhotos = true } = {}) {
    const dir = fs.mkdtempSync(path.join(TMP, 'zip-'));
    const photo = { raw: path.join(dir, 'raw.png'), processed: path.join(dir, 'processed.jpg') };
    fs.writeFileSync(photo.raw, Buffer.alloc(5000, 7));
    fs.writeFileSync(photo.processed, Buffer.alloc(3000, 9));
    const raw = {
        feedback: [{ id: 5, user_id: 9, comment: '=HYPERLINK("x")', metadata: JSON.stringify({ pledgeTopics: ['Energy', 'Water'] }), photo_path: 'photos/raw.png',
            processed_photo_path: 'processed/processed.jpg', data_retention: 'longterm', is_active: 1, archive_status: 'archived', created_at: CREATED }],
        answers: [{ id: 1, feedback_id: 5, question_id: 3, answer_value: '2', created_at: CREATED, question_text: 'Which topic?', question_type: 'choice', option_label: 'Renewable Energy' }],
        likes: [{ id: 4, feedback_id: 5, user_identifier: 'user_1', created_at: CREATED }],
        users: [{ id: 9, name: 'Test Visitor', email_encrypted: 'aa:bb:cc', visit_count: 2, created_at: CREATED, last_visit: CREATED }],
        userTotals: new Map([[9, { total: 2, temporary: 0 }]]),
        orphanIds: [],
        lostFound: [{ id: 3, tracking_code: 'LF-00003', report_type: 'lost', item_description: 'Umbrella', location_text: 'Hall', contact_info: 'owner@example.com',
            details: null, item_photo_path: null, feedback_progress: '{"email":"owner@example.com"}', status: 'new', created_at: CREATED, updated_at: CREATED }],
        questions: [{ id: 3, question_text: 'Which topic?', question_type: 'choice', is_active: 1 }],
        options: [{ id: 2, question_id: 3, option_label: 'Renewable Energy', display_order: 2 }]
    };
    const plan = {
        sources: [
            { entry: 'photos/feedback/5-raw.png', table: 'feedback', id: 5, column: 'photo_path', path: 'photos/raw.png' },
            { entry: 'photos/feedback/5-processed.jpg', table: 'feedback', id: 5, column: 'processed_photo_path', path: 'processed/processed.jpg' }
        ],
        photos: [{ entry: 'photos/feedback/5-raw.png', file: photo.raw, size: 5000 }, { entry: 'photos/feedback/5-processed.jpg', file: photo.processed, size: 3000 }],
        missing: [], onDisk: 2, onDiskBytes: 8000, includedBytes: 8000, temporaryTrimmed: 0
    };
    if (!includePhotos) Object.assign(plan, { sources: plan.sources.map((s) => ({ ...s, entry: null })), photos: [], includedBytes: 0 });
    return { dir, photo, selection: writer.buildSelection(raw, plan, { encrypt: fakeEncrypt }) };
}

async function makeArchive({ meta = META, includePhotos = true } = {}) {
    const made = makeSelection({ includePhotos });
    const file = path.join(made.dir, 'archive.zip.partial');
    const progress = [];
    const written = await writer.writeArchive(made.selection, meta, file, (p) => progress.push(p));
    return { ...made, file, written, progress };
}

// an archive made with these choices, its entry names and its README.txt
async function archiveWith(choices) {
    const made = await makeArchive({ meta: { ...META, ...choices }, includePhotos: choices.photosIncluded !== false });
    const handle = await zip.openZip(made.file);
    try {
        const entries = await zip.listEntries(handle);
        return { ...made, names: [...entries.keys()], readme: (await zip.readEntry(handle, entries.get('README.txt'))).toString('utf8') };
    } finally {
        handle.close();
    }
}

// copies a zip without one of its entries; the manifest still lists it
async function copyWithout(from, to, skip) {
    const handle = await zip.openZip(from);
    const parts = [];
    try {
        for (const [name, entry] of await zip.listEntries(handle)) if (name !== skip) parts.push([name, await zip.readEntry(handle, entry)]);
    } finally {
        handle.close();
    }
    const archive = zip.createZipArchive();
    const done = pipeline(archive, fs.createWriteStream(to));
    for (const [name, buffer] of parts) archive.append(buffer, { name });
    await Promise.all([archive.finalize(), done]);
}

test('buildSelection: who stays in the database, what gets encrypted, what temporary consent leaves out', () => {
    const { selection } = makeSelection();
    assert.deepEqual(selection.counts, { visitors: 1, visitorsKept: 1, visitorsDeleted: 0, feedback: 1, answers: 1, likes: 1, lostFound: 1, photos: 2, missingPhotos: 0, temporaryTrimmed: 0 });
    assert.deepEqual(selection.ids, { feedback: [5], visitors: [9], visitorsDeleted: [], lostFound: [3] });
    const report = selection.records.lostFound[0];
    assert.equal('contact_info' in report || 'feedback_progress' in report, false, 'plain contact details are never kept');
    assert.equal(report.contact_info_encrypted, fakeEncrypt('owner@example.com'));
    assert.equal(report.feedback_progress_encrypted, fakeEncrypt('{"email":"owner@example.com"}'));
    assert.deepEqual(selection.records.feedback[0].answers.map((a) => [a.answer_value, a.answer_text]), [['2', 'Renewable Energy']]);

    const legacy = writer.buildSelection({
        feedback: [{ id: 6, user_id: 10, comment: 'x', data_retention: 'temporary', created_at: CREATED }],
        answers: [], likes: [],
        users: [{ id: 10, name: 'Old Visitor', email_encrypted: 'dd:ee:ff' }, { id: 11, name: 'No Feedback', email_encrypted: null }],
        userTotals: new Map([[10, { total: 1, temporary: 1 }]]),
        orphanIds: [11],
        lostFound: [{ id: 4, contact_info: 'x', feedback_progress: null, created_at: CREATED }],
        questions: [], options: []
    }, { sources: [], photos: [], missing: [], onDisk: 1, onDiskBytes: 10, includedBytes: 0, temporaryTrimmed: 1 });
    assert.deepEqual(legacy.ids.visitorsDeleted, [10, 11]);
    assert.equal(legacy.records.visitors[0].email_encrypted, null, 'temporary consent only: the email is not kept');
    assert.equal(legacy.counts.temporaryTrimmed, 2, 'one photo and one email');
    assert.equal('contact_info_encrypted' in legacy.records.lostFound[0] || 'contact_info' in legacy.records.lostFound[0], false, 'a preview has no contact details at all');
});

test('buildSelection keeps a visitor seen at or after the guard, the same rule as the users DELETE', () => {
    const guard = new Date('2025-11-08T16:00:00.000Z');
    const before = new Date(guard.getTime() - 1000);
    const visitor = (id, lastVisit, createdAt = CREATED) => ({ id, name: `Visitor ${id}`, email_encrypted: null, visit_count: 1, created_at: createdAt, last_visit: lastVisit });
    const raw = {
        // each visitor's only submission is in this archive, so only the guard can keep them
        feedback: [1, 2, 3, 4].map((id) => ({ id: 100 + id, user_id: id, comment: 'x', data_retention: 'longterm', created_at: CREATED })),
        answers: [], likes: [],
        // 3 came back to the kiosk while the zip was being written; 4 has no last visit, so the day they were added counts
        users: [visitor(1, before), visitor(2, guard), visitor(3, new Date('2026-11-09T06:31:30.000Z')), visitor(4, null, guard), visitor(5, before)],
        userTotals: new Map([1, 2, 3, 4].map((id) => [id, { total: 1, temporary: 0 }])),
        orphanIds: [5],
        lostFound: [], questions: [], options: [], guard
    };
    const noPhotos = { sources: [], photos: [], missing: [], onDisk: 0, onDiskBytes: 0, includedBytes: 0, temporaryTrimmed: 0 };
    const selection = writer.buildSelection(raw, noPhotos);
    assert.deepEqual(selection.ids.visitorsDeleted, [1, 5], 'only the visitors last seen before the guard are deleted');
    assert.deepEqual(selection.records.visitors.map((v) => v.keptInDatabase), [false, true, true, true, false]);
    assert.deepEqual([selection.counts.visitorsKept, selection.counts.visitorsDeleted, selection.counts.feedback], [3, 2, 4], 'their feedback is still archived');
    assert.deepEqual(writer.buildSelection({ ...raw, guard: undefined }, noPhotos).ids.visitorsDeleted, [1, 2, 3, 4, 5], 'without a guard only their feedback decides');
});

test('writer round trip: the zip passes the check, manifest.json comes last and photos are stored as they are', async () => {
    const { file, written, progress, selection } = await makeArchive();
    const bytes = fs.readFileSync(file);
    assert.equal(written.size, bytes.length);
    assert.equal(written.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'PK\x03\x04');
    const last = progress[progress.length - 1];
    assert.equal(last.processedEntries, last.totalEntries);

    const result = await writer.verifyArchive(file, { ids: selection.ids });
    assert.deepEqual(result.problems, []);
    assert.equal(result.ok, true);
    assert.equal(result.checkedEntries, ENTRY_NAMES.length - 1);

    const handle = await zip.openZip(file);
    try {
        const entries = await zip.listEntries(handle);
        assert.deepEqual([...entries.keys()], ENTRY_NAMES);
        for (const [name, entry] of entries) assert.equal(entry.compressionMethod, name.startsWith('photos/') ? 0 : 8, name);
        const csv = (await zip.readEntry(handle, entries.get('csv/feedback.csv'))).toString('utf8');
        assert.ok(csv.startsWith('\uFEFF"Feedback ID"'));
        assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
    } finally {
        handle.close();
    }

    const data = await writer.readArchiveData(file);
    assert.equal(data.manifest.archiveId, 77);
    assert.equal(data.manifest.encryption.keyFingerprint, FINGERPRINT);
    assert.deepEqual(data.feedback[0].photos, { raw: 'photos/feedback/5-raw.png', processed: 'photos/feedback/5-processed.jpg' });
    assert.equal(data.visitors[0].keptInDatabase, true);
    assert.equal(data.visitors[0].email_encrypted, 'aa:bb:cc', 'emails are copied as they are, never decrypted');
    assert.equal(JSON.stringify(data).includes('owner@example.com'), false);

    const wrongIds = await writer.verifyArchive(file, { ids: { ...selection.ids, feedback: [6] } });
    assert.equal(wrongIds.ok, false);
    assert.match(wrongIds.problems.join(' '), /feedback ids in the archive are not the records that were selected/);
});

test('README.txt says what was chosen: delete or export only, photos kept or not', async () => {
    const deleting = await archiveWith({});
    assert.ok(deleting.readme.includes('This archive was made with "Delete the records from the database" switched on: the records were to be deleted after this file passed its check.'));
    assert.ok(deleting.readme.includes('- 1 visitor (1 to stay in the database because of newer feedback or a recent visit)\r\n'));
    assert.ok(deleting.readme.includes('- 2 photos\r\n'));
    assert.ok(deleting.readme.includes('- photos/'));

    const exportOnly = await archiveWith({ deleteAfterArchive: false });
    assert.ok(exportOnly.readme.includes('This archive was made as an export only: the records stayed in the database.'));
    assert.ok(exportOnly.readme.includes('- 1 visitor\r\n'), 'nobody "stays" when nothing is deleted');
    assert.equal(exportOnly.readme.includes('Delete the records'), false);

    const noPhotos = await archiveWith({ photosIncluded: false });
    assert.ok(noPhotos.readme.includes('- No photos: they were not kept in the zip (they were deleted with the records)\r\n'));
    assert.equal(noPhotos.readme.includes('- photos/'), false, 'no photos/ folder line');
    assert.deepEqual(noPhotos.names.filter((name) => name.startsWith('photos/')), []);
    assert.equal((await writer.verifyArchive(noPhotos.file, { ids: noPhotos.selection.ids })).ok, true);

    const exportNoPhotos = await archiveWith({ photosIncluded: false, deleteAfterArchive: false });
    assert.ok(exportNoPhotos.readme.includes('- No photos: they were not kept in the zip (they stayed on the server with the records)\r\n'));
});

test('verify fails when one byte of a photo changes', async () => {
    const { dir, file } = await makeArchive();
    const bytes = fs.readFileSync(file);
    const at = bytes.indexOf(Buffer.alloc(64, 7)); // inside the stored raw photo
    assert.ok(at > 0);
    bytes[at + 10] ^= 0xff;
    const flipped = path.join(dir, 'flipped.zip');
    fs.writeFileSync(flipped, bytes);
    const result = await writer.verifyArchive(flipped);
    assert.equal(result.ok, false);
    assert.match(result.problems.join(' '), /photos\/feedback\/5-raw\.png/);
});

test('verify finds an entry the manifest lists but the zip does not hold', async () => {
    const { dir, file } = await makeArchive();
    const short = path.join(dir, 'short.zip');
    await copyWithout(file, short, 'photos/feedback/5-processed.jpg');
    const result = await writer.verifyArchive(short);
    assert.equal(result.ok, false);
    assert.ok(result.problems.includes('photos/feedback/5-processed.jpg is missing from the zip.'), result.problems.join(' | '));
    assert.ok(result.problems.includes(`The zip holds ${ENTRY_NAMES.length - 1} entries but the manifest lists ${ENTRY_NAMES.length}.`));
});

test('a photo deleted while the zip is being written fails the write and removes the partial file', async () => {
    const { dir, photo, selection } = makeSelection();
    const partial = path.join(dir, 'archive.zip.partial');
    let deleted = false;
    const onProgress = (p) => {
        // the first photo has just gone in: take the second one away before it is read
        if (!deleted && p.processedEntries === p.totalEntries - 2) {
            fs.unlinkSync(photo.processed);
            deleted = true;
        }
    };
    await assert.rejects(writer.writeArchive(selection, META, partial, onProgress), /5-processed\.jpg could not be read/);
    assert.equal(deleted, true);
    assert.equal(fs.existsSync(partial), false);
});

test('verify refuses a file that is not a zip', async () => {
    const junk = path.join(TMP, 'junk.zip');
    fs.writeFileSync(junk, 'not a zip at all');
    const result = await writer.verifyArchive(junk);
    assert.equal(result.ok, false);
    assert.match(result.problems[0], /not a readable zip/);
});

test('readJsonEntry refuses an entry over 256 MB before reading any of it', async () => {
    const huge = { fileName: 'data/feedback.json', uncompressedSize: 256 * 1024 * 1024 + 1 };
    await assert.rejects(zip.readJsonEntry(null, huge), /data\/feedback\.json is too large to open \(over 256 MB\)/);
});

test('a disk that fails while the zip is written stops the write at once and removes the partial file', { timeout: 15000 }, async (t) => {
    const { dir, selection } = makeSelection();
    // four more 64 KB photos, so the zip stream still has data to push after the disk fails
    const photos = [...selection.photos];
    for (let i = 1; i <= 4; i++) {
        const file = path.join(dir, `extra-${i}.png`);
        fs.writeFileSync(file, crypto.randomBytes(64 * 1024));
        photos.push({ entry: `photos/feedback/${100 + i}-raw.png`, file, size: 64 * 1024 });
    }
    let failAfter = 0;
    const realCreate = fs.createWriteStream;
    t.mock.method(fs, 'createWriteStream', (file, options) => {
        const stream = realCreate.call(fs, file, options);
        const full = () => Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' });
        let written = 0;
        const write = stream._write.bind(stream);
        stream._write = (chunk, encoding, callback) => {
            written += chunk.length;
            if (written > failAfter) return callback(full());
            write(chunk, encoding, callback);
        };
        if (stream._writev) {
            const writev = stream._writev.bind(stream);
            stream._writev = (chunks, callback) => {
                written += chunks.reduce((n, c) => n + c.chunk.length, 0);
                if (written > failAfter) return callback(full());
                writev(chunks, callback);
            };
        }
        return stream;
    });
    // the disk fails almost at once, then after a few KB
    for (const limit of [100, 5000]) {
        failAfter = limit;
        const partial = path.join(dir, `disk-full-${limit}.zip.partial`);
        await assert.rejects(writer.writeArchive({ ...selection, photos }, META, partial), /ENOSPC/, `full after ${limit} bytes`);
        assert.equal(fs.existsSync(partial), false);
    }
});
// <Jun Kai end>
