// =============================================================================
// pledgeDropdown.js - ESG pledge picker (the visitor picks a pledge, they do not type one)
//
// The page shows THREE dropdowns, one for each ESG group (Environmental, Social, Governance), each with
// its own colour bar. The visitor can choose only ONE pledge in total: picking something in one dropdown
// clears the other two.
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

// The preset the visitor has chosen (in whichever dropdown), or null if nothing is chosen yet
function getSelectedPledgePreset() {
    const chosen = getPledgeSelects().find((select) => select.value);
    if (!chosen) return null;
    return getPledgePresets().find((preset) => preset.id === chosen.value) || null;
}

// Colour the row that holds the choice and fade the other two
function updatePledgeRows() {
    const list = document.getElementById('pledge-esg-list');
    if (!list) return;
    let anyChosen = false;
    list.querySelectorAll('.pledge-esg-row').forEach((row) => {
        const select = row.querySelector('select');
        const isChosen = Boolean(select && select.value);
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
    const currentSelect = getPledgeSelects().find((select) => select.value);
    const previousChoice = currentSelect ? currentSelect.value : '';

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
        select.appendChild(new Option('Select a pledge...', '', true, true));
        group.forEach((preset) => select.appendChild(new Option(preset.title || preset.text, preset.id)));
        select.addEventListener('change', () => onPledgePresetChange(select));

        row.appendChild(label);
        row.appendChild(select);
        list.appendChild(row);
    });

    if (previousChoice) {
        const owner = getPledgeSelects().find((select) => Array.from(select.options).some((option) => option.value === previousChoice));
        if (owner) owner.value = previousChoice;
    }
    updatePledgeRows();
    updatePledgePreview();
}

// Show the full sentence, its ESG category and the badge it unlocks under the dropdowns
function updatePledgePreview() {
    const box = document.getElementById('pledge-preview');
    if (!box) return;

    const preset = getSelectedPledgePreset();
    if (!preset) {
        box.style.display = 'none';
        return;
    }

    const category = document.getElementById('pledge-preview-category');
    category.textContent = PLEDGE_CATEGORY_LABELS[preset.category];
    category.className = 'pledge-preview-category ' + preset.category;
    document.getElementById('pledge-preview-text').textContent = preset.text;
    document.getElementById('pledge-preview-focus').textContent =
        'Focus: ' + formatPledgeTopicLabel(preset.topic) + '. This pledge unlocks a passport badge.';
    box.style.display = 'block';
}

// Runs when the visitor picks something in one of the dropdowns
function onPledgePresetChange(changedSelect) {
    // Only ONE pledge in total: choosing here clears the other two dropdowns
    if (changedSelect && changedSelect.value) {
        getPledgeSelects().forEach((select) => {
            if (select !== changedSelect) select.value = '';
        });
    }

    clearValidationMessages();
    updatePledgeRows();
    updatePledgePreview();
    resetInactivityTimer();

    const preset = getSelectedPledgePreset();
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
            updatePledgeRows();
            updatePledgePreview();
        }, 0));
    }
}
