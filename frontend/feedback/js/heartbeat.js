// Owner: Role 3, Jun Kai (lives in the kiosk page so the admin Health page can see each tablet).
// Once a minute: tell the server this screen is alive.
// <Jun Kai start>
(function () {
    const STORAGE_KEY = 'kioskDeviceId';
    let deviceId = null;
    try {
        deviceId = localStorage.getItem(STORAGE_KEY);
        if (!deviceId) {
            deviceId = 'dev-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
            localStorage.setItem(STORAGE_KEY, deviceId);
        }
    } catch {
        deviceId = 'dev-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    }

    let battery = null;
    let sending = false;
    let pending = false;

    async function heartbeat() {
        if (sending) {
            pending = true;
            return;
        }
        sending = true;
        do {
            pending = false;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            try {
                await fetch('/api/health/heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId,
                        page: location.pathname.replace(/^\//, '').slice(0, 40) || 'feedback',
                        batteryLevel: Number.isFinite(battery?.level) ? Math.round(battery.level * 100) : null,
                        charging: battery?.charging ?? null
                    }),
                    keepalive: true,
                    signal: controller.signal
                });
            } catch { /* The next scheduled heartbeat retries. */ }
            finally { clearTimeout(timeout); }
        } while (pending);
        sending = false;
    }

    async function startBatteryReporting() {
        if (typeof navigator.getBattery !== 'function') return;
        try {
            battery = await navigator.getBattery();
            battery.addEventListener('levelchange', heartbeat);
            battery.addEventListener('chargingchange', heartbeat);
            void heartbeat();
        } catch { /* Heartbeats continue when battery access is unavailable. */ }
    }

    void heartbeat();
    void startBatteryReporting();
    setInterval(heartbeat, 60000);
})();
// <Jun Kai end>
