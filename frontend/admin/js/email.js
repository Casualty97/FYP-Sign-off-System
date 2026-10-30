// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 25 of 30: email settings and badge email templates. Owner: Role 3.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: no markers in this file   <- counted from the "DONE BY" style markers below
// Current team owner: Role 3, Jun Kai. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
// ==================== 28. EMAIL MANAGEMENT ====================
// Dynamic SMTP fields + load/save/test

function setEmailStatus(type, message) {
  const el = document.getElementById('email-status');
  if (!el) return;

  // simple badge look (same idea as your form management status)
  let bg = '#eef2ff', border = '#c7d2fe', text = '#1e3a8a';
  if (type === 'success') { bg = '#ecfdf5'; border = '#a7f3d0'; text = '#065f46'; }
  if (type === 'error')   { bg = '#fef2f2'; border = '#fecaca'; text = '#991b1b'; }
  if (type === 'info')    { bg = '#eff6ff'; border = '#bfdbfe'; text = '#1d4ed8'; }

  el.innerHTML = `
    <div style="display:inline-block;padding:10px 14px;border-radius:10px;border:1px solid ${border};background:${bg};color:${text};font-weight:600;">
      ${message}
    </div>
  `;
}

function renderEmailFields() {
  const provider = document.getElementById('email-provider')?.value || 'gmail';
  const container = document.getElementById('email-fields');
  if (!container) return;

  if (provider === 'gmail') {
    container.innerHTML = `
      <div class="form-group">
        <label for="gmail-user">Gmail Username</label>
        <input id="gmail-user" type="email" placeholder="e.g. yourgmail@gmail.com" />
      </div>

      <div class="form-group">
        <label for="gmail-pass">Gmail App Password</label>
        <input id="gmail-pass" type="password" placeholder="16-character app password" />
      </div>
    `;
  } else if (provider === 'outlook') {
    container.innerHTML = `
      <div class="form-group">
        <label for="outlook-user">Outlook Username</label>
        <input id="outlook-user" type="email" placeholder="e.g. yourname@company.com" />
      </div>

      <div class="form-group">
        <label for="outlook-pass">Outlook Password</label>
        <input id="outlook-pass" type="password" placeholder="Your Outlook password" />
      </div>
    `;
  } else {
    // custom
    container.innerHTML = `
      <div class="form-group">
        <label for="smtp-host">SMTP Host</label>
        <input id="smtp-host" type="text" placeholder="e.g. smtp.yourdomain.com" />
      </div>

      <div class="form-group">
        <label for="smtp-port">SMTP Port</label>
        <input id="smtp-port" type="number" placeholder="e.g. 587" />
      </div>

      <div class="form-group">
        <label for="smtp-secure">Secure (TLS/SSL)</label>
        <select id="smtp-secure">
          <option value="false">false (STARTTLS, common for 587)</option>
          <option value="true">true (SSL, common for 465)</option>
        </select>
      </div>

      <div class="form-group">
        <label for="smtp-user">SMTP Username</label>
        <input id="smtp-user" type="text" placeholder="SMTP username" />
      </div>

      <div class="form-group">
        <label for="smtp-pass">SMTP Password</label>
        <input id="smtp-pass" type="password" placeholder="SMTP password" />
      </div>
    `;
  }
}

async function loadEmailConfig() {
  try {
    setEmailStatus('info', 'Loading email settings...');

    const res = await fetch('/api/admin/email-config', {
        credentials: 'include'
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      setEmailStatus('error', data.error || 'Failed to load email config.');
      return;
    }

    const cfg = data.config || {};

    // set base fields
    document.getElementById('email-provider').value = cfg.provider || 'gmail';
    document.getElementById('sender-email').value = cfg.senderEmail || '';

    // render fields first (so inputs exist)
    renderEmailFields();

    // fill provider-specific fields
    if (cfg.provider === 'gmail' && cfg.gmail) {
      document.getElementById('gmail-user').value = cfg.gmail.user || '';
      document.getElementById('gmail-pass').value = cfg.gmail.pass || '';
    }

    if (cfg.provider === 'outlook' && cfg.outlook) {
      document.getElementById('outlook-user').value = cfg.outlook.user || '';
      document.getElementById('outlook-pass').value = cfg.outlook.pass || '';
    }

    if (cfg.provider === 'custom' && cfg.custom) {
      document.getElementById('smtp-host').value = cfg.custom.host || '';
      document.getElementById('smtp-port').value = cfg.custom.port ?? 587;
      document.getElementById('smtp-secure').value = String(!!cfg.custom.secure);
      document.getElementById('smtp-user').value = cfg.custom.user || '';
      document.getElementById('smtp-pass').value = cfg.custom.pass || '';
    }

    setEmailStatus('success', 'Settings loaded');
  } catch (err) {
    console.error(err);
    setEmailStatus('error', 'Failed to load email config.');
  }
}

async function saveEmailConfig() {
  try {
    setEmailStatus('info', 'Saving email settings...');

    const provider = document.getElementById('email-provider').value;
    const senderEmail = document.getElementById('sender-email').value.trim();

    const payload = { provider, senderEmail, gmail: {}, outlook: {}, custom: {} };

    if (provider === 'gmail') {
      payload.gmail.user = document.getElementById('gmail-user')?.value.trim() || '';
      payload.gmail.pass = document.getElementById('gmail-pass')?.value || '';
    } else if (provider === 'outlook') {
      payload.outlook.user = document.getElementById('outlook-user')?.value.trim() || '';
      payload.outlook.pass = document.getElementById('outlook-pass')?.value || '';
    } else {
      payload.custom.host = document.getElementById('smtp-host')?.value.trim() || '';
      payload.custom.port = Number(document.getElementById('smtp-port')?.value || 587);
      payload.custom.secure = document.getElementById('smtp-secure')?.value === 'true';
      payload.custom.user = document.getElementById('smtp-user')?.value.trim() || '';
      payload.custom.pass = document.getElementById('smtp-pass')?.value || '';
    }

    const res = await fetch('/api/admin/email-config', {
      method: 'PUT',
      credentials: 'include', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      setEmailStatus('error', data.error || 'Save failed.');
      return;
    }

    setEmailStatus('success', data.message || 'Saved successfully.');
  } catch (err) {
    console.error(err);
    setEmailStatus('error', 'Save failed.');
  }
}

async function sendTestEmail() {
  try {
    const to = document.getElementById('email-test-to')?.value.trim();
    if (!to) {
      setEmailStatus('error', 'Please enter a test email address.');
      return;
    }

    setEmailStatus('info', 'Sending test email...');

    const res = await fetch('/api/admin/email-config/test', {
      method: 'POST',
      credentials: 'include', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      setEmailStatus('error', data.error || 'Test email failed.');
      return;
    }

    setEmailStatus('success', 'Test email sent successfully.');
  } catch (err) {
    console.error(err);
    setEmailStatus('error', 'Test email failed.');
  }
}

// ==================== BADGE EMAIL TEMPLATE MANAGEMENT ====================

let badgeTemplateState = {
    badges: [],
    templates: {},
    selectedKey: ''
};

const DEFAULT_BADGE_EMAIL_BADGES = [
    { key: 'feedback-completer', name: 'Feedback Contributor', description: 'For completing the feedback form', color: '#10b981' },
    { key: 'climate-champion', name: 'Climate Champion', description: 'For pledges focused on climate action and lowering emissions', color: '#0ea5e9' },
    { key: 'renewable-innovator', name: 'Renewable Innovator', description: 'For clean energy and renewable pledges', color: '#f59e0b' },
    { key: 'sustainable-living-advocate', name: 'Sustainable Living Advocate', description: 'For sustainable lifestyle pledges', color: '#16a34a' },
    { key: 'ocean-guardian', name: 'Ocean Guardian', description: 'For ocean conservation pledges', color: '#0284c7' },
    { key: 'social-champion', name: 'Social Champion', description: 'For community and social impact pledges', color: '#ec4899' },
    { key: 'governance-guardian', name: 'Governance Guardian', description: 'For ethics and governance pledges', color: '#6366f1' }
];

const DEFAULT_BADGE_LEAF_COLORS = {
    'feedback-completer': '#4a7c59',
    'climate-champion': '#0f766e',
    'renewable-innovator': '#f59e0b',
    'sustainable-living-advocate': '#16a34a',
    'ocean-guardian': '#0284c7',
    'governance-guardian': '#7c3aed',
    'social-champion': '#d97706'
};

function escapeBadgeTemplateHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setBadgeTemplateStatus(type, message) {
    const el = document.getElementById('badge-template-status');
    if (!el) return;
    el.textContent = message;
    el.className = `fm-status fm-status--${type}`;
}

function readCurrentBadgeTemplateForm() {
    const key = badgeTemplateState.selectedKey;
    if (!key) return;

    badgeTemplateState.templates[key] = {
        subject: document.getElementById('badge-template-subject')?.value.trim() || '',
        message: document.getElementById('badge-template-message')?.value.trim() || '',
        highlights: (document.getElementById('badge-template-highlights')?.value || '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
    };
}

function renderBadgeTemplateForm(key) {
    const template = badgeTemplateState.templates[key] || {};
    document.getElementById('badge-template-subject').value = template.subject || '';
    document.getElementById('badge-template-message').value = template.message || '';
    document.getElementById('badge-template-highlights').value = (template.highlights || []).join('\n');
    renderBadgeTemplateBadgeList();
}

function selectBadgeEmailTemplate() {
    readCurrentBadgeTemplateForm();
    const select = document.getElementById('badge-template-select');
    badgeTemplateState.selectedKey = select?.value || '';
    if (badgeTemplateState.selectedKey) {
        renderBadgeTemplateForm(badgeTemplateState.selectedKey);
    }
}

function renderBadgeTemplateBadgeList() {
    const list = document.getElementById('badge-template-badge-list');
    if (!list) return;

    list.innerHTML = badgeTemplateState.badges.map(badge => {
        const isActive = badge.key === badgeTemplateState.selectedKey;
        return `
            <button
                type="button"
                class="badge-template-badge-card ${isActive ? 'active' : ''}"
                style="--badge-color:${escapeBadgeTemplateHtml(badge.color || '#10b981')}"
                onclick="chooseBadgeEmailTemplate('${escapeBadgeTemplateHtml(badge.key)}')"
            >
                <span class="badge-template-badge-dot"></span>
                <strong>${escapeBadgeTemplateHtml(badge.name)}</strong>
                <small>${escapeBadgeTemplateHtml(badge.description || 'Badge reward')}</small>
            </button>
        `;
    }).join('');
}

function chooseBadgeEmailTemplate(key) {
    readCurrentBadgeTemplateForm();
    badgeTemplateState.selectedKey = key;
    const select = document.getElementById('badge-template-select');
    if (select) select.value = key;
    renderBadgeTemplateForm(key);
}

function populateBadgeTemplatePicker() {
    if (!badgeTemplateState.badges.length) {
        badgeTemplateState.badges = DEFAULT_BADGE_EMAIL_BADGES;
    }

    badgeTemplateState.selectedKey = badgeTemplateState.badges.some(badge => badge.key === badgeTemplateState.selectedKey)
        ? badgeTemplateState.selectedKey
        : badgeTemplateState.badges[0]?.key || '';

    const select = document.getElementById('badge-template-select');
    if (select) {
        select.innerHTML = badgeTemplateState.badges.map(badge => (
            `<option value="${escapeBadgeTemplateHtml(badge.key)}">${escapeBadgeTemplateHtml(badge.name)}</option>`
        )).join('');
        select.value = badgeTemplateState.selectedKey;
    }

    renderBadgeTemplateBadgeList();
}

async function loadBadgeEmailTemplates() {
    try {
        setBadgeTemplateStatus('info', 'Loading badge email templates...');
        const res = await fetch('/api/admin/badge-email-templates', { credentials: 'include' });
        const data = await res.json();

        if (!res.ok || !data.success) {
            badgeTemplateState.badges = DEFAULT_BADGE_EMAIL_BADGES;
            populateBadgeTemplatePicker();
            setBadgeTemplateStatus('error', data.error || 'Failed to load badge email templates.');
            return;
        }

        badgeTemplateState.badges = (data.badges && data.badges.length) ? data.badges : DEFAULT_BADGE_EMAIL_BADGES;
        badgeTemplateState.templates = data.templates || {};
        populateBadgeTemplatePicker();

        if (badgeTemplateState.selectedKey) {
            renderBadgeTemplateForm(badgeTemplateState.selectedKey);
        }

        setBadgeTemplateStatus('success', 'Badge email templates loaded.');
    } catch (err) {
        console.error(err);
        badgeTemplateState.badges = DEFAULT_BADGE_EMAIL_BADGES;
        populateBadgeTemplatePicker();
        setBadgeTemplateStatus('error', 'Failed to load badge email templates.');
    }
}

async function saveBadgeEmailTemplates() {
    try {
        readCurrentBadgeTemplateForm();
        setBadgeTemplateStatus('info', 'Saving badge email templates...');

        const res = await fetch('/api/admin/badge-email-templates', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templates: badgeTemplateState.templates })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            setBadgeTemplateStatus('error', data.error || 'Failed to save badge email templates.');
            return;
        }

        badgeTemplateState.templates = data.templates || badgeTemplateState.templates;
        setBadgeTemplateStatus('success', data.message || 'Badge email templates saved.');
    } catch (err) {
        console.error(err);
        setBadgeTemplateStatus('error', 'Failed to save badge email templates.');
    }
}


