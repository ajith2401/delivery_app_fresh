const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const PaymentController = require('../controllers/PaymentController');

// Handler functions for Dialogflow intents
const intentHandlers = {
  // Welcome intent handler
  welcome: async (agent) => {
    const phoneNumber = agent.originalRequest.payload.data.from;
    
    // Find or create user
    let user = await User.findOne({ phoneNumber });
    
    if (!user) {
      user = new User({ phoneNumber });
      await user.save();
      
      // First-time user
      agent.add('வணக்கம்! Welcome to TamilFoods! 🍲');
      agent.add('I can help you order delicious home-cooked food from nearby cooks.');
      
      // Ask for language preference
      agent.add({
        payload: {
          whatsapp_type: 'buttons',
          text: 'Please select your preferred language:',
          buttons: [
            { id: 'english', text: 'English' },
            { id: 'tamil', text: 'தமிழ் (Tamil)' }
          ]
        }
      });
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
  },
  
  // Set language preference
  setLanguage: async (agent) => {
    const phoneNumber = agent.originalRequest.payload.data.from;
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
    
    agent.add(locationText);
  },
  
  // Process location shared by user
  processLocation: async (agent) => {
    const phoneNumber = agent.originalRequest.payload.data.from;
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
  },
  
  // Search for food items
  searchFood: async (agent) => {
    const phoneNumber = agent.originalRequest.payload.data.from;
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
    const phoneNumber = agent.originalRequest.payload.data.from;
    
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
    const phoneNumber = agent.originalRequest.payload.data.from;
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
    const phoneNumber = agent.originalRequest.payload.data.from;
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
    const phoneNumber = agent.originalRequest.payload.data.from;
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
    const phoneNumber = agent.originalRequest.payload.data.from;
    
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
    const phoneNumber = agent.originalRequest.payload.data.from;
    
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
}

}
