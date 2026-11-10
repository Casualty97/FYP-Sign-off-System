# Bluetooth assets

Owner: Role 4, Ryan

## Behaviour

The main Node server starts one local Python Bleak worker when BLUETOOTH_SCANNER=on. The worker reads BLE advertisements and writes JSON lines through a private child-process pipe. No network reporting endpoint or extra server port is opened. Only advertisements matching a registered active asset's complete service UUID update that asset. The kiosk server imports no active scanner or cleanup timer.

Register a different custom 128-bit service UUID for each physical asset. The UUID is the asset identity; the observed radio address is diagnostic information. Legacy MAC records remain in the register but show Register a service UUID because this prototype tracks service UUIDs. To replace a legacy ID, add a new UUID record and remove the old record. IDs are read-only when editing an existing record.

The Assets page refreshes every 2.5 seconds while visible. It shows live RSSI, the actual last-seen time, and separate nearby, weak-signal, not-detected, scanner-unavailable, inactive, and unsupported-ID states. Never-detected records have no timestamp. Last observations are kept in memory until the server restarts. Scanner heartbeats expire after 15 seconds; device observations expire after the configured timeout. Not confirmed nearby includes unknown/unavailable and inactive records and does not imply a tablet has left the venue.

## Files and routes

- backend/features/assets/tracker.js: identity matching, signal threshold, observation expiry and scanner health.
- backend/features/assets/bluetooth.js: worker lifecycle, environment settings and registered-asset filtering.
- backend/features/assets/scanner.py and requirements.txt: Python BLE worker and dependency pin.
- backend/features/assets/store.js: existing asset register storage.
- backend/features/assets/routes.js: authenticated GET/POST /api/admin/assets and DELETE /api/admin/assets/:bluetoothId. Mounted before the shared admin router.
- frontend/admin/js/navigation.js and the Assets section of frontend/admin/admin.html: register and live status display.

## Setup on Ryan's Windows laptop

From the repository root, with the Python 3.13 manager installed:

```cmd
py -3.13 -m venv ..\esg-bluetooth-venv
..\esg-bluetooth-venv\Scripts\python.exe -m pip install -r backend\features\assets\requirements.txt
```

The existing prototype environment can be reused. In backend/.env set:

```dotenv
KIOSK_AUTOMATION=off
BLUETOOTH_SCANNER=on
BLUETOOTH_RSSI_THRESHOLD=-75
BLUETOOTH_TIMEOUT_MS=20000
```

BLUETOOTH_PYTHON optionally overrides the default sibling environment's executable using an absolute path, for example C:/C300 FYP Project/esg-bluetooth-venv/Scripts/python.exe. Do not include surrounding quotes in the value and do not commit backend/.env. These settings are read at server startup. On Linux/macOS the default sibling environment uses bin/python.

Start with npm start. Open Assets, add the service UUID advertised by your test device, and start that advertiser. The test UUID used during setup is 7b9e1001-4c6a-4f52-9a83-28b176db1020. Keep nRF Connect in the foreground on an unlocked iPhone for this foreground prototype. It has not been validated as an unattended iOS background tracking solution. Register changes are picked up within about one second without restarting the worker.

## Validation

Run npm run check and npm run smoke. Apply the team's pending database changes with npm run db:migrate first; the existing Hardware routes require migration 002_hardware_samples.sql. Smoke requires MySQL and checks the moved endpoint's authentication (the existing requireAdmin guard returns 403), scanner metadata and no-store response. Unit tests exercise that actual admin guard and cover actual-time expiry, threshold boundaries, address changes, ignored unknown services, failed scanners, HTTP registration and authentication, and Python JSON protocol/parent-pipe shutdown using an explicitly simulated BLE driver. No physical radio is required for those tests.

Manual checks on Windows with actual Bluetooth:

1. A registered but never observed asset shows Never detected.
2. Starting the test advertiser shows Detected Nearby with fresh RSSI and Last Seen.
3. Stopping advertisements for 20 seconds shows Not Detected and retains the actual last observation. Restarting the advertiser recovers automatically.
4. A fresh signal below the configured threshold shows Below signal threshold.
5. Turning off the laptop adapter shows scanner unavailable/error, distinct from a missing asset.
6. Stopping npm start ends its Python worker. Restarting the app creates one worker.
7. A legacy dummy MAC remains saved and asks for a service UUID; it never acquires an invented timestamp.

## Limits and remaining work

This is proximity detection based on a configurable RSSI threshold, not floor-plan coordinates or a calibrated distance in metres. Venue walls, device orientation and radio settings affect RSSI; calibrate the threshold on the actual ESG Centre Windows mini PC and Android tablets. Every tracked tablet needs an agreed advertising mechanism or a dedicated attached BLE tag. The successful iPhone foreground trial is an initial prototype only.

Out-of-range alarm sounds and alert settings, a graphical canvas, deployment validation and shared hibernation scheduling remain separate tasks. Range configuration currently uses backend/.env, with an admin settings interface left for the next enhancement.

The former unattainable -10 dBm threshold, unwired report list, fake Last Seen fallback and import-time timers have been replaced. No old public test-report endpoints were added.
