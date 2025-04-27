// models/User.js
const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home' },
  fullAddress: { type: String, required: true },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number] // [longitude, latitude]
  }
});

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: ''
  },
  addresses: [addressSchema],
  defaultAddressIndex: {
    type: Number,
    default: 0
  },
  preferredLanguage: {
    type: String,
    enum: ['english', 'tamil']
  },
  lastInteractionAt: {
    type: Date,
    default: Date.now
  },
  cart: {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    items: [{
      itemId: { type: mongoose.Schema.Types.ObjectId },
      name: String,
      quantity: Number,
      price: Number
    }],
    total: { type: Number, default: 0 }
  },
  conversationState: {
    context: { 
      type: String, 
      default: 'welcome',
      enum: [
        'welcome', 
        'language_selection', 
        'location_sharing', 
        'main_menu',
        'vendor_browsing',
        'vendor_selection',
        'menu_browsing',
        'item_selection',
        'cart_management',
        'view_cart',
        'checkout',
        'address_confirmation',
        'payment_selection',
        'special_instructions',
        'order_status',
        'order_history',
        'help',
        'help_ordering',
        'help_payment',
        'help_delivery',
        'contact_support',
        'feedback'
      ]
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }
}, { timestamps: true });

// Index for geospatial queries
userSchema.index({ 'addresses.location': '2dsphere' });

module.exports = mongoose.model('User', userSchema);