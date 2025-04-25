// ==== FILE: models/Order.js ====
const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
userId: {
type: mongoose.Schema.Types.ObjectId,
ref: 'User',
required: true
},
vendorId: {
type: mongoose.Schema.Types.ObjectId,
ref: 'Vendor',
required: true
},
items: [{
itemId: { type: mongoose.Schema.Types.ObjectId },
name: { type: String, required: true },
quantity: { type: Number, required: true },
price: { type: Number, required: true }
}],
totalAmount: {
type: Number,
required: true
},
deliveryFee: {
type: Number,
required: true
},
grandTotal: {
type: Number,
required: true
},
deliveryAddress: {
fullAddress: { type: String, required: true },
location: {
type: { type: String, default: 'Point' },
coordinates: [Number] // [longitude, latitude]
}
},
paymentMethod: {
type: String,
enum: ['COD', 'ONLINE', 'UPI'],
required: true
},
paymentStatus: {
type: String,
enum: ['PENDING', 'PAID', 'FAILED'],
default: 'PENDING'
},
paymentId: {
type: String
},
orderStatus: {
type: String,
enum: ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
default: 'PLACED'
},
estimatedDeliveryTime: {
type: Date
},
specialInstructions: {
type: String
},
statusHistory: [{
status: {
type: String,
enum: ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']
},
timestamp: {
type: Date,
default: Date.now
}
}]
}, { timestamps: true });
// Add order status update method
orderSchema.methods.updateStatus = function(newStatus) {
this.orderStatus = newStatus;
this.statusHistory.push({
status: newStatus,
timestamp: new Date()
});
// If order is confirmed, set estimated delivery time
if (newStatus === 'CONFIRMED') {
const deliveryMinutes = 45; // Default value, can be customized
this.estimatedDeliveryTime = new Date(Date.now() + deliveryMinutes * 60000);
}
return this.save();
};
module.exports = mongoose.model('Order', orderSchema);