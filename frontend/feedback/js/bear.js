// Owner: Role 1, Zihan. Previous team: Nick (20).
// Part 2/17 of the feedback page: RP bear companion messages, flow progress helpers, bear behaviour (load order in feedback.html).
// Interactive RP teddy bear companion messages - changes made by nick
let rpBearSpeechTimer = null;
let rpBearInteractionCount = 0;
let rpBearLastPageId = null; // Guided companion page memory - changes made by nick
const RP_BEAR_PAGE_MESSAGES = {
    'details-page': 'Hi, I am Beary from RP. Add your name and email, then I will guide you onward.',
    'feedback-page': 'Time for feedback. Answer the cards honestly; quick answers are okay.',
    'pledge-page': 'Choose a focus and make one small pledge. I can suggest one if you tap a tip.',
    'photo-choice-page': 'Pick your keepsake moment. Photo, boomerang, upload, or skip all work.',
    'photo-page': 'Try a filter, look at the camera, then capture when you are ready.',
    'file-upload-page': 'Upload a clear photo and I will help you move to styling.',
    'style-page': 'Choose a frame you like. This is the memory we will email to you.',
    'confirmation-page': 'Final check. If everything looks good, submit and I will celebrate with you.',
    'thankyou-page': 'You did it. Thanks for adding your voice to the RP community.'
};
const RP_BEAR_TIPS = { // Step-by-step visitor guide tips - changes made by nick
    'details-page': [
        'Use the email you can check later so your keepsake reaches you.',
        'Your name helps personalize the visit summary.'
    ],
    'feedback-page': [
        'If a question has a star, answer it before continuing.',
        'For ratings, tap the option that feels closest. No overthinking needed.'
    ],
    'pledge-page': [
        'A strong pledge has an action, a number, and a timeframe.',
        'Example: Bring a reusable bottle for 3 school days this week.'
    ],
    'photo-choice-page': [
        'Boomerang creates a moving keepsake for your email.',
        'Skipping photo is okay; your feedback still counts.'
    ],
    'photo-page': [
        'Keep your face in the frame until the capture finishes.',
        'Swipe the filter tray to try different animated cosmetics.'
    ],
    'file-upload-page': [
        'Use a bright, clear image for the best frame result.',
        'After upload, choose a style for the final keepsake.'
    ],
    'style-page': [
        'The selected frame is applied before your email is sent.',
        'Boomerangs are saved as animated GIFs for email.'
    ],
    'confirmation-page': [
        'Check your email address before submitting.',
        'You can go back if anything needs changing.'
    ],
    'thankyou-page': [
        'Your email should arrive shortly if email sending is enabled.',
        'Tap home when you are ready for the next visitor.'
    ]
};
const RP_BEAR_LOCALIZED_MESSAGES = { // Multilingual RP guide messages (DONE BY NICK)
    zh: {
        'details-page': '你好，我是RP小熊。填好姓名和电邮，我会带你继续。',
        'feedback-page': '现在回答反馈问题。按真实想法选择就好。',
        'pledge-page': '选择一个环保重点，再写一个小承诺。',
        'photo-choice-page': '选择照片、动图、上传，或跳过照片。',
        'photo-page': '看向镜头，试试滤镜，准备好就拍照。',
        'file-upload-page': '上传清晰照片，然后继续选择样式。',
        'style-page': '选择你喜欢的相框，这会成为你的纪念照。',
        'confirmation-page': '最后检查一次。没问题就提交。',
        'thankyou-page': '完成了。谢谢你为RP社区发声。'
    },
    ms: {
        'details-page': 'Hai, saya Beary dari RP. Isi nama dan e-mel, kemudian saya bantu langkah seterusnya.',
        'feedback-page': 'Masa untuk maklum balas. Jawab dengan jujur dan ringkas.',
        'pledge-page': 'Pilih fokus dan tulis satu ikrar kecil yang boleh dibuat.',
        'photo-choice-page': 'Pilih foto, boomerang, muat naik, atau langkau foto.',
        'photo-page': 'Pandang kamera, cuba penapis, kemudian ambil foto.',
        'file-upload-page': 'Muat naik foto yang jelas, kemudian pilih gaya.',
        'style-page': 'Pilih bingkai kegemaran anda untuk kenangan ini.',
        'confirmation-page': 'Semak kali terakhir. Jika semuanya betul, hantar.',
        'thankyou-page': 'Selesai. Terima kasih kerana menyumbang kepada komuniti RP.'
    },
    ta: {
        'details-page': 'வணக்கம், நான் RP Beary. பெயரும் மின்னஞ்சலும் நிரப்புங்கள்; அடுத்த படிக்கு உதவுவேன்.',
        'feedback-page': 'இப்போது கருத்தை பகிருங்கள். உண்மையாகவும் சுருக்கமாகவும் பதிலளிக்கலாம்.',
        'pledge-page': 'ஒரு ESG கவனத்தைத் தேர்ந்து, சிறிய உறுதியை எழுதுங்கள்.',
        'photo-choice-page': 'புகைப்படம், பூமராங், பதிவேற்றம் அல்லது தவிர்க்கலாம்.',
        'photo-page': 'கேமராவை நோக்கி, வடிகட்டியை முயற்சி செய்து படம் எடுக்கவும்.',
        'file-upload-page': 'தெளிவான புகைப்படத்தை பதிவேற்றி, பாணியைத் தேர்ந்தெடுக்கவும்.',
        'style-page': 'உங்களுக்கு பிடித்த சட்டகத்தைத் தேர்ந்தெடுக்கவும்.',
        'confirmation-page': 'கடைசியாக சரிபார்க்கவும். சரி என்றால் சமர்ப்பிக்கவும்.',
        'thankyou-page': 'முடிந்தது. RP சமூகத்திற்காக உங்கள் குரலை பகிர்ந்ததற்கு நன்றி.'
    }
};
const RP_BEAR_LOCALIZED_TIPS = { // Multilingual RP guide tips (DONE BY NICK)
    zh: {
        'details-page': ['使用你能查看的电邮，这样纪念照会发送给你。'],
        'feedback-page': ['如果题目有星号，请先回答再继续。'],
        'pledge-page': ['好的承诺包含行动、数量和时间。'],
        'photo-page': ['拍摄结束前，请把脸保持在画面中。'],
        'style-page': ['选中的相框会用于最后的电邮纪念照。']
    },
    ms: {
        'details-page': ['Gunakan e-mel yang boleh anda semak supaya kenangan sampai kepada anda.'],
        'feedback-page': ['Jika soalan bertanda bintang, jawab dahulu sebelum teruskan.'],
        'pledge-page': ['Ikrar yang kuat ada tindakan, nombor dan tempoh masa.'],
        'photo-page': ['Pastikan muka anda dalam bingkai sehingga tangkapan selesai.'],
        'style-page': ['Bingkai yang dipilih akan digunakan dalam kenangan e-mel anda.']
    },
    ta: {
        'details-page': ['நினைவுப் படம் சேர வேண்டிய மின்னஞ்சலை பயன்படுத்துங்கள்.'],
        'feedback-page': ['நட்சத்திரம் உள்ள கேள்விக்கு தொடர்வதற்கு முன் பதிலளிக்கவும்.'],
        'pledge-page': ['வலுவான உறுதியில் செயல், எண், காலக்கெடு இருக்கும்.'],
        'photo-page': ['படம் எடுக்கும் வரை முகத்தை சட்டகத்துக்குள் வைத்திருக்கவும்.'],
        'style-page': ['தேர்ந்த சட்டகம் மின்னஞ்சல் நினைவில் பயன்படுத்தப்படும்.']
    }
};
const RP_BEAR_PAGE_ACTIONS = { // Interactive teddy guide quick actions - changes made by nick
    'details-page': [{ label: 'What next?', message: 'Fill in your details, then tap Continue to Feedback.' }],
    'feedback-page': [{ label: 'Help', message: 'Answer each visible question. I will point out anything missing.' }],
    'pledge-page': [{ label: 'Pledge tip', message: 'Try: I will do one clear action at least 3 times this week.' }],
    'photo-choice-page': [{ label: 'Boomerang?', message: 'Boomerang records a short moving keepsake and sends it as a GIF.' }],
    'photo-page': [{ label: 'Photo tip', message: 'Face the camera, stay still for a moment, then tap Capture.' }],
    'file-upload-page': [{ label: 'Upload tip', message: 'Choose a clear photo, then continue to style selection.' }],
    'style-page': [{ label: 'Style tip', message: 'Pick the frame you like best. I will remember it for the email.' }],
    'confirmation-page': [{ label: 'Check', message: 'Name, email, pledge, answers, and photo are ready for final submit.' }],
    'thankyou-page': [{ label: 'Yay', message: 'Thank you for finishing the visit. That was a smooth run.' }]
};
const RP_BEAR_CELEBRATIONS = [
    'Nice, that step is done.',
    'Good progress. I am right here with you.',
    'That was smooth. Next stop coming up.',
    'Great, you are moving through the form nicely.'
];

function getStepForPage(pageId) {
    return FLOW_STEPS.find(step => step.pageIds.includes(pageId));
}

function getFlowPageOrderIndex(pageId) {
    const index = FLOW_PAGE_IDS.indexOf(pageId);
    return index === -1 ? FLOW_PAGE_IDS.length : index;
}

function getVisibleFlowPageId() {
    return FLOW_PAGE_IDS.find(id => {
        const page = document.getElementById(id);
        return page && page.style.display !== 'none';
    }) || null;
}

function clearFlowSlideClasses(page) {
    if (!page) return;
    page.classList.remove(
        'flow-slide-transitioning',
        'flow-slide-enter-right',
        'flow-slide-enter-left',
        'flow-slide-exit-left',
        'flow-slide-exit-right'
    );
}

function shouldSkipFlowSlideTransition(currentPage, nextPage) {
    return !currentPage ||
        !nextPage ||
        currentPage === nextPage ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function updateProgressIndicator(activePageId) {
    const activeStep = getStepForPage(activePageId);
    if (!activeStep) return;

    const activeIndex = FLOW_STEPS.findIndex(step => step.key === activeStep.key);
    document.querySelectorAll('.step-progress').forEach(progress => {
        progress.querySelectorAll('.progress-step').forEach((stepEl, index) => {
            stepEl.classList.toggle('active', index === activeIndex);
            stepEl.classList.toggle('complete', index < activeIndex);
        });
    });
}

function getRpBearLanguageCode() { // Speech language mapping for RP guide (DONE BY NICK)
    const language = typeof currentLanguage === 'string' ? currentLanguage : 'en';
    return {
        en: 'en-SG',
        zh: 'zh-CN',
        ms: 'ms-MY',
        ta: 'ta-IN'
    }[language] || 'en-SG';
}

function getRpBearPageMessage(pageId) { // Multilingual RP guide message resolver (DONE BY NICK)
    const language = typeof currentLanguage === 'string' ? currentLanguage : 'en';
    return RP_BEAR_LOCALIZED_MESSAGES[language]?.[pageId] ||
        RP_BEAR_PAGE_MESSAGES[pageId] ||
        'I am here if you need a nudge.';
}

function speakRpBearMessage(message) { // Optional RP guide voice prompt (DONE BY NICK)
    if (!rpBearVoiceEnabled || !('speechSynthesis' in window) || !message) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = getRpBearLanguageCode();
    utterance.rate = 0.96;
    utterance.pitch = 1.04;
    window.speechSynthesis.speak(utterance);
}

function updateRpBearVoiceToggle() { // RP guide voice toggle UI (DONE BY NICK)
    const toggle = document.getElementById('rp-bear-voice-toggle');
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', rpBearVoiceEnabled ? 'true' : 'false');
    toggle.classList.toggle('active', rpBearVoiceEnabled);
    toggle.innerHTML = `
        <i class="fa-solid ${rpBearVoiceEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}" aria-hidden="true"></i>
        <span>Voice</span>
    `;
}

function toggleRpBearVoice() { // Visitor-controlled RP guide audio toggle (DONE BY NICK)
    rpBearVoiceEnabled = !rpBearVoiceEnabled;
    localStorage.setItem(RP_BEAR_VOICE_KEY, String(rpBearVoiceEnabled));
    updateRpBearVoiceToggle();
    setRpBearSpeech(rpBearVoiceEnabled ? 'Voice guide is on.' : 'Voice guide is off.', true);
}

function setRpBearSpeech(message, shouldPop = false) { // changes made by nick
    const companion = document.getElementById('rp-bear-companion');
    const speech = document.getElementById('rp-bear-speech');
    if (!companion || !speech) return;

    speech.textContent = message;
    speakRpBearMessage(message);
    companion.classList.add('is-speaking');

    if (shouldPop) {
        companion.classList.remove('is-excited', 'is-waving');
        void companion.offsetWidth;
        companion.classList.add('is-excited', 'is-waving');
    }

    if (rpBearSpeechTimer) {
        clearTimeout(rpBearSpeechTimer);
    }

    rpBearSpeechTimer = setTimeout(() => {
        companion.classList.remove('is-speaking', 'is-excited', 'is-waving');
        rpBearSpeechTimer = null;
    }, shouldPop ? 3600 : 2600);
}

function getRpBearStepText(pageId) { // changes made by nick
    const step = getStepForPage(pageId);
    if (!step) {
        return pageId === 'thankyou-page' ? 'Complete' : 'Guide';
    }

    const stepIndex = FLOW_STEPS.findIndex(item => item.key === step.key);
    return `Step ${stepIndex + 1} of ${FLOW_STEPS.length}: ${step.label}`;
}

function getRpBearTip(pageId) { // changes made by nick
    const language = typeof currentLanguage === 'string' ? currentLanguage : 'en';
    const tips = RP_BEAR_LOCALIZED_TIPS[language]?.[pageId] || RP_BEAR_TIPS[pageId] || ['Tap me any time for a small hint.'];
    const tipIndex = rpBearInteractionCount % tips.length;
    return tips[tipIndex];
}

function renderRpBearActions(pageId) { // changes made by nick
    const actions = document.getElementById('rp-bear-actions');
    if (!actions) return;

    const pageActions = RP_BEAR_PAGE_ACTIONS[pageId] || [{ label: 'Tip', message: getRpBearTip(pageId) }];
    actions.innerHTML = pageActions.map((action, index) => `
        <span
            class="rp-bear-action"
            data-bear-action-index="${index}"
        >${action.label}</span>
    `).join('');
}

function setRpBearMood(mood) { // changes made by nick
    const companion = document.getElementById('rp-bear-companion');
    if (!companion) return;
    companion.classList.remove('mood-thinking', 'mood-success', 'mood-alert');
    if (mood) companion.classList.add(`mood-${mood}`);
}

function cheerRpBear(message) { // changes made by nick
    setRpBearMood('success');
    setRpBearSpeech(message, true);
    setTimeout(() => setRpBearMood(null), 2400);
}

function nudgeRpBear(message) { // changes made by nick
    setRpBearMood('alert');
    setRpBearSpeech(message, true);
    setTimeout(() => setRpBearMood(null), 3000);
}

function updateRpBearCompanion(pageId) { // changes made by nick
    const companion = document.getElementById('rp-bear-companion');
    const progress = document.getElementById('rp-bear-progress');
    if (!companion) return;

    const shouldShow = FLOW_PAGE_IDS.includes(pageId);
    companion.hidden = !shouldShow;

    if (!shouldShow) {
        companion.classList.remove('is-speaking', 'is-excited', 'is-waving', 'mood-thinking', 'mood-success', 'mood-alert');
        rpBearLastPageId = null;
        return;
    }

    if (progress) progress.textContent = getRpBearStepText(pageId);
    renderRpBearActions(pageId);
    setRpBearMood(pageId === 'confirmation-page' ? 'thinking' : null);
    setRpBearSpeech(getRpBearPageMessage(pageId), pageId !== rpBearLastPageId);
    rpBearLastPageId = pageId;
}

function setupRpBearCompanion() { // changes made by nick
    const companion = document.getElementById('rp-bear-companion');
    if (!companion) return;

    companion.addEventListener('click', (event) => {
        const voiceToggle = event.target.closest('#rp-bear-voice-toggle');
        if (voiceToggle) {
            event.preventDefault();
            toggleRpBearVoice();
            resetInactivityTimer();
            return;
        }

        const actionTarget = event.target.closest('.rp-bear-action');
        const pageId = activeFlowPageId || getVisibleFlowPageId();
        if (actionTarget) {
            const pageActions = RP_BEAR_PAGE_ACTIONS[pageId] || [];
            const action = pageActions[Number(actionTarget.dataset.bearActionIndex)] || { message: getRpBearTip(pageId) };
            setRpBearSpeech(action.message, true);
            resetInactivityTimer();
            return;
        }

        const message = getRpBearTip(pageId);
        rpBearInteractionCount += 1;
        setRpBearSpeech(message, true);
        resetInactivityTimer();
    });

    companion.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            companion.click();
        }
    });

    updateRpBearVoiceToggle();
}

