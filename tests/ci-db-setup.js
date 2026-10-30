#!/usr/bin/env node
// CI helper: create the kiosk database and user on a fresh MySQL (root, no password), apply
// database/schema.sql twice (it must be re-runnable) and check the result.
// Local use: node tests/ci-db-setup.js --root-password <pw>   (drops and recreates dp_kiosk_db!)
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const rootPassword = argv.includes('--root-password') ? argv[argv.indexOf('--root-password') + 1] : (process.env.MYSQL_ROOT_PASSWORD || '');
const DB = process.env.DB_NAME || 'dp_kiosk_db';
const USER = process.env.DB_USER || 'kiosk_user';
const PASS = process.env.DB_PASSWORD || 'kiosk123';
const HOST = process.env.DB_HOST || '127.0.0.1';

// The admin account differs per runner image (ankane/setup-mysql: root on Windows/Mac, runner on Linux).
async function connectAsAdmin() {
  const candidates = [process.env.MYSQL_ROOT_USER, 'root', 'runner', 'ODBC'].filter(Boolean);
  let lastError;
  for (const user of candidates) {
    try { return await mysql.createConnection({ host: HOST, user, password: rootPassword, multipleStatements: true }); }
    catch (e) { lastError = e; }
  }
  throw new Error(`could not connect as any of ${candidates.join(', ')}: ${lastError && lastError.message}`);
}

(async () => {
  const root = await connectAsAdmin();
  await root.query(`CREATE DATABASE IF NOT EXISTS \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await root.query(`CREATE USER IF NOT EXISTS '${USER}'@'%' IDENTIFIED BY '${PASS}'`);
  await root.query(`CREATE USER IF NOT EXISTS '${USER}'@'localhost' IDENTIFIED BY '${PASS}'`);
  await root.query(`GRANT ALL PRIVILEGES ON \`${DB}\`.* TO '${USER}'@'%'`);
  await root.query(`GRANT ALL PRIVILEGES ON \`${DB}\`.* TO '${USER}'@'localhost'`);
  await root.query('FLUSH PRIVILEGES');
  await root.end();

  const schema = fs.readFileSync(path.join(ROOT, 'database', 'schema.sql'), 'utf8');
  const conn = await mysql.createConnection({ host: HOST, user: USER, password: PASS, database: DB, multipleStatements: true });
  for (const pass of [1, 2]) {
    await conn.query(schema);
    console.log(`schema.sql applied (pass ${pass})`);
  }
  const [tables] = await conn.query('SHOW TABLES');
  const [admins] = await conn.query('SELECT COUNT(*) AS n FROM admin_users');
  await conn.end();
  console.log(`${tables.length} tables, ${admins[0].n} admin user(s)`);
  if (tables.length < 14 || admins[0].n < 1) { console.error('database setup did not produce the expected tables/seed'); process.exit(1); }
})().catch((e) => { console.error('db setup failed:', e.message); process.exit(1); });
