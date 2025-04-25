const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const PaymentController = require('../controllers/PaymentController');
const { WebhookClient, Payload } = require('dialogflow-fulfillment');

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

function getPhoneNumber(agent) {
  try {
    // Try to get phone number from WhatsApp structure
    if (agent.originalRequest && 
        agent.originalRequest.payload && 
        agent.originalRequest.payload.data && 
        agent.originalRequest.payload.data.from) {
      return agent.originalRequest.payload.data.from;
    }
    
    // Try to get from session ID if possible
    if (agent.session) {
      const sessionId = agent.session.split('/').pop();
      if (sessionId && sessionId.length > 5) {
        return sessionId;
      }
    }
    
    // Fallback to test phone number
    return 'test_user_123';
  } catch (error) {
    console.log('Error getting phone number, using default:', error);
    return 'test_user_123';
  }
}

// Handler functions for Dialogflow intents
const intentHandlers = {
  // Welcome intent handler
  welcome: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    
    // Find or create user
    let user = await User.findOne({ phoneNumber });
    console.log({user});
    
    if (!user) {
      user = new User({ phoneNumber });
      console.log("!user",{phoneNumber});
      await user.save();
      
      // First-time user
      agent.add('வணக்கம்! Welcome to TamilFoods! 🍲');
      agent.add('I can help you order delicious home-cooked food from nearby cooks.');
      
      // Ask for language preference
      const languagePayload = {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: 'Please select your preferred language:'
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: 'english',
                  title: 'English'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'tamil',
                  title: 'தமிழ் (Tamil)'
                }
              }
            ]
          }
        }
      };
      
      agent.add(new Payload('PLATFORM_UNSPECIFIED', languagePayload));
    } else {
      // Returning user
      const greeting = user.preferredLanguage === 'tamil' ? 
        'வணக்கம்! மீண்டும் வருக! 🍲' : 
        'Welcome back to TamilFoods! 🍲';
      
      agent.add(greeting);
      
      // Show main menu
      const menuText = user.preferredLanguage === 'tamil' ? 
        'நான் எப்படி உதவ முடியும்?' :
        'How can I help you today?';
      
      const optionTexts = user.preferredLanguage === 'tamil' ? 
        [
          'அருகிலுள்ள உணவகங்கள்',
          'உணவைத் தேடு',
          'எனது ஆர்டர்கள்',
          'உதவி'
        ] : 
        [
          'Nearby Home Cooks',
          'Search Food',
          'My Orders',
          'Help'
        ];
      
      const menuPayload = {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: menuText
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: 'nearby_vendors',
                  title: optionTexts[0]
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'search_food',
                  title: optionTexts[1]
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'my_orders',
                  title: optionTexts[2]
                }
              },
              // {
              //   type: 'reply',
              //   reply: {
              //     id: 'help',
              //     title: optionTexts[3]
              //   }
              // }
            ]
          }
        }
      };
      
      agent.add(new Payload('PLATFORM_UNSPECIFIED', menuPayload));
    }
  },
    
  
  // Set language preference
  setLanguage: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    const language = agent.parameters.language || 'english';
    
    // Update user's language preference
    const user = await User.findOne({ phoneNumber });
    
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    user.preferredLanguage = language;
    await user.save();
    
    // Confirm language setting
    const confirmationText = language === 'tamil' ? 
      'தமிழ் மொழி தேர்ந்தெடுக்கப்பட்டது. 🎉' : 
      'English language selected. 🎉';
    
    agent.add(confirmationText);
    
    // Ask for location
    const locationText = language === 'tamil' ? 
      'நாங்கள் உங்கள் இருப்பிடத்தைப் பெற்றால், அருகிலுள்ள உணவகங்களைக் காண்பிக்க முடியும்.' : 
      'We can show you nearby home cooks if we have your location.';
    
    // Create location request message
    const locationPayload = {
      type: 'interactive',
      interactive: {
        type: 'location_request_message',
        body: { 
          text: locationText 
        },
        action: {
          name: 'send_location'
        }
      }
    };
    
    agent.add(new Payload('PLATFORM_UNSPECIFIED', locationPayload));
  },
  
// Process location shared by user
processLocation: async (agent) => {
  const phoneNumber = getPhoneNumber(agent);
  // Extract location data from the right place
  let latitude, longitude;
  
  try {
    // Check if there's location data in the original request
    const originalMessage = agent.request_.body.originalDetectIntentRequest?.payload?.messageText;
    
    if (originalMessage && originalMessage.includes("latitude")) {
      // Parse the location data from the original message
      const locationData = JSON.parse(originalMessage);
      latitude = locationData.latitude;
      longitude = locationData.longitude;
    } else {
      // Check if the location coordinates are directly available in the message
      const originalDetectIntentRequest = agent.request_.body.originalDetectIntentRequest;
      if (originalDetectIntentRequest?.payload?.location) {
        latitude = originalDetectIntentRequest.payload.location.latitude;
        longitude = originalDetectIntentRequest.payload.location.longitude;
      }
    }
    
    console.log("Extracted location:", { latitude, longitude });
  } catch (error) {
    console.error("Error parsing location data:", error);
  }
  
  
  if (!latitude || !longitude) {
    return agent.add('Please share your location to continue.');
  }
  
  // Save location to user profile
  const user = await User.findOne({ phoneNumber });
  if (!user) return agent.add('Sorry, something went wrong. Please try again.');
  
  const newAddress = {
    label: 'Shared Location',
    fullAddress: 'Location shared via WhatsApp',
    location: {
      type: 'Point',
      coordinates: [longitude, latitude]
    }
  };
  user.addresses.push(newAddress);
  user.defaultAddressIndex = user.addresses.length - 1;
  await user.save();
  
  // Show main menu after location is saved
  const menuText = user.preferredLanguage === 'tamil' ?
    'உங்கள் இருப்பிடம் சேமிக்கப்பட்டது! நான் எப்படி உதவ முடியும்?' :
    'Location saved! How can I help you today?';
  
  const optionTexts = user.preferredLanguage === 'tamil' ?
    [
      'அருகிலுள்ள உணவகங்கள்',
      'உணவைத் தேடு',
      'எனது ஆர்டர்கள்',
      'உதவி'
    ] :
    [
      'Nearby Home Cooks',
      'Search Food',
      'My Orders',
      'Help'
    ];
  
  const menuPayload = {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: menuText
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: 'nearby_vendors',
              title: optionTexts[0]
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'search_food',
              title: optionTexts[1]
            }
          },
          {
            type: 'reply',
            reply: {
              id: 'my_orders',
              title: optionTexts[2]
            }
          }
        ]
      }
    }
  };
  
  agent.add(new Payload('PLATFORM_UNSPECIFIED', menuPayload));
},

  // Search for food items
  searchFood: async (agent) => {
     const phoneNumber = getPhoneNumber(agent);
    const foodItem = agent.parameters.food_item;
    
    const user = await User.findOne({ phoneNumber });
    console.log('searchFood',{user});
    
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    // Ensure user has a location
    if (!user.addresses || user.addresses.length === 0) {
      const locationText = user.preferredLanguage === 'tamil' ? 
        'உங்கள் இருப்பிடத்தைப் பகிர்ந்து கொள்ளுங்கள்:' : 
        'Please share your location first:';
      
      agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
        whatsapp_type: 'location_request',
        text: locationText
      }));
      return;
    }
    
    if (!foodItem) {
      const askFoodText = user.preferredLanguage === 'tamil' ? 
        'நீங்கள் எந்த உணவை தேடுகிறீர்கள்?' : 
        'What food item are you looking for?';
      
      return agent.add(askFoodText);
    }
    
    // Get user location
    const userLocation = user.addresses[user.defaultAddressIndex].location;
    
    // Search for vendors with this food item
    const vendors = await Vendor.find({
      isActive: true,
      'menuItems.name': { $regex: foodItem, $options: 'i' },
      'address.location': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: userLocation.coordinates
          },
          $maxDistance: 5000 // 5km radius
        }
      }
    });
    
    if (vendors.length === 0) {
      const noVendorsText = user.preferredLanguage === 'tamil' ? 
        `மன்னிக்கவும், "${foodItem}" வழங்கும் அருகிலுள்ள உணவகங்கள் எதுவும் கிடைக்கவில்லை. வேறு உணவை தேட முயற்சிக்கவும்.` : 
        `Sorry, we couldn't find any nearby home cooks offering "${foodItem}". Please try searching for something else.`;
      
      return agent.add(noVendorsText);
    }
    
    // Format vendors list with their food items
    const vendorItems = [];
    
    for (const vendor of vendors) {
      const matchingItems = vendor.menuItems.filter(item => 
        item.name.toLowerCase().includes(foodItem.toLowerCase()) && item.isAvailable
      );
      
      for (const item of matchingItems) {
        vendorItems.push({
          id: `${vendor._id}:${item._id}`,
          title: `${item.name} - ₹${item.price}`,
          description: `From: ${vendor.businessName} (${(vendor.rating || 0).toFixed(1)}★)`
        });
      }
    }
    
    // Show results with list
    const resultsText = user.preferredLanguage === 'tamil' ? 
      `நாங்கள் ${vendorItems.length} "${foodItem}" பொருட்களைக் கண்டுபிடித்தோம். ஒன்றைத் தேர்ந்தெடுக்கவும்:` : 
      `We found ${vendorItems.length} "${foodItem}" items. Select one to view details:`;
    
    const buttonText = user.preferredLanguage === 'tamil' ? 'பார்க்க' : 'View';
    const sectionTitle = user.preferredLanguage === 'tamil' ? 'கிடைக்கும் உணவு' : 'Available Items';
    
    agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
      whatsapp_type: 'list',
      text: resultsText,
      button: buttonText,
      sectionTitle: sectionTitle,
      items: vendorItems.slice(0, 10) // WhatsApp limits to 10 items
    }));
  },
  
  // Browse nearby vendors
  browseNearbyVendors: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    // Ensure user has a location
    if (!user.addresses || user.addresses.length === 0) {
      const locationText = user.preferredLanguage === 'tamil' ?
        'உங்கள் இருப்பிடத்தைப் பகிர்ந்து கொள்ளுங்கள்:' :
        'Please share your current location so we can find nearby home cooks for you.';
      
      // Updated to use the proper WhatsApp location_request_message format
      const locationPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "interactive",
        interactive: {
          type: "location_request_message",
          body: {
            text: locationText
          },
          action: {
            name: "send_location"
          }
        }
      };
      
      agent.add(new Payload('PLATFORM_UNSPECIFIED', locationPayload));
      return;
    }
    
    // Get user location
    const userLocation = user.addresses[user.defaultAddressIndex].location;
    
    // Find nearby vendors
    const vendors = await Vendor.find({
      isActive: true,
      'address.location': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: userLocation.coordinates
          },
          $maxDistance: 5000 // 5km radius
        }
      }
    }).limit(10);
    
    if (vendors.length === 0) {
      const noVendorsText = user.preferredLanguage === 'tamil' ?
        'மன்னிக்கவும், அருகிலுள்ள உணவகங்கள் எதுவும் கிடைக்கவில்லை. பின்னர் மீண்டும் முயற்சிக்கவும்.' :
        'Sorry, we couldn\'t find any home cooks near you. Please try again later.';
      return agent.add(noVendorsText);
    }
    
    // Format vendors list
    const vendorList = vendors.map(vendor => {
      // Calculate distance (approximate)
      const distance = calculateDistance(
        userLocation.coordinates[1],
        userLocation.coordinates[0],
        vendor.address.location.coordinates[1],
        vendor.address.location.coordinates[0]
      );
      
      return {
        id: vendor._id.toString(),
        title: `${vendor.businessName} (${(vendor.rating || 0).toFixed(1)}★)`,
        description: `${vendor.cuisineType.join(', ')} • ${distance.toFixed(1)}km away`
      };
    });
    
    // Show results using proper WhatsApp list format
    const resultsText = user.preferredLanguage === 'tamil' ?
      `உங்களுக்கு அருகில் ${vendors.length} உணவகங்கள் கண்டுபிடிக்கப்பட்டன. ஒன்றைத் தேர்ந்தெடுக்கவும்:` :
      `We found ${vendors.length} home cooks near you. Select one to view their menu:`;
    
    const listPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "interactive",
      interactive: {
        type: "list",
        header: {
          type: "text",
          text: user.preferredLanguage === 'tamil' ? "உணவு கடைகள்" : "Home Cooks"
        },
        body: {
          text: resultsText
        },
        footer: {
          text: user.preferredLanguage === 'tamil' ? "தேர்வு செய்யவும்" : "Make a selection"
        },
        action: {
          button: user.preferredLanguage === 'tamil' ? "பார்க்க" : "View",
          sections: [
            {
              title: user.preferredLanguage === 'tamil' ? "அருகிலுள்ள உணவகங்கள்" : "Nearby Home Cooks",
              rows: vendorList.map(vendor => ({
                id: vendor.id,
                title: vendor.title,
                description: vendor.description
              }))
            }
          ]
        }
      }
    };
    
    agent.add(new Payload('PLATFORM_UNSPECIFIED', listPayload));
  },
  // Select vendor and show menu
  selectVendor: async (agent) => {
     const phoneNumber = getPhoneNumber(agent);
    const vendorId = agent.parameters.vendor_id;
    
    if (!vendorId) {
      return agent.add('Please select a home cook to view their menu.');
    }
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    // Get vendor details
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return agent.add('Sorry, this home cook is no longer available.');
    }
    
    // Check if vendor is open
    const isOpen = vendor.isCurrentlyOpen();
    
    // Format vendor info
    const vendorInfo = user.preferredLanguage === 'tamil' ? 
      `*${vendor.businessName}*\n${vendor.cuisineType.join(', ')}\n${isOpen ? '🟢 இப்போது திறந்திருக்கிறது' : '🔴 தற்போது மூடப்பட்டுள்ளது'}\nமதிப்பீடு: ${(vendor.rating || 0).toFixed(1)}★ (${vendor.reviewCount || 0} மதிப்புரைகள்)\nகுறைந்தபட்ச ஆர்டர்: ₹${vendor.minOrderAmount}\nடெலிவரி கட்டணம்: ₹${vendor.deliveryFee}` : 
      `*${vendor.businessName}*\n${vendor.cuisineType.join(', ')}\n${isOpen ? '🟢 Currently Open' : '🔴 Currently Closed'}\nRating: ${(vendor.rating || 0).toFixed(1)}★ (${vendor.reviewCount || 0} reviews)\nMin Order: ₹${vendor.minOrderAmount}\nDelivery Fee: ₹${vendor.deliveryFee}`;
    
    agent.add(vendorInfo);
    
    // Clear user's cart if changing vendors
    if (user.cart && user.cart.vendorId && user.cart.vendorId.toString() !== vendorId) {
      user.cart = { vendorId: vendor._id, items: [], total: 0 };
      await user.save();
    } else if (!user.cart || !user.cart.vendorId) {
      user.cart = { vendorId: vendor._id, items: [], total: 0 };
      await user.save();
    }
    
    // Organize menu by categories
    const menuCategories = {};
    
    vendor.menuItems.forEach(item => {
      if (item.isAvailable) {
        if (!menuCategories[item.category]) {
          menuCategories[item.category] = [];
        }
        
        menuCategories[item.category].push(item);
      }
    });
    
    // Show menu categories
    const categoriesList = Object.keys(menuCategories).map(category => ({
      id: `category:${category}`,
      title: category,
      description: `${menuCategories[category].length} items`
    }));
    
    const menuText = user.preferredLanguage === 'tamil' ? 
      'பின்வரும் வகைகளிலிருந்து தேர்ந்தெடுக்கவும்:' : 
      'Select from the following categories:';
    
    const buttonText = user.preferredLanguage === 'tamil' ? 'பார்க்க' : 'View';
    const sectionTitle = user.preferredLanguage === 'tamil' ? 'உணவு வகைகள்' : 'Food Categories';
    
    agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
      whatsapp_type: 'list',
      text: menuText,
      button: buttonText,
      sectionTitle: sectionTitle,
      items: categoriesList
    }));
  },
  
  // Browse menu items in a category
  browseMenu: async (agent) => {
     const phoneNumber = getPhoneNumber(agent);
    const categoryInput = agent.parameters.category;
    
    if (!categoryInput) {
      return agent.add('Please select a category to view menu items.');
    }
    
    // Extract category name from the format "category:CategoryName"
    const category = categoryInput.startsWith('category:') ? 
      categoryInput.substring(9) : categoryInput;
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    if (!user.cart || !user.cart.vendorId) {
      return agent.add('Please select a home cook first.');
    }
    
    // Get vendor details
    const vendor = await Vendor.findById(user.cart.vendorId);
    if (!vendor) {
      return agent.add('Sorry, this home cook is no longer available.');
    }
    
    // Get items in the selected category
    const menuItems = vendor.menuItems.filter(item => 
      item.category === category && item.isAvailable
    );
    
    if (menuItems.length === 0) {
      const noItemsText = user.preferredLanguage === 'tamil' ? 
        'இந்த வகையில் தற்போது கிடைக்கும் உணவுகள் இல்லை.' : 
        'No items currently available in this category.';
      
      return agent.add(noItemsText);
    }
    
    // Format menu items list
    const itemsList = menuItems.map(item => ({
      id: `item:${item._id}`,
      title: `${item.name} - ₹${item.price}`,
      description: item.description || ''
    }));
    
    const menuText = user.preferredLanguage === 'tamil' ? 
      `*${category}* வகையில் கிடைக்கும் உணவுகள்:` : 
      `Available items in *${category}*:`;
    
    const buttonText = user.preferredLanguage === 'tamil' ? 'தேர்ந்தெடு' : 'Select';
    const sectionTitle = user.preferredLanguage === 'tamil' ? 'உணவு பொருட்கள்' : 'Menu Items';
    
    agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
      whatsapp_type: 'list',
      text: menuText,
      button: buttonText,
      sectionTitle: sectionTitle,
      items: itemsList
    }));
  },
  
  // Add item to cart
  addToCart: async (agent) => {
     const phoneNumber = getPhoneNumber(agent);
    const itemInput = agent.parameters.item;
    const quantity = agent.parameters.quantity || 1;
    
    if (!itemInput) {
      return agent.add('Please select an item to add to your cart.');
    }
    
    // Extract item ID from the format "item:ItemID"
    const itemId = itemInput.startsWith('item:') ? 
      itemInput.substring(5) : itemInput;
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    if (!user.cart || !user.cart.vendorId) {
      return agent.add('Please select a home cook first.');
    }
    
    // Get vendor details
    const vendor = await Vendor.findById(user.cart.vendorId);
    if (!vendor) {
      return agent.add('Sorry, this home cook is no longer available.');
    }
    
    // Find the selected item
    const menuItem = vendor.menuItems.find(item => item._id.toString() === itemId);
    
    if (!menuItem) {
      return agent.add('Sorry, this item is not available.');
    }
    
    if (!menuItem.isAvailable) {
      const notAvailableText = user.preferredLanguage === 'tamil' ? 
        'மன்னிக்கவும், இந்த உணவு தற்போது கிடைக்கவில்லை.' : 
        'Sorry, this item is currently unavailable.';
      
      return agent.add(notAvailableText);
    }
    
    // Initialize cart if needed
    if (!user.cart.items) {
      user.cart.items = [];
    }
    
    // Check if item already in cart
    const existingItemIndex = user.cart.items.findIndex(item => 
      item.itemId.toString() === itemId
    );
    
    if (existingItemIndex >= 0) {
      // Update existing item quantity
      user.cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item to cart
      user.cart.items.push({
        itemId: menuItem._id,
        name: menuItem.name,
        quantity: quantity,
        price: menuItem.price
      });
    }
    
    // Update cart total
    user.cart.total = user.cart.items.reduce((total, item) => 
      total + (item.price * item.quantity), 0
    );
    
    await user.save();
    
    // Confirm item added
    const addedText = user.preferredLanguage === 'tamil' ? 
      `*${menuItem.name}* x${quantity} உங்கள் கார்ட்டில் சேர்க்கப்பட்டது.` : 
      `Added *${menuItem.name}* x${quantity} to your cart.`;
    
    agent.add(addedText);
    
    // Show cart options
    const cartText = user.preferredLanguage === 'tamil' ? 
      'உங்கள் கார்ட்டில் இப்போது ₹' + user.cart.total + ' மதிப்புள்ள ' + user.cart.items.length + ' பொருட்கள் உள்ளன. நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?' : 
      'Your cart now has ' + user.cart.items.length + ' items worth ₹' + user.cart.total + '. What would you like to do?';
    
    const optionTexts = user.preferredLanguage === 'tamil' ? 
      [
        'மேலும் சேர்',
        'கார்ட் பார்க்க',
        'செக்அவுட்'
      ] : 
      [
        'Add More',
        'View Cart',
        'Checkout'
      ];
    
    agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
      whatsapp_type: 'buttons',
      text: cartText,
      buttons: [
        { id: 'add_more', text: optionTexts[0] },
        { id: 'view_cart', text: optionTexts[1] },
        { id: 'checkout', text: optionTexts[2] }
      ]
    }));
  },
  
  // View cart contents
  viewCart: async (agent) => {
     const phoneNumber = getPhoneNumber(agent);
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    if (!user.cart || !user.cart.vendorId || !user.cart.items || user.cart.items.length === 0) {
      const emptyCartText = user.preferredLanguage === 'tamil' ? 
        'உங்கள் கார்ட் காலியாக உள்ளது. உணவகத்தைத் தேர்ந்தெடுத்து உணவைத் தேர்ந்தெடுக்கவும்.' : 
        'Your cart is empty. Please select a home cook and choose some food.';
      
      return agent.add(emptyCartText);
    }
    
    // Get vendor details
    const vendor = await Vendor.findById(user.cart.vendorId);
    if (!vendor) {
      return agent.add('Sorry, the selected home cook is no longer available.');
    }
    
    // Format cart contents
    let cartDetails = user.preferredLanguage === 'tamil' ? 
      `*உங்கள் கார்ட்*\n${vendor.businessName} உணவகத்திலிருந்து\n\n` : 
      `*Your Cart*\nFrom ${vendor.businessName}\n\n`;
    
    user.cart.items.forEach((item, index) => {
      cartDetails += `${index + 1}. ${item.name} x${item.quantity} - ₹${item.price * item.quantity}\n`;
    });
    
    cartDetails += `\n*மொத்தம்: ₹${user.cart.total}*`;
    cartDetails += `\n*டெலிவரி கட்டணம்: ₹${vendor.deliveryFee}*`;
    cartDetails += `\n*கிராண்ட் டோட்டல்: ₹${user.cart.total + vendor.deliveryFee}*`;
    
    agent.add(cartDetails);
    
    // Show cart options
    const optionsText = user.preferredLanguage === 'tamil' ? 
      'என்ன செய்ய விரும்புகிறீர்கள்?' : 
      'What would you like to do?';
    
    const optionTexts = user.preferredLanguage === 'tamil' ? 
      [
        'மேலும் சேர்',
        'கார்ட் அழி',
        'செக்அவுட்'
      ] : 
      [
        'Add More',
        'Clear Cart',
        'Checkout'
      ];
    
    agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
      whatsapp_type: 'buttons',
      text: optionsText,
      buttons: [
        { id: 'add_more', text: optionTexts[0] },
        { id: 'clear_cart', text: optionTexts[1] },
        { id: 'checkout', text: optionTexts[2] }
      ]
    }));
  },
  
  // Checkout process
  checkout: async (agent) => {
     const phoneNumber = getPhoneNumber(agent);
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    if (!user.cart || !user.cart.vendorId || !user.cart.items || user.cart.items.length === 0) {
      const emptyCartText = user.preferredLanguage === 'tamil' ? 
        'உங்கள் கார்ட் காலியாக உள்ளது. முதலில் உணவைத் தேர்ந்தெடுக்கவும்.' : 
        'Your cart is empty. Please select some food items first.';
      
      return agent.add(emptyCartText);
    }
    
    // Get vendor details
    const vendor = await Vendor.findById(user.cart.vendorId);
    if (!vendor) {
      return agent.add('Sorry, the selected home cook is no longer available.');
    }
    
    // Check minimum order amount
    if (user.cart.total < vendor.minOrderAmount) {
      const minOrderText = user.preferredLanguage === 'tamil' ? 
        `குறைந்தபட்ச ஆர்டர் தொகை ₹${vendor.minOrderAmount} ஆகும். உங்கள் கார்ட் தற்போது ₹${user.cart.total} மட்டுமே. இன்னும் சில பொருட்களைச் சேர்க்கவும்.` : 
        `Minimum order amount is ₹${vendor.minOrderAmount}. Your cart is currently only ₹${user.cart.total}. Please add more items.`;
      
      return agent.add(minOrderText);
    }
    
    // Show delivery address
    if (!user.addresses || user.addresses.length === 0) {
      const noAddressText = user.preferredLanguage === 'tamil' ? 
        'டெலிவரிக்கு உங்கள் இருப்பிடத்தைப் பகிர்ந்து கொள்ளுங்கள்:' : 
        'Please share your location for delivery:';
      
      agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
        whatsapp_type: 'location_request',
        text: noAddressText
      }));
      return;
    }
    
    const deliveryAddress = user.addresses[user.defaultAddressIndex];
    
    const addressText = user.preferredLanguage === 'tamil' ? 
      `*டெலிவரி முகவரி:*\n${deliveryAddress.fullAddress}\n\nஇந்த முகவரியை பயன்படுத்த விரும்புகிறீர்களா?` : 
      `*Delivery Address:*\n${deliveryAddress.fullAddress}\n\nWould you like to use this address?`;
    
    const confirmTexts = user.preferredLanguage === 'tamil' ? 
      [
        'ஆம், இந்த முகவரி சரி',
        'வேறு முகவரி பகிர'
      ] : 
      [
        'Yes, this address is correct',
        'Share another location'
      ];
    
    agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
      whatsapp_type: 'buttons',
      text: addressText,
      buttons: [
        { id: 'confirm_address', text: confirmTexts[0] },
        { id: 'new_address', text: confirmTexts[1] }
      ]
    }));
  },

  // Handle payment method selection
selectPaymentMethod: async (agent) => {
  const phoneNumber = getPhoneNumber(agent);
  const paymentMethod = agent.parameters.payment_method;
  
  const user = await User.findOne({ phoneNumber });
  if (!user) return agent.add('Sorry, something went wrong. Please try again.');
  
  if (!user.cart || !user.cart.vendorId || !user.cart.items || user.cart.items.length === 0) {
    return agent.add('Please add items to your cart first.');
  }
  
  // Get vendor details
  const vendor = await Vendor.findById(user.cart.vendorId);
  if (!vendor) {
    return agent.add('Sorry, the selected home cook is no longer available.');
  }
  
  // Handle payment method selection
  let selectedMethod = '';
  if (paymentMethod) {
    selectedMethod = paymentMethod;
  } else {
    // If no payment method selected, show payment options
    const paymentText = user.preferredLanguage === 'tamil' ? 
      'பணம் செலுத்தும் முறையைத் தேர்ந்தெடுக்கவும்:' : 
      'Please select a payment method:';
    
    const optionTexts = user.preferredLanguage === 'tamil' ? 
      [
        'பணம்',
        'ஆன்லைன்',
        'UPI'
      ] : 
      [
        'Cash on Delivery',
        'Card Payment',
        'UPI'
      ];
    
    agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
      whatsapp_type: 'buttons',
      text: paymentText,
      buttons: [
        { id: 'payment_COD', text: optionTexts[0] },
        { id: 'payment_ONLINE', text: optionTexts[1] },
        { id: 'payment_UPI', text: optionTexts[2] }
      ]
    }));
    return;
  }
  
  // Try to parse from text if still no payment method
  if (!selectedMethod) {
    const query = agent.query.toLowerCase();
    if (query.includes('cod') || query.includes('cash') || query.includes('delivery') || query.includes('1')) {
      selectedMethod = 'COD';
    } else if (query.includes('online') || query.includes('card') || query.includes('2')) {
      selectedMethod = 'ONLINE';
    } else if (query.includes('upi') || query.includes('gpay') || query.includes('paytm') || query.includes('3')) {
      selectedMethod = 'UPI';
    } else {
      // Default
      selectedMethod = 'COD';
    }
  }
  
  // Create order in database
  try {
    const order = new Order({
      userId: user._id,
      vendorId: vendor._id,
      items: user.cart.items,
      totalAmount: user.cart.total,
      deliveryFee: vendor.deliveryFee,
      grandTotal: user.cart.total + vendor.deliveryFee,
      deliveryAddress: {
        fullAddress: user.addresses[user.defaultAddressIndex].fullAddress,
        location: user.addresses[user.defaultAddressIndex].location
      },
      paymentMethod: selectedMethod,
      statusHistory: [{ status: 'PLACED', timestamp: new Date() }]
    });
    
    await order.save();
    
    // Clear user's cart
    user.cart = { items: [], total: 0 };
    await user.save();
    
    // Send confirmation
    const confirmationText = user.preferredLanguage === 'tamil' ? 
      `🎉 ஆர்டர் வெற்றிகரமாக வைக்கப்பட்டது! உங்கள் ஆர்டர் ஐடி: ${order._id}\n\nநன்றி! உங்கள் உணவு விரைவில் வரும்.` : 
      `🎉 Order successfully placed! Your order ID is: ${order._id}\n\nThank you! Your food will be on the way soon.`;
    
    agent.add(confirmationText);
    
    // Payment instructions based on method
    if (selectedMethod === 'ONLINE') {
      const paymentText = user.preferredLanguage === 'tamil' ? 
        'பணம் செலுத்த இந்த பொத்தானைக் கிளிக் செய்யவும்:' : 
        'Click this button to make the payment:';
      
      const payButtonText = user.preferredLanguage === 'tamil' ? 'இப்போது பணம் செலுத்து' : 'Pay Now';
      
      agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
        whatsapp_type: 'buttons',
        text: paymentText,
        buttons: [
          { id: `pay_order_${order._id}`, text: payButtonText }
        ]
      }));
    } else if (selectedMethod === 'UPI') {
      const upiText = user.preferredLanguage === 'tamil' ? 
        'UPI மூலம் பணம் செலுத்த இந்த பொத்தானைக் கிளிக் செய்யவும்:' : 
        'Click this button to pay via UPI:';
      
      const upiButtonText = user.preferredLanguage === 'tamil' ? 'UPI மூலம் பணம் செலுத்து' : 'Pay via UPI';
      
      agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
        whatsapp_type: 'buttons',
        text: upiText,
        buttons: [
          { id: `pay_upi_${order._id}`, text: upiButtonText }
        ]
      }));
    } else {
      // COD option
      const trackText = user.preferredLanguage === 'tamil' ? 
        'உங்கள் ஆர்டரை எப்போது வேண்டுமானாலும் பின்தொடரலாம்:' : 
        'You can track your order at any time:';
      
      const trackButtonText = user.preferredLanguage === 'tamil' ? 'ஆர்டர் நிலையைப் பார்க்க' : 'Check Order Status';
      
      agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
        whatsapp_type: 'buttons',
        text: trackText,
        buttons: [
          { id: `track_order_${order._id}`, text: trackButtonText }
        ]
      }));
    }
    
  } catch (error) {
    console.error('Error creating order:', error);
    agent.add('Sorry, we encountered an error while placing your order. Please try again.');
  }
},

// Check order status
checkOrderStatus: async (agent) => {
  const phoneNumber = getPhoneNumber(agent);
  const orderId = agent.parameters.order_id;
  
  const user = await User.findOne({ phoneNumber });
  if (!user) return agent.add('Sorry, something went wrong. Please try again.');
  
  try {
    let order;
    if (orderId) {
      order = await Order.findById(orderId).populate('vendorId');
    } else {
      // Get most recent order
      order = await Order.findOne({ userId: user._id })
        .sort({ createdAt: -1 })
        .populate('vendorId');
    }
    
    if (!order) {
      const noOrderText = user.preferredLanguage === 'tamil' ? 
        'ஆர்டர்கள் எதுவும் கிடைக்கவில்லை. புதிய ஆர்டரை வைக்க விரும்புகிறீர்களா?' : 
        'No orders found. Would you like to place a new order?';
      
      const optionTexts = user.preferredLanguage === 'tamil' ? 
        [
          'புதிய ஆர்டர்',
          'மீண்டும் முயற்சி'
        ] : 
        [
          'New Order',
          'Try Again'
        ];
      
      agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
        whatsapp_type: 'buttons',
        text: noOrderText,
        buttons: [
          { id: 'nearby_vendors', text: optionTexts[0] },
          { id: 'check_order_status', text: optionTexts[1] }
        ]
      }));
      return;
    }
    
    // Format order status with emoji indicators
    const statusEmoji = {
      'PLACED': '📝',
      'CONFIRMED': '✅',
      'PREPARING': '👨‍🍳',
      'OUT_FOR_DELIVERY': '🛵',
      'DELIVERED': '🎁',
      'CANCELLED': '❌'
    };
    
    const emoji = statusEmoji[order.orderStatus] || '📋';
    
    const statusText = user.preferredLanguage === 'tamil' ? 
      `*ஆர்டர் நிலை* ${emoji}\nஆர்டர் ஐடி: ${order._id}\nஉணவகம்: ${order.vendorId.businessName}\nநிலை: ${order.orderStatus}\nமொத்தம்: ₹${order.grandTotal}` : 
      `*Order Status* ${emoji}\nOrder ID: ${order._id}\nVendor: ${order.vendorId.businessName}\nStatus: ${order.orderStatus}\nTotal: ₹${order.grandTotal}`;
    
    agent.add(statusText);
    
    // Additional information based on status
    let additionalInfo = '';
    if (order.orderStatus === 'PLACED') {
      additionalInfo = user.preferredLanguage === 'tamil' ? 
        'உங்கள் ஆர்டர் வைக்கப்பட்டுள்ளது மற்றும் விற்பனையாளரிடமிருந்து உறுதிப்படுத்தலுக்காக காத்திருக்கிறது.' : 
        'Your order has been placed and is waiting for confirmation from the vendor.';
    } else if (order.orderStatus === 'CONFIRMED') {
      additionalInfo = user.preferredLanguage === 'tamil' ? 
        'உங்கள் ஆர்டர் உறுதிசெய்யப்பட்டது மற்றும் தயாரிக்கப்படுகிறது.' : 
        'Your order has been confirmed and is being prepared.';
    } else if (order.orderStatus === 'PREPARING') {
      additionalInfo = user.preferredLanguage === 'tamil' ? 
        'உங்கள் உணவு தயாரிக்கப்பட்டு விரைவில் டெலிவரிக்கு தயாராக இருக்கும்.' : 
        'Your food is being prepared and will be ready for delivery soon.';
    } else if (order.orderStatus === 'OUT_FOR_DELIVERY') {
      additionalInfo = user.preferredLanguage === 'tamil' ? 
        'உங்கள் உணவு வழியில் உள்ளது! இது விரைவில் உங்களை அடையும்.' : 
        'Your food is on the way! It should reach you shortly.';
    } else if (order.orderStatus === 'DELIVERED') {
      additionalInfo = user.preferredLanguage === 'tamil' ? 
        'உங்கள் ஆர்டர் டெலிவரி செய்யப்பட்டது. உங்கள் உணவை அனுபவிக்கவும்!' : 
        'Your order has been delivered. Enjoy your meal!';
    } else if (order.orderStatus === 'CANCELLED') {
      additionalInfo = user.preferredLanguage === 'tamil' ? 
        'உங்கள் ஆர்டர் ரத்து செய்யப்பட்டது. உதவி தேவைப்பட்டால் ஆதரவைத் தொடர்பு கொள்ளவும்.' : 
        'Your order was cancelled. Please contact support if you need assistance.';
    }
    
    agent.add(additionalInfo);
    
    // Add track/reorder options
    const optionsText = user.preferredLanguage === 'tamil' ? 
      'என்ன செய்ய விரும்புகிறீர்கள்?' : 
      'What would you like to do?';
    
    const optionTexts = user.preferredLanguage === 'tamil' ? 
      [
        'மீண்டும் ஆர்டர்',
        'புதிய ஆர்டர்'
      ] : 
      [
        'Reorder',
        'New Order'
      ];
    
    agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
      whatsapp_type: 'buttons',
      text: optionsText,
      buttons: [
        { id: `reorder_${order._id}`, text: optionTexts[0] },
        { id: 'nearby_vendors', text: optionTexts[1] }
      ]
    }));
    
  } catch (error) {
    console.error('Error checking order status:', error);
    agent.add('Sorry, we encountered an error while checking your order status. Please try again.');
  }
},

// View order history
viewOrderHistory: async (agent) => {
  const phoneNumber = getPhoneNumber(agent);
  
  const user = await User.findOne({ phoneNumber });
  if (!user) return agent.add('Sorry, something went wrong. Please try again.');
  
  try {
    // Get recent orders
    const orders = await Order.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('vendorId');
    
    if (!orders || orders.length === 0) {
      const noOrdersText = user.preferredLanguage === 'tamil' ? 
        'உங்களிடம் முந்தைய ஆர்டர்கள் எதுவும் இல்லை. புதிய ஆர்டரை வைக்க விரும்புகிறீர்களா?' : 
        'You have no previous orders. Would you like to place a new order?';
      
      agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
        whatsapp_type: 'buttons',
        text: noOrdersText,
        buttons: [
          { id: 'nearby_vendors', text: user.preferredLanguage === 'tamil' ? 'புதிய ஆர்டர்' : 'New Order' }
        ]
      }));
      return;
    }
    
    // Format order history
    const historyText = user.preferredLanguage === 'tamil' ? 
      `*முந்தைய ஆர்டர்கள்*\nஉங்கள் சமீபத்திய ${orders.length} ஆர்டர்கள்:` : 
      `*Previous Orders*\nYour most recent ${orders.length} orders:`;
    
    agent.add(historyText);
    
    // Add each order details
    let orderDetails = '';
    orders.forEach((order, index) => {
      const orderDate = new Date(order.createdAt).toLocaleDateString();
      orderDetails += `${index + 1}. ${orderDate} - ${order.vendorId.businessName}\n`;
      orderDetails += `   Status: ${order.orderStatus} - ₹${order.grandTotal}\n`;
      orderDetails += `   Order ID: ${order._id}\n\n`;
    });
    
    agent.add(orderDetails);
    
    // Create a list of orders that can be selected
    const orderItems = orders.map(order => {
      const orderDate = new Date(order.createdAt).toLocaleDateString();
      return {
        id: `order_${order._id}`,
        title: `${orderDate} - ${order.vendorId.businessName}`,
        description: `${order.orderStatus} - ₹${order.grandTotal}`
      };
    });
    
    const viewDetailsText = user.preferredLanguage === 'tamil' ? 
      'விவரங்களைப் பார்க்க ஆர்டரைத் தேர்ந்தெடுக்கவும்:' : 
      'Select an order to view details:';
    
    agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
      whatsapp_type: 'list',
      text: viewDetailsText,
      button: user.preferredLanguage === 'tamil' ? 'பார்க்க' : 'View',
      sectionTitle: user.preferredLanguage === 'tamil' ? 'முந்தைய ஆர்டர்கள்' : 'Previous Orders',
      items: orderItems
    }));
    
  } catch (error) {
    console.error('Error fetching order history:', error);
    agent.add('Sorry, we encountered an error while fetching your order history. Please try again.');
  }
},

// Help intent
help: async (agent) => {
  const phoneNumber = getPhoneNumber(agent);
  
  // Get user for language preference
  const user = await User.findOne({ phoneNumber }).catch(() => null);
  const language = user?.preferredLanguage || 'english';
  
  const helpText = language === 'tamil' ? 
    '*TamilFoods உதவி*\n\nஇது ஒரு உணவு டெலிவரி பாட். நீங்கள் பின்வரும் செயல்களைச் செய்யலாம்:' : 
    '*TamilFoods Help*\n\nThis is a food delivery bot. You can perform the following actions:';
  
  agent.add(helpText);
  
  const commands = language === 'tamil' ? 
    [
      '1. அருகிலுள்ள உணவகங்கள் - உங்கள் அருகிலுள்ள உணவகங்களைக் காட்டும்',
      '2. உணவைத் தேடு - குறிப்பிட்ட உணவைத் தேடும்',
      '3. எனது ஆர்டர்கள் - முந்தைய ஆர்டர்களைக் காட்டும்',
      '4. ஆர்டர் நிலை - உங்கள் தற்போதைய ஆர்டரின் நிலையைச் சரிபார்க்கும்'
    ] : 
    [
      '1. Nearby Home Cooks - Shows home cooks near your location',
      '2. Search Food - Search for specific food items',
      '3. My Orders - View your previous orders',
      '4. Order Status - Check the status of your current order'
    ];
  
  // Add all commands as a single message to avoid cluttering the chat
  agent.add(commands.join('\n'));
  
  // Provide options buttons
  const optionsText = language === 'tamil' ? 
    'என்ன செய்ய விரும்புகிறீர்கள்?' : 
    'What would you like to do?';
  
  const optionTexts = language === 'tamil' ? 
    [
      'அருகிலுள்ள உணவகங்கள்',
      'உணவைத் தேடு',
      'எனது ஆர்டர்கள்'
    ] : 
    [
      'Nearby Home Cooks',
      'Search Food',
      'My Orders'
    ];
  
  agent.add(new agent.Payload('PLATFORM_UNSPECIFIED', {
    whatsapp_type: 'buttons',
    text: optionsText,
    buttons: [
      { id: 'nearby_vendors', text: optionTexts[0] },
      { id: 'search_food', text: optionTexts[1] },
      { id: 'my_orders', text: optionTexts[2] }
    ]
  }));
}

}

module.exports  = intentHandlers