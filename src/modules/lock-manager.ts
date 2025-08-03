/**
 * Lock Manager Module
 * Provides robust locking mechanism to prevent concurrent executions and handle timeouts
 */

namespace LockManager {
  const LOCK_KEY = 'ANALYSIS_LOCK';
  const LOCK_TIMEOUT_MS = 300000; // 5 minutes (under GAS 6-minute limit)
  
  export interface LockInfo {
    executionId: string;
    startTime: number;
    mode: string;
  }
  
  /**
   * Attempt to acquire analysis lock
   * Returns true if lock acquired, false if already locked
   */
  export function acquireLock(mode: string): boolean {
    const props = PropertiesService.getUserProperties();
    
    try {
      // Check for existing lock
      const existingLockStr = props.getProperty(LOCK_KEY);
      
      if (existingLockStr) {
        try {
          const existingLock: LockInfo = JSON.parse(existingLockStr);
          const elapsed = Date.now() - existingLock.startTime;
          
          // Check if lock is stale
          if (elapsed > LOCK_TIMEOUT_MS) {
            AppLogger.warn('Clearing stale analysis lock', {
              previousExecutionId: existingLock.executionId,
              elapsedMs: elapsed,
              mode: existingLock.mode
            });
            // Lock is stale, we can take it
          } else {
            // Lock is still valid
            AppLogger.info('Analysis already running', {
              currentExecutionId: existingLock.executionId,
              elapsedMs: elapsed,
              remainingMs: LOCK_TIMEOUT_MS - elapsed
            });
            return false;
          }
        } catch (e) {
          // Invalid lock data, clear it
          AppLogger.error('Invalid lock data, clearing', { error: String(e) });
        }
      }
      
      // Create new lock
      const newLock: LockInfo = {
        executionId: AppLogger.executionId,
        startTime: Date.now(),
        mode: mode
      };
      
      props.setProperty(LOCK_KEY, JSON.stringify(newLock));
      
      // Also set legacy flag for backward compatibility
      props.setProperty('ANALYSIS_RUNNING', 'true');
      props.setProperty('ANALYSIS_START_TIME', newLock.startTime.toString());
      
      AppLogger.info('Analysis lock acquired', {
        executionId: newLock.executionId,
        mode: newLock.mode
      });
      
      return true;
      
    } catch (error) {
      AppLogger.error('Failed to acquire lock', { error: Utils.handleError(error) });
      return false;
    }
  }
  
  /**
   * Release analysis lock
   */
  export function releaseLock(): void {
    const props = PropertiesService.getUserProperties();
    
    try {
      const lockStr = props.getProperty(LOCK_KEY);
      
      if (lockStr) {
        const lock: LockInfo = JSON.parse(lockStr);
        
        // Only release if it's our lock
        if (lock.executionId === AppLogger.executionId) {
          props.deleteProperty(LOCK_KEY);
          props.setProperty('ANALYSIS_RUNNING', 'false');
          
          const duration = Date.now() - lock.startTime;
          AppLogger.info('Analysis lock released', {
            executionId: lock.executionId,
            durationMs: duration,
            mode: lock.mode
          });
        } else {
          AppLogger.warn('Cannot release lock owned by different execution', {
            currentExecutionId: AppLogger.executionId,
            lockExecutionId: lock.executionId
          });
        }
      }
      
      // Always clear the legacy flag
      props.setProperty('ANALYSIS_RUNNING', 'false');
      
    } catch (error) {
      AppLogger.error('Failed to release lock', { error: Utils.handleError(error) });
      // Force clear on error
      props.setProperty('ANALYSIS_RUNNING', 'false');
      props.deleteProperty(LOCK_KEY);
    }
  }
  
  /**
   * Check if analysis is currently locked
   */
  export function isLocked(): boolean {
    const props = PropertiesService.getUserProperties();
    
    try {
      const lockStr = props.getProperty(LOCK_KEY);
      
      if (!lockStr) {
        return false;
      }
      
      const lock: LockInfo = JSON.parse(lockStr);
      const elapsed = Date.now() - lock.startTime;
      
      // Lock is valid if not stale
      return elapsed <= LOCK_TIMEOUT_MS;
      
    } catch (error) {
      // On any error, assume not locked
      return false;
    }
  }
  
  /**
   * Get current lock info if exists
   */
  export function getLockInfo(): LockInfo | null {
    const props = PropertiesService.getUserProperties();
    
    try {
      const lockStr = props.getProperty(LOCK_KEY);
      
      if (!lockStr) {
        return null;
      }
      
      const lock: LockInfo = JSON.parse(lockStr);
      const elapsed = Date.now() - lock.startTime;
      
      // Only return if lock is still valid
      if (elapsed <= LOCK_TIMEOUT_MS) {
        return lock;
      }
      
      return null;
      
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Force clear all locks (for emergency use)
   */
  export function forceClearLocks(): void {
    const props = PropertiesService.getUserProperties();
    props.deleteProperty(LOCK_KEY);
    props.setProperty('ANALYSIS_RUNNING', 'false');
    props.deleteProperty('ANALYSIS_START_TIME');
    
    AppLogger.warn('Force cleared all analysis locks');
  }
}