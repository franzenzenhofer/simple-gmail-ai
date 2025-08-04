/**
 * Redaction Module - T-12
 * Per-Thread Redaction Cache for PII protection
 * 
 * ⚠️  IMPORTANT SECURITY DISCLAIMER:
 * This PII redaction system is INCOMPLETE and provides only BASIC protection.
 * It uses regex patterns that will MISS many PII formats and variations.
 * DO NOT rely on this system for complete privacy protection.
 * 
 * Known limitations:
 * - Names, addresses, and personal identifiers: NOT detected
 * - International phone/SSN formats: NOT detected  
 * - Encoded or obfuscated PII: NOT detected
 * - Context-dependent sensitive data: NOT detected
 * 
 * For sensitive data processing, consider using dedicated PII detection services
 * or avoid sending personal information to AI services entirely.
 */

namespace Redaction {
  // Basic PII patterns - INCOMPLETE coverage (see disclaimer above)
  const PII_PATTERNS = {
    // Email addresses (basic pattern)
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    
    // US phone numbers (various formats)
    phone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    
    // Order/tracking numbers (common patterns)
    orderNumber: /#[0-9A-Z]{6,}/gi,
    
    // Credit card numbers (basic pattern - may have false positives)
    creditCard: /\b(?:\d[ -]*?){13,19}\b/g,
    
    // US Social Security Numbers
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    
    // URLs with sensitive parameters
    sensitiveUrl: /https?:\/\/[^\s]+(?:token|key|password|auth|session|api|login)[^\s]*/gi,
    
    // Basic IP addresses
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    
    // Common account numbers
    accountNumber: /\b(?:acc?t?#?|account#?)\s*:?\s*[0-9A-Z]{6,}\b/gi,
    
    // Driver license (US format)
    driverLicense: /\b[A-Z]{1,2}[0-9]{6,8}\b/g
  };
  
  interface RedactionMapping {
    [token: string]: string;
  }
  
  interface RedactionResult {
    redactedText: string;
    mapping: RedactionMapping;
    redactionCount: number;
  }
  
  /**
   * Redact PII from text and return mapping
   */
  export function redactPII(text: string, threadId: string): RedactionResult {
    let redactedText = text;
    const mapping: RedactionMapping = {};
    let tokenIndex = 0;
    
    // Apply each pattern
    Object.entries(PII_PATTERNS).forEach(([type, pattern]) => {
      redactedText = redactedText.replace(pattern, (match) => {
        const token = '{{token' + tokenIndex + '}}';
        mapping[token] = match;
        tokenIndex++;
        
        AppLogger.info('🔒 REDACTED PII', {
          type: type,
          token: token,
          originalLength: match.length,
          threadId: threadId
        });
        
        return token;
      });
    });
    
    // Store mapping in cache if any redactions were made
    if (tokenIndex > 0) {
      storeMappingInCache(threadId, mapping);
    }
    
    return {
      redactedText: redactedText,
      mapping: mapping,
      redactionCount: tokenIndex
    };
  }
  
  /**
   * Restore PII tokens back to original values
   */
  export function restorePII(text: string, threadId: string): string {
    const mapping = getMappingFromCache(threadId);
    
    if (!mapping || Object.keys(mapping).length === 0) {
      return text;
    }
    
    let restoredText = text;
    
    // Replace tokens with original values
    Object.entries(mapping).forEach(([token, originalValue]) => {
      // Token doesn't need escaping since it's a simple pattern like {{token0}}
      // but we escape it to be safe
      const tokenRegex = new RegExp(escapeRegExp(token), 'g');
      restoredText = restoredText.replace(tokenRegex, originalValue);
    });
    
    AppLogger.info('🔓 RESTORED PII', {
      threadId: threadId,
      tokensRestored: Object.keys(mapping).length
    });
    
    return restoredText;
  }
  
  /**
   * Store redaction mapping in CacheService
   */
  function storeMappingInCache(threadId: string, mapping: RedactionMapping): void {
    try {
      const cache = CacheService.getUserCache();
      if (!cache) {
        AppLogger.warn('Cache service unavailable, cannot store redaction mapping');
        return;
      }
      
      const cacheKey = 'redaction_' + threadId;
      const mappingJson = JSON.stringify(mapping);
      
      // Cache for 6 hours (max allowed)
      cache.put(cacheKey, mappingJson, 21600);
      
      AppLogger.info('💾 STORED REDACTION MAPPING', {
        threadId: threadId,
        tokenCount: Object.keys(mapping).length,
        cacheKey: cacheKey
      });
    } catch (error) {
      AppLogger.error('Failed to store redaction mapping', {
        error: String(error),
        threadId: threadId
      });
    }
  }
  
  /**
   * Retrieve redaction mapping from CacheService
   */
  function getMappingFromCache(threadId: string): RedactionMapping | null {
    try {
      const cache = CacheService.getUserCache();
      if (!cache) {
        AppLogger.warn('Cache service unavailable, cannot retrieve redaction mapping');
        return null;
      }
      
      const cacheKey = 'redaction_' + threadId;
      const mappingJson = cache.get(cacheKey);
      
      if (!mappingJson) {
        return null;
      }
      
      const mapping = JSON.parse(mappingJson) as RedactionMapping;
      
      AppLogger.info('📤 RETRIEVED REDACTION MAPPING', {
        threadId: threadId,
        tokenCount: Object.keys(mapping).length
      });
      
      return mapping;
    } catch (error) {
      AppLogger.error('Failed to retrieve redaction mapping', {
        error: String(error),
        threadId: threadId
      });
      return null;
    }
  }
  
  /**
   * Clear redaction cache for a thread
   */
  export function clearRedactionCache(threadId: string): void {
    try {
      const cache = CacheService.getUserCache();
      if (!cache) {
        return;
      }
      
      const cacheKey = 'redaction_' + threadId;
      cache.remove(cacheKey);
      
      AppLogger.info('🗑️ CLEARED REDACTION CACHE', {
        threadId: threadId
      });
    } catch (error) {
      AppLogger.error('Failed to clear redaction cache', {
        error: String(error),
        threadId: threadId
      });
    }
  }
  
  /**
   * Escape special regex characters
   */
  function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Analyze text for PII without redacting (for reporting)
   * WARNING: This analysis is INCOMPLETE - see module disclaimer
   */
  export function analyzePII(text: string): {
    hasEmail: boolean;
    hasPhone: boolean;
    hasOrderNumber: boolean;
    hasCreditCard: boolean;
    hasSSN: boolean;
    hasSensitiveUrl: boolean;
    hasIpAddress: boolean;
    hasAccountNumber: boolean;
    hasDriverLicense: boolean;
    totalPIICount: number;
    disclaimer: string;
  } {
    // Helper function to safely test regex without state issues
    const safeTest = (pattern: RegExp, text: string): boolean => {
      const result = pattern.test(text);
      pattern.lastIndex = 0; // Reset to prevent stateful behavior
      return result;
    };
    
    const analysis = {
      hasEmail: safeTest(PII_PATTERNS.email, text),
      hasPhone: safeTest(PII_PATTERNS.phone, text),
      hasOrderNumber: safeTest(PII_PATTERNS.orderNumber, text),
      hasCreditCard: safeTest(PII_PATTERNS.creditCard, text),
      hasSSN: safeTest(PII_PATTERNS.ssn, text),
      hasSensitiveUrl: safeTest(PII_PATTERNS.sensitiveUrl, text),
      hasIpAddress: safeTest(PII_PATTERNS.ipAddress, text),
      hasAccountNumber: safeTest(PII_PATTERNS.accountNumber, text),
      hasDriverLicense: safeTest(PII_PATTERNS.driverLicense, text),
      totalPIICount: 0,
      disclaimer: 'WARNING: This PII detection is INCOMPLETE and may miss many forms of personal data'
    };
    
    // Count total PII occurrences
    Object.entries(PII_PATTERNS).forEach(([_type, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.totalPIICount += matches.length;
      }
      // Reset regex lastIndex to avoid stateful regex issues
      pattern.lastIndex = 0;
    });
    
    return analysis;
  }
}