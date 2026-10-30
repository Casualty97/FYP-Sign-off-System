// Admin page script, split from the former admin.js by section (move only, nothing changed inside).
// File 15 of 30: question management. Owner: Role 1.
// Load order (classic scripts, one shared global scope): core, audit, lostFound, dashboard, feedback, archive, feedbackFilters, encryption, pledgeViewer, analysis, photos, emailPopup, overlays, users, questions, dataExport, feedbackDeletion, navigation, tree, init, themes, archiveDeletion, pledgeboard, formUi, email, parameters, countdown, serverControl, vips, kioskReload.
// ============================================================
// OWNERSHIP (keep this block at the top and update it when you change the file)
// Previous team, inherited code: no markers in this file   <- counted from the "DONE BY" style markers below
// Current team owner: Role 1, Zihan. Add your name here when you change this file.
// Rules: one feature per pull request; edit shared files additively and tell the owner. See CONTRIBUTING.md.
// ============================================================
// ==================== 14. QUESTION MANAGEMENT ====================

// Load question management data
async function loadQuestionManagementData() {
    try {
        console.log('❓ Loading question management data...');
        const response = await fetch('/api/admin/questions');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Question API response:', data);
        
        if (data.success) {
            updateQuestionManagementTable(data.questions);
        } else {
            console.error('Failed to load question data:', data.error);
            alert('Error loading question data: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading question data:', error);
        alert('Error connecting to server. Please check if the server is running.');
    }
}

// Update question management table
function updateQuestionManagementTable(questionsData) {
    const container = document.getElementById('questions-container');
    if (!container) {
        console.error('Questions container not found');
        return;
    }
    
    container.innerHTML = '';
    
    if (!questionsData || questionsData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 40px; color: #64748b;">
                <div style="font-size: 64px; margin-bottom: 20px;">❓</div>
                <h3 style="color: #64748b; margin-bottom: 15px; font-size: 18px;">No Questions Found</h3>
                <p style="margin-bottom: 25px; line-height: 1.5;">
                    No questions have been set up yet. Add your first question to start collecting feedback.
                </p>
                <button class="btn-primary" onclick="showAddQuestionModal()">
                    Add First Question
                </button>
            </div>
        `;
        return;
    }
    
    // Store questions data in global map for access by edit function
    window.questionsDataMap.clear();
    
    questionsData.forEach(question => {
        // Store full question data in map
        window.questionsDataMap.set(question.id, question);
        
        const questionCard = document.createElement('div');
        questionCard.className = 'question-card';
        
        questionCard.innerHTML = `
            <div class="question-header">
                <div class="question-text">${question.question_text}</div>
                <div class="question-actions">
                    <button class="btn-edit" onclick="editQuestionById(${question.id})">Edit</button>
                    <button class="btn-delete" onclick="deleteQuestion(${question.id})">Delete</button>
                </div>
            </div>
            
            <div class="question-meta">
                <span class="question-type">${formatQuestionType(question.question_type)}</span>
                <span class="question-required">${question.is_required ? 'REQUIRED' : 'OPTIONAL'}</span>
                <span class="question-active">${question.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
                <span style="color: #64748b; font-size: 12px;">Order: ${question.display_order}</span>
            </div>
            
            ${question.options && question.options.length > 0 ? `
                <div class="question-options">
                    <strong style="font-size: 13px; color: #475569;">Options:</strong>
                    ${question.options.map(option => `
                        <div class="option-item">
                            <span class="option-label">${option.option_label}</span>
                            <span class="option-order">Order: ${option.display_order}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
        
        container.appendChild(questionCard);
    });
}

// Format question type for display
function formatQuestionType(type) {
    const typeMap = {
        'text': 'Text Input',
        'yesno': 'Yes/No',
        'rating': 'Rating (1-5)',
        'choice': 'Multiple Choice'
    };
    return typeMap[type] || type;
}

// Show add question modal
function showAddQuestionModal() {
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'add-question-modal';
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
        <div class="add-question-form" style="
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 90%;
            max-width: 500px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <h3 style="margin: 0; color: #1e293b; font-size: 20px;">Add New Question</h3>
                <button onclick="closeAddQuestionModal()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                    padding: 5px 10px;
                ">×</button>
            </div>
            
            <form id="add-question-form" onsubmit="handleAddQuestion(event)">
                <div class="form-group" class="mb-20">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                        Question Text *
                    </label>
                    <textarea id="question-text" 
                        placeholder="Enter your question here..."
                        style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px; min-height: 80px;"
                        required></textarea>
                </div>
                
                <div class="form-group" class="mb-20">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                        Question Type *
                    </label>
                    <select id="question-type" style="
                        width: 100%;
                        padding: 12px 16px;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                        font-size: 15px;
                        background: white;
                    " onchange="toggleOptionsField(this.value)" required>
                        <option value="">-- Select Question Type --</option>
                        <option value="text">Text Input</option>
                        <option value="yesno">Yes/No</option>
                        <option value="rating">Rating (1-5)</option>
                        <option value="choice">Multiple Choice</option>
                    </select>
                </div>
                
                <div id="options-container" style="display: none;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                        Options (for Multiple Choice only)
                    </label>
                    <div id="options-list" class="options-list">
                        <!-- Options will be added here dynamically -->
                    </div>
                    <button type="button" class="add-option" onclick="addOptionField()" style="
                        background: #f1f5f9;
                        border: 1px dashed #cbd5e1;
                        color: #475569;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        margin-top: 10px;
                        font-size: 14px;
                    ">+ Add Option</button>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div class="form-group">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            Display Order
                        </label>
                        <input type="number" id="display-order" 
                            value="0"
                            style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;"
                            min="0">
                    </div>
                    
                    <div class="form-group">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            Required
                        </label>
                        <select id="is-required" style="
                            width: 100%;
                            padding: 12px 16px;
                            border: 2px solid #e2e8f0;
                            border-radius: 8px;
                            font-size: 15px;
                            background: white;
                        ">
                            <option value="1">Yes</option>
                            <option value="0" selected>No</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group" style="margin-bottom: 25px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="is-active" checked style="width: 16px; height: 16px;">
                        <span style="font-weight: 600; color: #1e293b;">Active Question</span>
                    </label>
                    <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                        Inactive questions won't be shown in the feedback form
                    </div>
                </div>
                
                <div id="question-error" style="
                    color: #dc2626;
                    font-size: 13px;
                    margin-bottom: 15px;
                    display: none;
                "></div>
                
                <div style="display: flex; gap: 12px;">
                    <button type="button" onclick="closeAddQuestionModal()" style="
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
                    ">Add Question</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const optionsList = document.getElementById('options-list');
    optionsList.innerHTML = '';
}

// Close add question modal
function closeAddQuestionModal() {
    const modal = document.querySelector('.add-question-modal');
    if (modal) {
        modal.remove();
    }
    if (document.getElementById('questions-page').classList.contains('active')) {
        loadQuestionManagementData();
    }
}

// Toggle options field based on question type
function toggleOptionsField(questionType) {
    const optionsContainer = document.getElementById('options-container');
    const optionsList = document.getElementById('options-list');
    
    if (questionType === 'choice') {
        optionsContainer.style.display = 'block';
        if (optionsList.children.length === 0) {
            addOptionField();
        }
    } else {
        optionsContainer.style.display = 'none';
        optionsList.innerHTML = '';
    }
}

// Add option field
function addOptionField() {
    const optionsList = document.getElementById('options-list');
    const optionId = Date.now();
    
    const optionDiv = document.createElement('div');
    optionDiv.className = 'option-input-group';
    optionDiv.style.cssText = `
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
        align-items: center;
    `;
    
    optionDiv.innerHTML = `
        <input type="text" placeholder="Option label" 
            style="flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;"
            required>
        <input type="number" placeholder="Order" value="0" min="0"
            style="width: 80px; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
        <button type="button" class="remove-option" onclick="removeOptionField(this)" style="
            background: #fecaca;
            color: #dc2626;
            border: none;
            border-radius: 6px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 13px;
        ">Remove</button>
    `;
    
    optionsList.appendChild(optionDiv);
}

// Remove option field
function removeOptionField(button) {
    const optionGroup = button.parentElement;
    optionGroup.remove();
}

// Handle add question
async function handleAddQuestion(event) {
    event.preventDefault();
    
    const questionText = document.getElementById('question-text').value;
    const questionType = document.getElementById('question-type').value;
    const displayOrder = parseInt(document.getElementById('display-order').value) || 0;
    const isRequired = document.getElementById('is-required').value === '1';
    const isActive = document.getElementById('is-active').checked;
    const errorDiv = document.getElementById('question-error');
    
    errorDiv.style.display = 'none';
    
    if (!questionText.trim()) {
        errorDiv.textContent = 'Question text is required';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!questionType) {
        errorDiv.textContent = 'Please select a question type';
        errorDiv.style.display = 'block';
        return;
    }
    
    let options = [];
    
    if (questionType === 'choice') {
        const optionInputs = document.querySelectorAll('#options-list .option-input-group');
        if (optionInputs.length === 0) {
            errorDiv.textContent = 'At least one option is required for multiple choice questions';
            errorDiv.style.display = 'block';
            return;
        }
        
        optionInputs.forEach((group, index) => {
            const labelInput = group.querySelector('input[type="text"]');
            const orderInput = group.querySelector('input[type="number"]');
            
            if (labelInput.value.trim()) {
                options.push({
                    option_label: labelInput.value.trim(),
                    display_order: parseInt(orderInput.value) || index
                });
            }
        });
        
        if (options.length === 0) {
            errorDiv.textContent = 'At least one valid option is required for multiple choice questions';
            errorDiv.style.display = 'block';
            return;
        }
    }
    
    const username = sessionStorage.getItem('loggedUser');
    if (!username) {
        errorDiv.textContent = 'User session not found. Please login again.';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/admin/questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-username': username
            },
            body: JSON.stringify({
                question_text: questionText,
                question_type: questionType,
                display_order: displayOrder,
                is_required: isRequired,
                is_active: isActive,
                options: options
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Question added successfully!');
            closeAddQuestionModal();
            loadQuestionManagementData();
        } else {
            errorDiv.textContent = data.error || 'Failed to add question';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Error adding question:', error);
        errorDiv.textContent = 'Error adding question: ' + error.message;
        errorDiv.style.display = 'block';
    }
}


function editQuestionById(questionId) {
    const question = window.questionsDataMap.get(questionId);
    if (!question) {
        console.error('Question not found:', questionId);
        alert('Error: Question data not found. Please refresh the page.');
        return;
    }
    
    editQuestion(
        question.id,
        question.question_text,
        question.question_type,
        question.is_required,
        question.display_order,
        question.is_active,
        question.options || []
    );
}

// Edit question modal
function editQuestion(questionId, currentQuestionText, questionType, isRequired, displayOrder, isActive, options) {
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'edit-question-modal';
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
        <div class="edit-question-form" style="
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 90%;
            max-width: 500px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <h3 style="margin: 0; color: #1e293b; font-size: 20px;">Edit Question</h3>
                <button onclick="closeEditQuestionModal()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                    padding: 5px 10px;
                ">×</button>
            </div>
            
            <!-- DATA INTEGRITY WARNING -->
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="font-size: 16px;">💡</span>
                    <strong style="color: #92400e;">Safe Editing Enabled</strong>
                </div>
                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.4;">
                    <strong style="margin: 0; font-size: 13px; color: #3e3e3eff; line-height: 1.4;">Historical data protection:</strong> 
                    <p>
                        <strong style="color: #626262ff; font-size: 13px;">Existing answers will maintain their original question context. 
                    Changes only affect new submissions.</strong>
                    </p>
                </p>
            </div>
            
            <form id="edit-question-form" onsubmit="handleEditQuestion(event, ${questionId})">
                <div class="form-group" class="mb-20">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                        Question Text
                    </label>
                    <textarea id="edit-question-text" 
                        placeholder="Enter your question here..."
                        style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px; min-height: 80px;"
                        required>${currentQuestionText}</textarea>
                </div>
                
                <!-- QUESTION TYPE LOCKED -->
                <div class="form-group" class="mb-20">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                        Question Type
                    </label>
                    <input type="text" value="${formatQuestionType(questionType)}" 
                        style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px; background: #f8fafc;"
                        readonly>
                    <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                        Question type cannot be changed to preserve data integrity
                    </div>
                </div>
                
                ${questionType === 'choice' && options && options.length > 0 ? `
                <!-- OPTIONS DISPLAY ONLY -->
                <div class="mb-20">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                        Existing Options
                    </label>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px;">
                        ${options.map(option => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                                <span>${option.option_label}</span>
                                <span style="color: #64748b; font-size: 12px;">Order: ${option.display_order}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                        Options cannot be modified to preserve existing answer data
                    </div>
                </div>
                ` : ''}
                
                <!-- SAFE FIELDS TO EDIT -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div class="form-group">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            Display Order
                        </label>
                        <input type="number" id="edit-display-order" 
                            value="${displayOrder}"
                            style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px;"
                            min="0">
                    </div>
                    
                    <div class="form-group">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1e293b;">
                            Required
                        </label>
                        <select id="edit-is-required" style="
                            width: 100%;
                            padding: 12px 16px;
                            border: 2px solid #e2e8f0;
                            border-radius: 8px;
                            font-size: 15px;
                            background: white;
                        ">
                            <option value="1" ${isRequired ? 'selected' : ''}>Yes</option>
                            <option value="0" ${!isRequired ? 'selected' : ''}>No</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group" style="margin-bottom: 25px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="edit-is-active" ${isActive ? 'checked' : ''} style="width: 16px; height: 16px;">
                        <span style="font-weight: 600; color: #1e293b;">Active Question</span>
                    </label>
                    <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                        Inactive questions won't be shown in NEW feedback forms
                    </div>
                </div>
                
                <div id="edit-question-error" style="
                    color: #dc2626;
                    font-size: 13px;
                    margin-bottom: 15px;
                    display: none;
                "></div>
                
                <div style="display: flex; gap: 12px;">
                    <button type="button" onclick="closeEditQuestionModal()" style="
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
    
    document.body.appendChild(modal);
}

// Handle edit question
async function handleEditQuestion(event, questionId) {
    event.preventDefault();
    
    const questionText = document.getElementById('edit-question-text').value;
    const displayOrder = parseInt(document.getElementById('edit-display-order').value) || 0;
    const isRequired = document.getElementById('edit-is-required').value === '1';
    const isActive = document.getElementById('edit-is-active').checked;
    const errorDiv = document.getElementById('edit-question-error');
    
    errorDiv.style.display = 'none';
    
    if (!questionText.trim()) {
        errorDiv.textContent = 'Question text is required';
        errorDiv.style.display = 'block';
        return;
    }
    
    const username = sessionStorage.getItem('loggedUser');
    if (!username) {
        errorDiv.textContent = 'User session not found. Please login again.';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/questions/${questionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-username': username
            },
            body: JSON.stringify({
                question_text: questionText,
                display_order: displayOrder,
                is_required: isRequired,
                is_active: isActive
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Question updated successfully!\n\nNote: Existing answers will keep the original question text.');
            closeEditQuestionModal();
            loadQuestionManagementData();
        } else {
            errorDiv.textContent = data.error || 'Failed to update question';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Error updating question:', error);
        errorDiv.textContent = 'Error updating question: ' + error.message;
        errorDiv.style.display = 'block';
    }
}

// Close edit question modal
function closeEditQuestionModal() {
    const modal = document.querySelector('.edit-question-modal');
    if (modal) {
        modal.remove();
    }
}

// Delete question
async function deleteQuestion(questionId) {
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'system_admin') {
        alert('Access denied. System Administrator privileges required.');
        return;
    }
    
    if (confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
        try {
            const username = sessionStorage.getItem('loggedUser');
            if (!username) {
                alert('User session not found. Please login again.');
                return;
            }
            
            const response = await fetch(`/api/admin/questions/${questionId}`, {
                method: 'DELETE',
                headers: {
                    'x-username': username
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('✅ Question deleted successfully!');
                loadQuestionManagementData();
            } else {
                alert('❌ Failed to delete question: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting question:', error);
            alert('❌ Error deleting question: ' + error.message);
        }
    }
}

