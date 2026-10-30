/**
 * Krabe Kollection — Global Reusable Footer Component
 * 
 * Master footer based on index.html, with 100% dynamic address & social hydration.
 * 
 * Usage on any page:
 *   1. Drop `<div id="krabeFooter"></div>` (or `<footer id="krabeFooter" class="site-footer"></footer>`)
 *   2. Include `<script src="js/footer.js"></script>`
 */

(function () {
  'use strict';

  const CONTAINER_ID = 'krabeFooter';

  function getFooterHTML() {
    return `
      <div class="container">
        
        <div class="footer-top">
          <!-- Brand Info -->
          <div class="footer-brand">
            <a href="index.html" aria-label="Krabe Kollection Home">
              <img src="assets/brand/krabe main logo.svg" alt="Krabe Kollection" style="height: 44px; margin-bottom: 14px;">
            </a>
            <p class="body-14" style="color: var(--color-text-muted);">
              Premium Nigerian unisex fashion house combining ancestral textile heritage with contemporary minimalist tailoring and luxury streetwear.
            </p>
            <div class="footer-social-links" style="margin-top: 18px;">
              <a href="https://instagram.com" target="_blank" rel="noopener" class="social-circle" aria-label="Instagram">
                <svg style="width: 18px; height: 18px;" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noopener" class="social-circle" aria-label="TikTok">
                <svg style="width: 16px; height: 16px;" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
              </a>
            </div>
          </div>

          <!-- Shop Krabe -->
          <div>
            <div class="footer-col-title body-12" style="font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-text-main);">Shop Krabe</div>
            <ul class="footer-nav-list body-14">
              <li><a href="shop.html">Made-to-Order Collections</a></li>
              <li><a href="shop.html?category=native">Native &amp; Agbada</a></li>
              <li><a href="shop.html?category=formal">English &amp; Suiting</a></li>
              <li><a href="shop.html?category=streetwear">Luxury Streetwear</a></li>
              <li><a href="bespoke.html">Bespoke Ordering</a></li>
            </ul>
          </div>

          <!-- Customer Care -->
          <div>
            <div class="footer-col-title body-12" style="font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-text-main);">Customer Care</div>
            <ul class="footer-nav-list body-14">
              <li><a href="help.html#contact">Studio Address &amp; Map</a></li>
              <li><a href="help.html#faq">Frequently Asked Questions</a></li>
              <li><a href="help.html#shipping">Delivery &amp; Pickup Policy</a></li>
              <li><a href="help.html#returns">Returns &amp; Alterations</a></li>
              <li><a href="help.html#terms">Terms &amp; Conditions</a></li>
              <li><a href="help.html#privacy">Privacy Policy</a></li>
            </ul>
          </div>

          <!-- Private Releases -->
          <div>
            <div class="footer-col-title body-12" style="font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-text-main);">Private Releases</div>
            <p class="body-14" style="color: var(--color-text-muted); margin-bottom: 14px;">
              Join our private newsletter for early access to limited textile drops and private studio invitations.
            </p>
            <form class="newsletter-form" data-newsletter-form novalidate>
              <input type="email" required placeholder="Enter your email address" class="newsletter-input body-14" autocomplete="email">
              <button type="submit" class="newsletter-btn body-12">Subscribe</button>
              <div class="newsletter-feedback body-12" style="display: none;" role="status"></div>
            </form>
          </div>

        </div>

        <!-- Footer Bottom -->
        <div class="footer-bottom body-12" style="color: var(--color-text-muted);">
          <div>&copy; 2026 Krabe Kollection. All rights reserved. Registered in Nigeria.</div>
          <div>Modern African Elegance &bull; Handcrafted in Lagos</div>
        </div>

      </div>
    `;
  }

  function render() {
    let container = document.getElementById(CONTAINER_ID);
    if (!container) {
      const existingFooter = document.querySelector('footer.site-footer');
      if (existingFooter) {
        container = existingFooter;
        container.id = CONTAINER_ID;
      } else {
        container = document.createElement('footer');
        container.id = CONTAINER_ID;
        container.className = 'site-footer';
        document.body.appendChild(container);
      }
    }

    if (!container.classList.contains('site-footer')) {
      container.className = 'site-footer';
    }

    container.innerHTML = getFooterHTML();

    // Re-sync dynamic contact socials & store location
    if (window.KrabeContact && typeof window.KrabeContact.applyToDOM === 'function') {
      window.KrabeContact.applyToDOM();
    }
    if (window.KrabeLocation && typeof window.KrabeLocation.applyToDOM === 'function') {
      window.KrabeLocation.applyToDOM();
    }

    // Re-bind Brevo newsletter form
    if (window.KrabeNewsletter && typeof window.KrabeNewsletter.sync === 'function') {
      window.KrabeNewsletter.sync();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  window.KrabeFooter = {
    render
  };

})();

