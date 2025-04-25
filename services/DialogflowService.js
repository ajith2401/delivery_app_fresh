// ==== FILE: services/DialogflowService.js ====
const dialogflow = require('@google-cloud/dialogflow');
const { v4: uuidv4 } = require('uuid');
const DialogflowService = {
// Detect intent from user message
detectIntent: async (projectId, sessionId, query, messageType = 'text', language = 'english') => {
try {
// Create a session client
console.log(`Attempting to detect intent for project: ${projectId}, session: ${sessionId}`);
const sessionClient = new dialogflow.SessionsClient();
const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);
  // Set language code based on user preference
  const languageCode = language === 'tamil' ? 'ta' : 'en-US';
  
  // Create query parameters
  let queryParams;
  
  if (messageType === 'text') {
    // Text query
    queryParams = {
      session: sessionPath,
      queryInput: {
        text: {
          text: query,
          languageCode: languageCode,
        },
      },
    };
  } else if (messageType === 'location') {
    // Location data is sent as a parameter to a specific intent
    const location = JSON.parse(query);
    
    queryParams = {
      session: sessionPath,
      queryInput: {
        text: {
          text: 'LOCATION_SHARED',
          languageCode: languageCode,
        },
      },
      queryParams: {
        parameters: {
          fields: {
            latitude: { numberValue: location.latitude },
            longitude: { numberValue: location.longitude },
          }
        }
      }
    };
  }
  
  // Send request to Dialogflow
  const responses = await sessionClient.detectIntent(queryParams);
  console.log('====================================');
  console.log(responses[0].queryResult);
  console.log('====================================');
  const result = responses[0].queryResult;
  
  // Process the response
  return DialogflowService.processDialogflowResponse(result);
} catch (error) {
  console.error('Error detecting intent:', error);
  return {
    type: 'text',
    text: 'Sorry, I encountered an error. Please try again later.'
  };
}
},
// Process Dialogflow response
processDialogflowResponse: (result) => {
// Check for fulfillment messages
const messages = result.fulfillmentMessages || [];
// Default response as text
let response = {
  type: 'text',
  text: result.fulfillmentText || 'I didn\'t understand. Can you try again?'
};

// Look for custom payload
for (const message of messages) {
  if (message.payload) {
    const payload = message.payload.fields;
    
    if (payload) {
      // Check for rich message types
      if (payload.whatsapp_type && payload.whatsapp_type.stringValue) {
        const messageType = payload.whatsapp_type.stringValue;
        
        if (messageType === 'buttons' && payload.buttons) {
          // Button message
          response = {
            type: 'interactive_buttons',
            text: payload.text ? payload.text.stringValue : response.text,
            buttons: payload.buttons.listValue.values.map(button => ({
              id: button.structValue.fields.id ? button.structValue.fields.id.stringValue : uuidv4(),
              text: button.structValue.fields.text.stringValue
            }))
          };
        } else if (messageType === 'list' && payload.items) {
          // List message
          response = {
            type: 'interactive_list',
            text: payload.text ? payload.text.stringValue : response.text,
            button: payload.button ? payload.button.stringValue : 'View Options',
            sectionTitle: payload.sectionTitle ? payload.sectionTitle.stringValue : 'Options',
            items: payload.items.listValue.values.map(item => ({
              id: item.structValue.fields.id ? item.structValue.fields.id.stringValue : uuidv4(),
              title: item.structValue.fields.title.stringValue,
              description: item.structValue.fields.description ? item.structValue.fields.description.stringValue : ''
            }))
          };
        } else if (messageType === 'location' && payload.latitude && payload.longitude) {
          // Location message
          response = {
            type: 'location',
            latitude: payload.latitude.numberValue,
            longitude: payload.longitude.numberValue,
            name: payload.name ? payload.name.stringValue : 'Location',
            address: payload.address ? payload.address.stringValue : ''
          };
        } else if (messageType === 'image' && payload.url) {
          // Image message
          response = {
            type: 'image',
            url: payload.url.stringValue,
            caption: payload.caption ? payload.caption.stringValue : ''
          };
        }
      }
    }
  }
}

return response;
}
};
module.exports = DialogflowService;


