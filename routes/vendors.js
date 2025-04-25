// ==== FILE: routes/vendors.js ====
const express = require('express');
const router = express.Router();
const VendorController = require('../controllers/VendorController');
// Get nearby vendors based on location
router.get('/nearby', VendorController.getNearbyVendors);
// Get vendor details including menu
router.get('/', VendorController.getVendorDetails);
// Register new vendor (admin endpoint)
router.post('/register', VendorController.registerVendor);
// Update vendor menu (admin endpoint)
router.put('//menu', VendorController.updateMenu);
module.exports = router;