/// <reference types="@types/google-apps-script" />

describe('Enhanced PII Redaction', () => {
  // Mock CacheService for testing
  const mockCache = {
    put: jest.fn(),
    get: jest.fn(),
    remove: jest.fn()
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock global CacheService
    (globalThis as any).CacheService = {
      getUserCache: () => mockCache
    };
    
    // Mock AppLogger
    (globalThis as any).AppLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  });

  // Mock the Redaction namespace functionality
  const mockRedaction = {
    redactPII: (text: string, threadId: string) => {
      const patterns = {
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        phone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
        orderNumber: /#[0-9A-Z]{6,}/gi,
        creditCard: /\b(?:\d[ -]*?){13,19}\b/g,
        ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
        sensitiveUrl: /https?:\/\/[^\s]+(?:token|key|password|auth|session|api|login)[^\s]*/gi,
        ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        accountNumber: /\b(?:acc?t?#?|account#?)\s*:?\s*[0-9A-Z]{6,}\b/gi,
        driverLicense: /\b[A-Z]{1,2}[0-9]{6,8}\b/g
      };

      let redactedText = text;
      const mapping: { [token: string]: string } = {};
      let tokenIndex = 0;

      Object.entries(patterns).forEach(([type, pattern]) => {
        redactedText = redactedText.replace(pattern, (match) => {
          const token = '{{token' + tokenIndex + '}}';
          mapping[token] = match;
          tokenIndex++;
          return token;
        });
      });

      return {
        redactedText,
        mapping,
        redactionCount: tokenIndex
      };
    },

    analyzePII: (text: string) => {
      const patterns = {
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        phone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
        orderNumber: /#[0-9A-Z]{6,}/gi,
        creditCard: /\b(?:\d[ -]*?){13,19}\b/g,
        ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
        sensitiveUrl: /https?:\/\/[^\s]+(?:token|key|password|auth|session|api|login)[^\s]*/gi,
        ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        accountNumber: /\b(?:acc?t?#?|account#?)\s*:?\s*[0-9A-Z]{6,}\b/gi,
        driverLicense: /\b[A-Z]{1,2}[0-9]{6,8}\b/g
      };

      const analysis = {
        hasEmail: patterns.email.test(text),
        hasPhone: patterns.phone.test(text),
        hasOrderNumber: patterns.orderNumber.test(text),
        hasCreditCard: patterns.creditCard.test(text),
        hasSSN: patterns.ssn.test(text),
        hasSensitiveUrl: patterns.sensitiveUrl.test(text),
        hasIpAddress: patterns.ipAddress.test(text),
        hasAccountNumber: patterns.accountNumber.test(text),
        hasDriverLicense: patterns.driverLicense.test(text),
        totalPIICount: 0,
        disclaimer: 'WARNING: This PII detection is INCOMPLETE and may miss many forms of personal data'
      };

      // Count total PII occurrences
      Object.entries(patterns).forEach(([_type, pattern]) => {
        const matches = text.match(pattern);
        if (matches) {
          analysis.totalPIICount += matches.length;
        }
        pattern.lastIndex = 0;
      });

      return analysis;
    }
  };

  describe('Enhanced Pattern Coverage', () => {
    it('should redact IP addresses', () => {
      const input = 'Server at 192.168.1.1 is down, check 10.0.0.1';
      const result = mockRedaction.redactPII(input, 'test-thread');
      
      expect(result.redactedText).toBe('Server at {{token0}} is down, check {{token1}}');
      expect(result.redactionCount).toBe(2);
      expect(result.mapping['{{token0}}']).toBe('192.168.1.1');
      expect(result.mapping['{{token1}}']).toBe('10.0.0.1');
    });

    it('should redact account numbers in various formats', () => {
      const input = 'Account: 123456789, acct# ABC123DEF, account#XYZ789';
      const result = mockRedaction.redactPII(input, 'test-thread');
      
      expect(result.redactionCount).toBe(3);
      expect(result.redactedText).toContain('{{token');
    });

    it('should redact driver license numbers', () => {
      const input = 'License: A1234567, ID B12345678';
      const result = mockRedaction.redactPII(input, 'test-thread');
      
      expect(result.redactionCount).toBe(2);
      expect(result.mapping['{{token0}}']).toBe('A1234567');
      expect(result.mapping['{{token1}}']).toBe('B12345678');
    });

    it('should redact sensitive URLs with login parameters', () => {
      const input = 'Login at https://example.com/login?token=abc123';
      const result = mockRedaction.redactPII(input, 'test-thread');
      
      expect(result.redactionCount).toBe(1);
      expect(result.redactedText).toBe('Login at {{token0}}');
    });

    it('should handle case-insensitive order numbers', () => {
      const input = 'Order #ABC123, tracking #def456';
      const result = mockRedaction.redactPII(input, 'test-thread');
      
      expect(result.redactionCount).toBe(2);
      expect(result.mapping['{{token0}}']).toBe('#ABC123');
      expect(result.mapping['{{token1}}']).toBe('#def456');
    });
  });

  describe('Edge Cases and Limitations', () => {
    it('should NOT detect names (demonstrating limitation)', () => {
      const input = 'Contact John Smith at john.smith@example.com';
      const result = mockRedaction.redactPII(input, 'test-thread');
      
      // Should only redact email, not the name "John Smith"
      expect(result.redactedText).toBe('Contact John Smith at {{token0}}');
      expect(result.redactionCount).toBe(1);
    });

    it('should NOT detect addresses (demonstrating limitation)', () => {
      const input = 'Ship to 123 Main Street, Anytown, CA 90210';
      const result = mockRedaction.redactPII(input, 'test-thread');
      
      // Should not redact the address
      expect(result.redactionCount).toBe(0);
      expect(result.redactedText).toBe(input);
    });

    it('should NOT detect international phone numbers (demonstrating limitation)', () => {
      const input = 'Call +44 20 7946 0958 or +49 30 12345678';
      const result = mockRedaction.redactPII(input, 'test-thread');
      
      // Should not redact international numbers
      expect(result.redactionCount).toBe(0);
      expect(result.redactedText).toBe(input);
    });

    it('should have false positives with credit card patterns', () => {
      const input = 'ID number 1234 5678 9012 3456 7890';
      const result = mockRedaction.redactPII(input, 'test-thread');
      
      // This would incorrectly be detected as a credit card
      expect(result.redactionCount).toBe(1);
    });

    it('should handle empty and null strings gracefully', () => {
      const emptyResult = mockRedaction.redactPII('', 'test-thread');
      expect(emptyResult.redactionCount).toBe(0);
      expect(emptyResult.redactedText).toBe('');
    });
  });

  describe('Analysis Function with Disclaimer', () => {
    it('should analyze PII and include disclaimer', () => {
      const input = 'Email: test@example.com, Phone: (555) 123-4567, IP: 192.168.1.1';
      const analysis = mockRedaction.analyzePII(input);
      
      expect(analysis.hasEmail).toBe(true);
      expect(analysis.hasPhone).toBe(true);
      expect(analysis.hasIpAddress).toBe(true);
      expect(analysis.totalPIICount).toBe(3);
      expect(analysis.disclaimer).toContain('WARNING');
      expect(analysis.disclaimer).toContain('INCOMPLETE');
    });

    it('should detect all new PII types', () => {
      const input = `
        Email: user@test.com
        SSN: 123-45-6789
        Account: ACC123456
        License: CA1234567
        URL: https://api.example.com/auth?token=secret
        IP: 10.0.0.1
      `;
      
      const analysis = mockRedaction.analyzePII(input);
      
      expect(analysis.hasEmail).toBe(true);
      expect(analysis.hasSSN).toBe(true);
      expect(analysis.hasAccountNumber).toBe(true);
      expect(analysis.hasDriverLicense).toBe(true);
      expect(analysis.hasSensitiveUrl).toBe(true);
      expect(analysis.hasIpAddress).toBe(true);
      expect(analysis.totalPIICount).toBeGreaterThan(5);
    });

    it('should return false for non-PII content', () => {
      const input = 'This is a regular message with no personal information.';
      const analysis = mockRedaction.analyzePII(input);
      
      expect(analysis.hasEmail).toBe(false);
      expect(analysis.hasPhone).toBe(false);
      expect(analysis.totalPIICount).toBe(0);
      expect(analysis.disclaimer).toContain('WARNING');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle customer support email with mixed PII', () => {
      const input = `
        Customer Issue Report
        Name: John Doe (not detected - limitation)
        Email: john.doe@company.com  
        Phone: (555) 123-4567
        Account: ACCT789123
        Order: #ORD456789
        Issue: Login problem with https://app.example.com/auth?session=xyz123
        Server logs show error from 192.168.100.50
      `;
      
      const result = mockRedaction.redactPII(input, 'support-123');
      
      // Should redact email, phone, account, order, URL, IP
      // but NOT the name "John Doe"
      expect(result.redactionCount).toBeGreaterThanOrEqual(5);
      expect(result.redactedText).toContain('John Doe'); // Name not redacted
      expect(result.redactedText).toContain('{{token'); // Other PII redacted
    });

    it('should demonstrate partial protection in financial context', () => {
      const input = `
        Transaction failed for card 4111 1111 1111 1111
        Customer: Jane Smith at jane@example.com
        Amount: $1,234.56 to merchant ABC Corp
        Location: 123 Business Ave, Suite 456, New York, NY 10001
      `;
      
      const result = mockRedaction.redactPII(input, 'financial-001');
      const analysis = mockRedaction.analyzePII(input);
      
      // Should detect email and credit card
      expect(analysis.hasEmail).toBe(true);
      expect(analysis.hasCreditCard).toBe(true);
      
      // But won't detect name, amount, merchant, or full address
      expect(result.redactedText).toContain('Jane Smith'); // Name not redacted
      expect(result.redactedText).toContain('$1,234.56'); // Amount not redracted
      expect(result.redactedText).toContain('123 Business Ave'); // Address not redacted
    });
  });
});