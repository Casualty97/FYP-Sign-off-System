// Owner: Role 3, Jun Kai.
// The sidebar of the admin page. The links themselves are in admin.html. This file folds and unfolds the groups, runs
// the page search (Ctrl K), hides the pages a role may not open and unfolds the group of the page that was opened.
// showPage() in navigation.js is not changed: this file only watches which link gets marked as the open page.
// <Jun Kai start>
const NAV_FOLD_KEY = 'adminNavFolded';
// groups shown unfolded the first time a browser opens the admin page; after that the browser remembers each group
const NAV_OPEN_AT_FIRST = ['visitors', 'monitoring'];

function navSidebar() {
    return document.getElementById('admin-sidebar');
}

function navGroups() {
    const sidebar = navSidebar();
    return sidebar ? [...sidebar.querySelectorAll('.nav-group')] : [];
}

function navLinks(scope) {
    const root = scope || navSidebar();
    return root ? [...root.querySelectorAll('.nav-item')] : [];
}

// a link the signed-in role may see (core.js also hides two of them with style.display)
function navAllowed(link) {
    return !link.hidden && link.style.display !== 'none';
}

function navSavedFolds() {
    try {
        const saved = JSON.parse(localStorage.getItem(NAV_FOLD_KEY) || 'null');
        return saved && typeof saved === 'object' ? saved : null;
    } catch {
        return null;
    }
}

function navSaveFolds() {
    const folds = {};
    for (const group of navGroups()) folds[group.dataset.group] = group.classList.contains('is-folded');
    try { localStorage.setItem(NAV_FOLD_KEY, JSON.stringify(folds)); } catch { /* private window: kept until the page closes */ }
}

// a folded group is also taken out of the Tab order (inert), except while a search shows its matches
function navSetFolded(group, folded) {
    const sidebar = navSidebar();
    group.classList.toggle('is-folded', folded);
    const toggle = group.querySelector('.nav-group-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', folded ? 'false' : 'true');
    const body = group.querySelector('.nav-group-body');
    if (body) body.inert = folded && !(sidebar && sidebar.classList.contains('is-searching'));
}

// how many pages a folded group holds, and no group at all when the role sees none of its pages
function navRefreshGroups() {
    for (const group of navGroups()) {
        const allowed = navLinks(group).filter(navAllowed).length;
        if (group.hidden !== (allowed === 0)) group.hidden = allowed === 0;
        const count = group.querySelector('.nav-group-count');
        if (count && count.textContent !== String(allowed)) count.textContent = String(allowed);
    }
}

// The Incidents count also shows on the Monitoring heading, so a folded group cannot hide it
function navMirrorBadges() {
    for (const group of navGroups()) {
        const mirror = group.querySelector('.nav-group-badge');
        if (!mirror) continue;
        const badge = [...group.querySelectorAll('.nav-item .inc-nav-badge')].find((b) => !b.hidden && navAllowed(b.closest('.nav-item')));
        if (mirror.hidden !== !badge) mirror.hidden = !badge;
        if (!badge) continue;
        if (mirror.textContent !== badge.textContent) mirror.textContent = badge.textContent;
        const critical = badge.classList.contains('is-critical');
        if (mirror.classList.contains('is-critical') !== critical) mirror.classList.toggle('is-critical', critical);
        const label = badge.getAttribute('aria-label') || '';
        if (mirror.getAttribute('aria-label') !== label) mirror.setAttribute('aria-label', label);
    }
}

// the group of the open page unfolds, wherever the page was opened from (a link, the search, a dashboard button)
function navRevealActive() {
    const sidebar = navSidebar();
    const active = sidebar && sidebar.querySelector('.nav-item.active');
    const group = active && active.closest('.nav-group');
    if (!group || !group.classList.contains('is-folded')) return;
    navSetFolded(group, false);
    navSaveFolds();
}

// Called by updateUIForUser() in core.js: the pages only a System Admin may open leave the sidebar and the search
function applySidebarRole(role) {
    const admin = role === 'system_admin';
    for (const link of navLinks()) {
        if (link.hasAttribute('data-admin-only') && link.hidden !== !admin) link.hidden = !admin;
    }
    navRefreshGroups();
    navMirrorBadges();
    const input = document.getElementById('nav-search');
    navFilter(input ? input.value : '');
}

function navPlain(text) {
    return String(text || '').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
}

// the links a search currently shows, top to bottom
function navHits() {
    return navLinks().filter((link) => navAllowed(link) && !link.classList.contains('nav-miss'));
}

function navSetCursor(index) {
    const hits = navHits();
    hits.forEach((link, i) => link.classList.toggle('nav-cursor', i === index));
    if (hits[index]) hits[index].scrollIntoView({ block: 'nearest' });
}

// Every word typed has to be in the page's name, its group or the name it had before the redesign. A page found only
// by its earlier name shows that name under the new one.
function navFilter(query) {
    const sidebar = navSidebar();
    if (!sidebar) return;
    const words = navPlain(query).split(' ').filter(Boolean);
    const searching = words.length > 0;
    sidebar.classList.toggle('is-searching', searching);
    let found = 0;
    for (const link of navLinks()) {
        link.classList.remove('nav-miss', 'nav-hit-was', 'nav-cursor');
        if (!searching || !navAllowed(link)) continue;
        const label = navPlain(link.querySelector('.nav-label') ? link.querySelector('.nav-label').textContent : link.textContent);
        const groupName = link.closest('.nav-group') ? navPlain(link.closest('.nav-group').querySelector('.nav-group-name').textContent) : '';
        const now = `${label} ${groupName}`;
        const before = `${now} ${navPlain(link.dataset.was)}`;
        const byName = words.every((word) => now.includes(word));
        const byEarlierName = !byName && Boolean(link.dataset.was) && words.every((word) => before.includes(word));
        if (!byName && !byEarlierName) { link.classList.add('nav-miss'); continue; }
        if (byEarlierName) link.classList.add('nav-hit-was');
        found++;
    }
    for (const section of sidebar.querySelectorAll('.sidebar-section')) {
        const any = navLinks(section).some((link) => navAllowed(link) && !link.classList.contains('nav-miss'));
        section.classList.toggle('nav-section-miss', searching && !any);
        const body = section.querySelector('.nav-group-body');
        if (body) body.inert = !searching && section.classList.contains('is-folded');
    }
    const empty = document.getElementById('nav-search-empty');
    if (empty && empty.hidden !== (!searching || found > 0)) empty.hidden = !searching || found > 0;
    if (searching && found > 0) navSetCursor(0);
}

function navClearSearch(input) {
    if (input.value) input.value = '';
    navFilter('');
}

function navSearchKey(event) {
    const input = event.currentTarget;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const hits = navHits();
        if (!hits.length) return;
        event.preventDefault();
        const at = hits.findIndex((link) => link.classList.contains('nav-cursor'));
        const step = event.key === 'ArrowDown' ? 1 : -1;
        navSetCursor(at < 0 ? 0 : (at + step + hits.length) % hits.length);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (!input.value.trim()) return;
        const hits = navHits();
        const target = hits.find((link) => link.classList.contains('nav-cursor')) || hits[0];
        if (!target) return;
        navClearSearch(input);
        input.blur();
        target.click();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        if (input.value) navClearSearch(input);
        else input.blur();
    }
}

function navInit() {
    const sidebar = navSidebar();
    if (!sidebar) return;
    const saved = navSavedFolds();
    for (const group of navGroups()) {
        const id = group.dataset.group;
        navSetFolded(group, saved && id in saved ? Boolean(saved[id]) : !NAV_OPEN_AT_FIRST.includes(id));
    }
    applySidebarRole(sessionStorage.getItem('userRole'));
    navRevealActive();

    sidebar.addEventListener('click', (event) => {
        const toggle = event.target.closest('.nav-group-toggle');
        if (!toggle || sidebar.classList.contains('is-searching')) return;
        const group = toggle.closest('.nav-group');
        navSetFolded(group, !group.classList.contains('is-folded'));
        navSaveFolds();
    });

    const input = document.getElementById('nav-search');
    if (input) {
        input.addEventListener('input', () => navFilter(input.value));
        input.addEventListener('keydown', navSearchKey);
    }
    // Ctrl K (Cmd K on a Mac) jumps to the search from anywhere on the admin page. The login page keeps the browser's own.
    document.addEventListener('keydown', (event) => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'k') return;
        const dashboard = document.getElementById('admin-dashboard');
        if (!input || !dashboard || dashboard.style.display === 'none') return;
        event.preventDefault();
        input.focus();
        input.select();
    });

    // a link that becomes the open page unfolds its group; a change of the Incidents count reaches the group heading
    new MutationObserver((changes) => {
        if (changes.some((c) => c.type === 'attributes' && c.attributeName === 'class' && c.target.classList.contains('nav-item') && c.target.classList.contains('active'))) navRevealActive();
        if (changes.some((c) => c.target.nodeType === 3 || (c.target.classList && c.target.classList.contains('inc-nav-badge')))) navMirrorBadges();
    }).observe(sidebar, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'], childList: true, characterData: true });

    // the folds only slide after the first paint, so the page does not open with groups closing
    requestAnimationFrame(() => sidebar.classList.add('nav-ready'));
}

navInit();
// <Jun Kai end>
