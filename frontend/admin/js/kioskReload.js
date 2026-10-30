// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 30 of 30: reload on kiosk start/stop. Owner: Role 3.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: no markers in this file   <- counted from the "DONE BY" style markers below
// Current team owner: Role 3, Jun Kai. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
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
