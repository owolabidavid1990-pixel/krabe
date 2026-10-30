/**
 * Krabe Kollection — Tailoring Custom Measurement Component
 * 
 * Provides:
 *  - Pure, droppable measurement form component for embedding into any container / modal view
 *  - Optional on-demand modal wrapper (only created when explicitly requested)
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
 *  - Handles user authentication check and inserts directly into Supabase `custom_measurement`
 *  - Fires `krabe:measurement:saved` event and invokes optional `onSuccess` callback
 * 
 * Global API:
 *   window.KrabeMeasurementForm.mount(targetContainer, options)
 *   window.KrabeMeasurementForm.reset()
 *   window.KrabeMeasurementForm.openModal([profileData], [options])
 *   window.KrabeMeasurementForm.closeModal()
 * 
 * Backwards-compatibility alias:
 *   window.KrabeMeasurementModal
 */

(function () {
  'use strict';

  const MODAL_ID = 'krabeMeasurementModal';
  let activeProfileId = null;
  let activeOptions = {};

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
        <label for="kmm_${fieldName}" style="display: block; font-size: 11px; font-weight: 600; color: var(--color-text-muted, #64748B); margin-bottom: 4px;">
          ${labelText}
        </label>
        <div style="position: relative;">
          <input type="number" 
                 step="any" 
                 id="kmm_${fieldName}" 
                 class="form-input body-14" 
                 placeholder="${placeholder}" 
                 style="width: 100%; padding: 8px 30px 8px 10px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 13.5px; background: #FFFFFF; box-sizing: border-box;">
          <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: #94A3B8; pointer-events: none;">in</span>
        </div>
      </div>
    `;
  }

  function buildFormHtml(options = {}) {
    const showBack = typeof options.onBack === 'function';
    const submitLabel = options.submitLabel || 'Save Custom Measurement &rarr;';
    const defaultGender = options.gender || 'male';

    return `
      <div class="krabe-measurement-form-component">
        ${showBack ? `
          <button type="button" class="btn kmm-back-btn" onclick="window.KrabeMeasurementForm.handleBack()" style="background: none; border: none; padding: 0; color: var(--color-primary, #44637B); font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px;">
            <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            Back to Saved Custom Measurements
          </button>
        ` : ''}

        <!-- Header -->
        <div style="margin-bottom: 22px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border, #E2E8F0); padding-right: 56px;">
          <div style="display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <h3 class="h3" id="kmmTitle" style="margin: 0; color: var(--color-obsidian, #121920); font-size: 20px; font-weight: 700;">New Custom Measurement</h3>
            <span class="body-12" style="color: var(--color-gold, #C58A55); font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Private Client Vault</span>
          </div>
          <p class="body-14" style="color: var(--color-text-muted, #64748B); margin: 6px 0 0 0; font-size: 13.5px; line-height: 1.5;">
            Enter your tailored measurements in inches. Only <strong>Measurement Name</strong> is compulsory. All other tailoring fields are optional.
          </p>
        </div>

        <!-- Alert Notification -->
        <div id="kmmAlert" style="display: none; padding: 12px 16px; border-radius: 6px; margin-bottom: 18px; font-size: 13px;"></div>

        <!-- Main Tailoring Form -->
        <form id="kmmForm" onsubmit="window.KrabeMeasurementForm.handleSubmit(event)">
          
          <!-- SECTION 1: MEASUREMENT INFORMATION -->
          <div style="background: #FFFFFF; border: 1px solid var(--color-border, #E2E8F0); border-radius: 6px; padding: 20px; margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-gold, #C58A55); margin-bottom: 14px;">
              1. Measurement Information
            </div>
            
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-bottom: 14px;">
              <div class="form-group" style="margin: 0;">
                <label for="kmm_label" style="display: block; font-size: 12px; font-weight: 700; color: var(--color-obsidian, #121920); margin-bottom: 6px;">
                  Measurement Name / Label <span style="color: #DC2626;">*</span>
                </label>
                <input type="text" id="kmm_label" maxlength="30" class="form-input body-14" placeholder="e.g. Wedding Senator Fit, Agbada Ceremonial, Casual Kaftan" required style="width: 100%; padding: 10px 14px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 14px; background: #FFFFFF; box-sizing: border-box;">
              </div>

              <div class="form-group" style="margin: 0;">
                <label for="kmm_gender" style="display: block; font-size: 12px; font-weight: 700; color: var(--color-obsidian, #121920); margin-bottom: 6px;">
                  Silhouette / Gender
                </label>
                <select id="kmm_gender" class="form-input body-14" style="width: 100%; padding: 10px 14px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 14px; background: #FFFFFF; box-sizing: border-box;">
                  <option value="male" ${defaultGender === 'male' ? 'selected' : ''}>Male</option>
                  <option value="female" ${defaultGender === 'female' ? 'selected' : ''}>Female</option>
                  <option value="unisex" ${defaultGender === 'unisex' ? 'selected' : ''}>Unisex</option>
                </select>
              </div>
            </div>

            <div class="form-group" style="margin: 0;">
              <label for="kmm_notes" style="display: block; font-size: 12px; font-weight: 700; color: var(--color-obsidian, #121920); margin-bottom: 6px;">
                Fit Preferences &amp; Notes <span style="font-weight: normal; color: var(--color-text-muted, #64748B);">(Optional)</span>
              </label>
              <textarea id="kmm_notes" rows="2" maxlength="200" class="form-input body-14" placeholder="e.g. Broader shoulders, slim waist taper, prefer relaxed trouser cuff..." style="width: 100%; padding: 10px 14px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 13.5px; background: #FFFFFF; box-sizing: border-box; resize: vertical;"></textarea>
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
          <div style="display: flex; gap: 12px; justify-content: flex-end; align-items: center; border-top: 1px solid var(--color-border, #E2E8F0); padding-top: 20px;">
            ${showBack ? `
              <button type="button" class="btn body-14" onclick="window.KrabeMeasurementForm.handleBack()" style="padding: 10px 22px; cursor: pointer; background: transparent; border: 1px solid var(--color-border, #CBD5E1); color: var(--color-obsidian, #121920); border-radius: 4px;">
                Cancel
              </button>
            ` : `
              <button type="button" class="btn btn-outline body-14" onclick="window.KrabeMeasurementForm.closeModal()" style="padding: 10px 22px; cursor: pointer; background: transparent; border: 1px solid var(--color-border, #CBD5E1); color: var(--color-obsidian, #121920); border-radius: 4px;">
                Cancel
              </button>
            `}
            <button type="submit" id="kmmSubmitBtn" class="btn btn-primary body-14" style="padding: 11px 28px; background: var(--color-obsidian, #121920); color: #FFFFFF; font-weight: 600; cursor: pointer; border: none; border-radius: 4px;">
              ${submitLabel}
            </button>
          </div>
        </form>
      </div>
    `;
  }

  function showAlert(msg, type) {
    const alertEl = document.getElementById('kmmAlert');
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
    const alertEl = document.getElementById('kmmAlert');
    if (alertEl) {
      alertEl.style.display = 'none';
      alertEl.textContent = '';
    }
  }

  function reset() {
    activeProfileId = null;
    clearAlert();
    const form = document.getElementById('kmmForm');
    if (form) form.reset();

    const title = document.getElementById('kmmTitle');
    if (title) title.textContent = 'New Custom Measurement';

    const submitBtn = document.getElementById('kmmSubmitBtn');
    if (submitBtn) {
      submitBtn.innerHTML = activeOptions.submitLabel || 'Save Custom Measurement &rarr;';
    }
  }

  function populate(profileData) {
    if (!profileData || typeof profileData !== 'object') return;
    activeProfileId = profileData.id || null;

    const title = document.getElementById('kmmTitle');
    if (title) title.textContent = 'Edit Custom Measurement';

    const labelEl = document.getElementById('kmm_label');
    if (labelEl && profileData.label) labelEl.value = profileData.label;

    const genderEl = document.getElementById('kmm_gender');
    if (genderEl && profileData.gender) genderEl.value = profileData.gender;

    const notesEl = document.getElementById('kmm_notes');
    if (notesEl && profileData.notes) notesEl.value = profileData.notes;

    NUMERIC_FIELDS.forEach(field => {
      const input = document.getElementById('kmm_' + field);
      if (input && profileData[field] !== null && profileData[field] !== undefined) {
        input.value = profileData[field];
      }
    });
  }

  /**
   * Mounts the droppable custom measurement form into a target container.
   *
   * @param {string|HTMLElement} targetContainer Element or CSS selector
   * @param {Object} options Configuration options
   *   - onBack: function called when back/cancel is clicked
   *   - onSuccess: function called when measurement is saved (receives saved data)
   *   - gender: default gender ('male' | 'female' | 'unisex')
   *   - submitLabel: custom label for the primary submit button
   *   - initialData: custom measurement object to edit
   */
  function mount(targetContainer, options = {}) {
    activeOptions = options;
    const container = typeof targetContainer === 'string'
      ? document.querySelector(targetContainer)
      : targetContainer;

    if (!container) {
      console.error('[KrabeMeasurementForm] Target container not found:', targetContainer);
      return;
    }

    container.innerHTML = buildFormHtml(options);
    reset();

    if (options.initialData) {
      populate(options.initialData);
    } else if (options.gender) {
      const genderEl = document.getElementById('kmm_gender');
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

    const labelInput = document.getElementById('kmm_label');
    const label = labelInput ? labelInput.value.trim() : '';
    if (!label) {
      showAlert('Please enter a Measurement Name / Label (e.g., Wedding Senator, Kaftan Fit).', 'error');
      if (labelInput) labelInput.focus();
      return;
    }
    if (label.length > 30) {
      showAlert('Measurement Name / Label must not exceed 30 characters.', 'error');
      if (labelInput) labelInput.focus();
      return;
    }

    const genderInput = document.getElementById('kmm_gender');
    const gender = genderInput ? genderInput.value : 'male';

    const notesInput = document.getElementById('kmm_notes');
    const notes = notesInput && notesInput.value.trim() ? notesInput.value.trim() : null;
    if (notes && notes.length > 200) {
      showAlert('Fit Preferences & Notes must not exceed 200 characters.', 'error');
      if (notesInput) notesInput.focus();
      return;
    }

    const payload = {
      label,
      gender,
      notes
    };

    NUMERIC_FIELDS.forEach(field => {
      const input = document.getElementById('kmm_' + field);
      if (input && input.value !== '') {
        const val = parseFloat(input.value);
        payload[field] = (!isNaN(val) && val > 0) ? val : null;
      } else {
        payload[field] = null;
      }
    });

    const submitBtn = document.getElementById('kmmSubmitBtn');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Save Custom Measurement &rarr;';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Saving Custom Measurement...';
    }

    try {
      const client = window.krabeClient || (window.KRABE_CONFIG && typeof window.KRABE_CONFIG.getClient === 'function' ? window.KRABE_CONFIG.getClient() : null);
      if (!client) {
        throw new Error('Database client not ready. Please try again.');
      }

      // Identify active user
      let userId = null;
      if (window.krabeUser && window.krabeUser.id) {
        userId = window.krabeUser.id;
      } else {
        const { data: authData } = await client.auth.getUser();
        if (authData && authData.user) {
          userId = authData.user.id;
        }
      }

      if (!userId) {
        throw new Error('Please sign in or create an account to save a custom measurement.');
      }

      payload.user_id = userId;

      let resultData = null;
      if (activeProfileId) {
        // UPDATE existing custom measurement
        const { data, error } = await client
          .from('custom_measurement')
          .update(payload)
          .eq('id', activeProfileId)
          .select()
          .single();
        if (error) throw error;
        resultData = data;
      } else {
        // INSERT new custom measurement
        const { data, error } = await client
          .from('custom_measurement')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        resultData = data;
      }

      showAlert('✓ Custom measurement saved successfully to your vault!', 'success');

      // Dispatch global event for listening pages (e.g. product.html, account.html)
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
      console.error('[Krabe Custom Measurement Save Error]:', err);
      showAlert(err.message || 'Could not save custom measurement. Please check your connection.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  }

  /**
   * Standalone modal launcher for pages needing a self-contained popup dialog (e.g. account.html).
   * Note: Only creates the overlay on demand when explicitly called.
   */
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
          <button type="button" class="modal-close" onclick="window.KrabeMeasurementForm.closeModal()" aria-label="Close" style="position: absolute; top: 18px; right: 18px; background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-obsidian, #121920); padding: 6px; line-height: 1;">✕</button>
          <div id="kmmModalSlot"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    mount('#kmmModalSlot', {
      initialData: profileData,
      onBack: closeModal,
      submitLabel: 'Save Custom Measurement &rarr;',
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

  // Keyboard accessibility
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById(MODAL_ID);
      if (modal && modal.classList.contains('active')) {
        closeModal();
      }
    }
  });

  // Expose Global Droppable Component API
  window.KrabeMeasurementForm = {
    mount,
    reset,
    populate,
    handleSubmit,
    handleBack,
    showAlert,
    clearAlert,
    openModal,
    closeModal
  };

  // Backwards-compatibility alias
  window.KrabeMeasurementModal = {
    mount,
    open: openModal,
    close: closeModal,
    reset,
    handleSubmit
  };

})();
