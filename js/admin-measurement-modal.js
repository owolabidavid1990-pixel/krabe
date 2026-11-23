/**
 * Krabe Kollection — Tailoring Studio Measurement Component (Admin Clone)
 * 
 * Provides:
 *  - Droppable measurement form component for embedding into admin containers / modals
 *  - Self-contained modal wrapper for admin studio measurements
 *  - Covers all 31 fields from `public.custom_measurement`
 *  - Enforces that only `label` (Measurement Name) is compulsory
 *  - All 30 measurement fields are optional and accept decimals (inches)
 *  - Categorized into 6 bespoke tailoring sections:
 *      1. Measurement Information (Label, Gender, Notes)
 *      2. Torso & Upper Body
 *      3. Arms & Sleeves
 *      4. Waist, Hips & Lower Body
 *      5. Trouser Lengths
 *      6. Traditional & Ceremonial (Agbada & Cap)
 *  - TWEAKED SPECIFICALLY FOR ADMIN:
 *      * `user_id` is ALWAYS ABSOLUTELY NULL when creating or editing measurements
 *      * No user auth requirement or per-user profile caps
 *      * Directly queries and mutates public.custom_measurement where user_id IS NULL
 * 
 * Global API:
 *   window.KrabeAdminMeasurementForm.mount(targetContainer, options)
 *   window.KrabeAdminMeasurementForm.reset()
 *   window.KrabeAdminMeasurementForm.populate(profileData)
 *   window.KrabeAdminMeasurementForm.openModal([profileData], [options])
 *   window.KrabeAdminMeasurementForm.closeModal()
 *   window.KrabeAdminMeasurementForm.promptDelete(profileOrId, [options])
 * 
 * Alias:
 *   window.KrabeAdminMeasurementModal
 */

(function () {
  'use strict';

  const MODAL_ID = 'krabeAdminMeasurementModal';
  const DELETE_MODAL_ID = 'krabeAdminMeasurementDeleteModal';
  let activeProfileId = null;
  let currentEditingProfile = null;
  let activeOptions = {};
  let pendingDeleteProfile = null;
  let deleteOptions = {};

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getClient() {
    return window.krabeClient || (window.KRABE_CONFIG && typeof window.KRABE_CONFIG.getClient === 'function' ? window.KRABE_CONFIG.getClient() : null);
  }

  // Complete field map matching public.custom_measurement schema
  const NUMERIC_FIELDS = [
    // Upper Body & Torso
    'neck',
    'shoulder',
    'round_chest',
    'round_bust',
    'round_underbust',
    'apex_nipple_to_nipple',
    'shoulder_to_bust_point',
    'shoulder_to_underbust',
    'half_length',

    // Arms & Sleeves
    'armhole',
    'round_bicep',
    'round_3_4',
    'sleeve_length_short',
    'sleeve_length_3_4',
    'sleeve_length_long',
    'round_longsleeve',

    // Waist, Hips & Lower Body
    'waist',
    'hip',
    'skirt_band',
    'flap',
    'thigh_lap',
    'knee_round',
    'calf',
    'ankle_round',

    // Trouser Lengths
    'trouser_length_short',
    'trouser_length_3_4',
    'trouser_length_ankle',
    'trouser_length_long',

    // Traditional & Ceremonial
    'agbada_length',
    'agbada_sleeves',
    'head_cap'
  ];

  function renderFieldInput(fieldName, labelText, placeholder) {
    return `
      <div class="form-group" style="margin: 0;">
        <label for="kamm_${fieldName}" style="display: block; font-size: 11px; font-weight: 600; color: var(--color-text-muted, #64748B); margin-bottom: 4px;">
          ${labelText}
        </label>
        <div style="position: relative;">
          <input type="number" 
                 step="any" 
                 id="kamm_${fieldName}" 
                 class="form-input body-14 kamm-meas-input" 
                 placeholder="${placeholder}" 
                 style="width: 100%; padding: 8px 30px 8px 10px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 13.5px; background: #FFFFFF; box-sizing: border-box; color: var(--color-obsidian, #121920); font-weight: 500;">
          <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: #94A3B8; pointer-events: none;">in</span>
        </div>
      </div>
    `;
  }

  function buildFormHtml(options = {}) {
    const showBack = typeof options.onBack === 'function';
    const submitLabel = options.submitLabel || 'Save Studio Measurement &rarr;';
    const defaultGender = options.gender || 'male';

    return `
      <div class="krabe-measurement-form-component krabe-admin-measurement-clone">
        <style>
          /* Light, faint placeholder measurement numbers to distinguish from actual entered figures */
          .krabe-admin-measurement-clone .kamm-meas-input::placeholder,
          .krabe-admin-measurement-clone input[type="number"]::placeholder {
            color: #CBD5E1 !important;
            opacity: 0.55 !important;
            -webkit-text-fill-color: #CBD5E1 !important;
            font-weight: 300 !important;
          }
          .krabe-admin-measurement-clone .kamm-meas-input::-webkit-input-placeholder,
          .krabe-admin-measurement-clone input[type="number"]::-webkit-input-placeholder {
            color: #CBD5E1 !important;
            opacity: 0.55 !important;
            -webkit-text-fill-color: #CBD5E1 !important;
            font-weight: 300 !important;
          }
          .krabe-admin-measurement-clone .kamm-meas-input::-moz-placeholder,
          .krabe-admin-measurement-clone input[type="number"]::-moz-placeholder {
            color: #CBD5E1 !important;
            opacity: 0.55 !important;
            font-weight: 300 !important;
          }
          .krabe-admin-measurement-clone .kamm-meas-input:-ms-input-placeholder,
          .krabe-admin-measurement-clone input[type="number"]:-ms-input-placeholder {
            color: #CBD5E1 !important;
            opacity: 0.55 !important;
            font-weight: 300 !important;
          }
        </style>
        ${showBack ? `
          <button type="button" class="btn kamm-back-btn" onclick="window.KrabeAdminMeasurementForm.handleBack()" style="background: none; border: none; padding: 0; color: var(--color-primary, #44637B); font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px;">
            <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            Back to Saved Measurements
          </button>
        ` : ''}

        <!-- Header -->
        <div style="margin-bottom: 22px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border, #E2E8F0); padding-right: 56px;">
          <div style="display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <h3 class="h3" id="kammTitle" style="margin: 0; color: var(--color-obsidian, #121920); font-size: 20px; font-weight: 700;">New Studio Measurement</h3>
            <span class="body-12" style="color: var(--color-gold, #C58A55); font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Atelier Studio Vault</span>
          </div>
          <p class="body-14" style="color: var(--color-text-muted, #64748B); margin: 6px 0 0 0; font-size: 13.5px; line-height: 1.5;">
            Enter atelier specifications in inches. Only <strong>Measurement Name</strong> is compulsory.
          </p>
        </div>

        <!-- Alert Notification -->
        <div id="kammAlert" style="display: none; padding: 12px 16px; border-radius: 6px; margin-bottom: 18px; font-size: 13px;"></div>

        <!-- Main Tailoring Form -->
        <form id="kammForm" onsubmit="window.KrabeAdminMeasurementForm.handleSubmit(event)">
          
          <!-- SECTION 1: MEASUREMENT INFORMATION -->
          <div style="background: #FFFFFF; border: 1px solid var(--color-border, #E2E8F0); border-radius: 6px; padding: 20px; margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-gold, #C58A55); margin-bottom: 14px;">
              1. Measurement Information
            </div>
            
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-bottom: 14px;">
              <div class="form-group" style="margin: 0;">
                <label for="kamm_label" style="display: block; font-size: 12px; font-weight: 700; color: var(--color-obsidian, #121920); margin-bottom: 6px;">
                  Measurement Name / Label <span style="color: #DC2626;">*</span>
                </label>
                <input type="text" id="kamm_label" maxlength="40" class="form-input body-14" placeholder="e.g. Studio Master Senator 42R, Standard Agbada Fit, Atelier Slim Kaftan" required style="width: 100%; padding: 10px 14px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 14px; background: #FFFFFF; box-sizing: border-box;">
              </div>

              <div class="form-group" style="margin: 0;">
                <label for="kamm_gender" style="display: block; font-size: 12px; font-weight: 700; color: var(--color-obsidian, #121920); margin-bottom: 6px;">
                  Silhouette / Gender
                </label>
                <select id="kamm_gender" class="form-input body-14" style="width: 100%; padding: 10px 14px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 14px; background: #FFFFFF; box-sizing: border-box;">
                  <option value="male" ${defaultGender === 'male' ? 'selected' : ''}>Male</option>
                  <option value="female" ${defaultGender === 'female' ? 'selected' : ''}>Female</option>
                  <option value="unisex" ${defaultGender === 'unisex' ? 'selected' : ''}>Unisex</option>
                </select>
              </div>
            </div>

            <div class="form-group" style="margin: 0;">
              <label for="kamm_notes" style="display: block; font-size: 12px; font-weight: 700; color: var(--color-obsidian, #121920); margin-bottom: 6px;">
                Fit Preferences &amp; Notes <span style="font-weight: normal; color: var(--color-text-muted, #64748B);">(Optional)</span>
              </label>
              <textarea id="kamm_notes" rows="2" maxlength="300" class="form-input body-14" placeholder="e.g. Broad chest posture, slim arms taper, standard studio fitting baseline..." style="width: 100%; padding: 10px 14px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 13.5px; background: #FFFFFF; box-sizing: border-box; resize: vertical;"></textarea>
            </div>
          </div>

          <!-- SECTION 2: TORSO & UPPER BODY -->
          <div style="background: #FFFFFF; border: 1px solid var(--color-border, #E2E8F0); border-radius: 6px; padding: 20px; margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-primary, #44637B); margin-bottom: 14px;">
              2. Torso &amp; Upper Body (Inches)
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px;">
              ${renderFieldInput('neck', 'Neck (Collar)', '16.5')}
              ${renderFieldInput('shoulder', 'Shoulder Width', '19.0')}
              ${renderFieldInput('round_chest', 'Chest (Men)', '42.0')}
              ${renderFieldInput('round_bust', 'Bust (Women)', '38.0')}
              ${renderFieldInput('round_underbust', 'Underbust', '32.0')}
              ${renderFieldInput('half_length', 'Half Length', '17.5')}
              ${renderFieldInput('shoulder_to_bust_point', 'Shoulder to Bust', '10.5')}
              ${renderFieldInput('shoulder_to_underbust', 'Shoulder to Underbust', '14.0')}
              ${renderFieldInput('apex_nipple_to_nipple', 'Apex / Bust Span', '8.0')}
            </div>
          </div>

          <!-- SECTION 3: ARMS & SLEEVES -->
          <div style="background: #FFFFFF; border: 1px solid var(--color-border, #E2E8F0); border-radius: 6px; padding: 20px; margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-primary, #44637B); margin-bottom: 14px;">
              3. Arms &amp; Sleeves (Inches)
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px;">
              ${renderFieldInput('armhole', 'Armhole', '18.5')}
              ${renderFieldInput('round_bicep', 'Bicep Round', '14.5')}
              ${renderFieldInput('round_3_4', '3/4 Arm Round', '12.0')}
              ${renderFieldInput('sleeve_length_short', 'Short Sleeve L', '10.5')}
              ${renderFieldInput('sleeve_length_3_4', '3/4 Sleeve L', '18.0')}
              ${renderFieldInput('sleeve_length_long', 'Long Sleeve L', '25.5')}
              ${renderFieldInput('round_longsleeve', 'Wrist / Cuff', '9.5')}
            </div>
          </div>

          <!-- SECTION 4: WAIST, HIPS & LOWER BODY -->
          <div style="background: #FFFFFF; border: 1px solid var(--color-border, #E2E8F0); border-radius: 6px; padding: 20px; margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-primary, #44637B); margin-bottom: 14px;">
              4. Waist, Hips &amp; Lower Body (Inches)
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px;">
              ${renderFieldInput('waist', 'Waist', '34.0')}
              ${renderFieldInput('hip', 'Hip', '42.0')}
              ${renderFieldInput('skirt_band', 'Skirt Band', '33.0')}
              ${renderFieldInput('flap', 'Flap (Crotch Rise)', '11.5')}
              ${renderFieldInput('thigh_lap', 'Thigh / Lap', '24.5')}
              ${renderFieldInput('knee_round', 'Knee Round', '17.5')}
              ${renderFieldInput('calf', 'Calf', '15.5')}
              ${renderFieldInput('ankle_round', 'Ankle / Hem', '15.0')}
            </div>
          </div>

          <!-- SECTION 5: TROUSER LENGTHS -->
          <div style="background: #FFFFFF; border: 1px solid var(--color-border, #E2E8F0); border-radius: 6px; padding: 20px; margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-primary, #44637B); margin-bottom: 14px;">
              5. Trouser Lengths (Inches)
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px;">
              ${renderFieldInput('trouser_length_short', 'Short Trouser L', '21.0')}
              ${renderFieldInput('trouser_length_3_4', '3/4 Trouser L', '32.0')}
              ${renderFieldInput('trouser_length_ankle', 'Ankle Trouser L', '39.0')}
              ${renderFieldInput('trouser_length_long', 'Full Trouser L', '42.0')}
            </div>
          </div>

          <!-- SECTION 6: TRADITIONAL & CEREMONIAL -->
          <div style="background: #FFFFFF; border: 1px solid var(--color-border, #E2E8F0); border-radius: 6px; padding: 20px; margin-bottom: 24px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-gold, #C58A55); margin-bottom: 14px;">
              6. Traditional &amp; Ceremonial Specs (Inches)
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px;">
              ${renderFieldInput('agbada_length', 'Agbada Length', '56.0')}
              ${renderFieldInput('agbada_sleeves', 'Agbada Sleeves', '64.0')}
              ${renderFieldInput('head_cap', 'Fila / Cap Round', '22.5')}
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div style="display: flex; gap: 12px; justify-content: space-between; align-items: center; border-top: 1px solid var(--color-border, #E2E8F0); padding-top: 20px; flex-wrap: wrap;">
            <div id="kammFormDeleteSlot"></div>
            <div style="display: flex; gap: 12px; align-items: center; margin-left: auto;">
              ${showBack ? `
                <button type="button" class="btn body-14" onclick="window.KrabeAdminMeasurementForm.handleBack()" style="padding: 10px 22px; cursor: pointer; background: transparent; border: 1px solid var(--color-border, #CBD5E1); color: var(--color-obsidian, #121920); border-radius: 4px;">
                  Cancel
                </button>
              ` : `
                <button type="button" class="btn btn-outline body-14" onclick="window.KrabeAdminMeasurementForm.closeModal()" style="padding: 10px 22px; cursor: pointer; background: transparent; border: 1px solid var(--color-border, #CBD5E1); color: var(--color-obsidian, #121920); border-radius: 4px;">
                  Cancel
                </button>
              `}
              <button type="submit" id="kammSubmitBtn" class="btn btn-primary body-14" style="padding: 11px 28px; background: var(--color-obsidian, #121920); color: #FFFFFF; font-weight: 600; cursor: pointer; border: none; border-radius: 4px;">
                ${submitLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    `;
  }

  function showAlert(msg, type) {
    const alertEl = document.getElementById('kammAlert');
    if (!alertEl) return;
    alertEl.textContent = msg;
    alertEl.style.display = 'block';
    if (type === 'error') {
      alertEl.style.background = '#FEF2F2';
      alertEl.style.color = '#B91C1C';
      alertEl.style.border = '1px solid #F87171';
    } else {
      alertEl.style.background = '#F0FDF4';
      alertEl.style.color = '#15803D';
      alertEl.style.border = '1px solid #86EFAC';
    }
  }

  function clearAlert() {
    const alertEl = document.getElementById('kammAlert');
    if (alertEl) {
      alertEl.style.display = 'none';
      alertEl.textContent = '';
    }
  }

  function reset() {
    activeProfileId = null;
    currentEditingProfile = null;
    clearAlert();
    const form = document.getElementById('kammForm');
    if (form) form.reset();

    const deleteSlot = document.getElementById('kammFormDeleteSlot');
    if (deleteSlot) deleteSlot.innerHTML = '';

    const title = document.getElementById('kammTitle');
    if (title) title.textContent = 'New Studio Measurement';

    const submitBtn = document.getElementById('kammSubmitBtn');
    if (submitBtn) {
      submitBtn.innerHTML = activeOptions.submitLabel || 'Save Studio Measurement &rarr;';
    }
  }

  function populate(profileData) {
    if (!profileData || typeof profileData !== 'object') return;
    activeProfileId = profileData.id || null;
    currentEditingProfile = profileData;

    const title = document.getElementById('kammTitle');
    if (title) title.textContent = 'Edit Studio Measurement';

    const labelEl = document.getElementById('kamm_label');
    if (labelEl && profileData.label) labelEl.value = profileData.label;

    const genderEl = document.getElementById('kamm_gender');
    if (genderEl && profileData.gender) genderEl.value = profileData.gender;

    const notesEl = document.getElementById('kamm_notes');
    if (notesEl && profileData.notes) notesEl.value = profileData.notes;

    NUMERIC_FIELDS.forEach(field => {
      const input = document.getElementById('kamm_' + field);
      if (input && profileData[field] !== null && profileData[field] !== undefined) {
        input.value = profileData[field];
      }
    });

    const deleteSlot = document.getElementById('kammFormDeleteSlot');
    if (deleteSlot && activeProfileId) {
      deleteSlot.innerHTML = `
        <button type="button" class="btn body-13" onclick="window.KrabeAdminMeasurementForm.promptDelete('${activeProfileId}')" style="background: transparent; border: 1px solid #FECACA; color: #DC2626; padding: 8px 16px; border-radius: 4px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          Delete Profile
        </button>
      `;
    }
  }

  function mount(targetContainer, options = {}) {
    activeOptions = options;
    const container = typeof targetContainer === 'string'
      ? document.querySelector(targetContainer)
      : targetContainer;

    if (!container) {
      console.error('[KrabeAdminMeasurementForm] Target container not found:', targetContainer);
      return;
    }

    container.innerHTML = buildFormHtml(options);
    reset();

    if (options.initialData) {
      populate(options.initialData);
    } else if (options.gender) {
      const genderEl = document.getElementById('kamm_gender');
      if (genderEl) genderEl.value = options.gender;
    }
  }

  function handleBack() {
    if (typeof activeOptions.onBack === 'function') {
      activeOptions.onBack();
    }
  }

  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    clearAlert();

    const labelInput = document.getElementById('kamm_label');
    const label = labelInput ? labelInput.value.trim() : '';
    if (!label) {
      showAlert('Please enter a Measurement Name / Label (e.g. Master Senator, Kaftan Standard).', 'error');
      if (labelInput) labelInput.focus();
      return;
    }
    if (label.length > 40) {
      showAlert('Measurement Name / Label must not exceed 40 characters.', 'error');
      if (labelInput) labelInput.focus();
      return;
    }

    const genderInput = document.getElementById('kamm_gender');
    const gender = genderInput ? genderInput.value : 'male';

    const notesInput = document.getElementById('kamm_notes');
    const notes = notesInput && notesInput.value.trim() ? notesInput.value.trim() : null;
    if (notes && notes.length > 300) {
      showAlert('Fit Preferences & Notes must not exceed 300 characters.', 'error');
      if (notesInput) notesInput.focus();
      return;
    }

    // TWEAK: user_id is ALWAYS ABSOLUTELY NULL for studio measurements
    const payload = {
      label,
      gender,
      notes,
      user_id: null
    };

    NUMERIC_FIELDS.forEach(field => {
      const input = document.getElementById('kamm_' + field);
      if (input && input.value !== '') {
        const val = parseFloat(input.value);
        payload[field] = (!isNaN(val) && val > 0) ? val : null;
      } else {
        payload[field] = null;
      }
    });

    // Enforce user_id is strictly null
    payload.user_id = null;

    const submitBtn = document.getElementById('kammSubmitBtn');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Save Studio Measurement &rarr;';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Saving Studio Measurement...';
    }

    try {
      const client = getClient();
      if (!client) {
        throw new Error('Database client not ready. Please try again.');
      }

      let resultData = null;
      if (activeProfileId) {
        // UPDATE existing studio measurement (user_id remains strictly null)
        payload.user_id = null;
        const { data, error } = await client
          .from('custom_measurement')
          .update(payload)
          .eq('id', activeProfileId)
          .select()
          .single();
        if (error) throw error;
        resultData = data;
      } else {
        // INSERT new studio measurement (user_id is strictly null)
        payload.user_id = null;
        const { data, error } = await client
          .from('custom_measurement')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        resultData = data;
      }

      showAlert('✓ Studio measurement saved successfully (user_id: null)!', 'success');

      // Dispatch global events for listeners
      window.dispatchEvent(new CustomEvent('krabe:admin-measurement:saved', {
        detail: { measurement: resultData || payload }
      }));
      window.dispatchEvent(new CustomEvent('krabe:measurement:saved', {
        detail: { measurement: resultData || payload }
      }));

      // Call onSuccess callback if provided
      if (typeof activeOptions.onSuccess === 'function') {
        activeOptions.onSuccess(resultData || payload);
      }

      // If open in a standalone modal, close it
      const standaloneModal = document.getElementById(MODAL_ID);
      if (standaloneModal && standaloneModal.classList.contains('active')) {
        setTimeout(() => {
          closeModal();
        }, 500);
      }

    } catch (err) {
      console.error('[Krabe Admin Measurement Save Error]:', err);
      showAlert(err.message || 'Could not save studio measurement. Please check your connection.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  }

  function openModal(profileData = null, options = {}) {
    let modal = document.getElementById(MODAL_ID);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = MODAL_ID;
      modal.className = 'modal-overlay';
      modal.setAttribute('aria-hidden', 'true');
      modal.onclick = (e) => { if (e.target === modal) closeModal(); };
      modal.innerHTML = `
        <div class="modal-card" style="background: var(--color-bone, #FAF8F5); border: 1px solid var(--color-border, #E2E8F0); border-radius: 8px; width: 100%; max-width: 820px; max-height: 90vh; overflow-y: auto; padding: 32px 28px; position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
          <button type="button" class="modal-close" onclick="window.KrabeAdminMeasurementForm.closeModal()" aria-label="Close" style="position: absolute; top: 18px; right: 18px; background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-obsidian, #121920); padding: 6px; line-height: 1;">✕</button>
          <div id="kammModalSlot"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    mount('#kammModalSlot', {
      initialData: profileData,
      onBack: closeModal,
      submitLabel: 'Save Studio Measurement &rarr;',
      ...options
    });

    modal.style.display = 'flex';
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    reset();
  }

  function promptDelete(profileOrId, options = {}) {
    deleteOptions = options || {};
    let profile = null;

    if (profileOrId && typeof profileOrId === 'object') {
      profile = profileOrId;
    } else if (typeof profileOrId === 'string') {
      if (currentEditingProfile && String(currentEditingProfile.id) === String(profileOrId)) {
        profile = currentEditingProfile;
      } else {
        profile = { id: profileOrId, label: options.label || '' };
      }
    }

    if (!profile || !profile.id) {
      console.warn('[KrabeAdminMeasurementForm] No profile provided to promptDelete');
      return;
    }

    pendingDeleteProfile = profile;

    let modal = document.getElementById(DELETE_MODAL_ID);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = DELETE_MODAL_ID;
      modal.className = 'modal-overlay';
      modal.setAttribute('aria-hidden', 'true');
      modal.onclick = (e) => { if (e.target === modal) closeDeleteModal(); };
      modal.innerHTML = `
        <div class="modal-card" style="background: var(--color-bone, #FAF8F5); border: 1px solid var(--color-border, #E2E8F0); border-radius: 12px; width: 100%; max-width: 440px; padding: 28px 24px; position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.25); text-align: center;">
          <button type="button" class="modal-close" onclick="window.KrabeAdminMeasurementForm.closeDeleteModal()" aria-label="Close" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 18px; cursor: pointer; color: var(--color-obsidian, #121920); padding: 4px; line-height: 1;">✕</button>
          
          <div style="width: 52px; height: 52px; border-radius: 50%; background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </div>

          <h3 class="h4" style="color: var(--color-obsidian, #121920); font-weight: 700; margin: 0 0 8px 0; font-size: 19px;">Delete Studio Measurement?</h3>
          <p class="body-14" id="kammDeleteModalText" style="color: var(--color-text-muted, #64748B); margin: 0 0 22px 0; font-size: 13.5px; line-height: 1.5;">
            Are you sure you want to permanently delete this studio measurement profile? This action cannot be undone.
          </p>

          <div id="kammDeleteAlert" style="display: none; padding: 10px 14px; background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; border-radius: 4px; font-size: 12px; margin-bottom: 16px; text-align: left;"></div>

          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn body-13" onclick="window.KrabeAdminMeasurementForm.closeDeleteModal()" style="flex: 1; padding: 11px 18px; background: #FFFFFF; border: 1px solid var(--color-border, #CBD5E1); color: var(--color-obsidian, #121920); border-radius: 6px; font-weight: 600; cursor: pointer;">
              Cancel
            </button>
            <button type="button" id="kammConfirmDeleteBtn" class="btn body-13" onclick="window.KrabeAdminMeasurementForm.executeDelete()" style="flex: 1; padding: 11px 18px; background: #DC2626; color: #FFFFFF; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
              Delete Profile
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const textEl = document.getElementById('kammDeleteModalText');
    const label = profile.label ? `"${profile.label}"` : 'this measurement profile';
    if (textEl) {
      textEl.innerHTML = `Are you sure you want to permanently delete <strong>${escapeHtml(label)}</strong> from studio measurements? This action cannot be undone.`;
    }

    const alertEl = document.getElementById('kammDeleteAlert');
    if (alertEl) {
      alertEl.style.display = 'none';
      alertEl.textContent = '';
    }

    const delBtn = document.getElementById('kammConfirmDeleteBtn');
    if (delBtn) {
      delBtn.disabled = false;
      delBtn.textContent = 'Delete Profile';
    }

    modal.style.display = 'flex';
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDeleteModal() {
    const modal = document.getElementById(DELETE_MODAL_ID);
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      const mainModal = document.getElementById(MODAL_ID);
      if (!mainModal || !mainModal.classList.contains('active')) {
        document.body.style.overflow = '';
      }
    }
    pendingDeleteProfile = null;
  }

  async function executeDelete() {
    if (!pendingDeleteProfile || !pendingDeleteProfile.id) return;

    const delBtn = document.getElementById('kammConfirmDeleteBtn');
    if (delBtn) {
      delBtn.disabled = true;
      delBtn.textContent = 'Deleting...';
    }

    try {
      const client = getClient();
      if (!client) throw new Error('Database client unavailable');

      const { error } = await client
        .from('custom_measurement')
        .delete()
        .eq('id', pendingDeleteProfile.id);

      if (error) throw error;

      const deletedId = pendingDeleteProfile.id;
      const deletedProfile = pendingDeleteProfile;

      closeDeleteModal();

      if (activeProfileId === deletedId) {
        closeModal();
      }

      window.dispatchEvent(new CustomEvent('krabe:admin-measurement:deleted', {
        detail: { id: deletedId, measurement: deletedProfile }
      }));
      window.dispatchEvent(new CustomEvent('krabe:measurement:saved', {
        detail: { deletedId }
      }));

      if (typeof deleteOptions.onSuccess === 'function') {
        deleteOptions.onSuccess(deletedProfile);
      }
    } catch (err) {
      console.error('[KrabeAdminMeasurementForm Delete Error]:', err);
      const alertEl = document.getElementById('kammDeleteAlert');
      if (alertEl) {
        alertEl.textContent = err.message || 'Could not delete studio measurement. Please try again.';
        alertEl.style.display = 'block';
      }
      if (delBtn) {
        delBtn.disabled = false;
        delBtn.textContent = 'Delete Profile';
      }
    }
  }

  // Keyboard accessibility
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const delModal = document.getElementById(DELETE_MODAL_ID);
      if (delModal && delModal.classList.contains('active')) {
        closeDeleteModal();
        return;
      }
      const modal = document.getElementById(MODAL_ID);
      if (modal && modal.classList.contains('active')) {
        closeModal();
      }
    }
  });

  // Expose Global Droppable Admin Component API
  window.KrabeAdminMeasurementForm = {
    mount,
    reset,
    populate,
    handleSubmit,
    handleBack,
    showAlert,
    clearAlert,
    openModal,
    closeModal,
    promptDelete,
    closeDeleteModal,
    executeDelete,
    deleteMeasurement: promptDelete
  };

  window.KrabeAdminMeasurementModal = {
    mount,
    open: openModal,
    close: closeModal,
    reset,
    handleSubmit,
    promptDelete,
    closeDeleteModal
  };

})();
