// Owner: shared (lead: Role 3, Jun Kai).
// <Jun Kai start>
// Response headers for every page and API answer of both servers. They close what the scan of the running servers
// (OWASP ZAP in CI) reported on every address. Each one only tells the browser to be stricter; none changes a page.
//
// Left out on purpose:
// - Strict-Transport-Security. It covers every port of a host name, so it would force the kiosk server on port 3003,
//   which is plain http, to https on the same PC and break the kiosk pages there.
// - A script rule in Content-Security-Policy. The pages use inline handlers and files from CDNs, so a script rule
//   needs those moved first.
function securityHeaders(req, res, next) {
    // a file is used as the type the server names, the browser never guesses another one
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // the pages cannot be shown inside a frame on another site (clickjacking); two headers for old and new browsers
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // also: forms only post back to this server, no <base> to another site, no plug-in content
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'");
    // a link to another site does not tell that site which kiosk page it came from
    res.setHeader('Referrer-Policy', 'same-origin');
    // browser features no page uses stay off, also for a script that should not be there
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), payment=(), usb=()');
    next();
}

// Call right after express(): the header that names the server software is dropped as well.
function apply(app) {
    app.disable('x-powered-by');
    app.use(securityHeaders);
}

module.exports = { apply, securityHeaders };
// <Jun Kai end>
