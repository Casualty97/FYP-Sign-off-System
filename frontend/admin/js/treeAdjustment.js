// <Jun Kai start> Tree Settings, Tree Adjustment B (admin redesign) on Wei Jie's page. His sections stay as they are and
// become folds on the left: a closed fold shows its current value, and says when it has changes that are not saved yet.
// On the right a preview shows the 2D or 3D tree with the fields as they are now, saved or not: the tree page in the
// frame reads them from treeAdjDraft (frontend/tree/preview-draft.js). Nothing here changes his functions. It reads his
// fields, calls his collectors (collectTree3dSettings, collectTree3dVisual, collectTreeTitleSettings and the shared
// collectParameterForm) and wraps his two delete functions so their question shows in the kit window.

const TREEADJ_FRAME_WIDTH = 1600; // the preview draws the tree screen this big, then scales it down to the card
const TREEADJ_FRAME_HEIGHT = 900;
const TREEADJ_TICK_MS = 800;
const TREEADJ_SAVED_CHECK_MS = 15000;
// the server's preview addresses show either tree, also the one not chosen for the wall yet (backend/server.js)
const TREEADJ_FRAME_SRC = { '2d': '/tree-preview/2d?draft=1', '3d': '/tree-preview/3d?viewEditor=1&draft=1' };
const TREEADJ_OPEN_TREE = { '2d': '/tree', '3d': '/3dtree' };
const TREEADJ_STYLE_NAMES = { painted: 'Painted', natural: 'Natural', digital: 'Digital' };
const TREEADJ_FIRST_FOLD = { '2d': 'tree-display', '3d': 'stage3d' };
const TREEADJ_CHEVRON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

let treeAdjSaved = null;     // /api/parameters as the server last answered it
let treeAdjLeafCount = null; // this year's leaves, for the stage in Auto
let treeAdjTimer = null;
let treeAdjSavedTimer = null;
let treeAdjLastDraft = '';
let treeAdjOpened = false;
let treeAdjFoldsReady = false;
let treeAdjOpenedAt = 0;
let treeAdjLoaded = {};          // what his form showed after loading, for settings the server has no value for
const TREEADJ_SETTLE_MS = 3000;  // his loaders fill the fields within this time after the page opens

const treeAdjEl = (id) => document.getElementById(id);
const treeAdjChecked = (id) => Boolean(treeAdjEl(id)?.checked);
const treeAdjValue = (id) => treeAdjEl(id)?.value;
function treeAdjNumber(id) {
    const field = treeAdjEl(id);
    if (!field || field.value === '') return undefined;
    const number = Number(field.value);
    return Number.isFinite(number) ? number : undefined;
}
const treeAdjMode = () => (treeAdjValue('param-treeDisplayMode') === '3d' ? '3d' : '2d');
const treeAdjChosenText = (id) => {
    const select = treeAdjEl(id);
    return select && select.selectedIndex >= 0 ? select.options[select.selectedIndex].text.trim() : '';
};

// The screen size the way the server keeps it (backend/features/parameters/screenSize.js): a preset with its own size
function treeAdjScreenSize(prefix) {
    if (typeof readScreenSizeFields !== 'function') return undefined;
    const chosen = readScreenSizeFields(prefix);
    if (!chosen) return undefined;
    if (chosen.preset === 'auto') return { preset: 'auto', width: null, height: null };
    if (chosen.preset === 'custom') {
        return chosen.width > 0 && chosen.height > 0 ? { preset: 'custom', width: Math.round(chosen.width * 1000) / 1000, height: Math.round(chosen.height * 1000) / 1000 } : undefined;
    }
    const preset = (typeof SCREEN_SIZE_PRESETS !== 'undefined' ? SCREEN_SIZE_PRESETS : []).find(([key]) => key === chosen.preset);
    return preset ? { preset: chosen.preset, width: preset[2], height: preset[3] } : undefined;
}

// The growth stage fields of the 2D Tree Display or of the 3D Tree Growth Stage (both are the tree's one stage)
function treeAdjStage(kind) {
    const auto = kind === '3d'
        ? document.querySelector('input[name="tree3dStageMode"]:checked')?.value !== 'manual'
        : document.querySelector('input[name="stageMode"]:checked')?.value !== 'manual';
    const prefix = kind === '3d' ? 'tree3d-thresholdStage' : 'threshold-stage';
    const thresholds = {};
    [1, 2, 3, 4].forEach((n) => { thresholds[`stage${n}`] = parseInt(treeAdjValue(prefix + n), 10) || 0; });
    let stage = Math.max(0, Math.min(4, Number(treeAdjValue(kind === '3d' ? 'tree3d-treeStage' : 'param-treeStage')) || 0));
    // In Auto the server works the stage out from its own leaf count. Only when Auto or its thresholds are not saved
    // yet does the preview work out a stage itself, from this year's leaves as the admin page counts them.
    const saved = treeAdjSaved?.treeParameters || {};
    const autoAsSaved = auto && saved.treeStageMode === 'auto' && treeAdjSame(thresholds, saved.leafThresholds) && Number.isFinite(Number(saved.treeStage));
    if (autoAsSaved) stage = Number(saved.treeStage);
    else if (auto && treeAdjLeafCount !== null && typeof getStageFromLeafCount === 'function') stage = getStageFromLeafCount(treeAdjLeafCount, thresholds);
    return { auto, stage, thresholds, autoAsSaved };
}

function treeAdjStageValues(kind) {
    const { auto, stage, thresholds, autoAsSaved } = treeAdjStage(kind);
    const values = { 'treeParameters.treeStageMode': auto ? 'auto' : 'manual', 'treeParameters.leafThresholds': thresholds };
    if (!auto || (!autoAsSaved && treeAdjLeafCount !== null)) values['treeParameters.treeStage'] = stage;
    return values;
}

// The picture chosen in one of his picture lists (the tile he marks with data-selected)
function treeAdjChosenTile(listId) {
    return treeAdjEl(listId)?.querySelector('[data-selected="true"]') || null;
}
const treeAdjTileName = (tile) => (tile?.querySelector('span')?.textContent || '').replace(/\s*\(default\)$/, '').trim();

function treeAdjBackground() {
    const tile = treeAdjChosenTile('param-treeBackgroundList');
    if (!tile?.dataset.backgroundFilename) return undefined;
    const path = `/assets/Tree/background/${tile.dataset.backgroundFilename}`;
    // no background saved, or a saved one whose file is gone, means the 2D tree shows its default one: the default tile
    // then stands for what is saved, so the fold does not say "Not saved" before anything was changed
    const saved = treeAdjSaved?.visualAssets?.treeBackground;
    const isDefault = typeof DEFAULT_TREE_BACKGROUND === 'string' && path === DEFAULT_TREE_BACKGROUND;
    if (isDefault && saved === '') return '';
    if (isDefault && treeAdjSavedMissing()) return saved;
    return path;
}

// true while the saved background is the picture his list found missing (tree.js marks it in data-saved-missing)
function treeAdjSavedMissing() {
    const missing = treeAdjEl('param-treeBackgroundList')?.dataset.savedMissing;
    let file = String(treeAdjSaved?.visualAssets?.treeBackground || '').split('/').pop();
    if (!missing || !file) return false;
    try { file = decodeURIComponent(file); } catch { /* keep the name as saved */ }
    return file === missing;
}

const TREEADJ_3D_KEYS = {
    visual3d: ['leafAreaWidth', 'leafAreaHeight', 'leafAreaOffset', 'leafRefreshMs', 'leafOpacity', 'leafAppearMs', 'leafShowcaseSeconds',
        'leafFloatMs', 'leafFallMs', 'leafBatchCount', 'leafBatchSize', 'leafBatchMode', 'badgeColours', 'badgeLeafColors'],
    leaf3d: ['showFeedbackLeaves', 'showLeafNames', 'leafNameScroll', 'leafNewColor', 'leafOldColor', 'leafSide', 'leafNewHours', 'leafScale',
        'leafNameFont', 'leafNameWeight', 'leafNameColor', 'leafNameSize'],
    vip3d: ['vipLeafColor', 'vipLeafScale', 'vipLeafBrightness', 'vipGlow', 'vipSparkle', 'vipTurn', 'vipNameOwnStyle', 'vipNameFont',
        'vipNameWeight', 'vipNameColor', 'vipNameSize'],
    title3d: ['titleBox']
};

// his 3D settings, split over the folds they are shown in; anything not listed belongs to 3D Scene Controls
function treeAdj3dValues(fold) {
    if (typeof collectTree3dSettings !== 'function' || !treeAdjEl('tree3d-glowLook')) return {};
    const all = collectTree3dSettings();
    if (all.screenSize) all.screenSize = treeAdjScreenSize('tree3d') || all.screenSize;
    const listed = Object.values(TREEADJ_3D_KEYS).flat();
    const keys = fold === 'scene3d' ? Object.keys(all).filter((key) => !listed.includes(key)) : TREEADJ_3D_KEYS[fold];
    const values = {};
    keys.forEach((key) => { if (all[key] !== undefined) values[`tree3dParameters.${key}`] = all[key]; });
    return values;
}

function treeAdjCanopyValues() {
    if (typeof collectParameterForm !== 'function') return {};
    const form = collectParameterForm();
    const tree = form.treeParameters || {};
    const values = {};
    ['ovalWidth', 'ovalHeight', 'ovalTopOffset', 'leafRefreshInterval', 'leafOpacity', 'leafAnimationDuration', 'leafShowcaseSeconds',
        'leafFallThreshold', 'leafFallDuration'].forEach((key) => { values[`treeParameters.${key}`] = tree[key]; });
    const badges = form.badgeLeafStyles || {};
    values['badgeLeafStyles.leafScale'] = badges.leafScale;
    values['badgeLeafStyles.colors'] = badges.colors;
    // read from the field itself. His form shows a saved 0 (not set) as 24 hours, so 24 then means "unchanged".
    const hours = treeAdjNumber('param-tintDurationHours');
    if (hours !== undefined) {
        const shown = Math.round((hours / (treeAdjValue('param-tintDurationUnit') === 'minutes' ? 60 : 1)) * 1000) / 1000;
        const saved = Number(treeAdjSaved?.badgeLeafStyles?.tintDurationHours);
        values['badgeLeafStyles.tintDurationHours'] = !(saved > 0) && shown === 24 ? saved : shown;
    }
    return values;
}

// Each fold: which tree it belongs to, the values it holds (as /api/parameters gives them back) and what a closed
// fold says. "display" is the Display 2D/3D Tree card on top, which stays open.
const TREEADJ_FOLDS = {
    display: {
        kinds: ['2d', '3d'],
        values: () => ({ 'treeParameters.treeDisplayMode': treeAdjMode() }),
        summary: () => (treeAdjMode() === '3d' ? '3D tree' : '2D tree')
    },
    'tree-display': {
        kinds: ['2d'],
        values: () => ({ ...treeAdjStageValues('2d'), 'treeParameters.showTitleBox': treeAdjChecked('param-showTitleBox'),
            'treeParameters.treeStyle': treeAdjValue('param-treeStyle') || undefined, 'treeParameters.screenSize': treeAdjScreenSize('param') }),
        summary: () => {
            const { auto, stage } = treeAdjStage('2d');
            const style = TREEADJ_STYLE_NAMES[treeAdjValue('param-treeStyle')] || '';
            return `${auto ? 'Auto' : 'Manual'}, stage ${stage}${style ? `, ${style}` : ''}`;
        }
    },
    background: {
        kinds: ['2d'],
        values: () => ({ 'visualAssets.treeBackground': treeAdjBackground() }),
        summary: () => {
            const chosen = treeAdjTileName(treeAdjChosenTile('param-treeBackgroundList'));
            if (chosen && treeAdjSavedMissing() && treeAdjBackground() === treeAdjSaved.visualAssets.treeBackground) return `${chosen} (the saved picture is missing)`;
            if (chosen) return chosen;
            // the saved picture is not in the list (its file is gone): say which one is saved
            const saved = String(treeAdjSaved?.visualAssets?.treeBackground || '').split('/').pop().replace(/\.[a-z0-9]+$/i, '');
            return saved ? `${saved} (file not found)` : 'Default background';
        }
    },
    leaf: {
        kinds: ['2d'],
        values: () => ({ 'visualAssets.leafImage': treeAdjChosenTile('param-existingLeafList')?.dataset.leafPath,
            'treeParameters.leafDisplayScale': treeAdjNumber('param-leafDisplayScale') }),
        summary: () => [treeAdjTileName(treeAdjChosenTile('param-existingLeafList')), `scale ${treeAdjNumber('param-leafDisplayScale') ?? 1}`].filter(Boolean).join(', ')
    },
    'vip-leaf': {
        kinds: ['2d'],
        values: () => ({ 'visualAssets.vipLeafImage': treeAdjChosenTile('param-existingVipLeafList')?.dataset.leafPath,
            'treeParameters.vipLeafDisplayScale': treeAdjNumber('param-vipLeafDisplayScale') }),
        summary: () => [treeAdjTileName(treeAdjChosenTile('param-existingVipLeafList')), `scale ${treeAdjNumber('param-vipLeafDisplayScale') ?? 1}`].filter(Boolean).join(', ')
    },
    'title-box': {
        kinds: ['2d'],
        values: () => (typeof collectTreeTitleSettings === 'function' ? { 'treeParameters.treeTitleBox': collectTreeTitleSettings() } : {}),
        summary: () => (treeAdjChecked('param-showTitleBox') ? `Shown, ${treeAdjChosenText('param-titlePosition').toLowerCase()}` : 'Hidden')
    },
    canopy: {
        kinds: ['2d'],
        values: treeAdjCanopyValues,
        summary: () => `${treeAdjNumber('param-leafFallThreshold') ?? 15} leaves at most, ${document.querySelectorAll('#tree-parameters-tab input[type="color"]').length} badge colours`
    },
    stage3d: {
        kinds: ['3d'],
        values: () => treeAdjStageValues('3d'),
        summary: () => {
            const { auto, stage } = treeAdjStage('3d');
            return `${auto ? 'Auto' : 'Manual'}, stage ${stage}`;
        }
    },
    visual3d: {
        kinds: ['3d'],
        values: () => ({ ...treeAdj3dValues('visual3d'), 'treeParameters.leafFallThreshold': treeAdjNumber('tree3d-maxVisibleLeaves'),
            'treeParameters.leafShowcaseSeconds': treeAdjNumber('tree3d-leafShowcaseSeconds') }),
        summary: () => `${treeAdjNumber('tree3d-maxVisibleLeaves') ?? 15} leaves at most, opacity ${treeAdjNumber('tree3d-leafOpacity') ?? 1}`
    },
    scene3d: {
        kinds: ['3d'],
        values: () => treeAdj3dValues('scene3d'),
        summary: () => [treeAdjChecked('tree3d-glowLook') ? 'Glowing look' : 'Natural look', treeAdjChosenText('tree3d-weatherSource'),
            treeAdjChecked('tree3d-soundEnabled') ? 'sound on' : 'sound off'].filter(Boolean).join(', ')
    },
    view3d: {
        kinds: ['3d'],
        values: () => ({}), // a snapshot is saved by its own button at once
        summary: () => {
            const views = typeof tree3dViews !== 'undefined' ? tree3dViews : null;
            const inUse = views?.saved?.find((view) => view.id === views.inUse);
            return inUse ? `Screens show "${inUse.name}"` : 'Screens show the standard view';
        }
    },
    leaf3d: {
        kinds: ['3d'],
        values: () => treeAdj3dValues('leaf3d'),
        summary: () => [treeAdjChecked('tree3d-showFeedbackLeaves') ? 'Leaves shown' : 'Leaves hidden',
            treeAdjChecked('tree3d-showLeafNames') ? 'names on' : 'names off'].join(', ')
    },
    vip3d: {
        kinds: ['3d'],
        values: () => treeAdj3dValues('vip3d'),
        summary: () => {
            const effects = [['tree3d-vipGlow', 'glow'], ['tree3d-vipSparkle', 'star'], ['tree3d-vipTurn', 'turn']].filter(([id]) => treeAdjChecked(id)).map(([, name]) => name);
            return effects.length ? `Gold, ${effects.join(', ')}` : 'Gold, no effects';
        }
    },
    title3d: {
        kinds: ['3d'],
        values: () => treeAdj3dValues('title3d'),
        summary: () => (treeAdjChecked('tree3d-showTitleBox') ? `Shown: ${(treeAdjValue('tree3d-titleText') || '').trim()}` : 'Hidden')
    }
};

function treeAdjValues(key) {
    try {
        const values = TREEADJ_FOLDS[key].values() || {};
        Object.keys(values).forEach((path) => { if (values[path] === undefined) delete values[path]; });
        return values;
    } catch (error) {
        console.warn(`Tree Settings preview: the fold ${key} could not be read.`, error);
        return {};
    }
}

function treeAdjSet(target, path, value) {
    const keys = path.split('.');
    let node = target;
    keys.slice(0, -1).forEach((key) => { if (!node[key] || typeof node[key] !== 'object') node[key] = {}; node = node[key]; });
    node[keys[keys.length - 1]] = value;
}

function treeAdjGet(source, path) {
    return path.split('.').reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), source);
}

// The settings the preview frame shows: the saved ones with every field of that tree's folds on top. The frame's own
// kind is forced, so the 2D page never moves on to the 3D page (or back) because of the saved choice.
function treeAdjDraft(kind) {
    const draft = {};
    Object.keys(TREEADJ_FOLDS).forEach((key) => {
        if (!TREEADJ_FOLDS[key].kinds.includes(kind)) return;
        Object.entries(treeAdjValues(key)).forEach(([path, value]) => treeAdjSet(draft, path, value));
    });
    treeAdjSet(draft, 'treeParameters.treeDisplayMode', kind === '3d' ? '3d' : '2d');
    // the 3D tree uses the 2D badge colours for any badge it leaves at its built in colour
    if (kind === '3d') {
        const colours = treeAdjValues('canopy')['badgeLeafStyles.colors'];
        if (colours) treeAdjSet(draft, 'badgeLeafStyles.colors', colours);
    }
    return draft;
}

function treeAdjSame(now, saved) {
    if (saved === undefined || saved === null) return true; // nothing saved to compare with
    if (Array.isArray(now) || Array.isArray(saved)) return JSON.stringify(now) === JSON.stringify(saved);
    if (now && typeof now === 'object') return typeof saved === 'object' && Object.keys(now).every((key) => treeAdjSame(now[key], saved[key]));
    if (typeof now === 'boolean' || typeof saved === 'boolean') return Boolean(now) === Boolean(saved);
    if (typeof now === 'number' || typeof saved === 'number') {
        const a = Number(now);
        const b = Number(saved);
        if (Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b) < 1e-6;
    }
    return String(now ?? '').trim().toLowerCase() === String(saved ?? '').trim().toLowerCase();
}

// The paths of one fold that differ from what the server has. A setting the server has no value for yet (an older
// settings file) is compared with what his form showed once his loaders had filled it in.
function treeAdjChanges(key) {
    if (!treeAdjSaved) return [];
    const settled = Date.now() - treeAdjOpenedAt > TREEADJ_SETTLE_MS;
    return Object.entries(treeAdjValues(key)).filter(([path, value]) => {
        const saved = treeAdjGet(treeAdjSaved, path);
        if (saved !== undefined && saved !== null) return !treeAdjSame(value, saved);
        if (!settled) return false;
        const id = `${key}|${path}`;
        if (!(id in treeAdjLoaded)) treeAdjLoaded[id] = JSON.stringify(value);
        return treeAdjLoaded[id] !== JSON.stringify(value);
    }).map(([path]) => path);
}

const treeAdjFoldTitle = (section) => section.querySelector('.treeadj-fold-title')?.textContent.trim()
    || section.querySelector(':scope > .section-header h3')?.textContent.trim() || '';

function treeAdjRememberedOpen() {
    try { return JSON.parse(localStorage.getItem('treeAdjOpenFolds') || 'null'); } catch { return null; }
}

function treeAdjRememberOpen() {
    const open = [...document.querySelectorAll('#tree-adjustment-page [data-treeadj-fold].is-open')].map((section) => section.dataset.treeadjFold);
    try { localStorage.setItem('treeAdjOpenFolds', JSON.stringify(open)); } catch { /* no storage: the folds just open as at first */ }
}

function treeAdjSetOpen(section, open) {
    section.classList.toggle('is-open', open);
    section.querySelector('.treeadj-fold-toggle')?.setAttribute('aria-expanded', String(open));
}

// <Jun Kai start> his buttons in the kit look. His btn-primary / btn-secondary are painted by the theme (themes.js), so they
// showed as plain text or as the old blue. Each section's buttons from its heading go in one row on the right (Reset
// and the like first, Save last), and every button of his gets the kit classes: Save and the background's Apply in
// green, the rest plain, Delete in red. His onclick names and ids stay, so view only still hides the change buttons.
const TREEADJ_PRIMARY = /^(save|selectTreeBackground)/;
function treeAdjKitButton(button) {
    const action = (button.getAttribute('onclick') || '').trim().split('(')[0];
    button.classList.remove('btn', 'btn-primary', 'btn-secondary', 'btn-danger');
    button.classList.add('ui-btn', /^delete/i.test(action) ? 'ui-btn-danger' : TREEADJ_PRIMARY.test(action) ? 'ui-btn-primary' : 'ui-btn-secondary');
}
function treeAdjKitButtons(section) {
    const header = section.querySelector(':scope > .section-header');
    if (!header) return;
    const isPrimary = (button) => TREEADJ_PRIMARY.test((button.getAttribute('onclick') || '').trim());
    const buttons = [...header.querySelectorAll('button[onclick]')].filter((button) => !button.classList.contains('treeadj-fold-toggle'));
    if (buttons.length) {
        const row = document.createElement('div');
        row.className = 'treeadj-actions';
        buttons.sort((a, b) => Number(isPrimary(a)) - Number(isPrimary(b))).forEach((button) => row.appendChild(button));
        // the boxes they sat in are empty now
        [...header.children].forEach((child) => { if (child.tagName === 'DIV' && !child.textContent.trim() && !child.querySelector('input, select, button')) child.remove(); });
        header.appendChild(row);
    }
    section.querySelectorAll('button.btn-primary, button.btn-secondary, button.btn-danger').forEach(treeAdjKitButton);
}
// <Jun Kai end>

// turns each section heading into a button that folds the section; his heading text, buttons and fields stay
function treeAdjBuildFolds() {
    if (treeAdjFoldsReady) return;
    const remembered = treeAdjRememberedOpen();
    document.querySelectorAll('#tree-adjustment-page [data-treeadj-fold]').forEach((section) => {
        const key = section.dataset.treeadjFold;
        const heading = section.querySelector(':scope > .section-header h3');
        if (!heading) return;
        section.classList.add('treeadj-fold');
        const title = heading.textContent.trim();
        heading.textContent = '';
        const toggle = document.createElement(key === 'display' ? 'span' : 'button');
        toggle.className = 'treeadj-fold-toggle';
        if (key !== 'display') {
            toggle.type = 'button';
            toggle.setAttribute('aria-controls', `treeadj-body-${key}`);
            toggle.addEventListener('click', () => {
                treeAdjSetOpen(section, !section.classList.contains('is-open'));
                treeAdjRememberOpen();
            });
        }
        toggle.innerHTML = '<span class="treeadj-fold-title"></span><span class="ui-tag is-amber treeadj-unsaved" hidden>Not saved</span>'
            + '<span class="treeadj-fold-sum"></span>' + (key === 'display' ? '' : `<span class="treeadj-fold-chevron" aria-hidden="true">${TREEADJ_CHEVRON}</span>`);
        toggle.querySelector('.treeadj-fold-title').textContent = title;
        heading.appendChild(toggle);
        treeAdjKitButtons(section); // <Jun Kai/>
        const open = key === 'display' || (Array.isArray(remembered) ? remembered.includes(key) : Object.values(TREEADJ_FIRST_FOLD).includes(key));
        treeAdjSetOpen(section, open);
    });
    treeAdjFoldsReady = true;
}

// the closed folds' values, the "Not saved" tags and the line under the preview
function treeAdjShowState() {
    const mode = treeAdjMode();
    const unsaved = [];
    document.querySelectorAll('#tree-adjustment-page [data-treeadj-fold]').forEach((section) => {
        const key = section.dataset.treeadjFold;
        const fold = TREEADJ_FOLDS[key];
        if (!fold) return;
        let summary = '';
        try { summary = fold.summary(); } catch { summary = ''; }
        const sum = section.querySelector('.treeadj-fold-sum');
        if (sum && sum.textContent !== summary) sum.textContent = summary;
        const changed = treeAdjChanges(key).length > 0;
        const tag = section.querySelector('.treeadj-unsaved');
        if (tag) tag.hidden = !changed;
        section.classList.toggle('has-unsaved', changed);
        if (changed && fold.kinds.includes(mode)) unsaved.push(treeAdjFoldTitle(section));
    });
    const note = treeAdjEl('treeadj-changes');
    if (note) {
        const text = !treeAdjSaved ? 'Reading the saved settings.'
            : unsaved.length ? `Not saved yet: ${unsaved.join(', ')}. The preview shows these changes; each section saves with its own button.`
                : 'No unsaved changes. The preview shows the saved settings.';
        if (note.textContent !== text) note.textContent = text;
        note.classList.toggle('ui-note-warn', unsaved.length > 0);
    }
}

function treeAdjFit() {
    const screen = treeAdjEl('treeadj-screen');
    if (!screen) return;
    const scale = screen.clientWidth / TREEADJ_FRAME_WIDTH;
    screen.querySelectorAll('.treeadj-frame, .view3d-frame').forEach((frame) => { frame.style.transform = `scale(${scale})`; });
}

function treeAdjFrames() {
    return { '2d': treeAdjEl('treeadj-frame-2d'), '3d': treeAdjEl('tree3d-viewFrame') };
}

// <Jun Kai start> A 3D tree preview loads once for the sign-in session (about 20 model files, and the browser cannot
// keep them for next time while the server's own HTTPS certificate is not trusted), so leaving its page no longer
// empties it. While it is out of sight it is told its page is hidden: the 3D page then draws nothing (scene.js skips
// every frame while document.hidden), and when it shows again it carries on at once. Signing out reloads the admin
// page, which drops it. Also used by the Tree Leaves card (tree.js).
function treeFramePause(frame, paused) {
    if (!frame) return;
    frame.dataset.treePaused = paused ? '1' : '';
    if (!frame.dataset.treePauseWatch) {
        // the 3D page reloads itself when the look changes: a paused frame stays paused
        frame.dataset.treePauseWatch = '1';
        frame.addEventListener('load', () => { if (frame.dataset.treePaused === '1') treeFramePause(frame, true); });
    }
    let doc = null;
    try { doc = frame.contentDocument; } catch { return; }
    if (!doc || !doc.defaultView || doc.location.href === 'about:blank') return;
    if (paused) {
        Object.defineProperty(doc, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'hidden' });
    } else {
        delete doc.hidden; // back to the browser's own answer
        delete doc.visibilityState;
    }
    doc.dispatchEvent(new Event('visibilitychange'));
}

const treeFrameLoaded = (frame, src) => !!frame && frame.getAttribute('src') === src;
// <Jun Kai end>

// one frame shown at a time; the 3D one stays loaded but paused when the 2D one shows (the 2D one is light and has
// no scene to keep, so it is emptied: each frame holds a live connection to the server)
function treeAdjShowPreview() {
    const screen = treeAdjEl('treeadj-screen');
    const frames = treeAdjFrames();
    if (!screen || !frames['2d'] || !frames['3d']) return;
    const kind = treeAdjMode();
    const other = kind === '3d' ? '2d' : '3d';
    if (other === '3d') treeFramePause(frames['3d'], true); // <Jun Kai/> kept for the session
    else if (frames['2d'].getAttribute('src') && frames['2d'].getAttribute('src') !== 'about:blank') frames['2d'].setAttribute('src', 'about:blank');
    frames[other].hidden = true;
    screen.dataset.kind = kind;
    const sub = treeAdjEl('treeadj-preview-sub');
    if (sub) sub.textContent = `The ${kind.toUpperCase()} tree with your changes, saved or not`;
    const open = treeAdjEl('treeadj-open-tree');
    if (open) open.setAttribute('href', TREEADJ_OPEN_TREE[kind]);
    const frame = frames[kind];
    if (!treeFrameLoaded(frame, TREEADJ_FRAME_SRC[kind])) {
        screen.dataset.state = 'loading';
        const note = treeAdjEl('treeadj-screen-note');
        if (note) note.textContent = 'Loading the tree';
        frame.onload = () => {
            if (frame.getAttribute('src') === TREEADJ_FRAME_SRC[kind]) screen.dataset.state = 'ready';
        };
        treeAdjLastDraft = '';
        frame.setAttribute('src', TREEADJ_FRAME_SRC[kind]);
    } else {
        // <Jun Kai start> already loaded this session: it carries on where it was, with the latest unsaved changes
        screen.dataset.state = 'ready';
        treeAdjLastDraft = '';
        // <Jun Kai end>
    }
    treeFramePause(frame, false); // <Jun Kai/>
    frame.hidden = false;
    // his 3D View & Zoom: shows the frame and starts the zoom readout (the address set above is kept)
    if (kind === '3d' && typeof openTree3dViewEditor === 'function') openTree3dViewEditor();
    treeAdjFit();
}

// tells the frame to read its settings again when the fields changed since the last time
function treeAdjSendDraft() {
    const kind = treeAdjMode();
    const frame = treeAdjFrames()[kind];
    const draft = JSON.stringify(treeAdjDraft(kind));
    if (draft === treeAdjLastDraft) return;
    treeAdjLastDraft = draft;
    try { frame?.contentWindow?.treeAdjDraftChanged?.(); } catch { /* the frame is still loading: it reads the draft when it starts */ }
}

function treeAdjTick() {
    if (!treeAdjEl('tree-adjustment-page')?.classList.contains('active')) return;
    const screen = treeAdjEl('treeadj-screen');
    if (screen && screen.dataset.kind !== treeAdjMode()) treeAdjShowPreview();
    treeAdjSendDraft();
    treeAdjShowState();
}

async function treeAdjReadSaved() {
    try {
        const response = await fetch('/api/parameters', { cache: 'no-store' });
        const data = await response.json();
        if (response.ok && data.success && data.parameters) treeAdjSaved = data.parameters;
    } catch (error) {
        console.warn('Tree Settings: the saved settings could not be read.', error);
    }
    treeAdjShowState();
}

async function treeAdjReadLeafCount() {
    try {
        const response = await fetch('/api/tree', { credentials: 'include' });
        const data = await response.json();
        if (Array.isArray(data)) treeAdjLeafCount = data.length;
    } catch { /* the stage in Auto then shows as the field says */ }
}

function treeAdjOpen() {
    if (treeAdjOpened) return;
    treeAdjOpened = true;
    treeAdjOpenedAt = Date.now();
    treeAdjLoaded = {};
    treeAdjBuildFolds();
    treeAdjShowPreview();
    treeAdjReadSaved();
    treeAdjReadLeafCount();
    window.clearInterval(treeAdjTimer);
    treeAdjTimer = window.setInterval(treeAdjTick, TREEADJ_TICK_MS);
    window.clearInterval(treeAdjSavedTimer);
    treeAdjSavedTimer = window.setInterval(treeAdjReadSaved, TREEADJ_SAVED_CHECK_MS);
}

function treeAdjClose() {
    if (!treeAdjOpened) return;
    treeAdjOpened = false;
    window.clearInterval(treeAdjTimer);
    window.clearInterval(treeAdjSavedTimer);
    // <Jun Kai start> the 3D preview stays loaded but paused (no 0 to 18 again next time); the 2D one is emptied
    const frames = treeAdjFrames();
    treeFramePause(frames['3d'], true);
    if (frames['2d'] && frames['2d'].getAttribute('src') && frames['2d'].getAttribute('src') !== 'about:blank') frames['2d'].setAttribute('src', 'about:blank');
    if (typeof tree3dViewTimer !== 'undefined') window.clearInterval(tree3dViewTimer); // his zoom readout; it starts again with the preview
    // <Jun Kai end>
}

// his two delete questions, in the kit window: his function runs once with the browser question answered "no" to
// read the question, then again with "yes" once the admin agrees (both ask before they do anything else)
function treeAdjAskInKit(name, title) {
    const his = window[name];
    if (typeof his !== 'function') return;
    window[name] = async function (...args) {
        const realConfirm = window.confirm;
        let question = null;
        window.confirm = (message) => { question = String(message ?? ''); return false; };
        try { his.apply(this, args); } finally { window.confirm = realConfirm; }
        if (question === null || typeof uiConfirm !== 'function') return undefined;
        if (!(await uiConfirm({ title, message: question, confirmText: 'Delete', danger: true }))) return undefined;
        window.confirm = () => true;
        try { return his.apply(this, args); } finally { window.confirm = realConfirm; }
    };
}
treeAdjAskInKit('deleteTree3dMusic', 'Delete this music?');
treeAdjAskInKit('deleteTree3dView', 'Delete this view?');

// his picture lists build their tiles with inline styles; the tiles get the kit look through classes
function treeAdjTileClasses(list) {
    list.querySelectorAll(':scope > button').forEach((tile) => {
        if (tile.classList.contains('treeadj-tile')) return;
        tile.classList.add('treeadj-tile');
        tile.firstElementChild?.classList.add('treeadj-tile-pic');
        tile.querySelector('span')?.classList.add('treeadj-tile-name');
    });
}

function treeAdjWatchTiles() {
    ['param-treeBackgroundList', 'param-existingLeafList', 'param-existingVipLeafList'].forEach((id) => {
        const list = treeAdjEl(id);
        if (!list) return;
        list.classList.add('treeadj-tiles');
        treeAdjTileClasses(list);
        new MutationObserver(() => treeAdjTileClasses(list)).observe(list, { childList: true });
    });
}

let treeAdjSoon = null;
function treeAdjChangedSoon() {
    window.clearTimeout(treeAdjSoon);
    treeAdjSoon = window.setTimeout(treeAdjTick, 150);
}

document.addEventListener('DOMContentLoaded', () => {
    const page = treeAdjEl('tree-adjustment-page');
    if (!page || !treeAdjEl('treeadj-layout')) return;
    treeAdjWatchTiles();
    page.addEventListener('input', treeAdjChangedSoon);
    page.addEventListener('change', treeAdjChangedSoon);
    page.addEventListener('click', (event) => {
        treeAdjChangedSoon();
        // after one of his save buttons, read what the server now has
        const button = event.target.closest('button[onclick]');
        if (button && /^(save|select|upload|revert|reset|use|delete|turnOn)[A-Z]/.test(button.getAttribute('onclick').trim())) {
            window.setTimeout(treeAdjReadSaved, 1500);
            window.setTimeout(treeAdjReadSaved, 4000);
        }
    });
    if (typeof ResizeObserver === 'function') new ResizeObserver(treeAdjFit).observe(treeAdjEl('treeadj-screen'));
    window.addEventListener('resize', treeAdjFit);
    // the page opens and closes through its "active" class (navigation.js showPage)
    const follow = () => (page.classList.contains('active') ? treeAdjOpen() : treeAdjClose());
    new MutationObserver(follow).observe(page, { attributes: true, attributeFilter: ['class'] });
    follow();
});
// <Jun Kai end>

// <Jun Kai start> The Tree Animation Demo and "Open the tree" each open one tab and use it again: pressing the link
// again brings that tab to the front without loading the tree again (a new tab counts 0 to 18 once more). A tab that
// shows another tree (2D or 3D) is moved to the one asked for; the demo tab keeps the tree chosen in it.
function treeOpenInOneTab(event) {
    const link = event.target.closest && event.target.closest('a[data-tree-tab]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    let tab = null;
    try { tab = window.open('', link.dataset.treeTab); } catch { tab = null; }
    if (!tab) return; // pop-ups blocked: the link opens a new tab as usual
    event.preventDefault();
    const want = new URL(link.href, window.location.href);
    let now = '';
    try { now = tab.location.href; } catch { now = ''; } // another site in that tab
    const open = now && now !== 'about:blank';
    // the same address as last time counts as the same tree too: the server may have moved the tab on (for example
    // /3dTree to /tree while 2D is the saved choice), and pressing again must not load it again
    const same = open && (new URL(now).pathname.toLowerCase() === want.pathname.toLowerCase() || treeTabAsked[link.dataset.treeTab] === want.href);
    if (!same) tab.location.href = want.href;
    treeTabAsked[link.dataset.treeTab] = want.href;
    tab.focus();
}
const treeTabAsked = {};
document.addEventListener('click', treeOpenInOneTab);
// <Jun Kai end>
