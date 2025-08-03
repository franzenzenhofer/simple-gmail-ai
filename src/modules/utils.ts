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

  /**
   * DRY-01: Standardized error logging utilities
   * Eliminates duplicate error handling patterns
   */
  export function logError(operation: string, error: unknown, additionalContext?: Record<string, any>): void {
    const errorDetails = preserveErrorStack(error);
    AppLogger.error(`Failed to ${operation}`, {
      error: errorDetails.fullError,
      stack: errorDetails.stack,
      ...additionalContext
    });
  }

  export function logWarning(operation: string, error: unknown, additionalContext?: Record<string, any>): void {
    const errorDetails = preserveErrorStack(error);
    AppLogger.warn(`Failed to ${operation}, continuing with fallback`, {
      error: errorDetails.fullError,
      ...additionalContext
    });
  }

  export function logAndSilentFail(operation: string, error: unknown, additionalContext?: Record<string, any>): void {
    const errorDetails = preserveErrorStack(error);
    AppLogger.warn(`${operation} failed silently`, {
      error: errorDetails.message,
      ...additionalContext
    });
  }

  /**
   * DRY-02: Centralized label creation utility
   * Eliminates duplicate label creation patterns
   */
  export function getOrCreateLabelDirect(labelName: string): GoogleAppsScript.Gmail.GmailLabel {
    let label = GmailApp.getUserLabelByName(labelName);
    if (!label) {
      label = GmailApp.createLabel(labelName);
      AppLogger.info('Created new Gmail label', { labelName: labelName });
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

  /**
   * DRY-04: Centralized configuration access utilities
   * Eliminates duplicate label retrieval patterns
   */
  export interface StandardLabels {
    support: GoogleAppsScript.Gmail.GmailLabel;
    notSupport: GoogleAppsScript.Gmail.GmailLabel;
    processed: GoogleAppsScript.Gmail.GmailLabel;
    error?: GoogleAppsScript.Gmail.GmailLabel;
    guardrailsFailed?: GoogleAppsScript.Gmail.GmailLabel;
  }

  export function getStandardLabels(includeOptional: boolean = false): StandardLabels {
    // Use the existing getOrCreateLabelDirect to avoid module dependencies
    const result: StandardLabels = {
      support: getOrCreateLabelDirect(Config.LABELS.SUPPORT),
      notSupport: getOrCreateLabelDirect(Config.LABELS.NOT_SUPPORT),
      processed: getOrCreateLabelDirect(Config.LABELS.AI_PROCESSED)
    };

    if (includeOptional) {
      result.error = getOrCreateLabelDirect(Config.LABELS.AI_ERROR);
      result.guardrailsFailed = getOrCreateLabelDirect(Config.LABELS.AI_GUARDRAILS_FAILED);
    }

    return result;
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
   * Mask sensitive API keys in strings for safe logging
   * Supports multiple API key formats:
   * - Gemini: AIza... (39 chars)
   * - OpenAI: sk-... 
   * - Anthropic: sk-ant-...
   * - Generic: xxx-xxx-xxx patterns
   */
  export function maskApiKeys(text: string): string {
    if (!text || typeof text !== 'string') return text;
    
    // Gemini API keys: AIza followed by 35 chars
    text = text.replace(/AIza[0-9A-Za-z\-_]{35}/g, (match) => {
      return match.substring(0, 8) + '...' + match.substring(match.length - 4);
    });
    
    // OpenAI API keys: sk- followed by alphanumeric
    text = text.replace(/sk-[a-zA-Z0-9]{48,}/g, (match) => {
      return 'sk-....' + match.substring(match.length - 4);
    });
    
    // Anthropic API keys: sk-ant- followed by alphanumeric
    text = text.replace(/sk-ant-[a-zA-Z0-9]{40,}/g, (match) => {
      return 'sk-ant-....' + match.substring(match.length - 4);
    });
    
    // Generic API key patterns (handles various formats)
    // Matches: key=xxx, apikey=xxx, api_key=xxx, etc.
    text = text.replace(/([aA][pP][iI][-_]?[kK][eE][yY]\s*[=:]\s*)([a-zA-Z0-9\-_]{20,})/g, (_match, prefix, key) => {
      return prefix + key.substring(0, 4) + '...' + key.substring(key.length - 4);
    });
    
    // URL parameter API keys: ?key=xxx&, &key=xxx&, &key=xxx (end of string)
    text = text.replace(/([?&]key=)([a-zA-Z0-9\-_]{20,})(&|$)/g, (_match, prefix, key, suffix) => {
      return prefix + key.substring(0, 4) + '...' + key.substring(key.length - 4) + suffix;
    });
    
    // Bearer tokens
    text = text.replace(/(Bearer\s+)([a-zA-Z0-9\-_.]{30,})/g, (_match, prefix, token) => {
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
    return PropertiesService.getUserProperties().getProperty('apiKey');
  }
}