// ==== FILE: controllers/WhatsAppController.js ====
const User = require('../models/User');
const DialogflowService = require('../services/DialogflowService');
const WhatsAppMessageHelpers = require('../services/WhatsAppMessageHelpers');
const WhatsAppService = require('../services/WhatsAppService');
const ErrorHandler = require('../services/ErrorHandler');

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
      ErrorHandler.logError('handleIncomingMessage', error);
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
        console.log(`Created new user for phone number: ${phoneNumber}`);
      }
      
      // Update last interaction time
      user.lastInteractionAt = new Date();
      await user.save();
      
      let messageText = '';
      let messageType = 'text';
      
      // Extract message content based on type
      if (message.type === 'text') {
        messageText = message.text.body;
        console.log(`Received text message from ${phoneNumber}: "${messageText}"`);
      } else if (message.type === 'location') {
        messageType = 'location';
        messageText = JSON.stringify({
          latitude: message.location.latitude,
          longitude: message.location.longitude
        });
        
        console.log(`Received location from ${phoneNumber}: (${message.location.latitude}, ${message.location.longitude})`);
        
        // Save location to user profile if available
        if (message.location.latitude && message.location.longitude) {
          const newAddress = {
            label: 'Shared Location',
            fullAddress: message.location.address || 'Location shared via WhatsApp',
            location: {
              type: 'Point',
              coordinates: [message.location.longitude, message.location.latitude]
            }
          };
          
          user.addresses.push(newAddress);
          user.defaultAddressIndex = user.addresses.length - 1;
          await user.save();
          console.log(`Saved location to user profile: ${phoneNumber}`);
        }
      } else if (message.type === 'interactive') {
        if (message.interactive.type === 'button_reply') {
          // Extract button ID for processing
          messageType = 'button';
          messageText = message.interactive.button_reply.id;
          
          console.log(`User ${phoneNumber} clicked button: ${messageText} (${message.interactive.button_reply.title})`);
        } else if (message.interactive.type === 'list_reply') {
          // Extract list selection ID for processing
          messageType = 'list_selection';
          messageText = message.interactive.list_reply.id;
          
          console.log(`User ${phoneNumber} selected list item: ${messageText} (${message.interactive.list_reply.title})`);
        }
      } else {
        // For unsupported message types
        messageText = `[${message.type} message received]`;
        console.log(`Received unsupported message type: ${message.type} from ${phoneNumber}`);
      }
      
      // Process message through Dialogflow
      console.log(`Sending to Dialogflow: "${messageText}" (type: ${messageType})`);
      const dialogflowResponse = await DialogflowService.detectIntent(
        process.env.DIALOGFLOW_PROJECT_ID,
        phoneNumber,
        messageText,
        messageType,
        user.preferredLanguage || 'english'
      );
  
      // Log the response before sending
      console.log('dialogflowResponse====================================');
      console.dir(dialogflowResponse, {depth: null});
      console.log('====================================');
      
      // Send response back to WhatsApp
      await WhatsAppController.sendWhatsAppMessage(phoneNumber, dialogflowResponse);
    } catch (error) {
      ErrorHandler.logError('processMessage', error);
      
      // Try to notify user of error
      try {
        await WhatsAppService.sendText(
          phoneNumber, 
          "I'm sorry, I encountered an error processing your message. Please try again later."
        );
      } catch (sendError) {
        console.error('Failed to send error message:', sendError);
      }
    }
  },
  
  // Send message to WhatsApp
  sendWhatsAppMessage: async (phoneNumber, dialogflowResponse) => {
    try {
      if (!dialogflowResponse) {
        console.error(`No valid Dialogflow response for ${phoneNumber}`);
        return;
      }
      
      console.log(`Sending WhatsApp message to ${phoneNumber}, type: ${dialogflowResponse.type}`);
      
      // Use WhatsAppService instead of direct API calls
      let result;
      
      switch (dialogflowResponse.type) {
        case 'text':
          result = await WhatsAppService.sendText(
            phoneNumber, 
            dialogflowResponse.text,
            dialogflowResponse.previewUrl || false
          );
          break;
          
        case 'interactive_buttons':
          // Ensure buttons are properly formatted with length limits
          const buttons = dialogflowResponse.buttons.map(button => ({
            id: button.id,
            text: WhatsAppMessageHelpers.truncateText(button.text, 20) // Max 20 chars for button text
          })).slice(0, 3); // Max 3 buttons allowed
          
          result = await WhatsAppService.sendButtons(
            phoneNumber,
            WhatsAppMessageHelpers.truncateText(dialogflowResponse.text, 1024), // Max 1024 chars for body text
            buttons,
            dialogflowResponse.header || null,
            dialogflowResponse.footer || null
          );
          break;
          
        case 'interactive_list':
          // Ensure list items are properly formatted with length limits
          const items = dialogflowResponse.items.map(item => ({
            id: item.id,
            title: WhatsAppMessageHelpers.truncateText(item.title, 24), // Max 24 chars for row title
            description: item.description ? WhatsAppMessageHelpers.truncateText(item.description, 72) : "" // Max 72 chars for description
          })).slice(0, 10); // Max 10 items allowed
          
          result = await WhatsAppService.sendList(
            phoneNumber,
            WhatsAppMessageHelpers.truncateText(dialogflowResponse.text, 1024), // Max 1024 chars for body text
            WhatsAppMessageHelpers.truncateText(dialogflowResponse.button || 'View Options', 20), // Max 20 chars for button text
            WhatsAppMessageHelpers.truncateText(dialogflowResponse.sectionTitle || 'Options', 24), // Max 24 chars for section title
            items,
            dialogflowResponse.headerText ? WhatsAppMessageHelpers.truncateText(dialogflowResponse.headerText, 60) : null, // Max 60 chars for header
            dialogflowResponse.footerText ? WhatsAppMessageHelpers.truncateText(dialogflowResponse.footerText, 60) : null // Max 60 chars for footer
          );
          break;
          
        case 'location_request':
        case 'location_request_message':
          result = await WhatsAppService.sendLocationRequest(
            phoneNumber,
            WhatsAppMessageHelpers.truncateText(dialogflowResponse.text, 1024) // Max 1024 chars for body text
          );
          break;
          
        case 'image':
          result = await WhatsAppService.sendImage(
            phoneNumber,
            dialogflowResponse.url,
            dialogflowResponse.caption ? WhatsAppMessageHelpers.truncateText(dialogflowResponse.caption, 1024) : null // Max 1024 chars for caption
          );
          break;
          
        default:
          console.warn(`Unsupported response type: ${dialogflowResponse.type}`);
          // Fall back to simple text message
          result = await WhatsAppService.sendText(
            phoneNumber,
            "I'm not sure how to respond to that. Can you try again?"
          );
      }
      
      // Check result
      if (!result.success) {
        console.error(`Failed to send message to ${phoneNumber}: ${result.error.message}`);
      }
    } catch (error) {
      ErrorHandler.logError('sendWhatsAppMessage', error);
    }
  }
};

module.exports = WhatsAppController;