// Owner: Role 3, Jun Kai.
// Unit tests for the terminal log level. Run: npm run test:unit
// <Jun Kai start>
const test = require('node:test');
const assert = require('node:assert/strict');
const { setupLogging } = require('../../backend/core/log');

test('console.debug is silent unless LOG_LEVEL=debug', () => {
    const original = console.debug;
    try {
        assert.equal(setupLogging('debug'), false);
        assert.equal(console.debug, original, 'debug keeps every line');
        assert.equal(setupLogging(' DEBUG '), false, 'case and spaces do not matter');
        assert.equal(setupLogging(''), true);
        assert.notEqual(console.debug, original, 'the default hides the request chatter');
        assert.equal(console.debug('hidden'), undefined);
    } finally {
        console.debug = original;
    }
});
// <Jun Kai end>
