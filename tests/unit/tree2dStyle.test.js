// Owner: Role 2, Wei Jie.
// Unit tests for the 2D tree's picture style and the pictures captured from the 3D tree (checklist item 12).
// Run: npm run test:unit
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    TREE_STYLES,
    CAPTURE_LOOKS,
    normalizeTreeStyle,
    normalizeCaptureStage,
    cleanCaptureMeta,
    captureUrls,
    saveTreeCapture
} = require('../../backend/features/parameters/tree2dStyle');

const zlib = require('zlib');

// The smallest whole pictures the checks accept: a JPEG from FF D8 FF to FF D9, and a PNG of its signature, an
// IHDR chunk (1 x 1) and an IEND chunk.
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
const pngChunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([length, body, crc]);
};
const pngBytes = (width = 1, height = 1) => {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6; // 8-bit RGBA
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk('IHDR', header), pngChunk('IEND', Buffer.alloc(0))]);
};
const PNG_BYTES = pngBytes();
const jpegUrl = bytes => `data:image/jpeg;base64,${bytes.toString('base64')}`;
const pngUrl = bytes => `data:image/png;base64,${bytes.toString('base64')}`;
const JPEG = jpegUrl(JPEG_BYTES);
const PNG = pngUrl(PNG_BYTES);
const META = { width: 1920, height: 1080, canopy: { x: 230, y: 120, width: 1458, height: 585 }, coverage: 0.31234, treeFoot: { x: 951, y: 935 }, treeTop: { x: 951, y: 100 } };
const tempAssets = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tree2d-style-'));

test('the picture style is painted, natural or digital, painted otherwise', () => {
    assert.deepEqual([...TREE_STYLES], ['painted', 'natural', 'digital']);
    assert.equal(normalizeTreeStyle('Natural'), 'natural');
    assert.equal(normalizeTreeStyle(' digital '), 'digital');
    assert.equal(normalizeTreeStyle('watercolour'), 'painted');
    assert.equal(normalizeTreeStyle(undefined), 'painted');
});

test('each captured style comes from its own 3D look', () => {
    assert.deepEqual({ ...CAPTURE_LOOKS }, { natural: 'natural', digital: 'glow' });
});

test('a capture stage is a whole number from 0 to 4', () => {
    assert.equal(normalizeCaptureStage(0), 0);
    assert.equal(normalizeCaptureStage('4'), 4);
    assert.equal(normalizeCaptureStage(5), null);
    assert.equal(normalizeCaptureStage(1.5), null);
    assert.equal(normalizeCaptureStage('two'), null);
});

test('only the picture numbers are kept from the page description', () => {
    const meta = cleanCaptureMeta({ ...META, note: '<script>', canopy: { ...META.canopy, extra: 'x' } }, 'natural', 4, '2026-11-21T00:00:00.000Z');
    assert.deepEqual(meta, {
        style: 'natural', stage: 4, capturedAt: '2026-11-21T00:00:00.000Z', width: 1920, height: 1080,
        canopy: { x: 230, y: 120, width: 1458, height: 585 }, coverage: 0.3123, treeFoot: { x: 951, y: 935 }, treeTop: { x: 951, y: 100 }
    });
    assert.equal(cleanCaptureMeta({ ...META, canopy: null }, 'digital', 0, 'now').canopy, null); // the bare trunk has no canopy
    assert.throws(() => cleanCaptureMeta({ width: 0, height: 1080 }, 'natural', 1, 'now'), /size/);
});

test('a capture is saved as the picture, the canopy and its description', () => {
    const assets = tempAssets();
    try {
        const saved = saveTreeCapture(assets, { style: 'digital', stage: 2, scene: JPEG, canopy: PNG, meta: META }, new Date('2026-11-21T01:02:03Z'));
        const folder = path.join(assets, 'Tree', '2d-from-3d', 'digital');
        assert.deepEqual(fs.readdirSync(folder).sort(), ['stage2-canopy.png', 'stage2.jpg', 'stage2.json']);
        assert.equal(fs.readFileSync(path.join(folder, 'stage2.jpg'))[0], 0xff);
        const description = JSON.parse(fs.readFileSync(path.join(folder, 'stage2.json'), 'utf8'));
        assert.equal(description.capturedAt, '2026-11-21T01:02:03.000Z');
        assert.equal(description.stage, 2);
        assert.deepEqual(saved.urls, captureUrls('digital', 2));
        assert.equal(saved.urls.scene, '/assets/Tree/2d-from-3d/digital/stage2.jpg');
    } finally {
        fs.rmSync(assets, { recursive: true, force: true });
    }
});

test('a capture with a wrong style, stage or picture is refused and nothing is written', () => {
    const assets = tempAssets();
    try {
        const capture = { style: 'natural', stage: 1, scene: JPEG, canopy: PNG, meta: META };
        assert.throws(() => saveTreeCapture(assets, { ...capture, style: 'painted' }), /natural or digital/);
        assert.throws(() => saveTreeCapture(assets, { ...capture, style: '../../x' }), /natural or digital/);
        assert.throws(() => saveTreeCapture(assets, { ...capture, stage: 7 }), /0 to 4/);
        assert.throws(() => saveTreeCapture(assets, { ...capture, scene: PNG }), /JPEG/);
        assert.throws(() => saveTreeCapture(assets, { ...capture, canopy: JPEG }), /PNG/);
        assert.throws(() => saveTreeCapture(assets, { ...capture, scene: 'data:image/jpeg;base64,aGVsbG8=' }), /not a valid JPEG/);
        assert.equal(fs.existsSync(path.join(assets, 'Tree')), false);
    } finally {
        fs.rmSync(assets, { recursive: true, force: true });
    }
});

test('a picture must be one whole picture: nothing appended, no broken chunks, only base64 text', () => {
    const assets = tempAssets();
    try {
        const capture = { style: 'natural', stage: 3, scene: JPEG, canopy: PNG, meta: META };
        const page = Buffer.from('<script>alert(1)</script>');
        // another file appended after the picture's end
        assert.throws(() => saveTreeCapture(assets, { ...capture, scene: jpegUrl(Buffer.concat([JPEG_BYTES, page])) }), /not a valid JPEG/);
        assert.throws(() => saveTreeCapture(assets, { ...capture, canopy: pngUrl(Buffer.concat([PNG_BYTES, page])) }), /not a valid PNG/);
        // a JPEG cut short, a PNG whose last chunk runs past the end, a PNG without IHDR first, an absurd size
        assert.throws(() => saveTreeCapture(assets, { ...capture, scene: jpegUrl(JPEG_BYTES.subarray(0, 8)) }), /not a valid JPEG/);
        assert.throws(() => saveTreeCapture(assets, { ...capture, canopy: pngUrl(PNG_BYTES.subarray(0, PNG_BYTES.length - 4)) }), /not a valid PNG/);
        const noHeader = Buffer.concat([PNG_BYTES.subarray(0, 8), pngChunk('IEND', Buffer.alloc(0))]);
        assert.throws(() => saveTreeCapture(assets, { ...capture, canopy: pngUrl(noHeader) }), /not a valid PNG/);
        assert.throws(() => saveTreeCapture(assets, { ...capture, canopy: pngUrl(pngBytes(50000, 1)) }), /not a valid PNG/);
        // characters that are not base64 (Buffer.from would quietly skip them)
        assert.throws(() => saveTreeCapture(assets, { ...capture, scene: `${JPEG.slice(0, -4)}<b>${JPEG.slice(-4)}` }), /not a valid JPEG/);
        // too large is refused from the text's length, before it is decoded
        assert.throws(() => saveTreeCapture(assets, { ...capture, scene: `data:image/jpeg;base64,${'A'.repeat(12 * 1024 * 1024)}` }), /too large/);
        assert.equal(fs.existsSync(path.join(assets, 'Tree')), false);
    } finally {
        fs.rmSync(assets, { recursive: true, force: true });
    }
});

test('saving a stage again replaces its files and leaves no temporary files', () => {
    const assets = tempAssets();
    try {
        const capture = { style: 'natural', stage: 0, scene: JPEG, canopy: PNG, meta: META };
        saveTreeCapture(assets, capture, new Date('2026-11-21T00:00:00Z'));
        saveTreeCapture(assets, { ...capture, canopy: pngUrl(pngBytes(2, 2)) }, new Date('2026-11-22T00:00:00Z'));
        const folder = path.join(assets, 'Tree', '2d-from-3d', 'natural');
        assert.deepEqual(fs.readdirSync(folder).sort(), ['stage0-canopy.png', 'stage0.jpg', 'stage0.json']);
        assert.deepEqual(fs.readFileSync(path.join(folder, 'stage0-canopy.png')), pngBytes(2, 2));
        assert.equal(JSON.parse(fs.readFileSync(path.join(folder, 'stage0.json'), 'utf8')).capturedAt, '2026-11-22T00:00:00.000Z');
    } finally {
        fs.rmSync(assets, { recursive: true, force: true });
    }
});
