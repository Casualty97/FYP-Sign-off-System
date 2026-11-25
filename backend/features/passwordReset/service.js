// Owner: Role 3, Jun Kai.
// <Jun Kai start>
// Resetting a forgotten admin password by email. Two ways to finish, the same reset behind both:
//   the 6 digit code typed on the admin page (works anywhere the admin page opens), or
//   the link in the email (opens the admin page with the token after "#", so it never reaches a server log).
// Rules:
//   - the answer to a request is the same whether or not the account exists, and the work happens after the answer,
//     so neither the words nor the time give an account away;
//   - only an active account that has an email gets one; at most 5 emails per account per hour, 60 s apart;
//   - a reset lasts 15 minutes; a new request replaces it; 5 wrong codes end it;
//   - finishing deletes the reset first (only one request can do that), then saves the password, so the code and the
//     link stop working at the same moment; every sign-in of the account ends; a "password changed" email follows.
// createService takes everything it uses, so the unit tests run it without a database or a mail server.
const tokens = require('./tokens');
const { TTL_MINUTES, MAX_CODE_TRIES } = require('./store');

const HOURLY_CAP = 5;
const COOLDOWN_SECONDS = 60;

const TEXT = {
    sent: `If that account exists and has an email, a 6 digit code and a link are on their way to it. They work once, for ${TTL_MINUTES} minutes. Check the spam folder too.`,
    noMail: 'Password reset by email is not set up on this kiosk yet. Ask a System Admin to set a new password for you on the Users page.',
    needIdentifier: 'Enter your username or the email of your account.',
    codeFormat: 'Enter the 6 digit code from the email.',
    codeWrongOrOld: 'That code is wrong or has expired. Ask for a new code.',
    tooManyCodes: 'Too many wrong codes. Ask for a new code.',
    linkOld: 'This link has expired or was already used. Ask for a new code.',
    mismatch: 'The two passwords are not the same.',
    saveFailed: 'The new password could not be saved. Ask for a new code and try again.',
};

const fail = (status, error, extra = {}) => ({ ok: false, status, error, ...extra });

function createService({ store, mailer, sessions, loginLimit, audit, hashPassword, passwordProblem, linkBase, now = () => new Date(), defer = setImmediate, log = console }) {
    const when = () => now().toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

    // the part that runs after the answer: never throws, every failure is only logged
    async function sendInBackground(identifier, ip) {
        try {
            const account = await store.findAccount(identifier);
            if (!account || !account.email) return;
            const recent = await store.recentRequests(account.id);
            if (recent.count >= HOURLY_CAP || (recent.secondsSinceLast !== null && recent.secondsSinceLast < COOLDOWN_SECONDS)) {
                audit('PASSWORD_RESET_LIMITED', account.username, account.id, ip);
                return;
            }
            const secrets = tokens.makeSecrets();
            await store.replaceReset(account.id, tokens.hashSecret('link', secrets.link), tokens.hashSecret('code', secrets.code), ip);
            const link = `${linkBase()}/admin#reset=${secrets.link}`;
            const sent = await mailer.sendReset(account.email, { username: account.username, code: secrets.code, link, minutes: TTL_MINUTES, ip, when: when() });
            if (!sent || !sent.success) {
                await store.deleteForUser(account.id); // nothing open that nobody received
                audit('PASSWORD_RESET_EMAIL_FAILED', account.username, account.id, ip);
                log.error(`Password reset email to account ${account.id} failed: ${sent && sent.error}`);
                return;
            }
            audit('PASSWORD_RESET_REQUESTED', account.username, account.id, ip);
        } catch (error) {
            log.error('Password reset request failed:', error.message);
        }
    }

    async function request({ identifier, ip }) {
        const text = String(identifier || '').trim();
        if (!text || text.length > 254) return fail(400, TEXT.needIdentifier);
        await store.ensureTables();
        // the same answer for every name: whether mail is set up says nothing about an account
        if (!(await mailer.ready())) return fail(503, TEXT.noMail, { mailNotSetUp: true });
        defer(() => sendInBackground(text, ip)); // the promise is only used by the tests
        return { ok: true, message: TEXT.sent };
    }

    // one counted try of a code; { reset } when it matches
    async function tryCode(identifier, code, ip) {
        const clean = tokens.cleanCode(code);
        if (!clean) return fail(400, TEXT.codeFormat);
        await store.ensureTables();
        const account = await store.findAccount(identifier);
        if (!account) return fail(400, TEXT.codeWrongOrOld);
        const reset = await store.useCodeTry(account.id);
        if (!reset) return fail(400, TEXT.codeWrongOrOld);
        if (!tokens.sameHash(tokens.hashSecret('code', clean), reset.code_hash)) {
            const left = MAX_CODE_TRIES - Number(reset.code_attempts);
            audit('PASSWORD_RESET_CODE_WRONG', account.username, account.id, ip);
            if (left <= 0) {
                await store.deleteReset(reset.id);
                return fail(400, TEXT.tooManyCodes);
            }
            return fail(400, `That code is wrong. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
        }
        return { ok: true, reset, account };
    }

    async function verifyCode({ identifier, code, ip }) {
        const result = await tryCode(identifier, code, ip);
        return result.ok ? { ok: true, username: result.account.username } : result;
    }

    async function checkLink({ token }) {
        const clean = tokens.cleanLink(token);
        if (!clean) return fail(400, TEXT.linkOld);
        await store.ensureTables();
        const reset = await store.findByLink(tokens.hashSecret('link', clean));
        return reset ? { ok: true, username: reset.username } : fail(400, TEXT.linkOld);
    }

    async function complete({ identifier, code, token, password, confirm, ip }) {
        if (String(password || '') !== String(confirm || '')) return fail(400, TEXT.mismatch);
        let reset;
        let account;
        if (token !== undefined && token !== null && token !== '') {
            const clean = tokens.cleanLink(token);
            if (!clean) return fail(400, TEXT.linkOld);
            await store.ensureTables();
            const found = await store.findByLink(tokens.hashSecret('link', clean));
            if (!found) return fail(400, TEXT.linkOld);
            reset = { id: found.id };
            account = { id: found.admin_user_id, username: found.username, email: found.email };
        } else {
            // the password rule first, so a too short password does not cost a try of the code
            const target = await store.findAccount(identifier);
            const early = passwordProblem(password, target ? target.username : '');
            if (early) return fail(400, early);
            const result = await tryCode(identifier, code, ip);
            if (!result.ok) return result;
            reset = result.reset;
            account = result.account;
        }
        const problem = passwordProblem(password, account.username);
        if (problem) return fail(400, problem);
        // the reset is used up before the password changes: a second request with the same code or link finds nothing
        if (!(await store.consume(reset.id))) return fail(400, token ? TEXT.linkOld : TEXT.codeWrongOrOld);
        let saved = false;
        try {
            saved = await store.setPassword(account.id, await hashPassword(password));
        } catch (error) {
            log.error('Saving a reset password failed:', error.message);
        }
        if (!saved) return fail(500, TEXT.saveFailed);
        await store.deleteForUser(account.id);
        sessions.end(account.id);
        loginLimit.forgetName(account.username);
        audit('PASSWORD_RESET_DONE', account.username, account.id, ip);
        if (account.email) {
            defer(() => mailer.sendChanged(account.email, { username: account.username, ip, when: when() }).catch(() => {}));
        }
        return { ok: true, username: account.username };
    }

    return { request, verifyCode, checkLink, complete };
}

module.exports = { createService, TEXT, HOURLY_CAP, COOLDOWN_SECONDS };
// <Jun Kai end>
