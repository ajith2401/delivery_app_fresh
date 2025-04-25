// ==== FILE: routes/orders.js ====
const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');
// Create new order
router.post('/', OrderController.createOrder);
// Get order details
router.get('/', OrderController.getOrderDetails);
// Update order status (vendor endpoint)
router.put('//status', OrderController.updateOrderStatus);
// Get user order history
router.get('/user/', OrderController.getUserOrders);
module.exports = router;