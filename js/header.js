/**
 * Krabe Kollection — Global Reusable Header & Navigation Component
 * 
 * Replaces hardcoded headers across all pages with a unified, 
 * luxury navigation bar, announcement bar, and mobile drawer.
 * 
 * Usage on any page:
 *   1. Drop `<div id="krabeHeader"></div>` at the top of <body>
 *   2. Include `<script src="js/header.js"></script>`
 */

(function () {
  'use strict';

  const CONTAINER_ID = 'krabeHeader';

  function getHeaderHTML() {
    return `
      <!-- TOP ANNOUNCEMENT BAR -->
      <div class="announcement-bar body-12" id="krabeAnnouncementBar">
        <span>Free Lagos Delivery on orders over ₦200,000 | Nationwide Shipping &amp; In-Store Lagos Fittings</span>
        <a href="bespoke.html">Book Studio Fitting &rarr;</a>
      </div>

      <!-- STICKY SITE HEADER -->
      <header class="site-header" id="krabeSiteHeader">
        <div class="container header-inner">
          
          <!-- Official Brand Wordmark Logo (Left Positioned) -->
          <div class="brand-logo-wrap">
            <a href="index.html" aria-label="Krabe Kollection Home">
              <img src="assets/brand/krabe main logo.svg" alt="Krabe Kollection" class="brand-logo-img">
            </a>
          </div>

          <!-- Primary Navigation Links -->
          <nav class="nav-links" id="krabeDesktopNav" aria-label="Main Navigation">
            <a href="shop.html" class="nav-link nav-link-always body-14" data-link="shop">Made-to-Order</a>
            <a href="bespoke.html" class="nav-link nav-link-always body-14" data-link="bespoke">Bespoke</a>
            <a href="shop.html?category=native" class="nav-link nav-link-extra body-14" data-link="native">Native Wear</a>
            <a href="shop.html?category=streetwear" class="nav-link nav-link-extra body-14" data-link="streetwear">Streetwear</a>
            <a href="about.html" class="nav-link nav-link-always body-14" data-link="about">Our Story</a>
          </nav>

          <!-- Header Utilities (Search, Account, WhatsApp, Cart, 3-Dot Menu) -->
          <div class="header-actions">
            <!-- Search Trigger -->
            <button type="button" class="action-btn js-open-search" id="searchOpenBtn" aria-label="Search Collection">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </button>

            <!-- Customer Account Portal -->
            <a href="account.html" class="action-btn js-account-btn" id="headerAccountBtn" aria-label="Customer Account">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </a>

            <!-- Direct WhatsApp Concierge (Official Speech Bubble Icon) -->
            <a href="https://wa.me/2348000000000?text=Hello%20Krabe%20Kollection,%20I%20would%20like%20to%20inquire%20about%20a%20piece" target="_blank" rel="noopener" class="action-btn" aria-label="WhatsApp Stylist" title="Chat with Stylist">
              <svg viewBox="0 0 24 24" style="width: 22px; height: 22px;" fill="none">
                <path d="M12.004 2C6.486 2 2 6.486 2 12.004c0 1.98.577 3.829 1.575 5.394L2.3 22l4.743-1.244A9.957 9.957 0 0012.004 22C17.522 22 22 17.522 22 12.004 22 6.486 17.522 2 12.004 2z" fill="#25D366"/>
                <path d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.98-.276-.1-.476-.15-.677.15-.2.301-.777.98-.952 1.18-.175.201-.351.226-.652.076-.301-.15-1.272-.469-2.423-1.496-.896-.799-1.502-1.787-1.678-2.088-.175-.301-.019-.464.132-.614.135-.135.301-.351.451-.527.15-.175.2-.301.301-.501.1-.2.05-.376-.025-.526-.075-.15-.677-1.632-.927-2.235-.244-.588-.493-.509-.677-.518-.175-.009-.376-.009-.577-.009-.2 0-.526.075-.802.376-.276.301-1.053 1.028-1.053 2.508 0 1.48 1.078 2.909 1.229 3.11.15.2 2.122 3.24 5.14 4.544.718.31 1.278.496 1.716.634.721.23 1.376.197 1.895.12.578-.087 1.78-.727 2.03-1.43.251-.703.251-1.304.176-1.43-.075-.126-.276-.201-.577-.351z" fill="#ffffff"/>
              </svg>
            </a>

            <!-- Slide-Out Shopping Bag Trigger -->
            <button type="button" class="action-btn js-open-cart" aria-label="View Shopping Bag">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
              </svg>
              <span class="cart-badge body-10" style="display: none;">0</span>
            </button>

            <!-- 3-Dot Navigation Menu Toggle (Appears on <= 1200px screens) -->
            <button type="button" class="action-btn nav-toggle-dots" id="navToggleBtn" aria-label="Open mobile menu" title="More Menu">
              <svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="2.2"/>
                <circle cx="12" cy="12" r="2.2"/>
                <circle cx="12" cy="19" r="2.2"/>
              </svg>
            </button>
          </div>

        </div>
      </header>
    `;
  }

  function getMobileDrawerHTML() {
    return `
      <div class="mobile-nav-drawer" id="mobileNavDrawer" role="dialog" aria-modal="true">
        <div class="mobile-nav-header">
          <img src="assets/brand/krabe main logo.svg" alt="Krabe Logo" style="height: 34px;">
          <button type="button" class="cart-close-btn" id="mobileNavClose" aria-label="Close Menu">
            <svg style="width: 22px; height: 22px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <nav class="mobile-links" id="krabeMobileNav">
          <a href="shop.html" class="body-16" data-link="shop">Shop Made-to-Order</a>
          <a href="bespoke.html" class="body-16" data-link="bespoke">Bespoke</a>
          <a href="shop.html?category=native" class="body-16" data-link="native">Native &amp; Agbada</a>
          <a href="shop.html?category=formal" class="body-16" data-link="formal">English &amp; Suiting</a>
          <a href="shop.html?category=streetwear" class="body-16" data-link="streetwear">Luxury Streetwear</a>
          <a href="about.html" class="body-16" data-link="about">About Us</a>
          <a href="account.html" class="body-16" data-link="account">My Account &amp; Tracking</a>
          <a href="help.html" class="body-16" data-link="help">Support &amp; Studio Address</a>
        </nav>

        <div style="margin-top: auto; padding-top: 24px; border-top: 1px solid var(--color-border);">
          <a href="https://wa.me/2348000000000" target="_blank" rel="noopener" class="btn-whatsapp body-14" style="width: 100%; justify-content: center;">
            Chat on WhatsApp
          </a>
        </div>
      </div>
    `;
  }

  function highlightActiveLinks() {
    let rawPath = window.location.pathname.split('/').filter(Boolean).pop() || 'index.html';
    if (!rawPath.includes('.')) {
      rawPath = rawPath + '.html';
    }
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');

    const desktopNav = document.getElementById('krabeDesktopNav');
    const mobileNav = document.getElementById('krabeMobileNav');
    const accountBtn = document.getElementById('headerAccountBtn');

    function applyActive(navEl) {
      if (!navEl) return;
      const links = navEl.querySelectorAll('a');
      links.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href') || '';
        
        if (category) {
          if (href.includes(`category=${category}`)) {
            link.classList.add('active');
          }
        } else if (rawPath === 'product.html') {
          // Garments on PDP belong to the Made-to-Order collection
          if (href === 'shop.html') {
            link.classList.add('active');
          }
        } else {
          if (href === rawPath && !href.includes('?')) {
            link.classList.add('active');
          }
        }
      });
    }

    applyActive(desktopNav);
    applyActive(mobileNav);

    if (accountBtn && rawPath === 'account.html') {
      accountBtn.classList.add('active');
      accountBtn.style.color = 'var(--color-primary)';
      accountBtn.style.background = 'var(--color-sand)';
    }
  }

  function setupMobileMenu() {
    const toggleBtn = document.getElementById('navToggleBtn');
    const drawer = document.getElementById('mobileNavDrawer');
    const closeBtn = document.getElementById('mobileNavClose');

    if (toggleBtn && drawer) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        drawer.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    }

    if (closeBtn && drawer) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        drawer.classList.remove('active');
        document.body.style.overflow = '';
      });
    }
  }

  function setupAccountClick() {
    const accountBtn = document.getElementById('headerAccountBtn');
    if (!accountBtn) return;

    accountBtn.addEventListener('click', (e) => {
      // If user is already on account.html, let default navigation happen
      const currentPath = window.location.pathname.split('/').pop() || 'index.html';
      if (currentPath === 'account.html') return;

      // If auth modal is available and user is NOT logged in, open the modal instead of navigating away!
      const isUserLoggedIn = Boolean(window.krabeUser || (window.krabeClient && window.krabeClient.auth && window.krabeClient.auth.getUser && window.krabeIsLoggedIn));
      if (!isUserLoggedIn && window.KrabeAuthModal && typeof window.KrabeAuthModal.open === 'function') {
        e.preventDefault();
        window.KrabeAuthModal.open('signin');
      }
    });
  }

  function render() {
    let container = document.getElementById(CONTAINER_ID);

    // If explicit container exists, render into it
    if (container) {
      container.innerHTML = getHeaderHTML().trim();
    } else {
      // If no container, look for existing site-header or inject at top of body
      const existingHeader = document.querySelector('.site-header');
      const existingBar = document.querySelector('.announcement-bar');
      if (existingBar) existingBar.remove();
      if (existingHeader) {
        existingHeader.outerHTML = getHeaderHTML().trim();
      } else {
        document.body.insertAdjacentHTML('afterbegin', getHeaderHTML().trim());
      }
    }

    // Ensure mobile drawer exists in body
    if (!document.getElementById('mobileNavDrawer')) {
      document.body.insertAdjacentHTML('beforeend', getMobileDrawerHTML().trim());
    }

    highlightActiveLinks();
    setupMobileMenu();
    setupAccountClick();
    setupSmartReveal();
    if (window.KrabeContact && typeof window.KrabeContact.applyToDOM === 'function') {
      window.KrabeContact.applyToDOM();
    }
  }

  function setupSmartReveal() {
    const header = document.getElementById('krabeSiteHeader');
    const container = document.getElementById(CONTAINER_ID);
    if (!header) return;

    let lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    let ticking = false;
    const threshold = 6;
    const topOffset = 110;

    function updateHeader() {
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const scrollDelta = currentScrollY - lastScrollY;

      // Do not hide header if a modal, drawer, or search overlay is open
      const isDrawerOpen = document.getElementById('mobileNavDrawer')?.classList.contains('active');
      const isModalOpen = document.getElementById('krabeAuthModal')?.classList.contains('active') ||
                          document.getElementById('searchModalOverlay')?.classList.contains('active') ||
                          document.getElementById('cartDrawer')?.classList.contains('active');

      if (isDrawerOpen || isModalOpen) {
        lastScrollY = currentScrollY;
        ticking = false;
        return;
      }

      // At or near top: return to normal in-flow display below announcement bar
      if (currentScrollY <= 40) {
        header.classList.remove('header-sticky', 'header-hidden');
        if (container) container.style.minHeight = '';
        lastScrollY = currentScrollY;
        ticking = false;
        return;
      }

      // Scrolling DOWN -> Hide header
      if (scrollDelta > threshold && currentScrollY > topOffset) {
        if (container && !container.style.minHeight) {
          container.style.minHeight = `${container.offsetHeight}px`;
        }
        header.classList.add('header-sticky', 'header-hidden');
      } 
      // Scrolling UP -> Reveal header smoothly
      else if (scrollDelta < -threshold) {
        if (container && !container.style.minHeight) {
          container.style.minHeight = `${container.offsetHeight}px`;
        }
        header.classList.add('header-sticky');
        header.classList.remove('header-hidden');
      }

      lastScrollY = currentScrollY;
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });
  }

  // Mount when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  window.KrabeHeader = {
    render,
    highlightActiveLinks
  };

})();

