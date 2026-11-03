# Hardware usage graphs with forecasting

**Owner:** Role 3, Jun Kai

**Where the code is**

- backend/features/hardware/collect.js (CPU, memory, disk and GPU readings), sampler.js (takes a sample on the configured interval and prunes old rows), forecast.js (Holt linear trend, straight-line disk fit; pure functions), settings.js (backend/data/hardware-settings.json), routes.js (the API below)
- frontend/admin/js/hardware.js and the Hardware page in admin.html (sidebar group SYSTEM); the chart styles sit in the UI kit block of admin.css
- table hardware_samples (database/migrations/002_hardware_samples.sql)
- tests/unit/forecast.test.js (run with `npm run test:unit`, also in CI)

**What it does**

backend/server.js starts the sampler after boot. Every N seconds (default 60, set on the page: 15 s to 10 min) it stores CPU % (average since the previous sample), memory, disk use of the project drive and the GPU (nvidia-smi when present, otherwise the Windows performance counters through `typeperf`; "not available" elsewhere). Rows older than the retention setting (default 30 days) are deleted once an hour. The page shows four stat tiles, four line graphs for 1 hour to 30 days (averaged per minute up to per 4 hours so an answer never exceeds about 200 points), a table view of the same values, and a forecast: Holt double exponential smoothing over the last 24 hours of 10-minute averages for CPU, memory and GPU (dashed line plus a typical-error band), and a straight-line fit of the last 30 days for the disk ("full in about N days"). Statistics only, no AI. Refreshes every minute while the page is open. `PORT` in backend/.env runs the HTTPS server on another port, handy for testing a branch next to a live copy.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/hardware/overview` | backend/features/hardware/routes.js |
| GET | `/api/admin/hardware/series` | backend/features/hardware/routes.js |
| GET | `/api/admin/hardware/settings` | backend/features/hardware/routes.js |
| PUT | `/api/admin/hardware/settings` | backend/features/hardware/routes.js |

**Task-sheet items for this feature**

- Build a hardware resource monitoring dashboard with graphs for GPU, CPU, memory, and storage usage, with configurable intervals and usage forecasting (Admin Screen point 4). Forecasting is statistical by agreement with the supervisor.

**Known issues**

- GPU memory total is only known with nvidia-smi; with the Windows counters the tile shows memory in use only.
- The first CPU reading after a server start is empty (it is an average since the previous sample).
- Reading the Windows GPU counters takes about 2 s per sample; the sampler runs it in a child process so the page is not affected.

---
Hand-written on 2026-11-03. Update this page when you change the feature.
