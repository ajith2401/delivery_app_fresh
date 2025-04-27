// Updated DialogflowController.js
const { WebhookClient, Payload } = require('dialogflow-fulfillment');
const intentHandlers = require('../services/intentHandlers');

const DialogflowController = {
  handleWebhook: (req, res) => {
    try {
      console.log('Dialogflow Request headers: ' + JSON.stringify(req.headers));
      console.log('Dialogflow Request body: ' + JSON.stringify(req.body));
      
      // Create a standard WebhookClient - don't use the custom one yet
      const agent = new WebhookClient({ request: req, response: res });
      
      // Map intents to their handlers
      const intentMap = new Map();
      
      // Core intents
      intentMap.set('Welcome Intent', intentHandlers.welcome);
      intentMap.set('Language Selection', intentHandlers.setLanguage);
      intentMap.set('Location Sharing', intentHandlers.processLocation);
      
      // Browsing intents
      intentMap.set('Search Food', intentHandlers.searchFood);
      intentMap.set('Browse Nearby Vendors', intentHandlers.browseNearbyVendors);
      intentMap.set('Vendor Selection', intentHandlers.selectVendor);
      intentMap.set('Menu Browsing', intentHandlers.browseMenu);
      
      // Cart intents
      intentMap.set('Add To Cart', intentHandlers.addToCart);
      intentMap.set('View Cart', intentHandlers.viewCart);
      intentMap.set('Remove From Cart', intentHandlers.removeFromCart);
      intentMap.set('Clear Cart', intentHandlers.clearCart);
      
      // Checkout intents
      intentMap.set('Checkout', intentHandlers.checkout);
      intentMap.set('Confirm Address', intentHandlers.confirmAddress);
      intentMap.set('Payment Method Selection', intentHandlers.selectPaymentMethod);
      intentMap.set('Process Instructions', intentHandlers.processInstructions);
      
      // Order tracking intents
      intentMap.set('Order Status', intentHandlers.checkOrderStatus);
      intentMap.set('Order History', intentHandlers.viewOrderHistory);
      
      // Help and support intents
      intentMap.set('Help', intentHandlers.help);
      intentMap.set('Help Ordering', intentHandlers.helpOrdering);
      intentMap.set('Help Payment', intentHandlers.helpPayment);
      intentMap.set('Help Delivery', intentHandlers.helpDelivery);
      intentMap.set('Contact Support', intentHandlers.contactSupport);
      intentMap.set('Back To Menu', intentHandlers.backToMenu);
      
      // Button handling intents - these handle the button IDs sent from WhatsApp
      intentMap.set('payment_COD', intentHandlers.selectPaymentMethod);
      intentMap.set('payment_ONLINE', intentHandlers.selectPaymentMethod);
      intentMap.set('payment_UPI', intentHandlers.selectPaymentMethod);
      intentMap.set('confirm_address', intentHandlers.confirmAddress);
      intentMap.set('new_address', intentHandlers.requestNewAddress);
      intentMap.set('add_more', intentHandlers.addMore);
      intentMap.set('clear_cart', intentHandlers.clearCart);
      intentMap.set('checkout', intentHandlers.checkout);
      intentMap.set('view_cart', intentHandlers.viewCart);
      intentMap.set('nearby_vendors', intentHandlers.browseNearbyVendors);
      intentMap.set('search_food', intentHandlers.searchFood);
      intentMap.set('my_orders', intentHandlers.viewOrderHistory);
      intentMap.set('help_ordering', intentHandlers.helpOrdering);
      intentMap.set('help_payment', intentHandlers.helpPayment);
      intentMap.set('help_delivery', intentHandlers.helpDelivery);
      intentMap.set('contact_support', intentHandlers.contactSupport);
      intentMap.set('back_to_menu', intentHandlers.backToMenu);
      intentMap.set('english', intentHandlers.setLanguage);
      intentMap.set('tamil', intentHandlers.setLanguage);
      
      // Feedback intents
      intentMap.set('feedback_5', intentHandlers.handleFeedback);
      intentMap.set('feedback_4', intentHandlers.handleFeedback);
      intentMap.set('feedback_3', intentHandlers.handleFeedback);
      intentMap.set('feedback_2', intentHandlers.handleFeedback);
      intentMap.set('feedback_1', intentHandlers.handleFeedback);

      // Handle fallback
      intentMap.set('Default Fallback Intent', intentHandlers.fallback);

      // Monkey patch the add method to handle custom WhatsApp formats
      const originalAdd = agent.add.bind(agent);
      agent.add = function(response) {
        if (response && typeof response === 'object' && response.payload) {
          // This is a custom WhatsApp response format
          // Convert it to a Dialogflow Payload format
          const payload = new Payload('PLATFORM_UNSPECIFIED', response.payload, { sendAsMessage: true });
          return originalAdd(payload);
        }
        
        // Handle other response types
        return originalAdd(response);
      };

      // Process request
      agent.handleRequest(intentMap);
    } catch (error) {
      console.error('Error in DialogflowController.handleWebhook:', error);
      res.status(500).send({ error: 'Internal server error' });
    }
  }
};

module.exports = DialogflowController;