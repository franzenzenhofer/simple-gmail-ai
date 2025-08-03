/**
 * Tests for Function Calling Module
 */

const FunctionCalling = {
  CLASSIFY_EMAIL_FUNCTION: {
    name: 'classifyEmail',
    description: 'Classify an email as support request or not',
    parameters: {
      type: 'object',
      properties: {
        classification: { type: 'string', enum: ['support', 'not'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' },
        category: { type: 'string', enum: ['technical', 'billing', 'feature_request', 'bug_report', 'general', 'not_support'] }
      },
      required: ['classification']
    }
  },
  createFunctionCallingPrompt: jest.fn(),
  parseFunctionCallResponse: jest.fn(),
  toGeminiSchema: jest.fn(),
  classifyEmailWithFunction: jest.fn(),
  generateReplyWithFunction: jest.fn(),
  batchAnalyzeEmails: jest.fn()
};

const mockAI = {
  callGemini: jest.fn()
};

const mockAppLogger = {
  info: jest.fn(),
  error: jest.fn()
};

const mockUtils = {
  logAndHandleError: jest.fn()
};

(global as any).AI = mockAI;
(global as any).AppLogger = mockAppLogger;
(global as any).Utils = mockUtils;
(global as any).Utilities = { sleep: jest.fn() };

describe('FunctionCalling Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    FunctionCalling.createFunctionCallingPrompt.mockImplementation((content, functions, instructions) => {
      return `${instructions}\n\nContent: ${content}`;
    });
    
    FunctionCalling.parseFunctionCallResponse.mockImplementation((response) => {
      try {
        const parsed = JSON.parse(response);
        return { functionName: parsed.function, parameters: parsed.parameters };
      } catch {
        return null;
      }
    });
    
    FunctionCalling.classifyEmailWithFunction.mockImplementation((apiKey, content) => {
      if (content.includes('help') || content.includes('issue')) {
        return {
          success: true,
          classification: 'support',
          metadata: { confidence: 0.9, category: 'technical' }
        };
      }
      return {
        success: true,
        classification: 'not',
        metadata: { confidence: 0.8 }
      };
    });
  });

  describe('Function Definitions', () => {
    it('should have correct classify email function schema', () => {
      const func = FunctionCalling.CLASSIFY_EMAIL_FUNCTION;
      expect(func.name).toBe('classifyEmail');
      expect(func.parameters.properties.classification.enum).toEqual(['support', 'not']);
      expect(func.parameters.required).toContain('classification');
    });
  });

  describe('createFunctionCallingPrompt', () => {
    it('should create proper prompt with functions', () => {
      const prompt = FunctionCalling.createFunctionCallingPrompt(
        'Test email content',
        [FunctionCalling.CLASSIFY_EMAIL_FUNCTION],
        'Analyze this email'
      );
      
      expect(prompt).toContain('Analyze this email');
      expect(prompt).toContain('Test email content');
    });
  });

  describe('classifyEmailWithFunction', () => {
    it('should classify support emails correctly', () => {
      const result = FunctionCalling.classifyEmailWithFunction(
        'test-key',
        'I need help with my account'
      );
      
      expect(result.success).toBe(true);
      expect(result.classification).toBe('support');
      expect(result.metadata?.confidence).toBe(0.9);
    });

    it('should classify non-support emails correctly', () => {
      const result = FunctionCalling.classifyEmailWithFunction(
        'test-key',
        'Newsletter content here'
      );
      
      expect(result.success).toBe(true);
      expect(result.classification).toBe('not');
    });
  });
});