// Owner: Role 2, Wei Jie.
// The 2D tree's picture style (checklist item 12), shared by the admin's 2D Tree Display panel and the 2D page.
// treeParameters.treeStyle is one of:
//   'painted' - the original painted stage pictures (assets/Tree/stage0.png to stage4.png), the default
//   'natural' - pictures captured from the 3D tree in its daylight look
//   'digital' - pictures captured from the 3D tree in its glowing look
// A captured style keeps, for each stage 0 to 4, in assets/Tree/2d-from-3d/<style>/:
//   stage<N>.jpg         - the 3D tree in its scene, 1920 x 1080 (the 2D page shows it full screen)
//   stage<N>-canopy.png  - opaque where the tree's foliage is: where the visitors' leaves may sit
//   stage<N>.json        - when it was captured, and the canopy's box and the tree's foot in the picture
// The pictures are made by the 3D page itself (frontend/3dTree/capture-2d.js), from the admin's "Capture from
// the 3D tree" (POST /api/admin/parameters/tree-style-capture) or scripts/tree/capture-2d-from-3d.js.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TREE_STYLES = Object.freeze(['painted', 'natural', 'digital']);
const CAPTURED_STYLES = Object.freeze(['natural', 'digital']);
const CAPTURE_LOOKS = Object.freeze({ natural: 'natural', digital: 'glow' }); // the 3D page's ?look= for each style
const CAPTURE_FOLDER = '2d-from-3d';
const MAX_SCENE_BYTES = 8 * 1024 * 1024;
const MAX_CANOPY_BYTES = 6 * 1024 * 1024;
const MAX_PICTURE_SIDE = 10000;
const BASE64_TEXT = /^[A-Za-z0-9+/]*={0,2}$/;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// The upload is exactly one picture and nothing else, so no other file (a page or a script) can ride along
// appended to it. A JPEG runs from its start-of-image marker (FF D8 FF) to its end-of-image marker (FF D9) at the
// very end, as canvas.toDataURL makes it.
function isWholeJpeg(bytes) {
    const last = bytes.length - 1;
    return bytes.length >= 5 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        && bytes[last - 1] === 0xff && bytes[last] === 0xd9;
}

// A PNG is its signature, an IHDR chunk first (a sensible width and height), chunks that each fit in the file,
// and an IEND chunk that ends the file.
function isWholePng(bytes) {
    if (bytes.length < PNG_SIGNATURE.length + 25 + 12 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return false;
    let offset = PNG_SIGNATURE.length;
    let first = true;
    while (offset + 12 <= bytes.length) {
        const length = bytes.readUInt32BE(offset);
        const type = bytes.toString('latin1', offset + 4, offset + 8);
        const end = offset + 12 + length; // length, type, data, CRC
        if (end > bytes.length) return false;
        if (first) {
            if (type !== 'IHDR' || length !== 13) return false;
            const width = bytes.readUInt32BE(offset + 8), height = bytes.readUInt32BE(offset + 12);
            if (!width || !height || width > MAX_PICTURE_SIDE || height > MAX_PICTURE_SIDE) return false;
            first = false;
        }
        if (type === 'IEND') return end === bytes.length;
        offset = end;
    }
    return false;
}

const PICTURE_TYPES = Object.freeze({
    jpeg: { prefix: 'data:image/jpeg;base64,', isWhole: isWholeJpeg },
    png: { prefix: 'data:image/png;base64,', isWhole: isWholePng },
});

function normalizeTreeStyle(style) {
    const value = String(style ?? '').trim().toLowerCase();
    return TREE_STYLES.includes(value) ? value : 'painted';
}

function normalizeCaptureStage(stage) {
    const value = Number(stage);
    return Number.isInteger(value) && value >= 0 && value <= 4 ? value : null;
}

// A data: URL of the given type ('jpeg' or 'png') as its bytes; throws a message for the admin if it is not one.
function decodePicture(dataUrl, type, maxBytes, label) {
    const { prefix, isWhole } = PICTURE_TYPES[type];
    const name = type.toUpperCase();
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) throw new Error(`${label} must be a ${name} picture`);
    const encoded = dataUrl.slice(prefix.length);
    // The size is known from the text, so a picture that is too large is refused before it is decoded.
    if (Math.floor(encoded.length / 4) * 3 > maxBytes + 2) throw new Error(`${label} is too large`);
    // Buffer.from skips characters that are not base64; here they make the picture invalid instead.
    if (encoded.length % 4 !== 0 || !BASE64_TEXT.test(encoded)) throw new Error(`${label} is not a valid ${name} picture`);
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length > maxBytes) throw new Error(`${label} is too large`);
    if (!isWhole(bytes)) throw new Error(`${label} is not a valid ${name} picture`);
    return bytes;
}

const whole = (value, max) => {
    const number = Math.round(Number(value));
    return Number.isFinite(number) ? Math.min(max, Math.max(-max, number)) : null;
};
const point = (value, max) => {
    const x = whole(value?.x, max), y = whole(value?.y, max);
    return x === null || y === null ? null : { x, y };
};
const box = (value, max) => {
    const x = whole(value?.x, max), y = whole(value?.y, max), width = whole(value?.width, max), height = whole(value?.height, max);
    return [x, y, width, height].some(n => n === null) || width <= 0 || height <= 0 ? null : { x, y, width, height };
};

// Only the numbers the 2D page uses are kept from the page's description of the picture.
function cleanCaptureMeta(meta, style, stage, capturedAt) {
    const width = whole(meta?.width, 10000), height = whole(meta?.height, 10000);
    if (!width || !height || width <= 0 || height <= 0) throw new Error('The picture size is missing');
    const coverage = Number(meta?.coverage);
    return {
        style,
        stage,
        capturedAt,
        width,
        height,
        canopy: box(meta?.canopy, 10000),
        coverage: Number.isFinite(coverage) ? Math.min(1, Math.max(0, Number(coverage.toFixed(4)))) : null,
        treeFoot: point(meta?.treeFoot, 10000),
        treeTop: point(meta?.treeTop, 10000),
    };
}

function captureFolder(assetsDir, style) {
    return path.join(assetsDir, 'Tree', CAPTURE_FOLDER, style);
}

function captureUrls(style, stage) {
    const base = `/assets/Tree/${CAPTURE_FOLDER}/${style}/stage${stage}`;
    return { scene: `${base}.jpg`, canopy: `${base}-canopy.png`, meta: `${base}.json` };
}

// The files of one capture ([name, contents] pairs), each written beside its old file and then moved over it, so a
// 2D page never reads half a picture. A temporary file has a random name, starts with a dot (the static file
// server does not serve dotfiles) and is created new ('wx'), so an existing file or link of that name is never
// written through. Nothing is moved until all of them are written, and on a failure the temporary files go.
function writeCaptureFiles(folder, files) {
    const pending = [];
    try {
        for (const [name, contents] of files) {
            const temporary = path.join(folder, `.${name}.${crypto.randomBytes(8).toString('hex')}.tmp`);
            pending.push([temporary, path.join(folder, name)]);
            fs.writeFileSync(temporary, contents, { flag: 'wx', mode: 0o644 });
        }
        for (const [temporary, file] of pending) fs.renameSync(temporary, file);
    } catch (error) {
        for (const [temporary] of pending) fs.rmSync(temporary, { force: true });
        throw error;
    }
}

// Checks and saves one capture: { style: 'natural' | 'digital', stage: 0 to 4, scene: JPEG data URL,
// canopy: PNG data URL, meta }. Returns the saved description with the pictures' addresses.
function saveTreeCapture(assetsDir, capture, now = new Date()) {
    const style = String(capture?.style ?? '').trim().toLowerCase();
    if (!CAPTURED_STYLES.includes(style)) throw new Error('Style must be natural or digital');
    const stage = normalizeCaptureStage(capture?.stage);
    if (stage === null) throw new Error('Stage must be 0 to 4');
    const scene = decodePicture(capture?.scene, 'jpeg', MAX_SCENE_BYTES, 'The tree picture');
    const canopy = decodePicture(capture?.canopy, 'png', MAX_CANOPY_BYTES, 'The canopy picture');
    const meta = cleanCaptureMeta(capture?.meta, style, stage, now.toISOString());

    const folder = captureFolder(assetsDir, style);
    fs.mkdirSync(folder, { recursive: true });
    writeCaptureFiles(folder, [
        [`stage${stage}.jpg`, scene],
        [`stage${stage}-canopy.png`, canopy],
        [`stage${stage}.json`, `${JSON.stringify(meta, null, 2)}\n`],
    ]);
    return { ...meta, urls: captureUrls(style, stage) };
}

module.exports = {
    TREE_STYLES,
    CAPTURED_STYLES,
    CAPTURE_LOOKS,
    normalizeTreeStyle,
    normalizeCaptureStage,
    cleanCaptureMeta,
    captureUrls,
    saveTreeCapture,
};
