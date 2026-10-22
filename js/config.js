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

  // =========================================================================
  // 1. SUPABASE PROJECT CREDENTIALS
  // (Paste your project credentials here — only use PUBLIC ANON keys, never service_role!)
  // =========================================================================
  const ENV_CONFIGS = {
    // Development Environment (used when running on VS Code Live Server / localhost)
    development: {
      supabaseUrl: 'https://myqtjagrzcgchfxhlxzw.supabase.co', // Dev Project: Krabe dev (main)
      supabaseAnonKey: 'YOUR_DEV_SUPABASE_ANON_KEY',           // <--- Paste Dev Anon Key here
      envName: 'Development (Live Server / Localhost)'
    },

    // Production Environment (used when running on live hosted domain / Vercel / Netlify)
    production: {
      supabaseUrl: 'YOUR_PROD_SUPABASE_URL',                   // <--- Paste Prod URL here
      supabaseAnonKey: 'YOUR_PROD_SUPABASE_ANON_KEY',           // <--- Paste Prod Anon Key here
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

    if (!activeConfig.supabaseAnonKey || activeConfig.supabaseAnonKey.startsWith('YOUR_')) {
      console.warn(`[Krabe Config] Supabase Anon Key is not set for ${activeEnv}.`);
      return null;
    }

    try {
      client = window.supabase.createClient(activeConfig.supabaseUrl, activeConfig.supabaseAnonKey, {
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

  // Convenient app-wide alias
  window.krabeClient = window.KRABE_CONFIG.client;

})();

