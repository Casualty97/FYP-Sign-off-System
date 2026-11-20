// Owner: Role 2, Wei Jie.
// Unit tests for the 3D ESG Tree settings saved from the admin page. Run: npm run test:unit
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    DEFAULT_TREE3D_PARAMETERS,
    normalizeTree3dParameters,
    mergeTree3dParameters
} = require('../../backend/features/parameters/tree3d');

test('a full save from the admin form is kept as sent', () => {
    const saved = normalizeTree3dParameters({
        weatherSource: 'manual', manualSky: 'night', manualRain: true, rainArea: 'Ang Mo Kio',
        riverLevelMode: 'high', autoOrbit: false, soundEnabled: true, soundVolume: 40,
        showSoilPanel: true, showWeatherPanel: false, showRiverPanel: true, showControlsBar: false, showYearReview: true,
        titleBox: { showTitleBox: true, titleText: 'ESG Tree', subtitleText: 'Our living tree', opacity: 0.3, blur: 10,
            radius: 12, position: 'top-left', paddingX: 20, paddingY: 10 }
    });
    assert.equal(saved.weatherSource, 'manual');
    assert.equal(saved.manualSky, 'night');
    assert.equal(saved.rainArea, 'Ang Mo Kio');
    assert.equal(saved.soundVolume, 40);
    assert.equal(saved.showWeatherPanel, false);
    assert.deepEqual(saved.titleBox, { showTitleBox: true, titleText: 'ESG Tree', subtitleText: 'Our living tree',
        opacity: 0.3, blur: 10, radius: 12, position: 'top-left', paddingX: 20, paddingY: 10 });
});

test('the glowing look is on by default and can be turned off', () => {
    assert.equal(DEFAULT_TREE3D_PARAMETERS.glowLook, true);
    assert.equal(normalizeTree3dParameters({ glowLook: false }).glowLook, false);
    assert.equal(mergeTree3dParameters(DEFAULT_TREE3D_PARAMETERS, { glowLook: false }).glowLook, false);
    assert.throws(() => normalizeTree3dParameters({ glowLook: 'on' }), { statusCode: 400, message: /Glowing look/ });
});

test('wrong values are refused with a readable message, out-of-range numbers are clamped', () => {
    assert.throws(() => normalizeTree3dParameters({ weatherSource: 'cloudy' }), { statusCode: 400, message: /Weather source/ });
    assert.throws(() => normalizeTree3dParameters({ manualSky: 'noon' }), { statusCode: 400 });
    assert.throws(() => normalizeTree3dParameters({ autoOrbit: 'yes' }), { statusCode: 400 });
    assert.throws(() => normalizeTree3dParameters({ titleBox: { position: 'middle' } }), { statusCode: 400 });
    assert.throws(() => normalizeTree3dParameters({ gustRequestedAt: 'not a time' }), { statusCode: 400 });
    assert.throws(() => normalizeTree3dParameters([]), { statusCode: 400 });
    assert.equal(normalizeTree3dParameters({ soundVolume: 250 }).soundVolume, 100);
    assert.equal(normalizeTree3dParameters({ titleBox: { opacity: -1 } }).titleBox.opacity, 0);
});

test('unknown settings are dropped and text is trimmed to a safe length', () => {
    const saved = normalizeTree3dParameters({ hacked: true, titleBox: { titleText: `  ${'x'.repeat(200)}  `, extra: 1 } });
    assert.equal('hacked' in saved, false);
    assert.equal('extra' in saved.titleBox, false);
    assert.equal(saved.titleBox.titleText.length, 80);
});

test('a partial save keeps the other stored settings, including the rest of the title box', () => {
    const stored = mergeTree3dParameters({ weatherSource: 'manual', titleBox: { titleText: 'Old title', blur: 9 } }, {});
    const merged = mergeTree3dParameters(stored, normalizeTree3dParameters({ titleBox: { titleText: 'New title' } }));
    assert.equal(merged.weatherSource, 'manual');
    assert.equal(merged.titleBox.titleText, 'New title');
    assert.equal(merged.titleBox.blur, 9);
    assert.equal(merged.titleBox.radius, DEFAULT_TREE3D_PARAMETERS.titleBox.radius);
});

test('an action time is stored as ISO time, and empty clears it', () => {
    assert.equal(normalizeTree3dParameters({ gustRequestedAt: '2026-11-13T10:00:00Z' }).gustRequestedAt, '2026-11-13T10:00:00.000Z');
    assert.equal(normalizeTree3dParameters({ sunsetRequestedAt: '' }).sunsetRequestedAt, '');
});

test('3D leaf settings: colours and scale are checked; the leaf count is the 2D tree\'s', () => {
    const saved = normalizeTree3dParameters({ showFeedbackLeaves: false, leafNewColor: '#7CB342', leafOldColor: '#1f5f2e',
        leafNewHours: 12, leafScale: 1.5, maxLeaves: 20 });
    // maxLeaves is no longer a 3D setting: the 3D tree shows as many leaves as the 2D tree.
    assert.deepEqual(saved, { showFeedbackLeaves: false, leafNewColor: '#7cb342', leafOldColor: '#1f5f2e',
        leafNewHours: 12, leafScale: 1.5 });
    assert.throws(() => normalizeTree3dParameters({ leafNewColor: 'green' }), { statusCode: 400, message: /colour/ });
    // Greens only: light greens for new leaves, dark greens for older ones.
    assert.throws(() => normalizeTree3dParameters({ leafNewColor: '#e07b24' }), { statusCode: 400, message: /greens/ });
    assert.throws(() => normalizeTree3dParameters({ leafNewColor: '#1f5f2e' }), { statusCode: 400 });
    assert.throws(() => normalizeTree3dParameters({ leafOldColor: '#7cb342' }), { statusCode: 400 });
    assert.equal(normalizeTree3dParameters({ leafSide: 'LEFT' }).leafSide, 'left');
    assert.throws(() => normalizeTree3dParameters({ leafSide: 'up' }), { statusCode: 400 });
    assert.equal(DEFAULT_TREE3D_PARAMETERS.leafNewColor, '#7cb342');
    assert.equal(DEFAULT_TREE3D_PARAMETERS.leafSide, 'both');
    assert.throws(() => normalizeTree3dParameters({ leafOldColor: '#12345' }), { statusCode: 400 });
    assert.equal(normalizeTree3dParameters({ leafScale: 9 }).leafScale, 2.5);
    assert.equal('maxLeaves' in DEFAULT_TREE3D_PARAMETERS, false);
    assert.equal(normalizeTree3dParameters({ showLeafNames: false }).showLeafNames, false);
    assert.equal(DEFAULT_TREE3D_PARAMETERS.showLeafNames, true);
});

test('3D VIP leaf settings: golds only, a VIP scale and the gold glow', () => {
    assert.deepEqual(normalizeTree3dParameters({ vipLeafColor: '#FFD700', vipLeafScale: 1.4, vipGlow: false }),
        { vipLeafColor: '#ffd700', vipLeafScale: 1.4, vipGlow: false });
    assert.throws(() => normalizeTree3dParameters({ vipLeafColor: '#7cb342' }), { statusCode: 400, message: /VIP leaf colour/ });
    assert.equal(normalizeTree3dParameters({ vipLeafScale: 0.1 }).vipLeafScale, 0.4);
    assert.throws(() => normalizeTree3dParameters({ vipGlow: 'on' }), { statusCode: 400 });
    assert.equal(DEFAULT_TREE3D_PARAMETERS.vipLeafColor, '#d4af37');
});

test('the 3D Tree Visualization Parameters are kept within their ranges', () => {
    const saved = normalizeTree3dParameters({
        leafAreaWidth: 10, leafAreaHeight: 75.4, leafAreaOffset: -90, leafRefreshMs: 1000, leafOpacity: 0.456,
        leafAppearMs: 900, leafShowcaseSeconds: 12.34, leafFloatMs: 50000, leafFallMs: 4200, badgeColours: 'true'
    });
    assert.deepEqual(saved, {
        leafAreaWidth: 30, leafAreaHeight: 75, leafAreaOffset: -40, leafRefreshMs: 5000, leafOpacity: 0.46,
        leafAppearMs: 900, leafShowcaseSeconds: 12.3, leafFloatMs: 20000, leafFallMs: 4200, badgeColours: true
    });
    assert.throws(() => normalizeTree3dParameters({ leafFallMs: 'slow' }), /Leaf fall duration must be a number/);
});

test('badge leaf colours take any colour for the known badges and keep the rest', () => {
    const saved = normalizeTree3dParameters({ badgeLeafColors: { 'ocean-guardian': '#00AAFF', 'unknown-badge': '#123456' } });
    assert.deepEqual(saved.badgeLeafColors, { 'ocean-guardian': '#00aaff' });
    assert.throws(() => normalizeTree3dParameters({ badgeLeafColors: { 'ocean-guardian': 'blue' } }), /badge colour/);
    const merged = mergeTree3dParameters({ badgeLeafColors: { 'climate-champion': '#111111' } }, saved);
    assert.equal(merged.badgeLeafColors['ocean-guardian'], '#00aaff');
    assert.equal(merged.badgeLeafColors['climate-champion'], '#111111');
    assert.equal(merged.badgeLeafColors['feedback-completer'], DEFAULT_TREE3D_PARAMETERS.badgeLeafColors['feedback-completer']);
    assert.equal(merged.badgeColours, true, 'leaves are coloured by their badge by default');
    assert.equal(merged.leafShowcaseSeconds, 12);
});

test('the time a leaf stays light can be set in minutes', () => {
    assert.equal(normalizeTree3dParameters({ leafNewHours: 1 / 60 }).leafNewHours, 0.017);
    assert.equal(normalizeTree3dParameters({ leafNewHours: 0.5 }).leafNewHours, 0.5);
    assert.equal(normalizeTree3dParameters({ leafNewHours: 500 }).leafNewHours, 168);
});

test('the names on the 3D leaves: a font style, weight and colour, checked', () => {
    assert.equal(DEFAULT_TREE3D_PARAMETERS.leafNameFont, 'auto', "the look's own font by default");
    assert.equal(DEFAULT_TREE3D_PARAMETERS.leafNameWeight, 700);
    assert.equal(DEFAULT_TREE3D_PARAMETERS.leafNameColor, '#ffffff');
    assert.deepEqual(normalizeTree3dParameters({ leafNameFont: 'Classic-Serif', leafNameWeight: '500', leafNameColor: '#FFE08A' }),
        { leafNameFont: 'classic-serif', leafNameWeight: 500, leafNameColor: '#ffe08a' });
    assert.throws(() => normalizeTree3dParameters({ leafNameFont: 'comic' }), { statusCode: 400, message: /Name font style/ });
    assert.throws(() => normalizeTree3dParameters({ leafNameWeight: 650 }), { statusCode: 400, message: /weight/ });
    assert.throws(() => normalizeTree3dParameters({ leafNameColor: 'red' }), { statusCode: 400, message: /colour/ });
    const merged = mergeTree3dParameters({ leafNameColor: '#000000' }, normalizeTree3dParameters({ leafNameWeight: 400 }));
    assert.equal(merged.leafNameColor, '#000000', 'a weight change keeps the colour');
    assert.equal(merged.leafNameFont, 'auto');
    assert.equal(DEFAULT_TREE3D_PARAMETERS.leafNameSize, 1, 'the standard size');
    assert.equal(normalizeTree3dParameters({ leafNameSize: '1.234' }).leafNameSize, 1.23);
    assert.equal(normalizeTree3dParameters({ leafNameSize: 3 }).leafNameSize, 1.4, 'kept to what fits in the leaf');
    assert.equal(normalizeTree3dParameters({ leafNameSize: 0.2 }).leafNameSize, 0.7);
    assert.throws(() => normalizeTree3dParameters({ leafNameSize: 'big' }), { statusCode: 400, message: /size/ });
});

test('the automatic turn: one turn a day to the right by default; any time from 30 seconds to 24 hours', () => {
    assert.equal(DEFAULT_TREE3D_PARAMETERS.orbitSeconds, 86400);
    assert.equal(DEFAULT_TREE3D_PARAMETERS.orbitDirection, 'right');
    assert.deepEqual(normalizeTree3dParameters({ orbitSeconds: '300', orbitDirection: 'LEFT' }), { orbitSeconds: 300, orbitDirection: 'left' });
    assert.equal(normalizeTree3dParameters({ orbitSeconds: 5 }).orbitSeconds, 30, 'never faster than a turn in 30 seconds');
    assert.equal(normalizeTree3dParameters({ orbitSeconds: 999999 }).orbitSeconds, 86400);
    assert.equal(normalizeTree3dParameters({ orbitSeconds: 90.4 }).orbitSeconds, 90);
    assert.throws(() => normalizeTree3dParameters({ orbitSeconds: 'fast' }), { statusCode: 400, message: /full turn/ });
    assert.throws(() => normalizeTree3dParameters({ orbitDirection: 'up' }), { statusCode: 400, message: /Turn direction/ });
});

test('VIP names: written as the other names unless given their own style, with the same choices', () => {
    assert.equal(DEFAULT_TREE3D_PARAMETERS.vipNameOwnStyle, false);
    assert.deepEqual(
        [DEFAULT_TREE3D_PARAMETERS.vipNameFont, DEFAULT_TREE3D_PARAMETERS.vipNameWeight, DEFAULT_TREE3D_PARAMETERS.vipNameColor, DEFAULT_TREE3D_PARAMETERS.vipNameSize],
        ['auto', 700, '#ffffff', 1]);
    const saved = normalizeTree3dParameters({
        vipNameOwnStyle: true, vipNameFont: 'classic-serif', vipNameWeight: 800, vipNameColor: '#5A3A00', vipNameSize: 1.25
    });
    assert.deepEqual(saved, { vipNameOwnStyle: true, vipNameFont: 'classic-serif', vipNameWeight: 800, vipNameColor: '#5a3a00', vipNameSize: 1.25 });
    assert.equal(normalizeTree3dParameters({ vipNameSize: 3 }).vipNameSize, 1.4);
    assert.throws(() => normalizeTree3dParameters({ vipNameFont: 'comic' }), { statusCode: 400, message: /VIP name font style/ });
    assert.throws(() => normalizeTree3dParameters({ vipNameWeight: 900 }), { statusCode: 400, message: /VIP name font weight/ });
    assert.throws(() => normalizeTree3dParameters({ vipNameColor: 'gold' }), { statusCode: 400, message: /VIP name colour/ });
    assert.throws(() => normalizeTree3dParameters({ vipNameOwnStyle: 'yes' }), { statusCode: 400, message: /own style/ });
    // Saving the VIP names' style leaves the other names' as they were.
    const merged = mergeTree3dParameters({ leafNameColor: '#ffe082' }, saved);
    assert.equal(merged.leafNameColor, '#ffe082');
    assert.equal(merged.vipNameColor, '#5a3a00');
});

test('the background music: on by default at 45, and can be turned off or set from 0 to 100', () => {
    assert.equal(DEFAULT_TREE3D_PARAMETERS.musicEnabled, true);
    assert.equal(DEFAULT_TREE3D_PARAMETERS.musicVolume, 45);
    assert.deepEqual(normalizeTree3dParameters({ musicEnabled: false, musicVolume: 62.4 }), { musicEnabled: false, musicVolume: 62 });
    assert.equal(normalizeTree3dParameters({ musicVolume: 150 }).musicVolume, 100);
    assert.throws(() => normalizeTree3dParameters({ musicEnabled: 'loud' }), { statusCode: 400, message: /Background music/ });
    assert.throws(() => normalizeTree3dParameters({ musicVolume: 'high' }), { statusCode: 400, message: /Music volume/ });
});
