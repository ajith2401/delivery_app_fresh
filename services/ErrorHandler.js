// ==== FILE: services/ErrorHandler.js ====
/**
 * Helper functions for handling errors in the application
 */

/**
 * Parse WhatsApp API error response
 * @param {Error} error - Error object from axios
 * @returns {Object} Parsed error information
 */
const parseWhatsAppError = (error) => {
    // Default error structure
    const errorInfo = {
      code: error.code || 'UNKNOWN_ERROR',
      status: error.response?.status || 500,
      message: error.message || 'An unknown error occurred',
      details: null,
      originalError: error
    };
  
    // Check if this is an axios error with a response
    if (error.response && error.response.data) {
      try {
        const { error: apiError } = error.response.data;
        
        if (apiError) {
          errorInfo.code = apiError.code || errorInfo.code;
          errorInfo.message = apiError.message || errorInfo.message;
          errorInfo.details = apiError.error_data || apiError.details || null;
          
          // Check for specific WhatsApp API errors
          if (apiError.code === 100) {
            errorInfo.message = 'Invalid parameter in request';
          } else if (apiError.code === 131047) {
            errorInfo.message = 'Message failed to send - user may have opted out';
          } else if (apiError.code === 130429) {
            errorInfo.message = 'Rate limit reached - too many messages sent';
          } else if (apiError.code === 10) {
            errorInfo.message = 'Application doesn\'t have permission for this action';
          }
          
          // Check for rate limiting headers
          if (error.response.headers && error.response.headers['x-business-use-case-usage']) {
            errorInfo.rateLimit = error.response.headers['x-business-use-case-usage'];
          }
        }
      } catch (parseError) {
        errorInfo.details = 'Error parsing API response';
      }
    }
    
    return errorInfo;
  };
  
  /**
   * Log detailed error information
   * @param {string} context - Where the error occurred
   * @param {Error} error - The error object
   */
  const logError = (context, error) => {
    console.error(`=== ERROR in ${context} ===`);
    
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      
      // If there's a specific error message from the API, log it
      if (error.response.data && error.response.data.error) {
        console.error('API Error:', JSON.stringify(error.response.data.error, null, 2));
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received. Request details:', error.request);
    } else {
      // Something happened in setting up the request
      console.error('Error message:', error.message);
    }
    
    // Log stack trace
    console.error('Stack:', error.stack);
    console.error('================================');
  };
  
  /**
   * Handle WhatsApp API errors with appropriate actions
   * @param {Error} error - Error from WhatsApp API call
   * @param {Function} retryFn - Function to retry the operation (optional)
   * @returns {Object} Error information and whether a retry is recommended
   */
  const handleWhatsAppError = (error, retryFn = null) => {
    const errorInfo = parseWhatsAppError(error);
    logError('WhatsApp API', error);
    
    // Determine if we should retry based on error type
    let shouldRetry = false;
    let retryDelay = 1000; // Default 1 second
    
    // Check for rate limiting or temporary errors that warrant retry
    if (errorInfo.status === 429 || // Too Many Requests
        errorInfo.code === 'ECONNRESET' || 
        errorInfo.code === 'ETIMEDOUT' ||
        errorInfo.code === '130429') {
      shouldRetry = true;
      retryDelay = 5000; // Wait 5 seconds before retry
    }
    
    // Version issue - API auto-upgraded
    if (error.response && 
        error.response.headers && 
        error.response.headers['x-ad-api-version-warning']) {
      console.warn('API Version Warning:', error.response.headers['x-ad-api-version-warning']);
      // Consider updating the API version in the code
    }
    
    // Handle retry if needed and retry function provided
    if (shouldRetry && typeof retryFn === 'function') {
      console.log(`Retrying WhatsApp API call in ${retryDelay}ms...`);
      setTimeout(retryFn, retryDelay);
    }
    
    return {
      ...errorInfo,
      shouldRetry,
      retryDelay
    };
  };
  
  module.exports = {
    parseWhatsAppError,
    logError,
    handleWhatsAppError
  };