const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const PaymentController = require('../controllers/PaymentController');
const WhatsAppService = require('./WhatsAppService');
const {WebhookClient, Payload } = require('dialogflow-fulfillment');


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
    let payload;
    // Find or create user
    let user = await User.findOne({ phoneNumber });
    
    if (!user) {
      user = new User({ phoneNumber });
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
      console.log('====================================');
      console.log('agent,{depth:null}====================================');
      console.dir(agent, { depth: null });
      
      agent.add(new Payload('PLATFORM_UNSPECIFIED', languagePayload));
      payload = languagePayload;
      return languagePayload
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
        payload = menuPayload
        agent.add(new Payload('PLATFORM_UNSPECIFIED', menuPayload));
        return payload
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
      'நாங்கள் உங்கள் இருப்பிடத்தைப் பெற்றால், அருகிலுள்ள உணவகங்களைக் காண்பிக்க முடியும். தயவுசெய்து உங்கள் இருப்பிடத்தைப் பகிரவும்:' : 
      'We can show you nearby home cooks if we have your location. Please share your location:';
    
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
    const latitude = agent.parameters.latitude;
    const longitude = agent.parameters.longitude;
    
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
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    // Ensure user has a location
    if (!user.addresses || user.addresses.length === 0) {
      const locationText = user.preferredLanguage === 'tamil' ? 
        'உங்கள் இருப்பிடத்தைப் பகிர்ந்து கொள்ளுங்கள்:' : 
        'Please share your location first:';
      
      return agent.add({
        payload: {
          whatsapp_type: 'location_request_message',
          text: locationText
        }
      });
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
    
    // Show results
    const resultsText = user.preferredLanguage === 'tamil' ? 
      `நாங்கள் ${vendorItems.length} "${foodItem}" பொருட்களைக் கண்டுபிடித்தோம். ஒன்றைத் தேர்ந்தெடுக்கவும்:` : 
      `We found ${vendorItems.length} "${foodItem}" items. Select one to view details:`;
    
    const buttonText = user.preferredLanguage === 'tamil' ? 'பார்க்க' : 'View';
    const sectionTitle = user.preferredLanguage === 'tamil' ? 'கிடைக்கும் உணவு' : 'Available Items';
    
    agent.add({
      payload: {
        whatsapp_type: 'list',
        text: resultsText,
        button: buttonText,
        sectionTitle: sectionTitle,
        items: vendorItems.slice(0, 10) // WhatsApp limits to 10 items
      }
    });
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
        'Please share your location first:';
      
      return agent.add({
        payload: {
          whatsapp_type: 'location_request_message',
          text: locationText
        }
      });
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
    
    // Show results
    const resultsText = user.preferredLanguage === 'tamil' ? 
      `உங்களுக்கு அருகில் ${vendors.length} உணவகங்கள் கண்டுபிடிக்கப்பட்டன. ஒன்றைத் தேர்ந்தெடுக்கவும்:` : 
      `We found ${vendors.length} home cooks near you. Select one to view their menu:`;
    
    const buttonText = user.preferredLanguage === 'tamil' ? 'பார்க்க' : 'View';
    const sectionTitle = user.preferredLanguage === 'tamil' ? 'அருகிலுள்ள உணவகங்கள்' : 'Nearby Home Cooks';
    
    agent.add({
      payload: {
        whatsapp_type: 'list',
        text: resultsText,
        button: buttonText,
        sectionTitle: sectionTitle,
        items: vendorList
      }
    });
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
    
    agent.add({
      payload: {
        whatsapp_type: 'list',
        text: menuText,
        button: buttonText,
        sectionTitle: sectionTitle,
        items: categoriesList
      }
    });
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
    
    agent.add({
      payload: {
        whatsapp_type: 'list',
        text: menuText,
        button: buttonText,
        sectionTitle: sectionTitle,
        items: itemsList
      }
    });
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
    
    agent.add({
      payload: {
        whatsapp_type: 'buttons',
        text: cartText,
        buttons: [
          { id: 'add_more', text: optionTexts[0] },
          { id: 'view_cart', text: optionTexts[1] },
          { id: 'checkout', text: optionTexts[2] }
        ]
      }
    });
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
    
    agent.add({
      payload: {
        whatsapp_type: 'buttons',
        text: optionsText,
        buttons: [
          { id: 'add_more', text: optionTexts[0] },
          { id: 'clear_cart', text: optionTexts[1] },
          { id: 'checkout', text: optionTexts[2] }
        ]
      }
    });
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
      
      return agent.add({
        payload: {
          whatsapp_type: 'location_request_message',
          text: noAddressText
        }
      });
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
    
    agent.add({
      payload: {
        whatsapp_type: 'buttons',
        text: addressText,
        buttons: [
          { id: 'confirm_address', text: confirmTexts[0] },
          { id: 'new_address', text: confirmTexts[1] }
        ]
      }
    });
  },
  
  // Confirm delivery address
  confirmAddress: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    if (!user.cart || !user.cart.vendorId || !user.cart.items || user.cart.items.length === 0) {
      return agent.add('Your cart is empty. Please add some items first.');
    }
    
    // At this point, the address is confirmed, ask for payment method
    const paymentText = user.preferredLanguage === 'tamil' ? 
      'உங்கள் ஆர்டருக்கு எவ்வாறு பணம் செலுத்த விரும்புகிறீர்கள்?' : 
      'How would you like to pay for your order?';
    
    const paymentOptions = user.preferredLanguage === 'tamil' ? 
      [
        'பணம் கொடுப்பு டெலிவரி',
        'ஆன்லைன் பணம் செலுத்துதல்',
        'UPI'
      ] : 
      [
        'Cash on Delivery',
        'Online Payment',
        'UPI'
      ];
    
    agent.add({
      payload: {
        whatsapp_type: 'buttons',
        text: paymentText,
        buttons: [
          { id: 'payment_COD', text: paymentOptions[0] },
          { id: 'payment_ONLINE', text: paymentOptions[1] },
          { id: 'payment_UPI', text: paymentOptions[2] }
        ]
      }
    });
  },
  
  // Select payment method
  selectPaymentMethod: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    const paymentMethod = agent.parameters.payment_method;
    
    if (!paymentMethod) {
      return agent.add('Please select a payment method to proceed.');
    }
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    if (!user.cart || !user.cart.vendorId || !user.cart.items || user.cart.items.length === 0) {
      return agent.add('Your cart is empty. Please add some items first.');
    }
    
    if (!user.addresses || user.addresses.length === 0) {
      return agent.add('Please provide a delivery address first.');
    }
    
    // Get vendor details
    const vendor = await Vendor.findById(user.cart.vendorId);
    if (!vendor) {
      return agent.add('Sorry, the selected home cook is no longer available.');
    }
    
    // Ask for special instructions (optional)
    const instructionsText = user.preferredLanguage === 'tamil' ? 
      'இந்த ஆர்டருக்கு ஏதேனும் சிறப்பு அறிவுறுத்தல்கள் உள்ளதா? (அறிவுறுத்தல்களுடன் பதிலளிக்கவும் அல்லது "இல்லை" என பதிலளிக்கவும்)' : 
      'Any special instructions for this order? (Reply with instructions or "no")';
    
    // Save payment method to session for later use
    user.conversationState.data.set('paymentMethod', paymentMethod);
    await user.save();
    
    agent.add(instructionsText);
  },
  
  // Process special instructions and create order
  processInstructions: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    const instructions = agent.query; // Raw text input from user
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    if (!user.cart || !user.cart.vendorId || !user.cart.items || user.cart.items.length === 0) {
      return agent.add('Your cart is empty. Please add some items first.');
    }
    
    // Get saved payment method
    const paymentMethod = user.conversationState.data.get('paymentMethod');
    if (!paymentMethod) {
      return agent.add('Please select a payment method first.');
    }
    
    // Get vendor details
    const vendor = await Vendor.findById(user.cart.vendorId);
    if (!vendor) {
      return agent.add('Sorry, the selected home cook is no longer available.');
    }
    
    // Get delivery address
    const deliveryAddress = user.addresses[user.defaultAddressIndex];
    
    // Calculate totals
    const totalAmount = user.cart.total;
    const deliveryFee = vendor.deliveryFee;
    const grandTotal = totalAmount + deliveryFee;
    
    // Create new order
    const order = new Order({
      userId: user._id,
      vendorId: vendor._id,
      items: user.cart.items,
      totalAmount,
      deliveryFee,
      grandTotal,
      deliveryAddress: deliveryAddress,
      paymentMethod,
      specialInstructions: instructions !== 'no' ? instructions : '',
      statusHistory: [{ status: 'PLACED', timestamp: new Date() }]
    });
    
    await order.save();
    
    // Clear user's cart
    user.cart = { items: [], total: 0 };
    await user.save();
    
    // Send order confirmation
    await WhatsAppService.sendOrderConfirmation(user.phoneNumber, order);
    
    // If online payment, generate payment link
    if (paymentMethod === 'ONLINE' || paymentMethod === 'UPI') {
      // Generate payment link using Razorpay
      try {
        const paymentData = await PaymentController.createPaymentInternal(order._id);
        
        // Send payment link to user
        await WhatsAppService.sendPaymentLink(
          user.phoneNumber, 
          order, 
          paymentData.paymentLink
        );
        
        const paymentText = user.preferredLanguage === 'tamil' ? 
          'பணம் செலுத்தும் இணைப்பை உங்களுக்கு அனுப்பியுள்ளோம். உங்கள் ஆர்டர் பணம் செலுத்தப்பட்டதும் செயலாக்கப்படும்.' : 
          'We\'ve sent you a payment link. Your order will be processed once payment is complete.';
        
        agent.add(paymentText);
      } catch (error) {
        console.error('Error generating payment link:', error);
        
        const errorText = user.preferredLanguage === 'tamil' ? 
          'பணம் செலுத்தும் இணைப்பை உருவாக்குவதில் சிக்கல் ஏற்பட்டது. தயவுசெய்து மீண்டும் முயற்சிக்கவும் அல்லது வேறு பணம் செலுத்தும் முறையைத் தேர்ந்தெடுக்கவும்.' : 
          'There was an issue generating the payment link. Please try again or choose a different payment method.';
        
        agent.add(errorText);
      }
    } else {
      // For COD, just confirm the order
      const confirmText = user.preferredLanguage === 'tamil' ? 
        `உங்கள் ஆர்டர் வெற்றிகரமாக வைக்கப்பட்டது. உங்கள் ஆர்டர் ஐடி: ${order._id}. ஆர்டர் நிலையை அறிய 'எனது ஆர்டர்கள்' என்பதைத் தேர்ந்தெடுக்கவும்.` : 
        `Your order has been successfully placed. Your order ID is: ${order._id}. Select 'My Orders' to check order status.`;
      
      agent.add(confirmText);
    }
  },
  
  // Check order status
  checkOrderStatus: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    const orderId = agent.parameters.order_id;
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    // If specific order ID is provided
    if (orderId) {
      const order = await Order.findById(orderId).populate('vendorId', 'businessName');
      
      if (!order) {
        return agent.add('Sorry, we couldn\'t find that order. Please check the order ID and try again.');
      }
      
      if (order.userId.toString() !== user._id.toString()) {
        return agent.add('This order doesn\'t belong to your account.');
      }
      
      // Format order details
      const formattedDate = new Date(order.createdAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      
      const statusEmoji = {
        'PLACED': '🕐',
        'CONFIRMED': '🍽️',
        'PREPARING': '👨‍🍳',
        'OUT_FOR_DELIVERY': '🛵',
        'DELIVERED': '✅',
        'CANCELLED': '❌'
      };
      
      let orderDetails = `*Order #${order._id}*\n`;
      orderDetails += `From: ${order.vendorId.businessName}\n`;
      orderDetails += `Status: ${statusEmoji[order.orderStatus]} ${order.orderStatus}\n`;
      orderDetails += `Placed: ${formattedDate}\n\n`;
      
      orderDetails += `*Items:*\n`;
      order.items.forEach(item => {
        orderDetails += `• ${item.quantity}x ${item.name} - ₹${item.price * item.quantity}\n`;
      });
      
      orderDetails += `\nTotal: ₹${order.grandTotal}\n`;
      orderDetails += `Payment: ${order.paymentStatus === 'PAID' ? 'PAID' : 'PENDING'} via ${order.paymentMethod}\n`;
      
      if (order.estimatedDeliveryTime) {
        const estimatedTime = new Date(order.estimatedDeliveryTime).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        orderDetails += `\nEstimated Delivery: ${estimatedTime}`;
      }
      
      agent.add(orderDetails);
      
    } else {
      // Show list of recent orders
      const recentOrders = await Order.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('vendorId', 'businessName');
      
      if (recentOrders.length === 0) {
        const noOrdersText = user.preferredLanguage === 'tamil' ? 
          'உங்களிடம் முந்தைய ஆர்டர்கள் எதுவும் இல்லை.' : 
          'You don\'t have any previous orders.';
        
        return agent.add(noOrdersText);
      }
      
      const statusEmoji = {
        'PLACED': '🕐',
        'CONFIRMED': '🍽️',
        'PREPARING': '👨‍🍳',
        'OUT_FOR_DELIVERY': '🛵',
        'DELIVERED': '✅',
        'CANCELLED': '❌'
      };
      
      let orderListText = user.preferredLanguage === 'tamil' ? 
        'உங்கள் சமீபத்திய ஆர்டர்கள்:' : 
        'Here are your recent orders:';
      
      const orderItems = recentOrders.map(order => {
        const timeAgo = getTimeAgo(order.createdAt, user.preferredLanguage);
        
        return {
          id: `order:${order._id}`,
          title: `Order #${order._id.toString().substring(order._id.toString().length - 6)} - ${order.vendorId.businessName}`,
          description: `${statusEmoji[order.orderStatus]} ${order.orderStatus} (${timeAgo})`
        };
      });
      
      const buttonText = user.preferredLanguage === 'tamil' ? 'பார்க்க' : 'View';
      const sectionTitle = user.preferredLanguage === 'tamil' ? 'எனது ஆர்டர்கள்' : 'My Orders';
      
      agent.add({
        payload: {
          whatsapp_type: 'list',
          text: orderListText,
          button: buttonText,
          sectionTitle: sectionTitle,
          items: orderItems
        }
      });
    }
  },
  
  // View order history
  viewOrderHistory: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    // Same implementation as checkOrderStatus without order_id
    // Show list of recent orders
    const recentOrders = await Order.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('vendorId', 'businessName');
    
    if (recentOrders.length === 0) {
      const noOrdersText = user.preferredLanguage === 'tamil' ? 
        'உங்களிடம் முந்தைய ஆர்டர்கள் எதுவும் இல்லை.' : 
        'You don\'t have any previous orders.';
      
      return agent.add(noOrdersText);
    }
    
    const statusEmoji = {
      'PLACED': '🕐',
      'CONFIRMED': '🍽️',
      'PREPARING': '👨‍🍳',
      'OUT_FOR_DELIVERY': '🛵',
      'DELIVERED': '✅',
      'CANCELLED': '❌'
    };
    
    let orderListText = user.preferredLanguage === 'tamil' ? 
      'உங்கள் சமீபத்திய ஆர்டர்கள்:' : 
      'Here are your recent orders:';
    
    const orderItems = recentOrders.map(order => {
      const timeAgo = getTimeAgo(order.createdAt, user.preferredLanguage);
      
      return {
        id: `order:${order._id}`,
        title: `Order #${order._id.toString().substring(order._id.toString().length - 6)} - ${order.vendorId.businessName}`,
        description: `${statusEmoji[order.orderStatus]} ${order.orderStatus} (${timeAgo})`
      };
    });
    
    const buttonText = user.preferredLanguage === 'tamil' ? 'பார்க்க' : 'View';
    const sectionTitle = user.preferredLanguage === 'tamil' ? 'எனது ஆர்டர்கள்' : 'My Orders';
    
    agent.add({
      payload: {
        whatsapp_type: 'list',
        text: orderListText,
        button: buttonText,
        sectionTitle: sectionTitle,
        items: orderItems
      }
    });
  },
  
  // Help menu
  help: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    const helpMenuText = user.preferredLanguage === 'tamil' ? 
      'நான் எவ்வாறு உதவ முடியும்?' : 
      'How can I help you today?';
    
    const helpOptions = user.preferredLanguage === 'tamil' ? 
      [
        'எப்படி ஆர்டர் செய்வது',
        'பணம் செலுத்தும் விருப்பங்கள்',
        'டெலிவரி பகுதிகள்',
        'ஆதரவு தொடர்பு கொள்ளவும்'
      ] : 
      [
        'How to Order',
        'Payment Options',
        'Delivery Areas',
        'Contact Support'
      ];
    
    agent.add({
      payload: {
        whatsapp_type: 'buttons',
        text: helpMenuText,
        buttons: [
          { id: 'help_ordering', text: helpOptions[0] },
          { id: 'help_payment', text: helpOptions[1] },
          { id: 'help_delivery', text: helpOptions[2] }
        ]
      }
    });
  },
  
  // Help with ordering
  helpOrdering: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    const orderingGuide = user.preferredLanguage === 'tamil' ? 
      `*எப்படி ஆர்டர் செய்வது:*
1. உங்கள் இருப்பிடத்தைப் பகிரவும் அல்லது உணவைத் தேடவும்
2. அருகிலுள்ள சமையல்காரர்கள் அல்லது உணவு பொருட்களை உலாவவும்
3. பொருட்களைத் தேர்ந்தெடுத்து கார்ட்டில் சேர்க்கவும்
4. செக்அவுட் செய்து பணம் செலுத்தும் முறையைத் தேர்ந்தெடுக்கவும்
5. உங்கள் ஆர்டர் நிலையை நிகழ்நேரத்தில் கண்காணிக்கவும்

மேலும் உதவி தேவையா?` : 
      `*How to Order:*
1. Share your location or search for food
2. Browse nearby home cooks or food items
3. Select items and add to cart
4. Checkout and select payment method
5. Track your order status in real-time

Need more help?`;
    
    agent.add(orderingGuide);
    
    const buttonTexts = user.preferredLanguage === 'tamil' ? 
      [
        'மெனுவுக்குத் திரும்பு',
        'ஆதரவை தொடர்பு கொள்ளவும்'
      ] : 
      [
        'Back to Menu',
        'Contact Support'
      ];
    
    agent.add({
      payload: {
        whatsapp_type: 'buttons',
        text: 'Need more help?',
        buttons: [
          { id: 'back_to_menu', text: buttonTexts[0] },
          { id: 'contact_support', text: buttonTexts[1] }
        ]
      }
    });
  },
  
  // Help with payment options
  helpPayment: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    const paymentGuide = user.preferredLanguage === 'tamil' ? 
      `*பணம் செலுத்தும் விருப்பங்கள்:*
1. பணம் கொடுப்பு டெலிவரி - உணவு டெலிவரியின் போது பணம் செலுத்தவும்
2. ஆன்லைன் பணம் செலுத்துதல் - கிரெடிட்/டெபிட் கார்டுகள், நெட்பேங்கிங் மூலம்
3. UPI - Google Pay, PhonePe, BHIM போன்ற UPI பயன்பாடுகள் மூலம்

ஆன்லைன் பணம் செலுத்துதல் அல்லது UPI ஐத் தேர்ந்தெடுக்கும்போது, உங்களுக்கு ஒரு பணம் செலுத்தும் இணைப்பு அனுப்பப்படும்.` : 
      `*Payment Options:*
1. Cash on Delivery - Pay with cash upon delivery
2. Online Payment - Pay using credit/debit cards, netbanking
3. UPI - Pay using UPI apps like Google Pay, PhonePe, BHIM

When selecting Online Payment or UPI, a payment link will be sent to you.`;
    
    agent.add(paymentGuide);
    
    const buttonTexts = user.preferredLanguage === 'tamil' ? 
      [
        'மெனுவுக்குத் திரும்பு',
        'ஆதரவை தொடர்பு கொள்ளவும்'
      ] : 
      [
        'Back to Menu',
        'Contact Support'
      ];
    
    agent.add({
      payload: {
        whatsapp_type: 'buttons',
        text: 'Need more help?',
        buttons: [
          { id: 'back_to_menu', text: buttonTexts[0] },
          { id: 'contact_support', text: buttonTexts[1] }
        ]
      }
    });
  },
  
  // Help with delivery areas
  helpDelivery: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    const deliveryGuide = user.preferredLanguage === 'tamil' ? 
      `*டெலிவரி தகவல்:*
- டெலிவரி பகுதிகள்: நாங்கள் பொதுவாக உங்கள் இருப்பிடத்திலிருந்து 5 கி.மீ தூரத்திற்குள் உள்ள சமையல்காரர்களை காட்டுகிறோம்
- டெலிவரி நேரம்: சராசரியாக 45-60 நிமிடங்கள் (இடம் மற்றும் ஆர்டரைப் பொறுத்து மாறலாம்)
- டெலிவரி கட்டணம்: ஒவ்வொரு சமையல்காரருக்கும் வேறுபடுகிறது, பொதுவாக ₹30-50 இடையே

ஆர்டர் வைக்கப்பட்டதும், டெலிவரி நிலை தொடர்பான புதுப்பிப்புகளுக்கு WhatsApp அறிவிப்புகளைப் பெறுவீர்கள்.` : 
      `*Delivery Information:*
- Delivery Areas: We typically show home cooks within 5 km of your location
- Delivery Time: Average 45-60 minutes (may vary depending on location and order)
- Delivery Fee: Varies by home cook, typically between ₹30-50

Once your order is placed, you'll receive WhatsApp notifications for delivery status updates.`;
    
    agent.add(deliveryGuide);
    
    const buttonTexts = user.preferredLanguage === 'tamil' ? 
      [
        'மெனுவுக்குத் திரும்பு',
        'ஆதரவை தொடர்பு கொள்ளவும்'
      ] : 
      [
        'Back to Menu',
        'Contact Support'
      ];
    
    agent.add({
      payload: {
        whatsapp_type: 'buttons',
        text: 'Need more help?',
        buttons: [
          { id: 'back_to_menu', text: buttonTexts[0] },
          { id: 'contact_support', text: buttonTexts[1] }
        ]
      }
    });
  },
  
  // Contact support
  contactSupport: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    const supportText = user.preferredLanguage === 'tamil' ? 
      `*ஆதரவு தொடர்பு:*
ஏதேனும் பிரச்சனைகள் அல்லது கேள்விகளுக்கு, எங்கள் ஆதரவு குழுவைத் தொடர்பு கொள்ளவும்:

📞 ஆதரவு எண்: +91 98765 43210
✉️ மின்னஞ்சல்: support@tamilfoods.com

ஆதரவு நேரங்கள்: காலை 9 மணி முதல் இரவு 9 மணி வரை, வாரத்தின் 7 நாட்களும்` : 
      `*Contact Support:*
For any issues or questions, contact our support team:

📞 Support Number: +91 98765 43210
✉️ Email: support@tamilfoods.com

Support Hours: 9 AM to 9 PM, 7 days a week`;
    
    agent.add(supportText);
    
    const backText = user.preferredLanguage === 'tamil' ? 'மெனுவுக்குத் திரும்பு' : 'Back to Menu';
    
    agent.add({
      payload: {
        whatsapp_type: 'buttons',
        text: 'Can I help you with anything else?',
        buttons: [
          { id: 'back_to_menu', text: backText }
        ]
      }
    });
  },
  
  // Return to main menu
  backToMenu: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
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
    
    agent.add({
      payload: {
        whatsapp_type: 'buttons',
        text: menuText,
        buttons: [
          { id: 'nearby_vendors', text: optionTexts[0] },
          { id: 'search_food', text: optionTexts[1] },
          { id: 'my_orders', text: optionTexts[2] }
        ]
      }
    });
  }
};

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

// Helper function to format time ago
function getTimeAgo(timestamp, language) {
  const now = new Date();
  const diff = now - new Date(timestamp);
  
  // Convert diff to minutes, hours, days
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (language === 'tamil') {
    if (minutes < 1) return 'இப்போது';
    if (minutes < 60) return `${minutes} நிமிடங்களுக்கு முன்`;
    if (hours < 24) return `${hours} மணிநேரத்திற்கு முன்`;
    return `${days} நாட்களுக்கு முன்`;
  } else {
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} mins ago`;
    if (hours < 24) return `${hours} hours ago`;
    return `${days} days ago`;
  }
}

module.exports = intentHandlers;