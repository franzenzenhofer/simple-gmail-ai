/**
 * Utilities Module
 * Helper functions used across the application
 */

namespace Utils {
  export function getFormValue(e: any, field: string, fallback?: string): string {
    const formInput = e.formInput || {};
    const formInputs = (e.formInputs || {}) as Types.FormInputs;
    
    let value = formInput[field];
    
    if (!value && formInputs[field]) {
      const fieldData = formInputs[field];
      if (fieldData?.stringValues && fieldData.stringValues.length > 0) {
        value = fieldData.stringValues[0];
      }
    }
    
    return value || fallback || '';
  }
  
  export function handleError(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  }

  /**
   * Enhanced error handling that preserves stack traces and full error context
   * Returns an object with both user-friendly message and detailed error info
   */
  export function preserveErrorStack(err: unknown): { message: string; fullError: string; stack?: string } {
    if (err instanceof Error) {
      return {
        message: err.message,
        fullError: `${err.name}: ${err.message}`,
        stack: err.stack
      };
    }
    
    const errString = String(err);
    return {
      message: errString,
      fullError: errString,
      stack: undefined
    };
  }

  /**
   * Log error with full context while returning user-friendly message
   * Use this in catch blocks to preserve debugging information
   */
  export function logAndHandleError(err: unknown, context: string = 'Unknown operation'): string {
    const errorDetails = preserveErrorStack(err);
    
    // Log the full error details for debugging
    AppLogger.error(`Error in ${context}`, {
      message: errorDetails.message,
      fullError: errorDetails.fullError,
      stack: errorDetails.stack,
      context
    });
    
    // Return user-friendly message
    return errorDetails.message;
  }

  export function validateApiKeyFormat(apiKey: string): { isValid: boolean; message: string } {
    if (!apiKey || apiKey.trim() === '') {
      return { isValid: false, message: 'API key is required' };
    }

    const trimmedKey = apiKey.trim();
    
    // Basic length check first
    if (trimmedKey.length !== 39) {
      return { isValid: false, message: 'API key must be exactly 39 characters long' };
    }

    // Gemini API key format validation
    if (!trimmedKey.match(/^AIza[0-9A-Za-z\-_]{35}$/)) {
      return { 
        isValid: false, 
        message: 'Invalid format. Gemini API keys start with "AIza" followed by 35 alphanumeric characters, hyphens, or underscores.' 
      };
    }

    return { isValid: true, message: 'API key format is valid' };
  }

  /**
   * Generate a simple hash for draft tracking
   * Uses a basic hash function suitable for detecting duplicate content
   */
  export function generateContentHash(content: string): string {
    let hash = 0;
    if (content.length === 0) return hash.toString();
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36); // Convert to base36 for shorter string
  }
}