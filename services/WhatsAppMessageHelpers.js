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
 * Truncate text to a maximum length and add ellipsis if needed
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Truncated text
 */
const truncateText = (text, maxLength) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
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
  // WhatsApp API limits button text to 20 characters
  const formattedButtons = buttons.map(button => ({
    type: "reply",
    reply: {
      id: button.id,
      title: truncateText(button.text, 20)
    }
  })).slice(0, 3); // WhatsApp supports maximum 3 buttons
  
  const payload = {
    ...createBasePayload(phoneNumber),
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: text.substring(0, 1024) // WhatsApp body text limit is 1024 chars
      },
      action: {
        buttons: formattedButtons
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
      text: truncateText(footer, 60) // WhatsApp footer text limit is 60 chars
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
  // Format items to respect WhatsApp API limitations
  const formattedItems = items.map(item => ({
    id: item.id,
    title: truncateText(item.title, 24), // WhatsApp row title limit is 24 chars
    description: item.description ? truncateText(item.description, 72) : "" // WhatsApp row description limit is 72 chars
  })).slice(0, 10); // WhatsApp supports maximum 10 items per list
  
  const payload = {
    ...createBasePayload(phoneNumber),
    type: "interactive",
    interactive: {
      type: "list",
      body: {
        text: text.substring(0, 1024) // WhatsApp body text limit is 1024 chars
      },
      action: {
        button: truncateText(buttonText, 20), // WhatsApp button text limit is 20 chars
        sections: [
          {
            title: truncateText(sectionTitle, 24), // WhatsApp section title limit is 24 chars
            rows: formattedItems
          }
        ]
      }
    }
  };

  // Add header if provided
  if (headerText) {
    payload.interactive.header = {
      type: "text",
      text: truncateText(headerText, 60) // WhatsApp header text limit is 60 chars
    };
  }

  // Add footer if provided
  if (footerText) {
    payload.interactive.footer = {
      text: truncateText(footerText, 60) // WhatsApp footer text limit is 60 chars
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
        text: text.substring(0, 1024) // WhatsApp body text limit is 1024 chars
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
    payload.image.caption = truncateText(caption, 1024);
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
  // Format sections to respect WhatsApp API limitations
  const formattedSections = sections.map(section => ({
    title: truncateText(section.title, 24),
    product_items: section.product_items
  })).slice(0, 10); // Max 10 sections
  
  const payload = {
    ...createBasePayload(phoneNumber),
    type: "interactive",
    interactive: {
      type: "product_list",
      header: {
        type: "text",
        text: truncateText(headerText, 60)
      },
      body: {
        text: text.substring(0, 1024)
      },
      action: {
        catalog_id: catalogId,
        sections: formattedSections
      }
    }
  };

  // Add footer if provided
  if (footerText) {
    payload.interactive.footer = {
      text: truncateText(footerText, 60)
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
  truncateText,
  generateTextMessagePayload,
  generateButtonsMessagePayload,
  generateListMessagePayload,
  generateLocationRequestPayload,
  generateImageMessagePayload,
  generateProductListPayload,
  dialogflowResponseToWhatsAppPayload
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
// const generateListMessagePayload = (phoneNumber, text, buttonText, sectionTitle, items, headerText = null, footerText = null) => {
//   const payload = {
//     ...createBasePayload(phoneNumber),
//     type: "interactive",
//     interactive: {
//       type: "list",
//       body: {
//         text: text
//       },
//       action: {
//         button: buttonText,
//         sections: [
//           {
//             title: sectionTitle,
//             rows: items.map(item => ({
//               id: item.id,
//               title: item.title,
//               description: item.description || ""
//             }))
//           }
//         ]
//       }
//     }
//   };

//   // Add header if provided
//   if (headerText) {
//     payload.interactive.header = {
//       type: "text",
//       text: headerText
//     };
//   }

//   // Add footer if provided
//   if (footerText) {
//     payload.interactive.footer = {
//       text: footerText
//     };
//   }

//   return payload;
// };
  