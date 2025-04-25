// ==== FILE: routes/dialogflow.js ====
const express = require('express');
const router = express.Router();
const DialogflowController = require('../controllers/DialogflowController');
// Handle webhook requests from Dialogflow
router.post('/', DialogflowController.handleWebhook);

module.exports = router;