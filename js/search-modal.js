/**
 * Krabe Kollection — Global Search Modal Component
 * 
 * Provides:
 *  - Self-mounting luxury search modal dialog
 *  - Dynamic Quick Suggestions: Top 5 best-selling clothes queried from Supabase
 *  - Preserved (hidden) Popular Searches block
 *  - Case-insensitive search query navigation (transforms query to lowercase)
 *  - Full keyboard accessibility (Esc to close, Enter to search)
 * 
 * Global API:
 *   window.KrabeSearchModal.open()
 *   window.KrabeSearchModal.close()
 *   window.KrabeSearchModal.executeSearch()
 *   window.KrabeSearchModal.loadQuickSuggestions()
 */

(function () {
  'use strict';

  const MODAL_ID = 'searchModalOverlay';
  let isFetchingSuggestions = false;
  let suggestionsLoaded = false;
  let retryCount = 0;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatCategory(cat) {
    const c = (cat || '').toLowerCase();
    if (c === 'native') return 'Native Wear';
    if (c === 'formal') return 'English & Suiting';
    if (c === 'streetwear') return 'Streetwear Drops';
    return cat ? (cat.charAt(0).toUpperCase() + cat.slice(1)) : 'Collection';
  }

  function formatGender(gender) {
    const g = (gender || '').toLowerCase();
    if (g === 'male' || g === 'men') return 'Men';
    if (g === 'female' || g === 'women') return 'Women';
    return 'Unisex';
  }

  function getModalHTML() {
    return `
      <div class="search-modal-overlay" id="${MODAL_ID}" aria-hidden="true">
        <div class="search-modal" role="dialog" aria-modal="true" aria-labelledby="searchInputField">
          <div class="search-modal-header">
            <div class="search-input-wrap">
              <svg class="search-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input type="text" id="searchInputField" class="search-modal-input body-16" placeholder="Search Kaftans, Agbadas, Streetwear, Suits..." autocomplete="off">
              <button type="button" class="search-clear-btn" id="searchClearBtn" aria-label="Clear search">✕</button>
            </div>
            <button type="button" class="search-close-btn body-12" id="searchCloseBtn" aria-label="Close search">Close (Esc)</button>
          </div>

          <div class="search-modal-body">
            <!-- Popular Searches Block (Hidden, preserved for future display) -->
            <div class="search-suggestions-block" id="searchPopularSearchesBlock" style="display: none;" aria-hidden="true">
              <span class="search-section-label body-12" style="font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 1px;">Popular Searches</span>
              <div class="search-tags">
                <a href="shop.html?category=native" class="search-tag body-12">Native Kaftans</a>
                <a href="shop.html?category=native" class="search-tag body-12">Ceremonial Agbada</a>
                <a href="shop.html?category=streetwear" class="search-tag body-12">Luxury Streetwear</a>
                <a href="shop.html?category=formal" class="search-tag body-12">Senator Suits</a>
                <a href="shop.html?category=formal" class="search-tag body-12">Artisan Linen Shirts</a>
              </div>
            </div>

            <!-- Quick Suggestions (Dynamically loaded top-selling clothes from Supabase) -->
            <div class="search-preview-block">
              <span class="search-section-label body-12" style="font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 1px;">Quick Suggestions</span>
              <div class="search-results-list" id="searchQuickSuggestionsList">
                <div style="padding: 16px 0; text-align: center; color: var(--color-text-muted);">
                  <p class="body-12">Loading atelier best-sellers...</p>
                </div>
              </div>
            </div>

            <div class="search-modal-footer">
              <button type="button" class="btn-search-submit body-14" id="searchSubmitBtn">
                Explore All Made-to-Order &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function loadQuickSuggestions() {
    if (suggestionsLoaded || isFetchingSuggestions) return;

    const listEl = document.getElementById('searchQuickSuggestionsList');
    if (!listEl) return;

    const client = window.krabeClient || (window.KRABE_CONFIG && typeof window.KRABE_CONFIG.getClient === 'function' ? window.KRABE_CONFIG.getClient() : null);
    if (!client) {
      if (++retryCount <= 30) {
        setTimeout(loadQuickSuggestions, 150);
      }
      return;
    }

    try {
      isFetchingSuggestions = true;

      // Query top 5 highest sold products, selecting ONLY the necessary fields
      const { data: products, error } = await client
        .from('product')
        .select(`
          id,
          title,
          category,
          gender,
          sales_count,
          product_variation (
            price,
            main_image,
            sales_count
          )
        `)
        .order('sales_count', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!products || products.length === 0) {
        listEl.innerHTML = `
          <div style="padding: 12px 0; color: var(--color-text-muted);">
            <p class="body-12">No products currently listed.</p>
          </div>
        `;
        suggestionsLoaded = true;
        return;
      }

      listEl.innerHTML = products.map(prod => {
        const variations = prod.product_variation || [];
        const sortedVars = [...variations].sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
        const topVar = sortedVars[0] || {};
        const price = Number(topVar.price) || 0;
        const mainImage = topVar.main_image || 'assets/brand/krabe main logo.svg';

        return `
          <a href="product.html?id=${encodeURIComponent(prod.id)}" class="search-result-item">
            <img src="${escapeHtml(mainImage)}" alt="${escapeHtml(prod.title)}" loading="lazy">
            <div class="search-result-info">
              <div class="search-result-title body-14" style="font-weight: 700; color: var(--color-obsidian);">${escapeHtml(prod.title)}</div>
              <div class="search-result-meta body-12" style="color: var(--color-text-muted);">${formatCategory(prod.category)} &bull; ${formatGender(prod.gender)}</div>
              <div class="search-result-price body-14" style="font-weight: 700; color: var(--color-primary);">₦${price.toLocaleString('en-NG')}</div>
            </div>
          </a>
        `;
      }).join('');

      suggestionsLoaded = true;
    } catch (err) {
      console.warn('[SearchModal] Error loading quick suggestions:', err);
      if (listEl) {
        listEl.innerHTML = `
          <div style="padding: 12px 0; color: var(--color-text-muted);">
            <p class="body-12">Explore our full bespoke collection in the catalog.</p>
          </div>
        `;
      }
    } finally {
      isFetchingSuggestions = false;
    }
  }

  function executeSearch() {
    const input = document.getElementById('searchInputField');
    const query = (input ? input.value.trim() : '').toLowerCase();
    close();
    if (query) {
      window.location.href = `shop.html?search=${encodeURIComponent(query)}`;
    } else {
      window.location.href = 'shop.html';
    }
  }

  function open() {
    ensureMounted();
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      const input = document.getElementById('searchInputField');
      setTimeout(() => {
        if (input) input.focus();
      }, 100);
      loadQuickSuggestions();
    }
  }

  function close() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  function bindEvents() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;

    const closeBtn = document.getElementById('searchCloseBtn');
    const clearBtn = document.getElementById('searchClearBtn');
    const input = document.getElementById('searchInputField');
    const submitBtn = document.getElementById('searchSubmitBtn');

    if (closeBtn) closeBtn.addEventListener('click', close);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    if (input) {
      input.addEventListener('input', () => {
        if (clearBtn) {
          if (input.value.length > 0) {
            clearBtn.classList.add('visible');
          } else {
            clearBtn.classList.remove('visible');
          }
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeSearch();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (input) {
          input.value = '';
          input.focus();
        }
        clearBtn.classList.remove('visible');
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        executeSearch();
      });
    }
  }

  function ensureMounted() {
    if (!document.getElementById(MODAL_ID)) {
      document.body.insertAdjacentHTML('beforeend', getModalHTML());
      bindEvents();
    }
  }

  // Global trigger listener for any search buttons (.js-open-search or #searchOpenBtn)
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.js-open-search, #searchOpenBtn');
    if (trigger) {
      e.preventDefault();
      open();
    }
  });

  // Global Escape key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById(MODAL_ID);
      if (modal && modal.classList.contains('active')) {
        close();
      }
    }
  });

  // Auto mount on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureMounted();
      loadQuickSuggestions();
    });
  } else {
    ensureMounted();
    loadQuickSuggestions();
  }

  // Public API
  window.KrabeSearchModal = {
    open,
    close,
    executeSearch,
    loadQuickSuggestions
  };

  window.openKrabeSearch = () => open();
  window.closeKrabeSearch = () => close();
})();

