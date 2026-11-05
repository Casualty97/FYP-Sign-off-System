// Owner: Role 3, Jun Kai. Previous team: Bernissa (2), Caeden (1).
// Part 28/30 of the admin page: server schedules and server control (load order in admin.html).
// ==================== 30. SERVER SCHEDULE MANAGEMENT (DONE BY BERNISSA) ====================

// <Jun Kai start>
// Policies since supervisor meeting 03 (4 Nov 2026): each one is Active (the kiosk runs) or Stop (the kiosk is off).
// The list order is the priority. The server places new policies and checks every save
// (backend/features/serverControl/policies.js); this page shows them, lets you drag them and previews the week.
let schedulesData = [];
let currentScheduleId = null;
let policyDrag = null;
let policyOrderSaving = false;
let policyFormTried = false;
let policyFormTimes = { start: '08:00', end: '18:00' };

const POLICY_DAYS = [[2, 'Mon'], [3, 'Tue'], [4, 'Wed'], [5, 'Thu'], [6, 'Fri'], [7, 'Sat'], [1, 'Sun']];
const POLICY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startServerStatusPolling() {
    if (window.statusCheckInterval) clearInterval(window.statusCheckInterval);
    window.statusCheckInterval = setInterval(checkServerStatus, 10000);
    if (window.automationStatusInterval) clearInterval(window.automationStatusInterval);
    window.automationStatusInterval = setInterval(() => {
        loadAutomationStatus();
        loadPolicyPreview();
    }, 60000);
}

document.addEventListener('DOMContentLoaded', function() {
    // Only when a session was restored; a fresh login goes through showPage('server-schedule')
    if (document.getElementById('server-schedule-page') && sessionStorage.getItem('loggedUser')) {
        loadSchedules();
        loadServerMode();
        checkServerStatus();
        startServerStatusPolling();
    }
});

// ---------------------------------------------------------------- wording
function policyNumbers(value) {
    return String(value === null || value === undefined ? '' : value).split(',').map((v) => Number(v.trim())).filter((n) => Number.isInteger(n) && n > 0);
}

const policyIsStop = (p) => p.action === 'stop';
const policyIsAllDay = (p) => p.all_day === true || (p.start_time === '00:00' && p.end_time === '00:00');

// Every weekday on its own, Monday first (meeting 03: no "Weekdays" group)
function policyDaysText(value) {
    const picked = policyNumbers(value);
    return POLICY_DAYS.filter(([n]) => picked.includes(n)).map(([, name]) => name).join(', ');
}

function policyMonthsText(value) {
    return policyNumbers(value).filter((n) => n <= 12).map((n) => POLICY_MONTHS[n - 1]).join(', ');
}

function policyDateText(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
    if (!m) return '';
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function policyRepeatText(p) {
    if (p.schedule_type === 'weekly') return policyDaysText(p.days_of_week) || 'No weekday picked';
    if (p.schedule_type === 'monthly') return `Every day in ${policyMonthsText(p.months) || 'no month'}`;
    if (p.schedule_type === 'specific_date') return policyDateText(p.specific_date) || 'No date picked';
    return 'Every day';
}

function policyHoursText(p) {
    if (policyIsAllDay(p)) return 'All day';
    return `${p.start_time}–${p.end_time}${String(p.end_time) <= String(p.start_time) ? ' next day' : ''}`;
}

// ---------------------------------------------------------------- list
function loadSchedules(highlightId) {
    return fetch('/api/admin/server-schedules', { cache: 'no-store' })
        .then((response) => response.json().then((data) => ({ response, data })))
        .then(({ response, data }) => {
            if (!response.ok || !data.success) throw new Error(data.error || 'Could not load the policies');
            schedulesData = data.schedules;
            renderPolicies(schedulesData);
            if (highlightId) flashPolicy(highlightId);
        })
        .catch((error) => {
            console.error('❌ Error loading policies:', error);
            const list = document.getElementById('policy-list');
            if (list) list.innerHTML = `<li class="policy-empty">${escapeHtmlSafe(error.message)}</li>`;
        })
        .finally(() => {
            loadAutomationStatus();
            loadPolicyPreview();
        });
}

function renderPolicies(list) {
    const ol = document.getElementById('policy-list');
    if (!ol) return;
    initPolicyDrag(ol);
    if (!list || !list.length) {
        ol.innerHTML = '<li class="policy-empty">No policies yet. Use New policy to set when the kiosk runs.</li>';
        return;
    }
    ol.innerHTML = list.map((p, i) => policyRowHtml(p, i, list.length)).join('');
}

function policyRowHtml(p, index, total) {
    const id = Number(p.id);
    const name = escapeHtmlSafe(p.schedule_name);
    const enabled = p.is_active !== false;
    return `<li class="policy-row${enabled ? '' : ' is-disabled'}" data-id="${id}">
            <button type="button" class="policy-handle" aria-label="Move ${name}, priority ${index + 1} of ${total}. Use the up and down arrow keys." title="Drag to change the priority">${uiIcon('grip', 16)}</button>
            <span class="policy-rank">${index + 1}</span>
            <div><div class="policy-name">${name}</div><div class="policy-meta">${escapeHtmlSafe(policyRepeatText(p))}</div></div>
            <div>${policyIsStop(p) ? uiPill('down', 'Stop') : uiPill('ok', 'Active')}</div>
            <div class="policy-hours">${escapeHtmlSafe(policyHoursText(p))}</div>
            <label class="ui-switch" title="${enabled ? 'Enabled' : 'Disabled'}"><input type="checkbox" ${enabled ? 'checked' : ''} onchange="toggleScheduleStatus(${id}, this.checked)" aria-label="${name} enabled"><span class="ui-switch-track"></span></label>
            <div class="policy-actions">
                <button type="button" class="ui-btn ui-btn-icon" onclick="editSchedule(${id})" title="Edit" aria-label="Edit ${name}">${uiIcon('edit')}</button>
                <button type="button" class="ui-btn ui-btn-icon ui-danger" onclick="deleteSchedule(${id})" title="Delete" aria-label="Delete ${name}">${uiIcon('trash')}</button>
            </div>
        </li>`;
}

function flashPolicy(id) {
    const row = document.querySelector(`#policy-list .policy-row[data-id="${Number(id)}"]`);
    if (!row) return;
    row.classList.remove('is-new');
    row.getBoundingClientRect();
    row.classList.add('is-new');
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function policyRows(ol) {
    return [...ol.querySelectorAll('.policy-row')];
}

function renumberPolicies(ol) {
    const rows = policyRows(ol);
    rows.forEach((row, i) => {
        const rank = row.querySelector('.policy-rank');
        if (rank) rank.textContent = String(i + 1);
        const handle = row.querySelector('.policy-handle');
        const name = row.querySelector('.policy-name');
        if (handle && name) handle.setAttribute('aria-label', `Move ${name.textContent}, priority ${i + 1} of ${rows.length}. Use the up and down arrow keys.`);
    });
}

// ---------------------------------------------------------------- form
function showAddScheduleModal() {
    currentScheduleId = null;
    fillPolicyForm({ schedule_name: '', action: 'active', schedule_type: 'daily', start_time: '08:00', end_time: '18:00', is_active: true });
    openPolicyModal('New policy', 'Create policy');
}

function editSchedule(scheduleId) {
    const policy = schedulesData.find((s) => Number(s.id) === Number(scheduleId));
    if (!policy) return;
    currentScheduleId = policy.id;
    fillPolicyForm(policy);
    openPolicyModal('Edit policy', 'Save changes');
}

function openPolicyModal(title, submitText) {
    const modal = document.getElementById('schedule-modal');
    if (!modal) return;
    modal.querySelector('.modal-title').textContent = title;
    modal.querySelector('.modal-submit-btn').textContent = submitText;
    policyFormTried = false;
    updateFormFields();
    modal.style.display = 'block';
    setTimeout(() => {
        const name = document.getElementById('schedule-name');
        if (name) name.focus();
    }, 30);
}

function fillPolicyForm(p) {
    const allDay = policyIsAllDay(p);
    document.getElementById('schedule-name').value = p.schedule_name || '';
    document.querySelectorAll('#schedule-form input[name="policy-action"]').forEach((radio) => { radio.checked = radio.value === (policyIsStop(p) ? 'stop' : 'active'); });
    document.getElementById('schedule-type').value = p.schedule_type || 'daily';
    const days = policyNumbers(p.days_of_week);
    document.querySelectorAll('#schedule-form input[name="day"]').forEach((box) => { box.checked = days.includes(Number(box.value)); });
    const months = policyNumbers(p.months);
    document.querySelectorAll('#schedule-form input[name="month"]').forEach((box) => { box.checked = months.includes(Number(box.value)); });
    document.getElementById('specific-date').value = /^\d{4}-\d{2}-\d{2}/.test(String(p.specific_date || '')) ? String(p.specific_date).slice(0, 10) : '';
    const start = document.getElementById('start-time');
    const end = document.getElementById('end-time');
    start.disabled = false;
    end.disabled = false;
    start.value = allDay ? '08:00' : (p.start_time || '08:00');
    end.value = allDay ? '18:00' : (p.end_time || '18:00');
    policyFormTimes = { start: start.value, end: end.value };
    document.getElementById('policy-all-day').checked = allDay;
    document.getElementById('is-active').checked = p.is_active !== false;
}

function readPolicyForm() {
    const type = document.getElementById('schedule-type').value;
    const ticked = (name) => [...document.querySelectorAll(`#schedule-form input[name="${name}"]:checked`)].map((box) => Number(box.value)).sort((a, b) => a - b);
    const action = document.querySelector('#schedule-form input[name="policy-action"]:checked');
    return {
        schedule_name: document.getElementById('schedule-name').value.trim(),
        action: action && action.value === 'stop' ? 'stop' : 'active',
        schedule_type: type,
        days_of_week: type === 'weekly' ? ticked('day').join(',') : '',
        months: type === 'monthly' ? ticked('month').join(',') : '',
        specific_date: type === 'specific_date' ? document.getElementById('specific-date').value : null,
        all_day: document.getElementById('policy-all-day').checked,
        start_time: document.getElementById('start-time').value,
        end_time: document.getElementById('end-time').value,
        is_active: document.getElementById('is-active').checked
    };
}

function policyFormProblem(p) {
    if (!p.schedule_name) return 'Give the policy a name.';
    if (p.schedule_type === 'weekly' && !p.days_of_week) return 'Pick at least one weekday.';
    if (p.schedule_type === 'monthly' && !p.months) return 'Pick at least one month.';
    if (p.schedule_type === 'specific_date' && !p.specific_date) return 'Pick the date.';
    if (!p.all_day && (!p.start_time || !p.end_time)) return 'Set both times, or tick All day.';
    if (!p.all_day && p.start_time === p.end_time) return 'Start and stop cannot be the same time. Tick All day for a whole day.';
    return null;
}

// Keeps the form in step with the choices and says in words what the policy will do
function updateFormFields() {
    const type = document.getElementById('schedule-type');
    if (!type) return;
    document.getElementById('weekly-days-section').hidden = type.value !== 'weekly';
    document.getElementById('monthly-section').hidden = type.value !== 'monthly';
    document.getElementById('specific-date-section').hidden = type.value !== 'specific_date';
    const allDay = document.getElementById('policy-all-day').checked;
    const start = document.getElementById('start-time');
    const end = document.getElementById('end-time');
    if (allDay && !start.disabled) {
        policyFormTimes = { start: start.value, end: end.value };
        start.value = '00:00';
        end.value = '00:00';
    } else if (!allDay && start.disabled) {
        const keep = policyFormTimes.start && policyFormTimes.start !== policyFormTimes.end;
        start.value = keep ? policyFormTimes.start : '08:00';
        end.value = keep ? policyFormTimes.end : '18:00';
    }
    start.disabled = allDay;
    end.disabled = allDay;

    const box = document.getElementById('policy-summary');
    if (!box) return;
    const p = readPolicyForm();
    const problem = policyFormProblem(p);
    if (policyFormTried && problem) {
        box.textContent = problem;
        box.classList.add('is-error');
        return;
    }
    box.classList.remove('is-error');
    const when = {
        daily: 'every day',
        weekly: `on ${policyDaysText(p.days_of_week) || 'the weekdays you pick'}`,
        monthly: `every day in ${policyMonthsText(p.months) || 'the months you pick'}`,
        specific_date: `on ${policyDateText(p.specific_date) || 'the date you pick'}`
    }[p.schedule_type];
    const hours = p.all_day ? 'all day' : `from ${p.start_time || '--:--'} to ${p.end_time || '--:--'}${p.end_time && p.start_time && p.end_time <= p.start_time ? ' the next day' : ''}`;
    let text = p.action === 'stop'
        ? `The kiosk stays off ${when}, ${hours}, even when an Active policy covers that time.`
        : `The kiosk runs ${when}, ${hours}.`;
    if (!p.is_active) text += ' It is saved as disabled, so it does nothing until you enable it.';
    box.textContent = text;
}

function policyPlacementMessage(data, created) {
    const name = data.schedule ? `"${data.schedule.schedule_name}"` : 'The policy';
    if (data.placedAbove) return `${name} is priority ${data.position} of ${data.total}, above "${data.placedAbove}": ${data.reason}.`;
    if (created || data.moved) return `${name} is priority ${data.position} of ${data.total}.`;
    return `${name} saved.`;
}

function saveSchedule() {
    const policy = readPolicyForm();
    const problem = policyFormProblem(policy);
    if (problem) {
        policyFormTried = true;
        updateFormFields();
        showNotification(problem, 'error');
        return;
    }
    const created = !currentScheduleId;
    const button = document.querySelector('#schedule-modal .modal-submit-btn');
    if (button) button.disabled = true;
    fetch(created ? '/api/admin/server-schedules' : `/api/admin/server-schedules/${currentScheduleId}`, {
        method: created ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy)
    })
        .then((response) => response.json().then((data) => ({ response, data })))
        .then(({ response, data }) => {
            if (!response.ok || !data.success) throw new Error(data.error || 'Could not save the policy');
            closeModal('schedule-modal');
            showNotification(policyPlacementMessage(data, created), 'success');
            return loadSchedules(data.schedule && data.schedule.id);
        })
        .catch((error) => {
            console.error('❌ Error saving policy:', error);
            showNotification(error.message, 'error');
        })
        .finally(() => {
            if (button) button.disabled = false;
        });
}

function policyRequest(url, options, failure) {
    return fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options })
        .then((response) => response.json().then((data) => ({ response, data })))
        .then(({ response, data }) => {
            if (!response.ok || !data.success) throw new Error(data.error || failure);
            return data;
        });
}

function deleteSchedule(scheduleId) {
    const policy = schedulesData.find((s) => Number(s.id) === Number(scheduleId));
    if (!confirm(`Delete "${policy ? policy.schedule_name : 'this policy'}"? This cannot be undone.`)) return;
    policyRequest(`/api/admin/server-schedules/${scheduleId}`, { method: 'DELETE' }, 'Could not delete the policy')
        .then(() => {
            showNotification('Policy deleted', 'success');
            loadSchedules();
        })
        .catch((error) => showNotification(error.message, 'error'));
}

function toggleScheduleStatus(scheduleId, newStatus) {
    const policy = schedulesData.find((s) => Number(s.id) === Number(scheduleId));
    policyRequest(`/api/admin/server-schedules/${scheduleId}/toggle`, { method: 'PUT', body: JSON.stringify({ is_active: !!newStatus }) }, 'Could not change the policy')
        .then(() => {
            showNotification(`"${policy ? policy.schedule_name : 'Policy'}" ${newStatus ? 'enabled' : 'disabled'}`, 'success');
            loadSchedules();
        })
        .catch((error) => {
            showNotification(error.message, 'error');
            loadSchedules();
        });
}

function enableAllSchedules() {
    if (!confirm('Enable every policy?')) return;
    policyRequest('/api/admin/server-schedules/enable-all', { method: 'POST' }, 'Could not enable the policies')
        .then((data) => {
            showNotification(`${data.enabled_count} polic${data.enabled_count === 1 ? 'y' : 'ies'} enabled`, 'success');
            loadSchedules();
        })
        .catch((error) => showNotification(error.message, 'error'));
}

function disableAllSchedules() {
    if (!confirm('Disable every policy? The kiosk then has no hours in automatic mode.')) return;
    policyRequest('/api/admin/server-schedules/disable-all', { method: 'POST' }, 'Could not disable the policies')
        .then((data) => {
            showNotification(`${data.disabled_count} polic${data.disabled_count === 1 ? 'y' : 'ies'} disabled`, 'success');
            loadSchedules();
        })
        .catch((error) => showNotification(error.message, 'error'));
}

function resetPolicyOrder() {
    if (!confirm('Put every policy back in the default order? Single dates go first, then weekdays, months and every day, with Stop above Active. Orders you dragged by hand are lost.')) return;
    policyRequest('/api/admin/server-schedules/reorder', { method: 'POST', body: JSON.stringify({ order: 'default' }) }, 'Could not reset the order')
        .then((data) => {
            schedulesData = data.schedules;
            renderPolicies(schedulesData);
            showNotification('Policies are back in the default order', 'success');
            loadAutomationStatus();
            loadPolicyPreview();
        })
        .catch((error) => showNotification(error.message, 'error'));
}

// ---------------------------------------------------------------- drag and keyboard reordering
function initPolicyDrag(ol) {
    if (ol.dataset.dragReady) return;
    ol.dataset.dragReady = '1';
    ol.addEventListener('pointerdown', policyPointerDown);
    ol.addEventListener('keydown', policyKeyDown);
}

// Moves rows with a short slide: measure, change the DOM, then animate each row from its old place
function policyFlip(ol, still, change) {
    const rows = policyRows(ol).filter((row) => row !== still);
    const before = new Map(rows.map((row) => [row, row.offsetTop]));
    change();
    for (const row of rows) {
        const delta = before.get(row) - row.offsetTop;
        if (!delta) continue;
        row.style.transition = 'none';
        row.style.transform = `translateY(${delta}px)`;
        row.getBoundingClientRect();
        row.style.transition = 'transform 160ms ease';
        row.style.transform = '';
    }
}

function policyPointerDown(event) {
    const handle = event.target.closest('.policy-handle');
    if (!handle || event.button !== 0 || policyOrderSaving) return;
    const row = handle.closest('.policy-row');
    const ol = row.parentElement;
    event.preventDefault();
    policyDrag = {
        row,
        ol,
        handle,
        pointerId: event.pointerId,
        grabOffset: event.clientY - row.getBoundingClientRect().top,
        before: policyRows(ol).map((r) => r.dataset.id)
    };
    row.classList.add('is-dragging');
    ol.classList.add('is-sorting');
    // window listeners: moving the dragged row in the page would drop pointer capture on the handle
    window.addEventListener('pointermove', policyPointerMove);
    window.addEventListener('pointerup', policyPointerUp);
    window.addEventListener('pointercancel', policyPointerUp);
}

function policyPointerMove(event) {
    const drag = policyDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const y = event.clientY - drag.ol.getBoundingClientRect().top;
    const middle = y - drag.grabOffset + drag.row.offsetHeight / 2;
    const target = policyRows(drag.ol).find((r) => r !== drag.row && r.offsetTop + r.offsetHeight / 2 > middle) || null;
    let next = drag.row.nextElementSibling;
    while (next && !next.classList.contains('policy-row')) next = next.nextElementSibling;
    if (target !== next) policyFlip(drag.ol, drag.row, () => drag.ol.insertBefore(drag.row, target));
    drag.row.style.transform = `translateY(${y - drag.grabOffset - drag.row.offsetTop}px)`;
}

function policyPointerUp(event) {
    const drag = policyDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    policyDrag = null;
    window.removeEventListener('pointermove', policyPointerMove);
    window.removeEventListener('pointerup', policyPointerUp);
    window.removeEventListener('pointercancel', policyPointerUp);
    drag.row.style.transition = 'transform 160ms ease';
    drag.row.style.transform = '';
    setTimeout(() => {
        drag.row.style.transition = '';
        drag.row.classList.remove('is-dragging');
        drag.ol.classList.remove('is-sorting');
        policyRows(drag.ol).forEach((row) => { row.style.transition = ''; });
    }, 170);
    const after = policyRows(drag.ol).map((r) => r.dataset.id);
    if (after.join(',') !== drag.before.join(',')) savePolicyOrder(after, drag.before, drag.row);
}

function policyKeyDown(event) {
    const handle = event.target.closest('.policy-handle');
    if (!handle || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    if (policyOrderSaving) return;
    const row = handle.closest('.policy-row');
    const ol = row.parentElement;
    const rows = policyRows(ol);
    const index = rows.indexOf(row);
    const swapWith = rows[event.key === 'ArrowUp' ? index - 1 : index + 1];
    if (!swapWith) return;
    const before = rows.map((r) => r.dataset.id);
    policyFlip(ol, null, () => ol.insertBefore(row, event.key === 'ArrowUp' ? swapWith : swapWith.nextElementSibling));
    handle.focus();
    savePolicyOrder(policyRows(ol).map((r) => r.dataset.id), before, row);
}

function savePolicyOrder(ids, previous, movedRow) {
    const ol = document.getElementById('policy-list');
    policyOrderSaving = true;
    renumberPolicies(ol);
    return policyRequest('/api/admin/server-schedules/reorder', { method: 'POST', body: JSON.stringify({ ids: ids.map(Number) }) }, 'Could not save the order')
        .then((data) => {
            schedulesData = data.schedules;
            const live = document.getElementById('policy-live');
            const name = movedRow && movedRow.querySelector('.policy-name');
            if (live && name) live.textContent = `${name.textContent} is now priority ${ids.indexOf(movedRow.dataset.id) + 1} of ${ids.length}.`;
            loadAutomationStatus();
            loadPolicyPreview();
        })
        .catch((error) => {
            showNotification(error.message, 'error');
            const byId = new Map(policyRows(ol).map((row) => [row.dataset.id, row]));
            previous.forEach((id) => { if (byId.has(id)) ol.appendChild(byId.get(id)); });
            renumberPolicies(ol);
        })
        .finally(() => {
            policyOrderSaving = false;
        });
}

// ---------------------------------------------------------------- next 7 days
function loadPolicyPreview() {
    const box = document.getElementById('policy-preview');
    if (!box) return Promise.resolve();
    return policyRequest('/api/admin/server-schedules/preview?days=7', { method: 'GET', cache: 'no-store' }, 'The preview is not available')
        .then((data) => renderPolicyPreview(data.preview))
        .catch((error) => {
            console.error('❌ Error loading the policy preview:', error);
            if (!box.children.length) box.innerHTML = `<p class="policy-empty">${escapeHtmlSafe(error.message)}</p>`;
        });
}

function renderPolicyPreview(preview) {
    const box = document.getElementById('policy-preview');
    if (!box || !preview) return;
    const axis = ['00:00', '06:00', '12:00', '18:00', '24:00'].map((t, i) => `<span style="left:${i * 25}%">${t}</span>`).join('');
    const rows = preview.days.map((day) => {
        const [y, m, d] = day.date.split('-').map(Number);
        const isToday = day.date === preview.today;
        const label = isToday ? 'Today' : new Date(y, m - 1, d).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });
        const segments = day.segments.map((s) => {
            const tip = `${s.name}|${s.on ? 'Active: the kiosk runs' : 'Stop: the kiosk is off'}|${s.from} to ${s.to}, priority ${s.position}`;
            const words = `${label}, ${s.from} to ${s.to}: ${s.name}, ${s.on ? 'kiosk runs' : 'kiosk off'}, priority ${s.position}`;
            return `<span class="policy-seg policy-seg-${s.on ? 'on' : 'stop'}" style="left:${(s.startMin / 14.4).toFixed(3)}%;width:${((s.endMin - s.startMin) / 14.4).toFixed(3)}%" tabindex="0" data-tip="${escapeHtmlSafe(tip)}" aria-label="${escapeHtmlSafe(words)}"><span class="policy-seg-label">${escapeHtmlSafe(s.name)}</span></span>`;
        }).join('');
        const now = isToday ? `<span class="policy-now" style="left:${(preview.nowMin / 14.4).toFixed(3)}%"></span>` : '';
        return `<div class="policy-day"><span class="policy-day-label${isToday ? ' is-today' : ''}">${escapeHtmlSafe(label)}</span><div class="policy-track">${segments}${now}</div></div>`;
    }).join('');
    box.innerHTML = `<div class="policy-axis"><span></span><div class="policy-axis-track">${axis}</div></div>${rows}`;
    bindPolicyTips(box);
}

function bindPolicyTips(box) {
    if (box.dataset.tipsReady) return;
    box.dataset.tipsReady = '1';
    const tip = document.getElementById('policy-tip');
    if (!tip) return;
    const show = (event) => {
        const seg = event.target.closest('.policy-seg');
        if (!seg) return;
        const [name, what, when] = seg.dataset.tip.split('|');
        tip.innerHTML = `<strong>${escapeHtmlSafe(name)}</strong>${escapeHtmlSafe(what)}<br>${escapeHtmlSafe(when)}`;
        tip.hidden = false;
        const r = seg.getBoundingClientRect();
        const w = tip.offsetWidth;
        const h = tip.offsetHeight;
        const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
        const top = r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8;
        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
    };
    const hide = (event) => {
        const seg = event.target.closest('.policy-seg');
        if (seg && event.relatedTarget && seg.contains(event.relatedTarget)) return;
        tip.hidden = true;
    };
    box.addEventListener('pointerover', show);
    box.addEventListener('focusin', show);
    box.addEventListener('pointerout', hide);
    box.addEventListener('focusout', hide);
}
// <Jun Kai end>

// ==================== SERVER CONTROL MODE FUNCTIONS (BERNISSA) ====================

// Load current server control mode on page load
async function loadServerMode() {
    try {
        const response = await fetch('/api/admin/server/mode');
        const data = await response.json();
        
        if (data.success) {
            const isAuto = data.mode === 'auto';
            const toggle = document.getElementById('auto-mode-toggle');
            if (toggle) {
                toggle.checked = isAuto;
                updateModeUI(isAuto);
            }
            
            console.log(`✅ Loaded server mode: ${data.mode.toUpperCase()}`);
        }
        
    } catch (error) {
        console.error('❌ Error loading server mode:', error);
        showNotification('Failed to load server mode', 'error');
    }
}

// Toggle between auto and manual mode
async function toggleServerMode() {
    const toggle = document.getElementById('auto-mode-toggle');
    if (!toggle) return;
    
    const isAuto = toggle.checked;
    const newMode = isAuto ? 'auto' : 'manual';
    
    console.log(`🔄 Switching to ${newMode.toUpperCase()} mode...`);
    
    try {
        const response = await fetch('/api/admin/server/mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: newMode })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Switched to ${newMode} mode`, 'success');
            updateModeUI(isAuto);
            
            // Refresh server status
            checkServerStatus();
            loadAutomationStatus();
            
        } else {
            showNotification(data.error || 'Failed to change mode', 'error');
            // Revert toggle
            toggle.checked = !isAuto;
        }
        
    } catch (error) {
        console.error('❌ Error changing mode:', error);
        showNotification('Error changing mode', 'error');
        // Revert toggle
        toggle.checked = !isAuto;
    }
}

// Update UI based on current mode
function updateModeUI(isAuto) {
    const modeStatus = document.getElementById('mode-status');
    const modeDesc = document.getElementById('mode-description');
    const modeHint = document.getElementById('mode-hint');
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const stopBtn = document.getElementById('stop-btn');
    if (!modeStatus || !modeDesc) return;

    modeStatus.textContent = isAuto ? 'Automatic mode' : 'Manual mode';
    // <Jun Kai start>
    modeDesc.textContent = isAuto
        ? 'Policies run the kiosk and hibernate the PC'
        : 'Policies are paused; use the controls to start or stop the kiosk';
    if (modeHint) {
        modeHint.textContent = isAuto
            ? 'Switch to manual mode to use the start and stop controls.'
            : 'Manual mode: the policies stay paused until automatic mode is switched back on.';
        // <Jun Kai end>
        modeHint.classList.toggle('ui-note-warn', !isAuto);
    }
    [startBtn, restartBtn, stopBtn].forEach((btn) => { if (btn) btn.disabled = isAuto; });
}

// Check current kiosk service status
async function checkServerStatus() {
    if (!sessionStorage.getItem('loggedUser')) return;
    try {
        const response = await fetch('/api/admin/server/status');
        const data = await response.json();
        
        const statusIndicator = document.getElementById('server-status-indicator');
        
        if (!statusIndicator) return;
        if (data.success) updateDailyOperationButton(data.kiosk_running === true);
        
        if (data.success) {
            if (data.kiosk_running) {
                statusIndicator.innerHTML = uiPill('ok', 'Kiosk running');
            } else {
                statusIndicator.innerHTML = uiPill('down', 'Kiosk stopped');
            }
        } else {
            statusIndicator.innerHTML = uiPill('warn', 'Status unknown');
        }
        
    } catch (error) {
        console.error('❌ Error checking status:', error);
        const statusIndicator = document.getElementById('server-status-indicator');
        if (statusIndicator) {
            statusIndicator.innerHTML = uiPill('warn', 'Cannot check status');
        }
    }
}

// One-button End Day / Start Day kiosk control for admins (Done by Caeden)
function updateDailyOperationButton(isRunning) {
    const button = document.getElementById('daily-operation-toggle-btn');
    const hint = document.getElementById('daily-operation-hint');

    if (!button) return;

    button.disabled = false;
    button.dataset.running = isRunning ? 'true' : 'false';
    button.textContent = isRunning ? 'End the day' : 'Start the day';
    button.className = isRunning ? 'ui-btn ui-btn-danger' : 'ui-btn ui-btn-primary';

    if (hint) {
        hint.textContent = isRunning
            ? 'The kiosk is running. End the day switches to manual mode and hibernates this PC.'
            : 'The kiosk is stopped. Start the day switches to manual mode and starts the kiosk server.';
    }
}

async function setServerModeForDailyOperation() {
    const response = await fetch('/api/admin/server/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'manual' })
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to switch to manual mode');
    }

    const toggle = document.getElementById('auto-mode-toggle');
    if (toggle) toggle.checked = false;
    updateModeUI(false);
}

async function toggleDailyOperation() {
    const button = document.getElementById('daily-operation-toggle-btn');
    const statusResponse = await fetch('/api/admin/server/status');
    const statusData = await statusResponse.json();
    const isRunning = statusData.success ? statusData.kiosk_running === true : button?.dataset?.running === 'true';
    const action = isRunning ? 'end the day and hibernate this PC (the wall and tablets go dark until it is woken)' : 'start the day and turn the kiosk on';

    if (!confirm(`Are you sure you want to ${action}?`)) return;

    if (button) {
        button.disabled = true;
        button.textContent = isRunning ? 'Hibernating' : 'Starting';
    }

    try {
        await setServerModeForDailyOperation();

        const response = await fetch(isRunning ? '/api/admin/server/stop' : '/api/admin/server/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Daily operation failed');
        }

        showNotification(data.message || (isRunning ? 'End Day complete. Kiosk is off.' : 'Start Day complete. Kiosk is on.'), 'success');
        setTimeout(() => checkServerStatus(), 2000);
    } catch (error) {
        console.error('Daily operation error:', error);
        showNotification(error.message || 'Daily operation failed', 'error');
        checkServerStatus();
    }
}

// Start/stop server functions with manual mode check
function startServer() {
    // Check if in manual mode
    const toggle = document.getElementById('auto-mode-toggle');
    const isAuto = toggle ? toggle.checked : true;
    
    if (isAuto) {
        showNotification('Switch to manual mode first to control the kiosk by hand', 'warning');
        return;
    }
    
    console.log('▶️ Starting server manually...');
    
    fetch('/api/admin/server/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Server started successfully', 'success');
            // Wait a moment then check status
            setTimeout(() => checkServerStatus(), 2000);
        } else {
            showNotification(data.error || 'Failed to start server', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error starting server:', error);
        showNotification('Error starting server', 'error');
    });
}

function restartServer() {
    const toggle = document.getElementById('auto-mode-toggle');
    const isAuto = toggle ? toggle.checked : true;

    if (isAuto) {
        showNotification('Switch to manual mode first to restart the application', 'warning');
        return;
    }

    if (!confirm('Restart the kiosk application now?')) return;

    console.log('🔄 Restarting server manually...');

    fetch('/api/admin/server/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Restart initiated. The application will relaunch shortly.', 'success');
        } else {
            showNotification(data.error || 'Failed to restart server', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error restarting server:', error);
        showNotification('Error restarting server', 'error');
    });
}

function stopServer() {
    // Check if in manual mode
    const toggle = document.getElementById('auto-mode-toggle');
    const isAuto = toggle ? toggle.checked : true;
    
    if (isAuto) {
        showNotification('Switch to manual mode first to control the kiosk by hand', 'warning');
        return;
    }
    
    if (!confirm('Stop the kiosk server? This PC hibernates right after, so the wall and tablets go dark until it is woken up.')) return;
    
    console.log('⏹️ Stopping server manually...');
    
    fetch('/api/admin/server/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(data.message || 'Server stopped successfully', 'success');
            // Wait a moment then check status
            setTimeout(() => checkServerStatus(), 2000);
        } else {
            showNotification(data.error || 'Failed to stop server', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error stopping server:', error);
        showNotification('Error stopping server', 'error');
    });
}

// Helper functions

function showNotification(message, type = 'info') {
    // Remove any existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${uiIcon(type === 'success' ? 'check' : type === 'error' ? 'cross' : type === 'warning' ? 'alert' : 'info', 18)}</span>
            <span>${escapeHtmlSafe(message)}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function showLoading(selector, message = 'Loading...') {
    const element = document.querySelector(selector);
    if (element) {
        element.classList.add('loading');
        element.setAttribute('data-loading-text', message);
    }
}

function hideLoading() {
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(element => {
        element.classList.remove('loading');
    });
}

function showError(selector, message) {
    const element = document.querySelector(selector);
    if (element) {
        element.classList.remove('loading');
        const safeMessage = escapeHtml(message);
        element.innerHTML = element.tagName === 'TBODY'
            ? `<tr><td colspan="10" class="table-error">${safeMessage}</td></tr>`
            : `<p class="table-error">${safeMessage}</p>`;
    }
    showNotification(message, 'error');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialisation

// Export functions for use in other modules
window.serverScheduleManager = {
    loadSchedules,
    showAddScheduleModal,
    editSchedule,
    saveSchedule,
    deleteSchedule,
    toggleScheduleStatus,
    enableAllSchedules,
    disableAllSchedules,
    resetPolicyOrder,
    loadPolicyPreview,
    startServer,
    stopServer,
    toggleDailyOperation,
    restartServer,
    loadServerMode,
    toggleServerMode,
    checkServerStatus
};



// ==================== AUTOMATION OVERVIEW (Role 3) ====================
// What the scheduler will do next, from GET /api/admin/server/automation

function formatPlannedTime(iso) {
    if (!iso) return '–';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '–';
    const now = new Date();
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
    const time = date.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (dayDiff === 0) return `Today ${time}`;
    if (dayDiff === 1) return `Tomorrow ${time}`;
    return `${date.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}

function setAutomationText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setAutomationState(label, tone) {
    const pill = document.getElementById('automation-state');
    if (!pill) return;
    pill.className = `ui-pill ui-pill-${tone}`;
    pill.innerHTML = `<span class="ui-dot"></span>${escapeHtmlSafe(label)}`;
}

async function loadAutomationStatus() {
    if (!document.getElementById('automation-card')) return;
    try {
        const response = await fetch('/api/admin/server/automation');
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load automation status');
        renderAutomationStatus(data.automation);
    } catch (error) {
        console.error('❌ Error loading automation status:', error);
        setAutomationText('automation-summary', 'Automation status is not available right now.');
        setAutomationState('Unavailable', 'down');
    }
}

function renderAutomationStatus(a) {
    const isAuto = a.mode === 'auto';
    if (!a.enabled) {
        setAutomationState('Off on this machine', 'muted');
        // <Jun Kai start>
        setAutomationText('automation-summary', 'Automation is switched off here (KIOSK_AUTOMATION=off). Policies are saved but nothing runs them.');
        // <Jun Kai end>
    } else if (!isAuto) {
        setAutomationState('Paused', 'warn');
        // <Jun Kai start>
        setAutomationText('automation-summary', 'Manual mode. Switch to automatic mode below and the policies will hibernate and wake the PC.');
        // <Jun Kai end>
    // <Jun Kai start>
    } else if (!a.activeSchedules) {
        setAutomationState('No policies', 'warn');
        setAutomationText('automation-summary', 'Automatic mode is on but no policy is enabled. Add or enable one to automate the day.');
    } else if (a.dryRun) {
        setAutomationState('Dry run', 'warn');
        setAutomationText('automation-summary', 'Dry run: actions are only logged (KIOSK_AUTOMATION=dry-run).');
    } else {
        setAutomationState('On', 'ok');
        setAutomationText('automation-summary', a.currentWindow
            ? `The kiosk runs until ${formatPlannedTime(a.currentWindow.until)}. "${a.currentWindow.schedule}" is in force now.`
            : a.stoppedBy
                ? `The kiosk is off until ${formatPlannedTime(a.stoppedBy.until)} because of the Stop policy "${a.stoppedBy.schedule}".`
                : `${a.activeSchedules} enabled polic${a.activeSchedules === 1 ? 'y' : 'ies'}. The PC hibernates when the kiosk switches off and wakes before it switches on.`);
    }
    // <Jun Kai end>

    setAutomationText('automation-next-stop', isAuto && a.enabled ? formatPlannedTime(a.nextStop) : '–');
    setAutomationText('automation-next-start', isAuto && a.enabled ? formatPlannedTime(a.nextStart) : '–');

    const wake = a.wake || {};
    if (!wake.supported) {
        setAutomationText('automation-wake-status', 'Windows only');
        setAutomationText('automation-wake-detail', 'Wake timers need the Windows Task Scheduler');
    } else if (wake.dryRun) {
        setAutomationText('automation-wake-status', 'Dry run');
        setAutomationText('automation-wake-detail', `${wake.triggers || 0} trigger(s) would be set`);
    } else if (wake.error) {
        setAutomationText('automation-wake-status', 'Not set');
        setAutomationText('automation-wake-detail', wake.error);
    } else if (wake.task && wake.task.exists) {
        setAutomationText('automation-wake-status', wake.wakeTimersAllowed === false ? 'Set, timers blocked' : 'Set');
        setAutomationText('automation-wake-detail', wake.wakeTimersAllowed === false
            ? 'Windows power settings block wake timers: run the install script as administrator'
            : (wake.task.nextRun ? `Next wake ${wake.task.nextRun}` : 'Scheduled task present'));
    } else {
        // <Jun Kai start>
        setAutomationText('automation-wake-status', a.activeSchedules ? 'Missing' : 'Not needed');
        setAutomationText('automation-wake-detail', a.activeSchedules ? 'Created when a policy is saved while automation is on' : 'No enabled policy');
        // <Jun Kai end>
    }

    setAutomationText('automation-last-tick', a.lastTick ? `Checked ${formatPlannedTime(a.lastTick)}` : (a.enabled ? 'Starting' : 'Off'));
    // <Jun Kai start>
    setAutomationText('automation-mode-hint', isAuto ? 'Automatic mode: policies apply' : 'Manual mode: policies paused');
    // <Jun Kai end>

    const list = document.getElementById('automation-events');
    if (!list) return;
    const labels = { hibernate: 'Hibernated the PC', start: 'Starting the kiosk', 'start-ok': 'Kiosk started', 'start-failed': 'Kiosk start failed' };
    if (!a.events || !a.events.length) {
        list.innerHTML = '<li class="ui-empty">No automatic actions recorded yet</li>';
        return;
    }
    list.innerHTML = a.events.map((event) => {
        const when = new Date(event.at).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
        return `<li>
                    <span class="ui-time">${escapeHtmlSafe(when)}</span>
                    <span class="ui-type">${escapeHtmlSafe(labels[event.type] || event.type)}${event.dryRun ? ' (dry run)' : ''}</span>
                    <span class="ui-detail">${escapeHtmlSafe(event.detail || '')}</span>
                </li>`;
    }).join('');
}
