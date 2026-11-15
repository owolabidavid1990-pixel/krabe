/**
 * Krabe Kollection — Saved Address Component
 * 
 * Provides:
 *  - Droppable address form component for embedding into containers or modal views
 *  - On-demand modal wrapper (only creates overlay when explicitly requested)
 *  - Database persistence directly into Supabase `public.profile.addresses` (jsonb array)
 *  - Supports Address Creation, Editing, Deletion (with custom popup), and Set Default
 *  - Enforces a maximum of 10 saved addresses per customer
 *  - Integrated Nigerian State picker & optional Google Places autocomplete integration
 *  - Global event dispatches: `krabe:address:saved`, `krabe:address:deleted`
 * 
 * Global API:
 *   window.KrabeAddressForm.openModal([addressData], [options])
 *   window.KrabeAddressForm.closeModal()
 *   window.KrabeAddressForm.promptDelete(addressOrId, [options])
 *   window.KrabeAddressForm.closeDeleteModal()
 *   window.KrabeAddressForm.setDefault(addressId)
 *   window.KrabeAddressForm.mount(targetContainer, options)
 *   window.KrabeAddressForm.reset()
 */

(function () {
  'use strict';

  const MODAL_ID = 'krabeAddressModal';
  const DELETE_MODAL_ID = 'krabeAddressDeleteModal';
  const MAX_ADDRESSES = 10;

  let activeAddressId = null;
  let currentEditingAddress = null;
  let activeOptions = {};
  let pendingDeleteAddress = null;
  let deleteOptions = {};
  let addressSearchBoxInstance = null;

  const NIGERIAN_STATES = [
    'Lagos', 'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe', 'Imo',
    'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Nasarawa', 'Niger',
    'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
  ];

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

  async function getActiveUser(client) {
    if (window.krabeUser && window.krabeUser.id) return window.krabeUser;
    if (!client) return null;
    try {
      const { data } = await client.auth.getUser();
      return data?.user || null;
    } catch (_) {
      return null;
    }
  }

  function showAlert(msg, type = 'error') {
    const alertEl = document.getElementById('kamAlert');
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
    const alertEl = document.getElementById('kamAlert');
    if (alertEl) {
      alertEl.style.display = 'none';
      alertEl.textContent = '';
    }
  }

  function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'addr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }

  function injectModalPacStyles() {
    if (document.getElementById('kamPacStyles')) return;
    const style = document.createElement('style');
    style.id = 'kamPacStyles';
    style.textContent = `
      .pac-container {
        z-index: 10000 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function buildFormHtml(options = {}) {
    injectModalPacStyles();
    const showBack = typeof options.onBack === 'function';
    const submitLabel = options.submitLabel || 'Save Delivery Address &rarr;';

    const stateOptions = NIGERIAN_STATES.map(s => {
      const isSelected = s === 'Lagos';
      return `<option value="${escapeHtml(s)}" ${isSelected ? 'selected' : ''}>${escapeHtml(s)}</option>`;
    }).join('');

    return `
      <div class="krabe-address-form-component">
        ${showBack ? `
          <button type="button" class="btn kam-back-btn" onclick="window.KrabeAddressForm.handleBack()" style="background: none; border: none; padding: 0; color: var(--color-primary, #44637B); font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px;">
            <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            Back to Saved Addresses
          </button>
        ` : ''}

        <!-- Header -->
        <div style="margin-bottom: 22px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border, #E2E8F0); padding-right: 48px;">
          <div style="display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <h3 class="h3" id="kamTitle" style="margin: 0; color: var(--color-obsidian, #121920); font-size: 20px; font-weight: 700;">Add Delivery Address</h3>
            <span class="body-12" style="color: var(--color-gold, #C58A55); font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Direct Dispatch Vault</span>
          </div>
          <p class="body-14" style="color: var(--color-text-muted, #64748B); margin: 6px 0 0 0; font-size: 13.5px; line-height: 1.5;">
            Enter your destination coordinates in Nigeria for private doorstep courier delivery.
          </p>
        </div>

        <!-- Alert Notification -->
        <div id="kamAlert" style="display: none; padding: 12px 16px; border-radius: 6px; margin-bottom: 18px; font-size: 13px;"></div>

        <!-- Main Address Form -->
        <form id="kamForm" onsubmit="window.KrabeAddressForm.handleSubmit(event)">
          
          <div style="background: #FFFFFF; border: 1px solid var(--color-border, #E2E8F0); border-radius: 6px; padding: 20px; margin-bottom: 20px;">
            
            <!-- Row 1: Label and Full Name -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
              <div class="form-group" style="margin: 0;">
                <label for="kam_label" style="display: block; font-size: 12px; font-weight: 700; color: var(--color-obsidian, #121920); margin-bottom: 6px;">
                  Address Label / Tag <span style="color: #DC2626;">*</span>
                </label>
                <input type="text" id="kam_label" maxlength="30" class="form-input body-14" placeholder="e.g. Home, Office, Lagos Penthouse" required style="width: 100%; padding: 10px 14px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 14px; background: #FFFFFF; box-sizing: border-box;">
              </div>

              <div class="form-group" style="margin: 0;">
                <label for="kam_fullName" style="display: block; font-size: 12px; font-weight: 700; color: var(--color-obsidian, #121920); margin-bottom: 6px;">
                  Recipient Full Name <span style="color: #DC2626;">*</span>
                </label>
                <input type="text" id="kam_fullName" maxlength="60" class="form-input body-14" placeholder="e.g. David Adeleke" required style="width: 100%; padding: 10px 14px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 14px; background: #FFFFFF; box-sizing: border-box;">
              </div>
            </div>

            <!-- Row 2: Phone Number -->
            <div class="form-group" style="margin-bottom: 16px;">
              <label for="kam_phone" style="display: block; font-size: 12px; font-weight: 700; color: var(--color-obsidian, #121920); margin-bottom: 6px;">
                Recipient Phone Number <span style="color: #DC2626;">*</span>
              </label>
              <input type="tel" id="kam_phone" maxlength="25" class="form-input body-14" placeholder="e.g. +234 803 123 4567" required style="width: 100%; padding: 10px 14px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 14px; background: #FFFFFF; box-sizing: border-box;">
            </div>

            <!-- Row 3: Street Address Search Bar (PLACED ABOVE CITY & STATE) -->
            <div class="form-group" style="margin-bottom: 16px;">
              <label for="kam_street" style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; color: var(--color-obsidian, #121920); margin-bottom: 6px;">
                <span>Street Address &amp; Location <span style="color: #DC2626;">*</span></span>
                <span style="font-size: 11px; font-weight: 600; color: var(--color-gold, #C58A55); display: flex; align-items: center; gap: 4px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  Live Address Search
                </span>
              </label>
              <div style="position: relative;">
                <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #94A3B8; display: flex; align-items: center;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>
                <input type="text" id="kam_street" maxlength="150" class="form-input body-14" placeholder="Search street address, estate, or landmark in Nigeria..." required autocomplete="off" style="width: 100%; padding: 11px 14px 11px 38px; border: 1.5px solid var(--color-border, #CBD5E1); border-radius: 6px; font-size: 14px; background: #FFFFFF; box-sizing: border-box; transition: border-color 0.2s ease, box-shadow 0.2s ease;">
              </div>
              <p class="body-11" style="color: var(--color-text-muted, #64748B); margin: 6px 0 0 2px; font-size: 11.5px;">
                Start typing to search coordinates — selecting a location auto-populates City and State below.
              </p>
            </div>

            <!-- Row 4: City / LGA and State (AUTO-POPULATED FROM SEARCHBAR) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
              <div class="form-group" style="margin: 0;">
                <label for="kam_city" style="display: block; font-size: 12px; font-weight: 700; color: var(--color-obsidian, #121920); margin-bottom: 6px;">
                  City / Area / LGA <span style="color: #DC2626;">*</span>
                </label>
                <input type="text" id="kam_city" maxlength="80" class="form-input body-14" placeholder="e.g. Lekki Phase 1, Eti-Osa" required style="width: 100%; padding: 10px 14px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 14px; background: #FFFFFF; box-sizing: border-box;">
              </div>

              <div class="form-group" style="margin: 0;">
                <label for="kam_state" style="display: block; font-size: 12px; font-weight: 700; color: var(--color-obsidian, #121920); margin-bottom: 6px;">
                  State <span style="color: #DC2626;">*</span>
                </label>
                <select id="kam_state" class="form-input body-14" style="width: 100%; padding: 10px 14px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 14px; background: #FFFFFF; box-sizing: border-box;">
                  ${stateOptions}
                </select>
              </div>
            </div>

            <!-- Row 5: Landmark Notes -->
            <div class="form-group" style="margin-bottom: 14px;">
              <label for="kam_landmark" style="display: block; font-size: 12px; font-weight: 700; color: var(--color-obsidian, #121920); margin-bottom: 6px;">
                Prominent Landmark / Gate Notes <span style="font-weight: 400; color: var(--color-text-muted, #64748B);">(Optional)</span>
              </label>
              <input type="text" id="kam_landmark" maxlength="100" class="form-input body-14" placeholder="e.g. Opposite Sailor's Lounge, black gate" style="width: 100%; padding: 10px 14px; border: 1px solid var(--color-border, #CBD5E1); border-radius: 4px; font-size: 14px; background: #FFFFFF; box-sizing: border-box;">
            </div>

            <!-- Row 6: Set as Default Checkbox -->
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 12px; border-top: 1px dashed var(--color-border, #E2E8F0);">
              <input type="checkbox" id="kam_isDefault" style="width: 16px; height: 16px; accent-color: var(--color-primary, #44637B); cursor: pointer;">
              <label for="kam_isDefault" style="font-size: 13px; font-weight: 600; color: var(--color-obsidian, #121920); cursor: pointer; text-transform: none; letter-spacing: normal;">
                Set as my default delivery address
              </label>
            </div>

          </div>

          <!-- Bottom Action Buttons -->
          <div style="display: flex; gap: 12px; justify-content: space-between; align-items: center; border-top: 1px solid var(--color-border, #E2E8F0); padding-top: 20px; flex-wrap: wrap;">
            <div id="kamFormDeleteSlot"></div>
            <div style="display: flex; gap: 12px; align-items: center; margin-left: auto;">
              ${showBack ? `
                <button type="button" class="btn body-14" onclick="window.KrabeAddressForm.handleBack()" style="padding: 10px 22px; cursor: pointer; background: transparent; border: 1px solid var(--color-border, #CBD5E1); color: var(--color-obsidian, #121920); border-radius: 4px;">
                  Cancel
                </button>
              ` : `
                <button type="button" class="btn btn-outline body-14" onclick="window.KrabeAddressForm.closeModal()" style="padding: 10px 22px; cursor: pointer; background: transparent; border: 1px solid var(--color-border, #CBD5E1); color: var(--color-obsidian, #121920); border-radius: 4px;">
                  Cancel
                </button>
              `}
              <button type="submit" id="kamSubmitBtn" class="btn btn-primary body-14" style="padding: 11px 28px; background: var(--color-obsidian, #121920); color: #FFFFFF; font-weight: 600; cursor: pointer; border: none; border-radius: 4px;">
                ${submitLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    `;
  }

  function reset() {
    activeAddressId = null;
    currentEditingAddress = null;
    clearAlert();
    const form = document.getElementById('kamForm');
    if (form) form.reset();
    if (addressSearchBoxInstance && typeof addressSearchBoxInstance.clear === 'function') {
      addressSearchBoxInstance.clear();
    }

    const deleteSlot = document.getElementById('kamFormDeleteSlot');
    if (deleteSlot) deleteSlot.innerHTML = '';

    const title = document.getElementById('kamTitle');
    if (title) title.textContent = 'Add Delivery Address';

    const submitBtn = document.getElementById('kamSubmitBtn');
    if (submitBtn) {
      submitBtn.innerHTML = activeOptions.submitLabel || 'Save Delivery Address &rarr;';
    }
  }

  function populate(addressData) {
    if (!addressData || typeof addressData !== 'object') return;
    activeAddressId = addressData.id || null;
    currentEditingAddress = addressData;

    const title = document.getElementById('kamTitle');
    if (title) title.textContent = 'Edit Delivery Address';

    const labelEl = document.getElementById('kam_label');
    if (labelEl && addressData.label) labelEl.value = addressData.label;

    const fullNameEl = document.getElementById('kam_fullName');
    if (fullNameEl && addressData.full_name) fullNameEl.value = addressData.full_name;

    const phoneEl = document.getElementById('kam_phone');
    if (phoneEl && addressData.phone) phoneEl.value = addressData.phone;

    const streetEl = document.getElementById('kam_street');
    if (streetEl && addressData.street) {
      streetEl.value = addressData.street;
      if (addressSearchBoxInstance && typeof addressSearchBoxInstance.setValue === 'function') {
        addressSearchBoxInstance.setValue(addressData.street, true);
      }
    }

    const cityEl = document.getElementById('kam_city');
    if (cityEl && addressData.city) cityEl.value = addressData.city;

    const landmarkEl = document.getElementById('kam_landmark');
    if (landmarkEl && addressData.landmark) landmarkEl.value = addressData.landmark;

    const stateEl = document.getElementById('kam_state');
    if (stateEl && addressData.state) {
      const targetState = String(addressData.state).trim().toLowerCase();
      for (let i = 0; i < stateEl.options.length; i++) {
        if (stateEl.options[i].value.toLowerCase() === targetState) {
          stateEl.selectedIndex = i;
          break;
        }
      }
    }

    const defaultEl = document.getElementById('kam_isDefault');
    if (defaultEl) {
      defaultEl.checked = Boolean(addressData.is_default);
    }

    const deleteSlot = document.getElementById('kamFormDeleteSlot');
    if (deleteSlot && activeAddressId) {
      deleteSlot.innerHTML = `
        <button type="button" class="btn body-13" onclick="window.KrabeAddressForm.promptDelete('${activeAddressId}')" style="background: transparent; border: 1px solid #FECACA; color: #DC2626; padding: 8px 16px; border-radius: 4px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          Delete Address
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
      console.error('[KrabeAddressForm] Target container not found:', targetContainer);
      return;
    }

    container.innerHTML = buildFormHtml(options);
    reset();

    // Attach Google Places SearchBox if available
    const streetInput = container.querySelector('#kam_street');
    if (streetInput && window.KrabeAddressSearchBox && typeof window.KrabeAddressSearchBox.attach === 'function') {
      addressSearchBoxInstance = window.KrabeAddressSearchBox.attach(streetInput, {
        defaultValue: (options.initialData && options.initialData.street) || '',
        onPlaceSelect: (parsed) => {
          if (!parsed) return;

          // Auto-fill Street
          if (parsed.street) {
            streetInput.value = parsed.street;
          } else if (parsed.formatted_address) {
            streetInput.value = parsed.formatted_address;
          }

          // Auto-populate City / LGA
          const cityEl = container.querySelector('#kam_city');
          if (cityEl && parsed.city) {
            cityEl.value = parsed.city;
            cityEl.dispatchEvent(new Event('input', { bubbles: true }));
            cityEl.style.transition = 'border-color 0.3s ease, background-color 0.3s ease';
            cityEl.style.borderColor = 'var(--color-gold, #C58A55)';
            cityEl.style.backgroundColor = '#FAF8F5';
            setTimeout(() => {
              cityEl.style.borderColor = '';
              cityEl.style.backgroundColor = '';
            }, 1200);
          }

          // Auto-populate State dropdown
          const stateEl = container.querySelector('#kam_state');
          if (stateEl && parsed.state) {
            const parsedState = parsed.state.toLowerCase().trim();
            let matched = false;
            for (let i = 0; i < stateEl.options.length; i++) {
              const optVal = stateEl.options[i].value.toLowerCase().trim();
              if (optVal === parsedState || optVal.includes(parsedState) || parsedState.includes(optVal)) {
                stateEl.selectedIndex = i;
                stateEl.dispatchEvent(new Event('change', { bubbles: true }));
                matched = true;
                break;
              }
            }
            if (!matched && (parsedState.includes('abuja') || parsedState.includes('fct'))) {
              for (let i = 0; i < stateEl.options.length; i++) {
                const optVal = stateEl.options[i].value.toLowerCase();
                if (optVal.includes('fct') || optVal.includes('abuja')) {
                  stateEl.selectedIndex = i;
                  stateEl.dispatchEvent(new Event('change', { bubbles: true }));
                  matched = true;
                  break;
                }
              }
            }

            if (matched) {
              stateEl.style.transition = 'border-color 0.3s ease, background-color 0.3s ease';
              stateEl.style.borderColor = 'var(--color-gold, #C58A55)';
              stateEl.style.backgroundColor = '#FAF8F5';
              setTimeout(() => {
                stateEl.style.borderColor = '';
                stateEl.style.backgroundColor = '';
              }, 1200);
            }
          }
        }
      });
    }

    if (options.initialData) {
      populate(options.initialData);
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

    const labelInput = document.getElementById('kam_label');
    const label = labelInput ? labelInput.value.trim() : '';
    if (!label) {
      showAlert('Please enter an Address Label (e.g. Home, Office).', 'error');
      if (labelInput) labelInput.focus();
      return;
    }

    const fullNameInput = document.getElementById('kam_fullName');
    const fullName = fullNameInput ? fullNameInput.value.trim() : '';
    if (!fullName) {
      showAlert('Please enter the recipient full name.', 'error');
      if (fullNameInput) fullNameInput.focus();
      return;
    }

    const phoneInput = document.getElementById('kam_phone');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    if (!phone) {
      showAlert('Please enter a valid phone number for courier delivery.', 'error');
      if (phoneInput) phoneInput.focus();
      return;
    }

    const streetInput = document.getElementById('kam_street');
    const street = streetInput ? streetInput.value.trim() : '';
    if (!street) {
      showAlert('Please enter the street address.', 'error');
      if (streetInput) streetInput.focus();
      return;
    }

    const cityInput = document.getElementById('kam_city');
    const city = cityInput ? cityInput.value.trim() : '';
    if (!city) {
      showAlert('Please enter the city or LGA.', 'error');
      if (cityInput) cityInput.focus();
      return;
    }

    const stateInput = document.getElementById('kam_state');
    const state = stateInput ? stateInput.value.trim() : 'Lagos';

    const landmarkInput = document.getElementById('kam_landmark');
    const landmark = landmarkInput && landmarkInput.value.trim() ? landmarkInput.value.trim() : '';

    const isDefaultInput = document.getElementById('kam_isDefault');
    const isDefault = Boolean(isDefaultInput && isDefaultInput.checked);

    const submitBtn = document.getElementById('kamSubmitBtn');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Save Delivery Address &rarr;';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Saving Address...';
    }

    try {
      const client = getClient();
      if (!client) throw new Error('Database client not ready. Please try again.');

      const user = await getActiveUser(client);
      if (!user) throw new Error('Please sign in to save a delivery address.');

      // Fetch user's current profile addresses
      const { data: profile, error: fetchErr } = await client
        .from('profile')
        .select('addresses')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      let addresses = (profile && Array.isArray(profile.addresses)) ? [...profile.addresses] : [];

      let savedAddressObj = null;

      if (activeAddressId) {
        // UPDATE EXISTING ADDRESS
        const index = addresses.findIndex(a => String(a.id) === String(activeAddressId));
        if (index === -1) throw new Error('Address not found in your vault.');

        const existing = addresses[index];
        savedAddressObj = {
          ...existing,
          label,
          full_name: fullName,
          phone,
          street,
          city,
          state,
          landmark,
          is_default: isDefault,
          updated_at: new Date().toISOString()
        };

        if (isDefault) {
          addresses = addresses.map(a => ({ ...a, is_default: false }));
        }

        addresses[index] = savedAddressObj;
      } else {
        // CREATE NEW ADDRESS (Enforce MAX 10 LIMIT)
        if (addresses.length >= MAX_ADDRESSES) {
          throw new Error(`You have reached the maximum vault limit of ${MAX_ADDRESSES} delivery addresses. Please edit or delete an existing address.`);
        }

        const willBeDefault = addresses.length === 0 ? true : isDefault;

        if (willBeDefault) {
          addresses = addresses.map(a => ({ ...a, is_default: false }));
        }

        savedAddressObj = {
          id: generateUUID(),
          label,
          full_name: fullName,
          phone,
          street,
          city,
          state,
          landmark,
          is_default: willBeDefault,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        addresses.push(savedAddressObj);
      }

      // If no address is marked default but at least one exists, mark the first one as default
      if (addresses.length > 0 && !addresses.some(a => a.is_default)) {
        addresses[0].is_default = true;
      }

      // Persist to Supabase public.profile.addresses
      const { error: updateErr } = await client
        .from('profile')
        .update({
          addresses,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      showAlert('✓ Delivery address saved successfully to your vault!', 'success');

      // Dispatch global events
      window.dispatchEvent(new CustomEvent('krabe:address:saved', {
        detail: { address: savedAddressObj, addresses }
      }));

      if (typeof activeOptions.onSuccess === 'function') {
        activeOptions.onSuccess(savedAddressObj, addresses);
      }

      // Close standalone modal if open
      const standaloneModal = document.getElementById(MODAL_ID);
      if (standaloneModal && standaloneModal.classList.contains('active')) {
        setTimeout(() => {
          closeModal();
        }, 500);
      }

    } catch (err) {
      console.error('[KrabeAddressForm Save Error]:', err);
      showAlert(err.message || 'Could not save address. Please check your connection.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  }

  function openModal(addressData = null, options = {}) {
    let modal = document.getElementById(MODAL_ID);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = MODAL_ID;
      modal.className = 'modal-overlay';
      modal.style.zIndex = '2000';
      modal.setAttribute('aria-hidden', 'true');
      modal.onclick = (e) => { if (e.target === modal) closeModal(); };
      modal.innerHTML = `
        <div class="modal-card" style="background: var(--color-bone, #FAF8F5); border: 1px solid var(--color-border, #E2E8F0); border-radius: 8px; width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; padding: 32px 28px; position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
          <button type="button" class="modal-close" onclick="window.KrabeAddressForm.closeModal()" aria-label="Close" style="position: absolute; top: 18px; right: 18px; background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-obsidian, #121920); padding: 6px; line-height: 1;">✕</button>
          <div id="kamModalSlot"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    mount('#kamModalSlot', {
      initialData: addressData,
      onBack: closeModal,
      submitLabel: 'Save Delivery Address &rarr;',
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

  function promptDelete(addressOrId, options = {}) {
    deleteOptions = options || {};
    let address = null;

    if (addressOrId && typeof addressOrId === 'object') {
      address = addressOrId;
    } else if (typeof addressOrId === 'string') {
      if (currentEditingAddress && String(currentEditingAddress.id) === String(addressOrId)) {
        address = currentEditingAddress;
      } else {
        address = { id: addressOrId, label: options.label || '' };
      }
    }

    if (!address || !address.id) {
      console.warn('[KrabeAddressForm] No address provided to promptDelete');
      return;
    }

    pendingDeleteAddress = address;

    let modal = document.getElementById(DELETE_MODAL_ID);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = DELETE_MODAL_ID;
      modal.className = 'modal-overlay';
      modal.style.zIndex = '2100';
      modal.setAttribute('aria-hidden', 'true');
      modal.onclick = (e) => { if (e.target === modal) closeDeleteModal(); };
      modal.innerHTML = `
        <div class="modal-card" style="background: var(--color-bone, #FAF8F5); border: 1px solid var(--color-border, #E2E8F0); border-radius: 12px; width: 100%; max-width: 440px; padding: 28px 24px; position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.25); text-align: center;">
          <button type="button" class="modal-close" onclick="window.KrabeAddressForm.closeDeleteModal()" aria-label="Close" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 18px; cursor: pointer; color: var(--color-obsidian, #121920); padding: 4px; line-height: 1;">✕</button>
          
          <div style="width: 52px; height: 52px; border-radius: 50%; background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </div>

          <h3 class="h4" style="color: var(--color-obsidian, #121920); font-weight: 700; margin: 0 0 8px 0; font-size: 19px;">Delete Delivery Address?</h3>
          <p class="body-14" id="kamDeleteModalText" style="color: var(--color-text-muted, #64748B); margin: 0 0 22px 0; font-size: 13.5px; line-height: 1.5;">
            Are you sure you want to permanently delete this address from your saved addresses? This action cannot be undone.
          </p>

          <div id="kamDeleteAlert" style="display: none; padding: 10px 14px; background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; border-radius: 4px; font-size: 12px; margin-bottom: 16px; text-align: left;"></div>

          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn body-13" onclick="window.KrabeAddressForm.closeDeleteModal()" style="flex: 1; padding: 11px 18px; background: #FFFFFF; border: 1px solid var(--color-border, #CBD5E1); color: var(--color-obsidian, #121920); border-radius: 6px; font-weight: 600; cursor: pointer;">
              Cancel
            </button>
            <button type="button" id="kamConfirmDeleteBtn" class="btn body-13" onclick="window.KrabeAddressForm.executeDelete()" style="flex: 1; padding: 11px 18px; background: #DC2626; color: #FFFFFF; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
              Delete Address
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const textEl = document.getElementById('kamDeleteModalText');
    const label = address.label ? `"${address.label}"` : (address.street ? `"${address.street}"` : 'this address');
    if (textEl) {
      textEl.innerHTML = `Are you sure you want to permanently delete <strong>${escapeHtml(label)}</strong> from your saved delivery addresses? This action cannot be undone.`;
    }

    const alertEl = document.getElementById('kamDeleteAlert');
    if (alertEl) {
      alertEl.style.display = 'none';
      alertEl.textContent = '';
    }

    const delBtn = document.getElementById('kamConfirmDeleteBtn');
    if (delBtn) {
      delBtn.disabled = false;
      delBtn.textContent = 'Delete Address';
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
    pendingDeleteAddress = null;
  }

  async function executeDelete() {
    if (!pendingDeleteAddress || !pendingDeleteAddress.id) return;

    const delBtn = document.getElementById('kamConfirmDeleteBtn');
    if (delBtn) {
      delBtn.disabled = true;
      delBtn.textContent = 'Deleting...';
    }

    try {
      const client = getClient();
      if (!client) throw new Error('Database client unavailable');

      const user = await getActiveUser(client);
      if (!user) throw new Error('User authentication required.');

      const { data: profile, error: fetchErr } = await client
        .from('profile')
        .select('addresses')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      let addresses = (profile && Array.isArray(profile.addresses)) ? [...profile.addresses] : [];
      const targetId = pendingDeleteAddress.id;
      const wasDefault = addresses.find(a => String(a.id) === String(targetId))?.is_default;

      addresses = addresses.filter(a => String(a.id) !== String(targetId));

      // If we deleted the default and there are remaining addresses, set the first as default
      if (wasDefault && addresses.length > 0) {
        addresses[0].is_default = true;
      }

      const { error: updateErr } = await client
        .from('profile')
        .update({
          addresses,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      const deletedAddress = pendingDeleteAddress;
      closeDeleteModal();

      if (activeAddressId === targetId) {
        closeModal();
      }

      window.dispatchEvent(new CustomEvent('krabe:address:deleted', {
        detail: { id: targetId, address: deletedAddress, addresses }
      }));
      window.dispatchEvent(new CustomEvent('krabe:address:saved', {
        detail: { addresses }
      }));

      if (typeof deleteOptions.onSuccess === 'function') {
        deleteOptions.onSuccess(deletedAddress, addresses);
      }
    } catch (err) {
      console.error('[KrabeAddressForm Delete Error]:', err);
      const alertEl = document.getElementById('kamDeleteAlert');
      if (alertEl) {
        alertEl.textContent = err.message || 'Could not delete address. Please try again.';
        alertEl.style.display = 'block';
      }
      if (delBtn) {
        delBtn.disabled = false;
        delBtn.textContent = 'Delete Address';
      }
    }
  }

  async function setDefault(addressId) {
    if (!addressId) return;
    const client = getClient();
    if (!client) return;

    try {
      const user = await getActiveUser(client);
      if (!user) return;

      const { data: profile, error: fetchErr } = await client
        .from('profile')
        .select('addresses')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      let addresses = (profile && Array.isArray(profile.addresses)) ? [...profile.addresses] : [];
      addresses = addresses.map(a => ({
        ...a,
        is_default: String(a.id) === String(addressId)
      }));

      const { error: updateErr } = await client
        .from('profile')
        .update({
          addresses,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      window.dispatchEvent(new CustomEvent('krabe:address:saved', {
        detail: { addresses }
      }));
    } catch (err) {
      console.error('[KrabeAddressForm SetDefault Error]:', err);
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

  // Global API
  window.KrabeAddressForm = {
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
    setDefault,
    deleteAddress: promptDelete
  };

  // Backwards-compatibility alias
  window.KrabeAddressModal = {
    mount,
    open: openModal,
    close: closeModal,
    reset,
    handleSubmit,
    promptDelete,
    closeDeleteModal,
    setDefault
  };

})();

