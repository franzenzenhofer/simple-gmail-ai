/**
 * Execution Time Module
 * Single source of truth for all timing and timeout handling
 */

namespace ExecutionTime {
  // Single source of truth for execution time limits
  export const LIMITS = {
    // Maximum execution time for Google Apps Script (6 minutes = 360 seconds)
    SCRIPT_MAX_MS: 360 * 1000,
    
    // Safe execution time with buffer (5 minutes 50 seconds = 350 seconds)
    SAFE_EXECUTION_MS: 350 * 1000,
    
    // API request timeout - SAME AS EXECUTION TIME!
    API_TIMEOUT_MS: 350 * 1000,  // 5 minutes 50 seconds - SINGLE SOURCE OF TRUTH!
    
    // Warning threshold - log warnings when approaching limit
    WARNING_THRESHOLD_MS: 300 * 1000,  // 5 minutes
    
    // Buffer time for cleanup and error handling
    CLEANUP_BUFFER_MS: 10 * 1000  // 10 seconds buffer
  };
  
  // Get API timeout in seconds (for UrlFetchApp)
  export function getApiTimeoutSeconds(): number {
    return LIMITS.API_TIMEOUT_MS / 1000;
  }
  
  // Check if we're approaching the execution time limit
  export function isApproachingLimit(startTime: number): boolean {
    const elapsed = Date.now() - startTime;
    return elapsed >= LIMITS.SAFE_EXECUTION_MS;
  }
  
  // Check if we're in the warning zone
  export function isInWarningZone(startTime: number): boolean {
    const elapsed = Date.now() - startTime;
    return elapsed >= LIMITS.WARNING_THRESHOLD_MS;
  }
  
  // Get remaining time before timeout
  export function getRemainingTime(startTime: number): number {
    const elapsed = Date.now() - startTime;
    return Math.max(0, LIMITS.SAFE_EXECUTION_MS - elapsed);
  }
  
  // Get elapsed time
  export function getElapsedTime(startTime: number): number {
    return Date.now() - startTime;
  }
  
  // Format duration for logging
  export function formatDuration(ms: number): string {
    if (ms < 1000) {
      return ms + 'ms';
    } else if (ms < 60000) {
      return (ms / 1000).toFixed(1) + 's';
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return minutes + 'm ' + seconds + 's';
    }
  }
  
  // Check if we have enough time for an operation
  export function hasTimeForOperation(startTime: number, estimatedDurationMs: number): boolean {
    const remaining = getRemainingTime(startTime);
    return remaining > estimatedDurationMs + LIMITS.CLEANUP_BUFFER_MS;
  }
  
  // Log execution time status
  export function logTimeStatus(startTime: number, operation: string): void {
    const elapsed = getElapsedTime(startTime);
    const remaining = getRemainingTime(startTime);
    const percentage = Math.round((elapsed / LIMITS.SAFE_EXECUTION_MS) * 100);
    
    const status = {
      operation,
      elapsed: formatDuration(elapsed),
      remaining: formatDuration(remaining),
      percentage: percentage + '%',
      isWarning: isInWarningZone(startTime),
      isApproachingLimit: isApproachingLimit(startTime)
    };
    
    if (status.isApproachingLimit) {
      AppLogger.error('⏰ EXECUTION TIME LIMIT APPROACHING', status);
    } else if (status.isWarning) {
      AppLogger.warn('⚠️ EXECUTION TIME WARNING', status);
    } else {
      AppLogger.info('⏱️ EXECUTION TIME STATUS', status);
    }
  }
}