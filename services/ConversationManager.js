// // services/ConversationManager.js
// const User = require('../models/User');
// const Vendor = require('../models/Vendor');
// const Order = require('../models/Order');

// class ConversationManager {
//   // Comprehensive state definitions
//   static STATES = {
//     // Initial Flow
//     WELCOME: 'welcome',
//     LANGUAGE_SELECTION: 'language_selection',
//     LOCATION_SHARING: 'location_sharing',
//     MAIN_MENU: 'main_menu',

//     // Browsing and Selection
//     VENDOR_BROWSING: 'vendor_browsing',
//     VENDOR_SELECTION: 'vendor_selection',
//     MENU_BROWSING: 'menu_browsing',
//     ITEM_SELECTION: 'item_selection',

//     // Cart Management
//     CART_MANAGEMENT: 'cart_management',
//     VIEW_CART: 'view_cart',

//     // Checkout Process
//     CHECKOUT: 'checkout',
//     ADDRESS_CONFIRMATION: 'address_confirmation',
//     PAYMENT_SELECTION: 'payment_selection',
//     SPECIAL_INSTRUCTIONS: 'special_instructions',

//     // Order Related
//     ORDER_STATUS: 'order_status',
//     ORDER_HISTORY: 'order_history',

//     // Help and Support
//     HELP: 'help',
//     HELP_ORDERING: 'help_ordering',
//     HELP_PAYMENT: 'help_payment',
//     HELP_DELIVERY: 'help_delivery',
//     CONTACT_SUPPORT: 'contact_support',

//     // Feedback
//     FEEDBACK: 'feedback',

//     // Fallback
//     UNKNOWN: 'unknown'
//   };

//   // Main message processing method
//   async processMessage(user, message) {
//     console.log('Processing message:', JSON.stringify({
//       phoneNumber: user.phoneNumber,
//       currentState: user.conversationState.context,
//       messageType: message.type,
//       messageText: message.text
//     }, null, 2));

//     try {
//       // Get the appropriate handler based on current state
//       const handler = this.getStateHandler(user.conversationState.context);
      
//       // Process message using the current state's handler
//       const response = await handler(user, message);
      
//       // Update user's last interaction
//       user.lastInteractionAt = new Date();
//       await user.save();
      
//       return response;
//     } catch (error) {
//       console.error('Error processing message:', error);
//       return this.handleError(user, error);
//     }
//   }

//   // State transition method with improved error handling
//   async transitionTo(user, newState, stateData = {}) {
//     try {
//       // Validate the new state
//       if (!Object.values(ConversationManager.STATES).includes(newState)) {
//         throw new Error(`Invalid state: ${newState}`);
//       }

//       // Update conversation state
//       user.conversationState.context = newState;
      
//       // Merge existing data with new data, ensuring no special keys
//       const cleanedData = {};
//       Object.keys(stateData).forEach(key => {
//         if (!key.startsWith('$')) {
//           cleanedData[key] = stateData[key];
//         }
//       });

//       // Update data, preserving existing data
//       user.conversationState.data = {
//         ...user.conversationState.data,
//         ...cleanedData
//       };

//       // Save the user
//       await user.save();
      
//       return newState;
//     } catch (error) {
//       console.error('Error in transitionTo:', error);
//       // Fallback to welcome state if transition fails
//       user.conversationState.context = ConversationManager.STATES.WELCOME;
//       user.conversationState.data = {};
//       await user.save();
//       return ConversationManager.STATES.WELCOME;
//     }
//   }

//   // Get handler for a specific state
//   getStateHandler(state) {
//     const handlers = {
//       [ConversationManager.STATES.WELCOME]: this.handleWelcome.bind(this),
//       [ConversationManager.STATES.LANGUAGE_SELECTION]: this.handleLanguageSelection.bind(this),
//       [ConversationManager.STATES.LOCATION_SHARING]: this.handleLocationSharing.bind(this),
//       [ConversationManager.STATES.MAIN_MENU]: this.handleMainMenu.bind(this),
//       // Add other state handlers here
//     };

//     return handlers[state] || this.handleUnknownState.bind(this);
//   }

//   // Welcome handler for new and existing users
//   async handleWelcome(user, message) {
//     // First-time user: No language set
//     if (!user.preferredLanguage) {
//       await this.transitionTo(user, ConversationManager.STATES.LANGUAGE_SELECTION);
      
//       return {
//         type: 'interactive_buttons',
//         text: 'வணக்கம்! Welcome to TamilFoods! 🍲\nI can help you order delicious home-cooked food from nearby cooks.\n\nPlease select your preferred language:',
//         buttons: [
//           { id: 'english', text: 'English' },
//           { id: 'tamil', text: 'தமிழ் (Tamil)' }
//         ]
//       };
//     }

//     // No location set
//     if (!user.addresses || user.addresses.length === 0) {
//       await this.transitionTo(user, ConversationManager.STATES.LOCATION_SHARING);
      
//       const locationText = user.preferredLanguage === 'tamil' 
//         ? 'நாங்கள் உங்கள் இருப்பிடத்தைப் பெற்றால், அருகிலுள்ள உணவகங்களைக் காண்பிக்க முடியும்.' 
//         : 'We can show you nearby home cooks if we have your location.';
      
//       return {
//         type: 'location_request',
//         text: locationText,
//         action: 'send_location'
//       };
//     }

//     // Existing user: Go to main menu
//     await this.transitionTo(user, ConversationManager.STATES.MAIN_MENU);
//     return this.getMainMenuResponse(user);
//   }

//   // Language selection handler
//   async handleLanguageSelection(user, message) {
//     const selectedLanguage = message.text.toLowerCase();
    
//     if (selectedLanguage === 'english' || selectedLanguage === 'tamil') {
//       user.preferredLanguage = selectedLanguage;
//       await user.save();
      
//       const confirmText = selectedLanguage === 'tamil' 
//         ? 'தமிழ் மொழி தேர்ந்தெடுக்கப்பட்டது. 🎉' 
//         : 'English language selected. 🎉';
      
//       const locationText = selectedLanguage === 'tamil' 
//         ? 'நாங்கள் உங்கள் இருப்பிடத்தைப் பெற்றால், அருகிலுள்ள உணவகங்களைக் காண்பிக்க முடியும்.' 
//         : 'We can show you nearby home cooks if we have your location.';
      
//       await this.transitionTo(user, ConversationManager.STATES.LOCATION_SHARING);
      
//       return {
//         type: 'location_request',
//         text: `${confirmText}\n\n${locationText}`,
//         action: 'send_location'
//       };
//     }
    
//     // If invalid selection, stay in the same state
//     return {
//       type: 'interactive_buttons',
//       text: 'Please select a valid language:',
//       buttons: [
//         { id: 'english', text: 'English' },
//         { id: 'tamil', text: 'தமிழ் (Tamil)' }
//       ]
//     };
//   }

//   // Location sharing handler
//   async handleLocationSharing(user, message) {
//     if (message.type === 'location') {
//       // Save location to user profile
//       const newAddress = {
//         label: 'Shared Location',
//         fullAddress: message.data.address || 'Location shared via WhatsApp',
//         location: {
//           type: 'Point',
//           coordinates: [message.data.longitude, message.data.latitude]
//         }
//       };
      
//       user.addresses.push(newAddress);
//       user.defaultAddressIndex = user.addresses.length - 1;
//       await user.save();
      
//       // Transition to main menu
//       await this.transitionTo(user, ConversationManager.STATES.MAIN_MENU);
      
//       return this.getMainMenuResponse(user);
//     }
    
//     // If not location message, ask again
//     return {
//       type: 'location_request',
//       text: 'Please share your location to continue:',
//       action: 'send_location'
//     };
//   }

//   // Main menu handler
//   async handleMainMenu(user, message) {
//     const option = message.text.toLowerCase();
    
//     switch (option) {
//       case 'nearby_vendors':
//       case 'அருகிலுள்ள உணவகங்கள்':
//         return this.showNearbyVendors(user);
      
//       case 'search_food':
//       case 'உணவைத் தேடு':
//         return this.initiateSearchFood(user);
      
//       case 'my_orders':
//       case 'எனது ஆர்டர்கள்':
//         return this.showOrderHistory(user);
      
//       case 'help':
//       case 'உதவி':
//         return this.handleHelp(user);
      
//       default:
//         return this.getMainMenuResponse(user, 'Invalid option selected.');
//     }
//   }

//   // Error handler
//   async handleError(user, error) {
//     console.error('Conversation Error:', error);
    
//     // Transition back to welcome state
//     await this.transitionTo(user, ConversationManager.STATES.WELCOME);
    
//     const errorText = user.preferredLanguage === 'tamil'
//       ? 'மன்னிக்கவும், ஒரு பிழை ஏற்பட்டது. தயவு செய்து மீண்டும் முயற்சிக்கவும்.'
//       : 'Sorry, an error occurred. Please try again.';
    
//     return {
//       type: 'text',
//       text: errorText
//     };
//   }

//   // Unknown state handler
//   async handleUnknownState(user, message) {
//     // Reset to welcome state if current state is unknown
//     await this.transitionTo(user, ConversationManager.STATES.WELCOME);
//     return this.handleWelcome(user, message);
//   }

//   // Placeholder methods for other states (to be implemented)
//   async showNearbyVendors(user) {
//     await this.transitionTo(user, ConversationManager.STATES.VENDOR_BROWSING);
    
//     // Find nearby vendors
//     const userLocation = user.addresses[user.defaultAddressIndex].location;
    
//     const vendors = await Vendor.find({
//       isActive: true,
//       'address.location': {
//         $near: {
//           $geometry: {
//             type: 'Point',
//             coordinates: userLocation.coordinates
//           },
//           $maxDistance: 5000 // 5km radius
//         }
//       }
//     }).limit(10);
    
//     if (vendors.length === 0) {
//       const noVendorsText = user.preferredLanguage === 'tamil'
//         ? 'மன்னிக்கவும், அருகிலுள்ள உணவகங்கள் எதுவும் கிடைக்கவில்லை.'
//         : 'Sorry, no home cooks found nearby.';
      
//       return {
//         type: 'text',
//         text: noVendorsText
//       };
//     }
    
//     // Format vendors list
//     const vendorList = vendors.map(vendor => ({
//       id: vendor._id.toString(),
//       title: `${vendor.businessName} (${(vendor.rating || 0).toFixed(1)}★)`,
//       description: `${vendor.cuisineType.join(', ')} • ${vendor.isCurrentlyOpen() ? 'Open' : 'Closed'}`
//     }));
    
//     const listText = user.preferredLanguage === 'tamil'
//       ? 'அருகிலுள்ள உணவகங்கள்'
//       : 'Nearby Home Cooks';
    
//     return {
//       type: 'interactive_list',
//       text: listText,
//       button: user.preferredLanguage === 'tamil' ? 'தேர்வு' : 'Select',
//       sectionTitle: listText,
//       items: vendorList
//     };
//   }

//   // Vendor Selection Handler
//   async handleVendorSelection(user, message) {
//     const vendorId = message.text;
    
//     try {
//       const vendor = await Vendor.findById(vendorId);
      
//       if (!vendor) {
//         return {
//           type: 'text',
//           text: user.preferredLanguage === 'tamil'
//             ? 'மன்னிக்கவும், இந்த உணவகம் கிடைக்கவில்லை.'
//             : 'Sorry, this home cook is not available.'
//         };
//       }
      
//       // Check if vendor is open
//       if (!vendor.isCurrentlyOpen()) {
//         return {
//           type: 'text',
//           text: user.preferredLanguage === 'tamil'
//             ? 'மன்னிக்கவும், இந்த உணவகம் தற்போது மூடப்பட்டுள்ளது.'
//             : 'Sorry, this home cook is currently closed.'
//         };
//       }
      
//       // Transition to menu browsing and store vendor in state
//       await this.transitionTo(user, ConversationManager.STATES.MENU_BROWSING, {
//         selectedVendorId: vendorId
//       });
      
//       // Organize menu by categories
//       const menuCategories = {};
//       vendor.menuItems.forEach(item => {
//         if (item.isAvailable) {
//           if (!menuCategories[item.category]) {
//             menuCategories[item.category] = [];
//           }
//           menuCategories[item.category].push(item);
//         }
//       });
      
//       // Create menu categories list
//       const categoriesList = Object.keys(menuCategories).map(category => ({
//         id: `category:${category}`,
//         title: category,
//         description: `${menuCategories[category].length} items`
//       }));
      
//       const menuText = user.preferredLanguage === 'tamil'
//         ? `*${vendor.businessName}*\nவகைகளிலிருந்து தேர்ந்தெடுக்கவும்:'
//         : `*${vendor.businessName}*\nSelect from the following categories:`;
      
//       return {
//         type: 'interactive_list',
//         text: menuText,
//         button: user.preferredLanguage === 'tamil' ? 'தேர்வு' : 'Select',
//         sectionTitle: user.preferredLanguage === 'tamil' ? 'உணவு வகைகள்' : 'Food Categories',
//         items: categoriesList
//       };
//     } catch (error) {
//       console.error('Error in vendor selection:', error);
//       return this.handleError(user, error);
//     }
//   }

//   // Menu Browsing Handler
//   async handleMenuBrowsing(user, message) {
//     // Extract category from message
//     const categoryInput = message.text;
//     const category = categoryInput.startsWith('category:') 
//       ? categoryInput.substring(9) 
//       : categoryInput;
    
//     try {
//       // Retrieve vendor from conversation state
//       const vendorId = user.conversationState.data.selectedVendorId;
      
//       if (!vendorId) {
//         return {
//           type: 'text',
//           text: user.preferredLanguage === 'tamil'
//             ? 'தயவு செய்து முதலில் ஒரு உணவகத்தைத் தேர்ந்தெடுக்கவும்.'
//             : 'Please select a home cook first.'
//         };
//       }
      
//       const vendor = await Vendor.findById(vendorId);
      
//       if (!vendor) {
//         return {
//           type: 'text',
//           text: user.preferredLanguage === 'tamil'
//             ? 'மன்னிக்கவும், உணவகம் கிடைக்கவில்லை.'
//             : 'Sorry, home cook not found.'
//         };
//       }
      
//       // Get items in the selected category
//       const menuItems = vendor.menuItems.filter(item => 
//         item.category === category && item.isAvailable
//       );
      
//       if (menuItems.length === 0) {
//         return {
//           type: 'text',
//           text: user.preferredLanguage === 'tamil'
//             ? `${category} வகையில் உணவு பொருட்கள் இல்லை.`
//             : `No items available in ${category} category.`
//         };
//       }
      
//       // Transition to item selection state
//       await this.transitionTo(user, ConversationManager.STATES.ITEM_SELECTION, {
//         selectedCategory: category
//       });
      
//       // Create menu items list
//       const itemsList = menuItems.map(item => ({
//         id: `item:${item._id}`,
//         title: `${item.name} - ₹${item.price}`,
//         description: item.description || ''
//       }));
      
//       const menuText = user.preferredLanguage === 'tamil'
//         ? `*${category}* வகையில் கிடைக்கும் உணவுகள்:`
//         : `Available items in *${category}*:`;
      
//       return {
//         type: 'interactive_list',
//         text: menuText,
//         button: user.preferredLanguage === 'tamil' ? 'தேர்ந்தெடு' : 'Select',
//         sectionTitle: user.preferredLanguage === 'tamil' ? 'உணவு பொருட்கள்' : 'Menu Items',
//         items: itemsList
//       };
//     } catch (error) {
//       console.error('Error in menu browsing:', error);
//       return this.handleError(user, error);
//     }
//   }

//   // Item Selection Handler
//   async handleItemSelection(user, message) {
//     // Extract item ID from message
//     const itemInput = message.text;
//     const itemId = itemInput.startsWith('item:') 
//       ? itemInput.substring(5) 
//       : itemInput;
    
//     try {
//       // Retrieve vendor from conversation state
//       const vendorId = user.conversationState.data.selectedVendorId;
      
//       if (!vendorId) {
//         return {
//           type: 'text',
//           text: user.preferredLanguage === 'tamil'
//             ? 'தயவு செய்து முதலில் ஒரு உணவகத்தைத் தேர்ந்தெடுக்கவும்.'
//             : 'Please select a home cook first.'
//         };
//       }
      
//       const vendor = await Vendor.findById(vendorId);
      
//       if (!vendor) {
//         return {
//           type: 'text',
//           text: user.preferredLanguage === 'tamil'
//             ? 'மன்னிக்கவும், உணவகம் கிடைக்கவில்லை.'
//             : 'Sorry, home cook not found.'
//         };
//       }
      
//       // Find the selected item
//       const selectedItem = vendor.menuItems.find(item => 
//         item._id.toString() === itemId
//       );
      
//       if (!selectedItem) {
//         return {
//           type: 'text',
//           text: user.preferredLanguage === 'tamil'
//             ? 'மன்னிக்கவும், இந்த பொருள் கிடைக்கவில்லை.'
//             : 'Sorry, this item is not available.'
//         };
//       }
      
//       // Transition to cart management state
//       await this.transitionTo(user, ConversationManager.STATES.CART_MANAGEMENT, {
//         selectedItemId: itemId
//       });
      
//       const quantityText = user.preferredLanguage === 'tamil'
//         ? `*${selectedItem.name}* - ₹${selectedItem.price}\nஎத்தனை பொருட்கள் வேண்டும்?`
//         : `*${selectedItem.name}* - ₹${selectedItem.price}\nHow many would you like to add?`;
      
//       return {
//         type: 'interactive_buttons',
//         text: quantityText,
//         buttons: [
//           { id: 'qty:1', text: '1' },
//           { id: 'qty:2', text: '2' },
//           { id: 'qty:3', text: '3' }
//         ]
//       };
//     } catch (error) {
//       console.error('Error in item selection:', error);
//       return this.handleError(user, error);
//     }
//   }

//   // Cart Management Handler
//   async handleCartManagement(user, message) {
//     const action = message.text;
    
//     try {
//       // Retrieve selected item and vendor from conversation state
//       const selectedItemId = user.conversationState.data.selectedItemId;
//       const vendorId = user.conversationState.data.selectedVendorId;
      
//       if (!selectedItemId || !vendorId) {
//         return {
//           type: 'text',
//           text: user.preferredLanguage === 'tamil'
//             ? 'தயவு செய்து மீண்டும் தொடங்கவும்.'
//             : 'Please start over.'
//         };
//       }
      
//       const vendor = await Vendor.findById(vendorId);
//       const selectedItem = vendor.menuItems.find(item => 
//         item._id.toString() === selectedItemId
//       );
      
//       // Determine quantity based on action
//       const quantity = action.startsWith('qty:') 
//         ? parseInt(action.substring(4)) 
//         : 1;
      
//       // Update user's cart
//       if (!user.cart.items) {
//         user.cart.items = [];
//       }
      
//       // Check if item already in cart
//       const existingItemIndex = user.cart.items.findIndex(item => 
//         item.itemId.toString() === selectedItemId
//       );
      
//       if (existingItemIndex >= 0) {
//         // Update existing item quantity
//         user.cart.items[existingItemIndex].quantity += quantity;
//       } else {
//         // Add new item to cart
//         user.cart.items.push({
//           itemId: selectedItem._id,
//           name: selectedItem.name,
//           quantity: quantity,
//           price: selectedItem.price
//         });
//       }
      
//       // Update cart total
//       user.cart.total = user.cart.items.reduce((total, item) => 
//         total + (item.price * item.quantity), 0
//       );
      
//       // Set vendor for cart
//       user.cart.vendorId = vendor._id;
      
//       await user.save();
      
//       // Transition to view cart state
//       await this.transitionTo(user, ConversationManager.STATES.VIEW_CART);
      
//       const addedText = user.preferredLanguage === 'tamil'
//         ? `*${selectedItem.name}* x${quantity} கார்ட்டில் சேர்க்கப்பட்டது.`
//         : `Added *${selectedItem.name}* x${quantity} to your cart.`;
      
//       const cartText = user.preferredLanguage === 'tamil'
//         ? `உங்கள் கார்ட்டில் இப்போது ₹${user.cart.total} மதிப்புள்ள ${user.cart.items.length} பொருட்கள் உள்ளன.`
//         : `Your cart now has ${user.cart.items.length} items worth ₹${user.cart.total}.`;
      
//       return {
//         type: 'interactive_buttons',
//         text: `${addedText}\n\n${cartText}`,
//         buttons: [
//           { id: 'add_more', text: user.preferredLanguage === 'tamil' ? 'மேலும் சேர்' : 'Add More' },
//           { id: 'view_cart', text: user.preferredLanguage === 'tamil' ? 'கார்ட் பார்க்க' : 'View Cart' },
//           { id: 'checkout', text: user.preferredLanguage === 'tamil' ? 'செக்அவுட்' : 'Checkout' }
//         ]
//       };
//     } catch (error) {
//       console.error('Error in cart management:', error);
//       return this.handleError(user, error);
//     }
//   }

//   // View Cart Handler
//   // View Cart Handler (continued)
// async handleViewCart(user, message) {
//   // Check if cart is empty
//   if (!user.cart.items || user.cart.items.length === 0) {
//     const emptyCartText = user.preferredLanguage === 'tamil'
//       ? 'உங்கள் கார்ட் காலியாக உள்ளது. தயவு செய்து உணவுகளைச் சேர்க்கவும்.'
//       : 'Your cart is empty. Please add some items.';
    
//     return {
//       type: 'text',
//       text: emptyCartText
//     };
//   }
  
//   // Get vendor details
//   const vendor = await Vendor.findById(user.cart.vendorId);
  
//   if (!vendor) {
//     return {
//       type: 'text',
//       text: user.preferredLanguage === 'tamil'
//         ? 'மன்னிக்கவும், உணவகம் கிடைக்கவில்லை.'
//         : 'Sorry, home cook not found.'
//     };
//   }
  
//   // Format cart details
//   let cartDetails = user.preferredLanguage === 'tamil'
//     ? `*உங்கள் கார்ட்*\n${vendor.businessName} உணவகத்திலிருந்து\n\n`
//     : `*Your Cart*\nFrom ${vendor.businessName}\n\n`;
  
//   user.cart.items.forEach((item, index) => {
//     cartDetails += `${index + 1}. ${item.name} x${item.quantity} - ₹${item.price * item.quantity}\n`;
//   });
  
//   cartDetails += `\n*மொத்தம்: ₹${user.cart.total}*`;
//   cartDetails += `\n*டெலிவரி கட்டணம்: ₹${vendor.deliveryFee}*`;
//   cartDetails += `\n*கிராண்ட் டோட்டல்: ₹${user.cart.total + vendor.deliveryFee}*`;
  
//   // Transition to cart management state
//   await this.transitionTo(user, ConversationManager.STATES.CART_MANAGEMENT);
  
//   return {
//     type: 'interactive_buttons',
//     text: cartDetails,
//     buttons: [
//       { 
//         id: 'add_more', 
//         text: user.preferredLanguage === 'tamil' ? 'மேலும் சேர்' : 'Add More' 
//       },
//       { 
//         id: 'clear_cart', 
//         text: user.preferredLanguage === 'tamil' ? 'கார்ட் அழி' : 'Clear Cart' 
//       },
//       { 
//         id: 'checkout', 
//         text: user.preferredLanguage === 'tamil' ? 'செக்அவுட்' : 'Checkout' 
//       }
//     ]
//   };
// }

// // Checkout Handler
// async handleCheckout(user, message) {
//   // Check if cart is empty
//   if (!user.cart.items || user.cart.items.length === 0) {
//     const emptyCartText = user.preferredLanguage === 'tamil'
//       ? 'உங்கள் கார்ட் காலியாக உள்ளது. தயவு செய்து உணவுகளைச் சேர்க்கவும்.'
//       : 'Your cart is empty. Please add some items.';
    
//     return {
//       type: 'text',
//       text: emptyCartText
//     };
//   }
  
//   // Get vendor details
//   const vendor = await Vendor.findById(user.cart.vendorId);
  
//   if (!vendor) {
//     return {
//       type: 'text',
//       text: user.preferredLanguage === 'tamil'
//         ? 'மன்னிக்கவும், உணவகம் கிடைக்கவில்லை.'
//         : 'Sorry, home cook not found.'
//     };
//   }
  
//   // Check minimum order amount
//   if (user.cart.total < vendor.minOrderAmount) {
//     const minOrderText = user.preferredLanguage === 'tamil'
//       ? `குறைந்தபட்ச ஆர்டர் தொகை ₹${vendor.minOrderAmount}. உங்கள் கார்ட் தற்போது ₹${user.cart.total} மட்டுமே.`
//       : `Minimum order amount is ₹${vendor.minOrderAmount}. Your cart is currently only ₹${user.cart.total}.`;
    
//     return {
//       type: 'text',
//       text: minOrderText
//     };
//   }
  
//   // Check if user has an address
//   if (!user.addresses || user.addresses.length === 0) {
//     await this.transitionTo(user, ConversationManager.STATES.LOCATION_SHARING);
    
//     const locationText = user.preferredLanguage === 'tamil'
//       ? 'டெலிவரிக்கு உங்கள் இருப்பிடத்தைப் பகிர்ந்து கொள்ளுங்கள்:'
//       : 'Please share your location for delivery:';
    
//     return {
//       type: 'location_request',
//       text: locationText,
//       action: 'send_location'
//     };
//   }
  
//   // Get default delivery address
//   const deliveryAddress = user.addresses[user.defaultAddressIndex];
  
//   // Transition to address confirmation
//   await this.transitionTo(user, ConversationManager.STATES.ADDRESS_CONFIRMATION, {
//     deliveryAddress: deliveryAddress
//   });
  
//   const addressText = user.preferredLanguage === 'tamil'
//     ? `*டெலிவரி முகவரி:*\n${deliveryAddress.fullAddress}\n\nஇந்த முகவரியைப் பயன்படுத்த விரும்புகிறீர்களா?`
//     : `*Delivery Address:*\n${deliveryAddress.fullAddress}\n\nWould you like to use this address?`;
  
//   return {
//     type: 'interactive_buttons',
//     text: addressText,
//     buttons: [
//       { 
//         id: 'confirm_address', 
//         text: user.preferredLanguage === 'tamil' ? 'ஆம், இந்த முகவரி சரி' : 'Yes, this address is correct' 
//       },
//       { 
//         id: 'new_address', 
//         text: user.preferredLanguage === 'tamil' ? 'வேறு முகவரி பகிர' : 'Share another location' 
//       }
//     ]
//   };
// }

// // Address Confirmation Handler
// async handleAddressConfirmation(user, message) {
//   const action = message.text;
  
//   if (action === 'confirm_address' || action === 'new_address') {
//     // Transition to payment selection
//     await this.transitionTo(user, ConversationManager.STATES.PAYMENT_SELECTION);
    
//     const paymentText = user.preferredLanguage === 'tamil'
//       ? 'பணம் செலுத்தும் முறையைத் தேர்ந்தெடுக்கவும்:'
//       : 'Please select a payment method:';
    
//     return {
//       type: 'interactive_buttons',
//       text: paymentText,
//       buttons: [
//         { 
//           id: 'payment_COD', 
//           text: user.preferredLanguage === 'tamil' ? 'பணம்' : 'Cash on Delivery' 
//         },
//         { 
//           id: 'payment_ONLINE', 
//           text: user.preferredLanguage === 'tamil' ? 'ஆன்லைன்' : 'Online Payment' 
//         },
//         { 
//           id: 'payment_UPI', 
//           text: 'UPI' 
//         }
//       ]
//     };
//   }
  
//   // If new address is selected, request location
//   if (action === 'new_address') {
//     await this.transitionTo(user, ConversationManager.STATES.LOCATION_SHARING);
    
//     const locationText = user.preferredLanguage === 'tamil'
//       ? 'புதிய டெலிவரி முகவரியைப் பகிர்ந்து கொள்ளுங்கள்:'
//       : 'Please share the new delivery location:';
    
//     return {
//       type: 'location_request',
//       text: locationText,
//       action: 'send_location'
//     };
//   }
  
//   // Fallback
//   return this.handleError(user, new Error('Invalid address confirmation'));
// }

// // Payment Selection Handler
// async handlePaymentSelection(user, message) {
//   const paymentMethod = message.text;
  
//   try {
//     // Validate payment method
//     const validMethods = ['payment_COD', 'payment_ONLINE', 'payment_UPI'];
//     if (!validMethods.includes(paymentMethod)) {
//       throw new Error('Invalid payment method');
//     }
    
//     // Transition to special instructions
//     await this.transitionTo(user, ConversationManager.STATES.SPECIAL_INSTRUCTIONS, {
//       paymentMethod: paymentMethod.replace('payment_', '')
//     });
    
//     const specialInstructionsText = user.preferredLanguage === 'tamil'
//       ? 'உங்கள் ஆர்டருக்கு சிறப்பு அறிவுறுத்தல்கள் உள்ளதா? (இல்லை என்றால் "இல்லை" என்று பதிலளிக்கவும்)'
//       : 'Do you have any special instructions for your order? (Reply with "no" if none)';
    
//     return {
//       type: 'text',
//       text: specialInstructionsText
//     };
//   } catch (error) {
//     console.error('Error in payment selection:', error);
//     return this.handleError(user, error);
//   }
// }

// // Special Instructions Handler
// async handleSpecialInstructions(user, message) {
//   const specialInstructions = message.text.toLowerCase();
  
//   try {
//     // Get payment method from conversation state
//     const paymentMethod = user.conversationState.data.paymentMethod;
    
//     // Create order
//     const vendor = await Vendor.findById(user.cart.vendorId);
    
//     const order = new Order({
//       userId: user._id,
//       vendorId: vendor._id,
//       items: user.cart.items,
//       totalAmount: user.cart.total,
//       deliveryFee: vendor.deliveryFee,
//       grandTotal: user.cart.total + vendor.deliveryFee,
//       deliveryAddress: {
//         fullAddress: user.addresses[user.defaultAddressIndex].fullAddress,
//         location: user.addresses[user.defaultAddressIndex].location
//       },
//       paymentMethod: paymentMethod,
//       specialInstructions: specialInstructions === 'no' ? '' : specialInstructions,
//       statusHistory: [{ 
//         status: 'PLACED', 
//         timestamp: new Date() 
//       }]
//     });
    
//     await order.save();
    
//     // Clear user's cart
//     user.cart = { items: [], total: 0 };
//     await user.save();
    
//     // Transition to order status
//     await this.transitionTo(user, ConversationManager.STATES.ORDER_STATUS, {
//       orderId: order._id
//     });
    
//     const confirmationText = user.preferredLanguage === 'tamil'
//       ? `🎉 ஆர்டர் வெற்றிகரமாக வைக்கப்பட்டது! உங்கள் ஆர்டர் ஐடி: ${order._id}\n\nநன்றி! உங்கள் உணவு விரைவில் வரும்.`
//       : `🎉 Order successfully placed! Your order ID is: ${order._id}\n\nThank you! Your food will be on the way soon.`;
    
//     return {
//       type: 'interactive_buttons',
//       text: confirmationText,
//       buttons: [
//         { 
//           id: 'track_order', 
//           text: user.preferredLanguage === 'tamil' ? 'ஆர்டரைத் தடம் பிடி' : 'Track Order' 
//         },
//         { 
//           id: 'main_menu', 
//           text: user.preferredLanguage === 'tamil' ? 'முகப்பு பக்கம்' : 'Main Menu' 
//         }
//       ]
//     };
//   } catch (error) {
//     console.error('Error processing special instructions:', error);
//     return this.handleError(user, error);
//   }
// }

// // Order Status Handler
// async handleOrderStatus(user, message) {
//   try {
//     const orderId = user.conversationState.data.orderId || message.text;
    
//     const order = await Order.findById(orderId).populate('vendorId');
    
//     if (!order) {
//       return {
//         type: 'text',
//         text: user.preferredLanguage === 'tamil'
//           ? 'ஆர்டர் கிடைக்கவில்லை.'
//           : 'Order not found.'
//       };
//     }
    
//     // Status emoji mapping
//     const statusEmoji = {
//       'PLACED': '📝',
//       'CONFIRMED': '✅',
//       'PREPARING': '👨‍🍳',
//       'OUT_FOR_DELIVERY': '🛵',
//       'DELIVERED': '🎁',
//       'CANCELLED': '❌'
//     };
    
//     const emoji = statusEmoji[order.orderStatus] || '📋';
    
//     const statusText = user.preferredLanguage === 'tamil'
//       ? `*ஆர்டர் நிலை* ${emoji}\nஆர்டர் ஐடி: ${order._id}\nஉணவகம்: ${order.vendorId.businessName}\nநிலை: ${order.orderStatus}\nமொத்தம்: ₹${order.grandTotal}`
//       : `*Order Status* ${emoji}\nOrder ID: ${order._id}\nVendor: ${order.vendorId.businessName}\nStatus: ${order.orderStatus}\nTotal: ₹${order.grandTotal}`;
    
//     return {
//       type: 'interactive_buttons',
//       text: statusText,
//       buttons: [
//         { 
//           id: 'main_menu', 
//           text: user.preferredLanguage === 'tamil' ? 'முகப்பு பக்கம்' : 'Main Menu' 
//         },
//         { 
//           id: 'reorder', 
//           text: user.preferredLanguage === 'tamil' ? 'மீண்டும் ஆர்டர்' : 'Reorder' 
//         }
//       ]
//     };
//   } catch (error) {
//     console.error('Error checking order status:', error);
//     return this.handleError(user, error)
// }}

// async handleHelp(user, message) {
//   await this.transitionTo(user, ConversationManager.STATES.HELP);
  
//   const helpText = user.preferredLanguage === 'tamil'
//     ? '*TamilFoods உதவி*\n\nநீங்கள் பின்வரும் செயல்களைச் செய்யலாம்:'
//     : '*TamilFoods Help*\n\nYou can perform the following actions:';
  
//   const commandsList = user.preferredLanguage === 'tamil'
//     ? [
//       '1. அருகிலுள்ள உணவகங்கள் - உங்கள் அருகிலுள்ள உணவகங்களைக் காட்டும்',
//       '2. உணவைத் தேடு - குறிப்பிட்ட உணவைத் தேடும்',
//       '3. எனது ஆர்டர்கள் - முந்தைய ஆர்டர்களைக் காட்டும்',
//       '4. ஆர்டர் நிலை - உங்கள் தற்போதைய ஆர்டரின் நிலையைச் சரிபார்க்கும்'
//     ]
//     : [
//       '1. Nearby Home Cooks - Shows home cooks near your location',
//       '2. Search Food - Search for specific food items',
//       '3. My Orders - View your previous orders',
//       '4. Order Status - Check the status of your current order'
//     ];
  
//   const helpOptionsText = user.preferredLanguage === 'tamil'
//     ? 'மேலும் தகவல் தேவையா?'
//     : 'Need more information?';
  
//   return {
//     type: 'interactive_buttons',
//     text: `${helpText}\n\n${commandsList.join('\n')}\n\n${helpOptionsText}`,
//     buttons: [
//       { 
//         id: 'help_ordering', 
//         text: user.preferredLanguage === 'tamil' ? 'ஆர்டர் செய்வது எப்படி' : 'How to Order' 
//       },
//       { 
//         id: 'help_payment', 
//         text: user.preferredLanguage === 'tamil' ? 'கட்டணம் செலுத்துவது எப்படி' : 'Payment Methods' 
//       },
//       { 
//         id: 'contact_support', 
//         text: user.preferredLanguage === 'tamil' ? 'தொடர்பு கொள்ளுங்கள்' : 'Contact Support' 
//       }
//     ]
//   };
// }

// // Help Ordering Handler
// async handleHelpOrdering(user, message) {
//   await this.transitionTo(user, ConversationManager.STATES.HELP_ORDERING);
  
//   const orderingSteps = user.preferredLanguage === 'tamil'
//     ? `*ஆர்டர் செய்வது எப்படி:*
// 1. தொடக்கத்தில் உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்
// 2. உங்கள் இருப்பிடத்தைப் பகிர்ந்து கொள்ளுங்கள்
// 3. அருகிலுள்ள உணவகங்களைப் பார்க்கவும்
// 4. ஒரு உணவகத்தைத் தேர்ந்தெடுக்கவும்
// 5. பிடித்த உணவுகளைக் கார்ட்டில் சேர்க்கவும்
// 6. செக்அவுட் பக்கத்தில் முகவரி மற்றும் கட்டணம் வகையைத் தேர்ந்தெடுக்கவும்
// 7. ஆர்டரை நிறைவேற்றவும்`
//     : `*How to Order:*
// 1. Start by selecting your language
// 2. Share your location
// 3. Browse nearby home cooks
// 4. Select a home cook
// 5. Add items to your cart
// 6. Checkout with address and payment method
// 7. Complete your order`;
  
//   return {
//     type: 'interactive_buttons',
//     text: orderingSteps,
//     buttons: [
//       { 
//         id: 'help_payment', 
//         text: user.preferredLanguage === 'tamil' ? 'கட்டணம் வகைகள்' : 'Payment Methods' 
//       },
//       { 
//         id: 'main_menu', 
//         text: user.preferredLanguage === 'tamil' ? 'முகப்பு பக்கம்' : 'Main Menu' 
//       }
//     ]
//   };
// }

// // Help Payment Handler
// async handleHelpPayment(user, message) {
//   await this.transitionTo(user, ConversationManager.STATES.HELP_PAYMENT);
  
//   const paymentMethods = user.preferredLanguage === 'tamil'
//     ? `*கட்டணம் வகைகள்:*
// 1. பணம் (COD) - டெலிவரி நேரத்தில் பணம் செலுத்தவும்
// 2. ஆன்லைன் கட்டணம் - கிரெடிட்/டெபிட் கார்டு மூலம்
// 3. UPI - Google Pay, PhonePe, Paytm மூலம்

// *கட்டண தகவல்:*
// - பணப்பரிவர்த்தனை பாதுகாப்பானது
// - வரி மற்றும் கட்டணங்கள் முன்பே தெரிவிக்கப்படும்`
//     : `*Payment Methods:*
// 1. Cash on Delivery (COD) - Pay at the time of delivery
// 2. Online Payment - Using Credit/Debit Card
// 3. UPI - Through Google Pay, PhonePe, Paytm

// *Payment Information:*
// - Transactions are secure
// - Taxes and fees are disclosed upfront`;
  
//   return {
//     type: 'interactive_buttons',
//     text: paymentMethods,
//     buttons: [
//       { 
//         id: 'help_ordering', 
//         text: user.preferredLanguage === 'tamil' ? 'ஆர்டர் செய்வது எப்படி' : 'How to Order' 
//       },
//       { 
//         id: 'main_menu', 
//         text: user.preferredLanguage === 'tamil' ? 'முகப்பு பக்கம்' : 'Main Menu' 
//       }
//     ]
//   };
// }

// // Order History Handler
// async handleOrderHistory(user, message) {
//   await this.transitionTo(user, ConversationManager.STATES.ORDER_HISTORY);
  
//   try {
//     // Fetch recent orders
//     const orders = await Order.find({ userId: user._id })
//       .sort({ createdAt: -1 })
//       .limit(5)
//       .populate('vendorId');
    
//     if (!orders || orders.length === 0) {
//       const noOrdersText = user.preferredLanguage === 'tamil'
//         ? 'உங்களிடம் முந்தைய ஆர்டர்கள் எதுவும் இல்லை.'
//         : 'You have no previous orders.';
      
//       return {
//         type: 'interactive_buttons',
//         text: noOrdersText,
//         buttons: [
//           { 
//             id: 'nearby_vendors', 
//             text: user.preferredLanguage === 'tamil' ? 'உணவகம் தேர்வு' : 'Select Home Cook' 
//           }
//         ]
//       };
//     }
    
//     // Format order history
//     let orderHistoryText = user.preferredLanguage === 'tamil'
//       ? '*சமீபத்திய ஆர்டர்கள்*\n'
//       : '*Recent Orders*\n';
    
//     const orderList = orders.map((order, index) => ({
//       id: `order_${order._id}`,
//       title: `${index + 1}. ${order.vendorId.businessName}`,
//       description: `${order.orderStatus} - ₹${order.grandTotal}`
//     }));
    
//     return {
//       type: 'interactive_list',
//       text: orderHistoryText,
//       button: user.preferredLanguage === 'tamil' ? 'பார்க்க' : 'View',
//       sectionTitle: user.preferredLanguage === 'tamil' ? 'ஆர்டர் வரலாறு' : 'Order History',
//       items: orderList
//     };
//   } catch (error) {
//     console.error('Error fetching order history:', error);
//     return this.handleError(user, error);
//   }
// }

// // Contact Support Handler
// async handleContactSupport(user, message) {
//   await this.transitionTo(user, ConversationManager.STATES.CONTACT_SUPPORT);
  
//   const supportText = user.preferredLanguage === 'tamil'
//     ? `*தொடர்பு விவரங்கள்*
// - மின்னஞ்சல்: support@tamilfoods.com
// - தொலைபேசி: +91 1234567890
// - WhatsApp ஆதரவு: +91 9876543210

// தயவு செய்து பின்வரும் தகவல்களை வழங்கவும்:
// - உங்கள் பெயர்
// - ஆர்டர் ஐடி (தெரிந்தால்)
// - பிரச்சனையின் விவரம்`
//     : `*Contact Support*
// - Email: support@tamilfoods.com
// - Phone: +91 1234567890
// - WhatsApp Support: +91 9876543210

// Please provide the following information:
// - Your Name
// - Order ID (if available)
// - Description of the issue`;
  
//   return {
//     type: 'interactive_buttons',
//     text: supportText,
//     buttons: [
//       { 
//         id: 'main_menu', 
//         text: user.preferredLanguage === 'tamil' ? 'முகப்பு பக்கம்' : 'Main Menu' 
//       }
//     ]
//   };
// }

// // Feedback Handler
// async handleFeedback(user, message) {
//   const feedbackScore = message.text.replace('feedback_', '');
  
//   try {
//     // Save feedback to the last order
//     const lastOrder = await Order.findOne({ 
//       userId: user._id 
//     }).sort({ createdAt: -1 });
    
//     if (lastOrder) {
//       lastOrder.feedback = {
//         score: parseInt(feedbackScore),
//         timestamp: new Date()
//       };
//       await lastOrder.save();
//     }
    
//     const thankYouText = user.preferredLanguage === 'tamil'
//       ? `உங்கள் மதிப்பீட்டிற்கு நன்றி! ${feedbackScore}/5 மதிப்பெண்கள்`
//       : `Thank you for your feedback! ${feedbackScore}/5 stars`;
    
//     // Transition back to main menu
//     await this.transitionTo(user, ConversationManager.STATES.MAIN_MENU);
    
//     return {
//       type: 'interactive_buttons',
//       text: thankYouText,
//       buttons: [
//         { 
//           id: 'main_menu', 
//           text: user.preferredLanguage === 'tamil' ? 'முகப்பு பக்கம்' : 'Main Menu' 
//         }
//       ]
//     };
//   } catch (error) {
//     console.error('Error processing feedback:', error);
//     return this.handleError(user, error);
//   }
// }

// // Utility method to handle default/fallback intent
// async handleUnknownState(user, message) {
//   console.warn(`Unhandled message in state ${user.conversationState.context}:`, message);
  
//   // Reset to main menu with an error message
//   await this.transitionTo(user, ConversationManager.STATES.MAIN_MENU);
  
//   const fallbackText = user.preferredLanguage === 'tamil'
//     ? 'மன்னிக்கவும், நான் உங்கள் கட்டளையைப் புரிந்து கொள்ள முடியவில்லை. தயவு செய்து மீண்டும் முயற்சிக்கவும்.'
//     : 'Sorry, I could not understand your request. Please try again.';
  
//   return this.getMainMenuResponse(user, fallbackText);
// }

// // Error handler for unexpected errors
// async handleError(user, error) {
//   console.error('Conversation Error:', error);
  
//   // Transition back to main menu
//   await this.transitionTo(user, ConversationManager.STATES.MAIN_MENU);
  
//   const errorText = user.preferredLanguage === 'tamil'
//     ? 'மன்னிக்கவும், ஒரு பிழை ஏற்பட்டது. தயவு செய்து மீண்டும் முயற்சிக்கவும்.'
//     : 'Sorry, an error occurred. Please try again.';
  
//   return this.getMainMenuResponse(user, errorText);
// }
// }

// module.exports = ConversationManager;
