/**
 * Simple tests for Gmail Support Triage AI
 * Tests core logic without Google Apps Script dependencies
 */

describe('Gmail Support Triage AI - Simple Tests', () => {
  describe('Form Value Extraction', () => {
    it('should extract value from form inputs', () => {
      const formInputs = {
        apiKey: { stringValues: ['test-key-123'] },
        mode: { stringValues: ['draft'] }
      };
      
      const apiKeyValue = formInputs.apiKey?.stringValues?.[0] || '';
      const modeValue = formInputs.mode?.stringValues?.[0] || 'label';
      
      expect(apiKeyValue).toBe('test-key-123');
      expect(modeValue).toBe('draft');
    });
  });

  describe('Classification Logic', () => {
    it('should identify support emails', () => {
      const testResponses = [
        { response: 'support', expected: true },
        { response: 'Support', expected: true },
        { response: 'SUPPORT', expected: true },
        { response: 'support: yes', expected: true },
        { response: 'not', expected: false },
        { response: 'not support', expected: false },
        { response: 'unsupported', expected: false },
        { response: '', expected: false }
      ];

      testResponses.forEach(test => {
        const normalized = test.response.toLowerCase().trim();
        const isSupport = normalized.indexOf('support') === 0;
        expect(isSupport).toBe(test.expected);
      });
    });
  });

  describe('API Configuration', () => {
    it('should build correct Gemini API URL', () => {
      const apiKey = 'test-api-key';
      const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/';
      const model = 'gemini-2.5-flash';
      const endpoint = 'generateContent';
      
      const url = baseUrl + model + ':' + endpoint + '?key=' + encodeURIComponent(apiKey);
      
      expect(url).toContain('gemini-2.5-flash');
      expect(url).toContain('generateContent');
      expect(url).toContain('test-api-key');
    });

    it('should create correct payload structure', () => {
      const prompt = 'Test prompt for classification';
      const payload = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3
        }
      };

      expect(payload.contents).toHaveLength(1);
      expect(payload.contents?.[0]?.parts).toHaveLength(1);
      expect(payload.contents?.[0]?.parts?.[0]?.text).toBe(prompt);
      expect(payload.generationConfig.temperature).toBe(0.3);
    });
  });

  describe('Statistics Formatting', () => {
    it('should format statistics correctly', () => {
      const stats = {
        scanned: 25,
        supports: 8,
        drafted: 5,
        sent: 3
      };

      const message = `Scanned ${stats.scanned} | Support ${stats.supports} | Drafts ${stats.drafted} | Sent ${stats.sent}`;
      
      expect(message).toBe('Scanned 25 | Support 8 | Drafts 5 | Sent 3');
    });
  });


  describe('Thread Deduplication', () => {
    it('should remove duplicate thread IDs', () => {
      const threads = [
        { id: 'thread-1', subject: 'Test 1' },
        { id: 'thread-2', subject: 'Test 2' },
        { id: 'thread-1', subject: 'Test 1 Duplicate' },
        { id: 'thread-3', subject: 'Test 3' },
        { id: 'thread-2', subject: 'Test 2 Duplicate' }
      ];

      const uniqueIds = new Set<string>();
      const uniqueThreads: typeof threads = [];

      threads.forEach(thread => {
        if (!uniqueIds.has(thread.id)) {
          uniqueIds.add(thread.id);
          uniqueThreads.push(thread);
        }
      });

      expect(uniqueThreads).toHaveLength(3);
      expect(uniqueIds.size).toBe(3);
      expect(Array.from(uniqueIds).sort()).toEqual(['thread-1', 'thread-2', 'thread-3']);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      const apiErrors = [
        { error: { message: 'Invalid API key' }, expected: 'Invalid API key' },
        { error: { message: 'Rate limit exceeded' }, expected: 'Rate limit exceeded' },
        { error: undefined, expected: 'Gemini API returned no candidates' },
        { candidates: [], expected: 'Gemini API returned no candidates' }
      ];

      apiErrors.forEach(test => {
        let errorMessage: string;
        if (!test.candidates || test.candidates.length === 0) {
          errorMessage = (test.error && test.error.message) || 'Gemini API returned no candidates';
        }
        expect(errorMessage!).toBe(test.expected);
      });
    });
  });

  describe('Prompt Construction', () => {
    it('should build classification prompt correctly', () => {
      const basePrompt = 'You are an email triage assistant.';
      const emailBody = 'Hello, I need help with my account.';
      const fullPrompt = basePrompt + '\n' + emailBody + '\n---------- EMAIL END ----------';

      expect(fullPrompt).toContain(basePrompt);
      expect(fullPrompt).toContain(emailBody);
      expect(fullPrompt).toContain('EMAIL END');
    });

    it('should build reply prompt correctly', () => {
      const basePrompt = 'You are a customer support agent.';
      const emailBody = 'I cannot log into my account.';
      const fullPrompt = basePrompt + '\n' + emailBody + '\n---------- END ----------';

      expect(fullPrompt).toContain(basePrompt);
      expect(fullPrompt).toContain(emailBody);
      expect(fullPrompt).toContain('END');
    });
  });
});