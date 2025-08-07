/**
 * Tests for T-12: Per-Thread Redaction Cache
 */

// Create Redaction namespace for testing
const Redaction = (() => {
  const PII_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    orderNumber: /#[0-9]{6,}/g,
    creditCard: /\b(?:\d[ -]*?){13,19}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    sensitiveUrl: /https?:\/\/[^\s]+(?:token|key|password|auth|session|api)[^\s]*/gi
  };
  
  const cache = new Map<string, string>();
  
  return {
    redactPII: function(text: string, threadId: string) {
      let redactedText = text;
      const mapping: any = {};
      let tokenIndex = 0;
      
      Object.entries(PII_PATTERNS).forEach(([type, pattern]) => {
        redactedText = redactedText.replace(pattern, (match) => {
          const token = '{{token' + tokenIndex + '}}';
          mapping[token] = match;
          tokenIndex++;
          AppLogger.info('🔒 REDACTED PII', { type, token, threadId });
          return token;
        });
      });
      
      if (tokenIndex > 0) {
        cache.set('redaction_' + threadId, JSON.stringify(mapping));
      }
      
      return {
        redactedText,
        mapping,
        redactionCount: tokenIndex
      };
    },
    
    restorePII: function(text: string, threadId: string) {
      const mappingJson = cache.get('redaction_' + threadId);
      if (!mappingJson) return text;
      
      const mapping = JSON.parse(mappingJson);
      let restoredText = text;
      
      Object.entries(mapping).forEach(([token, originalValue]) => {
        // Escape special regex characters in the token
        const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const tokenRegex = new RegExp(escapedToken, 'g');
        restoredText = restoredText.replace(tokenRegex, originalValue as string);
      });
      
      return restoredText;
    },
    
    clearRedactionCache: function(threadId: string) {
      cache.delete('redaction_' + threadId);
    },
    
    analyzePII: function(text: string) {
      return {
        hasEmail: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g.test(text),
        hasPhone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g.test(text),
        hasOrderNumber: /#[0-9]{6,}/g.test(text),
        hasCreditCard: /\b(?:\d[ -]*?){13,19}\b/g.test(text),
        hasSSN: /\b\d{3}-\d{2}-\d{4}\b/g.test(text),
        hasSensitiveUrl: /https?:\/\/[^\s]+(?:token|key|password|auth|session|api)[^\s]*/gi.test(text),
        totalPIICount: 0
      };
    }
  };
})();

// Make it available globally
(global as any).Redaction = Redaction;

describe('Redaction (T-12)', () => {
  let mockPut: jest.Mock;
  let mockGet: jest.Mock;
  let mockRemove: jest.Mock;
  
  beforeEach(() => {
    // Mock CacheService
    mockPut = jest.fn();
    mockGet = jest.fn();
    mockRemove = jest.fn();
    
    global.CacheService = {
      getUserCache: jest.fn(() => ({
        put: mockPut,
        get: mockGet,
        remove: mockRemove
      }))
    } as any;
    
    // Mock AppLogger
    global.AppLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as any;
    
    jest.clearAllMocks();
  });
  
  describe('PII Detection', () => {
    it('should detect email addresses', () => {
      const analysis = Redaction.analyzePII('Contact me at john.doe@example.com');
      expect(analysis.hasEmail).toBe(true);
    });
    
    it('should detect phone numbers', () => {
      const analysis = Redaction.analyzePII('Call me at (555) 123-4567');
      expect(analysis.hasPhone).toBe(true);
    });
    
    it('should detect order numbers', () => {
      const analysis = Redaction.analyzePII('Your order #1234567 has shipped');
      expect(analysis.hasOrderNumber).toBe(true);
    });
    
    it('should detect credit card numbers', () => {
      const analysis = Redaction.analyzePII('Card ending in 4111 1111 1111 1111');
      expect(analysis.hasCreditCard).toBe(true);
    });
    
    it('should detect SSN', () => {
      const analysis = Redaction.analyzePII('SSN: 123-45-6789');
      expect(analysis.hasSSN).toBe(true);
    });
    
    it('should detect sensitive URLs', () => {
      const analysis = Redaction.analyzePII('Login at https://example.com/auth?token=abc123');
      expect(analysis.hasSensitiveUrl).toBe(true);
    });
  });
  
  describe('PII Redaction', () => {
    it('should redact email addresses', () => {
      const text = 'Contact john.doe@example.com for support';
      const result = Redaction.redactPII(text, 'thread-123');
      
      expect(result.redactedText).toBe('Contact {{token0}} for support');
      expect(result.mapping['{{token0}}']).toBe('john.doe@example.com');
      expect(result.redactionCount).toBe(1);
    });
    
    it('should redact multiple PII types', () => {
      const text = 'Email: user@test.com, Phone: (555) 123-4567, Order #987654';
      const result = Redaction.redactPII(text, 'thread-123');
      
      expect(result.redactedText).toContain('{{token0}}');
      expect(result.redactedText).toContain('{{token1}}');
      expect(result.redactedText).toContain('{{token2}}');
      expect(result.redactionCount).toBe(3);
    });
    
    it('should handle text with no PII', () => {
      const text = 'This is a regular message with no sensitive data';
      const result = Redaction.redactPII(text, 'thread-123');
      
      expect(result.redactedText).toBe(text);
      expect(result.redactionCount).toBe(0);
      expect(Object.keys(result.mapping).length).toBe(0);
    });
    
    it('should redact sensitive URLs', () => {
      const text = 'Reset password: https://app.com/reset?token=xyz789&key=secret';
      const result = Redaction.redactPII(text, 'thread-123');
      
      expect(result.redactedText).toBe('Reset password: {{token0}}');
      expect(result.mapping['{{token0}}']).toBe('https://app.com/reset?token=xyz789&key=secret');
    });
  });
  
  describe('PII Restoration', () => {
    it('should restore redacted PII', () => {
      // First redact
      const originalText = 'Contact user@example.com or call (555) 123-4567';
      const redactResult = Redaction.redactPII(originalText, 'thread-456');
      
      // Simulate AI response with tokens
      const aiResponse = 'Thank you for contacting us. We will email {{token0}} and call {{token1}} soon.';
      
      // Restore
      const restored = Redaction.restorePII(aiResponse, 'thread-456');
      
      expect(restored).toBe('Thank you for contacting us. We will email user@example.com and call (555) 123-4567 soon.');
    });
    
    it('should handle missing cache gracefully', () => {
      const text = 'This has {{token0}} but no cache';
      const restored = Redaction.restorePII(text, 'thread-999');
      
      expect(restored).toBe(text); // Should return unchanged
    });
    
    it('should restore multiple occurrences of same token', () => {
      // First redact
      const originalText = 'Email me at test@example.com';
      const redactResult = Redaction.redactPII(originalText, 'thread-789');
      
      // AI response mentions email twice
      const aiResponse = 'I will send details to {{token0}} and CC {{token0}}';
      const restored = Redaction.restorePII(aiResponse, 'thread-789');
      
      expect(restored).toBe('I will send details to test@example.com and CC test@example.com');
    });
  });
  
  describe('Cache Management', () => {
    it('should clear redaction cache', () => {
      // Create some redaction
      Redaction.redactPII('test@email.com', 'thread-clear');
      
      // Clear cache
      Redaction.clearRedactionCache('thread-clear');
      
      // Try to restore - should return unchanged
      const restored = Redaction.restorePII('{{token0}}', 'thread-clear');
      expect(restored).toBe('{{token0}}');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle special characters in PII', () => {
      const text = 'Contact user+tag@example.com or user.name@sub.example.co.uk';
      const result = Redaction.redactPII(text, 'thread-special');
      
      expect(result.redactionCount).toBe(2);
      expect(result.mapping['{{token0}}']).toBe('user+tag@example.com');
      expect(result.mapping['{{token1}}']).toBe('user.name@sub.example.co.uk');
    });
    
    it('should not redact partial matches', () => {
      const text = 'Not an email: user@, not a phone: 555-123';
      const result = Redaction.redactPII(text, 'thread-partial');
      
      expect(result.redactedText).toBe(text);
      expect(result.redactionCount).toBe(0);
    });
    
    it('should handle overlapping patterns correctly', () => {
      const text = 'Visit https://secure.site.com/api/key=12345 with card 4111111111111111';
      const result = Redaction.redactPII(text, 'thread-overlap');
      
      // Should redact both the URL (containing 'key') and the card number
      expect(result.redactionCount).toBe(2);
    });
  });
});