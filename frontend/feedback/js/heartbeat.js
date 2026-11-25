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
    if (typeof navigator.getBattery === 'function') {
        navigator.getBattery().then((manager) => { battery = manager; }).catch(() => {});
    }

    async function heartbeat() {
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
                keepalive: true
            });
        } catch { /* the server is away; try again next minute */ }
    }

    heartbeat();
    setInterval(heartbeat, 60000);
})();
// <Jun Kai end>
