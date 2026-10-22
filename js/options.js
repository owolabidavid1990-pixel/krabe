/**
 * Krabe Kollection — Global Option Sets (Constants)
 * Mirrors the Bubble.io Option Sets for storefront dropdowns & forms.
 */

const KRABE_OPTIONS = {
  appointment_status: [
    { value: 'requested', label: 'Requested' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'inprogress', label: 'In Progress' },
    { value: 'done', label: 'Done' }
  ],
  clothing_category: [
    { value: 'native', label: 'Native' },
    { value: 'formal', label: 'Formal' },
    { value: 'streetwear', label: 'Streetwear' }
  ],
  delivery_option: [
    { value: 'pickup', label: 'Pickup' },
    { value: 'local delivery', label: 'Local Delivery' },
    { value: 'international delivery', label: 'International Delivery' }
  ],
  fabric: [
    { value: 'cotton', label: 'Cotton' },
    { value: 'linen', label: 'Linen' },
    { value: 'denim', label: 'Denim' },
    { value: 'wool', label: 'Wool' },
    { value: 'cashmere', label: 'Cashmere' },
    { value: 'silk', label: 'Silk' },
    { value: 'polyester', label: 'Polyester' },
    { value: 'nylon', label: 'Nylon' },
    { value: 'leather', label: 'Leather' },
    { value: 'suede', label: 'Suede' },
    { value: 'velvet', label: 'Velvet' },
    { value: 'satin', label: 'Satin' },
    { value: 'knit', label: 'Knit' },
    { value: 'fleece', label: 'Fleece' },
    { value: 'other', label: 'Other' },
    { value: 'ankara', label: 'Ankara' },
    { value: 'lace', label: 'Lace' }
  ],
  gender: [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'unisex', label: 'Unisex' }
  ],
  measurement_type: [
    { value: 'custom', label: 'Custom' },
    { value: 'from chart', label: 'From Chart' }
  ],
  order_status: [
    { value: 'placed', label: 'Placed' },
    { value: 'payment confirmed', label: 'Payment Confirmed' },
    { value: 'order confirmed', label: 'Order Confirmed' },
    { value: 'processing order', label: 'Processing Order' },
    { value: 'order ready', label: 'Order Ready' },
    { value: 'dispatched', label: 'Dispatched' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' }
  ],
  payment_status: [
    { value: 'success', label: 'Success' },
    { value: 'failed', label: 'Failed' },
    { "value": 'abandoned', label: 'Abandoned' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'queued', label: 'Queued' },
    { value: 'reversed', label: 'Reversed' }
  ],
  product_type: [
    { value: 'bespoke', label: 'Bespoke' },
    { value: 'made to order', label: 'Made to Order' }
  ],
  return_status: [
    { value: 'requested', label: 'Requested' },
    { value: 'returned', label: 'Returned' }
  ],
  role: [
    { value: 'customer', label: 'Customer' },
    { value: 'admin', label: 'Admin' },
    { value: 'super admin', label: 'Super Admin' }
  ],
  size: [
    { value: 'XS', label: 'XS' },
    { value: 'S', label: 'S' },
    { value: 'M', label: 'M' },
    { value: 'L', label: 'L' },
    { value: 'XL', label: 'XL' },
    { value: 'XXL', label: 'XXL' },
    { value: 'XXXL', label: 'XXXL' },
    { value: 'custom', label: 'Custom (Bespoke)' }
  ],
  variant_color: [
    { value: 'Midnight Blue', label: 'Midnight Blue', code: '#2F475A' },
    { value: 'Navy Blue', label: 'Navy Blue', code: '#1B2A4A' },
    { value: 'Royal Blue', label: 'Royal Blue', code: '#2454A6' },
    { value: 'Sky Blue', label: 'Sky Blue', code: '#87CEEB' },
    { value: 'Obsidian Black', label: 'Obsidian Black', code: '#121212' },
    { value: 'Charcoal Grey', label: 'Charcoal Grey', code: '#36454F' },
    { value: 'Slate Grey', label: 'Slate Grey', code: '#708090' },
    { value: 'Pure White', label: 'Pure White', code: '#FFFFFF' },
    { value: 'Bone Linen', label: 'Bone Linen', code: '#FAF8F5' },
    { value: 'Ivory Cream', label: 'Ivory Cream', code: '#FDFBF7' },
    { value: 'Benin Bronze', label: 'Benin Bronze', code: '#C58A55' },
    { value: 'Caramel Tan', label: 'Caramel Tan', code: '#A76D38' },
    { value: 'Chocolate Brown', label: 'Chocolate Brown', code: '#3E2723' },
    { value: 'Champagne Gold', label: 'Champagne Gold', code: '#D4AF37' },
    { value: 'Emerald Green', label: 'Emerald Green', code: '#0D5C3A' },
    { value: 'Olive Green', label: 'Olive Green', code: '#556B2F' },
    { value: 'Sage Green', label: 'Sage Green', code: '#9CAF88' },
    { value: 'Burgundy Wine', label: 'Burgundy Wine', code: '#5A1827' },
    { value: 'Crimson Red', label: 'Crimson Red', code: '#990000' },
    { value: 'Terracotta Rust', label: 'Terracotta Rust', code: '#C85A32' },
    { value: 'Mustard Yellow', label: 'Mustard Yellow', code: '#E1AD01' },
    { value: 'Deep Plum', label: 'Deep Plum', code: '#4B244A' },
    { value: 'Soft Lilac', label: 'Soft Lilac', code: '#C8A2C8' },
    { value: 'Dusty Rose', label: 'Dusty Rose', code: '#DCAE96' }
  ]
};

// Make accessible to both browser window and ES module imports
if (typeof window !== 'undefined') {
  window.KRABE_OPTIONS = KRABE_OPTIONS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = KRABE_OPTIONS;
}
