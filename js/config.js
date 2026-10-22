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

