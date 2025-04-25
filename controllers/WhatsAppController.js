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
      console.log('====================================');
      console.log("Incoming message:", JSON.stringify(message, null, 2));
      console.log('====================================');

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
      console.log('====================================');
      console.log("message.type",message.type);
      console.log('====================================');
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
      } else if (message.type === 'interactive') {
        messageType = 'interactive';
        if (message.interactive.type === 'button_reply') {
          messageText = message.interactive.button_reply.id;
        } else if (message.interactive.type === 'list_reply') {
          messageText = message.interactive.list_reply.id;
        }
      } else {
        // For unsupported message types
        messageText = `[${message.type} message received]`;
      }
      console.log('====================================');
      console.log({messageText});
      console.log('====================================');
      // Process message through Dialogflow
      const dialogflowResponse = await DialogflowService.detectIntent(
        process.env.DIALOGFLOW_PROJECT_ID,
        phoneNumber,
        messageText,
        messageType,
        user.preferredLanguage
      );
      
      console.log('====================================');
      console.log("Dialogflow Response:", JSON.stringify(dialogflowResponse, null, 2));
      console.log('====================================');

      // Send response back to WhatsApp
      await WhatsAppController.sendWhatsAppMessage(phoneNumber, dialogflowResponse);
      
    } catch (error) {
      console.error('Error processing message:', error);
    }
  },
  
  // Send message to WhatsApp
// Add a new message type handler in sendWhatsAppMessage function
sendWhatsAppMessage: async (phoneNumber, dialogflowResponse) => {
  try {
    const url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    // Handle different message types from Dialogflow
    let messagePayload;
    console.log('====================================');
    console.log("dialogflowResponse.type",dialogflowResponse.type);
    console.log('====================================');
    if (dialogflowResponse.type === 'text') {
      // Simple text message
      messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual', 
        to: phoneNumber,
        type: 'text',
        text: { 
          preview_url: false,
          body: dialogflowResponse.text 
        }
      };
    } else if (dialogflowResponse.type === 'interactive_buttons') {
      // Interactive buttons message
      messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { 
            text: dialogflowResponse.text 
          },
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
      // Interactive list message
      messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: dialogflowResponse.header ? {
            type: 'text',
            text: dialogflowResponse.header
          } : undefined,
          body: { 
            text: dialogflowResponse.text 
          },
          footer: dialogflowResponse.footer ? {
            text: dialogflowResponse.footer
          } : undefined,
          action: {
            button: dialogflowResponse.button || "Select",
            sections: dialogflowResponse.sections || []
          }
        }
      };
    } else if (dialogflowResponse.type === 'location_request') {
      // Location request message
      messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'interactive',
        interactive: {
          type: 'location_request_message',
          body: { 
            text: dialogflowResponse.text 
          },
          action: {
            name: 'send_location'
          }
        }
      };
    } else {
      // Default to text if type is not recognized
      messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'text',
        text: { 
          preview_url: false,
          body: typeof dialogflowResponse.text === 'string' ? 
            dialogflowResponse.text : 'Sorry, I couldn\'t process that request.' 
        }
      };
    }
    
    console.log('====================================');
    console.log("Sending WhatsApp Payload:", JSON.stringify(messagePayload, null, 2));
    console.log('====================================');

    // Send message via WhatsApp Business API
    await axios.post(url, messagePayload, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    console.error('Error details:', error.response ? error.response.data : error.message);
    return false;
  }
}
};

module.exports = WhatsAppController;