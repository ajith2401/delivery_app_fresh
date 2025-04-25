// ==== FILE: controllers/PaymentController.js ====
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const User = require('../models/User');
const WhatsAppService = require('../services/WhatsAppService');
const dotenv = require('dotenv');
dotenv.config();
console.log('====================================');
console.log( process.env.RAZORPAY_KEY_ID);
console.log('====================================');

// Initialize Razorpay
const razorpay = new Razorpay({
key_id: process.env.RAZORPAY_KEY_ID,
key_secret: process.env.RAZORPAY_KEY_SECRET
});

const PaymentController = {
// Create payment order with Razorpay
createPayment: async (req, res) => {
try {
const { orderId } = req.body;
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  if (order.paymentStatus !== 'PENDING') {
    return res.status(400).json({ error: 'Payment already processed for this order' });
  }
  
  const user = await User.findById(order.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Create Razorpay order
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(order.grandTotal * 100), // Convert to paise
    currency: 'INR',
    receipt: `receipt_order_${order._id}`,
    notes: {
      orderId: order._id.toString(),
      customerPhone: user.phoneNumber
    }
  });
  
  // Generate payment link
  const paymentLink = await razorpay.paymentLink.create({
    amount: Math.round(order.grandTotal * 100),
    currency: 'INR',
    description: `Payment for Order #${order._id}`,
    customer: {
      name: user.name || 'Food Delivery Customer',
      contact: user.phoneNumber,
      email: user.email || ''
    },
    notify: {
      sms: true,
      email: false
    },
    reminder_enable: true,
    notes: {
      orderId: order._id.toString()
    },
    callback_url: `${process.env.APP_URL}/payment/callback?orderId=${order._id}`,
    callback_method: 'get'
  });
  
  // Save payment link to order
  order.paymentId = razorpayOrder.id;
  await order.save();
  
  // Send payment link to user via WhatsApp
  await WhatsAppService.sendPaymentLink(user.phoneNumber, order, paymentLink.short_url);
  
  return res.status(200).json({
    message: 'Payment link created successfully',
    paymentLink: paymentLink.short_url,
    razorpayOrderId: razorpayOrder.id
  });
} catch (error) {
  console.error('Error creating payment:', error);
  return res.status(500).json({ error: 'Failed to create payment' });
}
},
// Verify payment
verifyPayment: async (req, res) => {
try {
const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  // Verify signature
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');
  
  const isValid = expectedSignature === razorpay_signature;
  
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid payment signature' });
  }
  
  // Find the order associated with this payment
  const order = await Order.findOne({ paymentId: razorpay_order_id });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  // Update order payment status
  order.paymentStatus = 'PAID';
  await order.save();
  
  // Notify user about payment confirmation
  const user = await User.findById(order.userId);
  if (user) {
    await WhatsAppService.sendPaymentConfirmation(user.phoneNumber, order);
  }
  
  return res.status(200).json({
    message: 'Payment verified successfully',
    order
  });
} catch (error) {
  console.error('Error verifying payment:', error);
  return res.status(500).json({ error: 'Failed to verify payment' });
}
},
// Handle Razorpay webhook
handleWebhook: async (req, res) => {
try {
const signature = req.headers['x-razorpay-signature'];
  // Verify webhook signature
  const webhook_secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const shasum = crypto.createHmac('sha256', webhook_secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest('hex');
  
  if (digest !== signature) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }
  
  // Process the webhook event
  const event = req.body.event;
  
  if (event === 'payment.authorized' || event === 'payment.captured') {
    const paymentId = req.body.payload.payment.entity.id;
    const orderId = req.body.payload.payment.entity.notes.orderId;
    
    // Update order payment status
    const order = await Order.findById(orderId);
    if (order) {
      order.paymentStatus = 'PAID';
      await order.save();
      
      // Notify user about payment confirmation
      const user = await User.findById(order.userId);
      if (user) {
        await WhatsAppService.sendPaymentConfirmation(user.phoneNumber, order);
      }
    }
  }
  
  return res.status(200).json({ received: true });
} catch (error) {
  console.error('Error processing webhook:', error);
  return res.status(500).json({ error: 'Failed to process webhook' });
}
}
};
module.exports = PaymentController;