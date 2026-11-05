// Owner: Role 3, Jun Kai.
// Time ranges of the Hardware graphs: the presets (1h, 6h, 24h, 7d, 30d) and custom ones such as 12h, 10d, 3w,
// 6mo or 2y, from 1 hour up to 5 years. Months and years follow the calendar. Pure functions, unit-tested in
// tests/unit/ranges.test.js.
// <Jun Kai start>
const UNIT_SECONDS = { h: 3600, d: 86400, w: 7 * 86400 };
const MAX_MONTHS = 60;
const MAX_POINTS = 200;
// averaging buckets, smallest first: a range uses the first one that keeps it under MAX_POINTS points
const BUCKETS = [60, 300, 600, 1800, 3600, 2 * 3600, 4 * 3600, 6 * 3600, 12 * 3600, 86400, 2 * 86400, 4 * 86400, 7 * 86400, 14 * 86400, 30 * 86400];

// The same day n months earlier, or the last day of that month when it is shorter (31 Mar minus 1 month = 28 Feb)
function monthsBack(date, n) {
    const d = new Date(date.getTime());
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() - n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return d;
}

// "3mo" -> { key, amount, unit, seconds, bucketSeconds }, or null when it is not a range from 1 hour to 5 years
function parse(key, now = new Date()) {
    const m = /^(\d{1,5})(h|d|w|mo|y)$/.exec(String(key === undefined || key === null ? '' : key));
    if (!m) return null;
    const amount = Number(m[1]);
    const unit = m[2];
    if (amount < 1) return null;
    const from = unit === 'mo' ? monthsBack(now, amount)
        : unit === 'y' ? monthsBack(now, amount * 12)
            : new Date(now.getTime() - amount * UNIT_SECONDS[unit] * 1000);
    if (from < monthsBack(now, MAX_MONTHS)) return null;
    const seconds = Math.round((now.getTime() - from.getTime()) / 1000);
    const bucketSeconds = BUCKETS.find((b) => seconds / b <= MAX_POINTS) || BUCKETS[BUCKETS.length - 1];
    return { key: `${amount}${unit}`, amount, unit, seconds, bucketSeconds };
}

module.exports = { parse, monthsBack, MAX_MONTHS, MAX_POINTS };
// <Jun Kai end>
