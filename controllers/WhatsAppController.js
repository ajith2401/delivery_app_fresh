// ==== FILE: controllers/WhatsAppController.js ====
const User = require('../models/User');
const DialogflowService = require('../services/DialogflowService');
const WhatsAppMessageHelpers = require('../services/WhatsAppMessageHelpers');
const WhatsAppService = require('../services/WhatsAppService');
const ErrorHandler = require('../services/ErrorHandler');
const Vendor = require('../models/Vendor');


// Helper function to calculate distance between coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

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
      
        // Save location to user profile
        if (message.location.latitude && message.location.longitude) {
          try {
            // Create the address FIRST, then use it
            const newAddress = {
              label: 'Shared Location',
              fullAddress: message.location.address || 'Location shared via WhatsApp',
              location: {
                type: 'Point',
                coordinates: [message.location.longitude, message.location.latitude]
              }
            };
            
            // Now push it to addresses
            user.addresses.push(newAddress);
            user.defaultAddressIndex = user.addresses.length - 1;
            await user.save();
            
            // Fetch freshly updated user data for browsing
            const updatedUser = await User.findOne({ phoneNumber });
            console.log(`User address count after save: ${updatedUser.addresses.length}`);
            console.log(`Address data: ${JSON.stringify(updatedUser.addresses[updatedUser.defaultAddressIndex])}`);
            
            // Skip Dialogflow and go directly to vendor browsing
            await browseNearbyVendorsDirectly(phoneNumber, updatedUser);
            return; // Skip further processing
          } catch (error) {
            console.error(`Error saving location: ${error.message}`);
            // Fall through to normal Dialogflow handling
          }
        }
      }else if (message.type === 'interactive') {
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

async function browseNearbyVendorsDirectly(phoneNumber, user) {
  try {
    // Add detailed logging
    console.log('Starting browseNearbyVendorsDirectly function');
    console.log(`User has ${user.addresses.length} addresses`);
    
    if (!user.addresses || user.addresses.length === 0) {
      console.error('No addresses found for user');
      await WhatsAppService.sendText(phoneNumber, 'Please share your location first.');
      return;
    }
    
    const userAddress = user.addresses[user.defaultAddressIndex];
    console.log(`Using address: ${JSON.stringify(userAddress)}`);
    
    // Ensure we have coordinates in the right format
    if (!userAddress.location || !userAddress.location.coordinates || 
        !Array.isArray(userAddress.location.coordinates) || 
        userAddress.location.coordinates.length !== 2) {
      console.error('Invalid location coordinates:', userAddress.location);
      await WhatsAppService.sendText(phoneNumber, 'Location data is invalid. Please share your location again.');
      return;
    }
    
    // Log the exact query we're about to perform
    const query = {
      isActive: true,
      'address.location': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: userAddress.location.coordinates
          },
          $maxDistance: 5000 // 5km radius
        }
      }
    };
    console.log('Vendor query:', JSON.stringify(query));
    
    // Find nearby vendors
    const vendors = await Vendor.find(query).limit(10);
    console.log(`Found ${vendors.length} nearby vendors`);
    
    if (vendors.length === 0) {
      await WhatsAppService.sendText(
        phoneNumber,
        user.preferredLanguage === 'tamil' ? 
          'மன்னிக்கவும், அருகிலுள்ள உணவகங்கள் எதுவும் கிடைக்கவில்லை.' : 
          'Sorry, we couldn\'t find any home cooks near you.'
      );
      return;
    }
    
    // Format vendors list - FIXED: use userAddress instead of userLocation
    const vendorList = vendors.map(vendor => {
      const distance = calculateDistance(
        userAddress.location.coordinates[1],  // latitude is in position 1
        userAddress.location.coordinates[0],  // longitude is in position 0
        vendor.address.location.coordinates[1],
        vendor.address.location.coordinates[0]
      );
      
      return {
        id: vendor._id.toString(),
        title: `${vendor.businessName} (${(vendor.rating || 0).toFixed(1)}★)`,
        description: `${vendor.cuisineType.join(', ')} • ${distance.toFixed(1)}km away`
      };
    });
    
    const resultsText = user.preferredLanguage === 'tamil' ? 
      `உங்களுக்கு அருகில் ${vendors.length} உணவகங்கள் கண்டுபிடிக்கப்பட்டன. ஒன்றைத் தேர்ந்தெடுக்கவும்:` : 
      `We found ${vendors.length} home cooks near you. Select one to view their menu:`;
    
    await WhatsAppService.sendList(
      phoneNumber,
      resultsText,
      user.preferredLanguage === 'tamil' ? 'பார்க்க' : 'View',
      user.preferredLanguage === 'tamil' ? 'அருகிலுள்ள உணவகங்கள்' : 'Nearby Home Cooks',
      vendorList
    );
  } catch (error) {
    console.error('Error in browseNearbyVendorsDirectly:', error);
    console.error(error.stack);
    await WhatsAppService.sendText(phoneNumber, 'An error occurred finding nearby vendors. Please try again.');
  }
}

module.exports = WhatsAppController;