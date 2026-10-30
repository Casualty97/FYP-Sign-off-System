// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 21 of 30: theme settings and saved themes. Owner: Role 3.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: no markers in this file   <- counted from the "DONE BY" style markers below
// Current team owner: Role 3, Jun Kai. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
// ==================== 20. THEME SETTINGS - HELPER FUNCTIONS ====================

// Expands pattern selectors into actual selector arrays
// Patterns support:
// - '*-page' → matches all elements with IDs ending in '-page'
// - 'page-*' → matches all elements with IDs starting with 'page-'
// - '*-page .class' → matches pattern IDs with descendant selectors

function expandSelectorPatterns(config) {
    if (!config) return [];
    
    // If it's already an array, return it
    if (Array.isArray(config)) {
        return config;
    }
    
    // If it's an object with pattern/explicit structure
    const result = [];
    
    // Add explicit selectors first
    if (config.explicit && Array.isArray(config.explicit)) {
        result.push(...config.explicit);
    }
    
    // Expand auto patterns
    if (config.auto && Array.isArray(config.auto)) {
        config.auto.forEach(pattern => {
            const expanded = expandPattern(pattern);
            result.push(...expanded);
        });
    }
    
    return result;
}

// Expands a single pattern into matching selectors
function expandPattern(pattern) {
    const pageIds = [
        'dashboard-page',
        'feedback-data-page',
        'digital-tree-page',
        'pulse-page',
        'overlay-page',
        'questions-page',
        'users-page',
        'badge-email-templates-page',
        'archive-page',
        'audit-page',
        'lost-found-page',
        'data-export-page',
        'theme-settings-page'
    ];
    
    // Handle '*-page' pattern
    if (pattern === '*-page') {
        return pageIds.map(id => `#${id}`);
    }
    
    // Handle '*-page descendant' pattern (e.g., '*-page .page-header h2')
    const descendantMatch = pattern.match(/^\*-page\s+(.+)$/);
    if (descendantMatch) {
        const descendant = descendantMatch[1];
        return pageIds.map(id => `#${id} ${descendant}`);
    }
    
    // Handle '*-page-specific' pattern (e.g., '*-page-specific .section-header h3')
    const specificMatch = pattern.match(/^\*-page-specific\s+(.+)$/);
    if (specificMatch) {
        const descendant = specificMatch[1];
        // Exclude login-page and admin-dashboard from page-specific patterns
        const specificPages = pageIds.filter(id => id !== 'login-page');
        return specificPages.map(id => `#${id} ${descendant}`);
    }
    
    // If no pattern matches, return the original
    return [pattern];
}

// Validates that selectors actually exist in the DOM
function validateSelectors(selectorMapping) {
    const results = {
        total: 0,
        found: 0,
        missing: [],
        suggestions: []
    };
    
    // Collect all selectors
    const allSelectors = new Set();
    
    Object.keys(selectorMapping).forEach(sectionId => {
        const section = selectorMapping[sectionId];
        Object.keys(section).forEach(category => {
            Object.keys(section[category]).forEach(optionId => {
                const config = section[category][optionId];
                const selectors = expandSelectorPatterns(config);
                selectors.forEach(sel => allSelectors.add(sel));
            });
        });
    });
    
    // Test each unique selector
    allSelectors.forEach(selector => {
        results.total++;
        
        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                results.found++;
            } else {
                results.missing.push(selector);
                
                // Try to suggest corrections for common typos
                const suggestion = suggestCorrection(selector, allSelectors);
                if (suggestion) {
                    results.suggestions.push({
                        selector: selector,
                        suggestion: suggestion
                    });
                }
            }
        } catch (e) {
            // Invalid selector syntax
            results.missing.push(selector);
            console.error(`Invalid selector syntax: ${selector}`, e);
        }
    });
    
    return results;
}

// Suggests corrections for typos in selectors
function suggestCorrection(selector, allSelectors) {
    // Simple Levenshtein distance for suggestions
    const candidates = Array.from(allSelectors).filter(s => s !== selector);
    
    let bestMatch = null;
    let bestDistance = Infinity;
    
    candidates.forEach(candidate => {
        const distance = levenshteinDistance(selector, candidate);
        if (distance < bestDistance && distance <= 3) {
            bestDistance = distance;
            bestMatch = candidate;
        }
    });
    
    return bestMatch;
}

// Simple Levenshtein distance algorithm
function levenshteinDistance(a, b) {
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[b.length][a.length];
}

// ==================== 21. THEME CONFIGURATION ====================

const themeConfig = {
    sections: [
        { id: 'saved-themes', name: 'Saved Themes', icon: '💾', isSavedThemes: true }, 
        { id: 'global', name: 'Admin Overall Theme', icon: '🌐', isGlobal: true },
        { id: 'admin-dashboard', name: 'Admin Panel (Header + Sidebar)', icon: '⚙️' },
        { id: 'dashboard-page', name: 'Dashboard', icon: '📊' },
        { id: 'feedback-data-page', name: 'Feedback Data', icon: '💬' },
        { id: 'digital-tree-page', name: 'Digital Tree', icon: '🌳' },
        { id: 'pledgeboard-page', name: 'Pledgeboard', icon: '🏆' },
        { id: 'pulse-page', name: 'Live Pulse', icon: 'LIVE' },
        { id: 'overlay-page', name: 'Overlay Management', icon: '🎨', requiredRole: 'system_admin' },
        { id: 'questions-page', name: 'Question Management', icon: '❓', requiredRole: 'system_admin' },
        { id: 'users-page', name: 'User Management', icon: '👥', requiredRole: 'system_admin' },
        { id: 'vip-page', name: 'VIP Management', icon: '👑', requiredRole: 'system_admin' },
        { id: 'email-management-page', name: 'Email Management', icon: '📧', requiredRole: 'system_admin' },
        { id: 'badge-email-templates-page', name: 'Badge Email Templates', icon: 'Mail', requiredRole: 'system_admin' },
        { id: 'form-management-page', name: 'Form Management', icon: '📝', requiredRole: 'system_admin' },
        { id: 'archive-page', name: 'Archive', icon: '📚', requiredRole: 'system_admin' },
        { id: 'audit-page', name: 'Audit Logs', icon: '📋', requiredRole: 'system_admin' },
        { id: 'data-export-page', name: 'Data Export', icon: '📦', requiredRole: 'system_admin' },
        { id: 'timer-countdown-page', name: 'Timer Countdown', icon: '🕔', requiredRole: 'system_admin' },
        { id: 'server-schedule-page', name: 'Server Schedule', icon: '❗', requiredRole: 'system_admin' },
        { id: 'theme-settings-page', name: 'Style & Theme Settings', icon: '🎨' }
    ],
    
    // Selector mapping grouped
    selectorMapping: {
        // GLOBAL THEME - Affects ALL pages and elements
        'global': {
            general: {
                'page-background': {
                    auto: ['*-page'],
                    explicit: [
                        '#theme-settings-page .theme-preview',
                        'body',
                        '.page-content'
                    ]
                },
                'primary-text': {
                    auto: ['*-page .page-header h2'],
                    explicit: [
                        '.section-header h3',
                        '.page-header h2',
                        'h1', 'h2', 'h3',
                        '#admin-dashboard .header-left h1',
                        '#admin-dashboard .username'
                    ]
                },
                'secondary-text': {
                    auto: ['*-page .page-header p'],
                    explicit: [
                        '.page-header p',
                        'p',
                        '.description',
                        '.subtitle',
                        '#admin-dashboard .header-left p',
                        '#admin-dashboard .user-role'
                    ]
                }
            },
            header: {
                'admin-header-bg': ['#admin-dashboard .admin-header'],
                'primary-header-text': ['#admin-dashboard .header-left h1', '#admin-dashboard .username'],
                'secondary-header-text': ['#admin-dashboard .header-left p', '#admin-dashboard .user-role']
            },
            navbar: {
                'navbar-background': ['#admin-dashboard .sidebar'],
                'navbar-primary-text': ['#admin-dashboard .sidebar-section h3'],
                'navbar-secondary-text': ['#admin-dashboard .nav-item'],
                'navbar-active-selection': ['#admin-dashboard .nav-item.active'],
                'navbar-hover': ['#admin-dashboard .nav-item:hover']
            },
            card: {
                'card-background': {
                    explicit: [
                        '#dashboard-page .stat-card',
                        '#dashboard-page .activity-section',
                        '#feedback-data-page .feedback-section',
                        '#digital-tree-page .tree-section',
                        '#overlay-page .overlay-section',
                        '#questions-page .user-section',
                        '#users-page .user-section',
                        '#archive-page .feedback-section',
                        '#audit-page .audit-section',
                        '#data-export-page .password-panel-card',
                        '#data-export-page .export-card',
                        '#theme-settings-page .theme-section-list',
                        '#theme-settings-page .theme-settings-form',
                        '#theme-settings-page .preview-card',
                        '.card',
                        '.stat-card',
                        '.info-card',
                        '.data-card'
                    ]
                },
                'card-header-background': {
                    explicit: ['#theme-settings-page .theme-sidebar-header', '#theme-settings-page .theme-panel-header']
                },
                'card-border-color': {
                    explicit: [
                        '#dashboard-page .stat-card',
                        '#dashboard-page .activity-section',
                        '.card',
                        '.stat-card',
                        '.info-card'
                    ]
                },
                'card-primary-text': {
                    auto: ['*-page-specific .section-header h3'],
                    explicit: [
                        '#dashboard-page .stat-value',
                        '#dashboard-page .stat-label',
                        '#dashboard-page .last-updated',
                        '#data-export-page .password-panel-card h2',
                        '#data-export-page .form-group label',
                        '#data-export-page .export-card-title',
                        '#data-export-page .export-card-description',
                        '#data-export-page .export-card-meta',
                        '#theme-settings-page .theme-sidebar-header h3',
                        '#theme-settings-page .preview-card h5',
                        '.card h3',
                        '.card h4',
                        '.card h5',
                        '.section-header h3'
                    ]
                },
                'card-secondary-text': {
                    explicit: [
                        '#data-export-page .panel-subtitle',
                        '#theme-settings-page .preview-card p',
                        '#theme-settings-page .theme-section-item',
                        '.card p',
                        '.card-description',
                        '.card-meta'
                    ]
                },
                'card-item-hover-bg': {
                    explicit: ['#theme-settings-page .theme-section-item:hover']
                },
                'card-item-hover-text': {
                    explicit: ['#theme-settings-page .theme-section-item:hover']
                },
                'card-item-active-bg': {
                    explicit: ['#theme-settings-page .theme-section-item.active']
                },
                'card-item-active-text': {
                    explicit: ['#theme-settings-page .theme-section-item.active']
                }
            },
            buttons: {
                'button-color': {
                    auto: ['*-page .btn-primary', '*-page .btn-secondary'],
                    explicit: [
                        '#admin-dashboard .logout-btn',
                        '#dashboard-page .refresh-btn',
                        '#feedback-data-page #decrypt-emails-btn',
                        '#feedback-data-page #re-encrypt-btn',
                        '#feedback-data-page .btn-warning',
                        '#feedback-data-page .btn-view',
                        '#overlay-page .btn-view-overlay',
                        '#questions-page .btn-edit',
                        '#users-page .btn-edit',
                        '#archive-page .btn-warning',
                        '#archive-page #decrypt-archive-emails-btn',
                        '#archive-page #re-encrypt-archive-btn',
                        '#archive-page .btn-view',
                        '#data-export-page .export-btn',
                        '#theme-settings-page .preview-btn-primary',
                        '.btn-primary',
                        'button.btn-primary',
                        '.btn-secondary',
                        'button.btn-secondary',
                        '.btn-warning',
                        '.btn-view',
                        '.btn-edit',
                        '.btn-view-overlay',
                        '.login-btn',
                        '.logout-btn',
                        '.refresh-btn',
                        '.export-btn'
                    ]
                },
                'button-text-color': {
                    auto: ['*-page .btn-primary', '*-page .btn-secondary'],
                    explicit: [
                        '#admin-dashboard .logout-btn',
                        '#dashboard-page .refresh-btn',
                        '#feedback-data-page #decrypt-emails-btn',
                        '#feedback-data-page #re-encrypt-btn',
                        '#feedback-data-page .btn-warning',
                        '#feedback-data-page .btn-view',
                        '#overlay-page .btn-view-overlay',
                        '#questions-page .btn-edit',
                        '#users-page .btn-edit',
                        '#archive-page .btn-warning',
                        '#archive-page #decrypt-archive-emails-btn',
                        '#archive-page #re-encrypt-archive-btn',
                        '#archive-page .btn-view',
                        '#data-export-page .export-btn',
                        '#theme-settings-page .preview-btn-primary',
                        '.btn-primary',
                        'button.btn-primary',
                        '.btn-secondary',
                        'button.btn-secondary',
                        '.btn-warning',
                        '.btn-view',
                        '.btn-edit',
                        '.btn-view-overlay',
                        '.login-btn',
                        '.logout-btn',
                        '.refresh-btn',
                        '.export-btn'
                    ]
                }
            },
            badges: {
                'badge-7days-background': {
                    explicit: [
                        '#feedback-data-page .badge-warning',
                        '#archive-page .badge-warning',
                        '.badge-warning'
                    ]
                },
                'badge-7days-text': {
                    explicit: [
                        '#feedback-data-page .badge-warning',
                        '#archive-page .badge-warning',
                        '.badge-warning'
                    ]
                },
                'badge-longterm-background': {
                    explicit: [
                        '#feedback-data-page .badge-permanent',
                        '#archive-page .badge-permanent',
                        '.badge-permanent'
                    ]
                },
                'badge-longterm-text': {
                    explicit: [
                        '#feedback-data-page .badge-permanent',
                        '#archive-page .badge-permanent',
                        '.badge-permanent'
                    ]
                }
            },
        },
        'admin-dashboard': {
            header: {
                'admin-header-bg': ['#admin-dashboard .admin-header'],
                'primary-header-text': ['#admin-dashboard .header-left h1', '#admin-dashboard .username'],
                'secondary-header-text': ['#admin-dashboard .header-left p', '#admin-dashboard .user-role']
            },
            navbar: {
                'navbar-background': ['#admin-dashboard .sidebar'],
                'navbar-primary-text': ['#admin-dashboard .sidebar-section h3'],
                'navbar-secondary-text': ['#admin-dashboard .nav-item'],
                'navbar-active-selection': ['#admin-dashboard .nav-item.active'],
                'navbar-hover': ['#admin-dashboard .nav-item:hover']
            },
            buttons: {
                'button-color': ['#admin-dashboard .logout-btn'],
                'button-text-color': ['#admin-dashboard .logout-btn']
            }
        },
        
        'dashboard-page': {
            general: {
                'page-background': ['#dashboard-page'],
                'primary-text': ['#dashboard-page .page-header h2'],
                'secondary-text': ['#dashboard-page .page-header p']
            },
            card: {
                'card-background': [
                    '#dashboard-page .metric-card',
                    '#dashboard-page .chart-card',
                    '#dashboard-page .status-card',
                    '#dashboard-page .quick-actions-card'
                ],
                'card-primary-text': [
                    '#dashboard-page .metric-value',
                    '#dashboard-page .metric-label',
                    '#dashboard-page .chart-header h3',
                    '#dashboard-page .status-header h3',
                    '#dashboard-page .quick-actions-header h3'
                ],
                'card-secondary-text': [
                    '#dashboard-page .metric-subtitle',
                    '#dashboard-page .chart-subtitle',
                    '#dashboard-page .quick-actions-header p'
                ]
            },
            buttons: {
                'button-color': [
                    '#dashboard-page .btn-primary',
                    '#dashboard-page .refresh-btn',
                    '#dashboard-page .quick-action-btn'
                ],
                'button-text-color': [
                    '#dashboard-page .btn-primary',
                    '#dashboard-page .refresh-btn',
                    '#dashboard-page .quick-action-btn'
                ]
            }
        },
        
        'feedback-data-page': {
            general: {
                'page-background': ['#feedback-data-page'],
                'primary-text': ['#feedback-data-page .page-header h2'],
                'secondary-text': ['#feedback-data-page .page-header p']
            },
            card: {
                'card-background': ['#feedback-data-page .feedback-section'],
                'card-primary-text': ['#feedback-data-page .section-header h3']
            },
            buttons: {
                'button-color': [
                    '#feedback-data-page .btn-primary',
                    '#feedback-data-page .btn-secondary',
                    '#feedback-data-page #decrypt-emails-btn',
                    '#feedback-data-page #re-encrypt-btn',
                    '#feedback-data-page .btn-warning',
                    '#feedback-data-page .btn-view'
                ],
                'button-text-color': [
                    '#feedback-data-page .btn-primary',
                    '#feedback-data-page .btn-secondary',
                    '#feedback-data-page #decrypt-emails-btn',
                    '#feedback-data-page #re-encrypt-btn',
                    '#feedback-data-page .btn-warning',
                    '#feedback-data-page .btn-view'
                ]
            },
            badges: {
                'badge-7days-background': ['#feedback-data-page .badge-warning'],
                'badge-7days-text': ['#feedback-data-page .badge-warning'],
                'badge-longterm-background': ['#feedback-data-page .badge-permanent'],
                'badge-longterm-text': ['#feedback-data-page .badge-permanent']
            }
        },
        
        'digital-tree-page': {
            general: {
                'page-background': ['#digital-tree-page'],
                'primary-text': ['#digital-tree-page .page-header h2'],
                'secondary-text': ['#digital-tree-page .page-header p']
            },
            card: {
                'card-background': ['#digital-tree-page .tree-section'],
                'card-primary-text': ['#digital-tree-page .section-header h3']
            },
            buttons: {
                'button-color': ['#digital-tree-page .btn-primary'],
                'button-text-color': ['#digital-tree-page .btn-primary']
            }
        },
        
        'overlay-page': {
            general: {
                'page-background': ['#overlay-page'],
                'primary-text': ['#overlay-page .page-header h2'],
                'secondary-text': ['#overlay-page .page-header p']
            },
            card: {
                'card-background': ['#overlay-page .overlay-section'],
                'card-primary-text': ['#overlay-page .section-header h3']
            },
            buttons: {
                'button-color': ['#overlay-page .btn-primary', '#overlay-page .btn-view-overlay'],
                'button-text-color': ['#overlay-page .btn-primary', '#overlay-page .btn-view-overlay']
            }
        },
        
        'questions-page': {
            general: {
                'page-background': ['#questions-page'],
                'primary-text': ['#questions-page .page-header h2'],
                'secondary-text': ['#questions-page .page-header p']
            },
            card: {
                'card-background': ['#questions-page .user-section'],
                'card-primary-text': ['#questions-page .section-header h3']
            },
            buttons: {
                'button-color': ['#questions-page .btn-primary', '#questions-page .btn-edit'],
                'button-text-color': ['#questions-page .btn-primary', '#questions-page .btn-edit']
            }
        },
        
        'users-page': {
            general: {
                'page-background': ['#users-page'],
                'primary-text': ['#users-page .page-header h2'],
                'secondary-text': ['#users-page .page-header p']
            },
            card: {
                'card-background': ['#users-page .user-section'],
                'card-primary-text': ['#users-page .section-header h3']
            },
            buttons: {
                'button-color': ['#users-page .btn-primary', '#users-page .btn-edit'],
                'button-text-color': ['#users-page .btn-primary', '#users-page .btn-edit']
            }
        },
        
        'vip-page': {
            general: {
                'page-background': ['#vip-page'],
                'primary-text': ['#vip-page .page-header h2'],
                'secondary-text': ['#vip-page .page-header p']
            },
            card: {
                'card-background': ['#vip-page .vip-card'],
                'card-primary-text': ['#vip-page .vip-card-header h3'],
                'card-secondary-text': ['#vip-page .vip-subtext']
            },
            buttons: {
                'button-color': ['#vip-page .vip-add-btn', '#vip-page .btn-primary'],
                'button-text-color': ['#vip-page .vip-add-btn', '#vip-page .btn-primary']
            }
        },
        
        'email-management-page': {
            general: {
                'page-background': ['#email-management-page'],
                'primary-text': ['#email-management-page .page-header h2'],
                'secondary-text': ['#email-management-page .page-header p']
            },
            card: {
                'card-background': ['#email-management-page .email-config-card'],
                'card-primary-text': ['#email-management-page .section-header h3'],
                'card-secondary-text': ['#email-management-page label']
            },
            buttons: {
                'button-color': ['#email-management-page .btn-primary', '#email-management-page .btn-secondary'],
                'button-text-color': ['#email-management-page .btn-primary', '#email-management-page .btn-secondary']
            }
        },
        
        'form-management-page': {
            general: {
                'page-background': ['#form-management-page'],
                'primary-text': ['#form-management-page .page-header h2'],
                'secondary-text': ['#form-management-page .page-header p']
            },
            card: {
                'card-background': ['#form-management-page .overlay-section', '#form-management-page .user-section'],
                'card-primary-text': ['#form-management-page .section-header h3'],
                'card-secondary-text': ['#form-management-page label']
            },
            buttons: {
                'button-color': ['#form-management-page .btn-primary', '#form-management-page .btn-secondary'],
                'button-text-color': ['#form-management-page .btn-primary', '#form-management-page .btn-secondary']
            }
        },
        
        'archive-page': {
            general: {
                'page-background': ['#archive-page'],
                'primary-text': ['#archive-page .page-header h2'],
                'secondary-text': ['#archive-page .page-header p']
            },
            card: {
                'card-background': ['#archive-page .feedback-section'],
                'card-primary-text': ['#archive-page .section-header h3']
            },
            buttons: {
                'button-color': [
                    '#archive-page .btn-secondary',
                    '#archive-page .btn-primary',
                    '#archive-page .btn-warning',
                    '#archive-page #decrypt-archive-emails-btn',
                    '#archive-page #re-encrypt-archive-btn',
                    '#archive-page .btn-view'
                ],
                'button-text-color': [
                    '#archive-page .btn-secondary',
                    '#archive-page .btn-primary',
                    '#archive-page .btn-warning',
                    '#archive-page #decrypt-archive-emails-btn',
                    '#archive-page #re-encrypt-archive-btn',
                    '#archive-page .btn-view'
                ]
            },
            badges: {
                'badge-7days-background': ['#archive-page .badge-warning'],
                'badge-7days-text': ['#archive-page .badge-warning'],
                'badge-longterm-background': ['#archive-page .badge-permanent'],
                'badge-longterm-text': ['#archive-page .badge-permanent']
            }
        },
        
        'audit-page': {
            general: {
                'page-background': ['#audit-page'],
                'primary-text': ['#audit-page .page-header h2'],
                'secondary-text': ['#audit-page .page-header p']
            },
            card: {
                'card-background': ['#audit-page .audit-section'],
                'card-primary-text': ['#audit-page .section-header h3']
            },
            buttons: {
                'button-color': ['#audit-page .btn-secondary', '#audit-page .btn-primary'],
                'button-text-color': ['#audit-page .btn-secondary', '#audit-page .btn-primary']
            }
        },
        
        'data-export-page': {
            login: {
                'data-export-login-background': ['#data-export-page'],
                'data-export-login-card-background': ['#data-export-page .password-panel-card'],
                'data-export-login-card-primary-text': ['#data-export-page .password-panel-card h2'],
                'data-export-login-card-secondary-text': ['#data-export-page .panel-subtitle'],
                'data-export-login-button-color': ['#data-export-page .password-panel-card .btn-primary'],
                'data-export-login-button-text-color': ['#data-export-page .password-panel-card .btn-primary']
            },
            general: {
                'page-background': ['#data-export-page'],
                'primary-text': ['#data-export-page .page-header h2'],
                'secondary-text': ['#data-export-page .page-header p', '#data-export-page .panel-subtitle']
            },
            card: {
                'card-background': [
                    '#data-export-page .export-card',
                    '.data-export-cards .export-card',
                    '.export-card'
                ],
                'card-primary-text': [
                    '#data-export-page .export-card-title',
                    '.data-export-cards .export-card-title',
                    '.export-card-title'
                ],
                'card-secondary-text': [
                    '#data-export-page .export-card-description',
                    '#data-export-page .export-card-meta',
                    '.data-export-cards .export-card-description',
                    '.data-export-cards .export-card-meta',
                    '.export-card-description',
                    '.export-card-meta'
                ]
            },
            buttons: {
                'button-color': ['#data-export-page .export-btn'],
                'button-text-color': ['#data-export-page .export-btn']
            }
        },
        
        'timer-countdown-page': {
            general: {
                'page-background': ['#timer-countdown-page'],
                'primary-text': ['#timer-countdown-page .page-header h2'],
                'secondary-text': ['#timer-countdown-page .page-header p']
            },
            card: {
                'card-background': ['#timer-countdown-page .timer-countdown-section'],
                'card-primary-text': ['#timer-countdown-page .section-header h3'],
                'card-secondary-text': ['#timer-countdown-page .filter-label', '#timer-countdown-page .text-muted']
            },
            buttons: {
                'button-color': ['#timer-countdown-page .btn-primary', '#timer-countdown-page #refresh-timer-btn', '#timer-countdown-page #save-timer-countdown-btn'],
                'button-text-color': ['#timer-countdown-page .btn-primary', '#timer-countdown-page #refresh-timer-btn', '#timer-countdown-page #save-timer-countdown-btn']
            }
        },
        
        'server-schedule-page': {
            general: {
                'page-background': ['#server-schedule-page'],
                'primary-text': ['#server-schedule-page .page-header h2'],
                'secondary-text': ['#server-schedule-page .page-header p']
            },
            card: {
                'card-background': ['#server-schedule-page .schedule-section'],
                'card-primary-text': ['#server-schedule-page .section-header h3'],
                'card-secondary-text': ['#server-schedule-page label']
            },
            buttons: {
                'button-color': ['#server-schedule-page .btn-primary', '#server-schedule-page .btn-secondary'],
                'button-text-color': ['#server-schedule-page .btn-primary', '#server-schedule-page .btn-secondary']
            }
        },
        
        'theme-settings-page': {
            general: {
                'page-background': ['#theme-settings-page', '#theme-settings-page .theme-preview'],
                'primary-text': ['#theme-settings-page .page-header h2'],
                'secondary-text': ['#theme-settings-page .page-header p']
            },
            card: {
                'card-header-background': ['#theme-settings-page .theme-sidebar-header', '#theme-settings-page .theme-panel-header'],
                'card-background': ['#theme-settings-page .theme-section-list', '#theme-settings-page .theme-settings-form', '#theme-settings-page .preview-card'],
                'card-item-hover-bg': ['#theme-settings-page .theme-section-item:hover'],
                'card-item-hover-text': ['#theme-settings-page .theme-section-item:hover'],
                'card-item-active-bg': ['#theme-settings-page .theme-section-item.active'],
                'card-item-active-text': ['#theme-settings-page .theme-section-item.active'],
                'card-item-active': ['#theme-settings-page .theme-section-item.active'],
                'card-primary-text': ['#theme-settings-page .theme-sidebar-header h3', '#theme-settings-page .preview-card h5', '#theme-settings-page .theme-panel-header h3'],
                'card-secondary-text': [
                    '#theme-settings-page .preview-card p',
                    '#theme-settings-page .theme-section-item',     
                    '#theme-settings-form .theme-group-title'        
                ],
            },
            buttons: {
                'button-color': [
                    '#theme-settings-page .btn-primary',
                    '#theme-settings-page .btn-secondary',
                    '#theme-settings-page .preview-btn-primary',
                    '#theme-settings-page .preview-btn-secondary'
                ],
                'button-text-color': [
                    '#theme-settings-page .btn-primary',
                    '#theme-settings-page .btn-secondary',
                    '#theme-settings-page .preview-btn-primary',
                    '#theme-settings-page .preview-btn-secondary'
                ]
            }
        },
        'saved-themes': {
            general: {
                'primary-text': ['#saved-themes-panel h3', '#saved-themes-panel h4'],
                'secondary-text': ['#saved-themes-panel p']
            },
            cards: {
                'card-header-background': ['.saved-theme-header']
            }
        }
    },
    
    // color options groupings
    colorOptions: {
        general: [
            { id: 'page-background', label: 'Page Background', default: '#f1f5f9', description: 'Main page background color' },
            { id: 'primary-text', label: 'Primary Text', default: '#1e293b', description: 'Main headings and important text' },
            { id: 'secondary-text', label: 'Secondary Text', default: '#64748b', description: 'Descriptions and secondary text' }
        ],
        header: [
            { id: 'admin-header-bg', label: 'Admin Header Background', default: '#ffffff', description: 'Background for admin panel header' },
            { id: 'primary-header-text', label: 'Header Primary Text', default: '#1e293b', description: 'Main text in admin header' },
            { id: 'secondary-header-text', label: 'Header Secondary Text', default: '#64748b', description: 'Secondary text in admin header' }
        ],
        navbar: [
            { id: 'navbar-background', label: 'Navbar Background', default: '#000738', description: 'Background color for sidebar navigation' },
            { id: 'navbar-primary-text', label: 'Navbar Section Headers', default: '#94a3b8', description: 'Color for navbar section headers' },
            { id: 'navbar-secondary-text', label: 'Navbar Items', default: '#475569', description: 'Color for navbar menu items' },
            { id: 'navbar-active-selection', label: 'Navbar Active Item', default: '#ede9fe', description: 'Background for active navbar item' },
            { id: 'navbar-hover', label: 'Navbar Hover', default: '#f1f5f9', description: 'Background for navbar item hover' }
        ],
        card: [
            { id: 'card-background', label: 'Card Background', default: '#ffffff', description: 'Background for cards and panels' },
            { id: 'card-header-background', label: 'Card Header Background', default: '#f8fafc', description: 'Background for card headers' },
            { id: 'card-border-color', label: 'Card Border', default: '#e2e8f0', description: 'Border color for cards' },
            { id: 'card-primary-text', label: 'Card Primary Text', default: '#1e293b', description: 'Card titles and headings' },
            { id: 'card-secondary-text', label: 'Card Body Text', default: '#64748b', description: 'Card descriptions and labels' },
            { id: 'card-third-text', label: 'Card Tertiary Text', default: '#94a3b8', description: 'Card hints and helper text' },
            { id: 'card-item-hover-bg', label: 'Card Item Hover Background', default: '#f1f5f9', description: 'Hover background for card items' },
            { id: 'card-item-hover-text', label: 'Card Item Hover Text', default: '#64748b', description: 'Hover text color for card items' },
            { id: 'card-item-active-bg', label: 'Card Item Active Background', default: '#ede9fe', description: 'Active state background for card items' },
            { id: 'card-item-active-text', label: 'Card Item Active Text', default: '#7c3aed', description: 'Active state text color for card items' }
        ],
            
        buttons: [
            { id: 'button-color', label: 'Button Background', default: '#0a1e81', description: 'Background color for buttons' },
            { id: 'button-text-color', label: 'Button Text', default: '#ffffff', description: 'Text color for buttons' }
        ],
        badges: [
            { id: 'badge-7days-background', label: '7-Day Retention Badge BG', default: '#9E0000', description: 'Background for 7-day retention badges' },
            { id: 'badge-7days-text', label: '7-Day Retention Badge Text', default: '#ffffffff', description: 'Text color for 7-day retention badges' },
            { id: 'badge-longterm-background', label: 'Long-Term Retention Badge BG', default: '#2EAD00', description: 'Background for long-term retention badges' },
            { id: 'badge-longterm-text', label: 'Long-Term Retention Badge Text', default: '#ffffffff', description: 'Text color for long-term retention badges' }
        ],
        // slider: [
        //     { id: 'card-slider-color', label: 'Toggle Slider Color', default: '#cbd5e1', description: 'Color for toggle switches' }
        // ],
        login: [
            { id: 'login-background', label: 'Login Panel Background', default: '#ffffffff', description: 'Background for the login/password panel' },
            { id: 'login-card-background', label: 'Login Card Background', default: '#ffffff', description: 'Background for the login card' },
            { id: 'login-card-primary-text', label: 'Login Card Text', default: '#1e293b', description: 'Text color for login card headings' },
            { id: 'login-card-secondary-text', label: 'Login Card Subtitle', default: '#64748b', description: 'Text color for login card subtitle' },
            { id: 'login-button-color', label: 'Login Button Color', default: '#0a1e81', description: 'Background color for login button' },
            { id: 'login-button-text-color', label: 'Login Button Text Color', default: '#ffffff', description: 'Text color for login button' }
        ]
    }
};

// Get color options available for a section
function getColorOptionsForSection(sectionId) {
    const options = [];
    const mapping = themeConfig.selectorMapping[sectionId];
    
    if (!mapping) return options;
    
    // Extract unique option IDs from the mapping
    Object.keys(mapping).forEach(category => {
        Object.keys(mapping[category]).forEach(optionId => {
            // Find the option definition
            let optionDef = null;
            
            // Search in all color option categories
            Object.keys(themeConfig.colorOptions).forEach(categoryKey => {
                const found = themeConfig.colorOptions[categoryKey].find(opt => opt.id === optionId);
                if (found) {
                    optionDef = { ...found, category: categoryKey };
                }
            });
            
            if (optionDef && !options.find(o => o.id === optionId)) {
                options.push(optionDef);
            }
        });
    });
    
    return options;
}

// Get expanded selectors for a specific color option in a section
function getSelectorsForOption(sectionId, optionId) {
    const mapping = themeConfig.selectorMapping[sectionId];
    if (!mapping) return [];
    
    // Search through all categories
    for (const category of Object.keys(mapping)) {
        if (mapping[category][optionId]) {
            return expandSelectorPatterns(mapping[category][optionId]);
        }
    }
    
    return [];
}

// ==================== 22. THEME MANAGEMENT FUNCTIONS ====================

// Store theme settings (loads from localStorage)
let themeSettings = {};
let currentSection = 'global';

// Initialize theme settings page
function initThemeSettings() {
    loadThemeSettings();
    renderSectionList();
    selectSection('global');
    applyThemeSettings();
    initSavedThemesSection();
    
    // Run validation after a short delay to ensure DOM is ready
    setTimeout(() => {
        const validationResults = validateSelectors(themeConfig.selectorMapping);
        console.log('🎨 Theme Validation Results:');
        console.log(`   ✅ ${validationResults.found}/${validationResults.total} selectors found in DOM`);
        
        if (validationResults.missing.length > 0) {
            console.warn(`   ⚠️  ${validationResults.missing.length} selectors not found:`);
            validationResults.missing.forEach(sel => console.warn(`      - ${sel}`));
        }
        
        if (validationResults.suggestions.length > 0) {
            console.log('   💡 Suggestions:');
            validationResults.suggestions.forEach(s => {
                console.log(`      "${s.selector}" → Did you mean "${s.suggestion}"?`);
            });
        }
        
        if (validationResults.missing.length === 0) {
            console.log('   ✨ All selectors validated successfully!');
        }
    }, 1000);
}

// Load theme settings from localStorage (USER-SPECIFIC)
function loadThemeSettings() {
    // Get current user ID from session
    const currentUserId = sessionStorage.getItem('userId') || 
                         sessionStorage.getItem('loggedUser');
    
    if (!currentUserId) {
        console.log('⚠️ No user logged in - using default theme');
        themeSettings = getDefaultThemeSettings();
        return;
    }
    
    // Create user-specific localStorage key
    const storageKey = `adminThemeSettings_user_${currentUserId}`;
    const saved = localStorage.getItem(storageKey);
    
    if (saved) {
        try {
            themeSettings = JSON.parse(saved);
            migrateOldColors();
            console.log(`✅ Loaded theme settings for user ${currentUserId}`);
        } catch (e) {
            console.error('Failed to parse theme settings:', e);
            themeSettings = getDefaultThemeSettings();
        }
    } else {
        console.log(`ℹ️ No saved settings for user ${currentUserId} - using defaults`);
        themeSettings = getDefaultThemeSettings();
    }
}

// Migrate old color values to new defaults
function migrateOldColors() {
    const colorMigrations = {
        '#7c3aed': '#0a1e81',
        '#0A1E81': '#0a1e81'
    };
    
    Object.keys(themeSettings).forEach(sectionId => {
        if (themeSettings[sectionId] && themeSettings[sectionId].colors) {
            const colors = themeSettings[sectionId].colors;
            
            Object.keys(colors).forEach(optionId => {
                const currentColor = colors[optionId];
                
                if (colorMigrations[currentColor]) {
                    colors[optionId] = colorMigrations[currentColor];
                    console.log(`Migrated ${sectionId}.${optionId}: ${currentColor} → ${colorMigrations[currentColor]}`);
                }
            });
        }
    });
    
    // Save with user-specific key
    const currentUserId = sessionStorage.getItem('userId') || 
                         sessionStorage.getItem('loggedUser');
    if (currentUserId) {
        const storageKey = `adminThemeSettings_user_${currentUserId}`;
        localStorage.setItem(storageKey, JSON.stringify(themeSettings));
    }
}

// Custom default theme - modify these colors to your preference
function getCustomDefaultColors() {
    return {
        // ==================== GENERAL COLORS ====================
        'page-background': '#ffffffff',            // White page background
        'primary-text': '#000000ff',               // Black primary text
        'secondary-text': '#959595ff',             // Gray secondary text
        
        // ==================== ADMIN HEADER COLORS ====================
        'admin-header-bg': '#262626',              // Dark gray header background
        'primary-header-text': '#ffffff',          // White primary header text
        'secondary-header-text': '#b0b0b0',        // Light gray secondary header text
        
        // ==================== NAVBAR COLORS ====================
        'navbar-background': '#16181d',            // Dark navbar background
        'navbar-primary-text': '#808080',          // Gray navbar section headers
        'navbar-secondary-text': '#a0a0a0',        // Light gray navbar items
        'navbar-active-selection': '#2a2d3a',      // Dark gray active item background
        'navbar-hover': '#1f2229',                 // Dark gray hover background
        
        // ==================== CARD COLORS ====================
        'card-background': '#f7f7f7ff',            // Light gray card background
        'card-header-background': '#ffffffff',     // White card header background
        'card-border-color': '#eeeeeeff',          // Light gray card border
        'card-primary-text': '#000000ff',          // Black card primary text
        'card-secondary-text': '#000000ff',        // Black card secondary text
        'card-third-text': '#808080',              // Gray card tertiary text
        'card-item-hover-bg': '#f1f5f9',           // Light blue-gray hover background
        'card-item-hover-text': '#64748b',         // Gray hover text
        'card-item-active-bg': '#ede9fe',          // Light purple active background
        'card-item-active-text': '#7c3aed',        // Purple active text
        
        // ==================== BUTTON COLORS ====================
        'button-color': '#ffffffff',               // White button background
        'button-text-color': '#000000ff',          // Black button text
        
        // ==================== BADGE COLORS ====================
        'badge-7days-background': '#9E0000',       // Red badge background (7-day retention)
        'badge-7days-text': '#ffffffff',           // White badge text (7-day retention)
        'badge-longterm-background': '#2EAD00',  // Green badge background (long-term)
        'badge-longterm-text': '#ffffffff',      // White badge text (long-term)
        
        // ==================== LOGIN PAGE COLORS ====================
        'login-background': '#ffffffff',           // White login page background
        'login-card-background': '#000000ff',      // Black login card background
        'login-card-primary-text': '#ffffff',      // White login card primary text
        'login-card-secondary-text': '#64748b',    // Gray login card subtitle
        'login-button-color': '#000000ff',         // Black login button background
        'login-button-text-color': '#ffffff',      // White login button text
    };
}

// Get default theme settings
function getDefaultThemeSettings() {
    const defaults = {};
    const customColors = getCustomDefaultColors(); // Get your custom colors
    
    themeConfig.sections.forEach(section => {
        defaults[section.id] = {
            useGlobal: section.id !== 'global',
            colors: {}
        };
        
        const options = getColorOptionsForSection(section.id);
        
        options.forEach(option => {
            // Use custom color if available, otherwise fall back to original default
            defaults[section.id].colors[option.id] = customColors[option.id] || option.default;
        });
    });
    
    return defaults;
}

// Save individual page overrides separately from global theme
// This ensures individual page settings don't get mixed between users
function saveIndividualPageSettings() {
    const currentUserId = sessionStorage.getItem('userId') || 
                         sessionStorage.getItem('loggedUser');
    
    if (!currentUserId) {
        console.error('Cannot save individual page settings: No user logged in');
        return;
    }
    
    // Extract ONLY individual page settings (not global)
    const individualSettings = {};
    
    Object.keys(themeSettings).forEach(sectionId => {
        if (sectionId !== 'global' && themeSettings[sectionId]) {
            // Only save if user has set individual colors (useGlobal = false)
            if (themeSettings[sectionId].useGlobal === false) {
                individualSettings[sectionId] = {
                    useGlobal: false,
                    colors: themeSettings[sectionId].colors || {}
                };
            } else if (themeSettings[sectionId].useGlobal === true) {
                // Save toggle state even if using global
                individualSettings[sectionId] = {
                    useGlobal: true,
                    colors: {}
                };
            }
        }
    });
    
    // Save to user-specific key
    const storageKey = `individualPageSettings_user_${currentUserId}`;
    localStorage.setItem(storageKey, JSON.stringify(individualSettings));
    console.log(`💾 Saved individual page settings for user ${currentUserId}`, individualSettings);
}

// Load individual page overrides
function loadIndividualPageSettings() {
    const currentUserId = sessionStorage.getItem('userId') || 
                         sessionStorage.getItem('loggedUser');
    
    if (!currentUserId) {
        return;
    }
    
    const storageKey = `individualPageSettings_user_${currentUserId}`;
    const saved = localStorage.getItem(storageKey);
    
    if (saved) {
        try {
            const individualSettings = JSON.parse(saved);
            
            // Merge individual settings into themeSettings
            Object.keys(individualSettings).forEach(sectionId => {
                if (!themeSettings[sectionId]) {
                    themeSettings[sectionId] = { useGlobal: true, colors: {} };
                }
                
                // Apply individual settings
                themeSettings[sectionId].useGlobal = individualSettings[sectionId].useGlobal;
                themeSettings[sectionId].colors = individualSettings[sectionId].colors || {};
            });
            
            console.log(`✅ Loaded individual page settings for user ${currentUserId}`, individualSettings);
        } catch (e) {
            console.error('Failed to parse individual page settings:', e);
        }
    }
}

// Save theme settings to localStorage (USER-SPECIFIC)
function saveThemeSettings() {
    try {
        // Get current user ID
        const currentUserId = sessionStorage.getItem('userId') || 
                             sessionStorage.getItem('loggedUser');
        
        if (!currentUserId) {
            console.error('Cannot save theme: No user logged in');
            alert('Please log in to save theme settings');
            return;
        }
        
        // Save global theme settings
        const storageKey = `adminThemeSettings_user_${currentUserId}`;
        localStorage.setItem(storageKey, JSON.stringify(themeSettings));
        
        // ALSO save individual page settings separately
        saveIndividualPageSettings();
        
        applyThemeSettings();
        showSaveMessage();
        
        console.log(`✅ Saved theme settings for user ${currentUserId}`);
    } catch (e) {
        console.error('Failed to save theme settings:', e);
        alert('Failed to save theme settings. Please try again.');
    }
}

// Show save success message
function showSaveMessage() {
    let message = document.querySelector('.theme-save-message');
    if (!message) {
        message = document.createElement('div');
        message.className = 'theme-save-message';
        message.textContent = '✓ Theme settings saved successfully!';
        document.body.appendChild(message);
    }
    
    message.classList.add('show');
    setTimeout(() => {
        message.classList.remove('show');
    }, 3000);
}

// Render section list in sidebar
function renderSectionList() {
    const container = document.getElementById('theme-section-list');
    container.innerHTML = '';
    
    // Get current user role
    const userRole = sessionStorage.getItem('userRole');
    
    // Filter sections based on role
    const visibleSections = themeConfig.sections.filter(section => {
        // If section has no requiredRole, it's visible to everyone
        if (!section.requiredRole) return true;
        
        // If section requires system_admin, only show to system_admin
        return userRole === 'system_admin';
    });
    
    visibleSections.forEach(section => {
        const item = document.createElement('div');
        item.className = 'theme-section-item';
        item.onclick = () => selectSection(section.id);
        
        item.innerHTML = `
            <span class="section-icon">${section.icon}</span>
            <span>${section.name}</span>
            ${section.isGlobal ? '<span class="section-badge">GLOBAL</span>' : ''}
        `;
        
        if (section.id === currentSection) {
            item.classList.add('active');
        }
        
        container.appendChild(item);
    });
}

// Select a section
function selectSection(sectionId) {
    currentSection = sectionId;
    renderSectionList();
    renderThemeControls(sectionId);
    updateSectionTitle(sectionId);
    
    // Special handling for saved-themes UI elements
    const overrideContainer = document.getElementById('override-toggle-container');
    const resetGlobalBtn = document.getElementById('reset-to-global-btn');
    const saveChangesBtn = document.querySelector('.btn-primary[onclick="saveThemeSettings()"]');
    const resetAllBtn = document.querySelector('.btn-secondary[onclick="resetAllToDefaults()"]');
    
    if (sectionId === 'saved-themes') {
        // Hide theme control buttons for saved-themes section
        if (overrideContainer) overrideContainer.style.display = 'none';
        if (resetGlobalBtn) resetGlobalBtn.style.display = 'none';
        if (saveChangesBtn) saveChangesBtn.style.display = 'none';
        if (resetAllBtn) resetAllBtn.style.display = 'none';
    } else {
        // Show theme control buttons for other sections
        if (saveChangesBtn) saveChangesBtn.style.display = '';
        if (resetAllBtn) resetAllBtn.style.display = '';
        // Override toggle and reset button visibility handled elsewhere
    }
}

// Update section title
function updateSectionTitle(sectionId) {
    const section = themeConfig.sections.find(s => s.id === sectionId);
    document.getElementById('current-section-title').textContent = section.name;
    
    const overrideContainer = document.getElementById('override-toggle-container');
    const resetBtn = document.getElementById('reset-to-global-btn');
    
    if (section.isGlobal) {
        overrideContainer.style.display = 'none';
        resetBtn.style.display = 'none';
    } else {
        overrideContainer.style.display = 'flex';
        resetBtn.style.display = 'inline-block';
        
        const useGlobal = themeSettings[sectionId]?.useGlobal ?? true;
        document.getElementById('use-global-theme').checked = useGlobal;
    }
}

// Render theme controls for a section
function renderThemeControls(sectionId) {
    const container = document.getElementById('theme-settings-form');
    
    // Get the saved-themes panel (it's inside the container)
    const savedThemesPanel = document.getElementById('saved-themes-panel');
    
    // SPECIAL HANDLING FOR SAVED-THEMES
    if (sectionId === 'saved-themes') {
        // Hide all other content in container (color groups, etc.)
        Array.from(container.children).forEach(child => {
            if (child.id !== 'saved-themes-panel') {
                child.style.display = 'none';
            }
        });
        
        // Show the saved-themes panel
        if (savedThemesPanel) {
            savedThemesPanel.style.display = 'block';
            
            // Initialize saved themes section
            if (typeof initSavedThemesSection === 'function') {
                initSavedThemesSection();
            } else {
                console.error('initSavedThemesSection function not found');
            }
        } else {
            console.error('saved-themes-panel element not found in HTML');
        }
        
        return; // Exit early don't render color controls
    }
    
    // Hide saved-themes panel, show color controls
    if (savedThemesPanel) {
        savedThemesPanel.style.display = 'none';
    }
    
    // Remove all children EXCEPT saved-themes-panel
    Array.from(container.children).forEach(child => {
        if (child.id !== 'saved-themes-panel') {
            child.remove();
        }
    });
    
    const section = themeConfig.sections.find(s => s.id === sectionId);
    const sectionSettings = themeSettings[sectionId] || { useGlobal: !section.isGlobal, colors: {} };
    const isDisabled = sectionSettings.useGlobal && !section.isGlobal;
    
    const options = getColorOptionsForSection(sectionId);
    
    const groupedOptions = {};
    options.forEach(option => {
        const category = option.category || 'general';
        if (!groupedOptions[category]) {
            groupedOptions[category] = [];
        }
        groupedOptions[category].push(option);
    });
    
    const categoryNames = {
        general: 'General',
        card: 'Card',
        buttons: 'Buttons',
        navbar: 'Navigation',
        adminHeader: 'Header',
        login: 'Login',
        badges: 'Badges',
        sections: 'Sections'
    };
    
    Object.keys(groupedOptions).forEach(category => {
        const groupTitle = categoryNames[category] || category;
        const group = createColorGroup(groupTitle, groupedOptions[category], sectionId, isDisabled);
        container.appendChild(group);
    });
    
    updatePreview(sectionId);
}

// Create a color group
function createColorGroup(title, options, sectionId, isDisabled) {
    const group = document.createElement('div');
    group.className = 'theme-group';
    
    const groupTitle = document.createElement('div');
    groupTitle.className = 'theme-group-title';
    groupTitle.textContent = title;
    group.appendChild(groupTitle);
    
    options.forEach(option => {
        const control = createColorControl(option, sectionId, isDisabled);
        group.appendChild(control);
    });
    
    return group;
}

const THEME_COLOR_PRESETS = {
    lightBackgrounds: [
        { label: 'White', value: '#FFFFFF' },
        { label: 'Mist', value: '#F8FAFC' },
        { label: 'Soft Green', value: '#F0FDF4' },
        { label: 'Soft Blue', value: '#EFF6FF' }
    ],
    darkBackgrounds: [
        { label: 'Forest', value: '#052E1B' },
        { label: 'Deep Teal', value: '#083B3A' },
        { label: 'Navy', value: '#0F172A' },
        { label: 'Charcoal', value: '#1F2937' }
    ],
    textOnLight: [
        { label: 'Black', value: '#000000' },
        { label: 'Slate', value: '#1E293B' },
        { label: 'Gray', value: '#64748B' },
        { label: 'Green', value: '#166534' }
    ],
    textOnDark: [
        { label: 'White', value: '#FFFFFF' },
        { label: 'Mint', value: '#D1FAE5' },
        { label: 'Light Gray', value: '#CBD5E1' },
        { label: 'Soft Yellow', value: '#FEF3C7' }
    ],
    accents: [
        { label: 'RP Green', value: '#047857' },
        { label: 'Leaf', value: '#16A34A' },
        { label: 'Teal', value: '#0F766E' },
        { label: 'Blue', value: '#2563EB' },
        { label: 'Amber', value: '#D97706' },
        { label: 'Red', value: '#B91C1C' }
    ],
    borders: [
        { label: 'Pale', value: '#E2E8F0' },
        { label: 'Soft Gray', value: '#CBD5E1' },
        { label: 'Mint Line', value: '#A7F3D0' },
        { label: 'Dark Line', value: '#334155' }
    ]
};

function normalizeThemeColor(value) {
    const color = String(value || '').trim().toUpperCase();
    return /^#[0-9A-F]{8}$/.test(color) && color.endsWith('FF') ? color.substring(0, 7) : color;
}

function getThemeColorPresets(option) {
    const id = option.id || '';

    if (id.includes('border')) {
        return THEME_COLOR_PRESETS.borders;
    }

    if (id.includes('text') || id.includes('primary') || id.includes('secondary') || id.includes('third')) {
        if (id.includes('button-text') || id.includes('badge') || id.includes('login-card')) {
            return THEME_COLOR_PRESETS.textOnDark;
        }
        return THEME_COLOR_PRESETS.textOnLight;
    }

    if (id.includes('navbar') || id.includes('header') || id.includes('login') || id.includes('button') || id.includes('badge')) {
        return THEME_COLOR_PRESETS.darkBackgrounds.concat(THEME_COLOR_PRESETS.accents);
    }

    if (id.includes('card') || id === 'page-background') {
        return THEME_COLOR_PRESETS.lightBackgrounds.concat(THEME_COLOR_PRESETS.darkBackgrounds);
    }

    return THEME_COLOR_PRESETS.lightBackgrounds.concat(THEME_COLOR_PRESETS.accents);
}

function getPresetOptionsForColor(option, currentColor) {
    const normalizedCurrent = normalizeThemeColor(currentColor);
    const presets = getThemeColorPresets(option).map(preset => ({
        ...preset,
        value: normalizeThemeColor(preset.value)
    }));

    if (normalizedCurrent && !presets.some(preset => preset.value === normalizedCurrent)) {
        presets.unshift({ label: 'Current', value: normalizedCurrent });
    }

    return presets;
}

function hexToRgb(color) {
    const normalized = normalizeThemeColor(color);
    const match = normalized.match(/^#([0-9A-F]{6})$/);
    if (!match) return null;

    const value = match[1];
    return {
        r: parseInt(value.substring(0, 2), 16),
        g: parseInt(value.substring(2, 4), 16),
        b: parseInt(value.substring(4, 6), 16)
    };
}

function isDarkThemeColor(color) {
    const rgb = hexToRgb(color);
    if (!rgb) return false;
    const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
    return luminance < 0.45;
}

function applyBackgroundCompanionColors(sectionId, backgroundColor) {
    if (!themeSettings[sectionId]?.colors) return;

    const colors = themeSettings[sectionId].colors;
    const companion = isDarkThemeColor(backgroundColor) ? {
        'primary-text': '#FFFFFF',
        'secondary-text': '#D1FAE5',
        'card-background': '#083B3A',
        'card-header-background': '#052E1B',
        'card-border-color': '#0F766E',
        'card-primary-text': '#FFFFFF',
        'card-secondary-text': '#D1FAE5',
        'card-third-text': '#A7F3D0',
        'button-color': '#FFFFFF',
        'button-text-color': '#052E1B'
    } : {
        'primary-text': '#000000',
        'secondary-text': '#64748B',
        'card-background': '#FFFFFF',
        'card-header-background': '#F8FAFC',
        'card-border-color': '#E2E8F0',
        'card-primary-text': '#000000',
        'card-secondary-text': '#334155',
        'card-third-text': '#64748B',
        'button-color': '#0F766E',
        'button-text-color': '#FFFFFF'
    };

    Object.assign(colors, companion);
}

// Create a color control
function createColorControl(option, sectionId, isDisabled) {
    const control = document.createElement('div');
    control.className = 'theme-control' + (isDisabled ? ' disabled' : '');
    
    const currentColor = normalizeThemeColor(themeSettings[sectionId]?.colors[option.id] || option.default);
    
    const selectors = getSelectorsForOption(sectionId, option.id);
    const selectorCount = selectors.length;
    
    const presets = getPresetOptionsForColor(option, currentColor);
    const swatches = presets.map(preset => {
        const isSelected = normalizeThemeColor(preset.value) === currentColor;
        return `
            <button
                type="button"
                class="theme-swatch-button ${isSelected ? 'selected' : ''}"
                style="--swatch-color: ${preset.value};"
                title="${preset.label}: ${preset.value}"
                aria-label="${preset.label} ${preset.value}"
                onclick="updateColor('${sectionId}', '${option.id}', '${preset.value}')"
                ${isDisabled ? 'disabled' : ''}>
                <span></span>
            </button>
        `;
    }).join('');

    control.innerHTML = `
        <div class="theme-control-label">
            <span>${option.label}</span>
            ${selectorCount > 1 ? `<span class="selector-count">(${selectorCount} elements)</span>` : ''}
        </div>
        <div class="theme-control-description">${option.description || ''}</div>
        <div class="theme-control-input">
            <div class="theme-swatch-list" role="list" aria-label="${option.label} color presets">
                ${swatches}
            </div>
            <span class="theme-current-color">${currentColor}</span>
        </div>
    `;
    
    return control;
}

// Update color from picker
function updateColor(sectionId, colorId, value) {
    if (!themeSettings[sectionId]) {
        themeSettings[sectionId] = { useGlobal: false, colors: {} };
    }
    themeSettings[sectionId].colors[colorId] = normalizeThemeColor(value);

    if (colorId === 'page-background') {
        applyBackgroundCompanionColors(sectionId, value);
    }
    
    const hexInput = document.getElementById(`hex-${sectionId}-${colorId}`);
    if (hexInput) {
        hexInput.value = normalizeThemeColor(value);
    }
    
    renderThemeControls(sectionId);
    updatePreview(sectionId);
}

// Update color from hex input
function updateColorFromHex(sectionId, colorId, value) {
    const hexRegex = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
    if (!hexRegex.test(value)) {
        const currentColor = themeSettings[sectionId]?.colors[colorId];
        const hexInput = document.getElementById(`hex-${sectionId}-${colorId}`);
        if (hexInput && currentColor) {
            hexInput.value = currentColor.toUpperCase();
        }
        return;
    }
    
    if (!themeSettings[sectionId]) {
        themeSettings[sectionId] = { useGlobal: false, colors: {} };
    }
    themeSettings[sectionId].colors[colorId] = value.toUpperCase();
    
    const colorPicker = document.getElementById(`color-${sectionId}-${colorId}`);
    if (colorPicker) {
        colorPicker.value = value;
    }
    
    updatePreview(sectionId);
}

// Toggle global theme override for a section
function toggleGlobalThemeOverride() {
    const useGlobal = document.getElementById('use-global-theme').checked;
    
    if (!themeSettings[currentSection]) {
        themeSettings[currentSection] = { useGlobal: true, colors: {} };
    }
    
    themeSettings[currentSection].useGlobal = useGlobal;
    renderThemeControls(currentSection);
}

// Reset section to global theme
function resetSectionToGlobal() {
    if (currentSection === 'global') return;
    
    if (confirm(`Reset ${themeConfig.sections.find(s => s.id === currentSection).name} to use the Admin Overall Theme?`)) {
        themeSettings[currentSection].useGlobal = true;
        themeSettings[currentSection].colors = { ...themeSettings.global.colors };
        renderThemeControls(currentSection);
        document.getElementById('use-global-theme').checked = true;
    }
}

// Reset all to defaults
async function resetAllToDefaults() {
    if (!confirm('Reset all theme settings to default values? This will also deactivate your active theme. This cannot be undone.')) {
        return;
    }
    
    try {
        // Step 1: Deactivate active theme in database
        console.log('🔄 Deactivating active theme...');
        
        const response = await fetch('/api/admin/saved-themes/deactivate-all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            console.log('✅ Active theme deactivated');
        } else {
            console.warn('⚠️ Failed to deactivate theme in database');
        }
        
        // Step 2: Reset themeSettings to defaults
        themeSettings = getDefaultThemeSettings();
        
        // Step 3: Clear individual page settings
        const currentUserId = sessionStorage.getItem('userId') || 
                             sessionStorage.getItem('loggedUser');
        if (currentUserId) {
            localStorage.removeItem(`individualPageSettings_user_${currentUserId}`);
            console.log('🗑️ Cleared individual page settings');
        }
        
        // Step 4: Save the reset state
        saveThemeSettings();
        
        // Step 5: Re-render UI
        renderThemeControls(currentSection);
        applyThemeSettings();
        
        // Step 6: Reload saved themes UI to remove "Active" badge
        if (typeof loadSavedThemes === 'function') {
            await loadSavedThemes();
        }
        
        showSaveMessage();
        alert('✅ Reset to defaults complete! Your active theme has been deactivated.');
        
    } catch (error) {
        console.error('❌ Error resetting to defaults:', error);
        alert('Failed to reset settings. Please try again.');
    }
}

// Update preview
function updatePreview(sectionId) {
    const settings = themeSettings[sectionId];
    if (!settings) return;
    
    const colors = settings.colors;
    const preview = document.getElementById('theme-preview');
    
    preview.style.setProperty('--preview-bg', colors['page-background'] || '#ffffff');
    preview.style.setProperty('--preview-card-bg', colors['card-background'] || '#f8fafc');
    preview.style.setProperty('--preview-border', colors['card-border-color'] || '#e2e8f0');
    preview.style.setProperty('--preview-heading', colors['primary-text'] || '#1e293b');
    preview.style.setProperty('--preview-text', colors['secondary-text'] || '#64748b');
    preview.style.setProperty('--preview-btn-bg', colors['button-color'] || '#0a1e81');
    preview.style.setProperty('--preview-btn-text', colors['button-text-color'] || '#ffffff');
}

// Apply theme settings to the actual page using CSS selectors
function applyThemeSettings() {
    let styleEl = document.getElementById('dynamic-theme-styles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dynamic-theme-styles';
        document.head.appendChild(styleEl);
    }
    
    let css = '';
    
    themeConfig.sections.forEach(section => {
        const sectionSettings = themeSettings[section.id];
        if (!sectionSettings) return;
        
        const useGlobal = section.isGlobal ? false : (sectionSettings.useGlobal ?? true);
        const colors = useGlobal && themeSettings.global ? themeSettings.global.colors : sectionSettings.colors;
        
        if (!colors) return;
        
        const mapping = themeConfig.selectorMapping[section.id];
        if (!mapping) return;
        
        Object.keys(mapping).forEach(category => {
            Object.keys(mapping[category]).forEach(optionId => {
                const config = mapping[category][optionId];
                const selectors = expandSelectorPatterns(config);
                const color = colors[optionId];
                
                if (!color || !selectors || selectors.length === 0) return;
                
                let cssProperty = 'color';
                let cssValue = color;
                
                if (optionId.includes('background') || optionId.includes('-bg') || optionId === 'page-background' || 
                    optionId === 'card-background' || optionId === 'navbar-background' || 
                    optionId === 'navbar-hover' ||
                    optionId === 'admin-header-bg' || optionId === 'button-color') {
                    cssProperty = 'background-color';
                    
                    if (optionId === 'button-color') {
                        const selectorList = selectors.join(', ');
                        css += `
                            ${selectorList} {
                                background: ${cssValue} !important;
                                background-color: ${cssValue} !important;
                            }
                        `;
                        return;
                    }
                    
                    if (optionId === 'card-background' && selectors.some(s => s.includes('export-card'))) {
                        const exportCardSelectors = selectors.filter(s => s.includes('export-card')).join(', ');
                        if (exportCardSelectors) {
                            css += `
                                ${exportCardSelectors} {
                                    background: ${cssValue} !important;
                                    background-color: ${cssValue} !important;
                                }
                            `;
                        }
                        const nonExportSelectors = selectors.filter(s => !s.includes('export-card'));
                        if (nonExportSelectors.length === 0) return;
                        const remainingSelectorList = nonExportSelectors.join(', ');
                        css += `
                            ${remainingSelectorList} {
                                ${cssProperty}: ${cssValue} !important;
                            }
                        `;
                        return;
                    }
                } else if (optionId === 'navbar-active-selection') {
                    const selectorList = selectors.join(', ');
                    css += `
                        ${selectorList} {
                            background-color: ${cssValue} !important;
                            border-left-color: ${cssValue} !important;
                        }
                    `;
                    return;
                } else if (optionId.includes('border')) {
                    cssProperty = 'border-color';
                } else if (optionId.includes('text') || optionId.includes('primary') || 
                          optionId.includes('secondary') || optionId === 'button-text-color') {
                    cssProperty = 'color';
                }
                
                const selectorList = selectors.join(', ');
                css += `
                    ${selectorList} {
                        ${cssProperty}: ${cssValue} !important;
                    }
                `;
            });
        });
    });
    
    styleEl.textContent = css;
}

// Helper function to adjust color brightness

// Initialize theme on page load (WAIT FOR LOGIN)
document.addEventListener('DOMContentLoaded', () => {
    // Don't load from localStorage yet - wait for login to determine user
    // Just apply defaults for now
    themeSettings = getDefaultThemeSettings();
    applyThemeSettings();
    console.log('🎨 Applied default theme on page load (waiting for login)');
}); 

// ==================== 23. SAVED THEMES MANAGEMENT ====================
let savedThemesCache = []; // Cache of user's saved themes
let currentThemeData = null; // Store current theme data for saving

// Load all saved themes for the current user
async function loadSavedThemes() {
    try {
        console.log('📚 Loading saved themes...');
        
        const response = await fetch('/api/admin/saved-themes', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // Check if it's an authentication error
            if (response.status === 401) {
                console.warn('⚠️ Not authenticated yet. Saved themes will load after login.');
                return [];
            }
            throw new Error(data.error || 'Failed to load saved themes');
        }
        
        savedThemesCache = data.themes || [];
        
        console.log(`✅ Loaded ${savedThemesCache.length} saved themes`);
        
        // Update UI
        updateSavedThemesUI();
        
        return savedThemesCache;
        
    } catch (error) {
        console.error('❌ Error loading saved themes:', error);
        
        // Only show notification if not an auth error
        if (error.message !== 'Authentication required') {
            if (typeof showNotification === 'function') {
                showNotification('Failed to load saved themes: ' + error.message, 'error');
            } else {
                console.error('showNotification function not found');
            }
        }
        
        return [];
    }
}

// Update the saved themes UI
function updateSavedThemesUI() {
    const countElement = document.getElementById('saved-themes-count');
    const listElement = document.getElementById('saved-themes-list');
    
    if (!countElement || !listElement) {
        console.warn('⚠️ Saved themes UI elements not found');
        return;
    }
    
    // Update count
    countElement.textContent = savedThemesCache.length;
    
    // Clear list
    listElement.innerHTML = '';
    
    // Show no themes message if empty
    if (savedThemesCache.length === 0) {
        listElement.innerHTML = `
            <div class="no-themes-message">
                <p>No saved themes yet. Save your first theme above!</p>
            </div>
        `;
        return;
    }
    
    // Render each theme card
    savedThemesCache.forEach(theme => {
        const themeCard = createSavedThemeCard(theme);
        listElement.appendChild(themeCard);
    });
}

// Create a saved theme card element
function createSavedThemeCard(theme) {
    const card = document.createElement('div');
    card.className = `saved-theme-card ${theme.is_active ? 'active-theme' : ''}`;
    card.dataset.themeId = theme.id;
    
    // Extract some colors for preview (first 4 colors from theme data)
    const previewColors = extractPreviewColors(theme.theme_data);
    
    // Format date
    const createdDate = new Date(theme.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    card.innerHTML = `
        <div class="saved-theme-header">
            <h5 class="saved-theme-name">${escapeHtml(theme.theme_name)}</h5>
            ${theme.is_active ? '<span class="active-badge">✓ Active</span>' : ''}
        </div>
        
        <div class="saved-theme-preview">
            <div class="color-preview-row">
                ${previewColors.map(color => `
                    <div class="color-preview-box" style="background: ${color};" title="${color}"></div>
                `).join('')}
            </div>
        </div>
        
        <div class="saved-theme-info">
            <small>Created: ${createdDate}</small>
        </div>
        
        <div class="saved-theme-actions">
            ${!theme.is_active ? `
                <button onclick="activateSavedTheme(${theme.id})" class="btn btn-primary" title="Set as active theme and apply immediately">
                    ✓ Set Active
                </button>
            ` : `
                <button class="btn btn-success" disabled title="Currently active">
                    ✓ Active
                </button>
            `}
            <button onclick="renameSavedTheme(${theme.id})" class="btn btn-sm btn-secondary" title="Rename this theme">
                ✏️ Rename
            </button>
            <button onclick="deleteSavedTheme(${theme.id})" class="btn btn-sm btn-danger" title="Delete this theme">
                🗑️ Delete
            </button>
        </div>
    `;
    
    return card;
}

// Extract preview colors from theme data
function extractPreviewColors(themeData) {
    const colors = [];
    
    try {
        // Try to extract some representative colors
        if (themeData.global) {
            const global = themeData.global;
            
            // Handle new format with colors object
            const globalColors = global.colors || global;
            
            if (globalColors['primary-color']) colors.push(globalColors['primary-color']);
            if (globalColors['secondary-color']) colors.push(globalColors['secondary-color']);
            if (globalColors['accent-color']) colors.push(globalColors['accent-color']);
            if (globalColors['page-background']) colors.push(globalColors['page-background']);
        }
        
        // If we don't have enough colors, add some defaults
        while (colors.length < 4) {
            colors.push('#e2e8f0');
        }
        
        return colors.slice(0, 4);
        
    } catch (error) {
        console.error('Error extracting preview colors:', error);
        return ['#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b'];
    }
}

// Capture current theme data from all sections
function captureCurrentThemeData() {
    const themeData = {};
    
    try {
        console.log('📸 Capturing theme data (Global Only)...');
        
        // Check if themeConfig exists
        if (typeof themeConfig === 'undefined' || !themeConfig.selectorMapping) {
            console.error('themeConfig or selectorMapping not defined');
            alert('Theme configuration not loaded. Please refresh the page.');
            return null;
        }
        
        // ONLY capture global section
        const sectionId = 'global';
        const sectionColors = {};
        const selectorMapping = themeConfig.selectorMapping[sectionId];
        
        if (!selectorMapping) {
            console.error('Global section not found in selectorMapping');
            return null;
        }
        
        // Iterate through categories (general, cards, buttons, etc.)
        Object.keys(selectorMapping).forEach(category => {
            const colorGroup = selectorMapping[category];
            
            // Iterate through color keys in each category
            Object.keys(colorGroup).forEach(colorKey => {
                // Use hex- prefix to match the actual input IDs
                const inputId = `hex-${sectionId}-${colorKey}`;
                const input = document.getElementById(inputId);
                
                if (input && input.value) {
                    sectionColors[colorKey] = input.value;
                    console.log(`  ✓ ${sectionId}.${colorKey} = ${input.value}`);
                }
            });
        });
        
        // Save ONLY global colors
        if (Object.keys(sectionColors).length > 0) {
            themeData.global = {
                colors: sectionColors
            };
            console.log(`✅ Captured ${Object.keys(sectionColors).length} global colors`);
        } else {
            console.warn('⚠️ No global colors captured');
            return null;
        }
        
        console.log('✅ Captured theme data (Global Only):', themeData);
        
        // Check if we captured anything
        if (Object.keys(themeData).length === 0) {
            console.warn('⚠️ No theme data captured - no color inputs found or all empty');
            return null;
        }
        
        return themeData;
        
    } catch (error) {
        console.error('❌ Error capturing theme data:', error);
        alert('Failed to capture theme data: ' + error.message);
        return null;
    }
}

// Save current theme with user-provided name
async function saveCurrentTheme() {
    try {
        // Get theme name from input
        const themeNameInput = document.getElementById('new-theme-name');
        
        if (!themeNameInput) {
            alert('Theme name input not found. Please refresh the page.');
            return;
        }
        
        const themeName = themeNameInput.value.trim();
        
        if (!themeName) {
            alert('Please enter a theme name');
            themeNameInput.focus();
            return;
        }
        
        // Check if name already exists
        const nameExists = savedThemesCache.some(theme => 
            theme.theme_name.toLowerCase() === themeName.toLowerCase()
        );
        
        if (nameExists) {
            const confirm = window.confirm(
                `A theme named "${themeName}" already exists. Do you want to save anyway?`
            );
            
            if (!confirm) return;
        }
        
        // Capture current theme data
        const themeData = captureCurrentThemeData();
        
        if (!themeData) {
            alert('Failed to capture current theme data');
            return;
        }
        
        // Check if should set as active
        const setActive = document.getElementById('set-active-on-save');
        const isActive = setActive ? setActive.checked : false;
        
        // Show loading message
        console.log('💾 Saving theme...');
        
        // Send to server
        const response = await fetch('/api/admin/saved-themes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                theme_name: themeName,
                theme_data: themeData,
                is_active: isActive
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to save theme');
        }
        
        console.log('✅ Theme saved successfully:', data);
        alert(`✅ Theme "${themeName}" saved successfully!`);
        
        // Clear form
        clearSaveThemeForm();
        
        // Reload saved themes
        await loadSavedThemes();
        
    } catch (error) {
        console.error('❌ Error saving theme:', error);
        alert('❌ Failed to save theme: ' + error.message);
    }
}

// Clear the save theme form
function clearSaveThemeForm() {
    const themeNameInput = document.getElementById('new-theme-name');
    const setActiveCheckbox = document.getElementById('set-active-on-save');
    
    if (themeNameInput) themeNameInput.value = '';
    if (setActiveCheckbox) setActiveCheckbox.checked = true;
}


// Apply theme data to color inputs
// APPLIES: ONLY Admin Overall (global) colors
// Individual page overrides remain untouched and apply automatically
function applyThemeData(themeData) {
    try {
        console.log('🎨 Applying theme data (Global Only)...', themeData);
        
        if (!themeData || typeof themeData !== 'object') {
            console.error('Invalid theme data:', themeData);
            return;
        }
        
        // Only process global section
        if (!themeData.global || !themeData.global.colors) {
            console.error('No global colors in theme data');
            return;
        }
        
        const globalColors = themeData.global.colors;
        let appliedCount = 0;
        
        console.log('  📂 Applying global colors...');
        
        // Make sure themeSettings has global section
        if (!themeSettings.global) {
            themeSettings.global = { useGlobal: false, colors: {} };
        }
        
        // Apply each color
        Object.keys(globalColors).forEach(colorKey => {
            const colorValue = globalColors[colorKey];
            
            // Update themeSettings (the actual data store)
            themeSettings.global.colors[colorKey] = colorValue;
            
            // Update both the color picker and hex input
            const colorPickerId = `color-global-${colorKey}`;
            const hexInputId = `hex-global-${colorKey}`;
            
            const colorPicker = document.getElementById(colorPickerId);
            const hexInput = document.getElementById(hexInputId);
            
            if (colorPicker && hexInput) {
                // Extract 6-digit hex for color picker (it doesn't support alpha)
                const sixDigitHex = colorValue.length === 9 ? colorValue.substring(0, 7) : colorValue;
                
                // Set both inputs
                colorPicker.value = sixDigitHex;
                hexInput.value = colorValue.toUpperCase();
                appliedCount++;
                
                console.log(`    ✓ ${colorKey} = ${colorValue}`);
            }
        });
        
        // Save to user-specific localStorage so it persists
        const currentUserId = sessionStorage.getItem('userId') || 
                             sessionStorage.getItem('loggedUser');
        if (currentUserId) {
            const storageKey = `adminThemeSettings_user_${currentUserId}`;
            localStorage.setItem(storageKey, JSON.stringify(themeSettings));
            console.log('💾 Saved applied theme to localStorage');
        } else {
            console.warn('⚠️ No user ID found - cannot save to localStorage');
        }
        
        // Apply the theme to the actual page elements
        // This respects individual page toggles automatically
        if (typeof applyThemeSettings === 'function') {
            console.log('🔧 Applying theme to page elements...');
            applyThemeSettings();
            console.log('ℹ️  Individual page overrides will apply on top if toggles are OFF');
        } else {
            console.error('applyThemeSettings function not found!');
        }
        
        console.log(`✅ Theme applied successfully (${appliedCount} global colors)`);
        
        if (appliedCount === 0) {
            console.warn('⚠️ No colors were applied - check if color input IDs match');
        }
        
    } catch (error) {
        console.error('❌ Error applying theme data:', error);
        throw error;
    }
}

// Set a saved theme as the active theme
// This is now the ONLY way to apply a saved theme (Load button removed)
async function activateSavedTheme(themeId) {
    try {
        const theme = savedThemesCache.find(t => t.id === themeId);
        
        if (!theme) {
            showNotification('Theme not found', 'error');
            return;
        }
        
        // Step 1: Show user what's about to happen
        console.log('🔄 Activating theme:', theme.theme_name);
        showNotification(`Applying "${theme.theme_name}"...`, 'info');
        
        // Step 2: Mark as active in database
        const response = await fetch(`/api/admin/saved-themes/${themeId}/activate`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to activate theme');
        }
        
        console.log('✅ Database updated - theme is now active');
        
        // Step 3: Apply the theme immediately to current page
        console.log('🎨 Applying theme to page...');
        applyThemeData(theme.theme_data);
        
        // Step 4: Reload saved themes UI to show new active state
        await loadSavedThemes();
        
        // Step 5: Success
        console.log('✅ Theme activation complete!');
        showNotification(`"${theme.theme_name}" is now your active theme!`, 'success');
        
    } catch (error) {
        console.error('❌ Error activating theme:', error);
        showNotification('Failed to activate theme: ' + error.message, 'error');
    }
}

// Rename a saved theme
async function renameSavedTheme(themeId) {
    try {
        const theme = savedThemesCache.find(t => t.id === themeId);
        
        if (!theme) {
            showNotification('Theme not found', 'error');
            return;
        }
        
        // Create rename modal
        const modal = createRenameModal(theme);
        document.body.appendChild(modal);
        
        // Focus input
        const input = modal.querySelector('#rename-theme-input');
        input.focus();
        input.select();
        
    } catch (error) {
        console.error('❌ Error renaming theme:', error);
        showNotification('Failed to rename theme: ' + error.message, 'error');
    }
}

// Create rename modal
function createRenameModal(theme) {
    const modal = document.createElement('div');
    modal.className = 'rename-theme-modal';
    modal.innerHTML = `
        <div class="rename-theme-content">
            <h3>✏️ Rename Theme</h3>
            <p>Enter a new name for "${escapeHtml(theme.theme_name)}"</p>
            
            <div class="form-group">
                <label for="rename-theme-input">New Theme Name *</label>
                <input 
                    type="text" 
                    id="rename-theme-input" 
                    value="${escapeHtml(theme.theme_name)}"
                    maxlength="100"
                />
            </div>
            
            <div class="rename-theme-actions">
                <button class="btn btn-secondary" onclick="closeRenameModal()">
                    Cancel
                </button>
                <button class="btn btn-primary" onclick="performRename(${theme.id})">
                    ✏️ Rename
                </button>
            </div>
        </div>
    `;
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeRenameModal();
        }
    });
    
    // Handle Enter key
    const input = modal.querySelector('#rename-theme-input');
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performRename(theme.id);
        }
    });
    
    return modal;
}

// Perform the rename operation
async function performRename(themeId) {
    try {
        const input = document.getElementById('rename-theme-input');
        const newName = input.value.trim();
        
        if (!newName) {
            showNotification('Please enter a theme name', 'error');
            input.focus();
            return;
        }
        
        // Check if name already exists (excluding current theme)
        const nameExists = savedThemesCache.some(theme => 
            theme.id !== themeId && theme.theme_name.toLowerCase() === newName.toLowerCase()
        );
        
        if (nameExists) {
            showNotification('A theme with this name already exists', 'error');
            input.focus();
            return;
        }
        
        const response = await fetch(`/api/admin/saved-themes/${themeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                theme_name: newName
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to rename theme');
        }
        
        console.log('✅ Theme renamed successfully');
        showNotification('Theme renamed successfully!', 'success');
        
        // Close modal
        closeRenameModal();
        
        // Reload saved themes
        await loadSavedThemes();
        
    } catch (error) {
        console.error('❌ Error renaming theme:', error);
        showNotification('Failed to rename theme: ' + error.message, 'error');
    }
}

// Close rename modal
function closeRenameModal() {
    const modal = document.querySelector('.rename-theme-modal');
    if (modal) {
        modal.remove();
    }
}

// Delete a saved theme
async function deleteSavedTheme(themeId) {
    try {
        const theme = savedThemesCache.find(t => t.id === themeId);
        
        if (!theme) {
            showNotification('Theme not found', 'error');
            return;
        }
        
        const confirm = await showConfirmDialog(
            'Delete Theme',
            `Are you sure you want to delete "${theme.theme_name}"? This action cannot be undone.`,
            'Delete',
            'danger'
        );
        
        if (!confirm) return;
        
        console.log('🗑️ Deleting theme:', theme.theme_name);
        
        const response = await fetch(`/api/admin/saved-themes/${themeId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete theme');
        }
        
        console.log('✅ Theme deleted successfully');
        showNotification(`Theme "${theme.theme_name}" deleted successfully!`, 'success');
        
        // Reload saved themes
        await loadSavedThemes();
        
    } catch (error) {
        console.error('❌ Error deleting theme:', error);
        showNotification('Failed to delete theme: ' + error.message, 'error');
    }
}

// Refresh saved themes list
async function refreshSavedThemes() {
    showNotification('Refreshing saved themes...', 'info');
    await loadSavedThemes();
    showNotification('Saved themes refreshed!', 'success');
}

// Load and apply the user's active theme on page load
// Call this function after successful login
async function loadActiveThemeOnLogin() {
    try {
        console.log('🔍 Checking for active theme...');
        
        const response = await fetch('/api/admin/saved-themes/active', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.warn('⚠️ Failed to load active theme:', data.error);
            applyDefaultTheme();
            // Still load individual page settings
            loadIndividualPageSettings();
            return;
        }
        
        if (data.theme) {
            console.log('✅ Active theme found:', data.theme.theme_name);
            
            // Apply theme data (global only)
            applyThemeData(data.theme.theme_data);
            
            // Load individual page settings after theme
            loadIndividualPageSettings();
            
            // Re-apply to ensure individual pages override
            if (typeof applyThemeSettings === 'function') {
                applyThemeSettings();
            }
            
            console.log('🎨 Active theme applied with individual page overrides');
        } else {
            console.log('ℹ️ No active theme set - applying default colors');
            applyDefaultTheme();
            // Still load individual page settings
            loadIndividualPageSettings();
        }
        
    } catch (error) {
        console.error('❌ Error loading active theme:', error);
        applyDefaultTheme();
        // Still load individual page settings
        loadIndividualPageSettings();
    }
}

function applyDefaultTheme() {
    try {
        console.log('🎨 Applying default theme colors...');
        
        // Check if getDefaultThemeSettings exists
        if (typeof getDefaultThemeSettings !== 'function') {
            console.error('getDefaultThemeSettings function not found');
            return;
        }
        
        // Get default theme settings
        themeSettings = getDefaultThemeSettings();
        
        // Apply the default theme to the page
        if (typeof applyThemeSettings === 'function') {
            applyThemeSettings();
            console.log('✅ Default theme colors applied');
        } else {
            console.error('applyThemeSettings function not found');
        }
        
    } catch (error) {
        console.error('❌ Error applying default theme:', error);
    }
}

// Initialize saved themes section when theme settings page loads
function initSavedThemesSection() {
    console.log('🎨 Initializing saved themes section...');
    
    // Check if user is logged in
    const loggedUser = sessionStorage.getItem('loggedUser');
    
    if (!loggedUser) {
        console.warn('⚠️ User not logged in. Skipping saved themes load.');
        return;
    }
    
    // Load saved themes
    loadSavedThemes();
}

// Show confirmation dialog
function showConfirmDialog(title, message, confirmText = 'Confirm', type = 'primary') {
    return new Promise((resolve) => {
        const confirmed = confirm(`${title}\n\n${message}`);
        resolve(confirmed);
    });
}
