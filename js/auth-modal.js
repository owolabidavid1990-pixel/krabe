/**
 * Krabe Kollection — Drop-in Client Auth Modal Component
 * 
 * Provides a self-contained, luxury modal for:
 *  - Client Sign In
 *  - Client Account Creation (Registration)
 *  - Password Recovery (Forgot Password)
 * 
 * Can be dropped into any page by including this script:
 *   <script src="js/auth-modal.js"></script>
 * 
 * Global API:
 *   window.KrabeAuthModal.open('signin' | 'register' | 'forgot')
 *   window.KrabeAuthModal.close()
 *   window.KrabeAuthModal.showAlert(message, 'error' | 'success' | 'info')
 *   window.KrabeAuthModal.clearAlert()
 */

(function () {
  'use strict';

  const MODAL_ID = 'krabeAuthModal';

  // SVG Icons
  const ICONS = {
    eye: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`,
    eyeSlash: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>`,
    alertError: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    alertSuccess: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/></svg>`,
    google: `<svg class="google-icon" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>`
  };

  function getModalHTML() {
    return `
      <div class="krabe-auth-overlay" id="${MODAL_ID}" aria-hidden="true" role="dialog" aria-modal="true">
        <div class="krabe-auth-card">
          <button type="button" class="krabe-auth-close" id="krabeAuthCloseBtn" aria-label="Close dialog">✕</button>
          
          <!-- Brand Header -->
          <div class="krabe-auth-header">
            <img src="assets/brand/krabe main logo.svg" alt="Krabe Logo" class="krabe-auth-logo">
            <h2 class="krabe-auth-title" id="krabeAuthTitle">Client Access</h2>
            <p class="krabe-auth-subtitle" id="krabeAuthSubtitle">Sign in to manage tailored measurements, active commissions, and order history.</p>
          </div>

          <!-- Alert / Status Notice Banner -->
          <div class="krabe-auth-alert" id="krabeAuthAlert" role="alert">
            <span class="krabe-auth-alert-icon"></span>
            <span class="krabe-auth-alert-text"></span>
          </div>

          <!-- Segmented Tab Switcher (Sign In vs Register) -->
          <div class="krabe-auth-tabs" id="krabeAuthTabs">
            <button type="button" class="krabe-auth-tab-btn active" id="krabeTabSignIn" data-tab="signin">Sign In</button>
            <button type="button" class="krabe-auth-tab-btn" id="krabeTabRegister" data-tab="register">Create Account</button>
          </div>

          <!-- VIEW 1: SIGN IN FORM -->
          <form id="krabeSignInForm" class="krabe-auth-view active" autocomplete="on">
            <!-- Google One-Click Sign In -->
            <button type="button" class="krabe-google-btn js-krabe-google-btn">
              ${ICONS.google}
              <span class="btn-text">Continue with Google</span>
              <span class="spinner"></span>
            </button>

            <div class="krabe-auth-divider">
              <span>or sign in with email</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="krabeLoginEmail">Email Address <span class="req">*</span></label>
              <input type="email" id="krabeLoginEmail" name="email" class="form-input" placeholder="e.g. client@example.com" required autocomplete="email">
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                <label class="form-label" for="krabeLoginPassword" style="margin-bottom: 0;">Password <span class="req">*</span></label>
                <button type="button" id="krabeForgotLink" class="body-12" style="background: none; border: none; color: var(--color-primary); cursor: pointer; text-decoration: underline; padding: 0;">Forgot Password?</button>
              </div>
              <div class="krabe-input-wrap">
                <input type="password" id="krabeLoginPassword" name="password" class="form-input" placeholder="••••••••••••" required autocomplete="current-password">
                <button type="button" class="krabe-pwd-toggle" data-target="krabeLoginPassword" aria-label="Toggle password visibility">
                  ${ICONS.eye}
                </button>
              </div>
            </div>

            <div class="body-12" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; color: var(--color-text-muted);">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="krabeRememberMe" checked style="accent-color: var(--color-primary); cursor: pointer;">
                <span>Remember this device</span>
              </label>
            </div>

            <button type="submit" class="btn btn-primary krabe-auth-btn" id="krabeSignInSubmit">
              <span class="spinner"></span>
              <span class="btn-text">Sign In &rarr;</span>
            </button>
          </form>

          <!-- VIEW 2: CREATE ACCOUNT FORM -->
          <form id="krabeRegisterForm" class="krabe-auth-view" autocomplete="on">
            <!-- Google One-Click Registration -->
            <button type="button" class="krabe-google-btn js-krabe-google-btn">
              ${ICONS.google}
              <span class="btn-text">Sign up with Google</span>
              <span class="spinner"></span>
            </button>

            <div class="krabe-auth-divider">
              <span>or register with email</span>
            </div>

            <!-- Pending OTP Resume Banner -->
            <div id="krabePendingResumeNotice" class="body-12" style="display: none; background: rgba(212, 175, 55, 0.12); border: 1px solid var(--color-gold-light); padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; line-height: 1.4; color: var(--color-obsidian);">
              <span>Code pending for <strong id="krabePendingResumeEmail"></strong>.</span>
              <button type="button" id="krabeResumeOtpBtn" style="background: none; border: none; color: var(--color-primary); font-weight: 700; cursor: pointer; text-decoration: underline; margin-left: 6px;">
                Enter code &rarr;
              </button>
            </div>

            <div class="form-group">
              <label class="form-label" for="krabeRegFullName">Full Name <span class="req">*</span></label>
              <input type="text" id="krabeRegFullName" name="fullName" class="form-input" placeholder="e.g. Adebayo Adeleke" required autocomplete="name">
            </div>

            <div class="form-group">
              <label class="form-label" for="krabeRegEmail">Email Address <span class="req">*</span></label>
              <input type="email" id="krabeRegEmail" name="email" class="form-input" placeholder="e.g. adebayo@example.com" required autocomplete="email">
            </div>

            <div class="form-group">
              <label class="form-label" for="krabeRegPhone">Phone / WhatsApp <span class="req">*</span></label>
              <input type="tel" id="krabeRegPhone" name="phone" class="form-input" placeholder="+234 800 000 0000" required autocomplete="tel">
              <span class="body-12" style="color: var(--color-text-muted); margin-top: 2px;">Used for fitting confirmations and dispatch tracking.</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="krabeRegPassword">Create Password <span class="req">*</span></label>
              <div class="krabe-input-wrap">
                <input type="password" id="krabeRegPassword" name="password" class="form-input" placeholder="At least 8 characters" required minlength="8" autocomplete="new-password">
                <button type="button" class="krabe-pwd-toggle" data-target="krabeRegPassword" aria-label="Toggle password visibility">
                  ${ICONS.eye}
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="krabeRegConfirmPassword">Confirm Password <span class="req">*</span></label>
              <div class="krabe-input-wrap">
                <input type="password" id="krabeRegConfirmPassword" name="confirmPassword" class="form-input" placeholder="Re-enter password" required minlength="8" autocomplete="new-password">
                <button type="button" class="krabe-pwd-toggle" data-target="krabeRegConfirmPassword" aria-label="Toggle password visibility">
                  ${ICONS.eye}
                </button>
              </div>
            </div>

            <button type="submit" class="btn btn-primary krabe-auth-btn" id="krabeRegisterSubmit">
              <span class="spinner"></span>
              <span class="btn-text">Create Krabe Account</span>
            </button>
          </form>

          <!-- VIEW 3: FORGOT PASSWORD FORM -->
          <form id="krabeForgotForm" class="krabe-auth-view" autocomplete="on">
            <p class="body-14" style="color: var(--color-text-muted); line-height: 1.5; margin-bottom: 20px;">
              Enter your registered email address and we will send you a secure link to reset your account credentials.
            </p>

            <div class="form-group">
              <label class="form-label" for="krabeForgotEmail">Email Address <span class="req">*</span></label>
              <input type="email" id="krabeForgotEmail" name="email" class="form-input" placeholder="e.g. client@example.com" required autocomplete="email">
            </div>

            <button type="submit" class="btn btn-primary krabe-auth-btn" id="krabeForgotSubmit">
              <span class="spinner"></span>
              <span class="btn-text">Send Recovery Link</span>
            </button>

            <div style="text-align: center; margin-top: 16px;">
              <button type="button" id="krabeBackToSignInBtn" class="body-12" style="background: none; border: none; font-weight: 600; color: var(--color-primary); cursor: pointer;">
                &larr; Back to Sign In
              </button>
            </div>
          </form>

          <!-- VIEW 4: EMAIL OTP CONFIRMATION VIEW -->
          <form id="krabeOtpForm" class="krabe-auth-view" autocomplete="off">
            <div style="text-align: center; margin-bottom: 20px;">
              <p class="body-14" style="color: var(--color-obsidian); font-weight: 700; margin-bottom: 6px; letter-spacing: 0.5px;">
                6-Digit Code
              </p>
              <p class="body-12" style="color: var(--color-text-muted); line-height: 1.5;">
                Sent to <strong id="krabeOtpEmailDisplay" style="color: var(--color-obsidian);">your email</strong>.
              </p>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
              <input type="text" id="krabeOtpCode" name="otpCode" class="form-input" 
                     placeholder="• • • • • •" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" 
                     required autocomplete="one-time-code"
                     style="text-align: center; font-size: 24px; font-weight: 700; letter-spacing: 8px; padding: 12px 16px;">
            </div>

            <button type="submit" class="btn btn-primary krabe-auth-btn" id="krabeOtpSubmit">
              <span class="spinner"></span>
              <span class="btn-text">Confirm Code &rarr;</span>
            </button>

            <div class="body-12" style="display: flex; justify-content: space-between; align-items: center; margin-top: 18px;">
              <button type="button" id="krabeBackToRegBtn" style="background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 0;">
                &larr; Edit details
              </button>
              <button type="button" id="krabeResendOtpBtn" style="background: none; border: none; color: var(--color-primary); font-weight: 600; cursor: pointer; padding: 0;">
                Resend code
              </button>
            </div>
          </form>

          <!-- Legal & Privacy Disclaimer Footer -->
          <div class="krabe-auth-footer">
            By proceeding, you agree to Krabe Kollection's 
            <a href="help.html#terms">Terms of Service</a> &amp; 
            <a href="help.html#privacy">Privacy Policy</a>.
          </div>
        </div>
      </div>
    `;
  }

  // Ensure modal DOM element is mounted into body
  function ensureMounted() {
    if (!document.getElementById(MODAL_ID)) {
      const container = document.createElement('div');
      container.innerHTML = getModalHTML().trim();
      document.body.appendChild(container.firstElementChild);
      bindEvents();
    }
  }

  // State
  let currentView = 'signin';

  function switchView(view) {
    ensureMounted();
    currentView = view;
    clearAlert();

    const titleEl = document.getElementById('krabeAuthTitle');
    const subtitleEl = document.getElementById('krabeAuthSubtitle');
    const tabsContainer = document.getElementById('krabeAuthTabs');
    const tabSignIn = document.getElementById('krabeTabSignIn');
    const tabRegister = document.getElementById('krabeTabRegister');

    const formSignIn = document.getElementById('krabeSignInForm');
    const formRegister = document.getElementById('krabeRegisterForm');
    const formForgot = document.getElementById('krabeForgotForm');
    const formOtp = document.getElementById('krabeOtpForm');

    // Remove active from all forms
    [formSignIn, formRegister, formForgot, formOtp].forEach(f => f && f.classList.remove('active'));

    if (view === 'signin') {
      if (tabsContainer) tabsContainer.style.display = 'flex';
      if (tabSignIn) tabSignIn.classList.add('active');
      if (tabRegister) tabRegister.classList.remove('active');
      if (formSignIn) formSignIn.classList.add('active');
      if (titleEl) titleEl.textContent = 'Client Access';
      if (subtitleEl) subtitleEl.textContent = 'Sign in to manage tailored measurements, active commissions, and order history.';
    } else if (view === 'register') {
      if (tabsContainer) tabsContainer.style.display = 'flex';
      if (tabRegister) tabRegister.classList.add('active');
      if (tabSignIn) tabSignIn.classList.remove('active');
      if (formRegister) formRegister.classList.add('active');
      if (titleEl) titleEl.textContent = 'Create Account';
      if (subtitleEl) subtitleEl.textContent = 'Join Krabe Kollection for personalized tailoring profiles and bespoke tracking.';

      // Check if user has an uncompleted OTP registration in localStorage
      const pendingNotice = document.getElementById('krabePendingResumeNotice');
      const pendingEmailSpan = document.getElementById('krabePendingResumeEmail');
      let storedEmail = null;
      try {
        storedEmail = localStorage.getItem('krabe_pending_otp_email');
      } catch (_) {}

      if (pendingNotice && storedEmail) {
        pendingNotice.style.display = 'block';
        if (pendingEmailSpan) pendingEmailSpan.textContent = storedEmail;
        const regEmailInput = document.getElementById('krabeRegEmail');
        if (regEmailInput && !regEmailInput.value) regEmailInput.value = storedEmail;
      } else if (pendingNotice) {
        pendingNotice.style.display = 'none';
      }
    } else if (view === 'forgot') {
      if (tabsContainer) tabsContainer.style.display = 'none'; // Hide tabs on forgot view
      if (formForgot) formForgot.classList.add('active');
      if (titleEl) titleEl.textContent = 'Account Recovery';
      if (subtitleEl) subtitleEl.textContent = 'Follow the steps below to restore access to your account.';
    } else if (view === 'otp') {
      if (tabsContainer) tabsContainer.style.display = 'none'; // Hide tabs on OTP view
      if (formOtp) formOtp.classList.add('active');
      if (titleEl) titleEl.textContent = 'Verification';
      if (subtitleEl) subtitleEl.textContent = 'Enter the 6-digit code sent to your inbox.';
    }
  }

  let pendingEmail = '';

  function promptOtp(email) {
    ensureMounted();
    pendingEmail = (email || '').trim();
    if (pendingEmail) {
      try {
        localStorage.setItem('krabe_pending_otp_email', pendingEmail);
      } catch (_) {}
    }
    const emailDisplay = document.getElementById('krabeOtpEmailDisplay');
    if (emailDisplay && pendingEmail) emailDisplay.textContent = pendingEmail;
    const otpInput = document.getElementById('krabeOtpCode');
    if (otpInput) otpInput.value = '';
    switchView('otp');
  }

  function open(view = 'signin') {
    ensureMounted();
    switchView(view);
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      // Autofocus first visible input
      setTimeout(() => {
        const activeForm = modal.querySelector('.krabe-auth-view.active');
        if (activeForm) {
          const firstInput = activeForm.querySelector('input:not([type=hidden])');
          if (firstInput) firstInput.focus();
        }
      }, 150);
    }
  }

  function close() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      clearAlert();
    }
  }

  function showAlert(message, type = 'error') {
    ensureMounted();
    const alertBox = document.getElementById('krabeAuthAlert');
    if (!alertBox) return;

    const iconSpan = alertBox.querySelector('.krabe-auth-alert-icon');
    const textSpan = alertBox.querySelector('.krabe-auth-alert-text');

    alertBox.className = `krabe-auth-alert ${type} show`;
    if (iconSpan) {
      iconSpan.innerHTML = type === 'success' ? ICONS.alertSuccess : ICONS.alertError;
    }
    if (textSpan) {
      textSpan.textContent = message;
    }
  }

  function clearAlert() {
    const alertBox = document.getElementById('krabeAuthAlert');
    if (alertBox) {
      alertBox.className = 'krabe-auth-alert';
      const textSpan = alertBox.querySelector('.krabe-auth-alert-text');
      if (textSpan) textSpan.textContent = '';
    }
  }

  function setLoading(formId, isLoading) {
    const form = document.getElementById(formId);
    if (!form) return;
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;

    if (isLoading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  function bindEvents() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;

    // Close button
    const closeBtn = document.getElementById('krabeAuthCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', close);

    // Backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    // Google OAuth Trigger
    modal.querySelectorAll('.js-krabe-google-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('krabe:auth:google'));
      });
    });

    // Tab buttons
    const tabSignIn = document.getElementById('krabeTabSignIn');
    const tabRegister = document.getElementById('krabeTabRegister');
    if (tabSignIn) tabSignIn.addEventListener('click', () => switchView('signin'));
    if (tabRegister) tabRegister.addEventListener('click', () => switchView('register'));

    // Forgot password link & Back button
    const forgotLink = document.getElementById('krabeForgotLink');
    if (forgotLink) forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('forgot');
    });

    const backBtn = document.getElementById('krabeBackToSignInBtn');
    if (backBtn) backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('signin');
    });

    // Password visibility toggle
    modal.querySelectorAll('.krabe-pwd-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          btn.innerHTML = isPassword ? ICONS.eyeSlash : ICONS.eye;
        }
      });
    });

    // Form submission placeholders (ready for Supabase wiring after user review)
    const formSignIn = document.getElementById('krabeSignInForm');
    const formRegister = document.getElementById('krabeRegisterForm');
    const formForgot = document.getElementById('krabeForgotForm');

    if (formSignIn) {
      formSignIn.addEventListener('submit', (e) => {
        e.preventDefault();
        const event = new CustomEvent('krabe:auth:signin', {
          detail: {
            email: document.getElementById('krabeLoginEmail').value.trim(),
            password: document.getElementById('krabeLoginPassword').value,
            remember: document.getElementById('krabeRememberMe').checked
          }
        });
        window.dispatchEvent(event);
      });
    }

    if (formRegister) {
      formRegister.addEventListener('submit', (e) => {
        e.preventDefault();
        const pwd = document.getElementById('krabeRegPassword').value;
        const confirmPwd = document.getElementById('krabeRegConfirmPassword').value;

        if (pwd !== confirmPwd) {
          showAlert('Passwords do not match. Please verify and try again.', 'error');
          return;
        }

        const event = new CustomEvent('krabe:auth:register', {
          detail: {
            fullName: document.getElementById('krabeRegFullName').value.trim(),
            email: document.getElementById('krabeRegEmail').value.trim(),
            phone: document.getElementById('krabeRegPhone').value.trim(),
            password: pwd
          }
        });
        window.dispatchEvent(event);
      });
    }

    if (formForgot) {
      formForgot.addEventListener('submit', (e) => {
        e.preventDefault();
        const event = new CustomEvent('krabe:auth:forgot', {
          detail: {
            email: document.getElementById('krabeForgotEmail').value.trim()
          }
        });
        window.dispatchEvent(event);
      });
    }

    // OTP Verification & Resend
    const formOtp = document.getElementById('krabeOtpForm');
    if (formOtp) {
      formOtp.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = document.getElementById('krabeOtpCode').value.trim();
        if (code.length !== 6) {
          showAlert('Please enter the complete 6-digit verification code.', 'error');
          return;
        }

        let email = pendingEmail;
        if (!email) {
          try { email = localStorage.getItem('krabe_pending_otp_email') || ''; } catch (_) {}
        }
        if (!email) {
          const regInput = document.getElementById('krabeRegEmail');
          if (regInput) email = regInput.value.trim();
        }

        const event = new CustomEvent('krabe:auth:verify-otp', {
          detail: {
            email,
            token: code
          }
        });
        window.dispatchEvent(event);
      });
    }

    const backToRegBtn = document.getElementById('krabeBackToRegBtn');
    if (backToRegBtn) {
      backToRegBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('register');
      });
    }

    const resumeOtpBtn = document.getElementById('krabeResumeOtpBtn');
    if (resumeOtpBtn) {
      resumeOtpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        let stored = null;
        try {
          stored = localStorage.getItem('krabe_pending_otp_email');
        } catch (_) {}
        if (stored) {
          promptOtp(stored);
          showAlert('Enter your 6-digit verification code below. Note: Your active password remains the one set during your initial sign-up.', 'info');
        }
      });
    }

    const resendOtpBtn = document.getElementById('krabeResendOtpBtn');
    if (resendOtpBtn) {
      resendOtpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        let email = pendingEmail;
        if (!email) {
          try { email = localStorage.getItem('krabe_pending_otp_email') || ''; } catch (_) {}
        }
        if (!email) {
          const regInput = document.getElementById('krabeRegEmail');
          if (regInput) email = regInput.value.trim();
        }
        const event = new CustomEvent('krabe:auth:resend-otp', {
          detail: { email }
        });
        window.dispatchEvent(event);
      });
    }
  }

  // Keyboard Escape listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById(MODAL_ID);
      if (modal && modal.classList.contains('active')) {
        close();
      }
    }
  });

  // Global triggers: any button with [data-auth-trigger] or .js-open-auth
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-auth-trigger], .js-open-auth');
    if (trigger) {
      e.preventDefault();
      const view = trigger.dataset.authTrigger || 'signin';
      open(view);
    }
  });

  // Auto-mount on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureMounted);
  } else {
    ensureMounted();
  }

  // Expose global API
  window.KrabeAuthModal = {
    open,
    close,
    switchView,
    promptOtp,
    showAlert,
    clearAlert,
    setLoading
  };

  // Global helper shortcuts
  window.openKrabeAuth = (view) => open(view);
  window.closeKrabeAuth = () => close();

})();

