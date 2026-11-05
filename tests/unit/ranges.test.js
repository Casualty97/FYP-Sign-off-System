// Owner: Role 3, Jun Kai.
// Unit tests for the time ranges of the Hardware graphs. Run: npm run test:unit
// <Jun Kai start>
const test = require('node:test');
const assert = require('node:assert/strict');
const ranges = require('../../backend/features/hardware/ranges');

const now = new Date(2026, 10, 6, 14, 30); // Friday 6 Nov 2026, local time
const day = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

test('the five presets keep the buckets they had before', () => {
    const buckets = Object.fromEntries(['1h', '6h', '24h', '7d', '30d'].map((key) => [key, ranges.parse(key, now).bucketSeconds]));
    assert.deepEqual(buckets, { '1h': 60, '6h': 300, '24h': 600, '7d': 3600, '30d': 4 * 3600 });
    assert.equal(ranges.parse('7d', now).seconds, 7 * 86400);
});

test('months and years follow the calendar', () => {
    const three = ranges.parse('3mo', now);
    assert.equal(day(new Date(now.getTime() - three.seconds * 1000)), '2026-8-6');
    assert.equal(three.bucketSeconds, 12 * 3600);
    const two = ranges.parse('2y', now);
    assert.equal(day(new Date(now.getTime() - two.seconds * 1000)), '2024-11-6');
    assert.equal(ranges.parse('3w', now).seconds, 21 * 86400);
    assert.equal(ranges.parse('12h', now).seconds, 12 * 3600);
});

test('a shorter month ends on its last day', () => {
    assert.equal(day(ranges.monthsBack(new Date(2027, 2, 31, 12), 1)), '2027-2-28');
    assert.equal(day(ranges.monthsBack(new Date(2028, 1, 29, 12), 12)), '2027-2-28');
    assert.equal(day(ranges.monthsBack(new Date(2026, 11, 31, 12), 2)), '2026-10-31');
});

test('ranges go from 1 hour to 5 years, written as a whole number and a unit', () => {
    assert.ok(ranges.parse('5y', now));
    assert.ok(ranges.parse('60mo', now));
    assert.ok(ranges.parse('260w', now));
    for (const bad of ['6y', '61mo', '2000d', '0d', '1.5d', '-2d', '10m', 'abc', '', '3 mo', '24H', null, undefined, ['1h', '2h']]) {
        assert.equal(ranges.parse(bad, now), null, `${JSON.stringify(bad)} is refused`);
    }
});

test('every range stays under the point limit', () => {
    for (const key of ['1h', '2h', '5h', '36h', '3d', '10d', '6w', '2mo', '7mo', '13mo', '1y', '3y', '5y', '1826d', '43824h']) {
        const r = ranges.parse(key, now);
        assert.ok(r, key);
        assert.ok(Math.ceil(r.seconds / r.bucketSeconds) <= ranges.MAX_POINTS, `${key}: ${r.seconds / r.bucketSeconds} points`);
    }
});
// <Jun Kai end>
