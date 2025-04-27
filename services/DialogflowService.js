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
        try {
          const location = typeof query === 'string' ? JSON.parse(query) : query;
          
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
        } catch (error) {
          console.error('Error parsing location data:', error);
          // Fallback to text intent
          queryParams = {
            session: sessionPath,
            queryInput: {
              text: {
                text: 'location error',
                languageCode: languageCode,
              },
            },
          };
        }
      } else if (messageType === 'button') {
        // Map button IDs to specific text queries that match your intents
        console.log(`Processing button click with ID: ${query}`);
        
        // Map button IDs to intent trigger phrases
        const buttonIdMap = {
          'nearby_vendors': 'show me nearby vendors',
          'search_food': 'I want to search for food',
          'my_orders': 'show my orders',
          'english': 'I prefer English language',
          'tamil': 'I prefer Tamil language',
          'payment_COD': 'I want to pay with cash on delivery',
          'payment_ONLINE': 'I want to pay online',
          'payment_UPI': 'I want to pay with UPI',
          'confirm_address': 'confirm my address',
          'new_address': 'I want to enter a new address',
          'add_more': 'I want to add more items',
          'clear_cart': 'clear my cart',
          'checkout': 'proceed to checkout',
          'view_cart': 'view my cart',
          'help_ordering': 'help me with ordering',
          'help_payment': 'help me with payment options',
          'help_delivery': 'help me with delivery',
          'contact_support': 'contact customer support',
          'back_to_menu': 'go back to main menu'
        };
        
        let intentQuery = buttonIdMap[query] || query;
        
        queryParams = {
          session: sessionPath,
          queryInput: {
            text: {
              text: intentQuery,
              languageCode: languageCode,
            },
          },
        };
      } else if (messageType === 'list_selection') {
        // Handle list selection events from WhatsApp
        console.log(`Processing list selection with ID: ${query}`);
        
        // If the list item ID contains a prefix, handle it accordingly
        let intentQuery = query;
        
        if (query.startsWith('item:')) {
          intentQuery = `select item ${query.substring(5)}`;
        } else if (query.startsWith('category:')) {
          intentQuery = `browse category ${query.substring(9)}`;
        } else if (query.startsWith('order:')) {
          intentQuery = `view order ${query.substring(6)}`;
        } else {
          // For other list selections, use the ID directly
          intentQuery = `select ${query}`;
        }
        
        queryParams = {
          session: sessionPath,
          queryInput: {
            text: {
              text: intentQuery,
              languageCode: languageCode,
            },
          },
        };
      }
      
      // Send request to Dialogflow
      const responses = await sessionClient.detectIntent(queryParams);
      const result = responses[0].queryResult;
      console.log('result====================================');
      console.dir(result, {depth: null});
      console.log('====================================');
      
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
  
  processDialogflowResponse: (result) => {
    // Check for webhook payload first
    if (result.webhookPayload && result.webhookPayload.fields) {
      try {
        // Try to extract the payload from the null field (common in Dialogflow)
        const nullPayload = result.webhookPayload.fields.null;
        
        if (nullPayload && nullPayload.structValue && nullPayload.structValue.fields) {
          const fields = nullPayload.structValue.fields;
          
          // Check for interactive payload (buttons, lists, etc.)
          if (fields.type && fields.type.stringValue === 'interactive') {
            const interactive = fields.interactive.structValue.fields;
            const interactiveType = interactive.type.stringValue;
            
            // Handle button type
            if (interactiveType === 'button') {
              return {
                type: 'interactive_buttons',
                text: interactive.body.structValue.fields.text.stringValue,
                buttons: interactive.action.structValue.fields.buttons.listValue.values.map(button => ({
                  id: button.structValue.fields.reply.structValue.fields.id.stringValue,
                  text: button.structValue.fields.reply.structValue.fields.title.stringValue
                }))
              };
            }
            
            // Handle location request
            if (interactiveType === 'location_request_message') {
              return {
                type: 'location_request',
                text: interactive.body.structValue.fields.text.stringValue,
                action: interactive.action.structValue.fields.name.stringValue
              };
            }
          }
        }
      } catch (error) {
        console.error('Error parsing webhook payload:', error);
      }
    }
    
    // If no payload or error in processing it, handle fulfillment messages
    // Extract text from fulfillment messages
    let responseText = '';
    const messages = result.fulfillmentMessages || [];
    const textMessages = messages
      .filter(msg => msg.message === 'text' && msg.text && msg.text.text && msg.text.text.length > 0)
      .map(msg => msg.text.text[0])
      .filter(text => text);
    
    if (textMessages.length > 0) {
      responseText = textMessages.join('\n\n');
    } else {
      responseText = result.fulfillmentText || 'I didn\'t understand. Can you try again?';
    }
  
    // Default response as text
    return {
      type: 'text',
      text: responseText
    };
  }
  };
  
  module.exports = DialogflowService;