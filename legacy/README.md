# legacy/

Files from the previous team's Linux deployment design. Nothing in the current deployment uses them:
`startAll.js` runs `backend/server.js` (HTTPS :3000) and `backend/kioskServer.js` (HTTP :3003) on a Windows PC.

| File | What it was |
|---|---|
| `adminServer.js` | Separate admin server on :3002, always running under systemd (`admin.service`). |
| `gatewayServer.js` | Reverse proxy on :3001 with an offline page, in front of the kiosk server (`gateway.service`). Needs the `http-proxy-middleware` package, which is not installed. |
| `scheduleRunner.js` | Ran every minute from cron to start or stop `kiosk.service` according to `backend/kiosk-schedules.json`. |
| `schedule-Setup.sh` | Installed the three systemd services, the sudoers rule and the cron job on Ubuntu. |

They were moved here unchanged, so their `require('./...')` paths no longer resolve. If the Linux design is ever revived,
move them back and install `http-proxy-middleware`.
