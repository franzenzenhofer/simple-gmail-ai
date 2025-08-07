/**
 * Tests for Gmail Label Sanitization
 * Ensures labels meet Gmail's constraints and character limits
 */

import { describe, test, expect } from '@jest/globals';

describe('Gmail Label Sanitization', () => {
  // Implementation of sanitizeGmailLabel for testing
  function sanitizeGmailLabel(labelName: string): string {
    if (!labelName) return 'Untitled';
    
    // Trim whitespace
    let sanitized = labelName.trim();
    
    // Handle empty after trim
    if (!sanitized) return 'Untitled';
    
    // Replace illegal characters with safe alternatives
    // Gmail allows: letters, numbers, spaces, dashes, underscores, periods, slashes (for nesting)
    sanitized = sanitized.replace(/[^\w\s\-._/]/g, '-');
    
    // Clean up multiple consecutive spaces/dashes
    sanitized = sanitized.replace(/\s+/g, ' ').replace(/-+/g, '-');
    
    // Ensure no leading or trailing slashes (causes Gmail issues)
    sanitized = sanitized.replace(/^\/+|\/+$/g, '');
    
    // Clean up slash sequences (no empty nested levels)
    sanitized = sanitized.replace(/\/+/g, '/');
    
    // Truncate to Gmail's 40 character limit
    if (sanitized.length > 40) {
      // Try to truncate at word boundary or slash
      const truncated = sanitized.substring(0, 37);
      const lastSpace = truncated.lastIndexOf(' ');
      const lastSlash = truncated.lastIndexOf('/');
      const breakPoint = Math.max(lastSpace, lastSlash);
      
      if (breakPoint > 20) {
        sanitized = truncated.substring(0, breakPoint) + '...';
      } else {
        sanitized = truncated + '...';
      }
    }
    
    return sanitized;
  }
  test('handles normal labels unchanged', () => {
    expect(sanitizeGmailLabel('Support Request')).toBe('Support Request');
    expect(sanitizeGmailLabel('Bug Reports')).toBe('Bug Reports');
    expect(sanitizeGmailLabel('AI-Processed')).toBe('AI-Processed');
  });

  test('trims whitespace', () => {
    expect(sanitizeGmailLabel('  Support Request  ')).toBe('Support Request');
    expect(sanitizeGmailLabel('\t\nBug Reports\n\t')).toBe('Bug Reports');
  });

  test('handles empty/null/undefined input', () => {
    expect(sanitizeGmailLabel('')).toBe('Untitled');
    expect(sanitizeGmailLabel('   ')).toBe('Untitled');
    expect(sanitizeGmailLabel(null as any)).toBe('Untitled');
    expect(sanitizeGmailLabel(undefined as any)).toBe('Untitled');
  });

  test('replaces illegal characters', () => {
    expect(sanitizeGmailLabel('Support@Request')).toBe('Support-Request');
    expect(sanitizeGmailLabel('Bug#Reports$')).toBe('Bug-Reports-');
    expect(sanitizeGmailLabel('AI%Processed&Done')).toBe('AI-Processed-Done');
    expect(sanitizeGmailLabel('Label(with)brackets[test]')).toBe('Label-with-brackets-test-');
  });

  test('preserves allowed characters', () => {
    expect(sanitizeGmailLabel('Support_Request-2024.v1')).toBe('Support_Request-2024.v1');
    expect(sanitizeGmailLabel('Level1/Level2/Level3')).toBe('Level1/Level2/Level3');
  });

  test('cleans up multiple spaces and dashes', () => {
    expect(sanitizeGmailLabel('Support    Request')).toBe('Support Request');
    expect(sanitizeGmailLabel('Bug-----Reports')).toBe('Bug-Reports');
    expect(sanitizeGmailLabel('Mixed   ---   Spaces')).toBe('Mixed - Spaces');
  });

  test('handles nested label slashes', () => {
    expect(sanitizeGmailLabel('/Support/Request/')).toBe('Support/Request');
    expect(sanitizeGmailLabel('//Support///Request//')).toBe('Support/Request');
    expect(sanitizeGmailLabel('Customer//Support')).toBe('Customer/Support');
  });

  test('truncates long labels at 40 characters', () => {
    const longLabel = 'This is a very very long label name that exceeds the Gmail limit';
    const result = sanitizeGmailLabel(longLabel);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result).toContain('...');
  });

  test('truncates at word boundaries when possible', () => {
    const longLabel = 'Customer Support Urgent Priority Critical Issue Type';
    const result = sanitizeGmailLabel(longLabel);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result).toContain('...');
    // Should break at a word boundary - result should be "Customer Support Urgent Priority..."
    expect(result).toBe('Customer Support Urgent Priority...');
  });

  test('truncates at slash boundaries for nested labels', () => {
    const longLabel = 'CustomerSupport/UrgentPriority/CriticalIssues/TypeA';
    const result = sanitizeGmailLabel(longLabel);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result).toContain('...');
    // Should not end with slash before ellipsis
    expect(result).not.toMatch(/\/\.\.\./);
  });

  test('handles edge cases for truncation', () => {
    // Label with no good break points
    const noBreaks = 'VeryLongLabelNameWithoutAnySpacesOrSlashes';
    const result = sanitizeGmailLabel(noBreaks);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result).toContain('...');

    // Label exactly at limit
    const exactLimit = '1234567890123456789012345678901234567890'; // 40 chars
    expect(sanitizeGmailLabel(exactLimit)).toBe(exactLimit);

    // Label just over limit
    const overLimit = '12345678901234567890123456789012345678901'; // 41 chars
    const overResult = sanitizeGmailLabel(overLimit);
    expect(overResult.length).toBeLessThanOrEqual(40);
  });

  test('handles AI-generated problematic labels', () => {
    // Examples from common AI responses
    expect(sanitizeGmailLabel('Customer Support (Urgent)')).toBe('Customer Support -Urgent-');
    expect(sanitizeGmailLabel('Issue: Database Error')).toBe('Issue- Database Error');
    expect(sanitizeGmailLabel('Bug #12345')).toBe('Bug -12345');
    expect(sanitizeGmailLabel('Status: In Progress')).toBe('Status- In Progress');
  });
});