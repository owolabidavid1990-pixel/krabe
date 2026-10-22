/**
 * Krabe Kollection — Global Storefront Interactions & Cart Drawer
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Cart State & Elements ---
  const cartOverlay = document.getElementById('cartOverlay');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOpenBtns = document.querySelectorAll('.js-open-cart');
  const cartCloseBtn = document.getElementById('cartCloseBtn');
  const cartBadge = document.querySelector('.cart-badge');
  const cartBody = document.querySelector('.cart-drawer-body');
  const cartSubtotalEl = document.querySelector('.cart-subtotal-amount');

  // Mobile Nav Elements
  const navToggleBtn = document.getElementById('navToggleBtn');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');
  const mobileNavClose = document.getElementById('mobileNavClose');

  // Initial Mock Cart Data
  let cart = [
    {
      id: 1,
      title: 'Signature Agbada Luxe Set',
      variant: 'Midnight Blue / L',
      price: 185000,
      qty: 1,
      image: 'Krabe Cloth Concepts_230226_205405_1.jpg'
    }
  ];

  function formatNaira(amount) {
    return '₦' + Number(amount).toLocaleString('en-NG');
  }

  function updateCartUI() {
    // Total count
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    if (cartBadge) {
      cartBadge.textContent = totalCount;
      cartBadge.style.display = totalCount > 0 ? 'flex' : 'none';
    }

    // Subtotal
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    if (cartSubtotalEl) {
      cartSubtotalEl.textContent = formatNaira(subtotal);
    }

    // Line items
    if (cartBody) {
      if (cart.length === 0) {
        cartBody.innerHTML = `
          <div style="text-align: center; padding: 48px 12px; color: #6E7175;">
            <svg style="width: 44px; height: 44px; margin-bottom: 12px; opacity: 0.4;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
            </svg>
            <p style="font-size: 15px; font-weight: 600; margin-bottom: 6px; color: #161616;">Your shopping bag is empty</p>
            <p style="font-size: 13px;">Explore our made-to-order collections or commission a bespoke outfit.</p>
          </div>
        `;
      } else {
        cartBody.innerHTML = cart.map(item => `
          <div class="cart-item" data-id="${item.id}">
            <img src="${item.image}" alt="${item.title}" class="cart-item-img">
            <div class="cart-item-details">
              <h4>${item.title}</h4>
              <div class="cart-item-meta">${item.variant}</div>
              <div class="cart-item-price">${formatNaira(item.price)}</div>
              <div class="cart-qty-ctrl">
                <button type="button" class="cart-qty-btn js-qty-minus" data-id="${item.id}">−</button>
                <span class="cart-qty-val">${item.qty}</span>
                <button type="button" class="cart-qty-btn js-qty-plus" data-id="${item.id}">+</button>
              </div>
            </div>
            <button type="button" class="cart-item-del js-del-item" data-id="${item.id}" aria-label="Remove item">
              <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        `).join('');

        // Attach listeners for line item controls
        cartBody.querySelectorAll('.js-qty-plus').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            const target = cart.find(i => i.id === id);
            if (target) {
              target.qty += 1;
              updateCartUI();
            }
          });
        });

        cartBody.querySelectorAll('.js-qty-minus').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            const target = cart.find(i => i.id === id);
            if (target) {
              if (target.qty > 1) {
                target.qty -= 1;
              } else {
                cart = cart.filter(i => i.id !== id);
              }
              updateCartUI();
            }
          });
        });

        cartBody.querySelectorAll('.js-del-item').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            cart = cart.filter(i => i.id !== id);
            updateCartUI();
          });
        });
      }
    }
  }

  // Open & Close Drawer
  function openCart() {
    if (cartOverlay) {
      cartOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeCart() {
    if (cartOverlay) {
      cartOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  cartOpenBtns.forEach(btn => btn.addEventListener('click', openCart));
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);
  if (cartOverlay) {
    cartOverlay.addEventListener('click', (e) => {
      if (e.target === cartOverlay) closeCart();
    });
  }

  // Search Modal Elements & Logic
  const searchModalOverlay = document.getElementById('searchModalOverlay');
  const searchOpenBtns = document.querySelectorAll('.js-open-search');
  const searchCloseBtn = document.getElementById('searchCloseBtn');
  const searchInputField = document.getElementById('searchInputField');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const searchSubmitBtn = document.getElementById('searchSubmitBtn');

  function openSearch(e) {
    if (e) e.preventDefault();
    if (searchModalOverlay) {
      searchModalOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        if (searchInputField) searchInputField.focus();
      }, 100);
    }
  }

  function closeSearch() {
    if (searchModalOverlay) {
      searchModalOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  function executeSearch() {
    const query = searchInputField ? searchInputField.value.trim() : '';
    if (query) {
      window.location.href = `shop.html?search=${encodeURIComponent(query)}`;
    } else {
      window.location.href = 'shop.html';
    }
  }

  searchOpenBtns.forEach(btn => btn.addEventListener('click', openSearch));
  if (searchCloseBtn) searchCloseBtn.addEventListener('click', closeSearch);
  if (searchModalOverlay) {
    searchModalOverlay.addEventListener('click', (e) => {
      if (e.target === searchModalOverlay) closeSearch();
    });
  }

  if (searchInputField) {
    searchInputField.addEventListener('input', () => {
      if (searchClearBtn) {
        if (searchInputField.value.length > 0) {
          searchClearBtn.classList.add('visible');
        } else {
          searchClearBtn.classList.remove('visible');
        }
      }
    });

    searchInputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSearch();
      }
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInputField) {
        searchInputField.value = '';
        searchInputField.focus();
      }
      searchClearBtn.classList.remove('visible');
    });
  }

  if (searchSubmitBtn) {
    searchSubmitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      executeSearch();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCart();
      closeSearch();
      if (mobileNavDrawer) mobileNavDrawer.classList.remove('active');
    }
  });

  // Mobile Menu
  if (navToggleBtn && mobileNavDrawer) {
    navToggleBtn.addEventListener('click', () => {
      mobileNavDrawer.classList.add('active');
    });
  }
  if (mobileNavClose && mobileNavDrawer) {
    mobileNavClose.addEventListener('click', () => {
      mobileNavDrawer.classList.remove('active');
    });
  }

  // Quick Add To Cart Buttons
  document.querySelectorAll('.js-quick-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const productTitle = btn.dataset.title;
      const productPrice = Number(btn.dataset.price);
      const productImage = btn.dataset.image;

      const existing = cart.find(i => i.title === productTitle);
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({
          id: Date.now(),
          title: productTitle,
          variant: 'Standard / M',
          price: productPrice,
          qty: 1,
          image: productImage
        });
      }

      updateCartUI();
      openCart();
    });
  });

  // Category Filter Chips
  const filterChips = document.querySelectorAll('.filter-chip');
  const productCards = document.querySelectorAll('.product-card');

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const filter = chip.dataset.filter;
      productCards.forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Initial render
  updateCartUI();
});
