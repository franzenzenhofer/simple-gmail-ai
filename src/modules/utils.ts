/**
 * Utilities Module
 * Helper functions used across the application
 */

namespace Utils {
  export function getFormValue(e: any, field: string, fallback?: string): string {
    const formInput = e.formInput || {};
    const formInputs = (e.formInputs || {}) as Types.FormInputs;
    
    let value = formInput[field] || 
                (formInputs[field] && formInputs[field].stringValues && formInputs[field].stringValues[0]);
    
    if (!value && formInputs[field]) {
      if (Array.isArray(formInputs[field]) && formInputs[field].length > 0) {
        value = formInputs[field][0];
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
}