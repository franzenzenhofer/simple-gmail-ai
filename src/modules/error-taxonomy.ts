/**
 * Error Taxonomy Module
 * Structured error handling with enum-driven error types
 */

namespace ErrorTaxonomy {
  
  /**
   * Enum of all possible error types in the application
   */
  export enum AppErrorType {
    // Network errors
    NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
    NETWORK_OFFLINE = 'NETWORK_OFFLINE',
    NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
    
    // API errors
    API_KEY_INVALID = 'API_KEY_INVALID',
    API_KEY_MISSING = 'API_KEY_MISSING',
    API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
    API_RATE_LIMITED = 'API_RATE_LIMITED',
    API_INVALID_RESPONSE = 'API_INVALID_RESPONSE',
    API_SERVICE_ERROR = 'API_SERVICE_ERROR',
    
    // Gmail errors
    GMAIL_PERMISSION_DENIED = 'GMAIL_PERMISSION_DENIED',
    GMAIL_LABEL_CREATE_FAILED = 'GMAIL_LABEL_CREATE_FAILED',
    GMAIL_DRAFT_CREATE_FAILED = 'GMAIL_DRAFT_CREATE_FAILED',
    GMAIL_MESSAGE_SEND_FAILED = 'GMAIL_MESSAGE_SEND_FAILED',
    GMAIL_THREAD_NOT_FOUND = 'GMAIL_THREAD_NOT_FOUND',
    GMAIL_QUOTA_EXCEEDED = 'GMAIL_QUOTA_EXCEEDED',
    
    // Processing errors
    PROCESSING_TIMEOUT = 'PROCESSING_TIMEOUT',
    PROCESSING_INVALID_DATA = 'PROCESSING_INVALID_DATA',
    PROCESSING_BATCH_FAILED = 'PROCESSING_BATCH_FAILED',
    
    // Configuration errors
    CONFIG_INVALID = 'CONFIG_INVALID',
    CONFIG_MISSING = 'CONFIG_MISSING',
    
    // Storage errors
    STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
    STORAGE_WRITE_FAILED = 'STORAGE_WRITE_FAILED',
    STORAGE_READ_FAILED = 'STORAGE_READ_FAILED',
    
    // Unknown errors
    UNKNOWN = 'UNKNOWN'
  }
  
  /**
   * Error severity levels
   */
  export enum ErrorSeverity {
    LOW = 'LOW',        // Can continue processing
    MEDIUM = 'MEDIUM',  // Some functionality affected
    HIGH = 'HIGH',      // Major functionality affected
    CRITICAL = 'CRITICAL' // Complete failure
  }
  
  /**
   * Structured error class
   */
  export class AppError extends Error {
    public readonly type: AppErrorType;
    public readonly severity: ErrorSeverity;
    public readonly context?: any;
    public readonly timestamp: string;
    public readonly recoverable: boolean;
    
    constructor(
      type: AppErrorType,
      message: string,
      severity: ErrorSeverity = ErrorSeverity.MEDIUM,
      recoverable: boolean = false,
      context?: any
    ) {
      super(message);
      this.name = 'AppError';
      this.type = type;
      this.severity = severity;
      this.recoverable = recoverable;
      this.context = context;
      this.timestamp = new Date().toISOString();
      
      // Maintain proper stack trace (not available in Apps Script environment)
      // In a browser/node environment, we would use Error.captureStackTrace
    }
    
    /**
     * Convert to log-friendly object
     */
    toLogObject(): object {
      return {
        type: this.type,
        severity: this.severity,
        message: this.message,
        recoverable: this.recoverable,
        timestamp: this.timestamp,
        context: this.context,
        stack: this.stack
      };
    }
  }
  
  /**
   * Error type to user-friendly message mapping
   */
  const ERROR_MESSAGES: Record<AppErrorType, string> = {
    // Network errors
    [AppErrorType.NETWORK_TIMEOUT]: 'The request timed out. Please check your connection and try again.',
    [AppErrorType.NETWORK_OFFLINE]: 'You appear to be offline. Please check your internet connection.',
    [AppErrorType.NETWORK_UNAVAILABLE]: 'The service is temporarily unavailable. Please try again later.',
    
    // API errors
    [AppErrorType.API_KEY_INVALID]: 'Your API key is invalid. Please check and update it in settings.',
    [AppErrorType.API_KEY_MISSING]: 'No API key configured. Please add your Gemini API key in settings.',
    [AppErrorType.API_QUOTA_EXCEEDED]: 'API quota exceeded. Please try again later or upgrade your plan.',
    [AppErrorType.API_RATE_LIMITED]: 'Too many requests. Please wait a moment before trying again.',
    [AppErrorType.API_INVALID_RESPONSE]: 'Received an invalid response from the AI service.',
    [AppErrorType.API_SERVICE_ERROR]: 'The AI service encountered an error. Please try again.',
    
    // Gmail errors
    [AppErrorType.GMAIL_PERMISSION_DENIED]: 'Gmail permission denied. Please reinstall the add-on.',
    [AppErrorType.GMAIL_LABEL_CREATE_FAILED]: 'Failed to create Gmail label. Please check your permissions.',
    [AppErrorType.GMAIL_DRAFT_CREATE_FAILED]: 'Failed to create email draft. Please try again.',
    [AppErrorType.GMAIL_MESSAGE_SEND_FAILED]: 'Failed to send email. Please check and try again.',
    [AppErrorType.GMAIL_THREAD_NOT_FOUND]: 'Email thread not found. It may have been deleted.',
    [AppErrorType.GMAIL_QUOTA_EXCEEDED]: 'Gmail quota exceeded. Please wait before processing more emails.',
    
    // Processing errors
    [AppErrorType.PROCESSING_TIMEOUT]: 'Processing took too long and was stopped. Try with fewer emails.',
    [AppErrorType.PROCESSING_INVALID_DATA]: 'Invalid data encountered during processing.',
    [AppErrorType.PROCESSING_BATCH_FAILED]: 'Batch processing failed. Some emails may not have been processed.',
    
    // Configuration errors
    [AppErrorType.CONFIG_INVALID]: 'Invalid configuration detected. Please check your settings.',
    [AppErrorType.CONFIG_MISSING]: 'Required configuration is missing. Please complete setup.',
    
    // Storage errors
    [AppErrorType.STORAGE_QUOTA_EXCEEDED]: 'Storage quota exceeded. Please clear some data.',
    [AppErrorType.STORAGE_WRITE_FAILED]: 'Failed to save data. Please try again.',
    [AppErrorType.STORAGE_READ_FAILED]: 'Failed to read saved data. Please try again.',
    
    // Unknown
    [AppErrorType.UNKNOWN]: 'An unexpected error occurred. Please try again.'
  };
  
  /**
   * Get user-friendly error message
   */
  export function getUserMessage(type: AppErrorType): string {
    return ERROR_MESSAGES[type] || ERROR_MESSAGES[AppErrorType.UNKNOWN];
  }
  
  /**
   * Create error from common scenarios
   */
  export function createError(type: AppErrorType, details?: string, context?: any): AppError {
    const message = details || getUserMessage(type);
    const severity = getDefaultSeverity(type);
    const recoverable = isRecoverable(type);
    
    return new AppError(type, message, severity, recoverable, context);
  }
  
  /**
   * Get default severity for error type
   */
  function getDefaultSeverity(type: AppErrorType): ErrorSeverity {
    switch (type) {
      // Critical errors
      case AppErrorType.API_KEY_MISSING:
      case AppErrorType.API_KEY_INVALID:
      case AppErrorType.GMAIL_PERMISSION_DENIED:
        return ErrorSeverity.CRITICAL;
        
      // High severity
      case AppErrorType.API_QUOTA_EXCEEDED:
      case AppErrorType.GMAIL_QUOTA_EXCEEDED:
      case AppErrorType.STORAGE_QUOTA_EXCEEDED:
      case AppErrorType.PROCESSING_TIMEOUT:
        return ErrorSeverity.HIGH;
        
      // Low severity
      case AppErrorType.API_RATE_LIMITED:
      case AppErrorType.NETWORK_TIMEOUT:
        return ErrorSeverity.LOW;
        
      // Default medium
      default:
        return ErrorSeverity.MEDIUM;
    }
  }
  
  /**
   * Check if error is recoverable
   */
  function isRecoverable(type: AppErrorType): boolean {
    switch (type) {
      case AppErrorType.NETWORK_TIMEOUT:
      case AppErrorType.API_RATE_LIMITED:
      case AppErrorType.GMAIL_DRAFT_CREATE_FAILED:
      case AppErrorType.STORAGE_WRITE_FAILED:
      case AppErrorType.STORAGE_READ_FAILED:
        return true;
      default:
        return false;
    }
  }
  
  /**
   * Wrap function with error taxonomy
   */
  export function wrapWithErrorHandling<T>(
    fn: () => T,
    errorType: AppErrorType = AppErrorType.UNKNOWN,
    context?: any
  ): T {
    try {
      return fn();
    } catch (error) {
      if (error instanceof AppError) {
        throw error; // Already structured
      }
      
      // Convert to structured error
      const appError = createError(
        errorType,
        error instanceof Error ? error.message : String(error),
        { ...context, originalError: error }
      );
      
      throw appError;
    }
  }
  
  /**
   * Async version of wrapWithErrorHandling
   */
  export async function wrapWithErrorHandlingAsync<T>(
    fn: () => Promise<T>,
    errorType: AppErrorType = AppErrorType.UNKNOWN,
    context?: any
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AppError) {
        throw error; // Already structured
      }
      
      // Convert to structured error
      const appError = createError(
        errorType,
        error instanceof Error ? error.message : String(error),
        { ...context, originalError: error }
      );
      
      throw appError;
    }
  }
  
  /**
   * Log error with appropriate level
   */
  export function logError(error: AppError | Error): void {
    if (error instanceof AppError) {
      const logData = error.toLogObject();
      
      switch (error.severity) {
        case ErrorSeverity.CRITICAL:
          AppLogger.error('CRITICAL ERROR', logData);
          break;
        case ErrorSeverity.HIGH:
          AppLogger.error('High severity error', logData);
          break;
        case ErrorSeverity.MEDIUM:
          AppLogger.warn('Medium severity error', logData);
          break;
        case ErrorSeverity.LOW:
          AppLogger.info('Low severity error', logData);
          break;
      }
    } else {
      // Regular error
      AppLogger.error('Unstructured error', {
        message: error.message,
        stack: error.stack,
        type: AppErrorType.UNKNOWN
      });
    }
  }
  
  /**
   * Create error response for UI
   */
  export function createErrorResponse(
    error: AppError | Error
  ): GoogleAppsScript.Card_Service.ActionResponse {
    const isAppError = error instanceof AppError;
    const message = isAppError ? getUserMessage(error.type) : error.message;
    const severity = isAppError ? error.severity : ErrorSeverity.MEDIUM;
    
    // Log the error
    logError(error);
    
    // Create notification based on severity
    const notification = CardService.newNotification();
    
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        notification.setText('❌ ' + message);
        break;
      case ErrorSeverity.HIGH:
        notification.setText('⚠️ ' + message);
        break;
      default:
        notification.setText('ℹ️ ' + message);
    }
    
    return CardService.newActionResponseBuilder()
      .setNotification(notification)
      .build();
  }
  
  /**
   * Parse error from various sources
   */
  export function parseError(error: any): AppError {
    // Already an AppError
    if (error instanceof AppError) {
      return error;
    }
    
    // Check for common error patterns
    const errorString = String(error).toLowerCase();
    const message = error?.message?.toLowerCase() || errorString;
    
    // Network errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return createError(AppErrorType.NETWORK_TIMEOUT, error.message);
    }
    
    if (message.includes('offline') || message.includes('network')) {
      return createError(AppErrorType.NETWORK_OFFLINE, error.message);
    }
    
    // API errors
    if (message.includes('api key') || message.includes('apikey')) {
      if (message.includes('invalid') || message.includes('unauthorized')) {
        return createError(AppErrorType.API_KEY_INVALID, error.message);
      }
      if (message.includes('missing') || message.includes('required')) {
        return createError(AppErrorType.API_KEY_MISSING, error.message);
      }
    }
    
    if (message.includes('quota') || message.includes('limit exceeded')) {
      if (message.includes('gmail')) {
        return createError(AppErrorType.GMAIL_QUOTA_EXCEEDED, error.message);
      }
      return createError(AppErrorType.API_QUOTA_EXCEEDED, error.message);
    }
    
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return createError(AppErrorType.API_RATE_LIMITED, error.message);
    }
    
    // Gmail errors
    if (message.includes('permission') || message.includes('access denied')) {
      return createError(AppErrorType.GMAIL_PERMISSION_DENIED, error.message);
    }
    
    if (message.includes('label') && message.includes('fail')) {
      return createError(AppErrorType.GMAIL_LABEL_CREATE_FAILED, error.message);
    }
    
    if (message.includes('draft') && message.includes('fail')) {
      return createError(AppErrorType.GMAIL_DRAFT_CREATE_FAILED, error.message);
    }
    
    // Default unknown error
    return createError(AppErrorType.UNKNOWN, error.message || 'Unknown error');
  }
}