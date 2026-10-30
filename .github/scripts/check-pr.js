#!/usr/bin/env node
// Pull request rules. Reads everything from the environment (never from script interpolation).
//   PR_TITLE, PR_NUMBER, HEAD_REF, PR_LABELS (comma separated), GITHUB_REPOSITORY, GITHUB_TOKEN
const TYPES = ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'ci', 'build', 'perf', 'style'];
const SCOPES = [
  // cross-cutting
  'core', 'ci', 'docs', 'deps', 'legacy', 'scripts', 'db', 'tests',
  // feature folders (one owner each)
  'feedback', 'overlays', 'formUi', 'questions', 'parameters',
  'tree', 'pulse', 'pledgeboard',
  'archive', 'analysis', 'health', 'hardware', 'serverControl', 'email',
  'assets', 'alerts', 'canvas',
  'users', 'audit', 'vips', 'countdown', 'lostFound', 'themes', 'admin',
];
const FORBIDDEN = [
  [/^uploads\/(?!.*\.gitkeep$)/, 'visitor photos'],
  [/\.log$/, 'log files'],
  [/^logs\//, 'log files'],
  [/^backend\/\.env$/, 'the real .env'],
  [/^backend\/\.env\.(?!example$)/, '.env variants'],
  [/^backend\/certs\//, 'certificates'],
  [/^backend\/cache\//, 'the analysis cache'],
  [/^backend\/data\//, 'runtime settings (edit backend/config/defaults/ instead)'],
  [/(^|\/)node_modules\//, 'node_modules'],
];
const BIG_CHANGE_LINES = 1500;

const env = process.env;
const problems = [];
const warnings = [];
const title = env.PR_TITLE || '';
const labels = (env.PR_LABELS || '').split(',').map((s) => s.trim()).filter(Boolean);

// 1. Title: Conventional Commits with a known scope (the title becomes the squash commit on main)
const m = title.match(/^([a-z]+)(?:\(([A-Za-z0-9-]+)\))?!?: (.+)$/);
if (!m) problems.push(`PR title "${title}" must look like "type(scope): short description", e.g. "fix(archive): keep photos when deleting by date"`);
else {
  if (!TYPES.includes(m[1])) problems.push(`PR title type "${m[1]}" is not one of: ${TYPES.join(', ')}`);
  if (m[2] && !SCOPES.includes(m[2])) problems.push(`PR title scope "${m[2]}" is not one of: ${SCOPES.join(', ')}`);
  if (m[3].length < 8) problems.push('PR title description is too short to tell what changed');
}

// 2. Branch name: a warning, never a blocker
if (env.HEAD_REF && !/^(feat|fix|docs|chore|refactor|test|ci|build)\/[a-z0-9._-]+$/.test(env.HEAD_REF) && !/^dependabot\//.test(env.HEAD_REF))
  warnings.push(`branch name "${env.HEAD_REF}" does not follow type/short-description (e.g. feat/archive-export)`);

(async () => {
  // 3. Files in the PR (paginated)
  const files = [];
  if (env.PR_NUMBER && env.GITHUB_TOKEN && env.GITHUB_REPOSITORY) {
    for (let page = 1; page < 50; page++) {
      const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/pulls/${env.PR_NUMBER}/files?per_page=100&page=${page}`,
        { headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } });
      if (!r.ok) { warnings.push(`could not list PR files (HTTP ${r.status}); file rules skipped`); break; }
      const batch = await r.json();
      files.push(...batch);
      if (batch.length < 100) break;
    }
  }
  for (const f of files) {
    if (f.status === 'removed') continue;
    for (const [re, what] of FORBIDDEN) if (re.test(f.filename)) problems.push(`${f.filename}: ${what} must not be committed`);
  }
  const changed = files.reduce((n, f) => n + (f.additions || 0) + (f.deletions || 0), 0);
  if (changed > BIG_CHANGE_LINES && !labels.includes('big-change'))
    problems.push(`${changed} changed lines: split the PR or add the "big-change" label with a sentence in the description saying why`);
  if (files.some((f) => /^tests\/contracts\/routes\.snapshot\.txt$/.test(f.filename)) && !files.some((f) => /^tests\/(smoke\.js|contracts\/run\.js|.*\.test\.js)$/.test(f.filename)) && !labels.includes('no-test-needed'))
    problems.push('the route table changed but no test changed: cover the new or changed route in tests/smoke.js, or add the "no-test-needed" label and say why');

  for (const w of warnings) console.log(`::warning::${w}`);
  for (const p of problems) console.log(`::error::${p}`);
  console.log(`${files.length} files, ${changed} changed lines, ${problems.length} problem(s), ${warnings.length} warning(s)`);
  process.exit(problems.length ? 1 : 0);
})();
