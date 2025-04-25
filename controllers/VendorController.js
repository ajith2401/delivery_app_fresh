
// ==== FILE: controllers/VendorController.js ====
const Vendor = require('../models/Vendor');
const mongoose = require('mongoose');
const VendorController = {
// Get nearby vendors based on location
getNearbyVendors: async (req, res) => {
try {
const { longitude, latitude, radius = 5, cuisine } = req.query;
  if (!longitude || !latitude) {
    return res.status(400).json({ error: 'Location coordinates are required' });
  }
  
  // Base query
  const query = {
    isActive: true,
    'address.location': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        },
        $maxDistance: parseInt(radius) * 1000 // Convert km to meters
      }
    }
  };
  
  // Add cuisine filter if provided
  if (cuisine) {
    query.cuisineType = cuisine;
  }
  
  // Find vendors
  const vendors = await Vendor.find(query)
    .select('businessName cuisineType rating reviewCount address operatingHours avgDeliveryTime minOrderAmount deliveryFee')
    .limit(10);
  
  // Check if each vendor is currently open
  const vendorsWithStatus = vendors.map(vendor => {
    const vendorObj = vendor.toObject();
    vendorObj.isOpen = vendor.isCurrentlyOpen();
    
    // Calculate distance (can be improved with proper distance formula)
    const vendorCoords = vendor.address.location.coordinates;
    const distance = calculateDistance(
      parseFloat(latitude),
      parseFloat(longitude),
      vendorCoords[1],
      vendorCoords[0]
    );
    vendorObj.distance = parseFloat(distance.toFixed(1));
    
    return vendorObj;
  });
  
  return res.status(200).json({ vendors: vendorsWithStatus });
} catch (error) {
  console.error('Error fetching nearby vendors:', error);
  return res.status(500).json({ error: 'Failed to fetch nearby vendors' });
}
},
// Get vendor details including menu
getVendorDetails: async (req, res) => {
try {
const { vendorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    return res.status(400).json({ error: 'Invalid vendor ID' });
  }
  
  const vendor = await Vendor.findById(vendorId);
  
  if (!vendor) {
    return res.status(404).json({ error: 'Vendor not found' });
  }
  
  // Check if vendor is currently open
  const vendorObj = vendor.toObject();
  vendorObj.isOpen = vendor.isCurrentlyOpen();
  
  return res.status(200).json({ vendor: vendorObj });
} catch (error) {
  console.error('Error fetching vendor details:', error);
  return res.status(500).json({ error: 'Failed to fetch vendor details' });
}
},
// Register new vendor (admin endpoint)
registerVendor: async (req, res) => {
try {
const {
businessName,
ownerName,
phoneNumber,
email,
fullAddress,
longitude,
latitude,
cuisineType,
operatingHours,
servicingRadius,
minOrderAmount,
deliveryFee
} = req.body;
  // Check if vendor with this phone number already exists
  const existingVendor = await Vendor.findOne({ phoneNumber });
  if (existingVendor) {
    return res.status(400).json({ error: 'Vendor with this phone number already exists' });
  }
  
  // Create new vendor
  const vendor = new Vendor({
    businessName,
    ownerName,
    phoneNumber,
    email,
    address: {
      fullAddress,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      }
    },
    cuisineType: Array.isArray(cuisineType) ? cuisineType : [cuisineType],
    operatingHours: operatingHours || {},
    servicingRadius: servicingRadius || 5,
    minOrderAmount: minOrderAmount || 100,
    deliveryFee: deliveryFee || 30
  });
  
  await vendor.save();
  
  return res.status(201).json({
    message: 'Vendor registered successfully',
    vendorId: vendor._id
  });
} catch (error) {
  console.error('Error registering vendor:', error);
  return res.status(500).json({ error: 'Failed to register vendor' });
}
},
// Update vendor menu (admin endpoint)
updateMenu: async (req, res) => {
try {
const { vendorId } = req.params;
const { menuItems } = req.body;
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    return res.status(400).json({ error: 'Invalid vendor ID' });
  }
  
  if (!Array.isArray(menuItems)) {
    return res.status(400).json({ error: 'Menu items must be an array' });
  }
  
  const vendor = await Vendor.findById(vendorId);
  
  if (!vendor) {
    return res.status(404).json({ error: 'Vendor not found' });
  }
  
  // Update menu items
  vendor.menuItems = menuItems;
  await vendor.save();
  
  return res.status(200).json({
    message: 'Menu updated successfully',
    menuItems: vendor.menuItems
  });
} catch (error) {
  console.error('Error updating menu:', error);
  return res.status(500).json({ error: 'Failed to update menu' });
}
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
module.exports = VendorController;