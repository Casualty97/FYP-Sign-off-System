// Owner: Role 3, Jun Kai.
// "Show example incidents" in the incident settings: seven made-up incidents (the ones from the approved design
// pictures) that show every part of the Incidents panel: a chart, the advice, step-by-step help, a fix waiting for
// approval, an acknowledged one and two resolved ones with verdicts. They are labelled Example on the page, their
// fingerprints start with "example:", and they never tune a detector, teach the advisor, resolve themselves or run a
// fix. "Remove example incidents" deletes them again.
// <Jun Kai start>
const { EXAMPLE_PREFIX } = require('./fixes');

const MINUTE = 60 * 1000;

function sgtClock(ms) {
    const d = new Date(ms + 8 * 60 * MINUTE);
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// n evenly spaced points ending now, stepMinutes apart, with values from f(i)
function points(nowMs, n, stepMinutes, f) {
    return Array.from({ length: n }, (_, i) => ({ t: nowMs - (n - 1 - i) * stepMinutes * MINUTE, v: Math.round(f(i) * 10) / 10 }));
}

const advice = (summary, causes, action, why) => ({ source: 'example', model: null, summary, causes: causes.map(([cause, likelihood]) => ({ cause, likelihood })), action, why, seconds: 0 });

// Oldest first, so the newest gets the highest number, as in the pictures
function exampleList(nowMs, by) {
    const ago = (minutes) => nowMs - minutes * MINUTE;
    const kioskSinceOpen = ago(4);
    const kioskSinceOld = ago(26 * 60);
    return [
        {
            key: 'errors', detector: 'logs', kind: 'burst', subject: null, severity: 'warn', status: 'resolved', opened: 300, seen: 290, occurrences: 2,
            resolved: 280, resolvedBy: by, verdict: 'false-alarm', verdictAt: 279,
            title: 'Burst of server errors: 14 in 5 minutes',
            explanation: 'The server logged 14 errors in the last 5 minutes; a usual 5 minutes has about 1.',
            evidence: { metric: 'errors', value: 14, baseline: 1, unit: '', windowSeconds: 300, process: 'server', template: 'Could not save the visitor photo: <path>', points: points(nowMs - 280 * MINUTE, 24, 5, (i) => (i === 21 ? 14 : i % 5 === 0 ? 1 : 0)) },
            events: [['opened', 300, { severity: 'warn', title: 'Burst of server errors: 14 in 5 minutes' }],
                ['advice', 299, advice('The server wrote many errors at once, all about saving a visitor photo.', [['The photo folder was full or locked for a moment', 'high'], ['A tablet sent a broken photo', 'medium']], 'review-server-log', 'The log lines say which part failed.')],
                ['resolved', 280, { by }], ['verdict', 279, { by, verdict: 'false-alarm' }]]
        },
        {
            key: 'kiosk-old', detector: 'services', kind: 'down', subject: 'kiosk', severity: 'critical', status: 'resolved', opened: 26 * 60, seen: 26 * 60 - 6, occurrences: 2,
            resolved: 26 * 60 - 10, resolvedBy: 'auto', verdict: 'correct', verdictAt: 26 * 60 - 20,
            title: 'Kiosk server down (2 checks in a row)',
            explanation: `The health check could not reach the kiosk server in the last 2 runs, since ${sgtClock(kioskSinceOld)} Singapore time. Last message: Not reachable`,
            evidence: { metric: 'kiosk', status: 'down', runs: 2, since: new Date(kioskSinceOld).toISOString(), summary: 'Not reachable' },
            events: [['opened', 26 * 60, { severity: 'critical', title: 'Kiosk server down (2 checks in a row)' }],
                ['advice', 26 * 60 - 1, advice('The kiosk server does not answer, so the tablets cannot load the kiosk page.', [['The kiosk server stopped after an error', 'high'], ['Someone closed its window on the PC', 'medium']], 'restart-kiosk-server', 'The tablets cannot load the kiosk page while it is down.')],
                ['fix', 26 * 60 - 4, { fix: 'start-kiosk', by, automatic: false, example: true }],
                ['fix-done', 26 * 60 - 4, { fix: 'start-kiosk', ok: true, message: 'Kiosk server started (example: nothing was run)', example: true }],
                ['resolved', 26 * 60 - 10, { auto: true }], ['verdict', 26 * 60 - 20, { by, verdict: 'correct' }]]
        },
        {
            key: 'memory', detector: 'drift', kind: 'rising', subject: 'memory', severity: 'warn', status: 'acknowledged', opened: 180, seen: 2, occurrences: 18, acknowledged: 40,
            title: 'Memory creeping up: 86 %, about 1.6 % per hour for 9 hours',
            explanation: 'Memory has risen about 1.6 % per hour for 9 hours, from about 71 % to 86 %. This is a steady climb rather than a brief spike.',
            evidence: { metric: 'memory', value: 86, baseline: 71, slopePerHour: 1.6, hours: 9, unit: '%', points: points(nowMs, 60, 24, (i) => 70 + Math.max(0, i - 24) * 0.45 + (i % 3) * 0.3) },
            events: [['opened', 180, { severity: 'warn', title: 'Memory creeping up: 82 %, about 1.5 % per hour for 7 hours' }],
                ['advice', 179, advice('Memory use on the server PC has been climbing steadily for 9 hours.', [['A programme slowly holding on to more memory', 'high'], ['Many browser tabs or apps left open', 'medium']], 'restart-kiosk-server', 'A restart gives the memory back if the kiosk server is the one holding it.')],
                ['acknowledged', 40, { by }]]
        },
        {
            key: 'kiosk', detector: 'services', kind: 'down', subject: 'kiosk', severity: 'critical', status: 'open', opened: 4, seen: 0.5, occurrences: 3,
            title: 'Kiosk server down (3 checks in a row)',
            explanation: `The health check could not reach the kiosk server in the last 3 runs, since ${sgtClock(kioskSinceOpen)} Singapore time. Last message: Not reachable`,
            evidence: { metric: 'kiosk', status: 'down', runs: 3, since: new Date(kioskSinceOpen).toISOString(), summary: 'Not reachable' },
            events: [['opened', 4, { severity: 'critical', title: 'Kiosk server down (2 checks in a row)' }],
                ['advice', 3, advice('The kiosk server does not answer, so the tablets show an error page.', [['The kiosk server stopped after an error', 'high'], ['Someone closed its window on the PC', 'medium']], 'restart-kiosk-server', 'The tablets cannot load the kiosk page while it is down.')]]
        },
        {
            key: 'disk', detector: 'disk', kind: 'filling', subject: null, severity: 'warn', status: 'open', opened: 2 * 24 * 60, seen: 3, occurrences: 40,
            title: 'Disk full in about 6 days at 2.1 GB per day',
            explanation: 'Disk use grew by about 2.1 GB per day over the last 9 days. It is 93 % full now (443 of 476 GB), so at that rate it will be full in about 6 days.',
            evidence: { metric: 'disk', value: 443, unit: 'GB', percent: 93, totalGb: 476, gbPerDay: 2.1, daysUntilFull: 6, spanDays: 9, points: points(nowMs, 60, 216, (i) => 424 + i * 0.32) },
            events: [['opened', 2 * 24 * 60, { severity: 'warn', title: 'Disk full in about 8 days at 2.0 GB per day' }],
                ['advice', 2 * 24 * 60 - 1, advice('Drive C: of the server PC is filling up by about 2 GB a day.', [['Visitor photos are added every day', 'high'], ['Other programmes or downloads on drive C:', 'medium']], 'free-disk-space', 'With a full disk the database and the photo uploads start to fail.')],
                ['seen', 600, { occurrences: 30, value: 441 }]]
        },
        {
            key: 'tablet', detector: 'tablets', kind: 'offline', subject: 'example-tablet', severity: 'warn', status: 'open', opened: 14, seen: 1, occurrences: 4,
            title: 'Tablet Entrance offline for 25 minutes',
            explanation: 'The tablet Entrance last reported 25 minutes ago. A named tablet that is quiet for more than 10 minutes counts as offline at this sensitivity.',
            evidence: { metric: 'seconds_ago', value: 25, unit: 'min', limitMinutes: 10, name: 'Entrance', device_id: 'example-tablet' },
            events: [['opened', 14, { severity: 'warn', title: 'Tablet Entrance offline for 11 minutes' }],
                ['advice', 13, advice('The tablet at the entrance stopped reporting 25 minutes ago.', [['The tablet is asleep or out of battery', 'high'], ['It lost the Wi-Fi', 'medium']], 'check-tablet', 'A tablet that does not report cannot take sign-offs.')]]
        },
        {
            key: 'cpu', detector: 'spike', kind: 'high', subject: 'cpu', severity: 'warn', status: 'open', opened: 25, seen: 1, occurrences: 6,
            title: 'CPU at 82 %, far above the usual 31 %',
            explanation: 'CPU use averaged 82 % over the last 5 minutes. Over the past 24 hours the typical level was 31 % (usual swing ± 4 %), so this is 13 times its usual swing above normal.',
            evidence: { metric: 'cpu', value: 82, baseline: 31, spread: 4, z: 12.7, unit: '%', windowSeconds: 300, samples: 5, above: 5, points: points(nowMs, 60, 2, (i) => (i < 48 ? 30 + (i % 4) : 34 + (i - 47) * 4)) },
            events: [['opened', 25, { severity: 'info', title: 'CPU at 70 %, far above the usual 31 %' }], ['seen', 12, { occurrences: 3, value: 74 }], ['severity', 6, { from: 'info', to: 'warn' }],
                ['advice', 5, advice('CPU use on the server PC jumped to about 82 % in the last few minutes, far above its usual 31 %.', [['Another programme on the server PC is using a lot of CPU', 'high'], ['Many visitors submitting at the same time', 'medium']], 'close-heavy-apps', 'If another programme is busy, closing it gives the kiosk its speed back.')]]
        }
    ];
}

// Replaces any earlier examples with a fresh set; returns how many were made
async function createExamples(store, by, now = new Date()) {
    const nowMs = now.getTime();
    const who = by ? String(by) : 'an admin';
    await store.deleteByFingerprintPrefix(EXAMPLE_PREFIX);
    const batch = nowMs.toString(36);
    const at = (minutes) => new Date(nowMs - minutes * MINUTE).toISOString();
    let made = 0;
    for (const x of exampleList(nowMs, who)) {
        const id = await store.insert({
            fingerprint: `${EXAMPLE_PREFIX}${x.key}:${batch}`, detector: x.detector, kind: x.kind, subject: x.subject, severity: x.severity, status: x.status,
            title: x.title, explanation: x.explanation, evidence: { ...x.evidence, example: true },
            opened_at: at(x.opened), last_seen_at: at(x.seen), occurrences: x.occurrences,
            acknowledged_at: x.acknowledged ? at(x.acknowledged) : null, acknowledged_by: x.acknowledged ? who : null,
            resolved_at: x.resolved ? at(x.resolved) : null, resolved_by: x.resolved ? x.resolvedBy : null,
            verdict: x.verdict || null, verdict_by: x.verdict ? who : null, verdict_at: x.verdictAt ? at(x.verdictAt) : null
        });
        for (const [type, minutes, detail] of x.events) await store.addEvent(id, type, detail, at(minutes));
        made++;
    }
    return made;
}

const removeExamples = (store) => store.deleteByFingerprintPrefix(EXAMPLE_PREFIX);

module.exports = { createExamples, removeExamples, exampleList };
// <Jun Kai end>
