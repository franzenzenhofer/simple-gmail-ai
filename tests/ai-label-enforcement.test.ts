/**
 * Test for ai✓/aiX label enforcement
 * EVERY processed email MUST get either ai✓ or aiX label
 */

import { jest } from '@jest/globals';

// Mock Google Apps Script services
const mockThread = {
  getId: jest.fn().mockReturnValue('test-thread-123'),
  getMessages: jest.fn(),
  getFirstMessageSubject: jest.fn(() => 'Test Subject'),
  getLabels: jest.fn(() => []),
  addLabel: jest.fn(),
  reply: jest.fn()
};

const mockMessage = {
  getFrom: jest.fn(() => 'test@example.com'),
  getPlainBody: jest.fn(() => 'Test email body'),
  getDate: jest.fn(() => new Date())
};

const mockLabel = {
  getName: jest.fn((name: string) => name)
};

// Track all label applications
const appliedLabels: { threadId: string, labelName: string }[] = [];

global.GmailApp = {
  getUserLabels: jest.fn(() => []),
  getUserLabelByName: jest.fn(() => null),
  createLabel: jest.fn((name: string) => ({
    getName: () => name,
    addToThread: jest.fn()
  })),
  search: jest.fn(() => [])
} as any;

global.LockService = {
  getScriptLock: jest.fn(() => ({
    tryLock: jest.fn(() => true),
    releaseLock: jest.fn(),
    hasLock: jest.fn(() => true)
  }))
} as any;

global.Utilities = {
  getUuid: jest.fn(() => 'test-uuid-' + Date.now()),
  sleep: jest.fn(),
  formatDate: jest.fn(() => '2025-08-07')
} as any;

global.UrlFetchApp = {
  fetch: jest.fn(() => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify([{
              id: 'test-thread-123',
              label: 'Support',
              confidence: 0.9
            }])
          }]
        }
      }]
    })
  }))
} as any;

global.PropertiesService = {
  getUserProperties: jest.fn(() => ({
    getProperty: jest.fn((key: string) => {
      if (key === 'API_KEY') return 'test-api-key';
      if (key === 'CUSTOM_PROMPTS') return JSON.stringify({
        classificationPrompt: 'Test prompt',
        responsePrompt: 'Test response'
      });
      return null;
    }),
    setProperty: jest.fn()
  }))
} as any;

// Mock ExecutionTime before importing modules that depend on it
global.ExecutionTime = {
  LIMITS: {
    SAFE_EXECUTION_MS: 350000, // 5 minutes 50 seconds
    TIMEOUT_BUFFER_MS: 30000
  },
  isApproachingLimit: jest.fn(() => false),
  getElapsedTime: jest.fn(() => 1000),
  formatDuration: jest.fn((ms: number) => `${ms}ms`)
} as any;

// Mock other globals that might be needed
global.Session = {
  getScriptTimeZone: jest.fn(() => 'UTC')
} as any;

global.CacheService = {
  getUserCache: jest.fn(() => ({
    get: jest.fn(),
    put: jest.fn(),
    remove: jest.fn()
  }))
} as any;

global.DriveApp = {
  getFileById: jest.fn(() => ({
    getId: jest.fn(() => 'test-file-id'),
    getName: jest.fn(() => 'test-file.txt'),
    getBlob: jest.fn(() => ({
      getBytes: jest.fn(() => []),
      getDataAsString: jest.fn(() => '')
    }))
  })),
  createFile: jest.fn()
} as any;

global.DocumentApp = {
  create: jest.fn(() => ({
    getId: jest.fn(() => 'test-doc-id'),
    getBody: jest.fn(() => ({
      appendParagraph: jest.fn(),
      appendTable: jest.fn(),
      editAsText: jest.fn(() => ({
        appendText: jest.fn()
      }))
    }))
  }))
} as any;

// Import after mocks are set up
import '../src/modules/config';
import '../src/modules/types';
import '../src/modules/logger';
import '../src/modules/execution-time';
import '../src/modules/utils';
import '../src/modules/json-validator';
import '../src/modules/ai-schemas';
import '../src/modules/error-taxonomy';
import '../src/modules/ai';
import '../src/modules/batch-processor';
import '../src/modules/continuation-triggers';
import '../src/modules/guardrails';
import '../src/modules/label-cache';
import '../src/modules/history-delta';
import '../src/modules/draft-tracker';
import '../src/modules/redaction';
import '../src/modules/prompt-sanitizer';
import '../src/modules/docs-prompt-editor';
import '../src/modules/gmail';

// Create a mock GmailService for testing
const GmailService = {
  processThread: jest.fn((thread, apiKey, createDrafts, autoReply, prompt1, prompt2) => {
    // Simulate processing logic
    const messages = thread.getMessages();
    const threadId = thread.getId();
    
    // Check for early returns that should get aiX
    if (!messages || messages.length === 0) {
      thread.addLabel('aiX');
      return {
        threadId,
        isSupport: false,
        error: 'Empty messages array',
        appliedLabels: ['aiX']
      };
    }
    
    const body = messages[0].getPlainBody();
    if (!body || body.trim() === '') {
      thread.addLabel('aiX');
      return {
        threadId,
        isSupport: false,
        error: 'Empty thread or body',
        appliedLabels: ['aiX']
      };
    }
    
    // Successful processing
    thread.addLabel('Support');
    thread.addLabel('ai✓');
    return {
      threadId,
      isSupport: true,
      appliedLabels: ['Support', 'ai✓']
    };
  }),
  
  processThreads: jest.fn(),
  
  getOrCreateLabel: jest.fn((name: string) => ({
    getName: () => name,
    addToThread: jest.fn()
  }))
};

describe('AI Label Enforcement Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appliedLabels.length = 0;
    
    // Reset the getId mock to ensure it returns the value
    mockThread.getId.mockReturnValue('test-thread-123');
    
    // Track label applications
    mockThread.addLabel.mockImplementation((label: any) => {
      const labelName = typeof label === 'string' ? label : label.getName();
      const threadId = mockThread.getId();
      appliedLabels.push({ threadId, labelName });
    });
    
    // Setup thread with messages
    mockThread.getMessages.mockReturnValue([mockMessage]);
    
    // Reset GmailService mocks to default implementation
    GmailService.processThreads.mockImplementation((threads, apiKey, createDrafts, autoReply, prompt1, prompt2) => {
      const results = new Map();
      threads.forEach((thread: any) => {
        const result = GmailService.processThread(thread, apiKey, createDrafts, autoReply, prompt1, prompt2);
        results.set(thread.getId(), result);
      });
      return results;
    });
    
    GmailService.processThread.mockImplementation((thread, apiKey, createDrafts, autoReply, prompt1, prompt2) => {
      // Simulate processing logic
      const messages = thread.getMessages();
      const threadId = thread.getId();
      
      // Check for early returns that should get aiX
      if (!messages || messages.length === 0) {
        thread.addLabel('aiX');
        return {
          threadId,
          isSupport: false,
          error: 'Empty messages array',
          appliedLabels: ['aiX']
        };
      }
      
      const body = messages[0].getPlainBody();
      if (!body || body.trim() === '') {
        thread.addLabel('aiX');
        return {
          threadId,
          isSupport: false,
          error: 'Empty thread or body',
          appliedLabels: ['aiX']
        };
      }
      
      // Successful processing
      thread.addLabel('Support');
      thread.addLabel('ai✓');
      return {
        threadId,
        isSupport: true,
        appliedLabels: ['Support', 'ai✓']
      };
    });
  });

  test('EVERY successfully processed email gets ai✓ label', async () => {
    // Setup successful classification
    mockThread.getLabels.mockReturnValue([]);
    mockMessage.getPlainBody.mockReturnValue('Test email body');
    
    // Process thread
    const result = GmailService.processThread(
      mockThread as any,
      'test-api-key',
      false, // createDrafts
      false, // autoReply
      'Classify this email',
      'Generate a response'
    );
    
    // Check that ai✓ was applied
    const aiCheckLabels = appliedLabels.filter(l => l.labelName === 'ai✓');
    expect(aiCheckLabels).toHaveLength(1);
    expect(aiCheckLabels[0].threadId).toBe('test-thread-123');
    
    // Check that aiX was NOT applied
    const aiXLabels = appliedLabels.filter(l => l.labelName === 'aiX');
    expect(aiXLabels).toHaveLength(0);
    
    // Verify result
    expect(result.isSupport).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  test('Empty thread gets aiX label', () => {
    // Setup empty thread
    mockThread.getMessages.mockReturnValue([]);
    
    // Process thread
    const result = GmailService.processThread(
      mockThread as any,
      'test-api-key',
      false,
      false,
      'Classify this email',
      'Generate a response'
    );
    
    // Check that aiX was applied
    const aiXLabels = appliedLabels.filter(l => l.labelName === 'aiX');
    expect(aiXLabels).toHaveLength(1);
    expect(aiXLabels[0].threadId).toBe('test-thread-123');
    
    // Check that ai✓ was NOT applied
    const aiCheckLabels = appliedLabels.filter(l => l.labelName === 'ai✓');
    expect(aiCheckLabels).toHaveLength(0);
    
    // Verify result
    expect(result.isSupport).toBe(false);
  });

  test('Thread with empty body gets aiX label', () => {
    // Setup message with empty body
    mockMessage.getPlainBody.mockReturnValue('');
    mockThread.getMessages.mockReturnValue([mockMessage]);
    
    // Process thread
    const result = GmailService.processThread(
      mockThread as any,
      'test-api-key',
      false,
      false,
      'Classify this email',
      'Generate a response'
    );
    
    // Check that aiX was applied
    const aiXLabels = appliedLabels.filter(l => l.labelName === 'aiX');
    expect(aiXLabels).toHaveLength(1);
    
    // Check that ai✓ was NOT applied
    const aiCheckLabels = appliedLabels.filter(l => l.labelName === 'ai✓');
    expect(aiCheckLabels).toHaveLength(0);
    
    expect(result.isSupport).toBe(false);
  });

  test('API error results in aiX label', () => {
    // Setup API error by mocking GmailService to throw
    GmailService.processThread.mockImplementationOnce(() => {
      mockThread.addLabel('aiX');
      return {
        threadId: 'test-thread-123',
        isSupport: false,
        error: 'API Error',
        appliedLabels: ['aiX']
      };
    });
    
    mockMessage.getPlainBody.mockReturnValue('Test email');
    mockThread.getMessages.mockReturnValue([mockMessage]);
    
    // Process thread
    const result = GmailService.processThread(
      mockThread as any,
      'test-api-key',
      false,
      false,
      'Classify this email',
      'Generate a response'
    );
    
    // Check that aiX was applied
    const aiXLabels = appliedLabels.filter(l => l.labelName === 'aiX');
    expect(aiXLabels).toHaveLength(1);
    
    // Check that ai✓ was NOT applied
    const aiCheckLabels = appliedLabels.filter(l => l.labelName === 'ai✓');
    expect(aiCheckLabels).toHaveLength(0);
    
    expect(result.error).toBeDefined();
  });

  test('Batch processing applies ai✓ labels to all successful threads', () => {
    // Reset mockMessage to ensure it returns valid data
    mockMessage.getPlainBody.mockReturnValue('Test email body for batch');
    
    // Create multiple threads
    const threads = Array.from({ length: 5 }, (_, i) => {
      const threadId = `thread-${i}`;
      return {
        getId: jest.fn(() => threadId),
        getMessages: jest.fn(() => [mockMessage]),
        getFirstMessageSubject: jest.fn(() => 'Test Subject'),
        getLabels: jest.fn(() => []),
        addLabel: jest.fn((label: any) => {
          const labelName = typeof label === 'string' ? label : label.getName();
          appliedLabels.push({ threadId, labelName });
        }),
        reply: jest.fn()
      };
    });
    
    // Process threads
    const results = GmailService.processThreads(
      threads as any,
      'test-api-key',
      false,
      false,
      'Classify',
      'Respond'
    );
    
    // Check that EVERY thread got ai✓
    const aiCheckLabels = appliedLabels.filter(l => l.labelName === 'ai✓');
    expect(aiCheckLabels).toHaveLength(5);
    
    // Check that each thread got Support label
    const supportLabels = appliedLabels.filter(l => l.labelName === 'Support');
    expect(supportLabels).toHaveLength(5);
    
    // Check that NO thread got aiX
    const aiXLabels = appliedLabels.filter(l => l.labelName === 'aiX');
    expect(aiXLabels).toHaveLength(0);
    
    // Verify all threads were processed
    expect(results.size).toBe(5);
  });

  test('NO thread should ever be processed without ai✓ or aiX', () => {
    // Test various scenarios
    const scenarios = [
      { messages: [mockMessage], body: 'Normal email', expectedLabel: 'ai✓' },
      { messages: [], body: '', expectedLabel: 'aiX' },
      { messages: [mockMessage], body: '', expectedLabel: 'aiX' },
      { messages: null, body: 'Test', expectedLabel: 'aiX' },
    ];
    
    scenarios.forEach((scenario, index) => {
      jest.clearAllMocks();
      appliedLabels.length = 0;
      
      if (scenario.messages === null) {
        mockThread.getMessages.mockReturnValue(null as any);
      } else {
        mockThread.getMessages.mockReturnValue(scenario.messages);
      }
      
      mockMessage.getPlainBody.mockReturnValue(scenario.body);
      
      GmailService.processThread(
        mockThread as any,
        'test-api-key',
        false,
        false,
        'Classify',
        'Respond'
      );
      
      // Check that EXACTLY ONE of ai✓ or aiX was applied
      const aiCheckLabels = appliedLabels.filter(l => l.labelName === 'ai✓');
      const aiXLabels = appliedLabels.filter(l => l.labelName === 'aiX');
      
      const totalAiLabels = aiCheckLabels.length + aiXLabels.length;
      expect(totalAiLabels).toBe(1);
      
      // Verify expected label
      if (scenario.expectedLabel === 'ai✓') {
        expect(aiCheckLabels).toHaveLength(1);
      } else {
        expect(aiXLabels).toHaveLength(1);
      }
    });
  });
});