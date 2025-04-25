// ==== FILE: controllers/DialogflowController.js ====
const { WebhookClient } = require('dialogflow-fulfillment');
const intentHandlers = require('../services/intentHandlers');

const DialogflowController = {
  handleWebhook: (req, res) => {
    console.log('DialogflowController: Webhook received');
    
    // Log available intent handlers for debugging
    console.log('Available intent handlers:', Object.keys(intentHandlers));
    
    // Create a webhook client from the express request
    const agent = new WebhookClient({ request: req, response: res });
    
    // Map intents to their handlers
    const intentMap = new Map();
    intentMap.set('Welcome Intent', intentHandlers.welcome);
    intentMap.set('Language Selection', intentHandlers.setLanguage);
    intentMap.set('Location Sharing', intentHandlers.processLocation);
    intentMap.set('Search Food', intentHandlers.searchFood);
    intentMap.set('Browse Nearby Vendors', intentHandlers.browseNearbyVendors);
    intentMap.set('Vendor Selection', intentHandlers.selectVendor);
    intentMap.set('Menu Browsing', intentHandlers.browseMenu);
    intentMap.set('Add To Cart', intentHandlers.addToCart);
    intentMap.set('View Cart', intentHandlers.viewCart);
    intentMap.set('Checkout', intentHandlers.checkout);
    intentMap.set('Payment Method Selection', intentHandlers.selectPaymentMethod || function(agent) {
      agent.add('Payment method selection will be available soon.');
    });
    intentMap.set('Order Status', intentHandlers.checkOrderStatus || function(agent) {
      agent.add('Order status tracking will be available soon.');
    });
    intentMap.set('Order History', intentHandlers.viewOrderHistory || function(agent) {
      agent.add('Order history will be available soon.');
    });
    intentMap.set('Help', intentHandlers.help || function(agent) {
      agent.add('TamilFoods helps you order delicious home-cooked food. You can search for food, find nearby vendors, and place orders right from WhatsApp.');
    });
    
    try {
      // Process request with appropriate handler
      agent.handleRequest(intentMap);
    } catch (error) {
      console.error('Error handling webhook request:', error);
      res.status(500).json({
        fulfillmentText: 'Sorry, there was an error processing your request. Please try again.'
      });
    }
  }
};

module.exports = DialogflowController;