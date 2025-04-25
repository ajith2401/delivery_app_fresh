// ==== FILE: controllers/WhatsAppController.js ====
const axios = require('axios');
const User = require('../models/User');
const DialogflowService = require('../services/DialogflowService');
const WhatsAppController = {
// Verify webhook for WhatsApp Business API
verifyWebhook: (req, res) => {
const mode = req.query['hub.mode'];
const token = req.query['hub.verify_token'];
const challenge = req.query['hub.challenge'];
if (mode && token) {
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }
}
res.sendStatus(403);
},
// Handle incoming messages from WhatsApp
handleIncomingMessage: async (req, res) => {
try {
// Return 200 OK immediately to acknowledge receipt
res.status(200).send('OK');
  // Process message asynchronously
  if (req.body.object === 'whatsapp_business_account') {
    const entries = req.body.entry || [];
    
    for (const entry of entries) {
      const changes = entry.changes || [];
      
      for (const change of changes) {
        if (change.field === 'messages') {
          const value = change.value;
          if (!value.messages || !value.messages.length) continue;
          
          const message = value.messages[0];
          const phoneNumber = value.contacts[0].wa_id;
          
          // Process the message based on type
          await WhatsAppController.processMessage(phoneNumber, message);
        }
      }
    }
  }
} catch (error) {
  console.error('Error handling WhatsApp message:', error);
}
},
// Process different types of messages
processMessage: async (phoneNumber, message) => {
try {
// Find or create user
let user = await User.findOne({ phoneNumber });
if (!user) {
user = new User({ phoneNumber });
await user.save();
}
  // Update last interaction time
  user.lastInteractionAt = new Date();
  await user.save();
  
  let messageText = '';
  let messageType = 'text';
  
  // Extract message content based on type
  if (message.type === 'text') {
    messageText = message.text.body;
  } else if (message.type === 'location') {
    messageType = 'location';
    messageText = JSON.stringify({
      latitude: message.location.latitude,
      longitude: message.location.longitude
    });
    
    // Save location to user profile
    const newAddress = {
      label: 'Shared Location',
      fullAddress: 'Location shared via WhatsApp',
      location: {
        type: 'Point',
        coordinates: [message.location.longitude, message.location.latitude]
      }
    };
    
    user.addresses.push(newAddress);
    user.defaultAddressIndex = user.addresses.length - 1;
    await user.save();
  } else if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
    messageText = message.interactive.button_reply.id;
  } else if (message.type === 'interactive' && message.interactive.type === 'list_reply') {
    messageText = message.interactive.list_reply.id;
  } else {
    // For unsupported message types
    messageText = `[${message.type} message received]`;
  }
  
  // Process message through Dialogflow
  const dialogflowResponse = await DialogflowService.detectIntent(
    process.env.DIALOGFLOW_PROJECT_ID,
    phoneNumber,
    messageText,
    messageType,
    user.preferredLanguage
  );
  
  // Send response back to WhatsApp
  await WhatsAppController.sendWhatsAppMessage(phoneNumber, dialogflowResponse);
  
} catch (error) {
  console.error('Error processing message:', error);
}
},
// Send message to WhatsApp
sendWhatsAppMessage: async (phoneNumber, dialogflowResponse) => {
try {
const url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  // Handle different message types from Dialogflow
  let messagePayload;
  
  if (dialogflowResponse.type === 'text') {
    messagePayload = {
      type: 'text',
      text: { body: dialogflowResponse.text }
    };
  } else if (dialogflowResponse.type === 'interactive_buttons') {
    messagePayload = {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: dialogflowResponse.text },
        action: {
          buttons: dialogflowResponse.buttons.map((button, index) => ({
            type: 'reply',
            reply: {
              id: button.id || `btn_${index}`,
              title: button.text
            }
          }))
        }
      }
    };
  } else if (dialogflowResponse.type === 'interactive_list') {
    messagePayload = {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: dialogflowResponse.text },
        action: {
          button: dialogflowResponse.button || 'View Options',
          sections: [
            {
              title: dialogflowResponse.sectionTitle || 'Options',
              rows: dialogflowResponse.items.map((item, index) => ({
                id: item.id || `item_${index}`,
                title: item.title,
                description: item.description || ''
              }))
            }
          ]
        }
      }
    };
  } else if (dialogflowResponse.type === 'location') {
    messagePayload = {
      type: 'location',
      location: {
        longitude: dialogflowResponse.longitude,
        latitude: dialogflowResponse.latitude,
        name: dialogflowResponse.name || 'Location',
        address: dialogflowResponse.address || ''
      }
    };
  } else if (dialogflowResponse.type === 'image') {
    messagePayload = {
      type: 'image',
      image: {
        link: dialogflowResponse.url
      }
    };
  }
  
  // Send message via WhatsApp Business API
  await axios.post(url, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phoneNumber,
    ...messagePayload
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  
} catch (error) {
  console.error('Error sending WhatsApp message:', error);
}
}
};
module.exports = WhatsAppController;
