/**
 * Krabe Kollection — Global Client Authentication & Session Controller
 * 
 * Manages user sessions, connects the auth modal to Supabase,
 * and dynamically updates navigation across all pages.
 */

(function () {
  'use strict';

  // State
  let currentUser = null;
  let currentSession = null;

  function getClient() {
    if (window.krabeClient) return window.krabeClient;
    if (window.KRABE_CONFIG && typeof window.KRABE_CONFIG.getClient === 'function') {
      return window.KRABE_CONFIG.getClient();
    }
    return null;
  }

  // =========================================================================
  // 1. UI SYNCHRONIZATION (Header & Navigation)
  // =========================================================================
  function updateAuthUI(user) {
    const accountBtns = document.querySelectorAll('.js-account-btn, #headerAccountBtn');
    const mobileAccountLinks = document.querySelectorAll('#krabeMobileNav a[data-link="account"]');

    if (user) {
      const meta = user.user_metadata || {};
      const fullName = meta.full_name || user.email.split('@')[0];
      const initials = fullName
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

      const avatarUrl = meta.avatar_url || meta.picture || null;

      accountBtns.forEach(btn => {
        btn.setAttribute('title', `Logged in as ${fullName} — Go to Account Portal`);
        btn.setAttribute('aria-label', `Logged in as ${fullName}`);
        
        if (avatarUrl) {
          // Render user avatar photo in circular badge
          btn.innerHTML = `
            <img src="${avatarUrl}" alt="${fullName}" referrerpolicy="no-referrer" style="
              width: 28px;
              height: 28px;
              border-radius: 50%;
              object-fit: cover;
              display: block;
              border: 1px solid var(--color-gold-light, #D4AF37);
            " onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: var(--color-primary, #44637B); color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; border: 1px solid var(--color-gold-light, #D4AF37);\\'>${initials}</span>';">
          `;
        } else {
          // Fallback: Render luxury initials badge in header
          btn.innerHTML = `
            <span style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              background: var(--color-primary, #44637B);
              color: #ffffff;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.5px;
              border: 1px solid var(--color-gold-light, #D4AF37);
            ">${initials}</span>
          `;
        }
      });

      mobileAccountLinks.forEach(link => {
        link.textContent = `My Account (${fullName.split(' ')[0]})`;
      });

      // Ensure Sign Out button exists in mobile drawer if logged in
      ensureMobileSignOutBtn();

      // If on account.html, sync greeting & details
      syncAccountPage(user);

    } else {
      // Guest state: restore default account SVG icon
      accountBtns.forEach(btn => {
        btn.setAttribute('title', 'Sign In / Register');
        btn.setAttribute('aria-label', 'Customer Account');
        btn.innerHTML = `
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        `;
      });

      mobileAccountLinks.forEach(link => {
        link.textContent = 'My Account & Tracking';
      });

      const signOutBtn = document.getElementById('krabeMobileSignOutBtn');
      if (signOutBtn) signOutBtn.remove();
    }
  }

  function ensureMobileSignOutBtn() {
    const mobileNav = document.getElementById('krabeMobileNav');
    if (!mobileNav || document.getElementById('krabeMobileSignOutBtn')) return;

    const signOutLink = document.createElement('a');
    signOutLink.id = 'krabeMobileSignOutBtn';
    signOutLink.href = 'javascript:void(0)';
    signOutLink.style.color = '#DC2626';
    signOutLink.style.fontWeight = '600';
    signOutLink.textContent = 'Sign Out of Krabe';
    signOutLink.addEventListener('click', () => {
      signOut();
    });

    mobileNav.appendChild(signOutLink);
  }

  async function syncAccountPage(user) {
    const isAccountPage = (window.location.pathname.split('/').pop() || '') === 'account.html';
    if (!isAccountPage) return;

    if (!user) {
      setTimeout(() => {
        if (!window.krabeIsLoggedIn && window.KrabeAuthModal) {
          window.KrabeAuthModal.open('signin');
        }
      }, 350);
      return;
    }

    const avatarEl = document.querySelector('.account-avatar');
    const nameEl = document.querySelector('.account-greeting-name');
    const metaLine = document.querySelector('.account-meta-line');

    const meta = user.user_metadata || {};
    const fullName = meta.full_name || user.email.split('@')[0];
    const email = user.email || '';
    const phone = meta.phone || '';

    const initials = fullName
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const avatarUrl = meta.avatar_url || meta.picture || null;

    if (avatarEl) {
      if (avatarUrl) {
        avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${fullName}" referrerpolicy="no-referrer" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">`;
      } else {
        avatarEl.textContent = initials || 'K';
      }
    }
    if (nameEl) nameEl.textContent = fullName;
    if (metaLine) {
      metaLine.innerHTML = `
        <span>${email}</span>
        ${phone ? `<span>&bull;</span><span>${phone}</span>` : ''}
        <span>&bull;</span>
        <span class="account-tier-tag">Client Member</span>
      `;
    }

    const client = getClient();
    if (client) {
      try {
        const { data: profile } = await client
          .from('profile')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          if (profile.avatar_url) {
            if (avatarEl) {
              avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="${fullName}" referrerpolicy="no-referrer" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">`;
            }
          }
          if (profile.full_name && nameEl) nameEl.textContent = profile.full_name;
          if (profile.phone && metaLine) {
            metaLine.innerHTML = `
              <span>${email}</span>
              <span>&bull;</span>
              <span>${profile.phone}</span>
              <span>&bull;</span>
              <span class="account-tier-tag">${profile.role === 'admin' ? 'Atelier Admin' : 'Client Member'}</span>
            `;
          }
        }
      } catch (e) {
        // Fallback to auth metadata
      }
    }
  }

  // =========================================================================
  // GUEST CART TO DATABASE MIGRATION CONTROLLER
  // =========================================================================
  async function syncGuestCartToDatabase(user) {
    if (!user || !user.id) return;
    const client = getClient();
    if (!client) return;

    let guestCart = [];
    try {
      const raw = localStorage.getItem('krabe_cart');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          guestCart = parsed;
        }
      }
    } catch (e) {
      console.warn('[Krabe Cart Sync] Error reading guest cart from localStorage:', e);
      return;
    }

    if (guestCart.length === 0) return;

    console.log(`[Krabe Cart Sync] Found ${guestCart.length} guest cart item(s). Syncing to Supabase cart_item for user ${user.id}...`);

    let transferredCount = 0;

    for (const item of guestCart) {
      try {
        const variationId = item.variant_id || item.product_variation_id;

        // Check if variationId is a valid UUID
        const isUUID = variationId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(variationId);

        // Upsert into public.cart_item using verified product_variation_id and selected_size
        if (isUUID) {
          const qtyToAdd = Number(item.qty) || 1;
          const unitPrice = Number(item.price) || 0;
          const chosenSize = item.size || 'M';

          // Check if user already has this variation with this size in cart_item
          const { data: existing } = await client
            .from('cart_item')
            .select('id, quantity')
            .eq('user_id', user.id)
            .eq('product_variation_id', variationId)
            .eq('selected_size', chosenSize)
            .maybeSingle();

          if (existing && existing.id) {
            const updatedQty = (Number(existing.quantity) || 0) + qtyToAdd;
            await client
              .from('cart_item')
              .update({
                quantity: updatedQty,
                unit_price: unitPrice,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);
          } else {
            await client
              .from('cart_item')
              .insert({
                user_id: user.id,
                product_variation_id: variationId,
                selected_size: chosenSize,
                quantity: qtyToAdd,
                unit_price: unitPrice,
                slug: item.title ? item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null
              });
          }
          transferredCount++;
        } else {
          console.warn(`[Krabe Cart Sync] Skipped item without valid variant UUID: "${item.title}"`);
        }
      } catch (itemErr) {
        console.error('[Krabe Cart Sync] Error migrating item:', item.title, itemErr);
      }
    }

    // Delete guest cart from localStorage
    try {
      localStorage.removeItem('krabe_cart');
      console.log(`[Krabe Cart Sync] Transferred ${transferredCount} item(s) to database. Guest localStorage cart deleted.`);
    } catch (clearErr) {
      console.warn('[Krabe Cart Sync] Could not clear localStorage:', clearErr);
    }

    // Notify application that cart has synced from guest to DB
    window.dispatchEvent(new CustomEvent('krabe:cart:synced', {
      detail: { user, transferredCount }
    }));

    if (window.KrabeCart && typeof window.KrabeCart.refreshUserCart === 'function') {
      window.KrabeCart.refreshUserCart();
    }
  }

  // =========================================================================
  // 2. AUTHENTICATION ACTIONS
  // =========================================================================
  async function signIn(email, password, remember = true) {
    const client = getClient();
    if (!client) {
      if (window.KrabeAuthModal) window.KrabeAuthModal.showAlert('Database connection initializing, please try again.', 'error');
      return { error: new Error('Client not initialized') };
    }

    try {
      if (window.KrabeAuthModal) window.KrabeAuthModal.setLoading('krabeSignInForm', true);
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (window.KrabeAuthModal) {
          window.KrabeAuthModal.setLoading('krabeSignInForm', false);
          window.KrabeAuthModal.showAlert(error.message, 'error');
        }
        return { error };
      }

      // Successful sign in establishes session
      if (data && data.user) {
        currentUser = data.user;
        currentSession = data.session;
        window.krabeUser = currentUser;
        window.krabeSession = currentSession;
        window.krabeIsLoggedIn = true;
        updateAuthUI(currentUser);

        // Sync guest local cart to Supabase database & clear localStorage
        await syncGuestCartToDatabase(currentUser);
      }

      if (window.KrabeAuthModal) {
        window.KrabeAuthModal.setLoading('krabeSignInForm', false);
        window.KrabeAuthModal.showAlert('Welcome back to Krabe Kollection.', 'success');
        setTimeout(() => {
          window.KrabeAuthModal.close();
          const currentPath = window.location.pathname.split('/').pop() || 'index.html';
          if (currentPath === 'account.html') {
            window.location.reload();
          }
        }, 600);
      }

      return { data };
    } catch (err) {
      if (window.KrabeAuthModal) {
        window.KrabeAuthModal.setLoading('krabeSignInForm', false);
        window.KrabeAuthModal.showAlert(err.message || 'An unexpected error occurred.', 'error');
      }
      return { error: err };
    }
  }

  async function signUp(fullName, email, phone, password) {
    const client = getClient();
    if (!client) {
      if (window.KrabeAuthModal) window.KrabeAuthModal.showAlert('Database connection initializing, please try again.', 'error');
      return { error: new Error('Client not initialized') };
    }

    try {
      if (window.KrabeAuthModal) window.KrabeAuthModal.setLoading('krabeRegisterForm', true);

      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: fullName,
            full_name: fullName,
            phone_number: phone,
            whatsapp_number: phone,
            phone: phone
          }
        }
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        
        // Handle refresh / re-attempt: If registration was already initiated but pending OTP confirmation
        if (msg.includes('already registered') || msg.includes('already in use') || msg.includes('user already exists')) {
          try {
            const resendResult = await client.auth.resend({
              type: 'signup',
              email: email.trim()
            });

            if (resendResult && resendResult.error) {
              const resendMsg = (resendResult.error.message || '').toLowerCase();
              if (resendMsg.includes('confirmed') || resendMsg.includes('already verified')) {
                if (window.KrabeAuthModal) {
                  window.KrabeAuthModal.setLoading('krabeRegisterForm', false);
                  window.KrabeAuthModal.showAlert('This email is already registered and verified. Please sign in.', 'info');
                  window.KrabeAuthModal.switchView('signin');
                  const loginEmailInput = document.getElementById('krabeLoginEmail');
                  if (loginEmailInput) loginEmailInput.value = email.trim();
                }
                return { error };
              }
            }
          } catch (resendErr) {
            console.warn('Auto-resend error on re-registration attempt:', resendErr);
          }

          // Move user straight to Step 2 OTP verification screen with fresh code!
          if (window.KrabeAuthModal) {
            window.KrabeAuthModal.setLoading('krabeRegisterForm', false);
            window.KrabeAuthModal.promptOtp(email.trim());
            window.KrabeAuthModal.showAlert(
              'Account already in progress! We resent your 6-digit code. Note: Your active password remains the one set during your initial sign-up.',
              'info'
            );
          }
          return { pendingOtp: true };
        }

        if (window.KrabeAuthModal) {
          window.KrabeAuthModal.setLoading('krabeRegisterForm', false);
          window.KrabeAuthModal.showAlert(error.message, 'error');
        }
        return { error };
      }

      if (window.KrabeAuthModal) {
        window.KrabeAuthModal.setLoading('krabeRegisterForm', false);

        if (data.session) {
          // If project auto-confirms email, log them in immediately
          window.KrabeAuthModal.showAlert('Welcome to Krabe Kollection.', 'success');
          setTimeout(() => {
            window.KrabeAuthModal.close();
            const currentPath = window.location.pathname.split('/').pop() || 'index.html';
            if (currentPath === 'account.html') {
              window.location.reload();
            }
          }, 700);
        } else {
          // Check if this is a duplicate / re-submitted sign-up:
          // 1. Supabase anti-enumeration flag: user already exists -> identities array is empty []
          // 2. Local browser state: this email was already pending OTP confirmation
          const isDuplicateUser = Boolean(
            (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) ||
            (function () {
              try {
                return localStorage.getItem('krabe_pending_otp_email') === email.trim();
              } catch (_) {
                return false;
              }
            })()
          );

          if (isDuplicateUser) {
            // Re-send fresh OTP code since Supabase does not re-issue one automatically on duplicate sign-ups
            try {
              const resendResult = await client.auth.resend({
                type: 'signup',
                email: email.trim()
              });

              if (resendResult && resendResult.error) {
                const resendMsg = (resendResult.error.message || '').toLowerCase();
                if (resendMsg.includes('confirmed') || resendMsg.includes('already verified')) {
                  window.KrabeAuthModal.showAlert('This email is already registered and verified. Please sign in.', 'info');
                  window.KrabeAuthModal.switchView('signin');
                  const loginEmailInput = document.getElementById('krabeLoginEmail');
                  if (loginEmailInput) loginEmailInput.value = email.trim();
                  return { data };
                }
              }
            } catch (resendErr) {
              console.warn('Auto-resend error on duplicate signup attempt:', resendErr);
            }

            // Switch to OTP view and show the duplicate signup password notice
            if (typeof window.KrabeAuthModal.promptOtp === 'function') {
              window.KrabeAuthModal.promptOtp(email);
              window.KrabeAuthModal.showAlert(
                'Account already in progress! We resent your 6-digit code. Note: Your active password remains the one set during your initial sign-up.',
                'info'
              );
            }
          } else {
            // First-time signup -> Prompt for OTP code
            if (typeof window.KrabeAuthModal.promptOtp === 'function') {
              window.KrabeAuthModal.promptOtp(email);
              window.KrabeAuthModal.showAlert('6-digit code sent to your inbox.', 'info');
            } else {
              window.KrabeAuthModal.showAlert(
                'Welcome! Please check your inbox for your code.',
                'success'
              );
            }
          }
        }
      }

      return { data };
    } catch (err) {
      if (window.KrabeAuthModal) {
        window.KrabeAuthModal.setLoading('krabeRegisterForm', false);
        window.KrabeAuthModal.showAlert(err.message || 'Registration failed.', 'error');
      }
      return { error: err };
    }
  }

  // =========================================================================
  // STEP 2: VERIFY 6-DIGIT EMAIL OTP & AUTO-LOGIN
  // =========================================================================
  async function verifyOtp(email, token) {
    const client = getClient();
    if (!client) {
      if (window.KrabeAuthModal) window.KrabeAuthModal.showAlert('Database connection initializing, please try again.', 'error');
      return { error: new Error('Client not initialized') };
    }

    try {
      if (window.KrabeAuthModal) window.KrabeAuthModal.setLoading('krabeOtpForm', true);

      const { data, error } = await client.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'signup'
      });

      if (error) {
        if (window.KrabeAuthModal) {
          window.KrabeAuthModal.setLoading('krabeOtpForm', false);
          window.KrabeAuthModal.showAlert(error.message, 'error');
        }
        return { error };
      }

      // Successful OTP verification automatically yields the authenticated session
      currentUser = data.user;
      currentSession = data.session;
      window.krabeUser = currentUser;
      window.krabeSession = currentSession;
      window.krabeIsLoggedIn = Boolean(currentUser);

      try {
        localStorage.removeItem('krabe_pending_otp_email');
      } catch (_) {}

      updateAuthUI(currentUser);

      // Sync guest local cart to Supabase database & clear localStorage
      await syncGuestCartToDatabase(currentUser);

      if (window.KrabeAuthModal) {
        window.KrabeAuthModal.setLoading('krabeOtpForm', false);
        window.KrabeAuthModal.showAlert('Welcome to Krabe Kollection.', 'success');
        setTimeout(() => {
          window.KrabeAuthModal.close();
          const currentPath = window.location.pathname.split('/').pop() || 'index.html';
          if (currentPath === 'account.html') {
            window.location.reload();
          }
        }, 700);
      }

      return { data };
    } catch (err) {
      if (window.KrabeAuthModal) {
        window.KrabeAuthModal.setLoading('krabeOtpForm', false);
        window.KrabeAuthModal.showAlert(err.message || 'Verification failed. Please try again.', 'error');
      }
      return { error: err };
    }
  }

  async function resendOtp(email) {
    const client = getClient();
    if (!client || !email) return;

    try {
      const { error } = await client.auth.resend({
        type: 'signup',
        email: email.trim()
      });

      if (error) {
        if (window.KrabeAuthModal) window.KrabeAuthModal.showAlert(error.message, 'error');
      } else {
        if (window.KrabeAuthModal) window.KrabeAuthModal.showAlert('New code sent to your inbox.', 'success');
      }
    } catch (err) {
      if (window.KrabeAuthModal) window.KrabeAuthModal.showAlert(err.message || 'Could not resend code.', 'error');
    }
  }

  async function resetPassword(email) {
    const client = getClient();
    if (!client) return { error: new Error('Client not initialized') };

    try {
      if (window.KrabeAuthModal) window.KrabeAuthModal.setLoading('krabeForgotForm', true);

      const { data, error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/account.html'
      });

      if (error) {
        if (window.KrabeAuthModal) {
          window.KrabeAuthModal.setLoading('krabeForgotForm', false);
          window.KrabeAuthModal.showAlert(error.message, 'error');
        }
        return { error };
      }

      if (window.KrabeAuthModal) {
        window.KrabeAuthModal.setLoading('krabeForgotForm', false);
        window.KrabeAuthModal.showAlert('Password reset link sent! Check your inbox.', 'success');
      }

      return { data };
    } catch (err) {
      if (window.KrabeAuthModal) {
        window.KrabeAuthModal.setLoading('krabeForgotForm', false);
        window.KrabeAuthModal.showAlert(err.message || 'Password reset request failed.', 'error');
      }
      return { error: err };
    }
  }

  async function signOut() {
    const client = getClient();
    if (!client) return;

    try {
      await client.auth.signOut();
      currentUser = null;
      currentSession = null;
      window.krabeUser = null;
      window.krabeSession = null;
      window.krabeIsLoggedIn = false;
      updateAuthUI(null);

      const currentPath = window.location.pathname.split('/').pop() || 'index.html';
      if (currentPath === 'account.html') {
        window.location.reload();
      }
    } catch (err) {
      console.error('[Krabe Auth] Sign out error:', err);
    }
  }

  // =========================================================================
  // GOOGLE OAUTH POPUP SIGN IN
  // =========================================================================
  async function signInWithGoogle() {
    const client = getClient();
    if (!client) {
      if (window.KrabeAuthModal) window.KrabeAuthModal.showAlert('Database connection initializing, please try again.', 'error');
      return { error: new Error('Client not initialized') };
    }

    const googleBtns = document.querySelectorAll('.js-krabe-google-btn');
    googleBtns.forEach(b => {
      b.classList.add('loading');
      b.disabled = true;
    });

    const resetButtons = () => {
      googleBtns.forEach(b => {
        b.classList.remove('loading');
        b.disabled = false;
      });
    };

    // Pre-open centered popup synchronously during click event to satisfy browser popup blockers
    const width = 500;
    const height = 650;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    let popup = null;
    try {
      popup = window.open(
        'about:blank',
        'KrabeGoogleAuth',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );
    } catch (openErr) {
      console.warn('[Krabe Auth] Popup window blocked or not supported:', openErr);
    }

    try {
      const callbackUrl = `${window.location.origin}/auth-callback.html`;

      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
          redirectTo: callbackUrl
        }
      });

      if (error || !data || !data.url) {
        if (popup && !popup.closed) popup.close();
        resetButtons();
        const msg = error ? error.message : 'Could not initialize Google authentication.';
        if (window.KrabeAuthModal) window.KrabeAuthModal.showAlert(msg, 'error');
        return { error };
      }

      // Navigate popup to Google OAuth URL
      if (popup && !popup.closed) {
        popup.location.href = data.url;
      } else {
        // Fallback if popup was blocked: redirect current tab directly
        window.location.href = data.url;
        return;
      }

      let authCompleted = false;

      const finishSuccess = async (session) => {
        if (authCompleted) return;
        authCompleted = true;
        if (popup && !popup.closed) {
          try { popup.close(); } catch (_) {}
        }
        cleanup();

        const user = session ? session.user : (await client.auth.getUser()).data.user;
        if (user) {
          currentUser = user;
          currentSession = session || (await client.auth.getSession()).data.session;
          window.krabeUser = currentUser;
          window.krabeSession = currentSession;
          window.krabeIsLoggedIn = true;
          updateAuthUI(currentUser);
          await syncGuestCartToDatabase(currentUser);

          if (window.KrabeAuthModal) {
            const firstName = (user.user_metadata?.full_name || user.email || 'Client').split(' ')[0];
            window.KrabeAuthModal.showAlert(`Welcome, ${firstName}!`, 'success');
            setTimeout(() => {
              window.KrabeAuthModal.close();
              const currentPath = window.location.pathname.split('/').pop() || 'index.html';
              if (currentPath === 'account.html') {
                window.location.reload();
              }
            }, 600);
          }
        }
      };

      const cleanup = () => {
        resetButtons();
        window.removeEventListener('message', onMessage);
        clearInterval(pollTimer);
      };

      // 1. PostMessage listener from child popup
      const onMessage = (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data && event.data.type === 'KRABE_AUTH_SUCCESS') {
          finishSuccess(event.data.session);
        }
      };
      window.addEventListener('message', onMessage);

      // 2. Polling for popup closure or session establishment via shared localStorage
      const pollTimer = setInterval(async () => {
        if (authCompleted) {
          clearInterval(pollTimer);
          return;
        }

        const { data: sData } = await client.auth.getSession();
        if (sData && sData.session) {
          finishSuccess(sData.session);
          return;
        }

        if (popup && popup.closed) {
          cleanup();
          setTimeout(async () => {
            const { data: finalSession } = await client.auth.getSession();
            if (finalSession && finalSession.session) {
              finishSuccess(finalSession.session);
            }
          }, 350);
        }
      }, 600);

    } catch (err) {
      if (popup && !popup.closed) popup.close();
      resetButtons();
      if (window.KrabeAuthModal) window.KrabeAuthModal.showAlert(err.message || 'Google sign-in failed.', 'error');
      return { error: err };
    }
  }

  // =========================================================================
  // 3. LISTEN TO MODAL CUSTOM EVENTS
  // =========================================================================
  window.addEventListener('krabe:auth:signin', (e) => {
    const { email, password, remember } = e.detail || {};
    if (email && password) {
      signIn(email, password, remember);
    }
  });

  window.addEventListener('krabe:auth:register', (e) => {
    const { fullName, email, phone, password } = e.detail || {};
    if (fullName && email && phone && password) {
      signUp(fullName, email, phone, password);
    }
  });

  window.addEventListener('krabe:auth:forgot', (e) => {
    const { email } = e.detail || {};
    if (email) {
      resetPassword(email);
    }
  });

  window.addEventListener('krabe:auth:verify-otp', (e) => {
    const { email, token } = e.detail || {};
    if (email && token) {
      verifyOtp(email, token);
    }
  });

  window.addEventListener('krabe:auth:resend-otp', (e) => {
    const { email } = e.detail || {};
    if (email) {
      resendOtp(email);
    }
  });

  window.addEventListener('krabe:auth:google', () => {
    signInWithGoogle();
  });

  // =========================================================================
  // 4. INITIALIZE AUTH & SUBSCRIBE TO SESSION CHANGES
  // =========================================================================
  async function initAuth() {
    const client = getClient();
    if (!client) {
      // Retry in 100ms if Supabase SDK is still loading asynchronously
      setTimeout(initAuth, 100);
      return;
    }

    try {
      const { data } = await client.auth.getSession();
      currentSession = data ? data.session : null;
      currentUser = currentSession ? currentSession.user : null;

      // Check if this page was loaded inside a Google OAuth popup window
      if (window.opener && window.opener !== window && (window.location.hash.includes('access_token') || window.location.search.includes('code='))) {
        try {
          window.opener.postMessage({ type: 'KRABE_AUTH_SUCCESS', session: currentSession }, window.location.origin);
        } catch (_) {}
        setTimeout(() => window.close(), 150);
        return;
      }

      window.krabeSession = currentSession;
      window.krabeUser = currentUser;
      window.krabeIsLoggedIn = Boolean(currentUser);

      updateAuthUI(currentUser);

      if (currentUser) {
        await syncGuestCartToDatabase(currentUser);
      }

      // Realtime listener across tabs and auth state updates
      client.auth.onAuthStateChange(async (event, session) => {
        currentSession = session;
        currentUser = session ? session.user : null;

        window.krabeSession = currentSession;
        window.krabeUser = currentUser;
        window.krabeIsLoggedIn = Boolean(currentUser);

        updateAuthUI(currentUser);

        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && currentUser) {
          await syncGuestCartToDatabase(currentUser);
        }

        window.dispatchEvent(new CustomEvent('krabe:session:changed', {
          detail: { event, session, user: currentUser }
        }));
      });

    } catch (err) {
      console.error('[Krabe Auth] Init error:', err);
    }
  }

  // Mount when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }

  // =========================================================================
  // 5. GLOBAL EXPORTS
  // =========================================================================
  window.KrabeAuth = {
    getUser: () => currentUser,
    getSession: () => currentSession,
    isLoggedIn: () => Boolean(currentUser),
    signIn,
    signInWithGoogle,
    signUp,
    verifyOtp,
    resendOtp,
    signOut,
    resetPassword,
    updateAuthUI,
    syncGuestCart: syncGuestCartToDatabase
  };

  // Convenient shortcuts
  window.krabeSignIn = signIn;
  window.krabeSignInWithGoogle = signInWithGoogle;
  window.krabeSignUp = signUp;
  window.krabeVerifyOtp = verifyOtp;
  window.krabeSignOut = signOut;

})();
