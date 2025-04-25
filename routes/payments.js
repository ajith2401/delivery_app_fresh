// ==== FILE: routes/payments.js ====
const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');
// Create payment order with Razorpay
router.post('/create', PaymentController.createPayment);
// Verify payment
router.post('/verify', PaymentController.verifyPayment);
// Handle Razorpay webhook
router.post('/webhook', PaymentController.handleWebhook);
module.exports = router;