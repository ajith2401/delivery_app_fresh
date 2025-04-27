// ==== FILE: server.js ====
// Main Express server setup
process.env.DEBUG = 'dialogflow:*';
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
const axios = require('axios');

async function getAddressFromCoordinates(lat, lng) {
  const GMAP_API_KEY = process.env.GMAP_API_KEY
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAP_API_KEY}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    if (data.status === 'OK' && data.results.length > 0) {
      // Take the first result
      const address = data.results[0].formatted_address;
      console.log('Address:', address);
      return address;
    } else {
      console.log('No address found');
      return null;
    }
  } catch (error) {
    console.error('Error calling Google API:', error.message);
    return null;
  }
}
 

(async () => {
    const lat = 12.8699252;
    const lng = 77.6694071;
    
    const address = await getAddressFromCoordinates(lat, lng);
    console.log('Final Address:', address);
  })();
 

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