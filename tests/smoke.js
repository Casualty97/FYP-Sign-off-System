#!/usr/bin/env node
// Smoke test: boots `node startAll.js`, checks the public endpoints, the admin login, one feedback
// submission, and that the server log holds no crash markers. Then stops the servers.
//
//   node tests/smoke.js              full run (submits one feedback; CI neutralises email first)
//   node tests/smoke.js --no-submit  skip the submission (safe on a machine with real email settings)
//   node tests/smoke.js --external   do not start the servers, test the ones already running
//
// It never calls /api/admin/server/* (stop hibernates the machine the server runs on).

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // self-signed certificate
const ROOT = path.resolve(__dirname, '..');
const ARGS = new Set(process.argv.slice(2));
const BASE = process.env.SMOKE_BASE_URL || 'https://localhost:3000';
const KIOSK = process.env.SMOKE_KIOSK_URL || 'http://localhost:3003';
const ADMIN_USER = process.env.SMOKE_ADMIN_USER || 'systemadmin';
const ADMIN_PASS = process.env.SMOKE_ADMIN_PASS || 'SystemAdmin123!';
const LOG_DIR = path.join(ROOT, 'logs');
const LOG = path.join(LOG_DIR, 'smoke-server.log');
const results = [];
const pass = (m) => results.push(`PASS ${m}`);
const fail = (m) => results.push(`FAIL ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let child = null;
function startServers() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const out = fs.openSync(LOG, 'w');
  child = spawn(process.execPath, ['startAll.js'], {
    cwd: ROOT, stdio: ['ignore', out, out], detached: process.platform !== 'win32',
    env: { PLEDGE_SENTIMENT_MODE: 'rules', ...process.env },
  });
}
function stopServers() {
  if (!child) return;
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGTERM');
  } catch {}
}
async function waitFor(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.status < 600) return; } catch {}
    if (child && child.exitCode !== null) throw new Error(`servers exited early with code ${child.exitCode}`);
    await sleep(1500);
  }
  throw new Error(`timeout waiting for ${url}`);
}
async function get(url, init) {
  const r = await fetch(url, { redirect: 'follow', ...init });
  const text = await r.text();
  let body = null; try { body = JSON.parse(text); } catch {}
  return { status: r.status, body, text, headers: r.headers };
}
async function expect(name, url, test, init) {
  try {
    const r = await get(url, init);
    const verdict = test(r);
    if (verdict === true) pass(`${name} (${r.status})`);
    else fail(`${name} (${r.status}): ${verdict || 'unexpected body ' + r.text.slice(0, 120)}`);
  } catch (e) { fail(`${name}: ${e.message}`); }
}

// 1x1 white PNG, built in code so the repo carries no binary fixture
function tinyPng() {
  const zlib = require('zlib');
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 255, 255, 255]))), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

(async () => {
  try {
    if (!ARGS.has('--external')) startServers();
    await waitFor(`${BASE}/api/status`, 150000);
    await waitFor(`${KIOSK}/api/status`, 30000);

    // Public endpoints: status + shape pinned to today's behaviour
    await expect('GET /api/status', `${BASE}/api/status`, (r) => r.body && r.body.online === true);
    await expect('GET /api/parameters', `${BASE}/api/parameters`, (r) => r.body && r.body.success === true && typeof r.body.parameters === 'object');
    await expect('GET /api/generate-qr', `${BASE}/api/generate-qr`, (r) => r.body && r.body.success === true && /^https:\/\/[\d.]+:3000\/feedback$/.test(r.body.url) && /<svg/.test(r.body.qrSvg) || `url=${r.body && r.body.url}`);
    await expect('GET /api/generate-qr on the kiosk server points at :3000', `${KIOSK}/api/generate-qr`, (r) => r.body && r.body.success === true && /:3000\/feedback$/.test(r.body.url) || `url=${r.body && r.body.url}`);
    await expect('GET /api/feedback/questions', `${BASE}/api/feedback/questions`, (r) => r.status === 200 && r.body !== null);
    await expect('GET /api/feedback/form-ui', `${BASE}/api/feedback/form-ui`, (r) => r.status === 200 && r.body && typeof r.body.landingTitle === 'string');
    await expect('GET /api/feedback/overlays', `${BASE}/api/feedback/overlays`, (r) => r.status === 200 && r.body !== null);
    await expect('GET /api/feedback/countdown-timer', `${BASE}/api/feedback/countdown-timer`, (r) => r.status === 200 && r.body !== null);
    await expect('GET /api/tree', `${BASE}/api/tree`, (r) => r.status === 200 && r.body !== null);
    await expect('GET /api/tree/years', `${BASE}/api/tree/years`, (r) => r.body && r.body.success === true && Array.isArray(r.body.years));
    await expect('GET /api/tree/vip-names', `${BASE}/api/tree/vip-names`, (r) => r.body && r.body.success === true && Array.isArray(r.body.vipNames));
    await expect('GET /api/pulse/summary', `${BASE}/api/pulse/summary`, (r) => r.body && r.body.success === true);
    await expect('GET /api/pledgeboard/pledges', `${BASE}/api/pledgeboard/pledges`, (r) => r.body && r.body.success === true && Array.isArray(r.body.pledges));
    await expect('GET /api/pledgeboard/topics', `${BASE}/api/pledgeboard/topics`, (r) => r.status === 200 && r.body !== null);
    await expect('GET /api/test-db', `${BASE}/api/test-db`, (r) => r.status === 200 && r.body && Array.isArray(r.body.tables) || 'db test failed');

    // Pages
    await expect('GET /feedback', `${BASE}/feedback`, (r) => r.status === 200 && /feedback\.js/.test(r.text));
    await expect('GET /admin', `${BASE}/admin`, (r) => r.status === 200 && /admin\.js/.test(r.text));
    await expect('GET /tree', `${BASE}/tree`, (r) => r.status === 200);
    await expect('GET /pulse', `${BASE}/pulse`, (r) => r.status === 200);
    await expect('GET /feedback on the kiosk server', `${KIOSK}/feedback`, (r) => r.status === 200 && /feedback\.js/.test(r.text));

    // Admin auth
    const json = (b) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    await expect('POST /api/admin/login with a wrong password is refused', `${BASE}/api/admin/login`, (r) => r.status === 401, json({ username: ADMIN_USER, password: 'definitely-wrong' }));
    await expect('GET /api/admin/server-schedules without a session is refused', `${BASE}/api/admin/server-schedules`, (r) => r.status === 401);
    let cookie = '';
    try {
      const r = await fetch(`${BASE}/api/admin/login`, json({ username: ADMIN_USER, password: ADMIN_PASS }));
      const setCookie = r.headers.get('set-cookie') || '';
      cookie = setCookie.split(';')[0];
      if (r.status === 200 && cookie) pass('POST /api/admin/login with the seeded admin (200, session cookie set)');
      else fail(`POST /api/admin/login with the seeded admin (${r.status}, cookie ${cookie ? 'set' : 'missing'})`);
    } catch (e) { fail(`POST /api/admin/login: ${e.message}`); }
    if (cookie) {
      await expect('GET /api/admin/server-schedules with the session', `${BASE}/api/admin/server-schedules`, (r) => r.body && r.body.success === true, { headers: { cookie } });
      await expect('GET /api/admin/dashboard with the session', `${BASE}/api/admin/dashboard`, (r) => r.body && r.body.success === true, { headers: { cookie } });
    }

    // One visitor submission end to end
    if (!ARGS.has('--no-submit')) {
      const stamp = Date.now();
      let photoId = null;
      try {
        const r = await get(`${BASE}/api/feedback/save-photo`, json({ photo: tinyPng(), userName: 'CI Smoke', device: 'kiosk' }));
        photoId = r.body && r.body.photoId;
        if (r.status === 200 && photoId) pass('POST /api/feedback/save-photo'); else fail(`POST /api/feedback/save-photo (${r.status}): ${r.text.slice(0, 120)}`);
      } catch (e) { fail(`POST /api/feedback/save-photo: ${e.message}`); }
      if (photoId) {
        const payload = {
          userData: { name: 'CI Smoke', email: `smoke+${stamp}@example.com`, pledge: 'I pledge to recycle and save energy every day', pledgeTopic: 'sustainable-living', photoId },
          device: 'kiosk', theme: 'nature',
        };
        await expect('POST /api/feedback/submit-feedback', `${BASE}/api/feedback/submit-feedback`, (r) => r.body && r.body.success === true || r.text.slice(0, 160), json(payload));
        let found = false;
        for (let i = 0; i < 6 && !found; i++) {
          const r = await get(`${BASE}/api/pledgeboard/pledges`);
          found = /I pledge to recycle and save energy/.test(r.text);
          if (!found) await sleep(1000);
        }
        (found ? pass : fail)('the new pledge appears on /api/pledgeboard/pledges');
        const tree = await get(`${BASE}/api/tree`);
        (/CI Smoke/.test(tree.text) ? pass : fail)('the new visitor appears on /api/tree');
      }
    }

    // The previous team's pulse check, if present
    const pulseCheck = path.join(ROOT, 'tests', 'pulse-backend-check.js');
    if (fs.existsSync(pulseCheck)) {
      const r = spawnSync(process.execPath, [pulseCheck], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PULSE_TEST_BASE_URL: BASE, PULSE_TEST_USERNAME: ADMIN_USER, PULSE_TEST_PASSWORD: ADMIN_PASS } });
      if (r.status === 0) pass('tests/pulse-backend-check.js'); else fail(`tests/pulse-backend-check.js exited ${r.status}: ${(r.stdout + r.stderr).split('\n').filter((l) => /FAIL|Error/.test(l)).slice(0, 3).join(' | ')}`);
    }
  } catch (e) { fail(`boot: ${e.message}`); }

  stopServers();
  await sleep(1500);
  if (!ARGS.has('--external') && fs.existsSync(LOG)) {
    const log = fs.readFileSync(LOG, 'utf8');
    const markers = ['ERR_HTTP_HEADERS_SENT', 'UnhandledPromiseRejection', 'ReferenceError', 'TypeError', 'Error connecting to MySQL database', 'Failed to start'];
    const hits = markers.filter((m) => log.includes(m));
    (hits.length ? fail : pass)(hits.length ? `server log contains ${hits.join(', ')} (see ${path.relative(ROOT, LOG)})` : 'server log has no crash markers');
  }
  console.log(results.join('\n'));
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - failed}/${results.length} smoke checks passed`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Smoke (${process.platform})\n\`\`\`\n${results.join('\n')}\n\`\`\`\n`);
  process.exit(failed ? 1 : 0);
})();
