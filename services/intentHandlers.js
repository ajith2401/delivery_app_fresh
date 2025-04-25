// ==== FILE: services/intentHandlers.js ====
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const PaymentController = require('../controllers/PaymentController');

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

// Helper function to safely access phone number
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
    console.log('Welcome intent triggered');
    
    // Get phone number
    const phoneNumber = getPhoneNumber(agent);
    console.log('Phone number:', phoneNumber);
    
    // Find or create user
    let user = await User.findOne({ phoneNumber });
    
    if (!user) {
      user = new User({ phoneNumber });
      await user.save();
      
      // First-time user - use standard text for Dialogflow
      agent.add('வணக்கம்! Welcome to TamilFoods! 🍲');
      agent.add('I can help you order delicious home-cooked food from nearby cooks.');
      agent.add('Please type "English" or "Tamil" to select your preferred language.');
    } else {
      // Returning user - THIS is where the issue is
      const greeting = user.preferredLanguage === 'tamil' ? 
        'வணக்கம்! மீண்டும் வருக! 🍲' : 
        'Welcome back to TamilFoods! 🍲';
      
      // Instead of adding multiple separate text messages, use payload for buttons
      agent.add(greeting);
      
      // Use this format for WhatsApp buttons
      agent.add({
        payload: {
          whatsapp_type: 'buttons',
          text: user.preferredLanguage === 'tamil' ? 
            'நான் எப்படி உதவ முடியும்?' :
            'How can I help you today?',
          buttons: [
            { id: 'nearby_vendors', text: user.preferredLanguage === 'tamil' ? 'அருகிலுள்ள உணவகங்கள்' : 'Nearby Home Cooks' },
            { id: 'search_food', text: user.preferredLanguage === 'tamil' ? 'உணவைத் தேடு' : 'Search Food' },
            { id: 'my_orders', text: user.preferredLanguage === 'tamil' ? 'எனது ஆர்டர்கள்' : 'My Orders' }
          ]
        }
      });
    }
  },
  
  // Set language preference
  setLanguage: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    let language = agent.parameters.language || '';
    
    // Handle text input like "English" or "Tamil"
    if (!language) {
      const query = agent.query.toLowerCase();
      if (query.includes('english')) {
        language = 'english';
      } else if (query.includes('tamil') || query.includes('தமிழ்')) {
        language = 'tamil';
      } else {
        language = 'english'; // Default
      }
    }
    
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
      'நாங்கள் உங்கள் இருப்பிடத்தைப் பெற்றால், அருகிலுள்ள உணவகங்களைக் காண்பிக்க முடியும். Please share your location by typing an address, or share your location using WhatsApp.' : 
      'We can show you nearby home cooks if we have your location. Please share your location by typing an address, or share your location using WhatsApp.';
    
    agent.add(locationText);
  },
  
  // Process location shared by user
  processLocation: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    let latitude = agent.parameters.latitude;
    let longitude = agent.parameters.longitude;
    
    // Try to parse location data from different formats
    if (!latitude || !longitude) {
      try {
        if (agent.originalRequest && 
            agent.originalRequest.payload && 
            agent.originalRequest.payload.data && 
            agent.originalRequest.payload.data.location) {
          latitude = agent.originalRequest.payload.data.location.latitude;
          longitude = agent.originalRequest.payload.data.location.longitude;
        }
      } catch (error) {
        console.log('Error parsing location data:', error);
      }
    }
    
    if (!latitude || !longitude) {
      return agent.add('Please share your location to continue. You can type an address or use WhatsApp\'s location sharing feature.');
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
      'உங்கள் இருப்பிடம் சேமிக்கப்பட்டது! நான் எப்படி உதவ முடியும்? Type a number to select:' :
      'Location saved! How can I help you today? Type a number to select:';
    
    agent.add(menuText);
    
    const optionTexts = user.preferredLanguage === 'tamil' ? 
      [
        '1: அருகிலுள்ள உணவகங்கள்',
        '2: உணவைத் தேடு',
        '3: எனது ஆர்டர்கள்',
        '4: உதவி'
      ] : 
      [
        '1: Nearby Home Cooks',
        '2: Search Food',
        '3: My Orders',
        '4: Help'
      ];
    
    // Add each option as a separate message
    optionTexts.forEach(option => agent.add(option));
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
      
      return agent.add(locationText);
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
      `We found ${vendorItems.length} "${foodItem}" items. Select one by typing its number:`;
    
    agent.add(resultsText);
    
    // Add items as numbered list
    vendorItems.slice(0, 10).forEach((item, index) => {
      agent.add(`${index + 1}: ${item.title} - ${item.description}`);
    });
    
    // Store items in user context for later selection
    user.conversationState = {
      context: 'food_selection',
      data: vendorItems.slice(0, 10)
    };
    await user.save();
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
      
      return agent.add(locationText);
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
      // Calculate distance
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
      `We found ${vendors.length} home cooks near you. Select one by typing its number:`;
    
    agent.add(resultsText);
    
    // Add vendors as numbered list
    vendorList.forEach((vendor, index) => {
      agent.add(`${index + 1}: ${vendor.title} - ${vendor.description}`);
    });
    
    // Store vendors in user context for later selection
    user.conversationState = {
      context: 'vendor_selection',
      data: vendorList
    };
    await user.save();
  },
  
  // Select vendor and show menu
  selectVendor: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    const vendorId = agent.parameters.vendor_id;
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    // Try to get vendor ID from input if not in parameters
    let selectedVendorId = vendorId;
    if (!selectedVendorId && user.conversationState && user.conversationState.context === 'vendor_selection') {
      const vendorIndex = parseInt(agent.query) - 1;
      if (vendorIndex >= 0 && vendorIndex < user.conversationState.data.length) {
        selectedVendorId = user.conversationState.data[vendorIndex].id;
      }
    }
    
    if (!selectedVendorId) {
      return agent.add('Please select a home cook by typing its number.');
    }
    
    // Get vendor details
    const vendor = await Vendor.findById(selectedVendorId);
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
    if (user.cart && user.cart.vendorId && user.cart.vendorId.toString() !== selectedVendorId) {
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
      'பின்வரும் வகைகளிலிருந்து தேர்ந்தெடுக்கவும். Type a number to select:' : 
      'Select from the following categories. Type a number to select:';
    
    agent.add(menuText);
    
    // Add categories as numbered list
    categoriesList.forEach((category, index) => {
      agent.add(`${index + 1}: ${category.title} (${category.description})`);
    });
    
    // Store categories in user context for later selection
    user.conversationState = {
      context: 'category_selection',
      data: categoriesList
    };
    await user.save();
  },
  
  // Browse menu items in a category
  browseMenu: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    let categoryInput = agent.parameters.category;
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    // Try to get category from input if not in parameters
    let selectedCategory = categoryInput;
    if (!selectedCategory && user.conversationState && user.conversationState.context === 'category_selection') {
      const categoryIndex = parseInt(agent.query) - 1;
      if (categoryIndex >= 0 && categoryIndex < user.conversationState.data.length) {
        selectedCategory = user.conversationState.data[categoryIndex].id;
      }
    }
    
    if (!selectedCategory) {
      return agent.add('Please select a category by typing its number.');
    }
    
    // Extract category name from the format "category:CategoryName"
    const category = selectedCategory.startsWith('category:') ? 
      selectedCategory.substring(9) : selectedCategory;
    
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
      `*${category}* வகையில் கிடைக்கும் உணவுகள். Type a number to select:` : 
      `Available items in *${category}*. Type a number to select:`;
    
    agent.add(menuText);
    
    // Add items as numbered list
    itemsList.forEach((item, index) => {
      agent.add(`${index + 1}: ${item.title}${item.description ? ' - ' + item.description : ''}`);
    });
    
    // Store items in user context for later selection
    user.conversationState = {
      context: 'item_selection',
      data: itemsList
    };
    await user.save();
  },
  
  // Add item to cart
  addToCart: async (agent) => {
    const phoneNumber = getPhoneNumber(agent);
    let itemInput = agent.parameters.item;
    const quantity = agent.parameters.quantity || 1;
    
    const user = await User.findOne({ phoneNumber });
    if (!user) return agent.add('Sorry, something went wrong. Please try again.');
    
    // Try to get item from input if not in parameters
    let selectedItem = itemInput;
    if (!selectedItem && user.conversationState && user.conversationState.context === 'item_selection') {
      const itemIndex = parseInt(agent.query) - 1;
      if (itemIndex >= 0 && itemIndex < user.conversationState.data.length) {
        selectedItem = user.conversationState.data[itemIndex].id;
      }
    }
    
    if (!selectedItem) {
      return agent.add('Please select an item by typing its number.');
    }
    
    // Extract item ID from the format "item:ItemID"
    const itemId = selectedItem.startsWith('item:') ? 
      selectedItem.substring(5) : selectedItem;
    
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
      'உங்கள் கார்ட்டில் இப்போது ₹' + user.cart.total + ' மதிப்புள்ள ' + user.cart.items.length + ' பொருட்கள் உள்ளன. What would you like to do next? Type a number:' : 
      'Your cart now has ' + user.cart.items.length + ' items worth ₹' + user.cart.total + '. What would you like to do next? Type a number:';
    
    agent.add(cartText);
    
    const optionTexts = user.preferredLanguage === 'tamil' ? 
      [
        '1: மேலும் சேர்',
        '2: கார்ட் பார்க்க',
        '3: செக்அவுட்'
      ] : 
      [
        '1: Add More',
        '2: View Cart',
        '3: Checkout'
      ];
    
    // Add each option as a separate message
    optionTexts.forEach(option => agent.add(option));
    
    // Update user context
    user.conversationState = {
      context: 'cart_options',
      data: null
    };
    await user.save();
  },
  
  // View cart contents
// View cart contents (continued)
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
  
  cartDetails += `\n*SUBTOTAL: ₹${user.cart.total}*\n`;
  cartDetails += `*DELIVERY FEE: ₹${vendor.deliveryFee}*\n`;
  cartDetails += `*GRAND TOTAL: ₹${user.cart.total + vendor.deliveryFee}*`;
  
  agent.add(cartDetails);
  
  // Show cart options
  const optionsText = user.preferredLanguage === 'tamil' ? 
    'என்ன செய்ய விரும்புகிறீர்கள்? Type a number:' : 
    'What would you like to do? Type a number:';
  
  agent.add(optionsText);
  
  const optionTexts = user.preferredLanguage === 'tamil' ? 
    [
      '1: மேலும் சேர்',
      '2: கார்ட் அழி',
      '3: செக்அவுட்'
    ] : 
    [
      '1: Add More',
      '2: Clear Cart',
      '3: Checkout'
    ];
  
  // Add each option as a separate message
  optionTexts.forEach(option => agent.add(option));
  
  // Update user context
  user.conversationState = {
    context: 'cart_options',
    data: null
  };
  await user.save();
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
    
    return agent.add(noAddressText);
  }
  
  const deliveryAddress = user.addresses[user.defaultAddressIndex];
  
  const addressText = user.preferredLanguage === 'tamil' ? 
    `*டெலிவரி முகவரி:*\n${deliveryAddress.fullAddress}\n\nஇந்த முகவரியை பயன்படுத்த விரும்புகிறீர்களா? Type 'yes' to confirm or 'no' to share a different address.` : 
    `*Delivery Address:*\n${deliveryAddress.fullAddress}\n\nWould you like to use this address? Type 'yes' to confirm or 'no' to share a different address.`;
  
  agent.add(addressText);
  
  // Update user context for address confirmation
  user.conversationState = {
    context: 'address_confirmation',
    data: null
  };
  await user.save();
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
    // Try to parse from text
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
    
    // Payment instructions
    if (selectedMethod === 'ONLINE') {
      agent.add('You will receive a payment link shortly. Please complete the payment to confirm your order.');
    } else if (selectedMethod === 'UPI') {
      agent.add('You will receive UPI payment details shortly. Please complete the payment to confirm your order.');
    } else {
      agent.add('Please keep cash ready for delivery.');
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
      return agent.add('No orders found. Would you like to place a new order?');
    }
    
    // Format order status
    const statusText = user.preferredLanguage === 'tamil' ? 
      `*ஆர்டர் நிலை*\nஆர்டர் ஐடி: ${order._id}\nஉணவகம்: ${order.vendorId.businessName}\nநிலை: ${order.orderStatus}\nமொத்தம்: ₹${order.grandTotal}` : 
      `*Order Status*\nOrder ID: ${order._id}\nVendor: ${order.vendorId.businessName}\nStatus: ${order.orderStatus}\nTotal: ₹${order.grandTotal}`;
    
    agent.add(statusText);
    
    // Additional information based on status
    if (order.orderStatus === 'PLACED') {
      agent.add('Your order has been placed and is waiting for confirmation from the vendor.');
    } else if (order.orderStatus === 'CONFIRMED') {
      agent.add('Your order has been confirmed and is being prepared.');
    } else if (order.orderStatus === 'PREPARING') {
      agent.add('Your food is being prepared and will be ready for delivery soon.');
    } else if (order.orderStatus === 'OUT_FOR_DELIVERY') {
      agent.add('Your food is on the way! It should reach you shortly.');
    } else if (order.orderStatus === 'DELIVERED') {
      agent.add('Your order has been delivered. Enjoy your meal!');
    } else if (order.orderStatus === 'CANCELLED') {
      agent.add('Your order was cancelled. Please contact support if you need assistance.');
    }
    
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
      return agent.add('You have no previous orders. Would you like to place a new order?');
    }
    
    // Format order history
    const historyText = user.preferredLanguage === 'tamil' ? 
      `*முந்தைய ஆர்டர்கள்*\nஉங்கள் சமீபத்திய ${orders.length} ஆர்டர்கள்:` : 
      `*Previous Orders*\nYour most recent ${orders.length} orders:`;
    
    agent.add(historyText);
    
    // Add each order as a separate message
    orders.forEach((order, index) => {
      const orderDate = new Date(order.createdAt).toLocaleDateString();
      const orderText = `${index + 1}. ${orderDate} - ${order.vendorId.businessName} - ₹${order.grandTotal} - ${order.orderStatus}`;
      agent.add(orderText);
    });
    
    // Options
    agent.add('To check details of a specific order, please type "order status" followed by the order ID.');
    
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
  
  // Add each command as a separate message
  commands.forEach(command => agent.add(command));
  
  // Additional help
  const additionalHelp = language === 'tamil' ? 
    'மேலும் உதவி தேவையா? தயவுசெய்து உங்கள் சந்தேகத்தைக் கேளுங்கள்.' : 
    'Need more help? Please ask your question.';
  
  agent.add(additionalHelp);
}
};

module.exports = intentHandlers;