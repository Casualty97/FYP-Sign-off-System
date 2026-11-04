// Owner: Role 3, Jun Kai (lives in the kiosk page so the admin Health page can see each tablet).
// Once a minute: tell the server this screen is alive, with its battery level when the browser exposes it.
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

    async function heartbeat() {
        let battery = null;
        let charging = null;
        try {
            if (navigator.getBattery) {
                const info = await navigator.getBattery();
                battery = Math.round(info.level * 100);
                charging = info.charging;
            }
        } catch { /* no battery API on this browser */ }
        try {
            await fetch('/api/health/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId, battery, charging, page: location.pathname.replace(/^\//, '').slice(0, 40) || 'feedback' }),
                keepalive: true
            });
        } catch { /* the server is away; try again next minute */ }
    }

    heartbeat();
    setInterval(heartbeat, 60000);
})();
