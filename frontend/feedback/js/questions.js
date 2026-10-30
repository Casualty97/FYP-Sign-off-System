// Owner: Role 1, Zihan. Previous team: none marked.
// Part 9/17 of the feedback page: question loading and rendering (load order in feedback.html).
// ==================== 4. QUESTION MANAGEMENT FUNCTIONS ====================

// Load questions from the database
async function loadFeedbackQuestions() {
    try {
        const response = await fetch('/api/feedback/questions');
        const data = await response.json();
        
        if (data.success && data.questions.length > 0) {
            updateFeedbackForm(data.questions);
        } else {
            // Show message if no questions found
            showNoQuestionsMessage();
        }
    } catch (error) {
        console.error('Error loading questions:', error);
        showNoQuestionsMessage();
    }
}

// Update the feedback form with ALL questions from database
function updateFeedbackForm(questions) {
    const container = document.getElementById('questions-container');
    if (!container) {
        console.error('Questions container not found');
        return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    if (!questions || questions.length === 0) {
        console.log('No questions found');
        showNoQuestionsMessage();
        return;
    }
    
    console.log(`Loading ${questions.length} questions from database`);
    
    // Add ALL questions from database
    questions.forEach((question) => {
        if (!question.is_active) return;
        
        const questionNumber = question.display_order; 
        const questionElement = createQuestionElement(question, questionNumber);
        container.appendChild(questionElement);
    });
    
    // Add event listeners
    setTimeout(() => {
        initializeQuestionEventListeners();
    }, 100);
}

// Create question element based on question type
function createQuestionElement(question, questionNumber) {
    const questionGroup = document.createElement('div');
    questionGroup.className = 'question-group';
    questionGroup.setAttribute('data-question-id', question.id);
    
    const requiredIndicator = question.is_required ? ' *' : '';
    const translatedQuestionText = translateKnownDynamicText(question.question_text);
    const answerPlaceholder = getDynamicLanguageText().answerPlaceholder;
    
    let questionHTML = `
        <label class="question-label" data-question-number="${questionNumber}" data-original-text="${question.question_text}" data-required="${question.is_required ? 'true' : 'false'}">${questionNumber}. ${translatedQuestionText}${requiredIndicator}</label>
    `;
    
    // Generate appropriate input based on question type
    switch (question.question_type) {
        case 'text':
            questionHTML += `
                <textarea 
                    id="q${question.id}" 
                    name="q${question.id}" 
                    rows="4" 
                    placeholder="${answerPlaceholder}"  
                    ${question.is_required ? 'required' : ''}
                    oninput="resetInactivityTimer()"
                ></textarea>
            `;
            break;
            
        case 'yesno':
            questionHTML += `
                <div style="display: flex; gap: 15px; margin-top: 10px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input 
                            type="radio" 
                            name="q${question.id}" 
                            value="yes" 
                            ${question.is_required ? 'required' : ''}
                            onclick="resetInactivityTimer()"
                        >
                        <span data-dynamic-option data-original-text="Yes">${getDynamicLanguageText().yes}</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input 
                            type="radio" 
                            name="q${question.id}" 
                            value="no"
                            onclick="resetInactivityTimer()"
                        >
                        <span data-dynamic-option data-original-text="No">${getDynamicLanguageText().no}</span>
                    </label>
                </div>
            `;
            break;
            
        case 'rating':
            questionHTML += `
                <div class="rating-buttons" style="margin-top: 10px;">
                    ${[1, 2, 3, 4, 5].map(star => `
                        <button 
                            type="button" 
                            class="rating-btn question-rating" 
                            data-question-id="${question.id}"
                            data-rating="${star}"
                            onclick="selectQuestionRating(${question.id}, ${star}, this); resetInactivityTimer()"
                            ${question.is_required ? 'data-required="true"' : ''}
                        >
                            ${star}
                        </button>
                    `).join('')}
                </div>
                <input 
                    type="hidden" 
                    id="q${question.id}" 
                    name="q${question.id}" 
                    ${question.is_required ? 'required' : ''}
                >
            `;
            break;
            
        case 'choice':
            if (question.options && question.options.length > 0) {
                questionHTML += `
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
                        ${question.options.map(option => `
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input 
                                    type="radio" 
                                    name="q${question.id}" 
                                    value="${option.option_label}"
                                    ${question.is_required ? 'required' : ''}
                                    onclick="resetInactivityTimer()"
                                >
                                <span data-dynamic-option data-original-text="${option.option_label}">${translateKnownDynamicText(option.option_label)}</span>
                            </label>
                        `).join('')}
                    </div>
                `;
            }
            break;
            
        default:
            questionHTML += `
                <textarea 
                    id="q${question.id}" 
                    name="q${question.id}" 
                    rows="4" 
                    placeholder="${answerPlaceholder}" 
                    ${question.is_required ? 'required' : ''}
                    oninput="resetInactivityTimer()"
                ></textarea>
            `;
    }
    
    questionGroup.innerHTML = questionHTML;
    return questionGroup;
}

// Handle star rating selection for dynamic questions
function selectQuestionRating(questionId, rating, element) {
    // Remove selected class from all buttons in this question group
    const questionGroup = element.closest('.question-group');
    const buttons = questionGroup.querySelectorAll('.question-rating');
    buttons.forEach(btn => btn.classList.remove('selected'));
    
    // Add selected class to clicked button
    element.classList.add('selected');
    
    // Update the hidden input
    const hiddenInput = document.getElementById(`q${questionId}`);
    if (hiddenInput) {
        hiddenInput.value = rating;
    }
    
    console.log(`Selected rating ${rating} for question ${questionId}`);
}

// Initialize event listeners for dynamic questions
function initializeQuestionEventListeners() {
    console.log('Question event listeners initialized');
}

// Show message when no questions exist
function showNoQuestionsMessage() {
    const container = document.getElementById('questions-container');
    if (!container) return;
    const dynamicText = getDynamicLanguageText();
    
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #64748b;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px;">
                <circle cx="12" cy="12" r="10" stroke="#94a3b8" stroke-width="1.5"/>
                <path d="M12 8V12M12 16H12.01" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <h3 style="color: #475569; margin-bottom: 8px;">${dynamicText.noQuestionsTitle}</h3>
            <p>${dynamicText.noQuestionsDescription}</p>
        </div>
    `;
    
    // Disable submit button
    const submitBtn = document.querySelector('#feedback-page .consent-button');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = dynamicText.noQuestionsButton;
    }
}

// Helper function to determine question type
function getQuestionType(questionElement) {
    if (questionElement.querySelector('textarea')) return 'text';
    if (questionElement.querySelector('.question-rating')) return 'rating';
    if (questionElement.querySelector('input[type="radio"]')) {
        // Check if it's yes/no or multiple choice
        const radios = questionElement.querySelectorAll('input[type="radio"]');
        const values = Array.from(radios).map(radio => radio.value);
        if (values.includes('yes') && values.includes('no')) {
            return 'yesno';
        } else {
            return 'choice';
        }
    }
    return 'unknown';
}

// Validate that all required questions are answered
function validateRequiredQuestions() {
    if (getValidationRules().requiredQuestionsEnabled === false) {
        return true;
    }

    const requiredQuestions = document.querySelectorAll('#questions-container .question-group[data-question-id]');
    
    for (const question of requiredQuestions) {
        const questionId = question.getAttribute('data-question-id');
        const isRequired = question.querySelector('[required]') !== null;
        
        if (isRequired) {
            const questionType = getQuestionType(question);
            let hasAnswer = false;
            
            switch (questionType) {
                case 'text':
                    const textarea = question.querySelector('textarea');
                    hasAnswer = textarea && textarea.value.trim() !== '';
                    break;
                    
                case 'yesno':
                case 'choice':
                    const selectedRadio = question.querySelector('input[type="radio"]:checked');
                    hasAnswer = selectedRadio !== null;
                    break;
                    
                case 'rating':
                    const hiddenInput = question.querySelector('input[type="hidden"]');
                    hasAnswer = hiddenInput && hiddenInput.value !== '';
                    break;
            }
            
            if (!hasAnswer) {
                // Scroll to the question and highlight it
                question.scrollIntoView({ behavior: 'smooth', block: 'center' });
                question.classList.add('has-error');
                const label = question.querySelector('.question-label')?.textContent?.replace('*', '').trim() || 'this question';
                let error = question.querySelector('.field-error');
                if (!error) {
                    error = document.createElement('p');
                    error.className = 'field-error';
                    question.appendChild(error);
                }
                error.textContent = `Please answer ${label}.`;
                error.style.display = 'block';
                
                // Remove highlight after 3 seconds
                setTimeout(() => {
                    question.classList.remove('has-error');
                }, 3000);
                
                return false;
            }
        }
    }
    
    return true;
}

function getPledgeCoachDefaultSuggestion(topic) {
    return PLEDGE_COACH_TOPIC_SUGGESTIONS[topic] || 'Bring a reusable bottle for 3 school days this week.';
}

function hasPledgeTimeframe(text) {
    return /\b(today|tomorrow|daily|every day|this week|weekly|weekend|month|for \d+|[1-9]\d?\s*(day|days|week|weeks|time|times))\b/i.test(text);
}

function hasPledgeActionQuantity(text) {
    return /\b\d+\b/.test(text) || /\b(one|two|three|four|five|once|twice)\b/i.test(text);
}

function hasSpecificPledgeAction(text) {
    return /\b(bring|carry|use|reuse|recycle|sort|reduce|avoid|switch|turn off|save|walk|take|share|invite|finish|choose|buy|donate|volunteer|clean)\b/i.test(text);
}

function getPledgeQuality(text) {
    const hasText = Boolean(text.trim());
    const action = hasText && hasSpecificPledgeAction(text);
    const measure = hasText && hasPledgeActionQuantity(text);
    const timeframe = hasText && hasPledgeTimeframe(text);
    const score = [action, measure, timeframe].filter(Boolean).length;

    return {
        action,
        measure,
        timeframe,
        score,
        label: score === 3 ? 'Action-ready' : score === 2 ? 'Almost there' : score === 1 ? 'Good start' : 'Needs details'
    };
}

function getPledgeCoachReason(quality, suggestionMatchesText) {
    if (quality.score === 3 && suggestionMatchesText) {
        return 'Strong pledge: it has a clear action, measurable target, and timeframe.';
    }

    const missing = [];
    if (!quality.action) missing.push('a clear action');
    if (!quality.measure) missing.push('a measurable target');
    if (!quality.timeframe) missing.push('a timeframe');

    if (!missing.length) {
        return 'Better because it keeps the pledge clear and easy to try.';
    }

    return `Better because it adds ${missing.join(', ')}.`;
}

function buildSpecificPledgeSuggestion(rawText, topic) {
    const text = rawText.trim();
    if (!text) {
        return getPledgeCoachDefaultSuggestion(topic);
    }

    const cleaned = text
        .replace(/^i\s+(pledge|will|promise|want)\s+(to\s+)?/i, '')
        .replace(/[.!?]+$/g, '')
        .trim();

    if (!cleaned) {
        return getPledgeCoachDefaultSuggestion(topic);
    }

    if (/reusable bottle|water bottle|bottle/i.test(cleaned)) {
        return 'Bring a reusable bottle for 3 school days this week.';
    }
    if (/recycl|sort waste|waste/i.test(cleaned)) {
        return 'Sort my waste correctly after lunch 3 times this week.';
    }
    if (/food|leftover|finish/i.test(cleaned)) {
        return 'Take only what I can finish for 3 meals this week.';
    }
    if (/light|electric|charger|energy|switch/i.test(cleaned)) {
        return 'Switch off unused lights and chargers every day this week.';
    }
    if (/plastic|straw|bag|cup/i.test(cleaned)) {
        return 'Avoid single-use plastic for lunch 3 times this week.';
    }
    if (/friend|classmate|community|share/i.test(cleaned)) {
        return 'Share one sustainability habit with a friend this week.';
    }

    return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)} at least 3 times this week.`;
}

function updatePledgeCoach() {
    const textarea = document.getElementById('pledge-text');
    const topicSelect = document.getElementById('pledge-topic');
    const feedback = document.getElementById('pledge-coach-feedback');
    const suggestion = document.getElementById('pledge-coach-suggestion');
    const applyBtn = document.getElementById('apply-pledge-suggestion-btn');
    const score = document.getElementById('pledge-quality-score');
    const label = document.getElementById('pledge-quality-label');
    const fill = document.getElementById('pledge-quality-fill');
    const actionCheck = document.getElementById('pledge-check-action');
    const measureCheck = document.getElementById('pledge-check-measure');
    const timeCheck = document.getElementById('pledge-check-time');
    const reason = document.getElementById('pledge-coach-reason');

    if (!textarea || !feedback || !suggestion || !applyBtn) return;

    const text = textarea.value.trim();
    const selectedTopics = syncPledgeTopicField();
    const topic = selectedTopics[0] || (topicSelect ? topicSelect.value : '');
    const wordCount = text ? text.split(/\s+/).length : 0;
    const quality = getPledgeQuality(text);
    pledgeCoachSuggestion = buildSpecificPledgeSuggestion(text, topic);

    if (!text) {
        feedback.textContent = selectedTopics.length > 1
            ? `Good range. You selected ${selectedTopics.length} focus areas; write one action that connects them.`
            : topic
            ? 'Good topic. Start with one action, then make it specific enough to try this week.'
            : 'Choose a focus area or type a pledge. The coach will make it more specific.';
    } else if (wordCount < 4) {
        feedback.textContent = 'Nice start. Add a clear action so you know exactly what to do.';
    } else if (!hasPledgeActionQuantity(text) || !hasPledgeTimeframe(text)) {
        feedback.textContent = 'Make it more specific with a number and a timeframe.';
    } else {
        feedback.textContent = 'This is clear and actionable. You can use it as it is.';
        pledgeCoachSuggestion = text;
    }

    const suggestionMatchesText = pledgeCoachSuggestion === text;
    if (score) score.textContent = `Pledge strength: ${quality.score}/3`;
    if (label) label.textContent = quality.label;
    if (fill) fill.style.width = `${(quality.score / 3) * 100}%`;
    if (actionCheck) actionCheck.classList.toggle('complete', quality.action);
    if (measureCheck) measureCheck.classList.toggle('complete', quality.measure);
    if (timeCheck) timeCheck.classList.toggle('complete', quality.timeframe);
    if (reason) reason.textContent = getPledgeCoachReason(quality, suggestionMatchesText);

    suggestion.textContent = pledgeCoachSuggestion;
    applyBtn.disabled = !pledgeCoachSuggestion || suggestionMatchesText;
}

function applyPledgeCoachSuggestion() {
    const textarea = document.getElementById('pledge-text');
    const charCount = document.getElementById('char-count');
    if (!textarea || !pledgeCoachSuggestion) return;

    textarea.value = pledgeCoachSuggestion.slice(0, Number(textarea.maxLength) || 500);
    if (charCount) charCount.textContent = textarea.value.length;
    updatePledgeCoach();
    cheerRpBear('Nice pledge upgrade. That one is much easier to act on.');
    resetInactivityTimer();
}

