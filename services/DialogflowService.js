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
      } else if (messageType === 'interactive') {
        // Handle button click events from WhatsApp
        queryParams = {
          session: sessionPath,
          queryInput: {
            text: {
              text: query, // The button ID is passed as the query
              languageCode: languageCode,
            },
          },
        };
      } else if (messageType === 'list_selection') {
        // Handle list selection events from WhatsApp
        queryParams = {
          session: sessionPath,
          queryInput: {
            text: {
              text: query, // The list item ID is passed as the query
              languageCode: languageCode,
            },
          },
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
  
  processDialogflowResponse: (result) => {
    // Extract text from fulfillment messages first
    let responseText = '';
    const messages = result.fulfillmentMessages || [];
    const textMessages = messages
      .filter(msg => msg.message === 'text' && msg.text && msg.text.text && msg.text.text.length > 0)
      .map(msg => msg.text.text[0])
      .filter(text => text); // Filter out empty messages
    
    if (textMessages.length > 0) {
      responseText = textMessages.join('\n\n');
    } else {
      // Fallback to fulfillmentText if no text messages
      responseText = result.fulfillmentText || 'I didn\'t understand. Can you try again?';
    }
  
    // Check for webhook payload
    if (result.webhookPayload && result.webhookPayload.fields) {
      const nullPayload = result.webhookPayload.fields.null;
      if (nullPayload && nullPayload.structValue) {
        const payloadFields = nullPayload.structValue.fields;
        
        // Check if it's an interactive payload
        if (payloadFields.type && payloadFields.type.stringValue === 'interactive' && payloadFields.interactive) {
          const interactive = payloadFields.interactive.structValue.fields;
          const buttonType = interactive.type.stringValue;
          
          if (buttonType === 'button') {
            return {
              type: 'interactive_buttons',
              text: interactive.body.structValue.fields.text.stringValue,
              buttons: interactive.action.structValue.fields.buttons.listValue.values.map(button => ({
                id: button.structValue.fields.reply.structValue.fields.id.stringValue,
                text: button.structValue.fields.reply.structValue.fields.title.stringValue
              }))
            };
          }
          
          // Add location request handling
          if (buttonType === 'location_request_message') {
            return {
              type: 'location_request',
              text: interactive.body.structValue.fields.text.stringValue,
              action: interactive.action.structValue.fields.name.stringValue
            };
          }
        }
      }
    }
  
    // Default response as text
    return {
      type: 'text',
      text: responseText
    };
  }
  };
  
  module.exports = DialogflowService;