// Owner: Role 3, Jun Kai.
// <Jun Kai start>
// Limits on how many requests one address can send, so one PC or tablet cannot flood the server, guess passwords on
// the routes that ask for one, or use the kiosk forms to send mail from the centre's account again and again.
// Uses the express-rate-limit package: the code scan in CI only counts limits made with a known package.
// Every tablet reaches the servers with its own address, so one busy tablet never uses up the count of another.
// Kept in memory: a restart of a server clears the counts.
//
// Measured on the test copy (25 Nov 2026): an admin who opens every page and then leaves Hardware open sends at most
// 175 requests in a minute, and one load of the kiosk page sends 34. The limits leave room for several of those at once.
const { rateLimit } = require('express-rate-limit');

const answer = (text) => ({ success: false, error: text });
const common = { standardHeaders: 'draft-7', legacyHeaders: false };

// Every request of one address, pages and files included. Each server makes its own limiter from these settings with
// rateLimit(EVERY_REQUEST) next to its app.use, so the code scan sees the limit in front of the routes.
const EVERY_REQUEST = {
    ...common,
    windowMs: 60 * 1000,
    limit: 1000,
    message: answer('Too many requests from this address. Wait a minute and try again.')
};

// Routes that check the admin password. Only wrong passwords count (an answer of 400 or more), so decrypting 25
// emails in a row with the right password never locks anyone out.
const passwordChecks = rateLimit({
    ...common,
    windowMs: 15 * 60 * 1000,
    limit: 20,
    skipSuccessfulRequests: true,
    message: answer('Too many wrong passwords from this address. Wait 15 minutes and try again.')
});

// Downloads that build a file (Excel, ZIP of photos, exports)
const heavyWork = rateLimit({
    ...common,
    windowMs: 10 * 60 * 1000,
    limit: 30,
    message: answer('Too many downloads from this address. Wait a few minutes and try again.')
});

// The kiosk forms that save something or send mail (photos, the submission, a lost & found report)
const kioskForms = rateLimit({
    ...common,
    windowMs: 10 * 60 * 1000,
    limit: 120,
    message: answer('Too many submissions from this device. Wait a few minutes and try again.')
});

// The visitor passport looks a visitor up by email, so it is kept slow for anyone trying many addresses
const visitorLookup = rateLimit({
    ...common,
    windowMs: 10 * 60 * 1000,
    limit: 30,
    message: answer('Too many lookups from this device. Wait a few minutes and try again.')
});

module.exports = { EVERY_REQUEST, passwordChecks, heavyWork, kioskForms, visitorLookup };
// <Jun Kai end>
