// =============================================================================
// pledgeDropdown.js - ESG pledge picker (the visitor picks a pledge, they do not type one)
//
// The page shows THREE dropdowns, one for each ESG group (Environmental, Social, Governance), each with
// its own colour bar. The admin can allow one pledge or multiple pledges.
//
// The list of pledges comes from the server (contentSettings.pledgePresets in the parameters, the same
// place the kiosk already loads its other texts from). Each pledge has:
//   id, category (environmental | social | governance), topic (the badge it unlocks), title, text
//
//   title = the short name shown in the dropdown
//   text  = the full pledge sentence. This is what gets saved and shown on the pledgeboard.
//
// The old typed-pledge fields (text box, topic checkboxes, Smart Pledge Coach) are still in the page but
// hidden, because other files still read and reset them. This picker is now the source of truth.
// =============================================================================

const PLEDGE_CATEGORY_LABELS = {
    environmental: 'Environmental',
    social: 'Social',
    governance: 'Governance'
};
const PLEDGE_CATEGORY_ORDER = ['environmental', 'social', 'governance'];

// The presets loaded from the server. Entries that are incomplete are ignored.
function getPledgePresets() {
    const presets = kioskParameters && kioskParameters.contentSettings
        ? kioskParameters.contentSettings.pledgePresets
        : null;
    if (!Array.isArray(presets)) return [];
    return presets.filter((preset) => preset && preset.id && preset.text
        && PLEDGE_TOPIC_LABELS[preset.topic] && PLEDGE_CATEGORY_LABELS[preset.category]);
}

// The three dropdowns, in order
function getPledgeSelects() {
    return Array.from(document.querySelectorAll('#pledge-esg-list .pledge-category-select'));
}

let selectedPledgeIds = [];

function allowsMultiplePledges() {
    return kioskParameters?.contentSettings?.allowMultiplePledges === true;
}

function getSelectedPledgePresets() {
    const byId = new Map(getPledgePresets().map(preset => [preset.id, preset]));
    return selectedPledgeIds.map(id => byId.get(id)).filter(Boolean);
}

function renderPledgeSelection() {
    const selected = getSelectedPledgePresets();
    const multiple = allowsMultiplePledges();
    for (const select of getPledgeSelects()) {
        select.value = multiple ? '' : (selected.find(preset => preset.category === select.dataset.category)?.id || '');
        for (const option of select.options) {
            option.disabled = multiple && selectedPledgeIds.includes(option.value);
        }
    }
    updatePledgeRows();
    updatePledgePreview();
}

// Colour the row that holds the choice and fade the other two
function updatePledgeRows() {
    const list = document.getElementById('pledge-esg-list');
    if (!list) return;
    let anyChosen = false;
    list.querySelectorAll('.pledge-esg-row').forEach((row) => {
        const isChosen = getSelectedPledgePresets().some(preset => preset.category === row.dataset.category);
        row.classList.toggle('chosen', isChosen);
        if (isChosen) anyChosen = true;
    });
    list.classList.toggle('has-choice', anyChosen);
}

// (Re)build the three dropdowns. Safe to call more than once: it keeps the current choice if it still exists.
function buildPledgeDropdown() {
    const list = document.getElementById('pledge-esg-list');
    if (!list) return;

    const presets = getPledgePresets();
    const multiple = allowsMultiplePledges();
    const available = new Set(presets.map(preset => preset.id));
    selectedPledgeIds = selectedPledgeIds.filter(id => available.has(id));
    if (!multiple) selectedPledgeIds = selectedPledgeIds.slice(0, 1);
    const hint = document.getElementById('pledge-pick-hint');
    if (hint) hint.textContent = multiple
        ? 'Choose a pledge to add it. You can add more from the same group or a different group.'
        : 'Pick one pledge from any one of the three groups.';

    list.innerHTML = '';
    list.classList.remove('has-choice');

    if (presets.length === 0) {
        const message = document.createElement('p');
        message.className = 'pledge-unavailable';
        message.textContent = 'Pledges are not available. Please ask staff.';
        list.appendChild(message);
        updatePledgePreview();
        return;
    }

    PLEDGE_CATEGORY_ORDER.forEach((category) => {
        const group = presets.filter((preset) => preset.category === category);
        if (group.length === 0) return;

        const row = document.createElement('div');
        row.className = 'pledge-esg-row ' + category;
        row.dataset.category = category;

        const label = document.createElement('label');
        label.className = 'pledge-esg-label';
        label.htmlFor = 'pledge-select-' + category;
        label.textContent = PLEDGE_CATEGORY_LABELS[category];

        const select = document.createElement('select');
        select.id = 'pledge-select-' + category;
        select.className = 'pledge-category-select';
        select.dataset.category = category;
        // The first option is the "nothing chosen" state. defaultSelected = true makes form.reset() come back to it.
        select.appendChild(new Option(multiple ? 'Add a pledge...' : 'Select a pledge...', '', true, true));
        group.forEach((preset) => select.appendChild(new Option(preset.title || preset.text, preset.id)));
        select.addEventListener('change', () => onPledgePresetChange(select));

        row.appendChild(label);
        row.appendChild(select);
        list.appendChild(row);
    });

    renderPledgeSelection();
}

// Show the full sentence, its ESG category and the badge it unlocks under the dropdowns
function updatePledgePreview() {
    const box = document.getElementById('pledge-preview');
    if (!box) return;

    const selected = getSelectedPledgePresets();
    const preset = selected[0];
    const selectedList = document.getElementById('pledge-selected-list');
    const multiple = allowsMultiplePledges();
    selectedList.replaceChildren();
    selectedList.hidden = !multiple;
    if (!preset) {
        box.style.display = 'none';
        return;
    }

    for (const id of ['pledge-preview-category', 'pledge-preview-text', 'pledge-preview-focus']) {
        document.getElementById(id).hidden = multiple;
    }
    if (multiple) {
        for (const item of selected) {
            const row = document.createElement('li');
            const copy = document.createElement('div');
            copy.className = 'pledge-selected-copy';
            const category = document.createElement('span');
            category.className = 'pledge-preview-category ' + item.category;
            category.textContent = PLEDGE_CATEGORY_LABELS[item.category];
            const label = document.createElement('p');
            label.textContent = item.text;
            copy.append(category, label);
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = 'Remove';
            remove.setAttribute('aria-label', `Remove ${item.title || item.text}`);
            remove.addEventListener('click', () => {
                selectedPledgeIds = selectedPledgeIds.filter(id => id !== item.id);
                renderPledgeSelection();
                getPledgeSelects().find(select => select.dataset.category === item.category)?.focus();
                resetInactivityTimer();
            });
            row.append(copy, remove);
            selectedList.appendChild(row);
        }
    } else {
        const category = document.getElementById('pledge-preview-category');
        category.textContent = PLEDGE_CATEGORY_LABELS[preset.category];
        category.className = 'pledge-preview-category ' + preset.category;
        document.getElementById('pledge-preview-text').textContent = preset.text;
        document.getElementById('pledge-preview-focus').textContent =
            'Focus: ' + formatPledgeTopicLabel(preset.topic) + '. This pledge unlocks a passport badge.';
    }
    box.style.display = 'block';
}

// Runs when the visitor picks something in one of the dropdowns
function onPledgePresetChange(changedSelect) {
    const id = changedSelect.value;
    if (allowsMultiplePledges()) {
        if (id && !selectedPledgeIds.includes(id)) selectedPledgeIds.push(id);
    } else {
        selectedPledgeIds = id ? [id] : [];
    }

    clearValidationMessages();
    renderPledgeSelection();
    resetInactivityTimer();
    const preset = getPledgePresets().find(item => item.id === id);
    if (preset) cheerRpBear('Great choice! That supports ' + formatPledgeTopicLabel(preset.topic) + '.');
}

// Called once when the page starts
function setupPledgeDropdown() {
    buildPledgeDropdown();

    // Every visitor reset runs form.reset(). That puts the dropdowns back to "Select a pledge...",
    // but it does not fire a change event, so the colours and the preview box have to be cleared here.
    const list = document.getElementById('pledge-esg-list');
    const form = list ? list.closest('form') : null;
    if (form && form.dataset.pledgeResetWired !== 'true') {
        form.dataset.pledgeResetWired = 'true';
        form.addEventListener('reset', () => setTimeout(() => {
            selectedPledgeIds = [];
            renderPledgeSelection();
        }, 0));
    }
}
