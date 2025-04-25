// ==== FILE: controllers/DialogflowController.js ====
const { WebhookClient } = require('dialogflow-fulfillment');
const intentHandlers = require('../services/intentHandlers');
const DialogflowController = {
handleWebhook: (req, res) => {
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
intentMap.set('Payment Method Selection', intentHandlers.selectPaymentMethod);
intentMap.set('Order Status', intentHandlers.checkOrderStatus);
intentMap.set('Order History', intentHandlers.viewOrderHistory);
intentMap.set('Help', intentHandlers.help);

// Process request
agent.handleRequest(intentMap);
}
};
module.exports = DialogflowController;