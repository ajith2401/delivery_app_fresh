// ==== FILE: server.js ====
// Main Express server setup
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { WebhookClient } = require('dialogflow-fulfillment');
const whatsappRoutes = require('./routes/whatsapp');
const dialogflowRoutes = require('./routes/dialogflow');
const vendorRoutes = require('./routes/vendors');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
// Load environment variables
dotenv.config();
// Initialize Express app
const app = express();
app.use(bodyParser.json());
// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
useNewUrlParser: true,
useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));
// Routes
app.use('/webhook/whatsapp', whatsappRoutes);
app.use('/webhook/dialogflow', dialogflowRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
// Health check endpoint
app.get('/health', (req, res) => {
res.status(200).json({ status: 'ok' });
});
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});