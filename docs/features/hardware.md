# Hardware usage graphs with forecasting

**Owner:** Role 3, Jun Kai

**Where the code is**

- backend/features/hardware/collect.js (CPU, memory, disk and GPU readings), ranges.js (the graph ranges, presets and custom), sampler.js (takes a sample on the configured interval and prunes old rows), forecast.js (Holt linear trend, straight-line disk fit; pure functions), settings.js (backend/data/hardware-settings.json), routes.js (the API below)
- frontend/admin/js/hardware.js and the Hardware page in admin.html (sidebar group SYSTEM); the chart styles sit in the UI kit block of admin.css
- table hardware_samples (database/migrations/002_hardware_samples.sql)
- tests/unit/forecast.test.js and tests/unit/ranges.test.js (run with `npm run test:unit`, also in CI)

**What it does**

backend/server.js starts the sampler after boot. Every N seconds (default 60, set on the page: 15 s to 10 min; each setting of the Sampling card has presets and a Custom choice for any whole number within its limits) it stores CPU % (average since the previous sample), memory, disk use of the project drive and the GPU (nvidia-smi when present, otherwise the Windows performance counters through `typeperf`; "not available" elsewhere). Rows older than the retention setting (default 30 days) are deleted once an hour. The page shows four stat tiles, four line graphs for 1 hour to 30 days or a custom range (the last N hours, days, weeks, months or years, up to 5 years, with calendar months and years), averaged per minute up to per 2 weeks so an answer never exceeds about 200 points, a table view of the same values, and a forecast: Holt double exponential smoothing with a damped trend for CPU, memory and GPU over the unbroken run of 10-minute averages in the last 24 hours (or twice the forecast horizon when that is longer; a night in hibernation is not treated as a step). A trend is trusted for about as long as it has been seen (it fades by half over half the run, at least an hour, and a run shorter than 6 hours counts for less) and never moves the value further than the readings moved within the run, so the PC settling after a wake-up no longer forecasts memory at 0 %. Drawn as a dashed line plus a band that widens with the horizon up to twice the usual spread of the readings, and a straight-line fit of the last 30 days for the disk ("full in about N days"). Statistics only, no AI. Refreshes every minute while the page is open.

Forecast length (11 Nov 2026, supervisor meeting 04): "Forecast ahead" goes from 1 hour to 1 year (presets 6 hours to 7 days, 1, 3 and 6 months, 1 year; Custom in hours, days, months of 30 days or years of 365 days). Up to 7 days the forecast works on the 10-minute steps described above. Beyond that it works on one average per day (only days with at least an hour of samples, so closed days are left out; it needs 6 such days), looks back twice the forecast length (at least 30 days, at most the keep period), is thinned to at most 200 points and is kept for 10 minutes; this far ahead the damped trend has faded, so CPU, memory and GPU show their usual level and range, not a prediction for one day, and only the disk line really extrapolates. A forecast counts as dependable when the stored samples go back about as far as it looks ahead (`forecast.horizonCheck`, 5 % short still counts). Otherwise it is a rough guide: the Forecast card says so in an amber note with the reason (waiting is enough, or samples are deleted before the history can get that long), and saving such a choice first opens a reminder with "Go back" and "Save anyway". The reminder appears when the forecast length changes or the keep period is shortened, for presets and Custom values alike; `GET /api/admin/hardware/forecast-check?forecastHours=&retentionDays=` answers the question for the values in the form. The Sampler details show the oldest sample. A disk that is not growing is drawn level instead of continuing a clean-up downwards. `PORT` in backend/.env runs the HTTPS server on another port, handy for testing a branch next to a live copy.

Look (9 Nov 2026): the time range is a segmented control with the chosen range raised on a grey track. The graphs break the line where there are no samples for more than three periods (the PC hibernating overnight) instead of drawing straight across the gap, the time axis follows the span actually drawn (with dates once it passes a day), and a range longer than the samples are kept starts at the oldest sample, with the note under the toolbar saying so. The Forecast card explains itself in one plain line; the method sits in a small line under the numbers.

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
- The forecast needs about an hour of samples (six 10-minute averages) before it shows anything; a forecast longer than 7 days needs 6 days with samples.
- A yearly forecast only becomes dependable after a year of samples with "Keep samples for" set to 1 year (about 525,000 rows at one sample a minute). A small table of daily summaries kept for good would make that cheaper; not built yet.
- Reading the Windows GPU counters takes about 2 s per sample; the sampler runs it in a child process so the page is not affected.
- A custom range longer than "Keep samples for" (at most 1 year) is partly empty; the note under the graphs says how long samples are kept.

---
Hand-written on 2026-11-03. Update this page when you change the feature.
