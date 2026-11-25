// Owner: Role 1, Zihan. Previous team: Caeden (4), XY (Xuanyang) (3), Nick (2).
// ============================================================
// VALIDATIONRULES.JS - Centralized Feedback Validation
// ============================================================
// CAEDEN CHANGE SUMMARY (DONE BY CAEDEN)
// ============================================================
// - Added centralized validation helpers driven by admin-configurable validationRules. (DONE BY CAEDEN)
// - Added server-side feature flag checks for photo, pledge and email-dependent flows. (DONE BY CAEDEN)
//
// XY CHANGE SUMMARY (DONE BY XY)
// ============================================================
// - Added server-side validation for temporary, legacy 7-day and long-term retention selections. (DONE BY XY)
//
// FIND COMMAND
//   rg -n "DONE BY CAEDEN|CAEDEN CHANGE SUMMARY|DONE BY XY|XY CHANGE SUMMARY" frontend backend
// ============================================================

function getString(value) {
  return String(value || '').trim();
}

const ALLOWED_PLEDGE_TOPICS = new Set([
  'climate-change',
  'renewable-energy',
  'sustainable-living',
  'ocean-conservation',
  'ethical-governance',
  'community-impact'
]);

function normalizePledgeTopics(userData = {}) {
  const rawTopics = Array.isArray(userData.pledgeTopics)
    ? userData.pledgeTopics
    : (typeof userData.pledgeTopic === 'string' ? userData.pledgeTopic.split(',') : []);

  return [...new Set(rawTopics
    .map(topic => getString(topic))
    .filter(Boolean))];
}

function isEnabled(value) {
  return value !== false;
}

function buildPattern(pattern) {
  try {
    return new RegExp(pattern);
  } catch (error) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  }
}

function validateFeedbackSubmission(payload, validationRules = {}, featureFlags = {}, pledgePresets = [], allowMultiplePledges = false) {
  const errors = [];
  const userData = payload?.userData || {};
  const name = getString(userData.name);
  const email = getString(userData.email);
  const pledge = getString(userData.pledge);
  const pledgeTopics = normalizePledgeTopics(userData);
  //pledge skipped removed (zihan)
  const photoSkipped = Boolean(userData.photoSkipped); // Optional photo skip - changes made by nick
  const hasPhoto = Boolean(userData.photoId || userData.processedPhotoId || userData.photo || userData.processedPhoto);
  const retention = getString(payload?.retention).toLowerCase();

  if (isEnabled(validationRules.nameRequired) && !name) {
    errors.push({ field: 'name', message: 'Name is required.' });
  }

  if (name && name.length < Number(validationRules.nameMinLength || 0)) {
    errors.push({ field: 'name', message: `Name must be at least ${validationRules.nameMinLength} characters.` });
  }

  if (name && name.length > Number(validationRules.nameMaxLength || 9999)) {
    errors.push({ field: 'name', message: `Name must be ${validationRules.nameMaxLength} characters or fewer.` });
  }

  if (isEnabled(validationRules.emailRequired) && !email) {
    errors.push({ field: 'email', message: 'Email is required.' });
  }

  if (email && !buildPattern(validationRules.emailPattern).test(email)) {
    errors.push({ field: 'email', message: 'Email format is invalid.' });
  }
  
  // The pledge is always required (the admin can no longer turn it off), so these checks always run. (zihan)

  if (!pledge) {
    errors.push({ field: 'pledge', message: 'Pledge is required.' });
  }

  if (isEnabled(validationRules.pledgeTopicRequired) && pledgeTopics.length === 0) {
    errors.push({ field: 'pledgeTopic', message: 'Pledge topic is required.' });
  }

  const invalidTopic = pledgeTopics.find(topic => !ALLOWED_PLEDGE_TOPICS.has(topic));
  if (invalidTopic) {
    errors.push({ field: 'pledgeTopic', message: `Pledge topic "${invalidTopic}" is not supported.` });
  }

  let pledgeTexts = [pledge];
  if (Array.isArray(pledgePresets) && pledgePresets.length > 0 && pledge) {
    const ids = userData.pledgePresetIds;
    // Older clients send only the preset text for a single pledge.
    const byId = new Map(pledgePresets.filter(Boolean).map(item => [item.id, item]));
    const selections = ids === undefined
      ? [pledgePresets.find(item => getString(item?.text) === pledge)]
      : Array.isArray(ids) && ids.length <= byId.size && new Set(ids).size === ids.length
        ? ids.map(id => byId.get(id))
        : [];

    if (!selections.length || selections.some(item => !item) ||
        selections.map(item => getString(item.text)).join('\n') !== pledge) {
      errors.push({ field: 'pledge', message: 'Please choose from the listed pledges.' });
    } else {
      pledgeTexts = selections.map(item => getString(item.text));
      if (!allowMultiplePledges && selections.length > 1) {
        errors.push({ field: 'pledge', message: 'Only one pledge can be selected.' });
      }
      const expectedTopics = new Set(selections.map(item => getString(item.topic)));
      if (pledgeTopics.length !== expectedTopics.size || pledgeTopics.some(topic => !expectedTopics.has(topic))) {
        errors.push({ field: 'pledgeTopic', message: 'The pledge topics do not match the selected pledges.' });
      }
    }
  }

  if (pledge && pledgeTexts.some(text => text.length < Number(validationRules.pledgeMinLength || 0))) {
    errors.push({ field: 'pledge', message: `Each pledge must be at least ${validationRules.pledgeMinLength} characters.` });
  }
  if (pledge && pledgeTexts.some(text => text.length > Number(validationRules.pledgeMaxLength || 9999))) {
    errors.push({ field: 'pledge', message: `Each pledge must be ${validationRules.pledgeMaxLength} characters or fewer.` });
  }

  const anyPhotoFeatureEnabled = isEnabled(featureFlags.cameraCaptureEnabled) || isEnabled(featureFlags.photoUploadEnabled);
  // Allow visitors to intentionally skip photo after pledge - changes made by nick
  if (isEnabled(validationRules.photoRequired) && anyPhotoFeatureEnabled && !hasPhoto && !photoSkipped) {
    errors.push({ field: 'photo', message: 'Photo is required.' });
  }

  if (!['temporary', '7days', '7day', 'longterm', 'indefinite'].includes(retention)) {
    errors.push({ field: 'retention', message: 'Data retention selection is required.' });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateFeedbackSubmission
};
