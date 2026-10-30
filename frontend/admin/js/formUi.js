// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 24 of 30: feedback form text and layout. Owner: Role 1.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: no markers in this file   <- counted from the "DONE BY" style markers below
// Current team owner: Role 1, Zihan. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
// ===================== 27. FORM MANAGEMENT =====================
// Configure feedback form UI (background, landing title, subtitle)

function setFormStatus(message, type = 'info', autoHide = false) {
  const status = document.getElementById('fm-status');
  if (!status) return;

  status.textContent = message;
  status.className = `fm-status fm-status--${type}`;

  if (autoHide) {
    setTimeout(() => {
      status.className = 'fm-status fm-status--hidden';
      status.textContent = '';
    }, 2500);
  }
}

async function loadFormUISettings() {
  try {
    setFormStatus('Loading form settings…', 'info');

    const res = await fetch('/api/admin/form-ui');
    const cfg = await res.json();

    document.getElementById('fm-bg').value = cfg.background || '';
    document.getElementById('fm-title').value = cfg.landingTitle || '';
    document.getElementById('fm-subtitle').value = cfg.landingSubtitle || '';

    setFormStatus('Settings loaded', 'success', true);
  } catch (err) {
    console.error(err);
    setFormStatus('Failed to load settings', 'error');
  }
}

async function saveFormUISettings() {
  try {
    setFormStatus('Saving changes…', 'info');

    const currentRes = await fetch('/api/admin/form-ui');
    const currentCfg = await currentRes.json();

    const payload = {
      background: document.getElementById('fm-bg').value,
      landingTitle: document.getElementById('fm-title').value,
      landingSubtitle: document.getElementById('fm-subtitle').value,
      showLandingPageQRCode: Boolean(currentCfg.showLandingPageQRCode)
    };

    const res = await fetch('/api/admin/form-ui', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Save failed');
    }

    setFormStatus('Changes saved successfully', 'success', true);
  } catch (err) {
    console.error(err);
    setFormStatus('Failed to save changes', 'error');
  }
}

async function loadLandingPageQR() {
  try {
    const res = await fetch('/api/admin/form-ui');
    const cfg = await res.json();
    const toggle = document.getElementById('qr-code-toggle');

    if (toggle) {
      toggle.checked = Boolean(cfg.showLandingPageQRCode);
    }

    const status = document.getElementById('landing-qr-status');
    if (status) {
      status.textContent = 'QR setting loaded';
      status.className = 'fm-status fm-status--success';
    }
  } catch (error) {
    console.error('Failed to load landing page QR setting:', error);
  }
}

async function saveLandingPageQR() {
  try {
    const res = await fetch('/api/admin/form-ui');
    const cfg = await res.json();
    const toggle = document.getElementById('qr-code-toggle');
    const showLandingPageQRCode = Boolean(toggle && toggle.checked);

    const payload = {
      background: typeof cfg.background === 'string' ? cfg.background : '',
      landingTitle: typeof cfg.landingTitle === 'string' ? cfg.landingTitle : '',
      landingSubtitle: typeof cfg.landingSubtitle === 'string' ? cfg.landingSubtitle : '',
      showLandingPageQRCode
    };

    const saveRes = await fetch('/api/admin/form-ui', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await saveRes.json();
    if (!saveRes.ok || !data.success) {
      throw new Error(data.error || 'Save failed');
    }

    const status = document.getElementById('landing-qr-status');
    if (status) {
      status.textContent = showLandingPageQRCode ? 'Landing QR code enabled' : 'Landing QR code disabled';
      status.className = 'fm-status fm-status--success';
    }
  } catch (error) {
    console.error('Failed to save landing page QR setting:', error);
    const status = document.getElementById('landing-qr-status');
    if (status) {
      status.textContent = 'Failed to save QR setting';
      status.className = 'fm-status fm-status--error';
    }
  }
}

function setCacheStorageStatus(type, message) {
  const el = document.getElementById('ai-cache-storage-status');
  if (!el) return;

  el.textContent = message;
  el.className = 'fm-status';
  if (type === 'success') {
    el.classList.add('fm-status--success');
  } else if (type === 'error') {
    el.classList.add('fm-status--error');
  } else {
    el.classList.add('fm-status--info');
  }
}

async function loadCacheStorageMode() {
  try {
    const res = await fetch('/api/admin/feedback-analysis-cache-storage');
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to load cache storage mode');
    }

    const select = document.getElementById('ai-cache-storage-mode');
    if (select) {
      select.value = data.storageMode || 'both';
    }

    setCacheStorageStatus('info', `Current storage mode: ${data.storageMode || 'both'}`);
  } catch (error) {
    console.error('Failed to load cache storage mode:', error);
    setCacheStorageStatus('error', 'Failed to load cache storage mode');
  }
}

async function saveCacheStorageMode() {
  try {
    const select = document.getElementById('ai-cache-storage-mode');
    const storageMode = select ? select.value : 'both';

    const res = await fetch('/api/admin/feedback-analysis-cache-storage', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storageMode })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to save cache storage mode');
    }

    setCacheStorageStatus('success', `Cache storage updated to ${data.storageMode}`);
  } catch (error) {
    console.error('Failed to save cache storage mode:', error);
    setCacheStorageStatus('error', 'Failed to save cache storage mode');
  }
}


