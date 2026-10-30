// Feedback (kiosk) page script, split from the former feedback.js by section (move only, nothing changed inside).
// File 12 of 17: photo frames (overlays) and themes. Owner: Role 1.
// Load order (classic scripts, one shared global scope): core, bear, lostFound, flowPages, faceDetect, faceFilters, init, inactivity, questions, submit, photo, overlays, navigation, backNavigation, events, config, language.
// ==================== 7. OVERLAY & THEME FUNCTIONS ====================

// Load overlay options from database
async function loadOverlayOptions() {
    const overlayOptions = document.getElementById('overlay-options');
    if (!overlayOptions) return;

    try {
        if (kioskParametersLoadPromise) {
            await kioskParametersLoadPromise;
        }

        // Fetch overlays from the API
        const response = await fetch('/api/feedback/overlays');
        const data = await response.json();
        
        if (data.success && data.overlays.length > 0) {
            // Clear existing options
            overlayOptions.innerHTML = '';
            
            // Store overlay data including file paths for later use 
            overlayData = {};
            data.overlays.forEach(overlay => {
                overlayData[overlay.theme_id] = {
                    desktop_filename: overlay.desktop_filename,
                    mobile_filename: overlay.mobile_filename,
                    display_name: overlay.display_name
                };
            });
            console.log('Loaded overlay data from database:', overlayData);
            
            // Create theme options from database data
            data.overlays.forEach(overlay => {
                const themeOption = document.createElement('div');
                themeOption.className = 'theme-option';
                themeOption.onclick = () => selectTheme(overlay.theme_id, themeOption);
                
                // Generate a consistent color based on theme_id
                const color = generateColorFromThemeId(overlay.theme_id);
                
                themeOption.innerHTML = `
                    <div class="theme-swatch" style="background: ${color};"></div>
                    <div class="theme-name">${overlay.display_name}</div>
                `;
                
                overlayOptions.appendChild(themeOption);
            });

            // Select configured default theme when available; otherwise use the first theme.
            setTimeout(() => {
                const defaultThemeId = kioskParameters.visualAssets?.defaultOverlayTheme;
                const defaultIndex = data.overlays.findIndex(overlay => overlay.theme_id === defaultThemeId);
                const selectedIndex = defaultIndex >= 0 ? defaultIndex : 0;
                const themeElement = document.querySelectorAll('.theme-option')[selectedIndex];

                if (themeElement && data.overlays[selectedIndex]) {
                    const selectedOverlay = data.overlays[selectedIndex];
                    selectTheme(selectedOverlay.theme_id, themeElement);
                    
                    // Update the selected overlay name display
                    document.getElementById('selected-overlay-name').textContent = selectedOverlay.display_name;
                }
            }, 100);
            
        } else {
            // Fallback to default themes if no overlays in database
            loadDefaultOverlayOptions();
        }
    } catch (error) {
        console.error('Error loading overlays:', error);
        // Fallback to default themes
        loadDefaultOverlayOptions();
    }
}

// Fallback function for default overlays
function loadDefaultOverlayOptions() {
    const overlayOptions = document.getElementById('overlay-options');
    if (!overlayOptions) return;
    
    const defaultThemes = [
        { theme_id: 'nature', display_name: 'Nature Theme' },
        { theme_id: 'modern', display_name: 'Modern Theme' },
        { theme_id: 'vintage', display_name: 'Vintage Theme' }
    ];
    
    defaultThemes.forEach(theme => {
        const themeOption = document.createElement('div');
        themeOption.className = 'theme-option';
        themeOption.onclick = () => selectTheme(theme.theme_id, themeOption);
        
        const color = generateColorFromThemeId(theme.theme_id);
        
        themeOption.innerHTML = `
            <div class="theme-swatch" style="background: ${color};"></div>
            <div class="theme-name">${theme.display_name}</div>
        `;
        
        overlayOptions.appendChild(themeOption);
    });

    // Select first default theme
    setTimeout(() => {
        const firstTheme = document.querySelector('.theme-option');
        if (firstTheme) {
            selectTheme(defaultThemes[0].theme_id, firstTheme);
            document.getElementById('selected-overlay-name').textContent = defaultThemes[0].display_name;
        }
    }, 100);
}

// Generate consistent colors from theme_id
function generateColorFromThemeId(themeId) {
    const colors = [
        '#10b981', '#22c55e', '#06b6d4', '#84cc16', '#3b82f6',
        '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#6366f1'
    ];
    
    // Simple hash to get consistent color for same theme_id
    let hash = 0;
    for (let i = 0; i < themeId.length; i++) {
        hash = themeId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}

// Select theme and update preview
function selectTheme(theme, element) {
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    element.classList.add('selected');
    selectedTheme = theme;
    
    // Update the selected overlay name display
    const selectedOption = element.querySelector('.theme-name');
    if (selectedOption) {
        document.getElementById('selected-overlay-name').textContent = selectedOption.textContent;
    }
    
    // Update preview with selected theme and device
    updateThemePreview();
    resetInactivityTimer();
}

// Update theme preview with correct file paths from database 
function updateThemePreview() {
    const overlayImage = document.getElementById('selected-overlay');
    
    // Get the correct path from overlayData (from database)
    let overlayPath;
    if (overlayData[selectedTheme]) {
        // Use the path from database - this works on both Windows and Linux
        overlayPath = currentDevice === 'mobile' 
            ? overlayData[selectedTheme].mobile_filename
            : overlayData[selectedTheme].desktop_filename;
        console.log('Using database path for theme:', selectedTheme, '| Path:', overlayPath);
    } else {
        // Fallback to constructed path for default themes
        overlayPath = `/assets/overlays/${currentDevice === 'mobile' ? 'MobileOverlay' : 'DesktopOverlay'}/${selectedTheme}Theme${currentDevice === 'mobile' ? 'Mobile' : 'Desktop'}.png`;
        console.log('Using constructed path (fallback) for theme:', selectedTheme, '| Path:', overlayPath);
    }
    
    console.log('Loading overlay from:', overlayPath);
    overlayImage.src = overlayPath;
    
    // Add error handler to help debug
    overlayImage.onerror = function() {
        console.error('❌ Failed to load overlay:', overlayPath);
        console.error('Current device:', currentDevice);
        console.error('Selected theme:', selectedTheme);
        console.error('Available overlay data:', overlayData);
    };
    
    // Also update the preview photo if it exists
    updatePreviewWithCutout();
}

// Render one photo or boomerang frame into the overlay cutout - changes made by nick
function renderPreviewPhotoFrame(frameDataUrl, previewPhoto) {
    return new Promise((resolve) => {
    const previewCanvas = document.createElement('canvas');
    const ctx = previewCanvas.getContext('2d');
    
    // Set canvas size to match preview frame
    const previewDimensions = {
        'desktop': { width: 800, height: 450 },
        'mobile': { width: 324, height: 405 }
    };
    
    const dimensions = previewDimensions[currentDevice];
    previewCanvas.width = dimensions.width;
    previewCanvas.height = dimensions.height;
    
    // Cutout dimensions and positions for preview (scaled down from original)
    const cutoutSpecs = {
        'desktop': {
            cutoutWidth: 640,  // 1536 * (800/1920)
            cutoutHeight: 360, // 864 * (450/1080)
            cutoutX: 80,       // 192 * (800/1920)
            cutoutY: 23        // 55 * (450/1080)
        },
        'mobile': {
            cutoutWidth: 259,  // 864 * (324/1080)
            cutoutHeight: 324, // 1080 * (405/1350)
            cutoutX: 32,       // 108 * (324/1080)
            cutoutY: 15        // 51 * (405/1350)
        }
    };
    
    const cutout = cutoutSpecs[currentDevice];
    
        const img = new Image();
        img.onload = function() {
        // Fill background with white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
        
        // Calculate scaling to fill the cutout (cover style)
        const scale = Math.max(
            cutout.cutoutWidth / img.width,
            cutout.cutoutHeight / img.height
        );
        
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        
        // Center the scaled image in the cutout
        const x = cutout.cutoutX + (cutout.cutoutWidth - scaledWidth) / 2;
        const y = cutout.cutoutY + (cutout.cutoutHeight - scaledHeight) / 2;
        
        // Draw the scaled photo in the cutout area
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        
        // Update the preview image
        previewPhoto.src = previewCanvas.toDataURL('image/png');
            resolve();
        
        console.log('Preview updated with cutout positioning');
    };

        img.src = frameDataUrl;
    });
}

// Loop boomerang frames on the style preview page - changes made by nick
async function startBoomerangPreview(previewPhoto) {
    stopBoomerangPreview();

    if (!boomerangFrames.length) {
        return;
    }

    boomerangPreviewPhotoElement = previewPhoto;
    boomerangPreviewPaused = false;
    updateBoomerangPreviewControls(true);
    let frameIndex = 0;
    await renderPreviewPhotoFrame(boomerangFrames[frameIndex], previewPhoto);

    boomerangPreviewInterval = setInterval(() => {
        frameIndex = (frameIndex + 1) % boomerangFrames.length;
        renderPreviewPhotoFrame(boomerangFrames[frameIndex], previewPhoto);
    }, getBoomerangFrameDelayMs());
}

// Update preview with cutout and overlay positioning
function updatePreviewWithCutout() {
    const previewPhoto = document.getElementById('preview-photo');
    const overlayImage = document.getElementById('selected-overlay');
    
    if (!previewPhoto || !overlayImage || !photoData) return;

    // Animate the preview when the visitor captured a boomerang - changes made by nick
    if (userData.captureMode === 'boomerang' && boomerangFrames.length) {
        startBoomerangPreview(previewPhoto);
        return;
    }

    stopBoomerangPreview();
    updateBoomerangPreviewControls(hasRestorableBoomerang());
    renderPreviewPhotoFrame(photoData, previewPhoto);
}

function getGifCutoutLayout() { // changes made by nick
    const isMobile = currentDevice === 'mobile';
    const canvasWidth = isMobile ? 360 : 480;
    const canvasHeight = isMobile ? 450 : 270;
    const scaleX = canvasWidth / (isMobile ? 1080 : 1920);
    const scaleY = canvasHeight / (isMobile ? 1350 : 1080);
    const sourceCutout = isMobile
        ? { cutoutWidth: 864, cutoutHeight: 1080, cutoutX: 108, cutoutY: 51 }
        : { cutoutWidth: 1536, cutoutHeight: 864, cutoutX: 192, cutoutY: 55 };

    return {
        canvasWidth,
        canvasHeight,
        cutout: {
            cutoutWidth: sourceCutout.cutoutWidth * scaleX,
            cutoutHeight: sourceCutout.cutoutHeight * scaleY,
            cutoutX: sourceCutout.cutoutX * scaleX,
            cutoutY: sourceCutout.cutoutY * scaleY
        }
    };
}

function getOverlayPathForCurrentTheme() { // changes made by nick
    if (overlayData[selectedTheme]) {
        return currentDevice === 'mobile'
            ? overlayData[selectedTheme].mobile_filename
            : overlayData[selectedTheme].desktop_filename;
    }

    return `/assets/overlays/${currentDevice === 'mobile' ? 'MobileOverlay' : 'DesktopOverlay'}/${selectedTheme}Theme${currentDevice === 'mobile' ? 'Mobile' : 'Desktop'}.png`;
}

function loadImageElement(src) { // changes made by nick
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
        image.src = src;
    });
}

function writeGifWord(bytes, value) { // changes made by nick
    bytes.push(value & 0xff, (value >> 8) & 0xff);
}

function writeGifString(bytes, value) { // changes made by nick
    for (let i = 0; i < value.length; i++) {
        bytes.push(value.charCodeAt(i));
    }
}

function getGifPalette() { // changes made by nick
    const palette = [];
    for (let red = 0; red < GIF_RED_LEVELS; red++) {
        for (let green = 0; green < GIF_GREEN_LEVELS; green++) {
            for (let blue = 0; blue < GIF_BLUE_LEVELS; blue++) {
                palette.push(
                    Math.round((red / (GIF_RED_LEVELS - 1)) * 255),
                    Math.round((green / (GIF_GREEN_LEVELS - 1)) * 255),
                    Math.round((blue / (GIF_BLUE_LEVELS - 1)) * 255)
                );
            }
        }
    }

    // GIF global colour tables must contain 256 entries; pad the unused slots. changes made by nick
    while (palette.length < 256 * 3) {
        palette.push(0, 0, 0);
    }
    return palette;
}

function imageDataToGifIndexes(imageData) { // changes made by nick
    const source = imageData.data;
    const indexes = new Uint8Array(imageData.width * imageData.height);
    for (let sourceIndex = 0, targetIndex = 0; sourceIndex < source.length; sourceIndex += 4, targetIndex++) {
        const red = Math.round((source[sourceIndex] / 255) * (GIF_RED_LEVELS - 1));
        const green = Math.round((source[sourceIndex + 1] / 255) * (GIF_GREEN_LEVELS - 1));
        const blue = Math.round((source[sourceIndex + 2] / 255) * (GIF_BLUE_LEVELS - 1));
        indexes[targetIndex] = (red * GIF_GREEN_LEVELS * GIF_BLUE_LEVELS) + (green * GIF_BLUE_LEVELS) + blue;
    }
    return indexes;
}

function lzwEncodeGifIndexes(indexes, minCodeSize = 8) { // changes made by nick
    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let bitBuffer = 0;
    let bitCount = 0;
    const output = [];

    function writeCode(code) {
        bitBuffer |= code << bitCount;
        bitCount += codeSize;
        while (bitCount >= 8) {
            output.push(bitBuffer & 0xff);
            bitBuffer >>= 8;
            bitCount -= 8;
        }
    }

    // Use frequent clear codes instead of a growing dictionary so boomerang GIFs
    // stay valid across strict email clients such as Gmail mobile. changes made by nick
    writeCode(clearCode);
    let codesSinceClear = 0;
    for (let i = 0; i < indexes.length; i++) {
        writeCode(indexes[i]);
        codesSinceClear += 1;
        if (codesSinceClear >= 120 && i < indexes.length - 1) {
            writeCode(clearCode);
            codesSinceClear = 0;
            codeSize = minCodeSize + 1;
        }
    }

    writeCode(endCode);
    if (bitCount > 0) {
        output.push(bitBuffer & 0xff);
    }

    return output;
}

function writeGifSubBlocks(bytes, data) { // changes made by nick
    for (let index = 0; index < data.length; index += 255) {
        const block = data.slice(index, index + 255);
        bytes.push(block.length, ...block);
    }
    bytes.push(0);
}

function buildAnimatedGifDataUrl(frameImageDataList, delayMs) { // changes made by nick
    const width = frameImageDataList[0].width;
    const height = frameImageDataList[0].height;
    const bytes = [];
    const palette = getGifPalette();
    const delay = Math.max(2, Math.round(delayMs / 10));

    writeGifString(bytes, 'GIF89a');
    writeGifWord(bytes, width);
    writeGifWord(bytes, height);
    bytes.push(0xf7, 0, 0);
    bytes.push(...palette);
    bytes.push(0x21, 0xff, 0x0b);
    writeGifString(bytes, 'NETSCAPE2.0');
    bytes.push(0x03, 0x01);
    writeGifWord(bytes, 0);
    bytes.push(0);

    frameImageDataList.forEach((frameImageData) => {
        bytes.push(0x21, 0xf9, 0x04, 0x04);
        writeGifWord(bytes, delay);
        bytes.push(0, 0);
        bytes.push(0x2c);
        writeGifWord(bytes, 0);
        writeGifWord(bytes, 0);
        writeGifWord(bytes, width);
        writeGifWord(bytes, height);
        bytes.push(0);
        bytes.push(8);
        writeGifSubBlocks(bytes, lzwEncodeGifIndexes(imageDataToGifIndexes(frameImageData), 8));
    });

    bytes.push(0x3b);

    let binary = '';
    const chunkSize = 8192;
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
    }

    return `data:image/gif;base64,${btoa(binary)}`;
}

async function createBoomerangProcessedFrames() { // Backend-ready boomerang frames - changes made by nick
    const layout = getGifCutoutLayout();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const overlayPath = getOverlayPathForCurrentTheme();
    const overlayImg = await loadImageElement(overlayPath);
    const frameStep = Math.max(1, Math.ceil(boomerangFrames.length / getBoomerangMaxFrames()));
    const selectedFrames = boomerangFrames.filter((_, index) => index % frameStep === 0);
    const frameImageDataList = [];

    canvas.width = layout.canvasWidth;
    canvas.height = layout.canvasHeight;

    for (const frameDataUrl of selectedFrames) {
        const frameImg = await loadImageElement(frameDataUrl);
        const scale = Math.max(
            layout.cutout.cutoutWidth / frameImg.width,
            layout.cutout.cutoutHeight / frameImg.height
        );
        const scaledWidth = frameImg.width * scale;
        const scaledHeight = frameImg.height * scale;
        const x = layout.cutout.cutoutX + (layout.cutout.cutoutWidth - scaledWidth) / 2;
        const y = layout.cutout.cutoutY + (layout.cutout.cutoutHeight - scaledHeight) / 2;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frameImg, x, y, scaledWidth, scaledHeight);
        ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
        frameImageDataList.push(canvas.toDataURL('image/png'));
    }

    return {
        frames: frameImageDataList,
        delayMs: getBoomerangFrameDelayMs() * frameStep
    };
}

// Process final photo with overlay for final submission
function processFinalPhoto() {
    return new Promise((resolve, reject) => {
        if (!photoData) {
            resolve();
            return;
        }

        if (userData.captureMode === 'boomerang' && boomerangFrames.length) {
            // Send composited frames to the backend so sharp creates the final GIF - changes made by nick
            createBoomerangProcessedFrames()
                .then((boomerangPayload) => {
                    if (!boomerangPayload.frames.length) {
                        throw new Error('Boomerang frames could not be prepared.');
                    }
                    userData.processedBoomerangFrames = boomerangPayload.frames;
                    userData.boomerangFrameDelayMs = boomerangPayload.delayMs;
                    userData.processedPhoto = boomerangPayload.frames[0]; // Still preview fallback while backend creates GIF - changes made by nick
                    console.log('Final boomerang frames prepared for backend GIF generation');
                    resolve();
                })
                .catch((error) => {
                    console.error('Boomerang frame processing failed:', error);
                    userData.processedBoomerangFrames = null;
                    userData.processedPhoto = null;
                    reject(error);
                });
            return;
        }

        processFinalPhotoFromStillFrame().then(resolve);
    });
}

function processFinalPhotoFromStillFrame() { // changes made by nick
    return new Promise((resolve) => {
        if (!photoData) {
            resolve();
            return;
        }
        
        // Create a canvas to combine photo and overlay
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size based on device (full size)
        const deviceDimensions = {
            'desktop': { width: 1920, height: 1080 },
            'mobile': { width: 1080, height: 1350 }
        };
        
        const dimensions = deviceDimensions[currentDevice];
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        
        // Cutout dimensions and positions based on device (full size)
        const cutoutSpecs = {
            'desktop': {
                cutoutWidth: 1536,
                cutoutHeight: 864,
                cutoutX: 192,
                cutoutY: 55
            },
            'mobile': {
                cutoutWidth: 864,
                cutoutHeight: 1080,
                cutoutX: 108,
                cutoutY: 51
            }
        };
        
        const cutout = cutoutSpecs[currentDevice];
        
        // Load the original photo
        const img = new Image();
        img.onload = function() {
            // Fill background with white
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Calculate scaling to fill the cutout (cover style)
            const scale = Math.max(
                cutout.cutoutWidth / img.width,
                cutout.cutoutHeight / img.height
            );
            
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            
            // Centre the scaled image in the cutout
            const x = cutout.cutoutX + (cutout.cutoutWidth - scaledWidth) / 2;
            const y = cutout.cutoutY + (cutout.cutoutHeight - scaledHeight) / 2;
            
            // Draw the scaled photo in the cutout area
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
            
            // Load and apply the overlay (border)
            const overlayImg = new Image();
            overlayImg.onload = function() {
                // Draw the overlay on top (this should be the border with transparent cutout)
                ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
                
                // Save the final processed photo data (but don't save to server yet)
                userData.processedPhoto = canvas.toDataURL('image/png');
                
                console.log('Final photo processed with overlay and proper cutout positioning');
                resolve();
            };
            
            const overlayPath = getOverlayPathForCurrentTheme(); // changes made by nick
            console.log('Processing final photo with overlay:', overlayPath);
            overlayImg.src = overlayPath;
            
            // If overlay fails to load, still proceed with the base photo
            overlayImg.onerror = function() {
                console.error('❌ Failed to load overlay for final processing:', overlayPath);
                console.error('Current device:', currentDevice);
                console.error('Selected theme:', selectedTheme);
                console.error('Available overlay data:', overlayData);
                userData.processedPhoto = canvas.toDataURL('image/png');
                resolve();
            };
        };
        
        img.src = photoData;
    });
}


