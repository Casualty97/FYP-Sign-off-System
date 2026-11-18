// Owner: Role 3, Jun Kai.
// <Jun Kai start>
// "Is this request made on the PC itself?" The answer comes from the address of the connection, never from a header
// such as X-Forwarded-For, which the sender can set.
function isThisPc(address) {
    return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(String(address || ''));
}

// For the routes that tell about the server itself (its addresses, its table names, the sender address of the emails):
// a signed-in admin, or a request made on the PC. The tests and the wall browser run on the PC; a tablet does not.
function signedInOrThisPc(req, res, next) {
    if ((req.session && req.session.user) || isThisPc(req.socket.remoteAddress)) return next();
    // not the text of the sign-in check: the admin page signs out on that one, and this is only a line on a status card
    res.status(401).json({ error: 'Only for a signed-in admin or a request made on the PC itself' });
}

module.exports = { isThisPc, signedInOrThisPc };
// <Jun Kai end>
