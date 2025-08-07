/**
 * Tests for email address extraction from sender format
 */

import { describe, it, expect } from '@jest/globals';

describe('Email Address Extraction', () => {
  // Mock the extractEmailAddress function
  function extractEmailAddress(senderString: string): string {
    if (!senderString) return '';
    
    // Extract email from "Name <email>" format
    const emailMatch = senderString.match(/<([^>]+)>/);
    if (emailMatch && emailMatch[1]) {
      return emailMatch[1];
    }
    
    // If no angle brackets, assume it's already just an email
    return senderString.trim();
  }

  describe('extractEmailAddress', () => {
    it('should extract email from "Name <email>" format', () => {
      expect(extractEmailAddress('John Doe <john@example.com>')).toBe('john@example.com');
      expect(extractEmailAddress('Support Team <support@company.com>')).toBe('support@company.com');
      expect(extractEmailAddress('"Last, First" <first.last@example.com>')).toBe('first.last@example.com');
    });

    it('should handle plain email addresses', () => {
      expect(extractEmailAddress('john@example.com')).toBe('john@example.com');
      expect(extractEmailAddress('support@company.com')).toBe('support@company.com');
    });

    it('should handle empty or invalid input', () => {
      expect(extractEmailAddress('')).toBe('');
      expect(extractEmailAddress(null as any)).toBe('');
      expect(extractEmailAddress(undefined as any)).toBe('');
    });

    it('should handle malformed formats', () => {
      expect(extractEmailAddress('John Doe <')).toBe('John Doe <');
      expect(extractEmailAddress('< john@example.com')).toBe('< john@example.com');
      expect(extractEmailAddress('John Doe')).toBe('John Doe');
    });

    it('should extract email with special characters in name', () => {
      expect(extractEmailAddress('O\'Brien, Patrick <patrick@example.com>')).toBe('patrick@example.com');
      expect(extractEmailAddress('"Smith, John (CEO)" <ceo@company.com>')).toBe('ceo@company.com');
      expect(extractEmailAddress('Support [Urgent] <urgent@support.com>')).toBe('urgent@support.com');
    });

    it('should handle whitespace', () => {
      expect(extractEmailAddress('  John Doe <john@example.com>  ')).toBe('john@example.com');
      expect(extractEmailAddress('  john@example.com  ')).toBe('john@example.com');
    });
  });

  describe('recipient determination with email extraction', () => {
    // Mock determineRecipients to test email extraction integration
    function mockDetermineRecipients(originalSender: string): string[] {
      return [extractEmailAddress(originalSender)];
    }

    it('should extract pure email for reply-to', () => {
      const recipients = mockDetermineRecipients('Customer Support <support@company.com>');
      expect(recipients).toEqual(['support@company.com']);
    });

    it('should handle mailing list senders', () => {
      const recipients = mockDetermineRecipients('Newsletter <noreply@mailinglist.com>');
      expect(recipients).toEqual(['noreply@mailinglist.com']);
    });

    it('should handle international names', () => {
      const recipients = mockDetermineRecipients('François Müller <francois@example.eu>');
      expect(recipients).toEqual(['francois@example.eu']);
    });
  });
});