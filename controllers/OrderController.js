// ==== FILE: controllers/OrderController.js ====
const Order = require('../models/Order');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const mongoose = require('mongoose');
const WhatsAppService = require('../services/WhatsAppService');
const OrderController = {
// Create new order
createOrder: async (req, res) => {
try {
const { userId, vendorId, items, deliveryAddressIndex, paymentMethod, specialInstructions } = req.body;
  // Validate inputs
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(vendorId)) {
    return res.status(400).json({ error: 'Invalid user or vendor ID' });
  }
  
  // Get user and vendor
  const user = await User.findById(userId);
  const vendor = await Vendor.findById(vendorId);
  
  if (!user || !vendor) {
    return res.status(404).json({ error: 'User or vendor not found' });
  }
  
  // Validate delivery address
  if (user.addresses.length === 0) {
    return res.status(400).json({ error: 'User has no saved addresses' });
  }
  
  const addressIndex = deliveryAddressIndex || user.defaultAddressIndex;
  if (addressIndex >= user.addresses.length) {
    return res.status(400).json({ error: 'Invalid address index' });
  }
  
  const deliveryAddress = user.addresses[addressIndex];
  
  // Calculate order totals
  let totalAmount = 0;
  const validatedItems = [];
  
  for (const item of items) {
    const menuItem = vendor.menuItems.find(mi => mi._id.toString() === item.itemId.toString());
    
    if (!menuItem) {
      return res.status(400).json({ error: `Menu item ${item.itemId} not found` });
    }
    
    if (!menuItem.isAvailable) {
      return res.status(400).json({ error: `Menu item ${menuItem.name} is not available` });
    }
    
    const itemTotal = menuItem.price * item.quantity;
    totalAmount += itemTotal;
    
    validatedItems.push({
      itemId: menuItem._id,
      name: menuItem.name,
      quantity: item.quantity,
      price: menuItem.price
    });
  }
  
  // Check minimum order amount
  if (totalAmount < vendor.minOrderAmount) {
    return res.status(400).json({ 
      error: `Order does not meet minimum amount of ₹${vendor.minOrderAmount}` 
    });
  }
  
  // Add delivery fee
  const deliveryFee = vendor.deliveryFee;
  const grandTotal = totalAmount + deliveryFee;
  
  // Create order
  const order = new Order({
    userId: user._id,
    vendorId: vendor._id,
    items: validatedItems,
    totalAmount,
    deliveryFee,
    grandTotal,
    deliveryAddress: {
      fullAddress: deliveryAddress.fullAddress,
      location: deliveryAddress.location
    },
    paymentMethod,
    specialInstructions,
    statusHistory: [{ 
  status: 'PLACED', 
  timestamp: new Date() 
}]
});
// Save order
await order.save();
// Clear user's cart
user.cart = { items: [], total: 0 };
await user.save();
// Send order confirmation to user via WhatsApp
await WhatsAppService.sendOrderConfirmation(user.phoneNumber, order);
return res.status(201).json({
message: 'Order created successfully',
orderId: order._id,
order
});
} catch (error) {
console.error('Error creating order:', error);
return res.status(500).json({ error: 'Failed to create order' });
}
},
// Get order details
getOrderDetails: async (req, res) => {
try {
const { orderId } = req.params;
if (!mongoose.Types.ObjectId.isValid(orderId)) {
  return res.status(400).json({ error: 'Invalid order ID' });
}

const order = await Order.findById(orderId)
  .populate('userId', 'name phoneNumber')
  .populate('vendorId', 'businessName phoneNumber');

if (!order) {
  return res.status(404).json({ error: 'Order not found' });
}

return res.status(200).json({ order });
} catch (error) {
console.error('Error fetching order:', error);
return res.status(500).json({ error: 'Failed to fetch order details' });
}
},
// Update order status (vendor endpoint)
updateOrderStatus: async (req, res) => {
try {
const { orderId } = req.params;
const { status } = req.body;
if (!mongoose.Types.ObjectId.isValid(orderId)) {
  return res.status(400).json({ error: 'Invalid order ID' });
}

const validStatuses = ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
if (!validStatuses.includes(status)) {
  return res.status(400).json({ error: 'Invalid order status' });
}

const order = await Order.findById(orderId);

if (!order) {
  return res.status(404).json({ error: 'Order not found' });
}

// Update order status
await order.updateStatus(status);

// If order is confirmed and payment is pending, update payment status for COD orders
if (status === 'CONFIRMED' && order.paymentMethod === 'COD' && order.paymentStatus === 'PENDING') {
  order.paymentStatus = 'PAID';
  await order.save();
}

// Notify user about status change
const user = await User.findById(order.userId);
if (user) {
  await WhatsAppService.sendOrderStatusUpdate(user.phoneNumber, order);
}

return res.status(200).json({
  message: 'Order status updated successfully',
  order
});
} catch (error) {
console.error('Error updating order status:', error);
return res.status(500).json({ error: 'Failed to update order status' });
}
},
// Get user order history
getUserOrders: async (req, res) => {
try {
const { userId } = req.params;
const { status, limit = 10 } = req.query;
if (!mongoose.Types.ObjectId.isValid(userId)) {
  return res.status(400).json({ error: 'Invalid user ID' });
}

const query = { userId: mongoose.Types.ObjectId(userId) };

// Add status filter if provided
if (status) {
  query.orderStatus = status;
}

const orders = await Order.find(query)
  .populate('vendorId', 'businessName')
  .sort({ createdAt: -1 })
  .limit(parseInt(limit));

return res.status(200).json({ orders });
} catch (error) {
console.error('Error fetching user orders:', error);
return res.status(500).json({ error: 'Failed to fetch user orders' });
}
}
};
module.exports = OrderController;