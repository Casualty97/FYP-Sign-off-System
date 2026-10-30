# Bluetooth assets

**Owner:** Role 4, Ryan

**Where the code is**

- backend/features/assets/bluetooth.js, store.js
- assets routes still inside backend/features/admin/routes.js
- frontend/admin/js/navigation.js (the asset page lives there)

**What it does**

Registers tablets by Bluetooth id and reports whether a registered device is nearby. There is no real scanner yet: nearby devices come from an in-memory list and the README's test endpoints do not exist.

**Routes** (from tests/contracts/routes.snapshot.txt)

| Method | Path | Registered in |
|---|---|---|
| GET | `/api/admin/assets` | backend/features/admin/routes.js |
| POST | `/api/admin/assets` | backend/features/admin/routes.js |
| DELETE | `/api/admin/assets/:bluetoothId` | backend/features/admin/routes.js |

**Task-sheet items for this feature**

- Bluetooth geolocation tracking of the tablets with a configurable range.
- Out-of-range alerts with sound, and the admin GUI for them.
- A graphical canvas for positioning the tree and pulse displays.
- System-level server hibernation scheduling (shared with Role 3).

---
Generated from the route snapshot plus hand-written notes on 2026-10-31. Update this page when you change the feature.
