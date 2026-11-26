// Owner: Role 1, Zihan. Previous team: Nick (7).
// Part 13/30 of the admin page: photo frame (overlay) management (load order in admin.html).
// ==================== 12. OVERLAY MANAGEMENT ====================

// Load overlay data
async function loadOverlayData() {
    try {
        console.log('🎨 Loading overlay data...');
        const response = await fetch('/api/admin/overlays');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Overlay API response:', data);
        
        if (data.success) {
            if (data.message === 'Overlays table does not exist yet') {
                updateOverlayTable([]);
                showOverlayMessage('No overlays table found in database. Please run the database setup.');
            } else {
                updateOverlayTable(data.overlays);
            }
        } else {
            console.error('Failed to load overlay data:', data.error);
            alert('Error loading overlay data: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading overlay data:', error);
        alert('Error connecting to server. Please check if the server is running.');
    }
}

// Show overlay message
function showOverlayMessage(message) {
    const overlayGrid = document.querySelector('.overlay-grid');
    if (overlayGrid) {
        overlayGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 40px; color: #64748b;">
                <div style="font-size: 64px; margin-bottom: 20px;">📁</div>
                <h3 style="color: #64748b; margin-bottom: 15px; font-size: 18px;">No Overlay Data</h3>
                <p style="margin-bottom: 25px; line-height: 1.5;">${message}</p>
                <button class="btn-primary" onclick="createOverlaysTable()" style="margin-top: 10px;">
                    Create Overlays Table
                </button>
            </div>
        `;
    }
}

// Create overlays table (placeholder)
function createOverlaysTable() {
    alert('This would create the overlays table in the database. You need to run the database setup script.');
}

// Update overlay table
// <Jun Kai start>
// Overlays A, the picture gallery: one card per overlay that leads with its desktop and mobile pictures, with the name,
// theme ID, order and file type under them. The ID, both file paths and the date it was added open in the details
// panel (click a card). The buttons call the same viewOverlay() and deleteOverlay() as before.
let overlayList = [];
let overlayOpenId = null;

function overlayEscape(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function overlayTypeText(overlay) {
    const desktop = getOverlayFileTypeLabel(overlay.desktop_filename);
    const mobile = getOverlayFileTypeLabel(overlay.mobile_filename);
    return desktop === mobile ? desktop : `Desktop ${desktop} / Mobile ${mobile}`;
}

// a picture of an overlay file; a video file plays muted, a missing file says so
function overlayPicture(src, kind, size) {
    const file = overlayEscape(src);
    const media = /\.(mp4|webm)$/i.test(String(src || '').split('?')[0])
        ? `<video src="${file}" muted loop autoplay playsinline onerror="this.parentElement.classList.add('is-missing')"></video>`
        : `<img src="${file}" alt="" loading="lazy" onerror="this.parentElement.classList.add('is-missing')">`;
    return `<span class="ov-pic ov-pic-${kind}${size ? ` ov-pic-${size}` : ''}" title="${kind === 'desktop' ? 'Desktop' : 'Mobile'} picture">${src ? media : ''}</span>`;
}

function overlayAddedText(overlay) {
    if (!overlay.created_at) return 'Not recorded';
    const date = new Date(overlay.created_at);
    return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString();
}

function fillOverlayIcons() {
    document.querySelectorAll('#overlay-page [data-fb-icon]').forEach((slot) => {
        slot.outerHTML = uiIcon(slot.getAttribute('data-fb-icon'), 16);
    });
}

function updateOverlayTable(overlays) {
    const overlayGrid = document.querySelector('.overlay-grid');
    if (!overlayGrid) {
        console.error('Overlay grid not found');
        return;
    }
    fillOverlayIcons();
    overlayList = Array.isArray(overlays) ? overlays : [];
    overlayGrid.innerHTML = '';

    if (overlayList.length === 0) {
        overlayGrid.innerHTML = '<p class="ui-empty ov-loading">No overlays yet. Add one with Add overlay.</p>';
        closeOverlayPanel(false);
        return;
    }

    overlayList.forEach((overlay) => {
        const name = overlay.display_name || overlay.theme_id || `Overlay ${overlay.id}`;
        const card = document.createElement('div');
        card.className = 'overlay-card ov-card ui-card';
        card.dataset.overlayId = overlay.id;
        card.innerHTML = `
            <div class="ov-pics">${overlayPicture(overlay.desktop_filename, 'desktop')}${overlayPicture(overlay.mobile_filename, 'mobile')}</div>
            <div class="ov-meta">
                <div class="ov-text">
                    <button type="button" class="ov-name" data-ov="open" title="Show the details">${overlayEscape(name)}</button>
                    <p class="ov-sub">Theme ID <code>${overlayEscape(overlay.theme_id)}</code> · order ${overlayEscape(overlay.display_order)} · ${overlayEscape(overlayTypeText(overlay))}</p>
                </div>
                <div class="ov-actions">
                    <button type="button" class="ui-btn ui-btn-icon" data-ov="preview" title="Preview both pictures" aria-label="Preview ${overlayEscape(name)}">${uiIcon('image', 16)}</button>
                    <button type="button" class="ui-btn ui-btn-icon ui-danger" data-ov="delete" title="Delete" aria-label="Delete ${overlayEscape(name)}">${uiIcon('trash', 16)}</button>
                </div>
            </div>`;
        // the values go to the old functions as they are, never through a built onclick string
        card.addEventListener('click', (event) => {
            const action = event.target.closest('[data-ov]')?.dataset.ov || 'open';
            if (action === 'preview') viewOverlay(overlay.desktop_filename, overlay.mobile_filename, name, overlay.theme_id);
            else if (action === 'delete') deleteOverlay(overlay.id);
            else openOverlayPanel(overlay.id);
        });
        overlayGrid.appendChild(card);
    });

    // a panel that is open stays open on the same overlay, or closes when that overlay is gone
    if (overlayOpenId !== null) {
        if (overlayList.some((item) => Number(item.id) === overlayOpenId)) openOverlayPanel(overlayOpenId, false);
        else closeOverlayPanel(false);
    }
}

function openOverlayPanel(overlayId, focus = true) {
    const id = Number(overlayId);
    const overlay = overlayList.find((item) => Number(item.id) === id);
    const panel = document.getElementById('overlay-panel');
    if (!overlay || !panel) return;
    const name = overlay.display_name || overlay.theme_id || `Overlay ${overlay.id}`;
    overlayOpenId = id;
    panel.innerHTML = `
        <header class="ui-sidepanel-head">
            <div>
                <h3 id="overlay-panel-title" tabindex="-1">${overlayEscape(name)}</h3>
                <p>Theme ID ${overlayEscape(overlay.theme_id)} · order ${overlayEscape(overlay.display_order)}</p>
            </div>
            <button type="button" class="ui-btn ui-btn-icon" data-ov="close" title="Close" aria-label="Close the details">${uiIcon('close', 16)}</button>
        </header>
        <div class="ui-sidepanel-body">
            <div class="ov-panel-pics">
                <figure>${overlayPicture(overlay.desktop_filename, 'desktop', 'large')}<figcaption>Desktop</figcaption></figure>
                <figure>${overlayPicture(overlay.mobile_filename, 'mobile', 'large')}<figcaption>Mobile</figcaption></figure>
            </div>
            <dl class="ui-kv ov-facts">
                <dt>ID</dt><dd>${overlayEscape(overlay.id)}</dd>
                <dt>Theme ID</dt><dd><code>${overlayEscape(overlay.theme_id)}</code></dd>
                <dt>Display order</dt><dd>${overlayEscape(overlay.display_order)}</dd>
                <dt>File type</dt><dd>${overlayEscape(overlayTypeText(overlay))}</dd>
                <dt>Desktop file</dt><dd class="ov-path">${overlayEscape(overlay.desktop_filename)}</dd>
                <dt>Mobile file</dt><dd class="ov-path">${overlayEscape(overlay.mobile_filename)}</dd>
                <dt>Added</dt><dd>${overlayEscape(overlayAddedText(overlay))}</dd>
            </dl>
        </div>
        <footer class="ui-sidepanel-foot">
            <button type="button" class="ui-btn ui-btn-danger" data-ov="delete">${uiIcon('trash', 15)}Delete this overlay</button>
            <span class="ui-spacer"></span>
            <button type="button" class="ui-btn ui-btn-secondary" data-ov="preview">${uiIcon('image', 15)}Preview both</button>
        </footer>`;
    panel.onclick = (event) => {
        const action = event.target.closest('[data-ov]')?.dataset.ov;
        if (action === 'close') closeOverlayPanel();
        else if (action === 'preview') viewOverlay(overlay.desktop_filename, overlay.mobile_filename, name, overlay.theme_id);
        else if (action === 'delete') deleteOverlay(overlay.id);
    };
    panel.hidden = false;
    document.getElementById('overlay-page')?.classList.add('ui-has-sidepanel');
    document.querySelectorAll('#overlay-page .ov-card.is-open').forEach((card) => card.classList.remove('is-open'));
    document.querySelector(`#overlay-page .ov-card[data-overlay-id="${id}"]`)?.classList.add('is-open');
    if (focus) document.getElementById('overlay-panel-title')?.focus({ preventScroll: true });
}

function closeOverlayPanel(refocus = true) {
    const panel = document.getElementById('overlay-panel');
    const id = overlayOpenId;
    overlayOpenId = null;
    if (panel) { panel.hidden = true; panel.innerHTML = ''; }
    document.getElementById('overlay-page')?.classList.remove('ui-has-sidepanel');
    document.querySelectorAll('#overlay-page .ov-card.is-open').forEach((card) => card.classList.remove('is-open'));
    if (refocus && id !== null) document.querySelector(`#overlay-page .ov-card[data-overlay-id="${id}"] .ov-name`)?.focus({ preventScroll: true });
}

// Escape closes the details (not while the preview or the add dialog is open over them)
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || overlayOpenId === null) return;
    if (document.querySelector('.overlay-preview-popup, .add-overlay-modal')) return;
    closeOverlayPanel();
});
// <Jun Kai end>

// View overlay function shows both desktop and mobile
function viewOverlay(desktopImagePath, mobileImagePath, title, themeId) {
    console.log('Viewing overlay:', title);
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
    const shownTitle = overlayEscape(title); // <Jun Kai/> a typed name is shown as text, never read as HTML
    const desktopExtension = getOverlayFileExtension(desktopImagePath);
    const mobileExtension = getOverlayFileExtension(mobileImagePath);
    
    const overlayPopup = document.createElement('div');
    overlayPopup.className = 'overlay-preview-popup';
    overlayPopup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1001;
        padding: 20px;
        box-sizing: border-box;
    `;

    overlayPopup.innerHTML = `
        <div class="overlay-preview-container" style="
            background: white;
            border-radius: 12px;
            padding: 25px;
            max-width: 900px;
            max-height: 90vh;
            width: 90vw;
            height: auto;
            text-align: center;
            position: relative;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            overflow-y: auto;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-shrink: 0;">
                <h3 style="margin: 0; color: #1e293b; font-size: 20px;">${shownTitle}</h3>
                <button onclick="closeOverlayPreview()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                    padding: 5px 10px;
                ">×</button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; flex: 1;">
                <!-- Desktop Preview -->
                <div style="
                    background: #f8fafc;
                    border-radius: 8px;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                ">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <span style="font-size: 24px;">🖥️</span>
                        <h4 style="margin: 0; color: #475569; font-size: 16px;">Desktop Version</h4>
                    </div>
                    
                    <div style="
                        flex: 1;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        background: white;
                        border-radius: 6px;
                        border: 1px solid #e2e8f0;
                        padding: 15px;
                        min-height: 300px;
                    ">
                        <img src="${desktopImagePath}" 
                             alt="${shownTitle} - Desktop" 
                             style="
                                max-width: 100%;
                                max-height: 300px;
                                width: auto;
                                height: auto;
                                object-fit: contain;
                                border-radius: 4px;
                             "
                             onerror="handleOverlayImageError(this, this.alt)">
                    </div>
                    
                    <div style="font-size: 12px; color: #64748b; margin-top: 10px; word-break: break-all;">
                        ${desktopImagePath}
                    </div>
                    
                    <button onclick="downloadOverlay('${desktopImagePath}', '${safeTitle}_desktop${desktopExtension}')" 
                            style="
                                margin-top: 15px;
                                padding: 8px 16px;
                                background: #0A1E81;
                                color: white;
                                border: none;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                                width: 100%;
                            ">
                        ⬇️ Download Desktop
                    </button>
                </div>
                
                <!-- Mobile Preview -->
                <div style="
                    background: #f8fafc;
                    border-radius: 8px;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                ">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <span style="font-size: 24px;">📱</span>
                        <h4 style="margin: 0; color: #475569; font-size: 16px;">Mobile Version</h4>
                    </div>
                    
                    <div style="
                        flex: 1;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        background: white;
                        border-radius: 6px;
                        border: 1px solid #e2e8f0;
                        padding: 15px;
                        min-height: 300px;
                    ">
                        <img src="${mobileImagePath}" 
                             alt="${shownTitle} - Mobile" 
                             style="
                                max-width: 100%;
                                max-height: 300px;
                                width: auto;
                                height: auto;
                                object-fit: contain;
                                border-radius: 4px;
                             "
                             onerror="handleOverlayImageError(this, this.alt)">
                    </div>
                    
                    <div style="font-size: 12px; color: #64748b; margin-top: 10px; word-break: break-all;">
                        ${mobileImagePath}
                    </div>
                    
                    <button onclick="downloadOverlay('${mobileImagePath}', '${safeTitle}_mobile${mobileExtension}')" 
                            style="
                                margin-top: 15px;
                                padding: 8px 16px;
                                background: #3b82f6;
                                color: white;
                                border: none;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                                width: 100%;
                            ">
                        ⬇️ Download Mobile
                    </button>
                </div>
            </div>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 20px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; font-size: 14px;">
                    <div>
                        <strong style="color: #475569; font-size: 13px;">Theme ID:</strong><br>
                        <span class="text-theme">${themeId}</span>
                    </div>
                    <div>
                        <strong style="color: #475569; font-size: 13px;">Display Name:</strong><br>
                        <span class="text-theme">${shownTitle}</span>
                    </div>
                    <div>
                        <strong style="color: #475569; font-size: 13px;">Previewed by:</strong><br>
                        <span class="text-theme">${sessionStorage.getItem('loggedUser')}</span>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 25px; text-align: center; flex-shrink: 0;">
                <button onclick="closeOverlayPreview()" style="
                    padding: 10px 30px;
                    background: #64748b;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 600;
                ">
                    Close Preview
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlayPopup);
}

// Close overlay preview
function closeOverlayPreview() {
    const popup = document.querySelector('.overlay-preview-popup');
    if (popup) {
        popup.remove();
    }
}

// Handle overlay image error
function handleOverlayImageError(imgElement, title) {
    console.error('Failed to load overlay image:', imgElement.src);
    
    const container = imgElement.parentElement;
    container.innerHTML = `
        <div style="
            width: 300px;
            height: 200px;
            background: #f8fafc;
            border: 2px dashed #e2e8f0;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: #64748b;
        ">
            <div style="font-size: 48px; margin-bottom: 16px;">🖼️</div>
            <div style="font-size: 14px; text-align: center;">
                <div>Overlay image not found</div>
                <div style="font-size: 12px; margin-top: 8px;">${overlayEscape(title)}</div>
                <div style="font-size: 11px; margin-top: 4px; color: #94a3b8;">
                    The image file may have been moved or deleted
                </div>
            </div>
        </div>
    `;
}

function getOverlayFileExtension(imagePath) {
    const cleanPath = String(imagePath || '').split('?')[0];
    const match = cleanPath.match(/\.[a-z0-9]+$/i);
    return match ? match[0].toLowerCase() : '.png';
}

// Convert overlay path extension into a readable file type label - changes made by nick
function getOverlayFileTypeLabel(imagePath) {
    const extension = getOverlayFileExtension(imagePath).replace('.', '');
    return extension ? extension.toUpperCase() : 'UNKNOWN';
}

// Download overlay
function downloadOverlay(imageUrl, filename) {
    fetch(imageUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Overlay image not found');
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(error => {
            console.error('Download error:', error);
            alert('Error downloading overlay: ' + error.message);
        });
}

// Show add overlay modal (System Admin only)
function showAddOverlayModal() {
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'add-overlay-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div class="add-overlay-form" style="
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 90%;
            max-width: 600px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <h3 style="margin: 0; color: #1e293b; font-size: 20px;">Add New Overlay</h3>
                <button onclick="closeAddOverlayModal()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                    padding: 5px 10px;
                ">×</button>
            </div>
            
            <form id="add-overlay-form" onsubmit="handleAddOverlay(event)">
                <div class="form-group" class="mb-20">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                        Display Name *
                    </label>
                    <input type="text" id="overlay-display-name" 
                        placeholder="Enter overlay display name"
                        style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;"
                        required>
                    <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                        Name shown in the overlay selection menu
                    </div>
                </div>
                
                <div class="form-group" class="mb-20">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                        Theme ID *
                    </label>
                    <input type="text" id="overlay-theme-id" 
                        placeholder="Enter theme ID (e.g., 'christmas', 'spring')"
                        style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;"
                        required>
                    <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                        Unique identifier for the overlay theme
                    </div>
                </div>
                
                <div class="form-group" class="mb-20">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                        Display Order *
                    </label>
                    <input type="number" id="overlay-display-order" 
                        placeholder="Enter display order (e.g., 1, 2, 3)"
                        style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;"
                        min="1"
                        value="1"
                        required>
                    <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                        Determines position in the overlay selection menu
                    </div>
                </div>
                
                <!-- PNG/GIF overlay upload inputs with previews - changes made by nick -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <!-- Desktop Image -->
                    <div class="form-group">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            Desktop Image *
                        </label>
                        <input type="file" id="desktop-overlay-image" 
                            accept=".png,.gif,image/png,image/gif"
                            style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;"
                            required>
                        <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                            Recommended: 1920x1080px PNG or animated GIF
                        </div>
                        <div id="desktop-overlay-preview" class="overlay-upload-preview" style="display: none;"></div>
                    </div>
                    
                    <!-- Mobile Image -->
                    <div class="form-group">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            Mobile Image *
                        </label>
                        <input type="file" id="mobile-overlay-image" 
                            accept=".png,.gif,image/png,image/gif"
                            style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;"
                            required>
                        <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                            Recommended: 1080x1920px PNG or animated GIF
                        </div>
                        <div id="mobile-overlay-preview" class="overlay-upload-preview" style="display: none;"></div>
                    </div>
                </div>
                
                <div id="add-overlay-error" style="
                    color: #dc2626;
                    font-size: 13px;
                    margin-bottom: 15px;
                    display: none;
                "></div>
                
                <div id="add-overlay-success" style="
                    color: #10b981;
                    font-size: 13px;
                    margin-bottom: 15px;
                    display: none;
                "></div>
                
                <div style="display: flex; gap: 12px;">
                    <button type="button" onclick="closeAddOverlayModal()" style="
                        flex: 1;
                        padding: 12px;
                        background: #64748b;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                    ">Cancel</button>
                    <button type="submit" style="
                        flex: 1;
                        padding: 12px;
                        background: linear-gradient(135deg, #10b981, #059669);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                    ">Add Overlay</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    initializeOverlayUploadPreviews();
}

// Attach preview handlers for desktop and mobile overlay uploads - changes made by nick
function initializeOverlayUploadPreviews() {
    const desktopInput = document.getElementById('desktop-overlay-image');
    const mobileInput = document.getElementById('mobile-overlay-image');

    if (desktopInput) {
        desktopInput.addEventListener('change', () => {
            showOverlayUploadPreview('desktop-overlay-image', 'desktop-overlay-preview');
        });
    }

    if (mobileInput) {
        mobileInput.addEventListener('change', () => {
            showOverlayUploadPreview('mobile-overlay-image', 'mobile-overlay-preview');
        });
    }
}

// Show a selected PNG/GIF overlay preview below the file input - changes made by nick
function showOverlayUploadPreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;

    const file = input.files && input.files[0];
    if (!file) {
        clearOverlayUploadPreview(inputId, previewId);
        return;
    }

    if (!['image/png', 'image/gif'].includes(file.type)) {
        preview.innerHTML = `
            <div class="overlay-upload-preview-error">
                Please choose a PNG or animated GIF file.
            </div>
        `;
        preview.style.display = 'block';
        return;
    }

    const previewUrl = URL.createObjectURL(file);
    preview.dataset.previewUrl = previewUrl;
    // <Jun Kai/> the file name is escaped in the alt text too, so a file name cannot add HTML to the page
    preview.innerHTML = `
        <div class="overlay-upload-preview-frame">
            <button type="button" class="overlay-upload-remove" aria-label="Remove selected overlay"
                onclick="clearOverlayUploadPreview('${inputId}', '${previewId}')">×</button>
            <img src="${previewUrl}" alt="${escapeHtmlSafe(file.name)} preview">
        </div>
        <div class="overlay-upload-preview-name">${escapeHtmlSafe(file.name)}</div>
    `;
    preview.style.display = 'block';
}

// Clear selected overlay file and remove its preview - changes made by nick
function clearOverlayUploadPreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);

    if (input) {
        input.value = '';
    }

    if (preview) {
        if (preview.dataset.previewUrl) {
            URL.revokeObjectURL(preview.dataset.previewUrl);
            delete preview.dataset.previewUrl;
        }
        preview.innerHTML = '';
        preview.style.display = 'none';
    }
}

// Close add overlay modal
function closeAddOverlayModal() {
    const modal = document.querySelector('.add-overlay-modal');
    if (modal) {
        modal.remove();
    }
}

// Handle overlay creation with file upload
async function handleAddOverlay(event) {
    event.preventDefault();
    
    const displayName = document.getElementById('overlay-display-name').value.trim();
    const themeId = document.getElementById('overlay-theme-id').value.trim();
    const displayOrder = document.getElementById('overlay-display-order').value;
    const desktopFileInput = document.getElementById('desktop-overlay-image');
    const mobileFileInput = document.getElementById('mobile-overlay-image');
    const errorDiv = document.getElementById('add-overlay-error');
    const successDiv = document.getElementById('add-overlay-success');
    
    // Hide previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    // Validate inputs
    if (!displayName || !themeId || !displayOrder) {
        errorDiv.textContent = 'All fields are required';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!desktopFileInput.files[0] || !mobileFileInput.files[0]) {
        errorDiv.textContent = 'Both desktop and mobile images are required';
        errorDiv.style.display = 'block';
        return;
    }

    // Validate admin overlay upload format before sending to backend - changes made by nick
    const allowedOverlayTypes = ['image/png', 'image/gif'];
    const uploadedOverlayFiles = [desktopFileInput.files[0], mobileFileInput.files[0]];
    if (!uploadedOverlayFiles.every(file => allowedOverlayTypes.includes(file.type))) {
        errorDiv.textContent = 'Overlay files must be PNG or animated GIF format.';
        errorDiv.style.display = 'block';
        return;
    }
    
    const username = sessionStorage.getItem('loggedUser');
    const userRole = sessionStorage.getItem('userRole');
    
    if (userRole !== 'system_admin') {
        errorDiv.textContent = 'Access denied. System Administrator privileges required.';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('display_name', displayName);
        formData.append('theme_id', themeId);
        formData.append('display_order', displayOrder);
        formData.append('desktop_file', desktopFileInput.files[0]);
        formData.append('mobile_file', mobileFileInput.files[0]);
        formData.append('username', username);
        
        const response = await fetch('/api/admin/overlays', {
            method: 'POST',
            headers: {
                'x-username': username
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            successDiv.textContent = '✅ Overlay added successfully!';
            successDiv.style.display = 'block';
            
            // Clear form after successful upload
            document.getElementById('overlay-display-name').value = '';
            document.getElementById('overlay-theme-id').value = '';
            document.getElementById('overlay-display-order').value = '1';
            desktopFileInput.value = '';
            mobileFileInput.value = '';
            
            // Refresh overlay data after a delay
            setTimeout(() => {
                closeAddOverlayModal();
                loadOverlayData();
            }, 1500);
        } else {
            errorDiv.textContent = data.error || 'Failed to add overlay';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Error adding overlay:', error);
        errorDiv.textContent = 'Error adding overlay: ' + error.message;
        errorDiv.style.display = 'block';
    }
}

// Delete overlay (System Admin only)
async function deleteOverlay(overlayId) {
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        return;
    }
    
    if (confirm(`Are you sure you want to delete this overlay? This action cannot be undone.`)) {
        await performOverlayDeletion(overlayId);
    }
}

// Execute overlay deletion
async function performOverlayDeletion(overlayId) {
    const username = sessionStorage.getItem('loggedUser');
    
    try {
        const response = await fetch(`/api/admin/overlays/${overlayId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-username': username
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Overlay deleted successfully!');
            loadOverlayData();
        } else {
            alert('❌ Failed to delete overlay: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting overlay:', error);
        alert('❌ Error deleting overlay: ' + error.message);
    }
}

