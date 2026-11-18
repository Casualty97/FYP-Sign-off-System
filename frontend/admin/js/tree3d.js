// Owner: Role 2, Wei Jie.
// Admin > Digital Tree Adjustment > 3D Tree Settings: the controls of the /3dTree page and its title box.
// Saves `tree3dParameters` through PUT /api/admin/parameters/tree3dParameters (checked by
// backend/features/parameters/tree3d.js); the 3D page reads them from /api/parameters every few seconds
// (frontend/3dTree/tree3d-settings.js). The defaults below match the 3D page with no settings saved.

const TREE3D_DEFAULTS = {
    glowLook: true,
    weatherSource: 'live',
    manualSky: 'day',
    manualRain: false,
    rainArea: 'all',
    riverLevelMode: 'auto',
    autoOrbit: true,
    orbitSeconds: 86400, // one full turn a day
    orbitDirection: 'right',
    soundEnabled: false,
    soundVolume: 78,
    showSoilPanel: false,
    showWeatherPanel: true,
    showRiverPanel: true,
    showControlsBar: true,
    showYearReview: true
};

const TREE3D_TITLE_DEFAULTS = {
    showTitleBox: true,
    titleText: 'ESG Tree',
    subtitleText: 'Terminalia catappa · A living river valley',
    opacity: 0.54,
    blur: 18,
    radius: 20,
    position: 'auto',
    paddingX: 22,
    paddingY: 12
};

// 3D Leaf Adjustments: the feedback leaves on the 3D tree (frontend/3dTree/feedback-leaves.js).
const TREE3D_LEAF_DEFAULTS = {
    showFeedbackLeaves: true,
    showLeafNames: true,
    leafNewColor: '#7cb342',
    leafOldColor: '#1f5f2e',
    leafSide: 'both',
    leafNewHours: 24,
    leafScale: 1,
    // The names on the leaves: the look's own font, bold, white, standard size.
    leafNameFont: 'auto',
    leafNameWeight: 700,
    leafNameColor: '#ffffff',
    leafNameSize: 1
};

// The names' font styles (as frontend/3dTree/feedback-leaves.js NAME_FONTS, for the preview here); 'auto' is
// the look's own: the elegant script with the glowing look, the modern letters with the natural look.
const TREE3D_NAME_FONTS = {
    'elegant-script': '"Monotype Corsiva", "Segoe Script", "Lucida Handwriting", cursive',
    'handwriting': '"Segoe Print", "Segoe Script", "Comic Sans MS", cursive',
    'modern': 'Inter, "Segoe UI", Arial, sans-serif',
    'rounded': '"Trebuchet MS", Verdana, "Segoe UI", sans-serif',
    'classic-serif': 'Georgia, "Palatino Linotype", "Times New Roman", serif',
    'typewriter': '"Courier New", Consolas, monospace'
};
const TREE3D_NAME_COLOURS = [
    ['White', '#ffffff'],
    ['Warm gold', '#ffe08a'],
    ['Soft mint', '#c8ffd8'],
    ['Ice blue', '#d6ecff'],
    ['Charcoal', '#1f2937']
];

// Greens only: light greens for new leaves, dark greens for older ones. The server accepts only these
// (LEAF_NEW_COLOURS / LEAF_OLD_COLOURS in backend/features/parameters/tree3d.js).
const TREE3D_LEAF_COLOURS = {
    New: [
        ['Light green', '#7cb342'],
        ['Fresh green', '#8bc34a'],
        ['Spring green', '#9ccc65'],
        ['Lime green', '#a4c639'],
        ['Leaf green', '#66bb6a']
    ],
    Old: [
        ['Dark green', '#1f5f2e'],
        ['Forest green', '#2e7d32'],
        ['Deep green', '#1b5e20'],
        ['Dark olive green', '#33691e'],
        ['Moss green', '#2d5a27']
    ],
    // Golds for VIP leaves (VIP_LEAF_COLOURS on the server).
    Vip: [
        ['Gold', '#d4af37'],
        ['Bright gold', '#ffd700'],
        ['Honey gold', '#e6b422'],
        ['Pale gold', '#f0c75e'],
        ['Dark gold', '#b8860b']
    ]
};

// 3D VIP Leaf Adjustments: VIP leaves (names in VIP Management) on the 3D tree.
const TREE3D_VIP_DEFAULTS = {
    vipLeafColor: '#d4af37',
    vipLeafScale: 1,
    vipGlow: true
};

// 3D Tree Visualization Parameters: the 2D tree's Visualization Parameters for the 3D tree
// (frontend/3dTree/feedback-leaves.js). Maximum Visible Leaves stays the 2D tree's, shared by both trees.
const TREE3D_VISUAL_DEFAULTS = {
    leafAreaWidth: 100,
    leafAreaHeight: 100,
    leafAreaOffset: 0,
    leafRefreshMs: 5000,
    leafOpacity: 1,
    leafAppearMs: 900,
    leafShowcaseSeconds: 12,
    leafFloatMs: 7200,
    leafFallMs: 4200,
    badgeColours: true
};
const TREE3D_VISUAL_NUMBERS = ['leafAreaWidth', 'leafAreaHeight', 'leafAreaOffset', 'leafRefreshMs', 'leafOpacity',
    'leafAppearMs', 'leafShowcaseSeconds', 'leafFloatMs', 'leafFallMs'];
// The 2D tree's saved badge colours (Badge Leaf Styling), used for any badge left at its built-in colour in 3D.
let tree3dBadgeColours2d = {};
// The badges, with the 2D tree's default colours (Badge Leaf Styling).
const TREE3D_BADGES = [
    ['feedback-completer', 'Feedback Contributor', '#4a7c59'],
    ['climate-champion', 'Climate Champion', '#0f766e'],
    ['renewable-innovator', 'Renewable Innovator', '#f59e0b'],
    ['sustainable-living-advocate', 'Sustainable Living Advocate', '#16a34a'],
    ['ocean-guardian', 'Ocean Guardian', '#0284c7'],
    ['governance-guardian', 'Governance Guardian', '#7c3aed'],
    ['social-champion', 'Social Champion', '#d97706']
];

// The rain areas the 3D page lists come from the same public Singapore feed.
const TREE3D_AREA_FEED = 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast';

// Display 2D/3D Tree (top of Digital Tree Adjustment) picks which settings are shown below it:
// the 2D tabs for 2D, the 3D Tree Settings for 3D. Choosing only switches the view; Save Display makes it live.
function showTreeSettingsForMode(mode) {
    const page = document.getElementById('tree-adjustment-page');
    if (page) page.classList.toggle('tree-mode-3d', mode === '3d');
    if (mode === '3d' && typeof loadTree3dStage === 'function') loadTree3dStage(); // the stage may have changed in the 2D panel
}

function tree3dField(id) {
    return document.getElementById(`tree3d-${id}`);
}

function updateTree3dRangeLabels() {
    const volume = tree3dField('soundVolume');
    const opacity = tree3dField('titleOpacity');
    const blur = tree3dField('titleBlur');
    const radius = tree3dField('titleRadius');
    if (volume) tree3dField('soundVolumeValue').textContent = volume.value;
    if (opacity) tree3dField('titleOpacityValue').textContent = Number(opacity.value).toFixed(2);
    if (blur) tree3dField('titleBlurValue').textContent = `${blur.value}px`;
    if (radius) tree3dField('titleRadiusValue').textContent = `${radius.value}px`;
}

// Colour swatches: light greens for the new leaves, dark greens for the older ones, golds for VIP leaves.
function renderTree3dLeafSwatches() {
    for (const which of ['New', 'Old', 'Vip']) {
        const box = tree3dField(`leaf${which}Swatches`);
        if (!box || box.childElementCount) continue;
        for (const [name, hex] of TREE3D_LEAF_COLOURS[which]) {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'leaf3d-swatch';
            swatch.style.background = hex;
            swatch.dataset.colour = hex;
            swatch.title = name;
            swatch.setAttribute('aria-label', name);
            swatch.addEventListener('click', () => {
                tree3dField(`leaf${which}Color`).value = hex;
                updateTree3dLeafPreview();
            });
            box.appendChild(swatch);
        }
    }
}

// A leaf colour as the 3D tree shows it: at least this light (HSL), so a dark green leaf stands out on the
// canopy (MIN_LIGHTNESS in frontend/3dTree/feedback-leaves.js).
function tree3dShownColour(hex) {
    const value = parseInt(String(hex).slice(1), 16);
    if (!Number.isFinite(value)) return hex;
    let r = ((value >> 16) & 255) / 255, g = ((value >> 8) & 255) / 255, b = (value & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h /= 6;
    }
    l = Math.max(l, 0.38);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const channel = t => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    [r, g, b] = s === 0 ? [l, l, l] : [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
    return `#${[r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
}

// Names on the leaves: a sample name on a leaf in the chosen font, weight and colour, as the 3D screen writes
// it (frontend/3dTree/feedback-leaves.js nameLabel): with the glowing look on the night sky, glowing in its own
// colour; with the natural look on a daylight leaf, with an edge. A dark colour gets a light edge or glow.
function updateTree3dNamePreview() {
    const sample = tree3dField('leafNameSample');
    if (!sample) return;
    const glowing = tree3dField('glowLook')?.checked !== false;
    const fontKey = tree3dField('leafNameFont')?.value || 'auto';
    const family = TREE3D_NAME_FONTS[fontKey] || TREE3D_NAME_FONTS[glowing ? 'elegant-script' : 'modern'];
    const weight = Number(tree3dField('leafNameWeight')?.value) || 700;
    const colour = (tree3dField('leafNameColor')?.value || '#ffffff').toLowerCase();
    const value = parseInt(colour.slice(1), 16);
    const linear = c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const dark = 0.2126 * linear((value >> 16) & 255) + 0.7152 * linear((value >> 8) & 255) + 0.0722 * linear(value & 255) < 0.25;
    const behind = dark ? 'rgba(255,255,255,0.85)' : 'rgba(8,28,14,0.85)';
    sample.style.fontFamily = family;
    sample.style.fontWeight = String(weight);
    sample.style.color = colour;
    const size = Math.min(1.4, Math.max(0.7, Number(tree3dField('leafNameSize')?.value) || 1));
    if (tree3dField('leafNameSizeValue')) tree3dField('leafNameSizeValue').textContent = `${Math.round(size * 100)}%`;
    const handwritten = (fontKey === 'auto' && glowing) || fontKey === 'elegant-script';
    sample.style.fontSize = `${((handwritten ? 18 : 15) * size).toFixed(1)}px`;
    sample.style.textShadow = glowing && !dark
        ? `0 0 3px ${behind}, 0 0 8px ${colour}`
        : `-1px -1px 0 ${behind}, 1px -1px 0 ${behind}, -1px 1px 0 ${behind}, 1px 1px 0 ${behind}`;
    tree3dField('leafNameFrame')?.classList.toggle('glowing', glowing);
    const leaf = tree3dField('leafNamePreviewLeaf');
    if (leaf) leaf.style.setProperty('--leaf-colour', glowing ? '#2ee05a' : tree3dShownColour(tree3dField('leafNewColor')?.value || '#7cb342'));
    if (tree3dField('leafNameCaption')) tree3dField('leafNameCaption').textContent = `Name preview, ${glowing ? 'glowing look' : 'natural look'}`;
    for (const swatch of tree3dField('leafNameSwatches')?.children || []) {
        swatch.setAttribute('aria-pressed', String(swatch.dataset.colour === colour));
    }
}

function renderTree3dNameSwatches() {
    const box = tree3dField('leafNameSwatches');
    if (!box || box.childElementCount) return;
    for (const [name, hex] of TREE3D_NAME_COLOURS) {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'leaf3d-swatch';
        swatch.style.background = hex;
        swatch.dataset.colour = hex;
        swatch.title = name;
        swatch.setAttribute('aria-label', `Name colour: ${name}`);
        swatch.addEventListener('click', () => {
            tree3dField('leafNameColor').value = hex;
            updateTree3dNamePreview();
        });
        box.appendChild(swatch);
    }
}

// The preview shows the RainTree leaf in the chosen colours and sides, sized with the leaf scale.
// A left leaf is the leaf mirrored; with left and right mixed, the new leaf shows right and the older left.
function updateTree3dLeafPreview() {
    const scale = Number(tree3dField('leafScale')?.value) || 1;
    if (tree3dField('leafScaleValue')) tree3dField('leafScaleValue').textContent = String(Number(scale.toFixed(2)));
    const side = tree3dField('leafSide')?.value || 'both';
    for (const which of ['New', 'Old']) {
        const colour = (tree3dField(`leaf${which}Color`)?.value || '').toLowerCase();
        const preview = tree3dField(`leaf${which}Preview`);
        const shownSide = side === 'both' ? (which === 'New' ? 'right' : 'left') : side;
        if (preview) {
            preview.style.setProperty('--leaf-colour', tree3dShownColour(colour));
            const size = (0.5 + scale * 0.3).toFixed(2);
            preview.style.transform = `scale(${shownSide === 'left' ? -size : size}, ${size})`;
        }
        const caption = tree3dField(`leaf${which}Caption`);
        if (caption) caption.textContent = `${which === 'New' ? 'New' : 'Older'} leaf, ${shownSide}`;
        for (const swatch of tree3dField(`leaf${which}Swatches`)?.children || []) {
            swatch.setAttribute('aria-pressed', String(swatch.dataset.colour === colour));
        }
    }

    // The VIP leaf: gold, its own scale, the side as the new leaf, and the gold glow when on.
    const vipScale = Number(tree3dField('vipLeafScale')?.value) || 1;
    if (tree3dField('vipLeafScaleValue')) tree3dField('vipLeafScaleValue').textContent = String(Number(vipScale.toFixed(2)));
    const vipColour = (tree3dField('leafVipColor')?.value || '').toLowerCase();
    const vipSide = side === 'both' ? 'right' : side;
    const vipPreview = tree3dField('leafVipPreview');
    if (vipPreview) {
        const size = (0.5 + vipScale * 0.3).toFixed(2);
        vipPreview.style.setProperty('--leaf-colour', vipColour);
        vipPreview.style.transform = `scale(${vipSide === 'left' ? -size : size}, ${size})`;
    }
    tree3dField('leafVipGlowBox')?.classList.toggle('glowing', tree3dField('vipGlow')?.checked === true);
    if (tree3dField('leafVipCaption')) tree3dField('leafVipCaption').textContent = `VIP leaf, ${vipSide}`;
    for (const swatch of tree3dField('leafVipSwatches')?.children || []) {
        swatch.setAttribute('aria-pressed', String(swatch.dataset.colour === vipColour));
    }
}

// Rain area only applies to live weather; time of day and rain only to manual weather.
// The automatic turn (Motion): one full turn every so many seconds, minutes or hours (30 seconds to 24 hours,
// tree3dParameters.orbitSeconds), and which way (orbitDirection). frontend/3dTree/tree-view.js setOrbit.
const TREE3D_TURN_UNITS = { seconds: 1, minutes: 60, hours: 3600 };

function tree3dTurnSeconds() {
    const amount = Number(tree3dField('orbitTime')?.value) || 0;
    const unit = TREE3D_TURN_UNITS[tree3dField('orbitUnit')?.value] || 3600;
    return Math.round(Math.min(86400, Math.max(30, amount * unit || TREE3D_DEFAULTS.orbitSeconds)));
}

function setTree3dTurnTime(amount, unit) {
    tree3dField('orbitTime').value = amount;
    tree3dField('orbitUnit').value = unit;
    updateTree3dTurnFields();
}

// The turn fields show only with the automatic turn on; the help says how fast it is.
function updateTree3dTurnFields() {
    const fields = tree3dField('turnFields');
    if (fields) fields.style.display = tree3dField('autoOrbit')?.checked ? '' : 'none';
    const help = tree3dField('turnHelp');
    if (!help) return;
    const seconds = tree3dTurnSeconds();
    const degreesPerSecond = 360 / seconds;
    const pace = degreesPerSecond >= 1 ? `about ${Math.round(degreesPerSecond)}° a second`
        : degreesPerSecond * 60 >= 1 ? `about ${Math.round(degreesPerSecond * 60)}° a minute`
            : `about ${Math.round(degreesPerSecond * 3600)}° an hour`;
    const asked = (Number(tree3dField('orbitTime')?.value) || 0) * (TREE3D_TURN_UNITS[tree3dField('orbitUnit')?.value] || 3600);
    const kept = asked < 30 ? ' (30 seconds is the fastest)' : asked > 86400 ? ' (24 hours is the slowest)' : '';
    help.textContent = `The tree turns ${pace}, to the ${tree3dField('orbitDirection')?.value === 'left' ? 'left' : 'right'}${kept}. Any time from 30 seconds to 24 hours a turn. Dragging the tree pauses the turn for a few seconds.`;
}

function updateTree3dWeatherFields() {
    const live = tree3dField('weatherSource')?.value !== 'manual';
    tree3dField('rainArea').disabled = !live;
    tree3dField('manualSky').disabled = live;
    tree3dField('manualRain').disabled = live;
}

function setTree3dRainArea(area) {
    const select = tree3dField('rainArea');
    if (!select) return;
    const value = area || 'all';
    // Keep a saved area even when the area list could not be loaded.
    if (![...select.options].some(option => option.value === value)) {
        select.add(new Option(value, value));
    }
    select.value = value;
}

async function loadTree3dRainAreas() {
    const select = tree3dField('rainArea');
    if (!select || select.dataset.loaded === 'true') return;
    try {
        const response = await fetch(TREE3D_AREA_FEED);
        const data = await response.json();
        const names = (data?.data?.area_metadata || [])
            .map(area => area?.name)
            .filter(name => typeof name === 'string' && name.trim())
            .sort((a, b) => a.localeCompare(b));
        const current = select.value;
        select.replaceChildren(new Option('All Singapore', 'all'), ...names.map(name => new Option(name, name)));
        select.dataset.loaded = 'true';
        setTree3dRainArea(current);
    } catch (error) {
        console.warn('Rain areas could not be loaded; All Singapore and the saved area stay available.', error);
    }
}

function fillTree3dForm(settings) {
    const s = { ...TREE3D_DEFAULTS, ...(settings || {}) };
    const box = { ...TREE3D_TITLE_DEFAULTS, ...(settings?.titleBox || {}) };
    const leaves = { ...TREE3D_LEAF_DEFAULTS, ...(settings || {}) };

    tree3dField('glowLook').checked = s.glowLook !== false;
    tree3dField('weatherSource').value = s.weatherSource;
    tree3dField('manualSky').value = s.manualSky;
    tree3dField('manualRain').checked = s.manualRain === true;
    setTree3dRainArea(s.rainArea);
    tree3dField('riverLevelMode').value = s.riverLevelMode;
    tree3dField('autoOrbit').checked = s.autoOrbit !== false;
    if (tree3dField('orbitTime')) {
        // Shown in the largest whole unit: 86400 as 24 hours, 300 as 5 minutes, 45 as 45 seconds.
        const seconds = Math.min(86400, Math.max(30, Math.round(Number(s.orbitSeconds) || TREE3D_DEFAULTS.orbitSeconds)));
        const unit = seconds % 3600 === 0 ? 'hours' : seconds % 60 === 0 ? 'minutes' : 'seconds';
        tree3dField('orbitTime').value = seconds / TREE3D_TURN_UNITS[unit];
        tree3dField('orbitUnit').value = unit;
        tree3dField('orbitDirection').value = s.orbitDirection === 'left' ? 'left' : 'right';
        updateTree3dTurnFields();
    }
    tree3dField('showSoilPanel').checked = s.showSoilPanel === true;
    tree3dField('soundEnabled').checked = s.soundEnabled === true;
    tree3dField('soundVolume').value = s.soundVolume;
    tree3dField('showWeatherPanel').checked = s.showWeatherPanel !== false;
    tree3dField('showRiverPanel').checked = s.showRiverPanel !== false;
    tree3dField('showControlsBar').checked = s.showControlsBar !== false;
    tree3dField('showYearReview').checked = s.showYearReview !== false;

    tree3dField('showFeedbackLeaves').checked = leaves.showFeedbackLeaves !== false;
    tree3dField('showLeafNames').checked = leaves.showLeafNames !== false;
    // A colour saved before the greens-only choice falls back to the default green.
    const offered = (which, hex) => TREE3D_LEAF_COLOURS[which].some(([, value]) => value === String(hex).toLowerCase());
    tree3dField('leafNewColor').value = offered('New', leaves.leafNewColor) ? leaves.leafNewColor.toLowerCase() : TREE3D_LEAF_DEFAULTS.leafNewColor;
    tree3dField('leafOldColor').value = offered('Old', leaves.leafOldColor) ? leaves.leafOldColor.toLowerCase() : TREE3D_LEAF_DEFAULTS.leafOldColor;
    tree3dField('leafSide').value = ['both', 'left', 'right'].includes(leaves.leafSide) ? leaves.leafSide : 'both';
    // "A leaf stays light for": whole hours as hours, anything shorter or in between as minutes.
    const lightHours = Math.max(0, Number(leaves.leafNewHours) || 0);
    const inHours = lightHours >= 1 && Number.isInteger(lightHours);
    tree3dField('leafNewHours').value = inHours ? lightHours : Math.round(lightHours * 60);
    if (tree3dField('leafNewUnit')) tree3dField('leafNewUnit').value = inHours ? 'hours' : 'minutes';
    tree3dField('leafScale').value = leaves.leafScale;
    if (tree3dField('leafNameFont')) {
        tree3dField('leafNameFont').value = Object.hasOwn(TREE3D_NAME_FONTS, leaves.leafNameFont) ? leaves.leafNameFont : 'auto';
        tree3dField('leafNameWeight').value = String([400, 500, 600, 700, 800].includes(Number(leaves.leafNameWeight)) ? Number(leaves.leafNameWeight) : 700);
        tree3dField('leafNameColor').value = /^#[0-9a-f]{6}$/i.test(String(leaves.leafNameColor || '')) ? leaves.leafNameColor.toLowerCase() : '#ffffff';
        if (tree3dField('leafNameSize')) tree3dField('leafNameSize').value = String(Math.min(1.4, Math.max(0.7, Number(leaves.leafNameSize) || 1)));
    }
    const vip = { ...TREE3D_VIP_DEFAULTS, ...(settings || {}) };
    tree3dField('leafVipColor').value = offered('Vip', vip.vipLeafColor) ? vip.vipLeafColor.toLowerCase() : TREE3D_VIP_DEFAULTS.vipLeafColor;
    tree3dField('vipLeafScale').value = vip.vipLeafScale;
    tree3dField('vipGlow').checked = vip.vipGlow !== false;

    const visual = { ...TREE3D_VISUAL_DEFAULTS, ...(settings || {}) };
    renderTree3dBadgeColours();
    if (tree3dField('leafAreaWidth')) {
        TREE3D_VISUAL_NUMBERS.forEach(key => { tree3dField(key).value = visual[key]; });
        tree3dField('badgeColours').checked = visual.badgeColours === true;
        // The colour each badge shows on the 3D tree: its 3D colour once changed here, otherwise the 2D tree's
        // (Badge Leaf Styling), as frontend/3dTree/feedback-leaves.js badgeColour.
        const colours = settings?.badgeLeafColors || {};
        TREE3D_BADGES.forEach(([key, , builtIn]) => {
            const own = String(colours[key] || '').toLowerCase();
            const shown = own && own !== builtIn ? own : (tree3dBadgeColours2d[key] || own || builtIn);
            tree3dField(`badgeColour-${key}`).value = shown;
        });
        updateTree3dVisualLabels();
    }

    tree3dField('showTitleBox').checked = box.showTitleBox !== false;
    tree3dField('titleText').value = box.titleText;
    tree3dField('subtitleText').value = box.subtitleText;
    tree3dField('titleOpacity').value = box.opacity;
    tree3dField('titleBlur').value = box.blur;
    tree3dField('titleRadius').value = box.radius;
    tree3dField('titlePosition').value = box.position;
    tree3dField('titlePaddingX').value = box.paddingX;
    tree3dField('titlePaddingY').value = box.paddingY;

    updateTree3dRangeLabels();
    updateTree3dWeatherFields();
    renderTree3dLeafSwatches();
    updateTree3dLeafPreview();
    renderTree3dNameSwatches();
    updateTree3dNamePreview();
}

function collectTree3dSettings() {
    const whole = (id, fallback) => {
        const value = parseInt(tree3dField(id).value, 10);
        return Number.isFinite(value) ? value : fallback;
    };
    return {
        glowLook: tree3dField('glowLook').checked,
        weatherSource: tree3dField('weatherSource').value,
        manualSky: tree3dField('manualSky').value,
        manualRain: tree3dField('manualRain').checked,
        rainArea: tree3dField('rainArea').value || 'all',
        riverLevelMode: tree3dField('riverLevelMode').value,
        autoOrbit: tree3dField('autoOrbit').checked,
        ...(tree3dField('orbitTime') ? {
            orbitSeconds: tree3dTurnSeconds(),
            orbitDirection: tree3dField('orbitDirection').value === 'left' ? 'left' : 'right'
        } : {}),
        showSoilPanel: tree3dField('showSoilPanel').checked,
        soundEnabled: tree3dField('soundEnabled').checked,
        soundVolume: whole('soundVolume', TREE3D_DEFAULTS.soundVolume),
        showWeatherPanel: tree3dField('showWeatherPanel').checked,
        showRiverPanel: tree3dField('showRiverPanel').checked,
        showControlsBar: tree3dField('showControlsBar').checked,
        showYearReview: tree3dField('showYearReview').checked,
        showFeedbackLeaves: tree3dField('showFeedbackLeaves').checked,
        showLeafNames: tree3dField('showLeafNames').checked,
        leafNewColor: tree3dField('leafNewColor').value,
        leafOldColor: tree3dField('leafOldColor').value,
        leafSide: tree3dField('leafSide').value,
        leafNewHours: (Number(tree3dField('leafNewHours').value) || 0) / (tree3dField('leafNewUnit')?.value === 'minutes' ? 60 : 1),
        leafScale: Number(tree3dField('leafScale').value) || TREE3D_LEAF_DEFAULTS.leafScale,
        ...(tree3dField('leafNameFont') ? {
            leafNameFont: tree3dField('leafNameFont').value,
            leafNameWeight: Number(tree3dField('leafNameWeight').value) || TREE3D_LEAF_DEFAULTS.leafNameWeight,
            leafNameColor: tree3dField('leafNameColor').value,
            leafNameSize: Number(tree3dField('leafNameSize')?.value) || TREE3D_LEAF_DEFAULTS.leafNameSize
        } : {}),
        vipLeafColor: tree3dField('leafVipColor').value,
        vipLeafScale: Number(tree3dField('vipLeafScale').value) || TREE3D_VIP_DEFAULTS.vipLeafScale,
        vipGlow: tree3dField('vipGlow').checked,
        ...collectTree3dVisual(),
        titleBox: {
            showTitleBox: tree3dField('showTitleBox').checked,
            titleText: tree3dField('titleText').value,
            subtitleText: tree3dField('subtitleText').value,
            opacity: parseFloat(tree3dField('titleOpacity').value),
            blur: whole('titleBlur', TREE3D_TITLE_DEFAULTS.blur),
            radius: whole('titleRadius', TREE3D_TITLE_DEFAULTS.radius),
            position: tree3dField('titlePosition').value,
            paddingX: whole('titlePaddingX', TREE3D_TITLE_DEFAULTS.paddingX),
            paddingY: whole('titlePaddingY', TREE3D_TITLE_DEFAULTS.paddingY)
        }
    };
}

async function putTree3dSettings(changes) {
    const response = await fetch('/api/admin/parameters/tree3dParameters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(changes)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save 3D tree settings');
    return data.parameters?.tree3dParameters;
}

async function saveTree3dSettings() {
    try {
        const saved = await putTree3dSettings(collectTree3dSettings());
        if (saved) fillTree3dForm(saved);
        showNotification('3D tree settings saved. The 3D screen updates within a few seconds.', 'success');
    } catch (error) {
        console.error('Error saving 3D tree settings:', error);
        showNotification(error.message || 'Failed to save 3D tree settings.', 'error');
    }
}

// Each section's Reset only resets that section.
function tree3dLeafValues(settings) {
    const keys = [...Object.keys(TREE3D_LEAF_DEFAULTS), ...Object.keys(TREE3D_VIP_DEFAULTS),
        ...Object.keys(TREE3D_VISUAL_DEFAULTS), 'badgeLeafColors'];
    return Object.fromEntries(keys.map(key => [key, settings[key]]));
}

// ---------- 3D Tree Visualization Parameters ----------

// One colour box per badge, built once from TREE3D_BADGES.
function renderTree3dBadgeColours() {
    const list = tree3dField('badgeColours-list');
    if (!list || list.childElementCount) return;
    for (const [key, name, colour] of TREE3D_BADGES) {
        const row = document.createElement('label');
        row.style.cssText = 'display:flex; align-items:center; gap:10px; color:#334155;';
        const input = document.createElement('input');
        input.type = 'color';
        input.id = `tree3d-badgeColour-${key}`;
        input.value = colour;
        input.style.cssText = 'width:42px; height:32px; padding:0; border:1px solid #d1d5db; border-radius:6px; background:#fff;';
        const text = document.createElement('span');
        text.textContent = name;
        row.append(input, text);
        list.append(row);
    }
}

function updateTree3dVisualLabels() {
    const show = (id, text) => { const output = tree3dField(`${id}Value`); if (output) output.textContent = text; };
    const value = id => Number(tree3dField(id)?.value);
    if (!tree3dField('leafAreaWidth')) return;
    show('leafAreaWidth', `${value('leafAreaWidth')}%`);
    show('leafAreaHeight', `${value('leafAreaHeight')}%`);
    const offset = value('leafAreaOffset');
    show('leafAreaOffset', offset === 0 ? '0%' : `${Math.abs(offset)}% ${offset < 0 ? 'up' : 'down'}`);
    show('leafOpacity', value('leafOpacity').toFixed(2));
}

function collectTree3dVisual() {
    if (!tree3dField('leafAreaWidth')) return {};
    const values = Object.fromEntries(TREE3D_VISUAL_NUMBERS.map(key => {
        const number = Number(tree3dField(key).value);
        return [key, Number.isFinite(number) && tree3dField(key).value !== '' ? number : TREE3D_VISUAL_DEFAULTS[key]];
    }));
    return {
        ...values,
        badgeColours: tree3dField('badgeColours').checked,
        badgeLeafColors: Object.fromEntries(TREE3D_BADGES.map(([key, , fallback]) =>
            [key, tree3dField(`badgeColour-${key}`)?.value || fallback]))
    };
}

// Maximum Visible Leaves is the 2D tree's (treeParameters.leafFallThreshold), shared by both trees.
function showTree3dMaxLeaves(count) {
    const value = Math.min(500, Math.max(1, Math.round(Number(count)) || 15));
    if (tree3dField('maxVisibleLeaves')) tree3dField('maxVisibleLeaves').value = value;
    if (tree3dField('leafCount2d')) tree3dField('leafCount2d').textContent = String(value);
    const field2d = document.getElementById('param-leafFallThreshold');
    if (field2d) field2d.value = value;
    showTree3dMaxLeavesExample();
    return value;
}

// The help under Maximum Visible Leaves, with the number set (as typed): "at 21, the 22nd leaf makes the oldest fall".
function showTree3dMaxLeavesExample() {
    const value = Math.min(500, Math.max(1, Math.round(Number(tree3dField('maxVisibleLeaves')?.value)) || 15));
    const tens = (value + 1) % 100;
    const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[(value + 1) % 10] || 'th';
    if (tree3dField('maxLeavesExample')) tree3dField('maxLeavesExample').textContent = String(value);
    if (tree3dField('maxLeavesNext')) tree3dField('maxLeavesNext').textContent = `${value + 1}${suffix}`;
}

// Time at the bottom middle is the 2D tree's (treeParameters.leafShowcaseSeconds), shared by both trees: 12 seconds
// when unset, 0 to 30.
function showTree3dShowcase(seconds) {
    const raw = Number(seconds);
    const value = seconds === undefined || seconds === null || seconds === '' || !Number.isFinite(raw) ? 12 : Math.min(30, Math.max(0, Math.round(raw)));
    if (tree3dField('leafShowcaseSeconds')) tree3dField('leafShowcaseSeconds').value = value;
    const field2d = document.getElementById('param-leafShowcaseSeconds');
    if (field2d) field2d.value = value;
    return value;
}

async function saveTree3dVisualization() {
    try {
        const showcase = tree3dField('leafShowcaseSeconds')?.value;
        const saved = await putTree3dSettings(collectTree3dSettings());
        if (saved) fillTree3dForm(saved);
        const leafFallThreshold = showTree3dMaxLeaves(tree3dField('maxVisibleLeaves')?.value);
        const leafShowcaseSeconds = showTree3dShowcase(showcase);
        const response = await fetch('/api/admin/parameters/treeParameters', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ leafFallThreshold, leafShowcaseSeconds })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save Maximum Visible Leaves');
        showNotification('3D tree visualization saved. The 3D screen updates within a few seconds.', 'success');
    } catch (error) {
        console.error('Error saving the 3D tree visualization:', error);
        showNotification(error.message || 'Failed to save the 3D tree visualization.', 'error');
    }
}

// Resets this section's 3D settings; Maximum Visible Leaves stays, as the 2D tree shares it.
async function resetTree3dVisualization() {
    const defaults = { ...TREE3D_VISUAL_DEFAULTS, badgeLeafColors: Object.fromEntries(TREE3D_BADGES.map(([key, , colour]) => [key, colour])) };
    fillTree3dForm({ ...collectTree3dSettings(), ...defaults });
    await saveTree3dVisualization();
}

async function resetTree3dSettings() {
    const current = collectTree3dSettings();
    fillTree3dForm({ ...TREE3D_DEFAULTS, ...tree3dLeafValues(current), titleBox: current.titleBox });
    await saveTree3dSettings();
}

async function resetTree3dVipSettings() {
    fillTree3dForm({ ...collectTree3dSettings(), ...TREE3D_VIP_DEFAULTS });
    await saveTree3dSettings();
}

async function resetTree3dLeafSettings() {
    fillTree3dForm({ ...collectTree3dSettings(), ...TREE3D_LEAF_DEFAULTS });
    await saveTree3dSettings();
}

async function resetTree3dTitleSettings() {
    const current = collectTree3dSettings();
    fillTree3dForm({ ...current, titleBox: TREE3D_TITLE_DEFAULTS });
    await saveTree3dSettings();
}

// "Wind gust now" and "Play sunset now": the 3D screen runs the action when this time changes.
async function triggerTree3dAction(action) {
    const key = action === 'sunset' ? 'sunsetRequestedAt' : 'gustRequestedAt';
    try {
        await putTree3dSettings({ [key]: new Date().toISOString() });
        showNotification(action === 'sunset' ? 'Sunset sent to the 3D screen.' : 'Wind gust sent to the 3D screen.', 'success');
    } catch (error) {
        console.error('Error sending 3D tree action:', error);
        showNotification(error.message || 'Failed to send the action to the 3D screen.', 'error');
    }
}

// ---------- 3D Tree Growth Stage ----------
// The same growth stage as the 2D tree (treeParameters.treeStage, treeStageMode and leafThresholds), set
// the same way. Manual: the chosen stage. Auto: the tree grows by itself, the stage following the leaf count
// and the thresholds (worked out by the server for /api/parameters, backend/features/parameters/
// treeStage.js; previewed here with getCurrentLeafCount and getStageFromLeafCount from tree.js). The
// /3dTree screen shows the Ketapang Stage 0 to 4 model for it (frontend/3dTree/tree-stage.js), and in Auto
// grows it a little with every leaf until the next stage (frontend/3dTree/tree-growth.js; the growth line).
const TREE3D_STAGE_NAMES = ['Bare Trunk', 'Early Growth', 'Young Canopy', 'Mature Canopy', 'Full Canopy'];

function tree3dStageThresholds() {
    const value = key => parseInt(tree3dField(`thresholdStage${key}`)?.value, 10) || 0;
    return { stage1: value(1), stage2: value(2), stage3: value(3), stage4: value(4) };
}

function tree3dStageIsAuto() {
    return document.querySelector('input[name="tree3dStageMode"]:checked')?.value !== 'manual';
}

// How far the 3D tree has grown through its stage, as the server works it out for the 3D tree's growth
// (backend/features/parameters/treeStage.js stageProgress): "60% grown towards Stage 3 (6 more leaves)".
function tree3dGrowthText(leafCount, thresholds, stage) {
    if (stage >= 4) return 'fully grown';
    const from = stage === 0 ? 0 : Number(thresholds[`stage${stage}`]) || 0;
    const to = Number(thresholds[`stage${stage + 1}`]) || 0;
    const share = to > from ? Math.min(1, Math.max(0, (leafCount - from) / (to - from))) : 1;
    const more = Math.max(0, to - leafCount);
    return `${Math.round(share * 100)}% grown towards Stage ${stage + 1} (${more} more ${more === 1 ? 'leaf' : 'leaves'})`;
}

async function updateTree3dAutoStage() {
    const countLabel = tree3dField('currentLeafCount');
    const preview = tree3dField('autoStagePreview');
    if (!countLabel || !preview) return null;
    const leafCount = await getCurrentLeafCount();
    const thresholds = tree3dStageThresholds();
    const stage = getStageFromLeafCount(leafCount, thresholds);
    countLabel.textContent = String(leafCount);
    preview.textContent = `${stage} (${TREE3D_STAGE_NAMES[stage]})`;
    const growth = tree3dField('growthPreview');
    if (growth) growth.textContent = tree3dGrowthText(leafCount, thresholds, stage);
    if (tree3dStageIsAuto()) tree3dField('treeStage').value = String(stage);
    return stage;
}

function updateTree3dStageMode() {
    const select = tree3dField('treeStage');
    const manual = tree3dField('manualStage');
    if (!select || !manual) return;
    const auto = tree3dStageIsAuto();
    select.disabled = auto;
    manual.style.opacity = auto ? '0.6' : '1';
    if (auto) updateTree3dAutoStage();
}

// Shows a saved stage, mode and thresholds in this panel and in the 2D tree's panel, so both always agree.
function showTree3dStage(treeParameters) {
    const raw = Number(treeParameters?.treeStage);
    const stage = Number.isInteger(raw) ? Math.max(0, Math.min(4, raw)) : 0;
    const mode = treeParameters?.treeStageMode === 'auto' ? 'auto' : 'manual';
    const thresholds = treeParameters?.leafThresholds || {};
    for (const [select, prefix] of [[tree3dField('treeStage'), 'tree3d-thresholdStage'], [document.getElementById('param-treeStage'), 'threshold-stage']]) {
        if (select) select.value = String(stage);
        [1, 2, 3, 4].forEach(key => {
            const input = document.getElementById(`${prefix}${key}`);
            const saved = thresholds[`stage${key}`];
            if (input && saved !== undefined && saved !== null) input.value = saved;
        });
    }
    const radio3d = document.querySelector(`input[name="tree3dStageMode"][value="${mode}"]`);
    if (radio3d) radio3d.checked = true;
    const radio2d = document.querySelector(`input[name="stageMode"][value="${mode}"]`);
    if (radio2d && !radio2d.checked) {
        radio2d.checked = true;
        radio2d.dispatchEvent(new Event('change')); // the 2D panel's own handler updates its stage list
    }
    const text = mode === 'auto'
        ? 'Auto: the tree grows by itself as leaves are added.'
        : `Manual: stage ${stage} (${TREE3D_STAGE_NAMES[stage]}).`;
    const status = tree3dField('stageStatus');
    if (status) status.textContent = text;
    const status2d = document.getElementById('tree-stage-status');
    if (status2d) status2d.textContent = mode === 'auto' ? text : `Current: stage ${stage}. Shown on /tree after apply.`;
    return stage;
}

async function loadTree3dStage() {
    if (!tree3dField('treeStage')) return;
    try {
        const response = await fetch('/api/admin/parameters/treeParameters', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load the tree stage');
        showTree3dStage(data.parameters);
    } catch (error) {
        console.error('Error loading the 3D tree stage:', error);
        const status = tree3dField('stageStatus');
        if (status) status.textContent = 'Unable to load the saved stage.';
    }
    updateTree3dStageMode();
}

async function saveTree3dStage() {
    const status = tree3dField('stageStatus');
    try {
        const leafThresholds = tree3dStageThresholds();
        const auto = tree3dStageIsAuto();
        const treeStageMode = auto ? 'auto' : 'manual';
        const treeStage = auto
            ? await updateTree3dAutoStage()
            : Math.max(0, Math.min(4, Number(tree3dField('treeStage').value) || 0));
        if (status) status.textContent = `Saving stage ${treeStage}...`;
        const response = await fetch('/api/admin/parameters/treeParameters', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ treeStage, treeStageMode, leafThresholds })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save the tree stage');
        showTree3dStage(data.parameters?.treeParameters || { treeStage, treeStageMode, leafThresholds });
        if (status) {
            status.textContent = auto
                ? `Saved: Auto. Stage ${treeStage} (${TREE3D_STAGE_NAMES[treeStage]}) now; the tree grows by itself as leaves are added.`
                : `Saved: stage ${treeStage} (${TREE3D_STAGE_NAMES[treeStage]}). /3dTree shows it within about 5 seconds.`;
        }
        showNotification(auto
            ? `Automatic growth on: the tree is at stage ${treeStage} now and grows by itself as leaves are added.`
            : `Tree growth stage set to stage ${treeStage}. The 3D screen changes within a few seconds.`, 'success');
    } catch (error) {
        console.error('Error saving the 3D tree stage:', error);
        if (status) status.textContent = 'Failed to save the stage. Please try again.';
        showNotification(error.message || 'Failed to save the tree stage.', 'error');
    }
}

async function loadTree3dSettings() {
    loadTree3dStage();
    if (!tree3dField('weatherSource')) return;
    try {
        const response = await fetch('/api/parameters');
        const data = await response.json();
        tree3dBadgeColours2d = { ...(data.parameters?.badgeLeafStyles?.colors || {}) };
        fillTree3dForm(data.parameters?.tree3dParameters);
        // The 3D tree shows as many leaves as the 2D tree's Maximum Visible Leaves.
        showTree3dMaxLeaves(data.parameters?.treeParameters?.leafFallThreshold);
        showTree3dShowcase(data.parameters?.treeParameters?.leafShowcaseSeconds);
    } catch (error) {
        console.error('Error loading 3D tree settings:', error);
        fillTree3dForm(null);
    }
    loadTree3dRainAreas();
}

document.addEventListener('DOMContentLoaded', () => {
    showTreeSettingsForMode(document.getElementById('param-treeDisplayMode')?.value);
    loadTree3dSettings();
    // The names' preview follows the look ("Match the look" writes by hand when glowing) and the new leaf colour.
    tree3dField('glowLook')?.addEventListener('change', updateTree3dNamePreview);
    tree3dField('leafNewSwatches')?.addEventListener('click', () => setTimeout(updateTree3dNamePreview));
});
