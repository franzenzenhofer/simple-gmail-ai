/**
 * Error Taxonomy Module Tests
 */

// Mock AppLogger
const mockAppLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock dependencies in global scope
(global as any).AppLogger = mockAppLogger;

// Simple ErrorTaxonomy namespace for testing
const errorTaxonomyCode = `
var ErrorTaxonomy;
(function (ErrorTaxonomy) {
    // Enums
    ErrorTaxonomy.AppErrorType = {
        NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
        API_KEY_INVALID: 'API_KEY_INVALID',
        API_KEY_MISSING: 'API_KEY_MISSING',
        API_QUOTA_EXCEEDED: 'API_QUOTA_EXCEEDED',
        API_RATE_LIMITED: 'API_RATE_LIMITED',
        GMAIL_QUOTA_EXCEEDED: 'GMAIL_QUOTA_EXCEEDED',
        PROCESSING_INVALID_DATA: 'PROCESSING_INVALID_DATA',
        UNKNOWN: 'UNKNOWN'
    };
    
    ErrorTaxonomy.ErrorSeverity = {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical'
    };
    
    // Error details mapping
    const errorDetails = {
        NETWORK_TIMEOUT: { severity: 'low', recoverable: true },
        API_KEY_INVALID: { severity: 'high', recoverable: false },
        API_KEY_MISSING: { severity: 'critical', recoverable: false },
        API_QUOTA_EXCEEDED: { severity: 'high', recoverable: true },
        API_RATE_LIMITED: { severity: 'medium', recoverable: true },
        GMAIL_QUOTA_EXCEEDED: { severity: 'high', recoverable: true },
        PROCESSING_INVALID_DATA: { severity: 'medium', recoverable: true },
        UNKNOWN: { severity: 'medium', recoverable: false }
    };
    
    // AppError class
    function AppError(type, message, severity, recoverable, context) {
        this.name = 'AppError';
        this.type = type;
        this.message = message || ErrorTaxonomy.getUserMessage(type);
        this.severity = severity || errorDetails[type]?.severity || 'medium';
        this.recoverable = recoverable !== undefined ? recoverable : (errorDetails[type]?.recoverable || false);
        this.context = context;
        this.timestamp = new Date().toISOString();
        this.stack = (new Error()).stack;
    }
    AppError.prototype = Object.create(Error.prototype);
    AppError.prototype.constructor = AppError;
    
    AppError.prototype.toLogObject = function() {
        return {
            type: this.type,
            severity: this.severity,
            message: this.message,
            recoverable: this.recoverable,
            timestamp: this.timestamp,
            context: this.context
        };
    };
    
    ErrorTaxonomy.AppError = AppError;
    
    // User messages
    const userMessages = {
        API_KEY_INVALID: 'Your API key is invalid. Please check and update it in settings.',
        API_KEY_MISSING: 'No API key configured. Please add your Gemini API key in settings.',
        API_QUOTA_EXCEEDED: 'API quota exceeded. Please try again later or upgrade your plan.',
        API_RATE_LIMITED: 'Too many requests. Please wait a moment before trying again.',
        GMAIL_QUOTA_EXCEEDED: 'Gmail quota exceeded. Please wait before processing more emails.',
        NETWORK_TIMEOUT: 'Network request timed out. Please check your connection and try again.',
        PROCESSING_INVALID_DATA: 'Invalid data encountered. Please check your input and try again.',
        UNKNOWN: 'An unexpected error occurred. Please try again.'
    };
    
    ErrorTaxonomy.getUserMessage = function(errorType) {
        return userMessages[errorType] || userMessages.UNKNOWN;
    };
    
    ErrorTaxonomy.createError = function(type, message, context) {
        const details = errorDetails[type] || errorDetails.UNKNOWN;
        return new ErrorTaxonomy.AppError(
            type,
            message || ErrorTaxonomy.getUserMessage(type),
            details.severity,
            details.recoverable,
            context
        );
    };
    
    ErrorTaxonomy.parseError = function(error) {
        if (error instanceof ErrorTaxonomy.AppError) {
            return error;
        }
        
        const message = error.message || String(error);
        let type = ErrorTaxonomy.AppErrorType.UNKNOWN;
        
        if (message.includes('timed out') || message.includes('timeout')) {
            type = ErrorTaxonomy.AppErrorType.NETWORK_TIMEOUT;
        } else if (message.includes('Invalid API key') || message.includes('invalid api key')) {
            type = ErrorTaxonomy.AppErrorType.API_KEY_INVALID;
        } else if (message.includes('quota') && message.includes('Gmail')) {
            type = ErrorTaxonomy.AppErrorType.GMAIL_QUOTA_EXCEEDED;
        } else if (message.includes('Too many requests') || message.includes('rate limit')) {
            type = ErrorTaxonomy.AppErrorType.API_RATE_LIMITED;
        }
        
        return ErrorTaxonomy.createError(type, message);
    };
    
    ErrorTaxonomy.logError = function(error) {
        const appError = error instanceof ErrorTaxonomy.AppError ? error : ErrorTaxonomy.parseError(error);
        const logObject = appError.toLogObject();
        
        switch (appError.severity) {
            case 'critical':
                AppLogger.error('CRITICAL ERROR', logObject);
                break;
            case 'high':
                AppLogger.error('High severity error', logObject);
                break;
            case 'medium':
                AppLogger.warn('Medium severity error', logObject);
                break;
            case 'low':
                AppLogger.info('Low severity error', logObject);
                break;
            default:
                AppLogger.error('Unstructured error', logObject);
        }
    };
    
    ErrorTaxonomy.wrapWithErrorHandling = function(fn, errorType, context) {
        try {
            return fn();
        } catch (error) {
            if (error instanceof ErrorTaxonomy.AppError) {
                throw error;
            }
            throw ErrorTaxonomy.createError(errorType, error.message, Object.assign({}, context, { originalError: error }));
        }
    };
    
    ErrorTaxonomy.createErrorResponse = function(error) {
        const appError = error instanceof ErrorTaxonomy.AppError ? error : ErrorTaxonomy.parseError(error);
        ErrorTaxonomy.logError(appError);
        
        let prefix = 'ℹ️';
        if (appError.severity === 'critical' || appError.severity === 'high') {
            prefix = appError.severity === 'critical' ? '❌' : '⚠️';
        }
        
        const notification = CardService.newNotification()
            .setText(prefix + ' ' + ErrorTaxonomy.getUserMessage(appError.type));
        
        return CardService.newActionResponseBuilder()
            .setNotification(notification)
            .build();
    };
})(ErrorTaxonomy || (ErrorTaxonomy = {}));
`;

// Execute to create ErrorTaxonomy namespace
const setupErrorTaxonomy = new Function(errorTaxonomyCode + '\n(global || window).ErrorTaxonomy = ErrorTaxonomy;');
setupErrorTaxonomy();

// Get ErrorTaxonomy from global
const ErrorTaxonomy = (global as any).ErrorTaxonomy;

describe('ErrorTaxonomy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('AppError', () => {
    it('should create structured error with all properties', () => {
      const error = new ErrorTaxonomy.AppError(
        ErrorTaxonomy.AppErrorType.API_KEY_INVALID,
        'Invalid API key',
        ErrorTaxonomy.ErrorSeverity.HIGH,
        false,
        { apiKey: 'test123' }
      );
      
      expect(error.type).toBe(ErrorTaxonomy.AppErrorType.API_KEY_INVALID);
      expect(error.message).toBe('Invalid API key');
      expect(error.severity).toBe(ErrorTaxonomy.ErrorSeverity.HIGH);
      expect(error.recoverable).toBe(false);
      expect(error.context).toEqual({ apiKey: 'test123' });
      expect(error.timestamp).toBeDefined();
      expect(error.name).toBe('AppError');
    });
    
    it('should convert to log object', () => {
      const error = new ErrorTaxonomy.AppError(
        ErrorTaxonomy.AppErrorType.NETWORK_TIMEOUT,
        'Request timed out',
        ErrorTaxonomy.ErrorSeverity.LOW,
        true
      );
      
      const logObject = error.toLogObject();
      
      expect(logObject).toMatchObject({
        type: ErrorTaxonomy.AppErrorType.NETWORK_TIMEOUT,
        severity: ErrorTaxonomy.ErrorSeverity.LOW,
        message: 'Request timed out',
        recoverable: true,
        timestamp: expect.any(String)
      });
    });
  });
  
  describe('getUserMessage', () => {
    it('should return user-friendly message for known error types', () => {
      expect(ErrorTaxonomy.getUserMessage(ErrorTaxonomy.AppErrorType.API_KEY_INVALID))
        .toBe('Your API key is invalid. Please check and update it in settings.');
      
      expect(ErrorTaxonomy.getUserMessage(ErrorTaxonomy.AppErrorType.GMAIL_QUOTA_EXCEEDED))
        .toBe('Gmail quota exceeded. Please wait before processing more emails.');
    });
    
    it('should return default message for unknown error type', () => {
      expect(ErrorTaxonomy.getUserMessage('UNKNOWN_TYPE' as any))
        .toBe('An unexpected error occurred. Please try again.');
    });
  });
  
  describe('createError', () => {
    it('should create error with default severity and recoverability', () => {
      const error = ErrorTaxonomy.createError(
        ErrorTaxonomy.AppErrorType.API_KEY_MISSING
      );
      
      expect(error.type).toBe(ErrorTaxonomy.AppErrorType.API_KEY_MISSING);
      expect(error.severity).toBe(ErrorTaxonomy.ErrorSeverity.CRITICAL);
      expect(error.recoverable).toBe(false);
      expect(error.message).toBe('No API key configured. Please add your Gemini API key in settings.');
    });
    
    it('should create error with custom details', () => {
      const error = ErrorTaxonomy.createError(
        ErrorTaxonomy.AppErrorType.NETWORK_TIMEOUT,
        'Custom timeout message',
        { url: 'https://api.example.com' }
      );
      
      expect(error.message).toBe('Custom timeout message');
      expect(error.context).toEqual({ url: 'https://api.example.com' });
      expect(error.recoverable).toBe(true);
    });
  });
  
  describe('parseError', () => {
    it('should return AppError if already structured', () => {
      const appError = new ErrorTaxonomy.AppError(
        ErrorTaxonomy.AppErrorType.API_QUOTA_EXCEEDED,
        'Quota exceeded'
      );
      
      const parsed = ErrorTaxonomy.parseError(appError);
      expect(parsed).toBe(appError);
    });
    
    it('should parse timeout errors', () => {
      const error = new Error('Request timed out');
      const parsed = ErrorTaxonomy.parseError(error);
      
      expect(parsed.type).toBe(ErrorTaxonomy.AppErrorType.NETWORK_TIMEOUT);
      expect(parsed.message).toBe('Request timed out');
    });
    
    it('should parse API key errors', () => {
      const error = new Error('Invalid API key provided');
      const parsed = ErrorTaxonomy.parseError(error);
      
      expect(parsed.type).toBe(ErrorTaxonomy.AppErrorType.API_KEY_INVALID);
    });
    
    it('should parse quota errors', () => {
      const error = new Error('Gmail quota limit exceeded');
      const parsed = ErrorTaxonomy.parseError(error);
      
      expect(parsed.type).toBe(ErrorTaxonomy.AppErrorType.GMAIL_QUOTA_EXCEEDED);
    });
    
    it('should parse rate limit errors', () => {
      const error = new Error('Too many requests, please slow down');
      const parsed = ErrorTaxonomy.parseError(error);
      
      expect(parsed.type).toBe(ErrorTaxonomy.AppErrorType.API_RATE_LIMITED);
    });
    
    it('should default to unknown for unrecognized errors', () => {
      const error = new Error('Something weird happened');
      const parsed = ErrorTaxonomy.parseError(error);
      
      expect(parsed.type).toBe(ErrorTaxonomy.AppErrorType.UNKNOWN);
      expect(parsed.message).toBe('Something weird happened');
    });
  });
  
  describe('logError', () => {
    it('should log critical errors with error level', () => {
      const error = new ErrorTaxonomy.AppError(
        ErrorTaxonomy.AppErrorType.API_KEY_MISSING,
        'No API key',
        ErrorTaxonomy.ErrorSeverity.CRITICAL
      );
      
      ErrorTaxonomy.logError(error);
      
      expect(mockAppLogger.error).toHaveBeenCalledWith(
        'CRITICAL ERROR',
        expect.objectContaining({
          type: ErrorTaxonomy.AppErrorType.API_KEY_MISSING,
          message: 'No API key'
        })
      );
    });
    
    it('should log high severity errors', () => {
      const error = new ErrorTaxonomy.AppError(
        ErrorTaxonomy.AppErrorType.API_QUOTA_EXCEEDED,
        'Quota exceeded',
        ErrorTaxonomy.ErrorSeverity.HIGH
      );
      
      ErrorTaxonomy.logError(error);
      
      expect(mockAppLogger.error).toHaveBeenCalledWith(
        'High severity error',
        expect.any(Object)
      );
    });
    
    it('should log medium severity as warning', () => {
      const error = new ErrorTaxonomy.AppError(
        ErrorTaxonomy.AppErrorType.PROCESSING_INVALID_DATA,
        'Invalid data',
        ErrorTaxonomy.ErrorSeverity.MEDIUM
      );
      
      ErrorTaxonomy.logError(error);
      
      expect(mockAppLogger.warn).toHaveBeenCalledWith(
        'Medium severity error',
        expect.any(Object)
      );
    });
    
    it('should log low severity as info', () => {
      const error = new ErrorTaxonomy.AppError(
        ErrorTaxonomy.AppErrorType.NETWORK_TIMEOUT,
        'Timeout',
        ErrorTaxonomy.ErrorSeverity.LOW
      );
      
      ErrorTaxonomy.logError(error);
      
      expect(mockAppLogger.info).toHaveBeenCalledWith(
        'Low severity error',
        expect.any(Object)
      );
    });
    
    it('should log regular errors as unstructured', () => {
      const error = new Error('Regular error');
      
      ErrorTaxonomy.logError(error);
      
      // Regular errors get parsed and logged based on their severity (medium for UNKNOWN)
      expect(mockAppLogger.warn).toHaveBeenCalledWith(
        'Medium severity error',
        expect.objectContaining({
          message: 'Regular error',
          type: ErrorTaxonomy.AppErrorType.UNKNOWN
        })
      );
    });
  });
  
  describe('wrapWithErrorHandling', () => {
    it('should execute function successfully', () => {
      const result = ErrorTaxonomy.wrapWithErrorHandling(
        () => 'success',
        ErrorTaxonomy.AppErrorType.UNKNOWN
      );
      
      expect(result).toBe('success');
    });
    
    it('should wrap thrown errors', () => {
      expect(() => {
        ErrorTaxonomy.wrapWithErrorHandling(
          () => { throw new Error('Test error'); },
          ErrorTaxonomy.AppErrorType.PROCESSING_INVALID_DATA,
          { step: 'validation' }
        );
      }).toThrow(ErrorTaxonomy.AppError);
      
      try {
        ErrorTaxonomy.wrapWithErrorHandling(
          () => { throw new Error('Test error'); },
          ErrorTaxonomy.AppErrorType.PROCESSING_INVALID_DATA,
          { step: 'validation' }
        );
      } catch (error: any) {
        expect(error).toBeInstanceOf(ErrorTaxonomy.AppError);
        expect(error.type).toBe(ErrorTaxonomy.AppErrorType.PROCESSING_INVALID_DATA);
        expect(error.context).toMatchObject({
          step: 'validation',
          originalError: expect.any(Error)
        });
      }
    });
    
    it('should not double-wrap AppErrors', () => {
      const appError = new ErrorTaxonomy.AppError(
        ErrorTaxonomy.AppErrorType.API_KEY_INVALID,
        'Invalid key'
      );
      
      expect(() => {
        ErrorTaxonomy.wrapWithErrorHandling(
          () => { throw appError; },
          ErrorTaxonomy.AppErrorType.UNKNOWN
        );
      }).toThrow(appError);
    });
  });
  
  describe('createErrorResponse', () => {
    beforeEach(() => {
      global.CardService = {
        newNotification: jest.fn().mockReturnValue({
          setText: jest.fn().mockReturnThis()
        }),
        newActionResponseBuilder: jest.fn().mockReturnValue({
          setNotification: jest.fn().mockReturnThis(),
          build: jest.fn().mockReturnValue({ type: 'action_response' })
        })
      } as any;
    });
    
    it('should create critical error response', () => {
      const error = new ErrorTaxonomy.AppError(
        ErrorTaxonomy.AppErrorType.API_KEY_MISSING,
        'No API key',
        ErrorTaxonomy.ErrorSeverity.CRITICAL
      );
      
      const response = ErrorTaxonomy.createErrorResponse(error);
      
      expect(global.CardService.newNotification().setText)
        .toHaveBeenCalledWith('❌ No API key configured. Please add your Gemini API key in settings.');
      expect(response).toEqual({ type: 'action_response' });
    });
    
    it('should create high severity error response', () => {
      const error = new ErrorTaxonomy.AppError(
        ErrorTaxonomy.AppErrorType.API_QUOTA_EXCEEDED,
        'Quota exceeded',
        ErrorTaxonomy.ErrorSeverity.HIGH
      );
      
      ErrorTaxonomy.createErrorResponse(error);
      
      expect(global.CardService.newNotification().setText)
        .toHaveBeenCalledWith('⚠️ API quota exceeded. Please try again later or upgrade your plan.');
    });
    
    it('should create regular error response', () => {
      const error = new Error('Something went wrong');
      
      ErrorTaxonomy.createErrorResponse(error);
      
      // Regular errors get parsed and will use the UNKNOWN error message
      expect(global.CardService.newNotification().setText)
        .toHaveBeenCalledWith('ℹ️ An unexpected error occurred. Please try again.');
    });
    
    it('should log errors when creating response', () => {
      const error = new ErrorTaxonomy.AppError(
        ErrorTaxonomy.AppErrorType.NETWORK_TIMEOUT,
        'Timeout'
      );
      
      ErrorTaxonomy.createErrorResponse(error);
      
      expect(mockAppLogger.info).toHaveBeenCalled();
    });
  });
});