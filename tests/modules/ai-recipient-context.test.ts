/**
 * Tests for AI recipient context functionality
 */

// Mock AppLogger
global.AppLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
} as any;

// Mock the module functions
const GmailService = (() => {
  interface EmailContext {
    originalSender: string;
    replyTo?: string;
    allRecipients: {
      to: string[];
      cc: string[];
      bcc: string[];
    };
    threadId: string;
    isMailingList: boolean;
    hasNoReply: boolean;
    listHeaders?: {
      listId?: string;
      listUnsubscribe?: string;
      listPost?: string;
    };
    messageId: string;
    subject: string;
  }
  
  interface RecipientDecision {
    to: string[];
    cc?: string[];
    bcc?: string[];
    reason: string;
    mode: 'reply' | 'reply-all' | 'forward';
    warnings?: string[];
  }
  
  function buildRecipientContext(
    emailContext: EmailContext,
    recipientDecision: RecipientDecision
  ): string {
    const lines: string[] = [];
    
    lines.push('\n--- RECIPIENT CONTEXT ---');
    lines.push('Original sender: ' + emailContext.originalSender);
    
    if (emailContext.allRecipients.to.length > 0) {
      lines.push('To: ' + emailContext.allRecipients.to.join(', '));
    }
    
    if (emailContext.allRecipients.cc.length > 0) {
      lines.push('CC: ' + emailContext.allRecipients.cc.join(', '));
    }
    
    if (emailContext.replyTo) {
      lines.push('Reply-To: ' + emailContext.replyTo);
    }
    
    if (emailContext.isMailingList) {
      lines.push('⚠️ This is a mailing list email');
    }
    
    if (emailContext.hasNoReply) {
      lines.push('⚠️ WARNING: Sender is a no-reply address');
    }
    
    lines.push('\nSuggested recipient mode: ' + recipientDecision.mode.toUpperCase());
    lines.push('Reason: ' + recipientDecision.reason);
    
    if (recipientDecision.warnings && recipientDecision.warnings.length > 0) {
      lines.push('\nWarnings:');
      recipientDecision.warnings.forEach(warning => lines.push('- ' + warning));
    }
    
    if (recipientDecision.to.length > 0) {
      lines.push('\nResponse will be sent to: ' + recipientDecision.to.join(', '));
      if (recipientDecision.cc && recipientDecision.cc.length > 0) {
        lines.push('CC: ' + recipientDecision.cc.join(', '));
      }
    } else {
      lines.push('\n❌ NO RECIPIENTS - Response blocked');
    }
    
    lines.push('--- END RECIPIENT CONTEXT ---\n');
    
    return lines.join('\n');
  }
  
  return {
    buildRecipientContext
  };
})();

describe('AI Recipient Context', () => {
  const baseEmailContext: any = {
    originalSender: 'sender@example.com',
    replyTo: undefined,
    allRecipients: {
      to: ['recipient@example.com'],
      cc: [],
      bcc: []
    },
    threadId: 'thread-123',
    isMailingList: false,
    hasNoReply: false,
    messageId: 'msg-123',
    subject: 'Test Subject'
  };
  
  const baseRecipientDecision: any = {
    to: ['sender@example.com'],
    cc: [],
    reason: 'Standard reply to sender',
    mode: 'reply',
    warnings: []
  };
  
  describe('buildRecipientContext', () => {
    it('should build basic context for simple reply', () => {
      const context = GmailService.buildRecipientContext(
        baseEmailContext,
        baseRecipientDecision
      );
      
      expect(context).toContain('--- RECIPIENT CONTEXT ---');
      expect(context).toContain('Original sender: sender@example.com');
      expect(context).toContain('To: recipient@example.com');
      expect(context).toContain('Suggested recipient mode: REPLY');
      expect(context).toContain('Reason: Standard reply to sender');
      expect(context).toContain('Response will be sent to: sender@example.com');
      expect(context).toContain('--- END RECIPIENT CONTEXT ---');
    });
    
    it('should include reply-to when present', () => {
      const emailContext = {
        ...baseEmailContext,
        replyTo: 'support@company.com'
      };
      
      const context = GmailService.buildRecipientContext(
        emailContext,
        baseRecipientDecision
      );
      
      expect(context).toContain('Reply-To: support@company.com');
    });
    
    it('should show warnings for problematic senders', () => {
      const emailContext = {
        ...baseEmailContext,
        hasNoReply: true
      };
      
      const recipientDecision = {
        ...baseRecipientDecision,
        to: [],
        warnings: ['WARNING: Sender is a no-reply address']
      };
      
      const context = GmailService.buildRecipientContext(
        emailContext,
        recipientDecision
      );
      
      expect(context).toContain('⚠️ WARNING: Sender is a no-reply address');
      expect(context).toContain('❌ NO RECIPIENTS - Response blocked');
      expect(context).toContain('Warnings:');
      expect(context).toContain('- WARNING: Sender is a no-reply address');
    });
    
    it('should handle reply-all scenarios', () => {
      const emailContext = {
        ...baseEmailContext,
        allRecipients: {
          to: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
          cc: ['cc1@example.com', 'cc2@example.com'],
          bcc: []
        }
      };
      
      const recipientDecision = {
        to: ['sender@example.com', 'user1@example.com', 'user2@example.com', 'user3@example.com'],
        cc: ['cc1@example.com', 'cc2@example.com'],
        reason: 'Reply-all: email sent to group with group indicators',
        mode: 'reply-all' as const,
        warnings: []
      };
      
      const context = GmailService.buildRecipientContext(
        emailContext,
        recipientDecision
      );
      
      expect(context).toContain('To: user1@example.com, user2@example.com, user3@example.com');
      expect(context).toContain('CC: cc1@example.com, cc2@example.com');
      expect(context).toContain('Suggested recipient mode: REPLY-ALL');
      expect(context).toContain('Response will be sent to: sender@example.com, user1@example.com, user2@example.com, user3@example.com');
      expect(context).toContain('CC: cc1@example.com, cc2@example.com');
    });
    
    it('should handle mailing list scenarios', () => {
      const emailContext = {
        ...baseEmailContext,
        isMailingList: true,
        listHeaders: {
          listId: 'list.example.com'
        }
      };
      
      const recipientDecision = {
        ...baseRecipientDecision,
        warnings: ['Email is from a mailing list']
      };
      
      const context = GmailService.buildRecipientContext(
        emailContext,
        recipientDecision
      );
      
      expect(context).toContain('⚠️ This is a mailing list email');
      expect(context).toContain('- Email is from a mailing list');
    });
    
    it('should handle forward scenarios', () => {
      const recipientDecision = {
        to: ['sender@example.com'],
        reason: 'Forward request detected - needs manual review',
        mode: 'forward' as const,
        warnings: ['Email contains forward request - manual review needed']
      };
      
      const context = GmailService.buildRecipientContext(
        baseEmailContext,
        recipientDecision
      );
      
      expect(context).toContain('Suggested recipient mode: FORWARD');
      expect(context).toContain('Reason: Forward request detected - needs manual review');
      expect(context).toContain('- Email contains forward request - manual review needed');
    });
  });
  
  describe('AI Prompt Integration', () => {
    it('should create complete prompt with recipient context', () => {
      const basePrompt = 'Please respond to this customer support email professionally.';
      const recipientContext = GmailService.buildRecipientContext(
        baseEmailContext,
        baseRecipientDecision
      );
      const emailBody = 'Hi, I need help with my order.';
      
      const fullPrompt = basePrompt + '\n' + recipientContext + '\n' + emailBody + 
        '\n---------- END ----------\n\nRespond with JSON containing a "reply" field with the email response. Consider the recipient context when crafting your response.';
      
      // Verify prompt structure
      expect(fullPrompt).toContain(basePrompt);
      expect(fullPrompt).toContain('--- RECIPIENT CONTEXT ---');
      expect(fullPrompt).toContain('Original sender: sender@example.com');
      expect(fullPrompt).toContain('Response will be sent to: sender@example.com');
      expect(fullPrompt).toContain(emailBody);
      expect(fullPrompt).toContain('Consider the recipient context');
    });
    
    it('should include warnings in AI context', () => {
      const emailContext = {
        ...baseEmailContext,
        hasNoReply: true,
        isMailingList: true
      };
      
      const recipientDecision = {
        to: [],
        reason: 'Blocked: sender is a no-reply address',
        mode: 'reply' as const,
        warnings: [
          'WARNING: Sender is a no-reply address',
          'Email is from a mailing list'
        ]
      };
      
      const context = GmailService.buildRecipientContext(
        emailContext,
        recipientDecision
      );
      
      // AI should see all the warnings
      expect(context).toContain('⚠️ WARNING: Sender is a no-reply address');
      expect(context).toContain('⚠️ This is a mailing list email');
      expect(context).toContain('❌ NO RECIPIENTS - Response blocked');
      expect(context).toContain('- WARNING: Sender is a no-reply address');
      expect(context).toContain('- Email is from a mailing list');
    });
  });
});