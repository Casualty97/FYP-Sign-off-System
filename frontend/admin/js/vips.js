// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 29 of 30: VIP management. Owner: shared.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ==================== 31. VIP MANAGEMENT (DONE BY ZAH) ====================

// VIP Data (Active only)
let vipData = [];

// API base (same origin)
const VIP_API_BASE = "/api/admin";

/*
    Expected API (ACTIVE ONLY for this UI):
    GET  /api/admin/vips
    POST /api/admin/vips   { name }
*/
const VIP_API = {
    list: () => `${VIP_API_BASE}/vips`,
    create: () => `${VIP_API_BASE}/vips`,
    delete: (id) => `${VIP_API_BASE}/vips/${id}`
};

// DOM helpers (NEW VIP UI)
function getVipElements() {
    return {
        vipPage: document.getElementById("vip-page"),
        vipList: document.getElementById("vip-list"),
        vipCount: document.getElementById("vip-count")
    };
}

// Safe HTML escape (fallback if global helper not available)
function escapeHtmlSafe(value) {
    if (typeof window.escapeHtml === "function") {
        return window.escapeHtml(value);
    }

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// Date formatter
function formatVipDate(value) {
    if (!value) return "-";

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";

    return d.toLocaleString();
}

// Fetch helper
async function fetchVipJson(url, options = {}) {
    const res = await fetch(url, options);

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} - ${text}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        return {};
    }

    return res.json();
}

// Render VIP list (NEW UI)
function renderVipList() {
    const { vipList, vipCount } = getVipElements();
    if (!vipList || !vipCount) return;

    vipCount.textContent = `${vipData.length} VIP(s)`;

    if (!vipData.length) {
        vipList.innerHTML = `
            <div class="vip-empty">
                No VIP names yet.
            </div>
        `;
        return;
    }

    vipList.innerHTML = vipData.map((vip) => {
        const name = escapeHtmlSafe(vip.name ?? "");
        const vipNameForJs = name.replace(/'/g, "\\'"); // escape single quotes

        // Support different backend field names
        const createdAt = formatVipDate(vip.created_at ?? vip.createdAt);

        return `
            <div class="vip-item">
                <div class="vip-item-left">
                    <div class="vip-name">👑 ${name}</div>
                    <div class="vip-date">Added: ${createdAt}</div>
                </div>
                <div class="vip-item-actions">
                    <button type="button" class="vip-delete-btn" onclick="deleteVip('${vipNameForJs}')">
                        Remove &#128465;
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

// Load VIPs 
async function loadVipData() {
    const { vipList, vipCount } = getVipElements();
    if (!vipList || !vipCount) return;

    vipCount.textContent = "Loading...";
    vipList.innerHTML = `
        <div class="vip-empty">
            Loading VIPs...
        </div>
    `;

    try {
        const res = await fetchVipJson(VIP_API.list());

        // Support formats: [ ... ] OR { vips: [...] } OR { data: [...] }
        vipData = Array.isArray(res) ? res : (res.vips || res.data || []);

        renderVipList();
    } catch (err) {
        console.error("VIP load error:", err);
        vipCount.textContent = "Error";
        vipList.innerHTML = `
            <div class="vip-empty" style="color:#ef4444;">
                Failed to load VIPs.
            </div>
        `;
    }
}

// Loader used by showPage('vip')
function loadVipManagementData() {
    loadVipData();
}

window.loadVipManagementData = loadVipManagementData;

// Add VIP (NEW UI)
async function addVip() {
    const name = prompt("Enter VIP name (exact match):");
    if (!name) return;

    const trimmed = name.trim();
    if (trimmed.length < 2) {
        alert("VIP name is too short.");
        return;
    }

    try {
        await fetchVipJson(VIP_API.create(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmed })
        });

        // Notify any open tree view to re-fetch VIP names immediately.
        const vipRefreshStamp = String(Date.now());
        try {
            localStorage.setItem('tree-vip-refresh', vipRefreshStamp);
        } catch (storageError) {
            console.warn('Could not write VIP refresh signal:', storageError);
        }
        window.dispatchEvent(new CustomEvent('tree-vip-refresh', {
            detail: { timestamp: vipRefreshStamp, name: trimmed }
        }));

        // Refresh list
        loadVipData();
    } catch (err) {
        console.error("Add VIP error:", err);

        // If backend returns duplicate key, show nicer message
        if (String(err.message).includes("409")) {
            alert("VIP already exists.");
        } else {
            alert("Failed to add VIP.");
        }
    }
}

// Delete VIP (Done by Yu Kang)
async function deleteVip(vipName) {
    // Validate name (string, at least 2 chars)
    if (!vipName || typeof vipName !== 'string' || vipName.trim().length < 2) {
        alert("Invalid VIP name.");
        return;
    }

    const confirmed = confirm(`Delete VIP "${vipName}"?`);
    if (!confirmed) return;

    try {
        const encodedName = encodeURIComponent(vipName.trim());
        const url = `/api/admin/vips/${encodedName}`;

        const response = await fetch(url, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || "Failed to delete VIP");
        }

        await loadVipData();   // refresh the list
        alert("VIP deleted successfully");
    } catch (err) {
        console.error("Delete VIP error:", err);
        alert(err.message || "Failed to delete VIP.");
    }
}

// Expose for HTML onclick
window.addVip = addVip;
window.deleteVip = deleteVip;


