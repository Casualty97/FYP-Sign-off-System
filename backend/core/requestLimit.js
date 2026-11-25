// Owner: Role 3, Jun Kai.
// <Jun Kai start>
// Limits on how many requests one address can send, so one PC or tablet cannot flood the server.
// Uses the express-rate-limit package: the code scan in CI only counts limits made with a known package.
// Kept in memory: a restart of the server clears the counts.
const { rateLimit } = require('express-rate-limit');

const tooMany = (text) => ({ success: false, error: text });

// every request of one address, pages and files included
const everyRequest = rateLimit({
    windowMs: 60 * 1000,
    limit: 3000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: tooMany('Too many requests from this address. Wait a minute and try again.')
});

module.exports = { everyRequest };
// <Jun Kai end>
