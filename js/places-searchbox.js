/**
 * Krabe Kollection — Reusable Address Searchbox Component
 * 
 * A modular, self-contained Google Places Autocomplete searchbox
 * built with luxury styling, automatic Google Places API script loading,
 * structured Nigerian address decomposition, and Bubble-style validation.
 * 
 * Usage:
 *   // 1. Mount to a container div:
 *   const searchbox = window.KrabeAddressSearchBox.create({
 *     container: '#myAddressContainer',
 *     placeholder: 'e.g. Plot 14, Block 2, Admiralty Way',
 *     defaultValue: '',
 *     onPlaceSelect: (address) => {
 *       console.log('Selected:', address.street, address.city, address.state);
 *     },
 *     onValidationChange: (isValid, value) => { ... }
 *   });
 * 
 *   // Or 2. Attach directly to an existing <input>:
 *   const searchbox = window.KrabeAddressSearchBox.attach('#existingInputId', {
 *     onPlaceSelect: (address) => { ... }
 *   });
 */

(function () {
  'use strict';

  // Inject luxury Krabe styling for Google Autocomplete dropdown once
  function injectStyles() {
    if (document.getElementById('krabePlacesSearchboxStyles')) return;
    const style = document.createElement('style');
    style.id = 'krabePlacesSearchboxStyles';
    style.textContent = `
      .pac-container {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
        border-radius: 4px !important;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12) !important;
        border: 1px solid #E2E8F0 !important;
        background-color: #FFFFFF !important;
        z-index: 1050 !important;
        margin-top: 4px !important;
      }
      .pac-item {
        padding: 10px 14px !important;
        font-size: 13px !important;
        cursor: pointer !important;
        color: #1E293B !important;
        border-top: 1px solid rgba(0, 0, 0, 0.05) !important;
        line-height: 1.4 !important;
      }
      .pac-item:hover, .pac-item-selected {
        background-color: #F8F6F0 !important;
      }
      .pac-item-query {
        font-size: 13px !important;
        color: #0F172A !important;
        font-weight: 600 !important;
        padding-right: 4px !important;
      }
      .pac-matched {
        color: #44637B !important;
        font-weight: 700 !important;
      }
      .pac-icon {
        margin-top: 3px !important;
      }
      .krabe-address-input-error {
        border-color: #DC2626 !important;
        background-color: #FEF2F2 !important;
      }
      .krabe-address-input-error:focus {
        outline: none !important;
        border-color: #DC2626 !important;
        box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15) !important;
      }
      .krabe-address-error-text {
        color: #DC2626;
        font-size: 12px;
        margin-top: 6px;
        font-weight: 500;
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  // Load Google Maps API with Places library asynchronously
  let googleMapsLoadingPromise = null;
  function ensureGooglePlacesLoaded(apiKey) {
    if (window.google && window.google.maps && window.google.maps.places) {
      return Promise.resolve();
    }
    if (googleMapsLoadingPromise) {
      return googleMapsLoadingPromise;
    }

    const key = apiKey || (window.KRABE_CONFIG && window.KRABE_CONFIG.googlePlacesApiKey) || '';
    if (!key) {
      return Promise.reject(new Error('Google Places API key is missing.'));
    }

    googleMapsLoadingPromise = new Promise((resolve, reject) => {
      const callbackName = '__initKrabePlacesGlobalCallback_' + Math.random().toString(36).substring(2, 8);
      window[callbackName] = function () {
        delete window[callbackName];
        resolve();
      };

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        delete window[callbackName];
        reject(new Error('Failed to load Google Maps Places script.'));
      };
      document.head.appendChild(script);
    });

    return googleMapsLoadingPromise;
  }

  // Decompose Google Place address components into clean structured data
  function parsePlaceComponents(place) {
    if (!place || !place.address_components) {
      return {
        formatted_address: place?.name || '',
        street: place?.name || '',
        street_number: '',
        route: '',
        city: '',
        state: '',
        country: 'Nigeria',
        lat: null,
        lng: null,
        place_id: place?.place_id || null,
        raw: place
      };
    }

    let streetNumber = '';
    let route = '';
    let neighborhood = '';
    let locality = '';
    let sublocality = '';
    let adminArea = '';
    let country = 'Nigeria';

    place.address_components.forEach(comp => {
      const types = comp.types || [];
      if (types.includes('street_number')) streetNumber = comp.long_name;
      if (types.includes('route')) route = comp.long_name;
      if (types.includes('neighborhood')) neighborhood = comp.long_name;
      if (types.includes('sublocality') || types.includes('sublocality_level_1')) sublocality = comp.long_name;
      if (types.includes('locality')) locality = comp.long_name;
      if (types.includes('administrative_area_level_1')) adminArea = comp.long_name;
      if (types.includes('country')) country = comp.long_name;
    });

    // Street address: street number + route (or place name fallback)
    let street = [streetNumber, route].filter(Boolean).join(' ');
    if (!street && place.name && !place.name.includes(locality)) {
      street = place.name;
    }
    if (!street && place.formatted_address) {
      street = place.formatted_address.split(',')[0].trim();
    }

    // City / LGA: neighborhood / sublocality / locality
    const city = [sublocality || neighborhood, locality].filter(Boolean).join(', ') || locality || sublocality || '';

    // State: clean "State" suffix if present (e.g. "Lagos State" -> "Lagos")
    const cleanState = adminArea ? adminArea.replace(/\s+state$/i, '').trim() : '';

    const lat = place.geometry?.location ? place.geometry.location.lat() : null;
    const lng = place.geometry?.location ? place.geometry.location.lng() : null;

    return {
      formatted_address: place.formatted_address || street,
      street,
      street_number: streetNumber,
      route,
      city,
      state: cleanState,
      country,
      lat,
      lng,
      place_id: place.place_id || null,
      raw: place
    };
  }

  /**
   * AddressSearchBox Controller Class
   */
  class AddressSearchBox {
    constructor(inputElement, options = {}) {
      this.input = inputElement;
      this.options = Object.assign({
        country: 'ng',
        defaultValue: '',
        minValidLength: 6,
        showErrorOnBlur: true,
        errorMessage: 'Please enter a valid street address (e.g. Plot 14, Admiralty Way).',
        onPlaceSelect: null,
        onValidationChange: null,
        onInput: null
      }, options);

      this.errorElement = null;
      this.autocomplete = null;
      this.selectedPlace = null;
      this.isPlaceVerified = false;

      injectStyles();
      this._setupDOM();
      this._bindEvents();
      this._initGoogleAutocomplete();
    }

    _setupDOM() {
      // Set default value (defaults to empty string)
      if (this.input) {
        this.input.value = this.options.defaultValue || '';
        this.input.autocomplete = 'off';
      }

      // Find or create associated error text element
      if (this.input && this.input.parentElement) {
        let existingError = this.input.parentElement.querySelector('.krabe-address-error-text');
        if (!existingError) {
          existingError = document.createElement('div');
          existingError.className = 'krabe-address-error-text';
          existingError.textContent = this.options.errorMessage;
          this.input.insertAdjacentElement('afterend', existingError);
        }
        this.errorElement = existingError;
      }
    }

    _bindEvents() {
      if (!this.input) return;

      this.input.addEventListener('input', () => {
        // Any manual edit resets strict Google place verification
        this.isPlaceVerified = false;
        this.selectedPlace = null;

        const val = this.input.value.trim();
        const valid = this.isValid();

        // If user is currently typing a valid street length, clear any lingering error
        if (valid) {
          this.clearError();
        }

        if (typeof this.options.onInput === 'function') {
          this.options.onInput(val);
        }
        if (typeof this.options.onValidationChange === 'function') {
          this.options.onValidationChange(valid, val);
        }
      });

      if (this.options.showErrorOnBlur) {
        this.input.addEventListener('blur', () => {
          const val = this.input.value.trim();
          if (val.length > 0 && !this.isValid()) {
            this.showError();
          }
        });
      }
    }

    async _initGoogleAutocomplete() {
      try {
        await ensureGooglePlacesLoaded(this.options.apiKey);
        if (!this.input) return;

        this.autocomplete = new google.maps.places.Autocomplete(this.input, {
          componentRestrictions: this.options.country ? { country: this.options.country } : undefined,
          fields: ['address_components', 'formatted_address', 'geometry', 'name', 'place_id']
        });

        this.autocomplete.addListener('place_changed', () => {
          const place = this.autocomplete.getPlace();
          if (!place || !place.address_components) return;

          const parsed = parsePlaceComponents(place);
          this.selectedPlace = parsed;
          this.isPlaceVerified = true;

          // Populate the input with clean street address
          this.input.value = parsed.street || parsed.formatted_address;
          this.clearError();

          if (typeof this.options.onPlaceSelect === 'function') {
            this.options.onPlaceSelect(parsed, place);
          }
          if (typeof this.options.onValidationChange === 'function') {
            this.options.onValidationChange(true, this.input.value);
          }
        });
      } catch (err) {
        console.warn('[KrabeAddressSearchBox] Autocomplete fallback to manual typing:', err);
      }
    }

    // =========================================================================
    // PUBLIC API METHODS (Bubble Principles)
    // =========================================================================

    /**
     * Checks if the current address input is valid.
     * True if verified Google place OR manual text with >= minValidLength and letters.
     */
    isValid() {
      if (this.isPlaceVerified) return true;
      const val = this.input ? this.input.value.trim() : '';
      return val.length >= this.options.minValidLength && /[a-zA-Z]/.test(val);
    }

    /**
     * Checks if the searchbox input is completely empty.
     */
    isEmpty() {
      return !this.input || this.input.value.trim().length === 0;
    }

    /**
     * Get the current string value of the input.
     */
    getValue() {
      return this.input ? this.input.value.trim() : '';
    }

    /**
     * Get the parsed place object (populated when picked from Google).
     */
    getPlace() {
      return this.selectedPlace;
    }

    /**
     * Sets value programmatically.
     */
    setValue(val, isVerified = false) {
      if (this.input) {
        this.input.value = val || '';
      }
      this.isPlaceVerified = Boolean(isVerified);
      if (!isVerified) this.selectedPlace = null;
      if (this.isValid()) {
        this.clearError();
      }
    }

    /**
     * Highlights input in red and reveals error text.
     */
    showError(customMessage) {
      if (this.input) {
        this.input.classList.add('krabe-address-input-error');
      }
      if (this.errorElement) {
        if (customMessage) this.errorElement.textContent = customMessage;
        this.errorElement.style.display = 'block';
      }
    }

    /**
     * Removes red highlight and hides error text.
     */
    clearError() {
      if (this.input) {
        this.input.classList.remove('krabe-address-input-error');
      }
      if (this.errorElement) {
        this.errorElement.style.display = 'none';
      }
    }

    /**
     * Clear value and reset validation state.
     */
    clear() {
      this.setValue('', false);
      this.clearError();
    }

    /**
     * Focus the input field.
     */
    focus() {
      if (this.input) this.input.focus();
    }
  }

  // =========================================================================
  // GLOBAL EXPORTS
  // =========================================================================
  window.KrabeAddressSearchBox = {
    /**
     * Creates and mounts a new SearchBox element inside a container.
     */
    create: function (config = {}) {
      const container = typeof config.container === 'string'
        ? document.querySelector(config.container)
        : config.container;

      if (!container) {
        console.error('[KrabeAddressSearchBox] Container not found:', config.container);
        return null;
      }

      const input = document.createElement('input');
      input.type = 'text';
      input.className = config.className || 'form-input body-14';
      input.placeholder = config.placeholder || 'e.g. Plot 14, Block 2, Admiralty Way';
      container.appendChild(input);

      return new AddressSearchBox(input, config);
    },

    /**
     * Attaches to an existing input element on the page.
     */
    attach: function (target, options = {}) {
      const input = typeof target === 'string' ? document.querySelector(target) : target;
      if (!input) {
        console.error('[KrabeAddressSearchBox] Input not found:', target);
        return null;
      }
      return new AddressSearchBox(input, options);
    }
  };

})();

