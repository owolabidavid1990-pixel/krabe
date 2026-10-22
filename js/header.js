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
      <div class="announcement-bar" id="krabeAnnouncementBar">
        <span>Free Nationwide Delivery on orders over ₦150,000 | In-Store Lagos Fittings &amp; Worldwide Shipping Available</span>
        <a href="bespoke.html">Book Studio Fitting &rarr;</a>
      </div>

      <!-- STICKY SITE HEADER -->
      <header class="site-header" id="krabeSiteHeader">
        <div class="container header-inner">
          
          <!-- Mobile Hamburger Toggle -->
          <button type="button" class="nav-toggle" id="navToggleBtn" aria-label="Open mobile menu">
            <span></span>
            <span></span>
            <span></span>
          </button>

          <!-- Desktop Primary Navigation -->
          <nav class="nav-links" id="krabeDesktopNav" aria-label="Main Navigation">
            <a href="shop.html" class="nav-link" data-link="shop">Made-to-Order</a>
            <a href="bespoke.html" class="nav-link bespoke-highlight" data-link="bespoke">Bespoke</a>
            <a href="shop.html?category=native" class="nav-link" data-link="native">Native Wear</a>
            <a href="shop.html?category=streetwear" class="nav-link" data-link="streetwear">Streetwear</a>
            <a href="lookbook.html" class="nav-link" data-link="lookbook">Lookbook</a>
            <a href="about.html" class="nav-link" data-link="about">Our Story</a>
          </nav>

          <!-- Official Brand Wordmark Logo -->
          <div class="brand-logo-wrap">
            <a href="index.html" aria-label="Krabe Kollection Home">
              <img src="assets/brand/kraberefinedimage1.png" alt="Krabe Kollection" class="brand-logo-img">
            </a>
          </div>

          <!-- Header Utilities (Search, Account, WhatsApp, Cart) -->
          <div class="header-actions">
            <!-- Search Trigger -->
            <button type="button" class="action-btn js-open-search" id="searchOpenBtn" aria-label="Search Collection">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </button>

            <!-- Customer Account Portal -->
            <a href="account.html" class="action-btn js-account-btn" id="headerAccountBtn" aria-label="Customer Account">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </a>

            <!-- Direct WhatsApp Concierge -->
            <a href="https://wa.me/2348000000000?text=Hello%20Krabe%20Kollection,%20I%20would%20like%20to%20inquire%20about%20a%20piece" target="_blank" rel="noopener" class="action-btn" aria-label="WhatsApp Stylist" title="Chat with Stylist">
              <svg style="color: #25D366;" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.078-1.921-.432-.988-.41-1.637-1.397-1.688-1.464-.049-.067-.406-.541-.406-1.034 0-.493.255-.733.348-.834.093-.1.203-.125.27-.125.068 0 .135.001.194.004.062.003.146-.023.228.174.084.202.29.708.315.76.026.052.043.112.008.178-.035.067-.053.109-.106.171-.053.063-.111.14-.159.188-.052.052-.107.108-.046.213.061.104.272.449.584.726.402.358.741.469.845.521.105.052.167.045.228-.025.062-.07.269-.313.342-.42.072-.107.144-.089.243-.053.099.035.626.295.733.349.108.053.18.08.207.125.027.045.027.261-.117.666z"/>
              </svg>
            </a>

            <!-- Slide-Out Shopping Bag Trigger -->
            <button type="button" class="action-btn js-open-cart" aria-label="View Shopping Bag">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
              </svg>
              <span class="cart-badge" style="display: none;">0</span>
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
          <img src="assets/brand/kraberefinedimage1.png" alt="Krabe Logo" style="height: 38px;">
          <button type="button" class="cart-close-btn" id="mobileNavClose" aria-label="Close Menu">
            <svg style="width: 22px; height: 22px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <nav class="mobile-links" id="krabeMobileNav">
          <a href="shop.html" data-link="shop">Shop Made-to-Order</a>
          <a href="bespoke.html" style="color: var(--color-gold);" data-link="bespoke">Bespoke</a>
          <a href="shop.html?category=native" data-link="native">Native &amp; Agbada</a>
          <a href="shop.html?category=formal" data-link="formal">English &amp; Suiting</a>
          <a href="shop.html?category=streetwear" data-link="streetwear">Luxury Streetwear</a>
          <a href="lookbook.html" data-link="lookbook">Lookbook</a>
          <a href="about.html" data-link="about">About Us</a>
          <a href="account.html" data-link="account">My Account &amp; Tracking</a>
          <a href="help.html" data-link="help">Support &amp; Studio Address</a>
        </nav>

        <div style="margin-top: auto; padding-top: 24px; border-top: 1px solid var(--color-border);">
          <a href="https://wa.me/2348000000000" target="_blank" rel="noopener" class="btn-whatsapp" style="width: 100%; justify-content: center;">
            Chat on WhatsApp
          </a>
        </div>
      </div>
    `;
  }

  function highlightActiveLinks() {
    const rawPath = window.location.pathname.split('/').pop() || 'index.html';
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

