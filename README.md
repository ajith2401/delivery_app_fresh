# TamilFoods WhatsApp Delivery Bot

## Overview
TamilFoods is a WhatsApp-based food delivery bot that allows users to order home-cooked meals from local vendors in Tamil Nadu, India. The bot supports both English and Tamil languages, providing a seamless ordering experience.

## Features
- Bilingual Support (English and Tamil)
- Location-based Vendor Discovery
- Real-time Menu Browsing
- Interactive Cart Management
- Multiple Payment Options
- Order Tracking
- Customer Support

## Tech Stack
- Node.js
- Express.js
- MongoDB
- Dialogflow
- WhatsApp Business API
- Razorpay Payment Gateway

## Prerequisites
- Node.js (v14.0.0+)
- MongoDB
- WhatsApp Business Account
- Dialogflow Agent
- Razorpay Account

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/tamilfoods-whatsapp-bot.git
cd tamilfoods-whatsapp-bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file with the following variables:
```
MONGODB_URI=your_mongodb_connection_string
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token
DIALOGFLOW_PROJECT_ID=your_dialogflow_project_id
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
GMAP_API_KEY=your_google_maps_api_key
```

### 4. Run the Application
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## Deployment
- Deploy on cloud platforms like Heroku, AWS, or Google Cloud
- Set up WhatsApp webhook
- Configure Dialogflow fulfillment webhook

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License
Distributed under the MIT License. See `LICENSE` for more information.

## Contact
Your Name - ajith24ram@gmail.com

Project Link: [https://github.com/ajith2401/delivery_app_fresh](https://github.com/ajith2401/delivery_app_fresh)