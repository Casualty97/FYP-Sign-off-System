// Owner: Role 3, Jun Kai. Previous team: Caeden (1).
// Part 9/30 of the admin page: pledge and content viewing (load order in admin.html).
// ==================== 9. PLEDGE & CONTENT VIEWING ====================

// Translate visitor-entered pledge or feedback answers to English for admin review (Done by Caeden)
async function translateAdminTextToEnglish(sourceId, outputId, button) {
    const source = document.getElementById(sourceId);
    const output = document.getElementById(outputId);
    const text = source?.textContent?.trim() || '';

    if (!text) {
        if (output) output.textContent = 'No text to translate.';
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = 'Translating...';
    }

    try {
        const response = await fetch('/api/admin/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text })
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Translation failed');
        }

        if (output) {
            output.textContent = data.translatedText || text;
            output.style.display = 'block';
        }
    } catch (error) {
        console.error('Translation error:', error);
        if (output) {
            output.textContent = error.message || 'Translation unavailable.';
            output.style.display = 'block';
        }
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = 'Translate to English';
        }
    }
}

// View pledge
function viewPledge(feedbackId, pledgeText) {
    if (pledgeText === undefined) {
        const row = findLoadedFeedbackRow(feedbackId);
        pledgeText = row ? (row.pledge || '') : '';
    }
    const popup = document.createElement('div');
    const pledgeSourceId = `pledge-source-${feedbackId}`;
    const pledgeTranslationId = `pledge-translation-${feedbackId}`;
    popup.className = 'pledge-popup';
    popup.style.cssText = `
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
    `;

    popup.innerHTML = `
        <div class="pledge-container" style="
            background: white;
            padding: 25px;
            border-radius: 12px;
            max-width: 600px;
            max-height: 80vh;
            width: 90vw;
            text-align: left;
            position: relative;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-shrink: 0;">
                <h3 style="margin: 0; color: #1e293b;">Pledge - ID: ${feedbackId}</h3>
                <button onclick="closePledgePopup()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                    padding: 5px 10px;
                ">×</button>
            </div>
            
            <div id="${pledgeSourceId}" style="
                background: #f8fafc;
                padding: 20px;
                border-radius: 8px;
                border: 2px solid #e2e8f0;
                margin-bottom: 20px;
                overflow-y: auto;
                flex: 1;
                white-space: pre-wrap;
                line-height: 1.6;
            ">
                 ${pledgeText ? escapeHtmlSafe(pledgeText) : 'No pledge text available'}
            </div>
            
            <button onclick="translateAdminTextToEnglish('${pledgeSourceId}', '${pledgeTranslationId}', this)" style="
                padding: 9px 14px;
                background: #475569;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                align-self: flex-start;
                flex-shrink: 0;
                margin-bottom: 12px;
            ">
                Translate to English
            </button>

            <div id="${pledgeTranslationId}" class="admin-translation-result" style="display: none;"></div>

            <div style="font-size: 12px; color: #64748b; margin-bottom: 15px; flex-shrink: 0;">
                Viewed by: ${sessionStorage.getItem('loggedUser')} at ${new Date().toLocaleTimeString()}
            </div>
            
            <button onclick="closePledgePopup()" style="
                padding: 10px 20px;
                background: #0A1E81;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                align-self: flex-end;
                flex-shrink: 0;
            ">
                Close
            </button>
        </div>
    `;

    document.body.appendChild(popup);
}

// Close pledge popup
function closePledgePopup() {
    const popup = document.querySelector('.pledge-popup');
    if (popup) {
        popup.remove();
    }
}

// View question answers
function viewQuestionAnswers(feedbackId) {
    const row = findLoadedFeedbackRow(feedbackId);
    if (!row) {
        alert('Feedback not found in the loaded table. Refresh the page and try again.');
        return;
    }
    createQuestionAnswersPopup(feedbackId, row.question_answers || []);
}

// The feedback and archive lists already carry question_answers, photo paths and the pledge
function findLoadedFeedbackRow(feedbackId) {
    const rows = [].concat(
        typeof allFeedbackData !== 'undefined' ? allFeedbackData : [],
        typeof allArchiveData !== 'undefined' ? allArchiveData : []
    );
    return rows.find(f => Number(f.id) === Number(feedbackId)) || null;
}

// Create Q&A popup
function createQuestionAnswersPopup(feedbackId, answers) {
    const popup = document.createElement('div');
    popup.className = 'qa-popup';
    popup.style.cssText = `
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
    `;

    const answersHtml = answers && answers.length > 0 
        ? answers.map((answer, index) => {
            const answerSourceId = `qa-answer-${feedbackId}-${index}`;
            const answerTranslationId = `qa-translation-${feedbackId}-${index}`;
            return `
            <div class="qa-item" style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0;">
                <div style="font-weight: 600; color: #1e293b; margin-bottom: 8px;">${escapeHtmlSafe(answer.question_text)}</div>
                <div id="${answerSourceId}" style="color: #475569; padding-left: 10px; border-left: 3px solid #e2e8f0;">
                    ${formatAnswer(answer.option_label || answer.answer_value, answer.question_type)}
                </div>
                <button onclick="translateAdminTextToEnglish('${answerSourceId}', '${answerTranslationId}', this)" style="
                    margin-top: 10px;
                    padding: 7px 12px;
                    background: #475569;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                ">Translate to English</button>
                <div id="${answerTranslationId}" class="admin-translation-result" style="display: none;"></div>
            </div>
        `;
        }).join('')
        : '<div style="color: #64748b; text-align: center; padding: 40px;">No question answers available</div>';

    popup.innerHTML = `
        <div class="qa-container" style="
            background: white;
            padding: 25px;
            border-radius: 12px;
            max-width: 700px;
            max-height: 80vh;
            width: 90vw;
            text-align: left;
            position: relative;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-shrink: 0;">
                <h3 style="margin: 0; color: #1e293b;">Questions & Answers - ID: ${feedbackId}</h3>
                <button onclick="closeQAPopup()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                    padding: 5px 10px;
                ">×</button>
            </div>
            
            <div style="
                overflow-y: auto;
                flex: 1;
                padding-right: 10px;
            ">
                ${answersHtml}
            </div>
            
            <div style="font-size: 12px; color: #64748b; margin-top: 20px; flex-shrink: 0;">
                Viewed by: ${sessionStorage.getItem('loggedUser')} at ${new Date().toLocaleTimeString()}
            </div>
            
            <button onclick="closeQAPopup()" style="
                margin-top: 20px;
                padding: 10px 20px;
                background: #0A1E81;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                align-self: flex-end;
                flex-shrink: 0;
            ">
                Close
            </button>
        </div>
    `;

    document.body.appendChild(popup);
}

// Format answer based on question type
function formatAnswer(answer, questionType) {
    if (!answer) return '<em>No answer provided</em>';
    const safeAnswer = escapeHtmlSafe(answer);
    
    switch(questionType) {
        case 'rating':
            const rating = parseInt(answer) || 0;
            // Display as number 1-5
            if (rating >= 1 && rating <= 5) {
                return `Rating: ${rating}/5`;
            } else {
                return `Rating: ${rating}`;
            }
        case 'yesno':
            return ['1', 'yes', 'true'].includes(String(answer).trim().toLowerCase()) ? 'Yes' : 'No';
        case 'choice':
            return safeAnswer;
        default:
            return safeAnswer;
    }
}

// Close Q&A popup
function closeQAPopup() {
    const popup = document.querySelector('.qa-popup');
    if (popup) {
        popup.remove();
    }
}

