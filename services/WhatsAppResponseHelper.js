// ==== FILE: services/WhatsAppResponseHelper.js ====
/**
 * Helper utility for standardizing WhatsApp responses for Dialogflow
 * This ensures all responses are formatted correctly for the CustomWebhookClient
 */

const WhatsAppResponseHelper = {
    /**
     * Formats a simple text response
     * 
     * @param {string} text - The text message to send
     * @returns {Object} - Formatted response object
     */
    createTextResponse: (text) => {
      return text; // Simple text responses can be passed as-is
    },
    
    /**
     * Formats a location request response
     * 
     * @param {string} text - Prompt text for location request 
     * @returns {Object} - Formatted response object
     */
    createLocationRequest: (text) => {
      return {
        payload: {
          whatsapp_type: 'location_request_message',
          text
        }
      };
    },
    
    /**
     * Formats a list response for menu items, vendors, etc.
     * 
     * @param {string} text - Main text of the message
     * @param {string} buttonText - Text on the button that opens the list
     * @param {string} sectionTitle - Title of the section
     * @param {Array} items - Array of items, each with id, title, and description
     * @returns {Object} - Formatted response object
     */
    createListResponse: (text, buttonText, sectionTitle, items) => {
      return {
        payload: {
          whatsapp_type: 'list',
          text,
          button: buttonText,
          sectionTitle,
          items
        }
      };
    },
    
    /**
     * Formats a buttons response for quick replies
     * 
     * @param {string} text - Main text of the message
     * @param {Array} buttons - Array of buttons, each with id and text
     * @returns {Object} - Formatted response object
     */
    createButtonsResponse: (text, buttons) => {
      return {
        payload: {
          whatsapp_type: 'buttons',
          text,
          buttons: buttons.map(button => ({
            id: button.id,
            text: button.text
          }))
        }
      };
    },
    
    /**
     * Formats an image response
     * 
     * @param {string} imageUrl - URL of the image
     * @param {string} caption - Optional caption for the image
     * @returns {Object} - Formatted response object
     */
    createImageResponse: (imageUrl, caption = null) => {
      return {
        payload: {
          whatsapp_type: 'image',
          url: imageUrl,
          caption
        }
      };
    }
  };
  
  module.exports = WhatsAppResponseHelper;