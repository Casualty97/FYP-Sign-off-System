// Owner: Role 3, Jun Kai. Previous team: none marked.
// Part 30/30 of the admin page: reload on kiosk start/stop (load order in admin.html).
// ==================== KIOSK AUTO-RELOAD ON START/STOP ====================

let lastKioskActive = null;

async function watchKioskService() {
  try {
    const res = await fetch('/api/admin/kiosk-status', { cache: 'no-store' });
    const { active } = await res.json();

    // first run: store state only
    if (lastKioskActive === null) {
      lastKioskActive = active;
      return;
    }

    // state changed => reload
    if (active !== lastKioskActive) {
      console.log('🔄 Kiosk state changed, reloading...');
      location.reload();
    }

    lastKioskActive = active;
  } catch (err) {
    console.error('❌ kiosk-status check failed:', err);
  }
}

setInterval(watchKioskService, 3000);
watchKioskService();
