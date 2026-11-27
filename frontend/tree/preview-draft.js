// <Jun Kai start> The Tree Settings preview (admin page, Tree Adjustment B) shows the 2D or 3D tree with the admin's
// changes before they are saved. The admin page puts this tree page in a small frame with ?draft=1. This file then
// answers the page's own reads of /api/parameters with the saved settings plus the admin's unsaved ones (pulled from
// the admin page with treeAdjDraft), and the admin page calls treeAdjDraftChanged() to make the page read its
// settings again through its usual "settings" live update. The tree page's own code does the rest.
// On the wall (no ?draft=1, no admin page around it) this file does nothing at all.
(function () {
    'use strict';
    try {
        if (new URLSearchParams(window.location.search).get('draft') !== '1' || window.parent === window) return;
        const admin = window.parent;
        // reading the parent's location throws when it is another site: then this stays off
        if (admin.location.origin !== window.location.origin || typeof admin.treeAdjDraft !== 'function') return;
        const kind = /^\/(3dtree|tree-preview\/3d)/i.test(window.location.pathname) ? '3d' : '2d';

        const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
        const merge = (saved, draft) => {
            const out = { ...saved };
            for (const [key, value] of Object.entries(draft)) {
                out[key] = isPlainObject(value) && isPlainObject(saved[key]) ? merge(saved[key], value) : value;
            }
            return out;
        };

        const realFetch = window.fetch.bind(window);
        window.fetch = function (input, init) {
            let path = '';
            try { path = new URL(typeof input === 'string' ? input : input.url, window.location.href).pathname; } catch { /* not a URL */ }
            const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
            if (path !== '/api/parameters' || method !== 'GET') return realFetch(input, init);
            return realFetch(input, init).then(async (response) => {
                try {
                    const data = await response.clone().json();
                    const draft = admin.treeAdjDraft(kind);
                    if (!response.ok || !data || !data.success || !isPlainObject(draft)) return response;
                    data.parameters = merge(isPlainObject(data.parameters) ? data.parameters : {}, draft);
                    return new Response(JSON.stringify(data), { status: response.status, headers: { 'Content-Type': 'application/json' } });
                } catch {
                    return response; // the saved settings, as without the preview
                }
            });
        };

        // the page's live connection, so a change on the admin page can ask for a fresh read of the settings
        const RealEventSource = window.EventSource;
        const sources = [];
        if (typeof RealEventSource === 'function') {
            const PreviewEventSource = function (url, options) {
                const source = new RealEventSource(url, options);
                sources.push(source);
                return source;
            };
            PreviewEventSource.prototype = RealEventSource.prototype;
            ['CONNECTING', 'OPEN', 'CLOSED'].forEach((name) => { PreviewEventSource[name] = RealEventSource[name]; });
            window.EventSource = PreviewEventSource;
        }
        window.treeAdjDraftChanged = function () {
            for (const source of sources) {
                try { source.dispatchEvent(new MessageEvent('settings', { data: '{}' })); } catch { /* closed */ }
            }
        };
    } catch {
        // not inside the admin preview: the page works as always
    }
})();
// <Jun Kai end>
