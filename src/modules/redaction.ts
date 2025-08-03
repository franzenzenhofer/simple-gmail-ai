/**
 * Redaction Module - T-12
 * Per-Thread Redaction Cache for PII protection
 */

namespace Redaction {
  // PII patterns to redact
  const PII_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    orderNumber: /#[0-9]{6,}/g,
    // Additional patterns can be added here
    creditCard: /\b(?:\d[ -]*?){13,19}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    // URLs that might contain sensitive params
    sensitiveUrl: /https?:\/\/[^\s]+(?:token|key|password|auth|session|api)[^\s]*/gi
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
   */
  export function analyzePII(text: string): {
    hasEmail: boolean;
    hasPhone: boolean;
    hasOrderNumber: boolean;
    hasCreditCard: boolean;
    hasSSN: boolean;
    hasSensitiveUrl: boolean;
    totalPIICount: number;
  } {
    const analysis = {
      hasEmail: PII_PATTERNS.email.test(text),
      hasPhone: PII_PATTERNS.phone.test(text),
      hasOrderNumber: PII_PATTERNS.orderNumber.test(text),
      hasCreditCard: PII_PATTERNS.creditCard.test(text),
      hasSSN: PII_PATTERNS.ssn.test(text),
      hasSensitiveUrl: PII_PATTERNS.sensitiveUrl.test(text),
      totalPIICount: 0
    };
    
    // Count total PII occurrences
    Object.entries(PII_PATTERNS).forEach(([_type, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.totalPIICount += matches.length;
      }
    });
    
    return analysis;
  }
}