// Owner: shared (lead: Role 3, Jun Kai).
// One place to create ZIP archives: archiver 7 exports a function, archiver 8 exports classes.
const archiverLib = require('archiver');

function createZipArchive(options = { zlib: { level: 9 } }) {
    if (typeof archiverLib === 'function') return archiverLib('zip', options); // archiver 7
    return new archiverLib.ZipArchive(options); // archiver 8+
}

module.exports = { createZipArchive };
