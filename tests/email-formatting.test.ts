import { describe, test, expect } from '@jest/globals';

describe('Email Text Formatting', () => {
  // Implementation of formatEmailText for testing
  function formatEmailText(text: string): string {
    if (!text) return '';
    
    // Ensure proper line breaks are preserved
    // Gmail sometimes needs double line breaks for proper paragraph separation
    return text
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\r/g, '\n')     // Handle Mac line endings
      .replace(/\n{3,}/g, '\n\n') // Limit multiple line breaks to double
      .trim();                   // Remove leading/trailing whitespace
  }

  describe('formatEmailText', () => {
    test('should preserve single line breaks', () => {
      const input = 'Hello\nWorld';
      const result = formatEmailText(input);
      expect(result).toBe('Hello\nWorld');
    });

    test('should preserve double line breaks for paragraphs', () => {
      const input = 'Paragraph 1\n\nParagraph 2';
      const result = formatEmailText(input);
      expect(result).toBe('Paragraph 1\n\nParagraph 2');
    });

    test('should normalize multiple line breaks to double', () => {
      const input = 'Text\n\n\n\nMore text';
      const result = formatEmailText(input);
      expect(result).toBe('Text\n\nMore text');
    });

    test('should handle Windows line endings', () => {
      const input = 'Line 1\r\nLine 2';
      const result = formatEmailText(input);
      expect(result).toBe('Line 1\nLine 2');
    });

    test('should handle old Mac line endings', () => {
      const input = 'Line 1\rLine 2';
      const result = formatEmailText(input);
      expect(result).toBe('Line 1\nLine 2');
    });

    test('should trim leading and trailing whitespace', () => {
      const input = '  \n\nContent\n\n  ';
      const result = formatEmailText(input);
      expect(result).toBe('Content');
    });

    test('should handle empty string', () => {
      const result = formatEmailText('');
      expect(result).toBe('');
    });

    test('should handle null/undefined gracefully', () => {
      const result = formatEmailText(null as any);
      expect(result).toBe('');
    });

    test('should preserve indentation and spacing within lines', () => {
      const input = 'Dear Customer,\n\n    Thank you for your email.\n    We appreciate your feedback.\n\nBest regards,\nSupport Team';
      const result = formatEmailText(input);
      expect(result).toBe('Dear Customer,\n\n    Thank you for your email.\n    We appreciate your feedback.\n\nBest regards,\nSupport Team');
    });

    test('should handle email signatures correctly', () => {
      const input = 'Hello,\n\nThis is the response.\n\n--\nJohn Doe\nCustomer Support\nCompany Inc.';
      const result = formatEmailText(input);
      expect(result).toBe('Hello,\n\nThis is the response.\n\n--\nJohn Doe\nCustomer Support\nCompany Inc.');
    });

    test('should handle bullet points and lists', () => {
      const input = 'Here are the steps:\n\n• Step 1\n• Step 2\n• Step 3\n\nLet me know if you need help.';
      const result = formatEmailText(input);
      expect(result).toBe('Here are the steps:\n\n• Step 1\n• Step 2\n• Step 3\n\nLet me know if you need help.');
    });

    test('should handle mixed formatting', () => {
      const input = 'Subject: Re: Your inquiry\r\n\r\nDear Customer,\n\n\n\nThank you for reaching out.\r\n\rWe have reviewed your request.\n\nBest,\nSupport';
      const result = formatEmailText(input);
      expect(result).toBe('Subject: Re: Your inquiry\n\nDear Customer,\n\nThank you for reaching out.\n\nWe have reviewed your request.\n\nBest,\nSupport');
    });
  });
});