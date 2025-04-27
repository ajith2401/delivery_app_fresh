// ==== FILE: services/WhatsAppService.js ====
const axios = require('axios');
const WhatsAppMessageHelpers = require('./WhatsAppMessageHelpers');
const ErrorHandler = require('./ErrorHandler');

// Use this API version instead of v16.0 which is deprecated
const API_VERSION = 'v22.0';

const WhatsAppService = {
  // Send message to WhatsApp
  sendMessage: async (phoneNumber, payload) => {
    try {
      const url = `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      
      console.log(`Sending WhatsApp message to ${phoneNumber}, type: ${payload.type}`);
      if (process.env.DEBUG === 'true') {
        console.log('Payload:', JSON.stringify(payload, null, 2));
      }
      
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Message sent successfully to ${phoneNumber}`);
      if (process.env.DEBUG === 'true') {
        console.log('Response:', JSON.stringify(response.data, null, 2));
      }
      
      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        response: response.data
      };
    } catch (error) {
      const errorInfo = ErrorHandler.handleWhatsAppError(error, () => {
        // Retry function - only for certain errors
        return WhatsAppService.sendMessage(phoneNumber, payload);
      });
      
      console.error(`Failed to send WhatsApp message to ${phoneNumber}: ${errorInfo.message}`);
      
      return {
        success: false,
        error: errorInfo,
        messageId: null
      };
    }
  },
  
  // Send text message
  sendText: async (phoneNumber, text, previewUrl = false) => {
    const payload = WhatsAppMessageHelpers.generateTextMessagePayload(
      phoneNumber, 
      text, 
      previewUrl
    );
    
    return WhatsAppService.sendMessage(phoneNumber, payload);
  },
  
  // Send interactive buttons
  sendButtons: async (phoneNumber, text, buttons, header = null, footer = null) => {
    // Process buttons to ensure they meet WhatsApp API requirements
    const processedButtons = buttons.map(button => ({
      id: button.id,
      text: WhatsAppMessageHelpers.truncateText(button.text, 20) // WhatsApp limits button text to 20 chars
    })).slice(0, 3); // WhatsApp allows maximum 3 buttons
    
    const payload = WhatsAppMessageHelpers.generateButtonsMessagePayload(
      phoneNumber,
      text,
      processedButtons,
      header,
      footer
    );
    
    return WhatsAppService.sendMessage(phoneNumber, payload);
  },
  
  // Send interactive list
  sendList: async (phoneNumber, text, buttonText, sectionTitle, items, headerText = null, footerText = null) => {
    // Process items to ensure they meet WhatsApp API requirements
    const processedItems = items.map(item => ({
      id: item.id,
      title: WhatsAppMessageHelpers.truncateText(item.title, 24), // WhatsApp limits row title to 24 chars
      description: item.description ? WhatsAppMessageHelpers.truncateText(item.description, 72) : "" // WhatsApp limits row description to 72 chars
    })).slice(0, 10); // WhatsApp allows maximum 10 items in a list
    
    const payload = WhatsAppMessageHelpers.generateListMessagePayload(
      phoneNumber,
      text,
      buttonText,
      sectionTitle,
      processedItems,
      headerText,
      footerText
    );
    
    return WhatsAppService.sendMessage(phoneNumber, payload);
  },
  
  // Send location request
  sendLocationRequest: async (phoneNumber, text) => {
    const payload = WhatsAppMessageHelpers.generateLocationRequestPayload(phoneNumber, text);
    return WhatsAppService.sendMessage(phoneNumber, payload);
  },
  
  // Send image message
  sendImage: async (phoneNumber, imageUrl, caption = null) => {
    const payload = WhatsAppMessageHelpers.generateImageMessagePayload(phoneNumber, imageUrl, caption);
    return WhatsAppService.sendMessage(phoneNumber, payload);
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
    return WhatsAppService.sendText(phoneNumber, text, true); // Enable link preview
  },
  
  // Send payment confirmation
  sendPaymentConfirmation: async (phoneNumber, order) => {
    const text = `✅ *Payment Successful*\nWe've received your payment of ₹${order.grandTotal} for order #${order._id}. Your food will be prepared soon!`;
    return WhatsAppService.sendText(phoneNumber, text);
  },
  
  // Send feedback request
  sendFeedbackRequest: async (phoneNumber, order) => {
    const text = `How was your experience with your order from ${order.vendorName || 'our restaurant'}? Your feedback helps us improve!`;
    const buttons = [
      { id: 'feedback_5', text: '⭐⭐⭐⭐⭐' },
      { id: 'feedback_4', text: '⭐⭐⭐⭐' },
      { id: 'feedback_3', text: '⭐⭐⭐' }
    ];
    
    return WhatsAppService.sendButtons(phoneNumber, text, buttons);
  }
};

module.exports = WhatsAppService;