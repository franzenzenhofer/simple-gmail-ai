/**
 * Utilities Module
 * Helper functions used across the application
 */

namespace Utils {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function getFormValue(e: any, field: string, fallback?: string): string {
    const formInput = e.formInput || {};
    const formInputs = (e.commonEventObject?.formInputs || {}) as Types.FormInputs;
    
    let value: string | undefined = formInput[field];
    
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

  /**
   * DRY-01: Standardized error logging utilities
   * Eliminates duplicate error handling patterns
   */
  export function logError(operation: string, error: unknown, additionalContext?: Record<string, unknown>): void {
    const errorDetails = preserveErrorStack(error);
    AppLogger.error(`Failed to ${operation}`, {
      error: errorDetails.fullError,
      stack: errorDetails.stack,
      ...additionalContext
    });
  }

  export function logWarning(operation: string, error: unknown, additionalContext?: Record<string, unknown>): void {
    const errorDetails = preserveErrorStack(error);
    AppLogger.warn(`Failed to ${operation}, continuing with fallback`, {
      error: errorDetails.fullError,
      ...additionalContext
    });
  }

  export function logAndSilentFail(operation: string, error: unknown, additionalContext?: Record<string, unknown>): void {
    const errorDetails = preserveErrorStack(error);
    AppLogger.warn(`${operation} failed silently`, {
      error: errorDetails.message,
      ...additionalContext
    });
  }

  /**
   * Sanitize Gmail label name to meet Gmail's constraints
   * - Max 40 characters (Gmail's limit)
   * - No leading/trailing spaces
   * - Replace illegal characters with safe alternatives
   * - Handle nested labels (slashes) properly
   */
  export function sanitizeGmailLabel(labelName: string): string {
    if (!labelName) return 'Untitled';
    
    // Trim whitespace
    let sanitized = labelName.trim();
    
    // Handle empty after trim
    if (!sanitized) return 'Untitled';
    
    // Replace illegal characters with safe alternatives
    // Gmail allows: letters, numbers, spaces, dashes, underscores, periods, slashes (for nesting)
    sanitized = sanitized.replace(/[^\w\s\-._/]/g, '-');
    
    // Clean up multiple consecutive spaces/dashes
    sanitized = sanitized.replace(/\s+/g, ' ').replace(/-+/g, '-');
    
    // Ensure no leading or trailing slashes (causes Gmail issues)
    sanitized = sanitized.replace(/^\/+|\/+$/g, '');
    
    // Clean up slash sequences (no empty nested levels)
    sanitized = sanitized.replace(/\/+/g, '/');
    
    // Truncate to Gmail's 40 character limit
    if (sanitized.length > 40) {
      // Try to truncate at word boundary or slash
      const truncated = sanitized.substring(0, 37);
      const lastSpace = truncated.lastIndexOf(' ');
      const lastSlash = truncated.lastIndexOf('/');
      const breakPoint = Math.max(lastSpace, lastSlash);
      
      if (breakPoint > 20) {
        sanitized = truncated.substring(0, breakPoint) + '...';
      } else {
        sanitized = truncated + '...';
      }
    }
    
    return sanitized;
  }

  /**
   * DRY-02: Centralized label creation utility
   * Eliminates duplicate label creation patterns
   */
  export function getOrCreateLabelDirect(labelName: string): GoogleAppsScript.Gmail.GmailLabel {
    const sanitizedName = sanitizeGmailLabel(labelName);
    
    // Log sanitization if name changed
    if (sanitizedName !== labelName) {
      AppLogger.info('Label name sanitized', { 
        original: labelName, 
        sanitized: sanitizedName 
      });
    }
    
    let label = GmailApp.getUserLabelByName(sanitizedName);
    if (!label) {
      label = GmailApp.createLabel(sanitizedName);
      AppLogger.info('Created new Gmail label', { labelName: sanitizedName });
    }
    return label;
  }

  /**
   * DRY-03: Standardized batch processing logging utilities
   * Eliminates duplicate batch completion logging patterns
   */
  export function logBatchComplete(context: string, stats: {
    totalEmails: number;
    successCount: number;
    errorCount: number;
    processingTime?: number;
    shortMessage?: string;
  }): void {
    AppLogger.info(`✅ ${context.toUpperCase()} COMPLETE`, {
      shortMessage: stats.shortMessage || `${context} complete: ${stats.successCount}/${stats.totalEmails} processed`,
      totalEmails: stats.totalEmails,
      successCount: stats.successCount,
      errorCount: stats.errorCount,
      processingTime: stats.processingTime
    });
  }

  export function logProcessingStart(context: string, count: number, mode?: string): void {
    AppLogger.info(`📦 ${context.toUpperCase()} START`, {
      count: count,
      mode: mode
    });
  }

  // REMOVED: StandardLabels interface and getStandardLabels function
  // Labels are now dynamic from docs, not hardcoded

  export function validateApiKeyFormat(apiKey: string): { isValid: boolean; message: string } {
    if (!apiKey || apiKey.trim() === '') {
      return { isValid: false, message: 'API key is required' };
    }

    const trimmedKey = apiKey.trim();
    
    // Basic length check - allow range of 30-60 characters
    if (trimmedKey.length < 30 || trimmedKey.length > 60) {
      return { isValid: false, message: 'API key must be between 30 and 60 characters long' };
    }

    // Gemini API key format validation - allow variable length after AIza prefix
    if (!trimmedKey.match(/^AIza[0-9A-Za-z\-_]{26,56}$/)) {
      return { 
        isValid: false, 
        message: 'Invalid format. Gemini API keys start with "AIza" followed by alphanumeric characters, hyphens, or underscores.' 
      };
    }

    return { isValid: true, message: 'API key format is valid' };
  }

  /**
   * Mask sensitive API keys in strings for safe logging
   * Enhanced coverage for multiple API key formats:
   * - Gemini: AIza... (various lengths)
   * - OpenAI: sk-... (various lengths)
   * - Anthropic: sk-ant-...
   * - Azure OpenAI: various formats
   * - Cohere, Hugging Face, etc.
   * - Generic patterns and Bearer tokens
   * - Base64-encoded keys
   * WARNING: This is a blacklist approach - new key formats may not be covered
   */
  export function maskApiKeys(text: string): string {
    if (!text || typeof text !== 'string') return text;
    
    // Gemini API keys: AIza followed by 30-50 chars (flexible length)
    text = text.replace(/AIza[0-9A-Za-z\-_]{30,50}/g, (match) => {
      return match.substring(0, 8) + '...' + match.substring(match.length - 4);
    });
    
    // OpenAI API keys: sk- followed by alphanumeric (flexible length)
    text = text.replace(/sk-[a-zA-Z0-9]{32,64}/g, (match) => {
      return 'sk-....' + match.substring(match.length - 4);
    });
    
    // Anthropic API keys: sk-ant- followed by alphanumeric
    text = text.replace(/sk-ant-[a-zA-Z0-9]{32,64}/g, (match) => {
      return 'sk-ant-....' + match.substring(match.length - 4);
    });
    
    // Azure OpenAI keys: various formats
    text = text.replace(/[a-f0-9]{32}/g, (match) => {
      // Only mask if it looks like a hex key (common Azure pattern)
      return match.substring(0, 4) + '...' + match.substring(match.length - 4);
    });
    
    // Cohere API keys: typically start with specific patterns
    text = text.replace(/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/g, (match) => {
      return match.substring(0, 8) + '...' + match.substring(match.length - 12);
    });
    
    // Hugging Face tokens: hf_xxx
    text = text.replace(/hf_[a-zA-Z0-9]{20,}/g, (match) => {
      return 'hf_....' + match.substring(match.length - 4);
    });
    
    // GitHub tokens: ghp_, gho_, ghs_, ghr_
    text = text.replace(/gh[pors]_[a-zA-Z0-9]{36}/g, (match) => {
      return match.substring(0, 8) + '...' + match.substring(match.length - 4);
    });
    
    // Base64-encoded keys (common pattern: 40+ chars of base64)
    text = text.replace(/[A-Za-z0-9+/]{40,}={0,2}/g, (match) => {
      // Only mask if it looks like base64 and is long enough to be a key
      if (match.length >= 40) {
        return match.substring(0, 8) + '...' + match.substring(match.length - 4);
      }
      return match;
    });
    
    // Generic API key patterns (handles various formats)
    // Matches: key=xxx, apikey=xxx, api_key=xxx, token=xxx, etc.
    text = text.replace(/([aA][pP][iI][-_]?[kK][eE][yY]\s*[=:]\s*)([a-zA-Z0-9\-_]{20,})/g, (_match, prefix, key) => {
      return prefix + key.substring(0, 4) + '...' + key.substring(key.length - 4);
    });
    
    text = text.replace(/([tT][oO][kK][eE][nN]\s*[=:]\s*)([a-zA-Z0-9\-_]{20,})/g, (_match, prefix, key) => {
      return prefix + key.substring(0, 4) + '...' + key.substring(key.length - 4);
    });
    
    // URL parameter API keys: ?key=xxx&, &key=xxx&, &key=xxx (end of string)
    text = text.replace(/([?&]key=)([a-zA-Z0-9\-_]{20,})(&|$)/g, (_match, prefix, key, suffix) => {
      return prefix + key.substring(0, 4) + '...' + key.substring(key.length - 4) + suffix;
    });
    
    text = text.replace(/([?&]token=)([a-zA-Z0-9\-_]{20,})(&|$)/g, (_match, prefix, key, suffix) => {
      return prefix + key.substring(0, 4) + '...' + key.substring(key.length - 4) + suffix;
    });
    
    // Bearer tokens
    text = text.replace(/(Bearer\s+)([a-zA-Z0-9\-_.]{30,})/g, (_match, prefix, token) => {
      return prefix + token.substring(0, 4) + '...' + token.substring(token.length - 4);
    });
    
    // Authorization headers
    text = text.replace(/(Authorization:\s*[^,\s]+\s+)([a-zA-Z0-9\-_.+/]{30,})/gi, (_match, prefix, token) => {
      return prefix + token.substring(0, 4) + '...' + token.substring(token.length - 4);
    });
    
    return text;
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
  
  /**
   * Generate a unique identifier
   */
  export function generateId(): string {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  /**
   * Get API key from user properties
   */
  export function getApiKey(): string | null {
    return PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.API_KEY);
  }
  
  /**
   * Format text for email with preserved whitespace and proper line breaks
   * Ensures plain text emails display correctly in Gmail
   */
  export function formatEmailText(text: string): string {
    if (!text) return '';
    
    // Ensure proper line breaks are preserved
    // Gmail sometimes needs double line breaks for proper paragraph separation
    return text
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\r/g, '\n')     // Handle Mac line endings
      .replace(/\n{3,}/g, '\n\n') // Limit multiple line breaks to double
      .trim();                   // Remove leading/trailing whitespace
  }
}