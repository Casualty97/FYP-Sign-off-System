// Owner: shared (lead: Role 3, Jun Kai). Previous team: Preti (11).
// ============================================================
// DB.JS - TABLE OF CONTENTS (CTRL+F SEARCHABLE)
// ============================================================
// 
// 1. DATABASE CONFIGURATION
//    const mysql = require('mysql2')      - MySQL database driver (DONE BY PRETI)
//    const path = require('path')         - Path utility module (DONE BY PRETI)
//    const pool = mysql.createPool()      - MySQL connection pool configuration (DONE BY PRETI)
//
// 2. DATABASE CONNECTION TEST
//    pool.getConnection()                 - Test database connection on startup (DONE BY PRETI)
//
// 3. SQLITE-COMPATIBLE WRAPPER FUNCTIONS 
//    function get()                       - Execute query and return single row (SQLite db.get) (DONE BY PRETI)
//    function all()                       - Execute query and return all rows (SQLite db.all) (DONE BY PRETI)
//    function run()                       - Execute INSERT/UPDATE/DELETE (SQLite db.run) (DONE BY PRETI)
//
// 4. TRANSACTION FUNCTIONS
//    function withTransaction()           - Run several statements on one connection inside a real transaction
//
// 5. MODULE EXPORTS
//    module.exports                       - Export pool and SQLite-compatible functions (DONE BY PRETI)
//
// ============================================================

// =================== 1. DATABASE CONFIGURATION =================== 
const mysql = require('mysql2');
const path = require('path');

// Create MySQL connection pool with default credentials
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'kiosk_user',
    password: process.env.DB_PASSWORD || 'kiosk123',
    database: process.env.DB_NAME || 'dp_kiosk_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 30000, // a cold start takes longer than the 10 s default
    timezone: 'Z' // matches the UTC session below, so JS Dates round-trip as the right instant
});

// Every session runs in UTC. The queries convert with CONVERT_TZ(col, '+00:00', '+08:00'), which only
// gives Singapore time when the session is UTC; on the wall PC (SGT) the unpinned session was 8 h off.
pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'");
});

// =================== 2. DATABASE CONNECTION TEST =================== 
// Test connection on startup; retry a few times before giving up (MySQL may still be waking up)
function testConnection(attempt = 1) {
    pool.getConnection((err, connection) => {
        if (!err) {
            console.log('✅ Connected to MySQL database:', process.env.DB_NAME || 'dp_kiosk_db');
            connection.release();
            return;
        }
        console.error(`❌ Error connecting to MySQL database (attempt ${attempt}/6):`, err.message);
        if (attempt < 6) return setTimeout(() => testConnection(attempt + 1), 5000);
        console.error('   Please check:');
        console.error('   1. MySQL Server is running');
        console.error('   2. Database "dp_kiosk_db" exists');
        console.error('   3. User "kiosk_user" has proper permissions');
        process.exit(1);
    });
}
testConnection();

// =================== 3. SQLITE-COMPATIBLE WRAPPER FUNCTIONS =================== 
// Execute query and return single row (mimics SQLite db.get)
function get(sql, params, callback) {
    // Handle missing callback
    if (typeof callback !== 'function') {
        console.error('⚠️ db.get() called without callback');
        return;
    }
    
    pool.query(sql, params, (error, results) => {
        if (error) {
            return callback(error, null);
        }
        // Return first row or null
        callback(null, results[0] || null);
    });
}

// Execute query and return all rows (mimics SQLite db.all)
function all(sql, params, callback) {
    // Handle missing callback
    if (typeof callback !== 'function') {
        console.error('⚠️ db.all() called without callback');
        return;
    }
    
    pool.query(sql, params, (error, results) => {
        if (error) {
            return callback(error, null);
        }
        // Results is already an array
        callback(null, results);
    });
}

// Execute INSERT/UPDATE/DELETE queries (mimics SQLite db.run)
function run(sql, params, callback) {
    // Handle missing callback
    if (typeof callback !== 'function') {
        // If no callback, just execute the query
        pool.query(sql, params, (error) => {
            if (error) {
                console.error('❌ db.run() error (no callback):', error.message);
            }
        });
        return;
    }
    
    pool.query(sql, params, function(error, results) {
        if (error) {
            return callback.call({ lastID: null, changes: 0 }, error);
        }
        
        // Mimic SQLite's 'this' context
        const context = {
            lastID: results.insertId || null,
            changes: results.affectedRows || 0
        };
        
        callback.call(context, null);
    });
}

// =================== 4. TRANSACTION FUNCTIONS ===================
// Runs work(tx, finish) on ONE pooled connection inside a real transaction (the old pool-level
// START TRANSACTION / COMMIT went to random connections, so nothing was atomic).
// tx.run/get/all behave like db.run/get/all; finish(err, result) commits, or rolls back when err is set.
function withTransaction(work, done) {
    pool.getConnection((connErr, connection) => {
        if (connErr) return done(connErr);
        let finished = false;
        const finish = (err, result) => {
            if (finished) return;
            finished = true;
            if (err) return connection.rollback(() => { connection.release(); done(err); });
            connection.commit((commitErr) => {
                if (commitErr) return connection.rollback(() => { connection.release(); done(commitErr); });
                connection.release();
                done(null, result);
            });
        };
        const tx = {
            run: (sql, params, callback) => connection.query(sql, params, function(error, results) {
                if (error) return callback.call({ lastID: null, changes: 0 }, error);
                callback.call({ lastID: results.insertId || null, changes: results.affectedRows || 0 }, null);
            }),
            get: (sql, params, callback) => connection.query(sql, params, (error, results) => callback(error, error ? null : (results[0] || null))),
            all: (sql, params, callback) => connection.query(sql, params, (error, results) => callback(error, error ? null : results))
        };
        connection.beginTransaction((txErr) => {
            if (txErr) { connection.release(); return done(txErr); }
            try { work(tx, finish); } catch (thrown) { finish(thrown); }
        });
    });
}

// =================== 5. MODULE EXPORTS =================== 
// Export both the pool and SQLite-compatible functions
module.exports = {
    pool,           // Raw MySQL pool for advanced usage
    get,            // SQLite-compatible get()
    all,            // SQLite-compatible all()
    run,            // SQLite-compatible run()
    query: (sql, params, callback) => pool.query(sql, params, callback),
    
    withTransaction
};
