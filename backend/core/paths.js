// Absolute paths used by the backend. Everything that touches the filesystem goes through here,
// so files can move between folders without breaking paths.
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND = path.join(ROOT, 'backend');

module.exports = {
  ROOT,
  BACKEND,
  FRONTEND: path.join(ROOT, 'frontend'),
  ASSETS: path.join(ROOT, 'assets'),
  UPLOADS: path.join(ROOT, 'uploads'),
  DATABASE: path.join(ROOT, 'database'),
  CONFIG: path.join(BACKEND, 'config'),
  CACHE: path.join(BACKEND, 'cache'),
  CERTS: path.join(BACKEND, 'certs'),
  ENV_FILE: path.join(BACKEND, '.env'),
};
