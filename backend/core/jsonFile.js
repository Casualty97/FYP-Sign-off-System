// Owner: shared (lead: Role 3, Jun Kai).
// Small JSON file helpers: a read with a fallback, and a write that goes through a temp file + rename so a
// crash or a second server process never leaves a half-written settings file behind.
const fs = require('fs');

function readJson(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        if (error.code !== 'ENOENT') console.error(`⚠️ Could not read ${file}: ${error.message}`);
        return fallback;
    }
}

function writeJsonAtomic(file, data) {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    // Windows refuses the rename while the other server has the file open for a read; retry briefly
    for (let attempt = 0; ; attempt++) {
        try { fs.renameSync(tmp, file); return; }
        catch (error) {
            if (attempt >= 10 || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) { try { fs.unlinkSync(tmp); } catch { /* ignore */ } throw error; }
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
        }
    }
}

module.exports = { readJson, writeJsonAtomic };
