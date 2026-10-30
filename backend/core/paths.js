// Owner: shared (lead: Role 3, Jun Kai). Previous team: none marked.
// Absolute paths used by the backend. Everything that touches the filesystem goes through here,
// so files can move between folders without breaking paths.
const path = require('path');

const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND = path.join(ROOT, 'backend');
const DATA = path.join(BACKEND, 'data'); // runtime copies the admin page rewrites; not in git
const DEFAULTS = path.join(BACKEND, 'config', 'defaults'); // committed starting values

/**
 * Path of a runtime JSON file in backend/data/. On first use the committed default from
 * backend/config/defaults/ is copied there, so a fresh clone starts with sane settings and
 * later edits made in the admin page never show up as git changes.
 */
function dataFile(name) {
  const target = path.join(DATA, name);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(DATA, { recursive: true });
    const seed = path.join(DEFAULTS, name);
    if (fs.existsSync(seed)) {
      // Both servers start at once and may seed the same file: the first copy wins, the other
      // sees EEXIST (or a transient EBUSY on Windows) and simply uses the file.
      for (let attempt = 0; attempt < 10; attempt++) {
        try { fs.copyFileSync(seed, target, fs.constants.COPYFILE_EXCL); break; }
        catch (error) {
          if (fs.existsSync(target) && error.code !== 'EBUSY') break;
          if (attempt === 9) throw error;
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
        }
      }
    }
  }
  return target;
}

module.exports = {
  ROOT,
  BACKEND,
  FRONTEND: path.join(ROOT, 'frontend'),
  ASSETS: path.join(ROOT, 'assets'),
  UPLOADS: path.join(ROOT, 'uploads'),
  DATABASE: path.join(ROOT, 'database'),
  CONFIG: path.join(BACKEND, 'config'),
  DEFAULTS,
  DATA,
  CACHE: path.join(BACKEND, 'cache'),
  CERTS: path.join(BACKEND, 'certs'),
  ENV_FILE: path.join(BACKEND, '.env'),
  dataFile,
};
