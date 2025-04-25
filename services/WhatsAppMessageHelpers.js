// ==== FILE: services/WhatsAppMessageHelpers.js ====
/**
 * Helper functions for generating WhatsApp API message payloads
 * Based on WhatsApp Business API documentation
 */

/**
 * Generate a basic message payload with common properties
 * @param {string} phoneNumber - Recipient's phone number
 * @returns {Object} Basic message payload object
 */
const createBasePayload = (phoneNumber) => {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber
    };
  };
  
  /**
   * Generate a text message payload
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} text - Message text content
   * @param {boolean} previewUrl - Whether to enable link preview (default: false)
   * @returns {Object} Text message payload
   */
  const generateTextMessagePayload = (phoneNumber, text, previewUrl = false) => {
    return {
      ...createBasePayload(phoneNumber),
      type: "text",
      text: {
        body: text,
        preview_url: previewUrl
      }
    };
  };
  
  /**
   * Generate an interactive buttons message payload
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} text - Message body text
   * @param {Array} buttons - Array of button objects with id and text properties
   * @param {Object} header - Optional header object
   * @param {string} footer - Optional footer text
   * @returns {Object} Interactive buttons message payload
   */
  const generateButtonsMessagePayload = (phoneNumber, text, buttons, header = null, footer = null) => {
    console.log("generateButtonsMessagePayload",{phoneNumber, text, buttons});
    
    const payload = {
      ...createBasePayload(phoneNumber),
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: text
        },
        action: {
          buttons: buttons.map(button => ({
            type: "reply",
            reply: {
              id: button.id,
              title: button.text
            }
          }))
        }
      }
    };
  
    // Add header if provided
    if (header) {
      payload.interactive.header = header;
    }
  
    // Add footer if provided
    if (footer) {
      payload.interactive.footer = {
        text: footer
      };
    }
  
    return payload;
  };
  
  /**
   * Generate an interactive list message payload
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} text - Message body text
   * @param {string} buttonText - Button text that opens the list
   * @param {string} sectionTitle - Title of the section
   * @param {Array} items - Array of list items with id, title, and description properties
   * @param {string} headerText - Optional header text
   * @param {string} footerText - Optional footer text
   * @returns {Object} Interactive list message payload
   */
  const generateListMessagePayload = (phoneNumber, text, buttonText, sectionTitle, items, headerText = null, footerText = null) => {
    const payload = {
      ...createBasePayload(phoneNumber),
      type: "interactive",
      interactive: {
        type: "list",
        body: {
          text: text
        },
        action: {
          button: buttonText,
          sections: [
            {
              title: sectionTitle,
              rows: items.map(item => ({
                id: item.id,
                title: item.title,
                description: item.description || ""
              }))
            }
          ]
        }
      }
    };
  
    // Add header if provided
    if (headerText) {
      payload.interactive.header = {
        type: "text",
        text: headerText
      };
    }
  
    // Add footer if provided
    if (footerText) {
      payload.interactive.footer = {
        text: footerText
      };
    }
  
    return payload;
  };
  
  /**
   * Generate a location request message payload
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} text - Message body text
   * @returns {Object} Location request message payload
   */
  const generateLocationRequestPayload = (phoneNumber, text) => {
    return {
      ...createBasePayload(phoneNumber),
      type: "interactive",
      interactive: {
        type: "location_request_message",
        body: {
          text: text
        },
        action: {
          name: "send_location"
        }
      }
    };
  };
  
  /**
   * Generate an image message payload
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} imageUrl - URL of the image
   * @param {string} caption - Optional image caption
   * @param {string} imageId - Optional image ID (for uploaded media)
   * @returns {Object} Image message payload
   */
  const generateImageMessagePayload = (phoneNumber, imageUrl = null, caption = null, imageId = null) => {
    const payload = {
      ...createBasePayload(phoneNumber),
      type: "image",
      image: {}
    };
  
    // Add either image ID or link
    if (imageId) {
      payload.image.id = imageId;
    } else if (imageUrl) {
      payload.image.link = imageUrl;
    }
  
    // Add caption if provided
    if (caption) {
      payload.image.caption = caption;
    }
  
    return payload;
  };
  
  /**
   * Generate a multi-product list message payload
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} text - Message body text
   * @param {string} headerText - Header text
   * @param {string} catalogId - Catalog ID
   * @param {Array} sections - Array of section objects with title and product items
   * @param {string} footerText - Optional footer text
   * @returns {Object} Multi-product list message payload
   */
  const generateProductListPayload = (phoneNumber, text, headerText, catalogId, sections, footerText = null) => {
    const payload = {
      ...createBasePayload(phoneNumber),
      type: "interactive",
      interactive: {
        type: "product_list",
        header: {
          type: "text",
          text: headerText
        },
        body: {
          text: text
        },
        action: {
          catalog_id: catalogId,
          sections: sections
        }
      }
    };
  
    // Add footer if provided
    if (footerText) {
      payload.interactive.footer = {
        text: footerText
      };
    }
  
    return payload;
  };
  
  /**
   * Helper function to convert Dialogflow response to WhatsApp API payload
   * @param {string} phoneNumber - Recipient's phone number
   * @param {Object} dialogflowResponse - Response from Dialogflow
   * @returns {Object|null} WhatsApp API payload or null if invalid response type
   */
  const dialogflowResponseToWhatsAppPayload = (phoneNumber, dialogflowResponse) => {
    switch (dialogflowResponse.type) {
      case 'text':
        return generateTextMessagePayload(phoneNumber, dialogflowResponse.text);
        
      case 'interactive_buttons':
        return generateButtonsMessagePayload(
          phoneNumber,
          dialogflowResponse.text,
          dialogflowResponse.buttons
        );
        
      case 'interactive_list':
        return generateListMessagePayload(
          phoneNumber,
          dialogflowResponse.text,
          dialogflowResponse.button || 'View Options',
          dialogflowResponse.sectionTitle || 'Options',
          dialogflowResponse.items
        );
        
      case 'location_request_message':
        return generateLocationRequestPayload(
          phoneNumber,
          dialogflowResponse.text
        );
        
      case 'image':
        return generateImageMessagePayload(
          phoneNumber,
          dialogflowResponse.url,
          dialogflowResponse.caption
        );
        
      default:
        console.warn(`Unsupported response type: ${dialogflowResponse.type}`);
        return null;
    }
  };
  
  module.exports = {
    createBasePayload,
    generateTextMessagePayload,
    generateButtonsMessagePayload,
    generateListMessagePayload,
    generateLocationRequestPayload,
    generateImageMessagePayload,
    generateProductListPayload,
    dialogflowResponseToWhatsAppPayload
  };