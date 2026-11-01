/**
 * Krabe Kollection — Global Storefront Interactions & Cart Drawer
 */

const KRABE_CART_STORAGE_KEY = 'krabe_cart';

function getSupabaseClient() {
  if (window.krabeClient) return window.krabeClient;
  if (window.KRABE_CONFIG && typeof window.KRABE_CONFIG.getClient === 'function') {
    return window.KRABE_CONFIG.getClient();
  }
  return null;
}

function getSupabaseUser() {
  if (window.krabeUser) return window.krabeUser;
  if (window.krabeSession && window.krabeSession.user) return window.krabeSession.user;
  if (window.KrabeAuth && typeof window.KrabeAuth.getUser === 'function') {
    return window.KrabeAuth.getUser();
  }
  return null;
}

function getStoredCart() {
  try {
    const raw = localStorage.getItem(KRABE_CART_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[Krabe Cart] Could not parse stored cart:', e);
  }
  return [];
}

function setStoredCart(cartItems) {
  try {
    localStorage.setItem(KRABE_CART_STORAGE_KEY, JSON.stringify(cartItems));
  } catch (e) {
    console.warn('[Krabe Cart] Could not save cart to localStorage:', e);
  }
  window.dispatchEvent(new CustomEvent('krabe:cart:updated', { detail: { cart: cartItems } }));
}

/**
 * Global Product Badge Generator
 * - 'Featured' badge on top-left (when is_featured is true)
 * - 'New Drop' badge on top-right (when created_at is within the last 30 days)
 * Both badges can display simultaneously on the same product card.
 */
function getProductBadgesHTML(prod) {
  if (!prod) return '';
  let badges = '';

  // 1. Featured badge (Left) — when is_featured is true
  if (prod.is_featured === true || prod.is_featured === 'true' || prod.is_featured === 1) {
    badges += `<span class="product-badge badge-featured body-10">Featured</span>`;
  }

  // 2. New Drop badge (Right) — when created_at is within the last 30 days
  if (prod.created_at) {
    const createdMs = new Date(prod.created_at).getTime();
    if (!isNaN(createdMs)) {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const diffMs = Date.now() - createdMs;
      // Allow 60 seconds clock skew, and strictly cap at 30 days
      if (diffMs >= -60000 && diffMs <= thirtyDaysMs) {
        badges += `<span class="product-badge badge-new body-10">New Drop</span>`;
      }
    }
  }

  return badges;
}
window.getProductBadgesHTML = getProductBadgesHTML;

document.addEventListener('DOMContentLoaded', () => {
  // --- Cart State & Elements ---
  const cartOverlay = document.getElementById('cartOverlay');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOpenBtns = document.querySelectorAll('.js-open-cart');
  const cartCloseBtn = document.getElementById('cartCloseBtn');
  const cartBody = document.querySelector('.cart-drawer-body');

  // Mobile Nav Elements
  const navToggleBtn = document.getElementById('navToggleBtn');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');
  const mobileNavClose = document.getElementById('mobileNavClose');

  // Dynamic Cart State (Loaded from LocalStorage, zero hardcoded mock data)
  let cart = getStoredCart();

  function formatNaira(amount) {
    return '₦' + Number(amount || 0).toLocaleString('en-NG');
  }

  function updateCartUI() {
    // Inventory integrity clamp: enforce that RTW quantities in memory never exceed physical stock
    cart.forEach(item => {
      const isRTW = (item.product_type || '').toLowerCase() === 'ready to wear';
      if (isRTW && item.stock_quantity != null && Number(item.qty) > Number(item.stock_quantity)) {
        item.qty = Math.max(0, Number(item.stock_quantity));
      }
    });

    window.krabeCartItems = cart;
    window.dispatchEvent(new CustomEvent('krabe:cart:updated', { detail: { cart } }));

    // 1. Total Count Badge across all headers
    const totalCount = cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
    const badges = document.querySelectorAll('.cart-badge');
    badges.forEach(badge => {
      badge.textContent = totalCount;
      badge.style.display = totalCount > 0 ? 'inline-flex' : 'none';
    });

    // 2. Subtotal Calculation
    const subtotal = cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)), 0);
    const subtotalEls = document.querySelectorAll('.cart-subtotal-amount, #summarySubtotal');
    subtotalEls.forEach(el => {
      el.textContent = formatNaira(subtotal);
    });

    // Free delivery indicator (threshold: ₦200,000 for Lagos delivery)
    const freeShippingEl = document.querySelector('.cart-free-shipping');
    if (freeShippingEl) {
      if (subtotal >= 200000) {
        freeShippingEl.innerHTML = '✓ You qualify for <strong>Free Lagos Delivery</strong>';
        freeShippingEl.style.color = '#15803D';
      } else if (subtotal > 0) {
        const remaining = 200000 - subtotal;
        freeShippingEl.innerHTML = `Add <strong>${formatNaira(remaining)}</strong> more for Free Lagos Delivery`;
        freeShippingEl.style.color = 'var(--color-primary, #44637B)';
      } else {
        freeShippingEl.innerHTML = '✓ Free Lagos Delivery on orders over ₦200,000';
        freeShippingEl.style.color = '';
      }
    }

    // 3. Line Items Rendering in Cart Drawer
    if (cartBody) {
      if (cart.length === 0) {
        cartBody.innerHTML = `
          <div style="text-align: center; padding: 48px 16px; color: var(--color-text-muted, #6E7175);">
            <svg style="width: 48px; height: 48px; margin: 0 auto 14px; opacity: 0.35; display: block;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.4" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
            </svg>
            <p class="body-16" style="font-weight: 700; margin-bottom: 6px; color: var(--color-obsidian); letter-spacing: 0.5px;">Your shopping bag is empty</p>
            <p class="body-12" style="line-height: 1.5; max-width: 260px; margin: 0 auto 18px;">Explore our tailored native wear, bespoke suits, or luxury streetwear.</p>
            <a href="shop.html" onclick="document.getElementById('cartCloseBtn') && document.getElementById('cartCloseBtn').click();" class="body-12" style="display: inline-block; padding: 10px 22px; background: var(--color-primary); color: #ffffff; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; border-radius: 4px; text-decoration: none;">
              Explore Collections &rarr;
            </a>
          </div>
        `;

        const checkoutBtn = document.querySelector('.btn-checkout');
        if (checkoutBtn) {
          checkoutBtn.style.pointerEvents = 'none';
          checkoutBtn.style.opacity = '0.45';
        }
      } else {
        const checkoutBtn = document.querySelector('.btn-checkout');
        if (checkoutBtn) {
          checkoutBtn.style.pointerEvents = 'auto';
          checkoutBtn.style.opacity = '1';
        }

        cartBody.innerHTML = `
          <div class="cart-items-top-bar" style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--color-border); margin-bottom: -4px;">
            <span class="body-12" style="color: var(--color-text-muted); font-weight: 600; letter-spacing: 0.5px;">${totalCount} ITEM${totalCount > 1 ? 'S' : ''}</span>
            <button type="button" class="js-clear-cart-btn body-12" style="background: none; border: none; color: #DC2626; cursor: pointer; text-decoration: underline; font-weight: 600; padding: 0;">Clear Bag</button>
          </div>
          ${cart.map(item => `
          <div class="cart-item" data-id="${item.id}">
            <img src="${item.image || 'assets/brand/krabe main logo.svg'}" alt="${item.title}" class="cart-item-img">
            <div class="cart-item-details">
              <h4 class="h4">${item.title}</h4>
              <div class="cart-item-meta body-12" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                <span>${item.color || 'Standard'} &bull; Size: <strong>${item.custom_measurement_label ? `Custom (${item.custom_measurement_label})` : (item.size || 'M')}</strong></span>
                ${item.product_id ? `
                  <a href="product.html?id=${encodeURIComponent(item.product_id)}${item.variant_id ? `&variant_id=${encodeURIComponent(item.variant_id)}` : ''}&size=${encodeURIComponent(item.size || 'M')}" class="js-cart-edit-link body-10" style="color: var(--color-primary); font-weight: 600; text-decoration: underline;">
                    Edit
                  </a>
                ` : ''}
              </div>
              <div class="cart-item-price body-14">${formatNaira(item.price)}</div>
              <div class="cart-qty-ctrl">
                <button type="button" class="cart-qty-btn body-14 js-qty-minus" data-id="${item.id}" aria-label="Decrease quantity">−</button>
                <span class="cart-qty-val body-12">${item.qty}</span>
                <button type="button" class="cart-qty-btn body-14 js-qty-plus" data-id="${item.id}" aria-label="Increase quantity">+</button>
              </div>
            </div>
            <button type="button" class="cart-item-del js-del-item" data-id="${item.id}" aria-label="Remove item">
              <svg style="width: 17px; height: 17px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        `).join('')}
        `;

        // Attach listeners for Line Item Plus
        cartBody.querySelectorAll('.js-qty-plus').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const target = cart.find(i => String(i.id) === String(id));
            if (target) {
              const isRTW = target.product_type === 'ready to wear';
              const cap = isRTW && target.stock_quantity != null ? target.stock_quantity : 100;
              if (target.qty < cap) {
                target.qty = Math.min(cap, target.qty + 1);
                const user = getSupabaseUser();
                const client = getSupabaseClient();
                if (user && user.id && client && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
                  await client.from('cart_item').update({ quantity: target.qty, updated_at: new Date().toISOString() }).eq('id', id);
                } else {
                  setStoredCart(cart);
                }
                updateCartUI();
              }
            }
          });
        });

        // Attach listeners for Line Item Minus
        cartBody.querySelectorAll('.js-qty-minus').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const target = cart.find(i => String(i.id) === String(id));
            if (target) {
              const user = getSupabaseUser();
              const client = getSupabaseClient();
              const isDbId = user && user.id && client && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

              if (target.qty > 1) {
                target.qty -= 1;
                if (isDbId) {
                  await client.from('cart_item').update({ quantity: target.qty, updated_at: new Date().toISOString() }).eq('id', id);
                } else {
                  setStoredCart(cart);
                }
              } else {
                cart = cart.filter(i => String(i.id) !== String(id));
                if (isDbId) {
                  await client.from('cart_item').delete().eq('id', id);
                } else {
                  setStoredCart(cart);
                }
              }
              updateCartUI();
            }
          });
        });

        // Attach listeners for Line Item Delete
        cartBody.querySelectorAll('.js-del-item').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            cart = cart.filter(i => String(i.id) !== String(id));
            const user = getSupabaseUser();
            const client = getSupabaseClient();
            if (user && user.id && client && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
              await client.from('cart_item').delete().eq('id', id);
            } else {
              setStoredCart(cart);
            }
            updateCartUI();
          });
        });
        // Attach listeners for Edit link
        cartBody.querySelectorAll('.js-cart-edit-link').forEach(link => {
          link.addEventListener('click', () => {
            closeCart();
          });
        });

        // Attach listener for Clear Bag (In-place two-step confirmation, no browser alert)
        const clearCartBtn = cartBody.querySelector('.js-clear-cart-btn');
        if (clearCartBtn) {
          clearCartBtn.addEventListener('click', async () => {
            if (clearCartBtn.dataset.confirming === 'true') {
              clearTimeout(clearCartBtn._timer);
              await clearCart();
            } else {
              clearCartBtn.dataset.confirming = 'true';
              clearCartBtn.textContent = 'Confirm Clear Bag?';
              clearCartBtn.style.color = '#B91C1C';
              clearCartBtn.style.fontWeight = '700';
              clearCartBtn._timer = setTimeout(() => {
                if (clearCartBtn) {
                  clearCartBtn.dataset.confirming = 'false';
                  clearCartBtn.textContent = 'Clear Bag';
                  clearCartBtn.style.color = '#DC2626';
                  clearCartBtn.style.fontWeight = '600';
                }
              }, 3000);
            }
          });
        }
      }
    }

    // 4. Checkout Page Order Summary Rendering (if present on checkout.html)
    const checkoutItemsContainer = document.getElementById('checkoutItemsList');
    if (checkoutItemsContainer) {
      const btnPlaceOrder = document.getElementById('btnPlaceOrder');

      if (cart.length === 0) {
        checkoutItemsContainer.innerHTML = `
          <div style="text-align: center; padding: 32px 12px; color: var(--color-text-muted);">
            <svg style="width: 44px; height: 44px; margin: 0 auto 12px; opacity: 0.4; display: block;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
            </svg>
            <p class="body-14" style="margin-bottom: 16px;">Your shopping bag is currently empty.</p>
            <a href="shop.html" class="btn btn-outline body-12" style="padding: 10px 18px; letter-spacing: 1.5px; text-transform: uppercase;">
              Explore Collections &rarr;
            </a>
          </div>
        `;
        if (btnPlaceOrder) {
          btnPlaceOrder.disabled = true;
          btnPlaceOrder.style.opacity = '0.5';
          btnPlaceOrder.style.cursor = 'not-allowed';
          btnPlaceOrder.innerHTML = 'Shopping Bag is Empty';
        }
      } else {
        checkoutItemsContainer.innerHTML = cart.map(item => {
          const itemImg = item.image || 'assets/brand/krabe main logo.svg';
          const itemTitle = item.title || 'Signature Garment';
          const itemVariant = item.variant || (
            item.custom_measurement_label
              ? `${item.color || 'Standard'} • Custom: ${item.custom_measurement_label}`
              : `${item.color || 'Standard'} • Size ${item.size || 'M'}`
          );
          const itemQty = Number(item.qty) || 1;
          const itemPrice = Number(item.price) || 0;
          return `
            <div class="summary-line-item">
              <img src="${itemImg}" alt="${itemTitle}" class="summary-item-img">
              <div class="summary-item-info">
                <div class="summary-item-title body-14">${itemTitle}</div>
                <div class="summary-item-variant body-12">${itemVariant} &bull; Qty: ${itemQty}</div>
                <div class="summary-item-price body-14">${formatNaira(itemPrice * itemQty)}</div>
              </div>
            </div>
          `;
        }).join('');

        if (btnPlaceOrder) {
          btnPlaceOrder.disabled = false;
          btnPlaceOrder.style.opacity = '1';
          btnPlaceOrder.style.cursor = 'pointer';
        }
      }

      // Shipping & Total calculations for checkout page
      const optPick = document.getElementById('optPickup');
      const isPickup = optPick && optPick.classList.contains('active');
      const stateSelect = document.getElementById('cState');
      const isLagos = !stateSelect || stateSelect.value === 'Lagos';
      let shipping = 0;

      if (isPickup) {
        shipping = 0;
      } else if (isLagos && (subtotal >= 200000 || subtotal === 0)) {
        shipping = 0;
      } else {
        shipping = isLagos ? 3500 : 4500;
      }

      const shipEl = document.getElementById('summaryShipping');
      if (shipEl) {
        if (shipping === 0) {
          shipEl.textContent = 'FREE';
          shipEl.style.color = '#15803D';
        } else {
          shipEl.textContent = formatNaira(shipping);
          shipEl.style.color = '';
        }
      }

      const total = Math.max(0, subtotal + shipping);
      const totalEl = document.getElementById('summaryTotal');
      if (totalEl) totalEl.textContent = formatNaira(total);

      if (btnPlaceOrder) {
        if (cart.length > 0) {
          btnPlaceOrder.innerHTML = `Pay <span id="btnPayAmount">${formatNaira(total)}</span> Now &rarr;`;
        }
      }
      const btnPay = document.getElementById('btnPayAmount');
      if (btnPay) btnPay.textContent = formatNaira(total);

      const confTotal = document.getElementById('confirmTotalCharged');
      if (confTotal) confTotal.textContent = formatNaira(total);
    }
  }

  // Load active cart (Supabase database if logged in, localStorage if guest)
  async function loadActiveCart() {
    const user = getSupabaseUser();
    const client = getSupabaseClient();

    if (user && user.id && client) {
      try {
        let { data, error } = await client
          .from('cart_item')
          .select(`
            id,
            quantity,
            unit_price,
            selected_size,
            product_variation_id,
            custom_measurement_id,
            custom_measurement (
              id,
              label,
              gender
            ),
            product_variation (
              id,
              color,
              color_code,
              price,
              main_image,
              quantity,
              product (
                id,
                title,
                type
              )
            )
          `)
          .eq('user_id', user.id);

        // Fallback: If PostgREST API schema cache is refreshing, fetch without custom_measurement embed
        if (error) {
          console.warn('[Krabe Cart] Direct embed notice, trying fallback join:', error.message);
          const fallbackRes = await client
            .from('cart_item')
            .select(`
              id,
              quantity,
              unit_price,
              selected_size,
              product_variation_id,
              custom_measurement_id,
              product_variation (
                id,
                color,
                color_code,
                price,
                main_image,
                quantity,
                product (
                  id,
                  title,
                  type
                )
              )
            `)
            .eq('user_id', user.id);

          if (!fallbackRes.error && Array.isArray(fallbackRes.data)) {
            data = fallbackRes.data;
            error = null;

            // Fetch measurement details directly if any items have custom_measurement_id
            const cmIds = [...new Set(data.map(i => i.custom_measurement_id).filter(Boolean))];
            if (cmIds.length > 0) {
              try {
                const { data: cmData } = await client
                  .from('custom_measurement')
                  .select('id, label, gender')
                  .in('id', cmIds);

                if (Array.isArray(cmData)) {
                  const cmMap = Object.fromEntries(cmData.map(c => [String(c.id), c]));
                  data.forEach(row => {
                    if (row.custom_measurement_id && cmMap[String(row.custom_measurement_id)]) {
                      row.custom_measurement = cmMap[String(row.custom_measurement_id)];
                    }
                  });
                }
              } catch (cmErr) {
                console.warn('[Krabe Cart] Could not fetch custom measurement names:', cmErr);
              }
            }
          }
        }

        if (!error && Array.isArray(data)) {
          const syncPromises = [];
          cart = data.map(row => {
            const pv = row.product_variation || {};
            const prod = pv.product || {};
            const cm = row.custom_measurement || {};
            const itemSize = row.selected_size || 'M';
            const isCustom = String(itemSize).toLowerCase() === 'custom';
            const displayVariant = isCustom && cm.label
              ? `${pv.color || 'Standard'} / Custom: ${cm.label}`
              : `${pv.color || 'Standard'} / ${itemSize}`;

            const isRTW = (prod.type || '').toLowerCase() === 'ready to wear';
            const stockQty = (pv.quantity != null) ? Number(pv.quantity) : null;
            let currentQty = Number(row.quantity) || 1;

            // Option 2: Permanent overwrite in DB if RTW stock dropped below cart quantity
            if (isRTW && stockQty !== null && currentQty > stockQty) {
              currentQty = Math.max(0, stockQty);
              // Permanently persist new clamped quantity into Supabase cart_item row
              syncPromises.push(
                client.from('cart_item')
                  .update({ quantity: currentQty, updated_at: new Date().toISOString() })
                  .eq('id', row.id)
                  .eq('user_id', user.id)
              );
            }

            return {
              id: row.id,
              product_id: prod.id || null,
              variant_id: row.product_variation_id,
              product_variation_id: row.product_variation_id,
              title: prod.title || 'Signature Garment',
              variant: displayVariant,
              size: itemSize,
              custom_measurement_id: row.custom_measurement_id || null,
              custom_measurement_label: cm.label || null,
              color: pv.color || 'Standard',
              price: Number(row.unit_price) || Number(pv.price) || 0,
              qty: currentQty,
              image: pv.main_image || 'assets/brand/krabe main logo.svg',
              stock_quantity: stockQty,
              product_type: prod.type || null
            };
          });

          // Filter out completely sold-out RTW items (qty === 0) and remove from DB
          cart = cart.filter(i => {
            const isRTW = (i.product_type || '').toLowerCase() === 'ready to wear';
            if (isRTW && i.qty === 0) {
              syncPromises.push(client.from('cart_item').delete().eq('id', i.id).eq('user_id', user.id));
              return false;
            }
            return true;
          });

          if (syncPromises.length > 0) {
            try {
              await Promise.all(syncPromises);
            } catch (pErr) {
              console.warn('[Krabe Cart] Could not persist stock clamp to DB:', pErr);
            }
          }

          updateCartUI();
          return;
        }
      } catch (err) {
        console.warn('[Krabe Cart] Could not fetch DB cart:', err);
      }
    }

    // Guest fallback
    cart = getStoredCart();

    // Guest cart integrity check: verify all variant IDs still exist in DB, remove discontinued items,
    // and re-cap RTW quantities against live stock — all in one query
    if (client) {
      const allVariantIds = [...new Set(
        cart.map(i => i.variant_id || i.product_variation_id).filter(v => v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))
      )];
      if (allVariantIds.length > 0) {
        try {
          const { data: stockData } = await client
            .from('product_variation')
            .select('id, quantity')
            .in('id', allVariantIds);

          if (Array.isArray(stockData) && stockData.length > 0) {
            const stockMap = Object.fromEntries(stockData.map(r => [String(r.id), r.quantity]));
            let changed = false;

            // Remove items whose variant ID was not returned (product deleted / discontinued)
            const beforeCount = cart.length;
            cart = cart.filter(item => {
              const vid = item.variant_id || item.product_variation_id;
              return !vid || stockMap.hasOwnProperty(String(vid));
            });
            if (cart.length < beforeCount) changed = true;

            // For RTW items: update live stock_quantity and cap qty if stock dropped
            cart.forEach(item => {
              const isRTW = (item.product_type || '').toLowerCase() === 'ready to wear';
              if (!isRTW) return;
              const vid = String(item.variant_id || item.product_variation_id || '');
              const liveStock = stockMap[vid];
              if (liveStock != null) {
                item.stock_quantity = Number(liveStock);
                if (item.qty > liveStock) {
                  item.qty = Math.max(0, Number(liveStock));
                  changed = true;
                }
              }
            });

            // Remove RTW items that are now sold out (qty === 0)
            cart = cart.filter(i => !(i.product_type === 'ready to wear' && i.qty === 0));
            if (changed) setStoredCart(cart);
          }
        } catch (stockErr) {
          console.warn('[Krabe Cart] Could not validate guest cart against DB:', stockErr);
        }
      }
    }

    updateCartUI();
  }

  // Add Item to Cart Function (handles DB persistence for logged-in, localStorage for guest with variant_id + size deduplication, capped at 100 or stock_quantity for RTW)
  async function addToCart({ id, variant_id, product_variation_id, product_id, title, price, image, size, color, qty, custom_measurement_id = null, custom_measurement_label = null, setExact = false, skipOpen = false, stock_quantity = null, product_type = null }) {
    const targetVariantId = variant_id || product_variation_id || id;
    const chosenSize = size || 'M';
    const chosenColor = color || 'Standard';
    const isCustom = String(chosenSize).toLowerCase() === 'custom';
    const isRTW = product_type === 'ready to wear';

    // RTW cannot use custom measurements
    if (isRTW && isCustom) {
      alert('Ready-to-wear products cannot use custom measurements. Please select a standard size.');
      return;
    }

    // Cap quantity: RTW uses stock_quantity if available, otherwise 100
    const cap = isRTW && stock_quantity != null ? stock_quantity : 100;
    const chosenQty = Math.min(cap, Math.max(1, Number(qty) || 1));
    const variantLabel = isCustom && custom_measurement_label
      ? `${chosenColor} / Custom: ${custom_measurement_label}`
      : `${chosenColor} / ${chosenSize}`;

    const user = getSupabaseUser();
    const client = getSupabaseClient();

    // 1. Logged-in user: Persist directly into Supabase cart_item using variant_id & selected_size & custom_measurement_id
    if (user && user.id && client && targetVariantId) {
      try {
        let query = client
          .from('cart_item')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('product_variation_id', targetVariantId)
          .eq('selected_size', chosenSize);

        if (custom_measurement_id) {
          query = query.eq('custom_measurement_id', custom_measurement_id);
        } else {
          query = query.is('custom_measurement_id', null);
        }

        const { data: existing } = await query.maybeSingle();

        if (existing && existing.id) {
          const newQty = Math.min(cap, Math.max(1, setExact ? chosenQty : ((Number(existing.quantity) || 0) + chosenQty)));
          await client
            .from('cart_item')
            .update({
              quantity: newQty,
              unit_price: Number(price) || 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          await client
            .from('cart_item')
            .insert({
              user_id: user.id,
              product_variation_id: targetVariantId,
              selected_size: chosenSize,
              custom_measurement_id: custom_measurement_id || null,
              quantity: chosenQty,
              unit_price: Number(price) || 0,
              slug: title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null
            });
        }
        await loadActiveCart();
        if (!skipOpen) openCart();
        return;
      } catch (dbErr) {
        console.warn('[Krabe Cart] Error saving cart item to DB:', dbErr);
      }
    }

    // 2. Guest user: Persist to localStorage with deduplication strictly by id / variant_id / title AND chosen size
    const existingIndex = cart.findIndex(item => {
      if (id && String(item.id) === String(id)) return true;
      const matchSize = String(item.size || 'M').toLowerCase() === String(chosenSize).toLowerCase();
      if (!matchSize) return false;
      if (isCustom && custom_measurement_id && String(item.custom_measurement_id) !== String(custom_measurement_id)) {
        return false;
      }
      if (targetVariantId && (String(item.variant_id) === String(targetVariantId) || String(item.product_variation_id) === String(targetVariantId) || String(item.id) === String(targetVariantId))) {
        return true;
      }
      if (title && item.title && String(item.title).toLowerCase() === String(title).toLowerCase()) {
        if (!chosenColor || !item.color || String(item.color).toLowerCase() === String(chosenColor).toLowerCase()) {
          return true;
        }
      }
      return false;
    });

    if (existingIndex > -1) {
      cart[existingIndex].qty = Math.min(cap, Math.max(1, setExact ? chosenQty : (cart[existingIndex].qty + chosenQty)));
    } else {
      cart.push({
        id: targetVariantId ? `${targetVariantId}-${chosenSize}${custom_measurement_id ? `-${custom_measurement_id}` : ''}` : Date.now(),
        product_id: product_id || null,
        variant_id: targetVariantId,
        product_variation_id: targetVariantId,
        title,
        variant: variantLabel,
        size: chosenSize,
        custom_measurement_id: custom_measurement_id || null,
        custom_measurement_label: custom_measurement_label || null,
        color: chosenColor,
        price: Number(price) || 0,
        qty: chosenQty,
        image: image || 'assets/brand/krabe main logo.svg',
        stock_quantity: stock_quantity != null ? Number(stock_quantity) : null,
        product_type: product_type || null
      });
    }

    setStoredCart(cart);
    updateCartUI();
    if (!skipOpen) openCart();
  }

  // Remove Item from Cart Function (handles DB persistence for logged-in, localStorage for guest)
  async function removeFromCart({ id, variant_id, product_variation_id, size, title, color, custom_measurement_id }) {
    const targetVariantId = variant_id || product_variation_id;
    const targetSize = size || 'M';
    const user = getSupabaseUser();
    const client = getSupabaseClient();

    if (user && user.id && client) {
      try {
        let query = client.from('cart_item').delete().eq('user_id', user.id);
        if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          query = query.eq('id', id);
        } else if (targetVariantId) {
          query = query.eq('product_variation_id', targetVariantId).eq('selected_size', targetSize);
          if (custom_measurement_id) {
            query = query.eq('custom_measurement_id', custom_measurement_id);
          } else {
            query = query.is('custom_measurement_id', null);
          }
        }
        await query;
        await loadActiveCart();
        return;
      } catch (dbErr) {
        console.warn('[Krabe Cart] Error deleting item from DB:', dbErr);
      }
    }

    cart = cart.filter(item => {
      if (id && String(item.id) === String(id)) return false;
      const matchSize = String(item.size || 'M').toLowerCase() === String(targetSize).toLowerCase();
      if (!matchSize) return true;
      if (custom_measurement_id && String(item.custom_measurement_id) !== String(custom_measurement_id)) {
        return true;
      }
      if (targetVariantId && (String(item.variant_id) === String(targetVariantId) || String(item.product_variation_id) === String(targetVariantId))) {
        return false;
      }
      if (title && item.title && String(item.title).toLowerCase() === String(title).toLowerCase()) {
        if (!color || !item.color || String(item.color).toLowerCase() === String(color).toLowerCase()) {
          return false;
        }
      }
      return true;
    });
    setStoredCart(cart);
    updateCartUI();
  }

  // Clear Entire Cart Function (handles DB deletion for logged-in, localStorage for guest)
  async function clearCart() {
    cart = [];
    const user = getSupabaseUser();
    const client = getSupabaseClient();
    if (user && user.id && client) {
      try {
        await client.from('cart_item').delete().eq('user_id', user.id);
      } catch (err) {
        console.warn('[Krabe Cart] Could not clear cart in DB:', err);
      }
    }
    setStoredCart(cart);
    updateCartUI();
  }

  // Global Cart API for page synchronization
  window.KrabeCart = {
    getCart: () => cart,
    getItem: (variantId, size, title, color, custom_measurement_id) => cart.find(i => {
      const matchSize = String(i.size || 'M').toLowerCase() === String(size || 'M').toLowerCase();
      if (!matchSize) return false;
      if (custom_measurement_id && String(i.custom_measurement_id) !== String(custom_measurement_id)) {
        return false;
      }
      if (variantId && (String(i.variant_id) === String(variantId) || String(i.product_variation_id) === String(variantId) || String(i.id) === String(variantId))) {
        return true;
      }
      if (title && i.title && String(i.title).toLowerCase() === String(title).toLowerCase()) {
        if (!color || !i.color || String(i.color).toLowerCase() === String(color).toLowerCase()) {
          return true;
        }
      }
      return false;
    }),
    setQuantity: (params) => addToCart({ ...params, setExact: true, skipOpen: true }),
    addToCart: (params) => addToCart(params),
    removeFromCart: (params) => removeFromCart(params),
    clearCart: () => clearCart(),
    refreshUserCart: () => loadActiveCart(),
    loadActiveCart: () => loadActiveCart(),
    updateCartUI: () => updateCartUI(),
    openCart: () => openCart(),
    closeCart: () => closeCart()
  };

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
  document.addEventListener('click', (e) => {
    if (e.target.closest('.js-open-cart')) {
      e.preventDefault();
      openCart();
    }
  });
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);
  if (cartOverlay) {
    cartOverlay.addEventListener('click', (e) => {
      if (e.target === cartOverlay) closeCart();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCart();
      if (window.KrabeSearchModal) window.KrabeSearchModal.close();
      if (mobileNavDrawer) mobileNavDrawer.classList.remove('active');
    }
  });

  // Mobile Menu Drawer
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

  // 1. PDP "Add / Remove Shopping Bag" Button (Takes active size, color & quantity from UI, toggles between Add and Remove)
  const pdpAddBtn = document.querySelector('.btn-add-bag');
  if (pdpAddBtn) {
    pdpAddBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const activeSizeBtn = document.querySelector('.size-btn.active');
      const variant_id = pdpAddBtn.dataset.variantId || pdpAddBtn.dataset.variationId || activeSizeBtn?.dataset.variantId || activeSizeBtn?.dataset.variationId;
      const product_id = pdpAddBtn.dataset.productId || null;
      const title = pdpAddBtn.dataset.title || document.querySelector('.pdp-title')?.textContent.trim() || 'Signature Garment';
      const price = Number(pdpAddBtn.dataset.price) || Number(activeSizeBtn?.dataset.price) || 195000;
      const image = pdpAddBtn.dataset.image || document.getElementById('mainPdpImg')?.getAttribute('src') || 'Krabe Cloth Concepts_230226_205405_1.jpg';
      
      const size = activeSizeBtn?.textContent.trim() || 'M';
      const color = document.getElementById('colorLabel')?.textContent.trim() || 'Standard';

      const isCustom = String(size).toLowerCase() === 'custom';
      const custom_measurement_id = activeSizeBtn?.dataset.customMeasurementId || window.pdpSelectedCustomMeasurementId || null;
      const custom_measurement_label = activeSizeBtn?.dataset.customMeasurementLabel || window.pdpSelectedCustomMeasurementLabel || null;

      // Read RTW stock info from the current product loaded on the PDP
      const productType = window.currentProduct?.type || null;
      const isRTW = productType === 'ready to wear';
      const stockQty = (isRTW && window.currentVariant?.quantity != null) ? Number(window.currentVariant.quantity) : null;

      // RTW cannot use custom measurements
      if (isRTW && isCustom) {
        alert('Ready-to-wear products cannot use custom measurements. Please select a standard size.');
        return;
      }

      if (isCustom) {
        const currentUser = getSupabaseUser();
        if (!currentUser || !currentUser.id) {
          alert('Please sign in or create an account to select or create a custom measurement.');
          if (window.KrabeAuthModal && typeof window.KrabeAuthModal.open === 'function') {
            window.KrabeAuthModal.open('signup');
          }
          return;
        }

        if (!custom_measurement_id) {
          if (typeof window.openCustomPickerModal === 'function') {
            window.openCustomPickerModal();
          } else {
            alert('Please select a custom measurement first.');
          }
          return;
        }
      }

      const existingCartItem = cart.find(i => {
        const matchSize = String(i.size || 'M').toLowerCase() === String(size).toLowerCase();
        if (!matchSize) return false;
        if (isCustom && custom_measurement_id && String(i.custom_measurement_id) !== String(custom_measurement_id)) {
          return false;
        }
        if (variant_id && (String(i.variant_id) === String(variant_id) || String(i.product_variation_id) === String(variant_id) || String(i.id) === String(variant_id))) {
          return true;
        }
        if (title && i.title && String(i.title).toLowerCase() === String(title).toLowerCase()) {
          if (!color || !i.color || String(i.color).toLowerCase() === String(color).toLowerCase()) {
            return true;
          }
        }
        return false;
      });

      if (existingCartItem) {
        // In cart: remove item from shopping bag
        await removeFromCart({ id: existingCartItem.id, variant_id, size, title, color, custom_measurement_id });
        const qtyValEl = document.getElementById('pdpQtyVal');
        if (qtyValEl) qtyValEl.textContent = '1';
      } else {
        // Not in cart: add exact staged quantity to bag (capped at stock_quantity for RTW, 100 for others)
        const qtyValEl = document.getElementById('pdpQtyVal');
        const cap = isRTW && stockQty != null ? stockQty : 100;
        const stagedQty = Math.min(cap, Math.max(1, Number(qtyValEl?.textContent.trim()) || 1));
        await addToCart({ 
          variant_id, 
          product_variation_id: variant_id, 
          product_id, 
          title, 
          price, 
          image, 
          size, 
          color, 
          qty: stagedQty, 
          custom_measurement_id, 
          custom_measurement_label, 
          setExact: true,
          stock_quantity: stockQty,
          product_type: productType
        });
      }
    });
  }

  // 2. Catalog & Quick Add Buttons (Delegated event listener so dynamic products work seamlessly)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.js-quick-add:not(.btn-add-bag)');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const productTitle = btn.dataset.title || 'Signature Piece';
    const productPrice = Number(btn.dataset.price) || 0;
    const productImage = btn.dataset.image;
    const variantId = btn.dataset.variantId || btn.dataset.variationId;
    const productId = btn.dataset.productId || null;
    const size = btn.dataset.size || 'M';
    const color = btn.dataset.color || 'Standard';
    const productType = btn.dataset.productType || null;
    const isRTW = productType === 'ready to wear';
    const rawStock = btn.dataset.stockQuantity;
    const stockQty = (isRTW && rawStock !== '' && rawStock != null) ? Number(rawStock) : null;

    if (isRTW && stockQty !== null && stockQty <= 0) {
      alert('This ready-to-wear piece is currently sold out.');
      return;
    }

    // Check if quantity in cart has already reached physical stock limit
    if (isRTW && stockQty !== null && window.KrabeCart && typeof window.KrabeCart.getItem === 'function') {
      const existing = window.KrabeCart.getItem(variantId, size, productTitle, color);
      if (existing && Number(existing.qty) >= stockQty) {
        alert(`Only ${stockQty} unit${stockQty > 1 ? 's' : ''} available in stock for this piece.`);
        return;
      }
    }

    addToCart({
      variant_id: variantId,
      product_variation_id: variantId,
      product_id: productId,
      title: productTitle,
      price: productPrice,
      image: productImage,
      size,
      color,
      qty: 1,
      stock_quantity: stockQty,
      product_type: productType
    });
  });

  // Category Filter Chips (Dynamic live cards filtering)
  function filterHomeCategoryCards(filterValue) {
    const filter = (filterValue || 'all').toLowerCase();
    const liveCards = document.querySelectorAll('#homeFeaturedGrid .product-card, .products-section .product-card');
    let visible = 0;
    liveCards.forEach(card => {
      const cat = (card.dataset.category || '').toLowerCase();
      if (filter === 'all' || cat === filter) {
        card.style.display = 'flex';
        visible++;
      } else {
        card.style.display = 'none';
      }
    });

    const grid = document.getElementById('homeFeaturedGrid');
    if (grid) {
      let emptyMsg = grid.querySelector('.filter-empty-state');
      if (visible === 0 && liveCards.length > 0) {
        if (!emptyMsg) {
          emptyMsg = document.createElement('div');
          emptyMsg.className = 'filter-empty-state';
          emptyMsg.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: var(--color-text-muted);';
          emptyMsg.innerHTML = '<p class="body-16" style="font-weight: 700; color: var(--color-obsidian); margin-bottom: 8px;">No garments currently listed in this category.</p><p class="body-14">Check back soon for upcoming archive releases.</p>';
          grid.appendChild(emptyMsg);
        }
      } else if (emptyMsg) {
        emptyMsg.remove();
      }
    }
  }

  const filterChips = document.querySelectorAll('.filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterHomeCategoryCards(chip.dataset.filter);
    });
  });

  window.filterHomeCategoryCards = filterHomeCategoryCards;

  // Cross-Window / Tab Storage Sync
  window.addEventListener('storage', (e) => {
    if (e.key === KRABE_CART_STORAGE_KEY) {
      cart = getStoredCart();
      updateCartUI();
    }
  });

  // Database Cart Sync Events
  window.addEventListener('krabe:cart:synced', () => {
    loadActiveCart();
  });

  window.addEventListener('krabe:session:changed', () => {
    loadActiveCart();
    syncNewsletterForms();
  });

  // Initial active cart load on page mount
  loadActiveCart();

  // Sync WhatsApp / Contact links
  if (window.KrabeContact && typeof window.KrabeContact.applyToDOM === 'function') {
    window.KrabeContact.applyToDOM();
  }

  /* =============================================================================
     NEWSLETTER SUBSCRIPTION MANAGER (GUEST INPUT + LOGGED-IN 1-CLICK TOGGLE)
     ============================================================================= */
  let currentNewsletterSubscriber = null;
  let isNewsletterChecking = false;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function fetchUserNewsletterSubscription(user) {
    const client = getSupabaseClient();
    if (!client || !user || !user.email) {
      currentNewsletterSubscriber = null;
      return null;
    }

    try {
      const cleanEmail = user.email.toLowerCase().trim();
      const { data, error } = await client
        .from('newsletter_subscriber')
        .select('id, email, is_active, user_id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (!error) {
        currentNewsletterSubscriber = data;
        return data;
      }
    } catch (err) {
      console.warn('[Krabe Newsletter] Fetch error:', err);
    }
    return null;
  }

  function showNewsletterFeedback(form, message, type = 'success', autoHideMs = 6000) {
    if (!form) return;
    const feedbackEl = form.querySelector('.newsletter-feedback');
    if (!feedbackEl) return;

    feedbackEl.className = `newsletter-feedback ${type}`;
    feedbackEl.textContent = message;
    feedbackEl.style.display = 'block';

    if (form._feedbackTimer) clearTimeout(form._feedbackTimer);
    if (autoHideMs > 0) {
      form._feedbackTimer = setTimeout(() => {
        feedbackEl.style.display = 'none';
      }, autoHideMs);
    }
  }

  function renderNewsletterForm(form, user, subscriberRecord) {
    if (!form) return;

    if (user && user.email) {
      const isSubscribed = Boolean(subscriberRecord && subscriberRecord.is_active);
      const userEmail = escapeHtml(user.email);

      form.innerHTML = `
        <div class="newsletter-user-badge">
          <span class="newsletter-status-dot ${isSubscribed ? '' : 'inactive'}"></span>
          <span class="newsletter-user-text">
            ${isSubscribed 
              ? `Subscribed as <strong>${userEmail}</strong>` 
              : `Subscribe using <strong>${userEmail}</strong>`}
          </span>
        </div>
        <button type="button" class="newsletter-btn ${isSubscribed ? 'newsletter-btn--unsubscribe' : ''}" data-newsletter-action="${isSubscribed ? 'unsubscribe' : 'subscribe'}">
          ${isSubscribed ? 'Unsubscribe' : 'Subscribe'}
        </button>
        <div class="newsletter-feedback" style="display: none;" role="status"></div>
      `;

      const actionBtn = form.querySelector('[data-newsletter-action]');
      if (actionBtn) {
        actionBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          const client = getSupabaseClient();
          if (!client) {
            showNewsletterFeedback(form, 'Service temporarily unavailable.', 'error');
            return;
          }

          const action = actionBtn.getAttribute('data-newsletter-action');
          actionBtn.disabled = true;

          if (action === 'unsubscribe') {
            actionBtn.textContent = 'Unsubscribing...';
            try {
              if (subscriberRecord && subscriberRecord.id) {
                const { error } = await client
                  .from('newsletter_subscriber')
                  .update({ 
                    is_active: false,
                    user_id: user.id 
                  })
                  .eq('id', subscriberRecord.id);

                if (error) throw error;
                subscriberRecord.is_active = false;
              }
              renderAllNewsletterForms(user, subscriberRecord);
              showNewsletterFeedback(form, 'You have unsubscribed from private releases.', 'info');
            } catch (err) {
              console.error('[Krabe Newsletter] Unsubscribe error:', err);
              actionBtn.disabled = false;
              actionBtn.textContent = 'Unsubscribe';
              showNewsletterFeedback(form, 'Failed to unsubscribe. Please try again.', 'error');
            }
          } else {
            actionBtn.textContent = 'Subscribing...';
            try {
              const cleanEmail = user.email.toLowerCase().trim();
              if (subscriberRecord && subscriberRecord.id) {
                const { error } = await client
                  .from('newsletter_subscriber')
                  .update({ is_active: true, user_id: user.id })
                  .eq('id', subscriberRecord.id);

                if (error) throw error;
                subscriberRecord.is_active = true;
              } else {
                const { data, error } = await client
                  .from('newsletter_subscriber')
                  .insert({
                    email: cleanEmail,
                    user_id: user.id,
                    is_active: true
                  })
                  .select('id, email, is_active, user_id')
                  .single();

                if (error) throw error;
                subscriberRecord = data;
                currentNewsletterSubscriber = data;
              }

              renderAllNewsletterForms(user, subscriberRecord);
              showNewsletterFeedback(form, 'You are now subscribed to Krabe private releases.', 'success');
            } catch (err) {
              console.error('[Krabe Newsletter] Subscribe error:', err);
              actionBtn.disabled = false;
              actionBtn.textContent = 'Subscribe';
              showNewsletterFeedback(form, 'Failed to subscribe. Please try again.', 'error');
            }
          }
        });
      }
    } else {
      // Guest visitor: render email input + Subscribe button
      form.innerHTML = `
        <input type="email" required placeholder="Enter your email address" class="newsletter-input" autocomplete="email">
        <button type="submit" class="newsletter-btn">Subscribe</button>
        <div class="newsletter-feedback" style="display: none;" role="status"></div>
      `;

      form.onsubmit = async (e) => {
        e.preventDefault();
        const input = form.querySelector('.newsletter-input');
        const submitBtn = form.querySelector('.newsletter-btn');
        const email = input ? input.value.trim().toLowerCase() : '';

        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!email || !emailRegex.test(email)) {
          showNewsletterFeedback(form, 'Please enter a valid email address.', 'error');
          if (input) input.focus();
          return;
        }

        const client = getSupabaseClient();
        if (!client) {
          showNewsletterFeedback(form, 'Service temporarily unavailable.', 'error');
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Subscribing...';
        }

        try {
          const { error } = await client
            .from('newsletter_subscriber')
            .insert({ email, is_active: true });

          if (error) {
            if (error.code === '23505' || (error.message && error.message.toLowerCase().includes('duplicate'))) {
              showNewsletterFeedback(form, 'You are already subscribed to Krabe private releases.', 'info');
            } else {
              throw error;
            }
          } else {
            showNewsletterFeedback(form, 'Thank you for joining Krabe Kollection.', 'success');
            if (input) input.value = '';
          }
        } catch (err) {
          console.error('[Krabe Newsletter] Guest subscribe error:', err);
          showNewsletterFeedback(form, 'Subscription failed. Please try again.', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Subscribe';
          }
        }
      };
    }
  }

  function renderAllNewsletterForms(user, subscriberRecord) {
    const forms = document.querySelectorAll('.newsletter-form, [data-newsletter-form]');
    forms.forEach(form => renderNewsletterForm(form, user, subscriberRecord));
  }

  async function syncNewsletterForms() {
    if (isNewsletterChecking) return;
    isNewsletterChecking = true;

    try {
      const user = getSupabaseUser();
      let record = null;
      if (user && user.email) {
        record = await fetchUserNewsletterSubscription(user);
      } else {
        currentNewsletterSubscriber = null;
      }
      renderAllNewsletterForms(user, record);
    } finally {
      isNewsletterChecking = false;
    }
  }

  window.KrabeNewsletter = {
    sync: syncNewsletterForms,
    getSubscriber: () => currentNewsletterSubscriber
  };

  // Initial newsletter sync on page mount
  syncNewsletterForms();
});
