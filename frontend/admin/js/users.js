// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 14 of 30: admin user management. Owner: shared.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ==================== 13. USER MANAGEMENT (UPDATED WITH SOFT DELETE 2026-01-09) ====================

// Track current user management tab
let currentUserTab = 'active'; // 'active' or 'deleted'

// Switch between active and deleted users tabs
function switchUserTab(tab) {
    currentUserTab = tab;
    
    // Update tab buttons
    const tabs = document.querySelectorAll('.user-tab');
    tabs.forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    // Show/hide sections
    const activeSection = document.getElementById('active-users-section');
    const deletedSection = document.getElementById('deleted-users-section');
    
    if (tab === 'active') {
        activeSection.style.display = 'block';
        deletedSection.style.display = 'none';
        loadActiveUsers();
    } else {
        activeSection.style.display = 'none';
        deletedSection.style.display = 'block';
        loadDeletedUsers();
    }
}

// Load user management data (wrapper function)
async function loadUserManagementData() {
    // Load based on current tab
    if (currentUserTab === 'active') {
        await loadActiveUsers();
    } else {
        await loadDeletedUsers();
    }
}

// Load active users
async function loadActiveUsers() {
    try {
        console.log('👤 Loading active users...');
        const response = await fetch('/api/admin/users');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Active users API response:', data);
        
        if (data.success && data.users) {
            updateActiveUsersTable(data.users);
        } else {
            alert('Error loading active users: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading active users:', error);
        alert('Error connecting to server: ' + error.message);
    }
}

// Load deleted users
async function loadDeletedUsers() {
    try {
        console.log('🗑️ Loading deleted users...');
        const response = await fetch('/api/admin/users/deleted');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Deleted users API response:', data);
        
        if (data.success && data.users) {
            updateDeletedUsersTable(data.users);
        } else {
            alert('Error loading deleted users: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading deleted users:', error);
        alert('Error connecting to server: ' + error.message);
    }
}

// Update active users table
function updateActiveUsersTable(usersData) {
    const tbody = document.getElementById('active-users-tbody');
    if (!tbody) {
        console.error('Active users table tbody not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!usersData || !Array.isArray(usersData) || usersData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
                    <div style="font-size: 48px; margin-bottom: 16px;">👤</div>
                    <h3 style="color: #64748b; margin-bottom: 10px;">No Active Users Found</h3>
                    <p>No active user data available.</p>
                    <button class="btn-primary" onclick="loadActiveUsers()" style="margin-top: 15px;">
                        Retry Loading
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    const currentUser = sessionStorage.getItem('loggedUser');
    const currentUserRole = sessionStorage.getItem('userRole');
    const isSystemAdmin = currentUserRole === 'system_admin';
    
    usersData.forEach(user => {
        const row = document.createElement('tr');
        
        const safeUser = {
            id: user.id || 0,
            username: user.username || 'Unknown',
            full_name: user.full_name || user.username || 'Unknown',
            role: user.role || 'IT_staff',
            department: user.department || 'IT',
            is_active: user.is_active !== undefined ? user.is_active : 1
        };
        
        const isCurrentUser = safeUser.username === currentUser;
        const isProtectedRootUser = safeUser.username === 'systemadmin';
        
        // MODIFIED LOGIC: Allow systemadmin to edit itself, but prevent others from editing systemadmin
        // - If it's the root account (systemadmin), only systemadmin itself can edit it
        // - If it's a regular account, any system_admin can edit it
        const canEdit = isSystemAdmin && (!isProtectedRootUser || isCurrentUser);
        
        // KEEP SAME: Cannot delete root account, cannot delete yourself
        const canDelete = isSystemAdmin && !isProtectedRootUser && !isCurrentUser;
        
        row.innerHTML = `
            <td>
                ${safeUser.username}
                ${isProtectedRootUser ? ' <span style="color: #10b981; font-size: 10px; margin-left: 5px;">(ROOT)</span>' : ''}
            </td>
            <td>${safeUser.full_name}</td>
            <td>${formatRoleName(safeUser.role)}</td>
            <td>${safeUser.department}</td>
            <td>
                <span class="badge ${safeUser.is_active ? 'badge-active' : 'badge-warning'}">
                    ${safeUser.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
            </td>
            <td>
                ${canEdit ? `
                    <button class="btn-edit" onclick="editUser(${safeUser.id}, '${safeUser.username}', '${safeUser.role}', '${safeUser.full_name.replace(/'/g, "\\'")}')">
                        ${isProtectedRootUser && isCurrentUser ? '🔐 Edit My Account' : 'Edit'}
                    </button>
                ` : ''}
                ${canDelete ? `
                    <button class="btn-delete" onclick="deleteUser(${safeUser.id}, '${safeUser.username}')">
                        Delete
                    </button>
                ` : ''}
                ${!canEdit && !canDelete ? `
                    <span class="text-muted font-size-12">${isProtectedRootUser ? '🔒 Protected' : 'No actions'}</span>
                ` : ''}
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Update deleted users table
function updateDeletedUsersTable(usersData) {
    const tbody = document.getElementById('deleted-users-tbody');
    if (!tbody) {
        console.error('Deleted users table tbody not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!usersData || !Array.isArray(usersData) || usersData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🗑️</div>
                    <h3 style="color: #64748b; margin-bottom: 10px;">No Deleted Users</h3>
                    <p>There are no deleted users to display.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    const currentUserRole = sessionStorage.getItem('userRole');
    const isSystemAdmin = currentUserRole === 'system_admin';
    
    usersData.forEach(user => {
        const row = document.createElement('tr');
        
        const safeUser = {
            id: user.id || 0,
            username: user.username || 'Unknown',
            full_name: user.full_name || user.username || 'Unknown',
            role: user.role || 'IT_staff',
            department: user.department || 'IT',
            is_active: user.is_active !== undefined ? user.is_active : 1,
            deleted_at: user.deleted_at,
            deleted_by: user.deleted_by || 'Unknown'
        };
        
        const isProtectedRootUser = safeUser.username === 'systemadmin';
        const canRestore = isSystemAdmin && !isProtectedRootUser;
        const canPermanentDelete = isSystemAdmin && !isProtectedRootUser;
        
        const deletedDate = safeUser.deleted_at ? new Date(safeUser.deleted_at).toLocaleDateString() : 'Unknown';
        
        row.innerHTML = `
            <td>
                ${safeUser.username}
                ${isProtectedRootUser ? ' <span style="color: #10b981; font-size: 10px; margin-left: 5px;">(ROOT)</span>' : ''}
            </td>
            <td>
                ${safeUser.full_name}
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                    Deleted: ${deletedDate} by ${safeUser.deleted_by}
                </div>
            </td>
            <td>${formatRoleName(safeUser.role)}</td>
            <td>${safeUser.department}</td>
            <td>
                <span class="badge badge-danger">
                    DELETED
                </span>
            </td>
            <td>
                ${canRestore ? `
                    <button class="btn-success" onclick="restoreUser(${safeUser.id}, '${safeUser.username}')" style="background: #10b981;">
                        🔄 Restore
                    </button>
                ` : ''}
                ${canPermanentDelete ? `
                    <button class="btn-delete" onclick="permanentDeleteUser(${safeUser.id}, '${safeUser.username}')">
                        🗑️ Permanent Delete
                    </button>
                ` : ''}
                ${!canRestore && !canPermanentDelete ? `
                    <span class="text-muted font-size-12">No actions</span>
                ` : ''}
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Legacy function for backward compatibility
function updateUserManagementTable(usersData) {
    updateActiveUsersTable(usersData);
}

// Add new user
function addUser() {
    const currentUserRole = sessionStorage.getItem('userRole');
    if (currentUserRole !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'add-user-modal';
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
        <div class="add-user-form" style="
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 90%;
            max-width: 500px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <h3 style="margin: 0; color: #1e293b; font-size: 20px;">Add New User</h3>
                <button onclick="closeAddUserModal()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                    padding: 5px 10px;
                ">×</button>
            </div>
            
            <form id="add-user-form" onsubmit="handleAddUser(event)">
                <div class="form-group" class="mb-20">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                        Username *
                    </label>
                    <input type="text" id="add-username" 
                        placeholder="Enter username"
                        style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;"
                        required>
                    <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                        Must be unique (lowercase letters, numbers, underscore)
                    </div>
                </div>
                
                <div class="form-group" class="mb-20">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                        Full Name *
                    </label>
                    <input type="text" id="add-full-name" 
                        placeholder="Enter full name"
                        style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;"
                        required>
                    <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                        This name will be displayed in the admin panel
                    </div>
                </div>
                
                <div class="form-group" class="mb-20">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                        Role *
                    </label>
                    <select id="add-user-role" style="
                        width: 100%;
                        padding: 12px 16px;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                        font-size: 15px;
                        background: white;
                    " required>
                        <option value="">Select a role</option>
                        <option value="system_admin">System Admin</option>
                        <option value="IT_admin">IT Admin</option>
                        <option value="IT_staff">IT Staff</option>
                    </select>
                    <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                        Select the user role and permissions
                    </div>
                </div>
                
                <div class="form-group" style="margin-bottom: 25px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                        Password *
                    </label>
                    <input type="password" id="add-user-password" 
                        placeholder="Enter secure password"
                        style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;"
                        required>
                    <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                        Minimum 8 characters recommended
                    </div>
                </div>
                
                <div id="add-user-error" style="
                    color: #dc2626;
                    font-size: 13px;
                    margin-bottom: 15px;
                    display: none;
                "></div>
                
                <div style="display: flex; gap: 12px;">
                    <button type="button" onclick="closeAddUserModal()" style="
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
                    ">Add User</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Handle add user form submission
async function handleAddUser(event) {
    event.preventDefault();
    
    const username = document.getElementById('add-username').value.trim();
    const fullName = document.getElementById('add-full-name').value.trim();
    const role = document.getElementById('add-user-role').value;
    const password = document.getElementById('add-user-password').value;
    const errorDiv = document.getElementById('add-user-error');
    
    // Validate inputs
    if (!username || !fullName || !role || !password) {
        errorDiv.textContent = 'All fields are required';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Validate username format
    if (!/^[a-z0-9_]+$/.test(username)) {
        errorDiv.textContent = 'Username must contain only lowercase letters, numbers, and underscores';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Validate password length
    if (password.length < 8) {
        errorDiv.textContent = 'Password must be at least 8 characters long';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-username': sessionStorage.getItem('loggedUser')
            },
            body: JSON.stringify({
                username,
                full_name: fullName,
                role,
                password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ User added successfully!');
            closeAddUserModal();
            loadActiveUsers(); // Reload active users
        } else {
            errorDiv.textContent = data.error || 'Failed to add user';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Error adding user:', error);
        errorDiv.textContent = 'Error connecting to server: ' + error.message;
        errorDiv.style.display = 'block';
    }
}

// Close add user modal
function closeAddUserModal() {
    const modal = document.querySelector('.add-user-modal');
    if (modal) {
        modal.remove();
    }
}

// This is the MODIFIED VERSION that allows systemadmin to edit their own password
function editUser(userId, username, currentRole, fullName) {
    const currentUserRole = sessionStorage.getItem('userRole');
    if (currentUserRole !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        return;
    }
    
    const currentUsername = sessionStorage.getItem('loggedUser');
    
    // MODIFIED: Check if systemadmin is editing themselves
    const isSystemAdminSelf = (username === 'systemadmin' && currentUsername === 'systemadmin');
    
    // Check if trying to edit protected root account (but allow self-edit)
    if (username === 'systemadmin' && !isSystemAdminSelf) {
        alert('⚠️ The root account "systemadmin" can only be edited by itself.\n\nPlease log in as systemadmin to change this account.');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'edit-user-modal';
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
    
    // MODIFIED: Different modal for systemadmin self-edit
    if (isSystemAdminSelf) {
        modal.innerHTML = `
            <div class="edit-user-form" style="
                background: white;
                padding: 30px;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                width: 90%;
                max-width: 500px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                    <h3 style="margin: 0; color: #1e293b; font-size: 20px;">🔐 Edit Root Account</h3>
                    <button onclick="closeEditUserModal()" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #64748b;
                        padding: 5px 10px;
                    ">×</button>
                </div>
                
                <div style="
                    background: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                ">
                    <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">
                        🛡️ Protected Root Account
                    </div>
                    <div style="font-size: 13px; color: #78350f;">
                        Username and role cannot be changed for security reasons.<br>
                        You can only update your password and display name.
                    </div>
                </div>
                
                <form id="edit-user-form" onsubmit="handleEditUser(event, ${userId}, true)">
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            Username (locked)
                        </label>
                        <input type="text" id="edit-username" 
                            value="${username}"
                            disabled
                            style="
                                width: 100%; 
                                padding: 12px 16px; 
                                border: 2px solid #e2e8f0; 
                                border-radius: 8px; 
                                font-size: 15px;
                                background: #f1f5f9;
                                color: #64748b;
                                cursor: not-allowed;
                            ">
                        <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                            🔒 Root username cannot be changed
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            Full Name
                        </label>
                        <input type="text" id="edit-full-name" 
                            value="${fullName || 'System Administrator'}"
                            placeholder="Enter full name"
                            style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;"
                            required>
                        <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                            This name will be displayed in the admin panel
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            Role (locked)
                        </label>
                        <select id="edit-user-role" disabled style="
                            width: 100%;
                            padding: 12px 16px;
                            border: 2px solid #e2e8f0;
                            border-radius: 8px;
                            font-size: 15px;
                            background: #f1f5f9;
                            color: #64748b;
                            cursor: not-allowed;
                        ">
                            <option value="system_admin" selected>System Admin</option>
                        </select>
                        <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                            🔒 Root role cannot be changed
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 25px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            New Password
                        </label>
                        <input type="password" id="edit-user-password" 
                            placeholder="Enter new password (leave blank to keep current)"
                            style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;">
                        <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                            ✅ You can update your password here (minimum 8 characters)
                        </div>
                    </div>
                    
                    <div id="edit-user-error" style="
                        color: #dc2626;
                        font-size: 13px;
                        margin-bottom: 15px;
                        display: none;
                    "></div>
                    
                    <div style="display: flex; gap: 12px;">
                        <button type="button" onclick="closeEditUserModal()" style="
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
                            background: linear-gradient(135deg, #0A1E81, #764ba2);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                        ">💾 Save Changes</button>
                    </div>
                </form>
            </div>
        `;
    } else {
        // STANDARD EDIT MODAL (for non-systemadmin users)
        modal.innerHTML = `
            <div class="edit-user-form" style="
                background: white;
                padding: 30px;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                width: 90%;
                max-width: 500px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                    <h3 style="margin: 0; color: #1e293b; font-size: 20px;">Edit User: ${username}</h3>
                    <button onclick="closeEditUserModal()" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #64748b;
                        padding: 5px 10px;
                    ">×</button>
                </div>
                
                <form id="edit-user-form" onsubmit="handleEditUser(event, ${userId}, false)">
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            Username
                        </label>
                        <input type="text" id="edit-username" 
                            value="${username}"
                            placeholder="Enter username"
                            style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;"
                            required>
                        <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                            Username can be changed (must be unique)
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            Full Name
                        </label>
                        <input type="text" id="edit-full-name" 
                            value="${fullName || ''}"
                            placeholder="Enter full name"
                            style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;"
                            required>
                        <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                            This name will be displayed in the admin panel
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            Role
                        </label>
                        <select id="edit-user-role" style="
                            width: 100%;
                            padding: 12px 16px;
                            border: 2px solid #e2e8f0;
                            border-radius: 8px;
                            font-size: 15px;
                            background: white;
                        ">
                            <option value="system_admin" ${currentRole === 'system_admin' ? 'selected' : ''}>System Admin</option>
                            <option value="IT_admin" ${currentRole === 'IT_admin' ? 'selected' : ''}>IT Admin</option>
                            <option value="IT_staff" ${currentRole === 'IT_staff' ? 'selected' : ''}>IT Staff</option>
                        </select>
                        <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                            Select the user role and permissions
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 25px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            New Password (optional)
                        </label>
                        <input type="password" id="edit-user-password" 
                            placeholder="Leave blank to keep current password"
                            style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;">
                        <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                            Only enter if you want to change the password
                        </div>
                    </div>
                    
                    <div id="edit-user-error" style="
                        color: #dc2626;
                        font-size: 13px;
                        margin-bottom: 15px;
                        display: none;
                    "></div>
                    
                    <div style="display: flex; gap: 12px;">
                        <button type="button" onclick="closeEditUserModal()" style="
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
                            background: linear-gradient(135deg, #0A1E81, #764ba2);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                        ">Save Changes</button>
                    </div>
                </form>
            </div>
        `;
    }
    
    document.body.appendChild(modal);
}

// Handle edit user form submission
async function handleEditUser(event, userId) {
    event.preventDefault();
    
    const username = document.getElementById('edit-username').value.trim();
    const fullName = document.getElementById('edit-full-name').value.trim();
    const role = document.getElementById('edit-user-role').value;
    const password = document.getElementById('edit-user-password').value;
    const errorDiv = document.getElementById('edit-user-error');
    
    // Validate inputs
    if (!username || !fullName || !role) {
        errorDiv.textContent = 'Username, display name, and role are required';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Validate username format
    if (!/^[a-z0-9_]+$/.test(username)) {
        errorDiv.textContent = 'Username must contain only lowercase letters, numbers, and underscores';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Validate password if provided
    if (password && password.length < 8) {
        errorDiv.textContent = 'Password must be at least 8 characters long';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const updateData = {
            username,
            full_name: fullName,
            role
        };
        
        // Only include password if provided
        if (password) {
            updateData.password = password;
        }
        
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-username': sessionStorage.getItem('loggedUser')
            },
            body: JSON.stringify(updateData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ User updated successfully!');
            closeEditUserModal();
            loadActiveUsers(); // Reload active users
        } else {
            errorDiv.textContent = data.error || 'Failed to update user';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Error updating user:', error);
        errorDiv.textContent = 'Error connecting to server: ' + error.message;
        errorDiv.style.display = 'block';
    }
}

// Close edit user modal
function closeEditUserModal() {
    const modal = document.querySelector('.edit-user-modal');
    if (modal) {
        modal.remove();
    }
}

// Delete user (soft delete)
async function deleteUser(userId, username) {
    const currentUserRole = sessionStorage.getItem('userRole');
    if (currentUserRole !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        return;
    }
    
    const currentUser = sessionStorage.getItem('loggedUser');
    
    // Check if trying to delete protected root account
    if (username === 'systemadmin') {
        alert('❌ The root account "systemadmin" cannot be deleted. This is a protected system account.');
        return;
    }
    
    // Check if trying to delete own account
    if (username === currentUser) {
        alert('⚠️ You cannot delete your own account!');
        return;
    }
    
    // inform user about soft delete
    if (confirm(`Are you sure you want to delete the user "${username}"?\n\n✅ This is a soft delete - the user will be moved to "Deleted Users" and can be restored later.`)) {
        await performUserDeletion(userId, username);
    }
}

// Perform user deletion (soft delete)
async function performUserDeletion(userId, username) {
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-username': sessionStorage.getItem('loggedUser')
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ User "${username}" has been moved to Deleted Users.\n\nYou can restore this user from the "Deleted Users" tab.`);
            loadActiveUsers(); // Reload active users
        } else {
            alert(`❌ Failed to delete user "${username}": ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert(`❌ Error deleting user "${username}": ${error.message}`);
    }
}

// Restore deleted user
async function restoreUser(userId, username) {
    const currentUserRole = sessionStorage.getItem('userRole');
    if (currentUserRole !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        return;
    }
    
    if (confirm(`Are you sure you want to restore the user "${username}"?\n\n✅ This will move them back to Active Users.`)) {
        try {
            const response = await fetch(`/api/admin/users/${userId}/restore`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-username': sessionStorage.getItem('loggedUser')
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert(`✅ User "${username}" has been restored successfully!`);
                loadDeletedUsers(); // Reload deleted users list
            } else {
                alert(`❌ Failed to restore user "${username}": ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error restoring user:', error);
            alert(`❌ Error restoring user "${username}": ${error.message}`);
        }
    }
}

// Permanently delete user (hard delete - cannot be undone)
async function permanentDeleteUser(userId, username) {
    const currentUserRole = sessionStorage.getItem('userRole');
    if (currentUserRole !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        return;
    }
    
    // Double confirmation for permanent deletion
    const firstConfirm = confirm(
        `⚠️ WARNING: PERMANENT DELETION\n\n` +
        `You are about to PERMANENTLY delete the user "${username}".\n\n` +
        `This action CANNOT be undone. The user data will be removed from the database forever.\n\n` +
        `Are you absolutely sure?`
    );
    
    if (!firstConfirm) {
        return;
    }
    
    const secondConfirm = confirm(
        `⚠️ FINAL CONFIRMATION\n\n` +
        `Type confirmation: Are you 100% sure you want to permanently delete "${username}"?\n\n` +
        `Click OK to permanently delete, or Cancel to abort.`
    );
    
    if (!secondConfirm) {
        alert('❌ Permanent deletion cancelled.');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}/permanent`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-username': sessionStorage.getItem('loggedUser')
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ User "${username}" has been permanently deleted from the database.`);
            loadDeletedUsers(); // Reload deleted users list
        } else {
            alert(`❌ Failed to permanently delete user "${username}": ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error permanently deleting user:', error);
        alert(`❌ Error permanently deleting user "${username}": ${error.message}`);
    }
}

// Helper function for fallback data (development only)
function getFallbackUsers() {
    return [
        {
            id: 1,
            username: 'systemadmin',
            full_name: 'System Administrator',
            role: 'system_admin',
            department: 'IT',
            is_active: 1
        }
    ];
}

// Helper function to format role names
function formatRoleName(role) {
    const roleMap = {
        'system_admin': 'System Admin',
        'IT_admin': 'IT Admin',
        'IT_staff': 'IT Staff'
    };
    return roleMap[role] || role;
}

