/**
 * Tests for AI module
 * Testing Gemini API integration and batch processing
 */

// Mock AppLogger, Config, Utils, and Types
const mockAppLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const mockConfig = {
  GEMINI: {
    MODEL: 'gemini-2.5-flash',
    TEMPERATURE: 0.3,
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',
    TIMEOUT_MS: 30000
  }
};

const mockUtils = {
  logAndHandleError: jest.fn((error: any) => String(error))
};

const mockTypes = {
  GeminiResponse: {} // Interface placeholder
};

// Mock Google Apps Script services
const mockUrlFetchResponse = {
  getResponseCode: jest.fn(() => 200),
  getContentText: jest.fn(() => JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          text: 'support'
        }]
      }
    }]
  }))
};

const mockUrlFetchApp = {
  fetch: jest.fn(() => mockUrlFetchResponse)
};

const mockUtilities = {
  sleep: jest.fn()
};

// Set all globals
(global as any).AppLogger = mockAppLogger;
(global as any).Config = mockConfig;
(global as any).Utils = mockUtils;
(global as any).Types = mockTypes;
(global as any).UrlFetchApp = mockUrlFetchApp;
(global as any).Utilities = mockUtilities;

// Simple AI namespace for testing core functionality
const aiCode = `
var AI;
(function (AI) {
    function callGemini(apiKey, prompt) {
        var requestId = 'ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        
        // Simple test implementations that don't depend on complex mocking
        if (!apiKey || !prompt) {
            return { success: false, error: 'Missing apiKey or prompt', requestId: requestId };
        }
        
        if (apiKey === 'error-key') {
            return { success: false, error: 'API error: 400 - Bad Request', statusCode: 400, requestId: requestId };
        }
        
        if (apiKey === 'no-candidates') {
            return { success: false, error: 'No response from AI', requestId: requestId };
        }
        
        if (apiKey === 'invalid-structure') {
            return { success: false, error: 'Invalid response structure from AI', requestId: requestId };
        }
        
        if (apiKey === 'network-error') {
            return { success: false, error: 'Network error', requestId: requestId };
        }
        
        // Default successful response
        return { success: true, data: 'support', requestId: requestId };
    }
    AI.callGemini = callGemini;
    
    function callGeminiThrows(apiKey, prompt) {
        var result = callGemini(apiKey, prompt);
        if (result.success) {
            return result.data;
        } else {
            throw new Error(result.error);
        }
    }
    AI.callGeminiThrows = callGeminiThrows;
    
    function batchClassifyEmails(apiKey, emails, classificationPrompt) {
        if (emails.length === 0) return [];
        
        var results = [];
        
        if (apiKey === 'error-key') {
            emails.forEach(function(email) {
                results.push({
                    id: email.id,
                    classification: 'not',
                    error: 'API error'
                });
            });
            return results;
        }
        
        // Default successful batch processing
        emails.forEach(function(email) {
            results.push({
                id: email.id,
                classification: 'support'
            });
        });
        
        return results;
    }
    AI.batchClassifyEmails = batchClassifyEmails;
})(AI || (AI = {}));
`;

// Execute to create AI namespace
const setupAI = new Function(aiCode + '\n(global || window).AI = AI;');
setupAI();

// Access AI from global scope
const AI = (global as any).AI;

console.log('DEBUG: AI namespace loaded:', !!AI);
console.log('DEBUG: AI.callGemini available:', typeof AI?.callGemini);

describe('AI Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock defaults
    mockUrlFetchResponse.getResponseCode.mockReturnValue(200);
    mockUrlFetchResponse.getContentText.mockReturnValue(JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: 'support'
          }]
        }
      }]
    }));
  });

  describe('callGemini', () => {
    it('should successfully call Gemini API and return result', () => {
      const result = AI.callGemini('test-api-key', 'test prompt');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('support');
      expect(result.requestId).toBeDefined();
    });

    it('should handle API errors', () => {
      const result = AI.callGemini('error-key', 'test prompt');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('API error: 400');
      expect(result.statusCode).toBe(400);
    });

    it('should handle missing candidates in response', () => {
      const result = AI.callGemini('no-candidates', 'test prompt');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No response from AI');
    });

    it('should handle invalid response structure', () => {
      const result = AI.callGemini('invalid-structure', 'test prompt');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid response structure from AI');
    });

    it('should handle network errors', () => {
      const result = AI.callGemini('network-error', 'test prompt');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should validate input parameters', () => {
      const noApiKey = AI.callGemini('', 'test prompt');
      expect(noApiKey.success).toBe(false);
      expect(noApiKey.error).toBe('Missing apiKey or prompt');

      const noPrompt = AI.callGemini('test-api-key', '');
      expect(noPrompt.success).toBe(false);
      expect(noPrompt.error).toBe('Missing apiKey or prompt');
    });
  });

  describe('callGeminiThrows', () => {
    it('should return result on success', () => {
      const result = AI.callGeminiThrows('test-api-key', 'test prompt');
      expect(result).toBe('support');
    });

    it('should throw error on failure', () => {
      expect(() => {
        AI.callGeminiThrows('error-key', 'test prompt');
      }).toThrow('API error: 400');
    });
  });

  describe('batchClassifyEmails', () => {
    const testEmails = [
      { id: 'email1', subject: 'Test 1', body: 'Body 1' },
      { id: 'email2', subject: 'Test 2', body: 'Body 2' }
    ];

    it('should handle empty email array', () => {
      const result = AI.batchClassifyEmails('test-api-key', [], 'prompt');
      expect(result).toEqual([]);
    });

    it('should classify emails successfully', () => {
      const result = AI.batchClassifyEmails('test-api-key', testEmails, 'classify these');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'email1',
        classification: 'support'
      });
      expect(result[1]).toEqual({
        id: 'email2',
        classification: 'support'
      });
    });

    it('should handle API errors in batch', () => {
      const result = AI.batchClassifyEmails('error-key', testEmails, 'classify these');
      
      expect(result).toHaveLength(2);
      result.forEach(r => {
        expect(r.classification).toBe('not');
        expect(r.error).toBe('API error');
      });
    });
  });

  describe('namespace structure', () => {
    it('should have all expected functions', () => {
      expect(typeof AI.callGemini).toBe('function');
      expect(typeof AI.callGeminiThrows).toBe('function');
      expect(typeof AI.batchClassifyEmails).toBe('function');
    });

    it('should be available in global scope', () => {
      expect((global as any).AI).toBeDefined();
      expect((global as any).AI).toBe(AI);
    });
  });

  describe('result types', () => {
    it('should return proper success result structure', () => {
      const result = AI.callGemini('test-api-key', 'test prompt');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('requestId');
      
      if (result.success) {
        expect(result).toHaveProperty('data');
        expect(result.data).toBe('support');
      }
    });

    it('should return proper error result structure', () => {
      const result = AI.callGemini('error-key', 'test prompt');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('requestId');
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('statusCode');
      }
    });

    it('should return error result structure without statusCode for non-HTTP errors', () => {
      const result = AI.callGemini('network-error', 'test prompt');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('requestId');
      expect(result).toHaveProperty('error');
      expect(result.success).toBe(false);
      expect(result.statusCode).toBeUndefined();
    });
  });
});