// ==== FILE: services/WhatsAppService.js ====
const axios = require('axios');
const WhatsAppService = {
// Send message to WhatsApp
sendMessage: async (phoneNumber, payload) => {
try {
const url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  await axios.post(url, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phoneNumber,
    ...payload
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  
  return true;
} catch (error) {
  console.error('Error sending WhatsApp message:', error);
  return false;
}
},
// Send text message
sendText: async (phoneNumber, text) => {
return WhatsAppService.sendMessage(phoneNumber, {
type: 'text',
text: { body: text }
});
},
// Send interactive buttons
sendButtons: async (phoneNumber, text, buttons) => {
return WhatsAppService.sendMessage(phoneNumber, {
type: 'interactive',
interactive: {
type: 'button',
body: { text },
action: {
buttons: buttons.map((button, index) => ({
type: 'reply',
reply: {
id: button.id || `btn_${index}`,
title: button.text
}
}))
}
}
});
},
// Send interactive list
sendList: async (phoneNumber, text, buttonText, sectionTitle, items) => {
return WhatsAppService.sendMessage(phoneNumber, {
type: 'interactive',
interactive: {
type: 'list',
body: { text },
action: {
button: buttonText,
sections: [
{
title: sectionTitle,
rows: items.map((item, index) => ({
id: item.id || `item_${index}`,
title: item.title,
description: item.description || ''
}))
}
]
}
}
});
},
// Send order confirmation
sendOrderConfirmation: async (phoneNumber, order) => {
// Generate order details text
let orderDetails = `🛒 *Order Confirmed!*\nOrder ID: ${order._id}\n\n*Items:*\n`;
order.items.forEach(item => {
  orderDetails += `• ${item.quantity}x ${item.name} - ₹${item.price * item.quantity}\n`;
});

orderDetails += `\nSubtotal: ₹${order.totalAmount}`;
orderDetails += `\nDelivery Fee: ₹${order.deliveryFee}`;
orderDetails += `\n*Total: ₹${order.grandTotal}*`;
orderDetails += `\n\nPayment Method: ${order.paymentMethod}`;
orderDetails += `\nDelivery Address: ${order.deliveryAddress.fullAddress}`;

if (order.paymentMethod === 'ONLINE' && order.paymentStatus === 'PENDING') {
  orderDetails += '\n\nPlease complete your payment to confirm this order.';
}

return WhatsAppService.sendText(phoneNumber, orderDetails);
},
// Send order status update
sendOrderStatusUpdate: async (phoneNumber, order) => {
let statusText = '';
const status = order.orderStatus;
switch (status) {
  case 'CONFIRMED':
    statusText = `🍽️ *Order Confirmed!*\nYour order #${order._id} has been confirmed by the restaurant. They'll start preparing your food soon!`;
    break;
  case 'PREPARING':
    statusText = `👨‍🍳 *Food Preparation Started*\nThe chef has started preparing your order #${order._id}. It won't be long!`;
    break;
  case 'OUT_FOR_DELIVERY':
    statusText = `🛵 *Out for Delivery*\nYour order #${order._id} is on its way! Should reach you in approximately ${order.estimatedDeliveryTime ? new Date(order.estimatedDeliveryTime).toTimeString().slice(0,5) : '30 minutes'}.`;
    break;
  case 'DELIVERED':
    statusText = `✅ *Order Delivered*\nYour order #${order._id} has been delivered. Enjoy your meal! Please rate your experience when you have time.`;
    break;
  case 'CANCELLED':
    statusText = `❌ *Order Cancelled*\nYour order #${order._id} has been cancelled. If you didn't request this cancellation, please contact our support.`;
    break;
  default:
    statusText = `📝 *Order Update*\nYour order #${order._id} status: ${status}`;
}

return WhatsAppService.sendText(phoneNumber, statusText);
},
// Send payment link
sendPaymentLink: async (phoneNumber, order, paymentLink) => {
const text = `💳 *Complete Your Payment*\nPlease use the link below to pay ₹${order.grandTotal} for your order #${order._id}:\n\n${paymentLink}\n\nYour order will be processed once payment is complete.`;
return WhatsAppService.sendText(phoneNumber, text);
},
// Send payment confirmation
sendPaymentConfirmation: async (phoneNumber, order) => {
const text =` ✅ *Payment Successful*\nWe've received your payment of ₹${order.grandTotal} for order #${order._id}. Your food will be prepared soon!`;
return WhatsAppService.sendText(phoneNumber, text);
}
};
module.exports = WhatsAppService;