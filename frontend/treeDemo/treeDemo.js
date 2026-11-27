// <Jun Kai start> Tree Animation Demo (/tree-demo): a dock that plays the tree's leaf animations on demand, over the 3D
// tree (the default) or the 2D tree (/tree-demo?tree=2d), with a switch between the two. The server puts this script
// in the tree page's head, so it runs before the page's own scripts.
//   3D (Wei Jie's 3D page): in this browser tab only, the script stands between the page and the server. The page is
//     told the wall shows the 3D tree at full canopy (so it does not move to the 2D tree, and leaves show), pretend
//     leaves ("Demo visitor") fill the free spots when there are fewer real leaves than the tree shows, "A new leaf
//     lands" adds one pretend visitor (it appears at the bottom and floats up to the tree) and "Leaves fall" lowers
//     the number of leaves the tree shows for a moment, so the oldest drop at once.
//   2D (Wei Jie's 2D page): the page has its own demo (tree.js playDemoLanding, playDemoFalling); the dock presses its
//     buttons, hidden behind the dock, and follows its status.
// After each demo the real leaves come back. Nothing is sent to the server.
(() => {
    const KIND = new URLSearchParams(location.search).get('tree') === '2d' ? '2d' : '3d';
    document.documentElement.classList.add('tdemo-' + KIND);
    const realFetch = window.fetch.bind(window);
    const BADGES = ['feedback-completer', 'social-champion', 'governance-guardian', 'climate-champion', 'ocean-guardian'];
    const FALL_COUNT = 5;       // 3D: how many of the oldest leaves the falling demo drops
    const HOLD_MS = 3000;       // 3D: the new leaf stays on the tree this long before the demo ends
    const LANDING_2D_MS = 8600; // 2D: tree.js playDemoLanding runs this long
    const state = {
        source: null,           // 3D: the page's live connection, to tell it to look again at once
        max: 15,                // the tree's Maximum Visible Leaves (the 2D tree's setting, shared by both)
        fallMs2d: 4200,         // 2D: Leaf Fall Duration
        real: 0,                // 3D: real leaves this year
        filler: null,           // 3D: pretend leaves that fill the free spots, made once
        added: [],              // 3D: the pretend visitor of the landing demo
        dropBy: 0,              // 3D: the falling demo shows this many fewer leaves
        live: true,             // 3D: false while the Year Review shows a past year
        ready: false,           // the tree has loaded
        failed: false,          // 2D: the page said its demo failed
        timings: { appear: 900, showcase: 12000, float: 7200, fall: 4200 },
        demo: null              // the demo playing now
    };

    const num = (value, fallback, min, max) => {
        const n = Number(value);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };

    function readParameters(data) {
        const parameters = data && data.parameters;
        if (!parameters) return;
        const tree = parameters.treeParameters || {};
        const leaves = parameters.tree3dParameters || {};
        state.max = Math.max(1, Number(tree.leafFallThreshold) || 15);
        state.fallMs2d = Number(tree.leafFallDuration) || 4200;
        // the same limits as feedback-leaves.js uses
        state.timings = {
            appear: num(leaves.leafAppearMs, 900, 100, 5000),
            showcase: tree.leafShowcaseSeconds === undefined || tree.leafShowcaseSeconds === null || tree.leafShowcaseSeconds === ''
                ? 12000 : num(Number(tree.leafShowcaseSeconds) * 1000, 12000, 0, 30000),
            float: num(leaves.leafFloatMs, 7200, 2000, 20000),
            fall: num(leaves.leafFallMs, 4200, 500, 10000)
        };
        render();
    }

    // read once at the start, so the first leaves already know the tree's size and the dock its times
    const parametersReady = realFetch('/api/parameters', { cache: 'no-store' })
        .then((response) => response.json()).then(readParameters).catch(() => {});

    // ---------- 3D: between the page and the server ----------

    const shown = () => Math.min(state.real + (state.filler ? state.filler.length : 0) + state.added.length, state.max);

    function demoParameters(data) {
        readParameters(data);
        const tree = data.parameters.treeParameters = data.parameters.treeParameters || {};
        tree.treeDisplayMode = '3d';       // the demo is the 3D tree here
        tree.treeStage = 4;                // at full canopy, in Manual, so the leaves show
        tree.treeStageMode = 'manual';
        delete tree.treeStageAuto;
        if (state.dropBy) tree.leafFallThreshold = Math.max(1, shown() - state.dropBy);
        return data;
    }

    function demoVisitors(list) {
        const real = Array.isArray(list) ? list : [];
        state.real = real.length;
        if (!state.filler) {
            // older than the page's "recent" window, so they sit on the tree at once and are the first to fall
            const at = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
            state.filler = Array.from({ length: Math.max(0, state.max - real.length) }, (_, i) => ({
                feedback_id: `demo-fill-${i + 1}`, name: `Demo visitor ${i + 1}`, created_at: at,
                badgeKey: BADGES[i % BADGES.length], isDemo: true
            }));
        }
        return [...real, ...state.filler, ...state.added];
    }

    async function rewrite(response, change) {
        if (!response.ok) return response;
        try {
            const data = await response.clone().json();
            return new Response(JSON.stringify(change(data)), {
                status: response.status, statusText: response.statusText, headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            return response;
        }
    }

    if (KIND === '3d') {
        window.fetch = async (input, init) => {
            const url = new URL(typeof input === 'string' ? input : input.url, location.href);
            const response = await realFetch(input, init);
            if (url.origin !== location.origin) return response;
            if (url.pathname === '/api/parameters') return rewrite(response, (data) => (data && data.parameters ? demoParameters(data) : data));
            if (url.pathname === '/api/tree' && !url.searchParams.has('year')) {
                await parametersReady;
                return rewrite(response, demoVisitors);
            }
            return response;
        };

        // the page's live connection: a "tree" message on it makes the page look at its leaves and settings again
        const RealEventSource = window.EventSource;
        if (typeof RealEventSource === 'function') {
            window.EventSource = function DemoEventSource(url, options) {
                const source = new RealEventSource(url, options);
                if (String(url).includes('/api/tree/events')) state.source = source;
                return source;
            };
            window.EventSource.prototype = RealEventSource.prototype;
            Object.assign(window.EventSource, { CONNECTING: 0, OPEN: 1, CLOSED: 2 });
        }

        document.addEventListener('esg-tree-year', (event) => {
            state.live = !event.detail || event.detail.live !== false;
            if (!state.live) stop();
            render();
        });
    }

    function lookAgain() {
        if (state.source) state.source.dispatchEvent(new Event('tree'));
        else window.dispatchEvent(new Event('tree-vip-refresh')); // leaves only; the settings follow within 5 s
    }

    // ---------- the demos ----------

    const seconds = (ms) => Math.max(1, Math.round(ms / 1000));
    function landingMs() {
        if (KIND === '2d') return LANDING_2D_MS;
        return state.timings.appear + state.timings.showcase + state.timings.float * 1.17
            + (state.real + (state.filler ? state.filler.length : 0) >= state.max ? state.timings.fall : 0) + HOLD_MS;
    }
    function fallingMs() {
        if (KIND === '3d') return state.timings.fall + 1500;
        // tree.js playDemoFalling: the leaves leave one after another, then fall, then the live tree comes back
        const count = Math.max(3, state.max);
        return Math.min(1600, count * 105 + 1070) + Math.max(1200, state.fallMs2d) + 1400;
    }

    const status2d = () => document.getElementById('demoStatus');

    function play(kind) {
        if (state.demo || !state.live || !state.ready) return;
        state.failed = false;
        if (KIND === '2d') {
            const button = document.getElementById(kind === 'landing' ? 'demoLandingButton' : 'demoFallingButton');
            if (!button || button.disabled) return;
            button.click();
            state.demo = { kind, label: kind === 'landing' ? 'a new leaf lands' : 'the leaves fall', start: performance.now(), ms: kind === 'landing' ? landingMs() : fallingMs() };
            // the page says Ready again when its demo is over; this is only in case it never does
            state.demo.timer = window.setTimeout(finish, state.demo.ms + 4000);
        } else if (kind === 'landing') {
            const n = Date.now();
            state.added = [{ feedback_id: `demo-new-${n}`, name: 'Demo visitor', created_at: new Date().toISOString(),
                badgeKey: BADGES[n % BADGES.length], isDemo: true }];
            state.demo = { kind, label: 'a new leaf lands', start: performance.now(), ms: landingMs() };
            state.demo.timer = window.setTimeout(stop, state.demo.ms);
            lookAgain();
        } else {
            const drop = Math.min(FALL_COUNT, shown() - 1);
            if (drop < 1) return;
            state.dropBy = drop;
            state.demo = { kind, label: drop === 1 ? 'the oldest leaf falls' : `the ${drop} oldest leaves fall`, start: performance.now(), ms: fallingMs() };
            state.demo.timer = window.setTimeout(stop, state.demo.ms);
            lookAgain();
        }
        render();
        tick();
    }

    // 3D: ends the demo now or when its time is up: the pretend leaf goes, the leaves that fell come back
    function stop() {
        if (!state.demo || KIND !== '3d') return;
        window.clearTimeout(state.demo.timer);
        state.demo = null;
        state.added = [];
        state.dropBy = 0;
        lookAgain();
        render();
    }

    // 2D: the page's own demo is over
    function finish() {
        if (!state.demo) return;
        window.clearTimeout(state.demo.timer);
        state.demo = null;
        render();
    }

    // ---------- the dock ----------

    const ICON_LEAF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>';
    const ICON_FALL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3c2 1 3 3 2 5s-3 2-4 1-1-4 2-6Z"/><path d="M15 9c2 1 3 3 2 5s-3 2-4 1-1-4 2-6Z"/><path d="M8 15c2 1 3 3 2 5s-3 2-4 1-1-4 2-6Z"/></svg>';
    const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
    const ICON_STOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
    let dock = null;

    function card(kind, icon, title, text) {
        return `<div class="tdemo-card">
            <span class="tdemo-icon">${icon}</span>
            <span class="tdemo-text"><b>${title}</b><span>${text}</span></span>
            <button type="button" class="tdemo-btn tdemo-btn-primary" data-demo="${kind}">${ICON_PLAY}<span>Play</span></button>
        </div>`;
    }

    function note() {
        if (!state.live) return 'The Year Review is showing a past year. Press Live in the Year Review to play a demo.';
        if (state.failed) return 'The demo could not play. Try again.';
        const filled = KIND === '3d' && state.filler ? state.filler.length : 0;
        return `Plays on the full grown ${KIND.toUpperCase()} tree, in this tab only. Nothing is saved, and the real leaves come back after each demo.`
            + (filled ? ` ${filled === 1 ? 'One demo leaf fills' : `${filled} demo leaves fill`} the free spots on the tree.` : '');
    }

    function render() {
        if (!dock) return;
        const demo = state.demo;
        dock.classList.toggle('is-playing', !!demo);
        window.requestAnimationFrame(placeDock);
        if (demo) {
            dock.innerHTML = `<span class="tdemo-dot" aria-hidden="true"></span>
                <span class="tdemo-now"><b>Playing: ${demo.label}</b><span class="tdemo-bar"><i></i></span></span>
                <span class="tdemo-left" aria-hidden="true"></span>
                ${KIND === '3d' ? `<button type="button" class="tdemo-btn tdemo-btn-secondary" data-demo-stop>${ICON_STOP}<span>Stop</span></button>` : ''}`;
            return;
        }
        const fallText = KIND === '3d' ? 'When the tree is full, the oldest leaves drop.' : 'When the tree is full, its leaves drop to make room.';
        dock.innerHTML = `<div class="tdemo-cards">
                ${card('landing', ICON_LEAF, 'A new leaf lands', `What a visitor sees after giving feedback. About ${seconds(landingMs())} s.`)}
                ${card('falling', ICON_FALL, 'Leaves fall', `${fallText} About ${seconds(fallingMs())} s.`)}
            </div>
            <div class="tdemo-foot">
                <div class="tdemo-switch" role="group" aria-label="Which tree the demo shows">
                    <button type="button" data-tree="3d" aria-pressed="${KIND === '3d'}">3D tree</button>
                    <button type="button" data-tree="2d" aria-pressed="${KIND === '2d'}">2D tree</button>
                </div>
                <p class="tdemo-note">${note()}</p>
            </div>`;
        dock.querySelectorAll('[data-demo]').forEach((button) => { button.disabled = !state.live || !state.ready; });
    }

    function tick() {
        const demo = state.demo;
        if (!demo || !dock) return;
        const done = Math.min(1, (performance.now() - demo.start) / demo.ms);
        const bar = dock.querySelector('.tdemo-bar i');
        const left = dock.querySelector('.tdemo-left');
        if (bar) bar.style.width = `${Math.round(done * 100)}%`;
        if (left) left.textContent = `${Math.max(0, Math.ceil((demo.ms - (performance.now() - demo.start)) / 1000))} s left`;
        window.requestAnimationFrame(tick);
    }

    // the dock never covers the page's own controls (3D: the controls bar, which takes two rows on a phone), the Year
    // Review button or the title box when it sits in the dock's way: it moves up above whichever is in the way
    function placeDock() {
        if (!dock) return;
        dock.style.bottom = '';
        const b = dock.getBoundingClientRect();
        const others = KIND === '3d' ? ['.controls', '.year-review-toggle'] : ['.year-review-toggle', '.tree-title'];
        if (KIND === '3d' && document.body.classList.contains('title-at-bottom')) others.push('.masthead');
        let lift = 0;
        for (const selector of others) {
            const el = document.querySelector(selector);
            if (!el || el.getClientRects().length === 0) continue;
            const a = el.getBoundingClientRect();
            if (a.right > b.left + 2 && a.left < b.right - 2 && a.bottom > b.top + 2 && a.top < b.bottom - 2) lift = Math.max(lift, b.bottom - a.top + 12);
        }
        if (lift) dock.style.bottom = `${Math.round(window.innerHeight - b.bottom + lift)}px`;
    }

    function setReady(ready) {
        if (ready === state.ready) return;
        state.ready = ready;
        dock.classList.toggle('is-ready', ready);
        document.title = 'Tree Animation Demo | RP Xperience Centre';
        render();
    }

    function mountDock() {
        const root = document.querySelector('main.reserve') || document.body;
        document.body.classList.add('tree-demo-page');
        dock = document.createElement('section');
        dock.className = 'tdemo-dock';
        dock.setAttribute('aria-label', 'Tree animation demos');
        dock.setAttribute('aria-live', 'polite');
        dock.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (!button) return;
            if (button.hasAttribute('data-demo-stop')) stop();
            else if (button.dataset.demo) play(button.dataset.demo);
            else if (button.dataset.tree && button.dataset.tree !== KIND && !state.demo) {
                location.assign(button.dataset.tree === '2d' ? '/tree-demo?tree=2d' : '/tree-demo');
            }
        });
        root.appendChild(dock);
        render();
        if (KIND === '3d') {
            // the 3D page shows everything at once when its scene is ready (scene.js sets data-ready); the dock too
            const reserve = document.querySelector('main.reserve');
            const check = () => setReady(reserve?.dataset.ready === 'true');
            check();
            if (reserve) new MutationObserver(check).observe(reserve, { attributes: true, attributeFilter: ['data-ready'] });
            // the title box moves when the admin changes its place (tree3d-settings.js sets a class on the body)
            new MutationObserver(placeDock).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        } else {
            // the 2D page builds its demo buttons and status when it loads, and says Ready when the tree is drawn
            const wait = window.setInterval(() => {
                const status = status2d();
                if (!status) return;
                window.clearInterval(wait);
                const follow = () => {
                    const text = status.textContent.trim();
                    if (text === 'Ready') { setReady(true); finish(); } else if (/failed/i.test(text)) { state.failed = true; finish(); }
                };
                follow();
                new MutationObserver(follow).observe(status, { childList: true, characterData: true, subtree: true });
            }, 300);
        }
        window.addEventListener('resize', placeDock);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountDock);
    else mountDock();
})();
// <Jun Kai end>
