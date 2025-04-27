// models/User.js
const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home' },
  fullAddress: { type: String, required: true },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
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
  addresses: {
    type: [addressSchema],
    default: [] // Ensure it always has a default empty array
  },
  defaultAddressIndex: {
    type: Number,
    default: 0
  },
  preferredLanguage: {
    type: String,
    enum: ['english', 'tamil'],
    default: 'english' // Add default language
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

// Add method to add location safely
userSchema.methods.addLocation = function(latitude, longitude, address) {
  if (!this.addresses) {
    this.addresses = [];
  }
  
  const newAddress = {
    label: 'Shared Location',
    fullAddress: address || 'Location shared via WhatsApp',
    location: {
      type: 'Point',
      coordinates: [longitude, latitude] // MongoDB uses [longitude, latitude] order
    }
  };
  
  this.addresses.push(newAddress);
  this.defaultAddressIndex = this.addresses.length - 1;
  return this;
};

// Add method to check if user has a valid location
userSchema.methods.hasValidLocation = function() {
  return this.addresses && 
         this.addresses.length > 0 && 
         this.addresses[this.defaultAddressIndex] &&
         this.addresses[this.defaultAddressIndex].location &&
         this.addresses[this.defaultAddressIndex].location.coordinates &&
         this.addresses[this.defaultAddressIndex].location.coordinates.length === 2;
};

module.exports = mongoose.model('User', userSchema);