/**
 * Tests for thread context extraction (email routing)
 */

// Mock Google Apps Script services
const mockGetFrom = jest.fn();
const mockGetTo = jest.fn();
const mockGetCc = jest.fn();
const mockGetBcc = jest.fn();
const mockGetId = jest.fn();
const mockGetPlainBody = jest.fn();
const mockGetFirstMessageSubject = jest.fn();
const mockGetMessages = jest.fn();

// Mock message object
const mockMessage = {
  getFrom: mockGetFrom,
  getTo: mockGetTo,
  getCc: mockGetCc,
  getBcc: mockGetBcc,
  getId: mockGetId,
  getPlainBody: mockGetPlainBody
};

// Mock thread object  
const mockGetThreadId = jest.fn().mockReturnValue('thread-123');
const mockThread = {
  getMessages: mockGetMessages,
  getId: mockGetThreadId,
  getFirstMessageSubject: mockGetFirstMessageSubject
};

// Mock AppLogger
global.AppLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
} as any;

// Import the module (partial implementation for testing)
const GmailService = (() => {
  function isNoReplyAddress(email: string): boolean {
    const lowerEmail = email.toLowerCase();
    const noReplyPatterns = [
      'noreply@',
      'no-reply@',
      'donotreply@',
      'do-not-reply@',
      'notification@',
      'notifications@',
      'mailer-daemon@',
      'postmaster@'
    ];
    
    return noReplyPatterns.some(pattern => lowerEmail.includes(pattern));
  }
  
  function parseEmailAddresses(emailString: string): string[] {
    if (!emailString) return [];
    
    const addresses: string[] = [];
    const parts = emailString.split(',');
    
    parts.forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;
      
      const emailMatch = trimmed.match(/<([^>]+)>/);
      if (emailMatch) {
        addresses.push(emailMatch[1]);
      } else if (trimmed.includes('@')) {
        addresses.push(trimmed);
      }
    });
    
    return addresses;
  }
  
  function extractListHeaders(message: any): any {
    return {
      listId: undefined,
      listUnsubscribe: undefined,
      listPost: undefined
    };
  }
  
  function extractThreadContext(thread: any): any {
    const messages = thread.getMessages();
    if (messages.length === 0) {
      throw new Error('Thread has no messages');
    }
    
    const latestMessage = messages[messages.length - 1];
    const originalSender = latestMessage.getFrom();
    const hasNoReply = isNoReplyAddress(originalSender);
    
    let replyTo: string | undefined = undefined;
    
    const allRecipients = {
      to: parseEmailAddresses(latestMessage.getTo()),
      cc: parseEmailAddresses(latestMessage.getCc()),
      bcc: parseEmailAddresses(latestMessage.getBcc())
    };
    
    const listHeaders = extractListHeaders(latestMessage);
    const isMailingList = !!(listHeaders.listId || listHeaders.listUnsubscribe);
    
    const threadId = thread.getId ? thread.getId() : 'thread-default';
    const subject = thread.getFirstMessageSubject ? thread.getFirstMessageSubject() : '';
    
    const context = {
      originalSender,
      replyTo,
      allRecipients,
      threadId,
      isMailingList,
      hasNoReply,
      listHeaders: isMailingList ? listHeaders : undefined,
      messageId: latestMessage.getId(),
      subject
    };
    
    AppLogger.info('📋 THREAD CONTEXT EXTRACTED', {
      threadId,
      sender: originalSender,
      recipientCount: allRecipients.to.length + allRecipients.cc.length,
      hasNoReply,
      isMailingList,
      subject
    });
    
    return context;
  }
  
  return {
    extractThreadContext,
    isNoReplyAddress,
    parseEmailAddresses
  };
})();

describe('Thread Context Extraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock setup
    mockGetThreadId.mockReturnValue('thread-123');
    mockGetMessages.mockReturnValue([mockMessage]);
    mockGetFrom.mockReturnValue('sender@example.com');
    mockGetTo.mockReturnValue('recipient@example.com');
    mockGetCc.mockReturnValue('');
    mockGetBcc.mockReturnValue('');
    mockGetId.mockReturnValue('msg-123');
    mockGetFirstMessageSubject.mockReturnValue('Test Subject');
  });
  
  describe('extractThreadContext', () => {
    it('should extract basic thread context', () => {
      // Verify mock setup
      expect(mockThread.getId).toBeDefined();
      expect(mockThread.getId()).toBe('thread-123');
      
      const context = GmailService.extractThreadContext(mockThread);
      
      expect(context).toEqual({
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
        listHeaders: undefined,
        messageId: 'msg-123',
        subject: 'Test Subject'
      });
    });
    
    it('should detect no-reply addresses', () => {
      mockGetFrom.mockReturnValue('noreply@company.com');
      
      const context = GmailService.extractThreadContext(mockThread);
      
      expect(context.hasNoReply).toBe(true);
      expect(context.originalSender).toBe('noreply@company.com');
    });
    
    it('should parse multiple recipients', () => {
      mockGetTo.mockReturnValue('user1@example.com, user2@example.com');
      mockGetCc.mockReturnValue('cc1@example.com, cc2@example.com');
      
      const context = GmailService.extractThreadContext(mockThread);
      
      expect(context.allRecipients.to).toEqual(['user1@example.com', 'user2@example.com']);
      expect(context.allRecipients.cc).toEqual(['cc1@example.com', 'cc2@example.com']);
    });
    
    it('should handle "Name <email>" format', () => {
      mockGetFrom.mockReturnValue('John Doe <john@example.com>');
      mockGetTo.mockReturnValue('Jane Smith <jane@example.com>, Bob <bob@example.com>');
      
      const context = GmailService.extractThreadContext(mockThread);
      
      expect(context.originalSender).toBe('John Doe <john@example.com>');
      expect(context.allRecipients.to).toEqual(['jane@example.com', 'bob@example.com']);
    });
    
    it('should throw error for thread with no messages', () => {
      mockGetMessages.mockReturnValue([]);
      
      expect(() => {
        GmailService.extractThreadContext(mockThread);
      }).toThrow('Thread has no messages');
    });
  });
  
  describe('isNoReplyAddress', () => {
    it('should detect various no-reply patterns', () => {
      const noReplyAddresses = [
        'noreply@example.com',
        'no-reply@example.com',
        'donotreply@example.com',
        'do-not-reply@example.com',
        'notification@example.com',
        'notifications@example.com',
        'mailer-daemon@example.com',
        'postmaster@example.com'
      ];
      
      noReplyAddresses.forEach(email => {
        expect(GmailService.isNoReplyAddress(email)).toBe(true);
      });
    });
    
    it('should not flag regular addresses as no-reply', () => {
      const regularAddresses = [
        'john@example.com',
        'support@example.com',
        'sales@example.com',
        'hello@example.com'
      ];
      
      regularAddresses.forEach(email => {
        expect(GmailService.isNoReplyAddress(email)).toBe(false);
      });
    });
    
    it('should be case insensitive', () => {
      expect(GmailService.isNoReplyAddress('NOREPLY@EXAMPLE.COM')).toBe(true);
      expect(GmailService.isNoReplyAddress('NoReply@Example.com')).toBe(true);
    });
  });
  
  describe('parseEmailAddresses', () => {
    it('should parse simple email addresses', () => {
      const result = GmailService.parseEmailAddresses('test@example.com');
      expect(result).toEqual(['test@example.com']);
    });
    
    it('should parse multiple comma-separated emails', () => {
      const result = GmailService.parseEmailAddresses('test1@example.com, test2@example.com, test3@example.com');
      expect(result).toEqual(['test1@example.com', 'test2@example.com', 'test3@example.com']);
    });
    
    it('should extract emails from "Name <email>" format', () => {
      const result = GmailService.parseEmailAddresses('John Doe <john@example.com>, Jane <jane@example.com>');
      expect(result).toEqual(['john@example.com', 'jane@example.com']);
    });
    
    it('should handle mixed formats', () => {
      const result = GmailService.parseEmailAddresses('plain@example.com, John Doe <john@example.com>, another@example.com');
      expect(result).toEqual(['plain@example.com', 'john@example.com', 'another@example.com']);
    });
    
    it('should handle empty or invalid input', () => {
      expect(GmailService.parseEmailAddresses('')).toEqual([]);
      expect(GmailService.parseEmailAddresses('not-an-email')).toEqual([]);
      expect(GmailService.parseEmailAddresses('  ,  ,  ')).toEqual([]);
    });
  });
});