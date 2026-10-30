// Owner: Role 3, Jun Kai. Previous team: none marked.
// Part 30/30 of the admin page: refresh the server-control status when the kiosk starts or stops (load order in admin.html).
// ==================== KIOSK STATUS WATCHER ====================

let lastKioskActive = null;

async function watchKioskService() {
  if (!sessionStorage.getItem('loggedUser')) return; // nothing to watch before login
  try {
    const res = await fetch('/api/admin/kiosk-status', { cache: 'no-store' });
    if (!res.ok) return; // a 401 body has no `active`; comparing it reloaded the page right after login
    const { active } = await res.json();
    if (typeof active !== 'boolean') return;

    // State changed: refresh the status widgets instead of reloading the whole admin page
    if (lastKioskActive !== null && active !== lastKioskActive && typeof checkServerStatus === 'function') {
      checkServerStatus();
    }
    lastKioskActive = active;
  } catch (err) {
    console.error('❌ kiosk-status check failed:', err);
  }
}

setInterval(watchKioskService, 3000);
