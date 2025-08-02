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
}