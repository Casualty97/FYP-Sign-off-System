// Owner: Role 3, Jun Kai.
// Unit tests for the hardware forecast maths. Run: npm run test:unit  (node --test tests/unit)
// <Jun Kai start>
const test = require('node:test');
const assert = require('node:assert/strict');
const forecast = require('../../backend/features/hardware/forecast');

test('holtForecast follows a straight upward line and clamps at 100', () => {
    const values = Array.from({ length: 24 }, (_, i) => 10 + i * 2); // 10, 12, ... 56
    const result = forecast.holtForecast(values, 30);
    assert.equal(result.points.length, 30);
    assert.ok(Math.abs(result.points[0].value - 58) < 1.5, `first step ${result.points[0].value} should be close to 58`);
    assert.ok(result.points[9].value > result.points[0].value, 'keeps rising');
    assert.equal(result.points[29].value, 100, 'never above 100');
    assert.ok(result.points[0].low <= result.points[0].value && result.points[0].value <= result.points[0].high);
});

test('holtForecast of a flat series stays flat with a zero band', () => {
    const result = forecast.holtForecast(Array(12).fill(42), 6);
    for (const p of result.points) assert.equal(p.value, 42);
    assert.equal(result.rmse, 0);
});

test('holtForecast needs at least 6 readings and ignores nulls', () => {
    assert.equal(forecast.holtForecast([1, 2, 3], 5), null);
    assert.equal(forecast.holtForecast([null, null, 1, 2, 3, 4, 5], 5), null);
    assert.ok(forecast.holtForecast([null, 1, 2, 3, 4, 5, 6], 5));
});

test('linearTrend recovers slope and intercept', () => {
    const points = Array.from({ length: 10 }, (_, i) => ({ t: 1000 + i * 60000, v: 5 + i * 3 }));
    const fit = forecast.linearTrend(points);
    assert.ok(Math.abs(fit.slope - 3 / 60000) < 1e-9);
    assert.ok(Math.abs(fit.intercept - 5) < 1e-6);
    assert.equal(forecast.linearTrend([{ t: 1, v: 1 }]), null);
});

test('diskForecast reports growth per day and days until full', () => {
    const day = 86400000;
    const points = Array.from({ length: 8 }, (_, i) => ({ t: i * day, v: 100 + i * 2 })); // +2 GB a day
    const result = forecast.diskForecast(points, 200);
    assert.equal(result.gbPerDay, 2);
    assert.equal(result.daysUntilFull, 43); // (200 - 114) / 2
    const flat = forecast.diskForecast(points.map((p) => ({ t: p.t, v: 100 })), 200);
    assert.equal(flat.daysUntilFull, null);
});

test('bucketAverage averages into fixed buckets and skips nulls', () => {
    const rows = [{ t: 0, cpu: 10 }, { t: 30000, cpu: 20 }, { t: 60000, cpu: null }, { t: 90000, cpu: 40 }];
    const out = forecast.bucketAverage(rows, 60000, ['cpu']);
    assert.deepEqual(out, [{ t: 0, n: 2, cpu: 15 }, { t: 60000, n: 2, cpu: 40 }]);
});

// deterministic noise so the test never flakes
function noise(seed) {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 - 0.5; };
}

test('a steady load with noise forecasts close to its average, with a band that widens', () => {
    const rnd = noise(7);
    const values = Array.from({ length: 144 }, () => 20 + rnd() * 6); // 20 % plus or minus 3
    const result = forecast.holtForecast(values, 144);
    const end = result.points[143];
    assert.ok(Math.abs(end.value - 20) < 5, `24 h ahead should stay near 20, got ${end.value}`);
    assert.ok(result.rmse > 0 && result.rmse < 4, `rmse ${result.rmse}`);
    assert.ok(end.high - end.low > result.points[0].high - result.points[0].low, 'band widens with the horizon');
    assert.ok(end.low < end.value && end.value < end.high);
});

test('a noisy rising line keeps its slope', () => {
    const rnd = noise(11);
    const values = Array.from({ length: 144 }, (_, i) => 30 + i * 0.2 + rnd() * 2);
    const result = forecast.holtForecast(values, 60);
    const slope = (result.points[59].value - result.points[0].value) / 59;
    assert.ok(Math.abs(slope - 0.2) < 0.08, `slope ${slope} should be close to 0.2`);
});

test('holtForecast uses only the unbroken run of readings after a gap', () => {
    const tail = [40, 41, 42, 43, 44, 45];
    const withGap = [10, 12, 14, 16, null, ...tail];
    assert.deepEqual(forecast.holtForecast(withGap, 3), forecast.holtForecast(tail, 3));
});

test('diskForecast reports a shrinking disk as not growing', () => {
    const day = 86400000;
    const points = Array.from({ length: 8 }, (_, i) => ({ t: i * day, v: 150 - i * 2 }));
    const result = forecast.diskForecast(points, 200);
    assert.equal(result.daysUntilFull, null);
    assert.equal(result.gbPerDay, -2);
    assert.equal(result.totalGb, 200);
});
// <Jun Kai end>
