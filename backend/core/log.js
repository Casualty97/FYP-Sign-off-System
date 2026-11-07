// Owner: shared (lead: Role 3, Jun Kai).
// How much the servers print in the terminal. console.debug is request chatter ("Fetching overlay data...",
// "Found 6 overlays") and stays silent unless backend/.env has LOG_LEVEL=debug; console.log (startup lines and real
// actions), console.warn and console.error always print.
// <Jun Kai start>
function setupLogging(level = process.env.LOG_LEVEL) {
    if (String(level || '').trim().toLowerCase() === 'debug') return false;
    console.debug = () => {};
    return true;
}

module.exports = { setupLogging };
// <Jun Kai end>
