/**
 * Krabe Kollection — App-wide Supabase & Environment Configuration
 * 
 * Automatically switches between Development (Live Server / localhost)
 * and Production (Live hosted website) environments.
 * 
 * Usage across any page:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="js/config.js"></script>
 */

(function () {
  'use strict';

  // Helper to normalize Supabase URL (strip /rest/v1 or trailing slashes)
  function normalizeUrl(url) {
    if (!url) return '';
    return url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  }

  // =========================================================================
  // 1. SUPABASE PROJECT CREDENTIALS (TWO SEPARATE FREE PROJECTS)
  // =========================================================================
  const ENV_CONFIGS = {
    // Development Project (used when running on VS Code Live Server / localhost)
    development: {
      supabaseUrl: normalizeUrl('https://myqtjagrzcgchfxhixzw.supabase.co/rest/v1/'),
      publishableKey: 'sb_publishable_VYAE1NTo38INYJzHE0j8CQ_Nd6jUSx6',
      envName: 'Development (Live Server / Localhost)'
    },

    // Production Project (used when running on live hosted domain / Vercel / Netlify)
    production: {
      supabaseUrl: normalizeUrl('https://gwknzycxxafhcyubtpps.supabase.co/rest/v1/'),
      publishableKey: 'sb_publishable_4M35YS4iivlnHaLcbvlKRA_I5id9F_k',
      envName: 'Production (Live Storefront)'
    }
  };

  // =========================================================================
  // 2. ENVIRONMENT DETECTION
  // =========================================================================
  const hostname = window.location.hostname;
  const isLocal = Boolean(
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local') ||
    window.location.protocol === 'file:'
  );

  const activeEnv = isLocal ? 'development' : 'production';
  const activeConfig = ENV_CONFIGS[activeEnv];

  console.log(
    `%c[Krabe Kollection]%c Active Mode: %c${activeConfig.envName}`,
    'color: #44637B; font-weight: bold;',
    'color: inherit;',
    'color: #10B981; font-weight: bold;'
  );

  // =========================================================================
  // 3. SINGLETON CLIENT INITIALIZATION
  // =========================================================================
  let client = null;

  function initClient() {
    if (client) return client;

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.warn('[Krabe Config] Supabase JS library not detected. Ensure https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 is loaded.');
      return null;
    }

    if (!activeConfig.supabaseUrl || activeConfig.supabaseUrl.includes('YOUR_PROD')) {
      console.warn(`[Krabe Config] Supabase URL is not configured for ${activeEnv}.`);
      return null;
    }

    const apiKey = activeConfig.publishableKey || activeConfig.supabaseAnonKey;
    if (!apiKey || apiKey.startsWith('YOUR_')) {
      console.warn(`[Krabe Config] Supabase Publishable Key is not set for ${activeEnv}.`);
      return null;
    }

    try {
      client = window.supabase.createClient(activeConfig.supabaseUrl, apiKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return client;
    } catch (err) {
      console.error('[Krabe Config] Error creating Supabase client:', err);
      return null;
    }
  }

  // Attempt client initialization if supabase SDK is already loaded
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    client = initClient();
  }

  // =========================================================================
  // 3.5 DYNAMIC APP VARIABLES (WHATSAPP, INSTAGRAM & TIKTOK SYNC)
  // =========================================================================
  let cachedContact = null;
  let cachedInstagram = null;
  let cachedTikTok = null;

  try {
    cachedContact = sessionStorage.getItem('krabe_whatsapp_contact') || localStorage.getItem('krabe_whatsapp_contact');
    cachedInstagram = sessionStorage.getItem('krabe_instagram') || localStorage.getItem('krabe_instagram');
    cachedTikTok = sessionStorage.getItem('krabe_tiktok') || localStorage.getItem('krabe_tiktok');
  } catch (_) {}

  function cleanWhatsAppDigits(raw) {
    if (!raw) return '2348000000000';
    let digits = String(raw).replace(/[^0-9]/g, '');
    if (digits.startsWith('0') && digits.length === 11) {
      digits = '234' + digits.slice(1);
    }
    return digits || '2348000000000';
  }

  function formatPhoneDisplay(raw) {
    if (!raw) return '+234 800 000 0000';
    let digits = String(raw).replace(/[^0-9]/g, '');
    if (digits.startsWith('234') && digits.length === 13) {
      return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
    }
    if (digits.startsWith('0') && digits.length === 11) {
      return `0${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    return String(raw).startsWith('+') ? String(raw) : `+${raw}`;
  }

  function formatInstagramUrl(raw) {
    if (!raw) return 'https://instagram.com';
    const val = String(raw).trim();
    if (!val) return 'https://instagram.com';
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    if (val.startsWith('@')) return `https://instagram.com/${val.slice(1)}`;
    return `https://instagram.com/${val}`;
  }

  function formatTikTokUrl(raw) {
    if (!raw) return 'https://tiktok.com';
    const val = String(raw).trim();
    if (!val) return 'https://tiktok.com';
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    if (val.startsWith('@')) return `https://tiktok.com/${val}`;
    return `https://tiktok.com/@${val}`;
  }

  function applyWhatsAppToDOM(rawContact) {
    const contact = rawContact || cachedContact;
    if (!contact) return;
    const digits = cleanWhatsAppDigits(contact);
    const display = formatPhoneDisplay(contact);

    // 1. Update all wa.me links anywhere on the page
    document.querySelectorAll('a[href*="wa.me"]').forEach(link => {
      const current = link.getAttribute('href') || '';
      const updated = current.replace(/wa\.me\/[0-9]+/, `wa.me/${digits}`);
      if (updated !== current) {
        link.setAttribute('href', updated);
      }
    });

    // 2. Update all visible phone display spans
    document.querySelectorAll('.js-whatsapp-display, [data-contact="whatsapp"]').forEach(el => {
      el.textContent = display;
    });

    // 3. Dispatch an event for any scripts listening
    window.dispatchEvent(new CustomEvent('krabe:contact:updated', {
      detail: { raw: contact, digits, display }
    }));
  }

  function applySocialsToDOM(rawInsta, rawTT) {
    const instaVal = rawInsta !== undefined ? rawInsta : cachedInstagram;
    const ttVal = rawTT !== undefined ? rawTT : cachedTikTok;

    const instaUrl = formatInstagramUrl(instaVal);
    const ttUrl = formatTikTokUrl(ttVal);

    // 1. Update Instagram links
    document.querySelectorAll('a[href*="instagram.com"], a[aria-label="Instagram"], [data-social="instagram"]').forEach(link => {
      link.setAttribute('href', instaUrl);
    });

    // 2. Update TikTok links
    document.querySelectorAll('a[href*="tiktok.com"], a[aria-label="TikTok"], [data-social="tiktok"]').forEach(link => {
      link.setAttribute('href', ttUrl);
    });

    // 3. Update any handle text spans if present (e.g. Lookbook caption)
    if (instaVal) {
      const handleDisplay = instaVal.startsWith('http') 
        ? ('@' + instaVal.split('/').filter(Boolean).pop())
        : (instaVal.startsWith('@') ? instaVal : `@${instaVal}`);
      document.querySelectorAll('.js-instagram-handle').forEach(el => {
        el.textContent = handleDisplay;
      });
    }

    // 4. Dispatch event
    window.dispatchEvent(new CustomEvent('krabe:socials:updated', {
      detail: { instagramUrl: instaUrl, tiktokUrl: ttUrl, rawInstagram: instaVal, rawTikTok: ttVal }
    }));
  }

  async function fetchAppVariableContact() {
    const sb = client || initClient();
    if (!sb) {
      setTimeout(fetchAppVariableContact, 150);
      return;
    }

    try {
      // Single call fetches all app_variables (WhatsApp, Instagram, TikTok, etc.)
      const { data, error } = await sb
        .from('app_variable')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        // 1. WhatsApp Contact
        const contact = data.whatsapp_contact || data['whatsapp contact'] || data.phone || null;
        if (contact) {
          cachedContact = contact;
          try {
            sessionStorage.setItem('krabe_whatsapp_contact', contact);
            localStorage.setItem('krabe_whatsapp_contact', contact);
          } catch (_) {}
          applyWhatsAppToDOM(contact);
        }

        // 2. Instagram
        const insta = data.instagram || data.instagram_handle || data['instagram handle'] || null;
        if (insta !== null && insta !== undefined) {
          cachedInstagram = insta;
          try {
            sessionStorage.setItem('krabe_instagram', insta);
            localStorage.setItem('krabe_instagram', insta);
          } catch (_) {}
        }

        // 3. TikTok
        const tt = data.tiktok || data.tiktok_handle || data['tiktok handle'] || null;
        if (tt !== null && tt !== undefined) {
          cachedTikTok = tt;
          try {
            sessionStorage.setItem('krabe_tiktok', tt);
            localStorage.setItem('krabe_tiktok', tt);
          } catch (_) {}
        }

        // Apply updated socials immediately
        applySocialsToDOM(cachedInstagram, cachedTikTok);
      }
    } catch (err) {
      console.warn('[Krabe Config] Could not load app_variables:', err);
    }
  }

  // Eagerly apply cached contact and socials as soon as DOM is interactive
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (cachedContact) applyWhatsAppToDOM(cachedContact);
      applySocialsToDOM(cachedInstagram, cachedTikTok);
      fetchAppVariableContact();
    });
  } else {
    if (cachedContact) applyWhatsAppToDOM(cachedContact);
    applySocialsToDOM(cachedInstagram, cachedTikTok);
    fetchAppVariableContact();
  }

  // =========================================================================
  // 4. GLOBAL EXPORTS
  // =========================================================================
  window.KRABE_CONFIG = {
    isLocal,
    env: activeEnv,
    config: activeConfig,
    getClient: () => client || initClient(),
    get client() {
      return client || initClient();
    }
  };

  window.KrabeContact = {
    getContact: () => cachedContact,
    getDigits: () => cleanWhatsAppDigits(cachedContact),
    getDisplay: () => formatPhoneDisplay(cachedContact),
    getInstagram: () => formatInstagramUrl(cachedInstagram),
    getTikTok: () => formatTikTokUrl(cachedTikTok),
    applyToDOM: () => {
      applyWhatsAppToDOM();
      applySocialsToDOM();
    },
    refresh: fetchAppVariableContact
  };

  // Convenient app-wide getter so window.krabeClient is always up to date
  try {
    Object.defineProperty(window, 'krabeClient', {
      get: () => client || initClient(),
      configurable: true
    });
  } catch (e) {
    window.krabeClient = window.KRABE_CONFIG.client;
  }

})();

