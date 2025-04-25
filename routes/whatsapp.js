// ==== FILE: routes/whatsapp.js ====
const express = require('express');
const router = express.Router();
const WhatsAppController = require('../controllers/WhatsAppController');
// Webhook verification for WhatsApp Business API
router.get('/', WhatsAppController.verifyWebhook);
// Handle incoming messages from WhatsApp
router.post('/', WhatsAppController.handleIncomingMessage);
module.exports = router;