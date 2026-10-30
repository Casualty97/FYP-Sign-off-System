// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 11 of 30: photo management. Owner: Role 3.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ==================== 10. PHOTO MANAGEMENT ====================

// View raw photo
async function viewRawPhoto(feedbackId) {
    showRawPhotoPopup(feedbackId);
}

// View processed photo 
async function viewProcessedPhoto(feedbackId) {
    showProcessedPhotoPopup(feedbackId);
}

// Show raw photo in popup
function showRawPhotoPopup(feedbackId) {
    // First, get the photo path from the feedback data
    fetch('/api/admin/feedback')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const feedback = data.feedback.find(f => f.id === feedbackId);
                if (!feedback) {
                    alert('Feedback not found');
                    return;
                }

                const photoPath = feedback.photo_path;
                if (!photoPath) {
                    alert('No raw photo available for this feedback');
                    return;
                }

                createPhotoPopup(feedbackId, photoPath, 'Raw');
            }
        })
        .catch(error => {
            console.error('Error fetching feedback data:', error);
            alert('Error loading photo information');
        });
}

// Show processed photo in popup
function showProcessedPhotoPopup(feedbackId) {
    // First, get the photo path from the feedback data
    fetch('/api/admin/feedback')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const feedback = data.feedback.find(f => f.id === feedbackId);
                if (!feedback) {
                    alert('Feedback not found');
                    return;
                }

                const photoPath = feedback.processed_photo_path;
                if (!photoPath) {
                    alert('No processed photo available for this feedback');
                    return;
                }

                createPhotoPopup(feedbackId, photoPath, 'Processed');
            }
        })
        .catch(error => {
            console.error('Error fetching feedback data:', error);
            alert('Error loading photo information');
        });
}

// Generic function to create photo popup Same size for both raw and processed
function createPhotoPopup(feedbackId, photoPath, photoType) {
    // Create photo popup
    const photoPopup = document.createElement('div');
    photoPopup.className = 'photo-popup';
    photoPopup.style.cssText = `
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

    // Construct the full URL to the photo
    const photoUrl = `/uploads/${photoPath}`;
    
    // Use the SAME sizing for both raw and processed photos
    const containerStyle = `
        max-width: 90vw;
        max-height: 90vh;
        width: auto;
        height: auto;
        padding: 20px;
    `;

    const imageStyle = `
        max-width: 100%;
        max-height: 70vh;
        width: auto;
        height: auto;
        object-fit: contain;
    `;

    photoPopup.innerHTML = `
        <div class="photo-container" style="
            background: white;
            border-radius: 12px;
            text-align: center;
            position: relative;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            ${containerStyle}
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-shrink: 0;">
                <h3 style="margin: 0; color: #1e293b; font-size: 16px;">${photoType} Photo - ID: ${feedbackId}</h3>
                <button onclick="closePhotoPopup()" style="
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #64748b;
                    padding: 2px 8px;
                ">×</button>
            </div>
            
            <div style="
                display: flex;
                justify-content: center;
                align-items: center;
                margin-bottom: 15px;
                flex: 1;
                overflow: hidden;
            ">
                <img src="${photoUrl}" 
                     alt="${photoType.toLowerCase()} photo for feedback ${feedbackId}" 
                     style="
                        ${imageStyle}
                        border-radius: 6px;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                     "
                     onerror="handlePhotoError(this, ${feedbackId}, '${photoType.toLowerCase()}')">
            </div>
            
            <div style="font-size: 11px; color: #64748b; margin-bottom: 10px; flex-shrink: 0;">
                ${photoType} photo • Accessed by ${sessionStorage.getItem('loggedUser')} at ${new Date().toLocaleTimeString()}
            </div>
            
            <div style="flex-shrink: 0;">
                <button onclick="downloadPhoto('${photoUrl}', 'feedback_${feedbackId}_${photoType.toLowerCase()}_photo.jpg')" 
                        class="modal-btn-primary font-size-11 p-6-12">
                    ⬇️ Download ${photoType}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(photoPopup);
}

// Handle photo loading errors
function handlePhotoError(imgElement, feedbackId, photoType = 'raw') {
    console.error(`Failed to load ${photoType} photo for feedback ID:`, feedbackId);
    
    // Create a fallback display
    const container = imgElement.parentElement;
    container.innerHTML = `
        <div style="
            width: 400px;
            height: 400px;
            background: #f8fafc;
            border: 2px dashed #e2e8f0;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: #64748b;
        ">
            <div style="font-size: 64px; margin-bottom: 16px;">📷</div>
            <div style="font-size: 14px; text-align: center;">
                <div>${photoType.charAt(0).toUpperCase() + photoType.slice(1)} photo not found or failed to load</div>
                <div style="font-size: 12px; margin-top: 8px;">Feedback ID: ${feedbackId}</div>
                <div style="font-size: 11px; margin-top: 4px; color: #94a3b8;">
                    The ${photoType} photo file may have been deleted or moved
                </div>
            </div>
        </div>
    `;
}

// Download photo function
function downloadPhoto(photoUrl, filename) {
    fetch(photoUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Photo not found');
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
            alert('Error downloading photo: ' + error.message);
        });
}

// Close photo popup
function closePhotoPopup() {
    const popup = document.querySelector('.photo-popup');
    if (popup) {
        popup.remove();
    }
}

