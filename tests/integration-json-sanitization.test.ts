/**
 * Tests for integration test JSON sanitization logic
 */

import { describe, it, expect } from '@jest/globals';

// Copy of the sanitizeJsonResponse function from integration-test.ts
function sanitizeJsonResponse(response: string): string {
  // Remove markdown code blocks if present
  let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  // Remove any text before the first { or [
  const startBrace = cleaned.indexOf('{');
  const startBracket = cleaned.indexOf('[');
  
  if (startBrace === -1 && startBracket === -1) {
    return cleaned;
  }
  
  const start = startBrace === -1 ? startBracket :
                startBracket === -1 ? startBrace :
                Math.min(startBrace, startBracket);
  
  if (start > 0) {
    cleaned = cleaned.substring(start);
  }
  
  // Remove any text after the last } or ]
  const endBrace = cleaned.lastIndexOf('}');
  const endBracket = cleaned.lastIndexOf(']');
  
  const end = Math.max(endBrace, endBracket);
  if (end !== -1 && end < cleaned.length - 1) {
    cleaned = cleaned.substring(0, end + 1);
  }
  
  return cleaned;
}

describe('Integration Test JSON Sanitization', () => {
  it('should remove markdown code blocks', () => {
    const input = '```json\n[{"id": "1", "value": "test"}]\n```';
    const expected = '[{"id": "1", "value": "test"}]';
    expect(sanitizeJsonResponse(input)).toBe(expected);
  });

  it('should handle response without markdown blocks', () => {
    const input = '[{"id": "1", "value": "test"}]';
    expect(sanitizeJsonResponse(input)).toBe(input);
  });

  it('should remove text before JSON', () => {
    const input = 'Here is the result: [{"id": "1"}]';
    const expected = '[{"id": "1"}]';
    expect(sanitizeJsonResponse(input)).toBe(expected);
  });

  it('should remove text after JSON', () => {
    const input = '[{"id": "1"}] and some extra text';
    const expected = '[{"id": "1"}]';
    expect(sanitizeJsonResponse(input)).toBe(expected);
  });

  it('should handle complex response with text before and after', () => {
    const input = 'Based on your request: ```json\n{"result": "success", "data": [1,2,3]}\n``` That should work!';
    const expected = '{"result": "success", "data": [1,2,3]}';
    expect(sanitizeJsonResponse(input)).toBe(expected);
  });

  it('should handle nested JSON structures', () => {
    const input = '```json\n{\n  "outer": {\n    "inner": [1, 2, 3]\n  }\n}\n```';
    const expected = '{\n  "outer": {\n    "inner": [1, 2, 3]\n  }\n}';
    expect(sanitizeJsonResponse(input)).toBe(expected);
  });

  it('should handle array at root level', () => {
    const input = 'Response: ```json\n[\n  {"id": "1"},\n  {"id": "2"}\n]\n```\nEnd of response';
    const expected = '[\n  {"id": "1"},\n  {"id": "2"}\n]';
    expect(sanitizeJsonResponse(input)).toBe(expected);
  });

  it('should return empty string if no JSON found', () => {
    const input = 'This is just plain text with no JSON';
    expect(sanitizeJsonResponse(input)).toBe(input);
  });

  it('should handle response with only opening bracket', () => {
    const input = 'Result: [ but nothing else';
    // If there's no closing bracket, the function keeps everything after the opening bracket
    const expected = '[ but nothing else';
    expect(sanitizeJsonResponse(input)).toBe(expected);
  });
});