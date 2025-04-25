// ==== FILE: models/Vendor.js ====
const mongoose = require('mongoose');
const menuItemSchema = new mongoose.Schema({
name: { type: String, required: true },
description: { type: String },
price: { type: Number, required: true },
category: { type: String, required: true },
isAvailable: { type: Boolean, default: true },
preparationTime: { type: Number, default: 30 } // in minutes
});
const vendorSchema = new mongoose.Schema({
businessName: { type: String, required: true },
ownerName: { type: String, required: true },
phoneNumber: { type: String, required: true, unique: true },
email: { type: String },
address: {
fullAddress: { type: String, required: true },
location: {
type: { type: String, default: 'Point' },
coordinates: [Number] // [longitude, latitude]
}
},
cuisineType: [{ type: String }],
menuItems: [menuItemSchema],
operatingHours: {
monday: { open: String, close: String },
tuesday: { open: String, close: String },
wednesday: { open: String, close: String },
thursday: { open: String, close: String },
friday: { open: String, close: String },
saturday: { open: String, close: String },
sunday: { open: String, close: String }
},
rating: { type: Number, default: 0 },
reviewCount: { type: Number, default: 0 },
isActive: { type: Boolean, default: true },
servicingRadius: { type: Number, default: 5 }, // in kilometers
avgDeliveryTime: { type: Number, default: 45 }, // in minutes
minOrderAmount: { type: Number, default: 100 }, // in rupees
deliveryFee: { type: Number, default: 30 }, // in rupees
}, { timestamps: true });
// Index for geospatial queries
vendorSchema.index({ 'address.location': '2dsphere' });
// Method to check if vendor is currently open
vendorSchema.methods.isCurrentlyOpen = function() {
const now = new Date();
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const day = days[now.getDay()];
const hours = this.operatingHours[day];
if (!hours.open || !hours.close) return false;
const currentTime = now.getHours() * 100 + now.getMinutes();
const openTime = parseInt(hours.open.replace(':', ''));
const closeTime = parseInt(hours.close.replace(':', ''));
return currentTime >= openTime && currentTime <= closeTime;
};
module.exports = mongoose.model('Vendor', vendorSchema);