// Owner: Role 3, Jun Kai.
// Reads the numbers behind one hardware sample: CPU %, memory, disk of the project drive and the GPU.
// GPU source is detected once: nvidia-smi when present, else the Windows performance counters (typeperf,
// works for Intel, AMD and NVIDIA on Windows 10+), else "none". Every read is bounded by a timeout.
// <Jun Kai start>
const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');
const paths = require('../../core/paths');

const MB = 1024 ** 2;
const GB = 1024 ** 3;
const run = (file, args, timeout = 10000) => new Promise((resolve, reject) => {
    execFile(file, args, { timeout, windowsHide: true, maxBuffer: 4 * MB }, (error, stdout) => (error ? reject(error) : resolve(String(stdout))));
});
const round1 = (n) => Math.round(n * 10) / 10;
const pct = (n) => Math.min(100, Math.max(0, round1(n)));

function cpuTimes() {
    let idle = 0;
    let total = 0;
    for (const cpu of os.cpus()) {
        for (const key of Object.keys(cpu.times)) total += cpu.times[key];
        idle += cpu.times.idle;
    }
    return { idle, total };
}

// Average CPU use since the previous read, so a 60 s interval gives the real 60 s average
class CpuMeter {
    constructor() { this.last = cpuTimes(); }
    read() {
        const now = cpuTimes();
        const busy = now.total - this.last.total;
        const idle = now.idle - this.last.idle;
        this.last = now;
        if (busy <= 0) return null;
        return pct((1 - idle / busy) * 100);
    }
}

function memory() {
    const total = os.totalmem();
    const used = total - os.freemem();
    return { percent: pct((used / total) * 100), usedMb: Math.round(used / MB), totalMb: Math.round(total / MB) };
}

async function disk() {
    const stats = await fs.promises.statfs(paths.ROOT);
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    const used = total - free;
    return { percent: total ? pct((used / total) * 100) : null, usedGb: round1(used / GB), totalGb: round1(total / GB), path: paths.ROOT };
}

// ---- GPU ----
const GPU_COUNTERS = ['\\GPU Engine(*)\\Utilization Percentage', '\\GPU Adapter Memory(*)\\Dedicated Usage', '\\GPU Adapter Memory(*)\\Shared Usage'];

function parseTypeperf(output) {
    const rows = output.split(/\r?\n/).filter((line) => line.startsWith('"')).map((line) => line.slice(1, -1).split('","'));
    if (rows.length < 2) return null;
    const [header, data] = rows;
    const byEngine = {};
    let dedicated = 0;
    let shared = 0;
    let seen = false;
    for (let i = 1; i < header.length; i++) {
        const name = header[i];
        const value = parseFloat(data[i]);
        if (!Number.isFinite(value)) continue;
        if (/\\Utilization Percentage$/.test(name)) {
            const type = (name.match(/engtype_([A-Za-z0-9]+)/) || [])[1] || 'other';
            byEngine[type] = (byEngine[type] || 0) + value;
            seen = true;
        } else if (/\\Dedicated Usage$/.test(name)) dedicated += value;
        else if (/\\Shared Usage$/.test(name)) shared += value;
    }
    if (!seen) return null;
    const percent = pct(Math.max(0, ...Object.values(byEngine)));
    const usedMb = Math.round((dedicated + shared) / MB);
    return { percent, memoryUsedMb: usedMb || null, memoryTotalMb: null, busiestEngine: Object.entries(byEngine).sort((a, b) => b[1] - a[1])[0][0] };
}

async function readNvidia() {
    const out = await run('nvidia-smi', ['--query-gpu=name,utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'], 8000);
    const [name, util, used, total] = out.trim().split('\n')[0].split(',').map((s) => s.trim());
    return { name, percent: pct(Number(util)), memoryUsedMb: Math.round(Number(used)), memoryTotalMb: Math.round(Number(total)) };
}

async function readCounters() {
    return parseTypeperf(await run('typeperf', [...GPU_COUNTERS, '-sc', '1'], 12000));
}

async function windowsGpuName() {
    try {
        const out = await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', '(Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name) -join ", "'], 10000);
        return out.trim() || null;
    } catch { return null; }
}

// { source: 'nvidia-smi' | 'windows-counters' | 'none', name }
async function detectGpu() {
    try {
        const first = await readNvidia();
        return { source: 'nvidia-smi', name: first.name };
    } catch { /* no nvidia-smi on this PC */ }
    if (process.platform === 'win32') {
        try {
            if (await readCounters()) return { source: 'windows-counters', name: await windowsGpuName() };
        } catch { /* counters not available */ }
    }
    return { source: 'none', name: null };
}

let gpuBusy = false;
async function gpu(source) {
    if (source === 'none' || gpuBusy) return null;
    gpuBusy = true;
    try {
        if (source === 'nvidia-smi') return await readNvidia();
        return await readCounters();
    } finally { gpuBusy = false; }
}

module.exports = { CpuMeter, memory, disk, detectGpu, gpu, parseTypeperf };
// <Jun Kai end>
