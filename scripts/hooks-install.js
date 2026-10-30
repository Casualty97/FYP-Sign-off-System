// Points git at the repo's .githooks folder so `npm run check` runs before every push.
// Safe to run anywhere: does nothing when this is not a git clone (e.g. the zip on the wall PC).
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
if (!fs.existsSync(path.join(root, '.git'))) { console.log('not a git clone, hooks not installed'); process.exit(0); }
const r = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: root, encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr || 'git config failed'); process.exit(1); }
console.log('git hooks installed: .githooks/pre-push runs npm run check before each push');
