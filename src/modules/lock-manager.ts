/**
 * Lock Manager Module  
 * Provides ATOMIC locking mechanism using LockService to prevent race conditions
 * 
 * CRITICAL FIX: Uses LockService.getScriptLock() for true atomic mutex operations.
 * This eliminates the race condition that existed with PropertiesService-based locking.
 */

namespace LockManager {
  const LOCK_TIMEOUT_MS = 30000; // 30 seconds max wait for lock acquisition
  
  export interface LockInfo {
    executionId: string;
    startTime: number;
    mode: string;
  }
  
  // Store current lock info in PropertiesService for UI display purposes only
  const LOCK_INFO_KEY = 'CURRENT_LOCK_INFO';
  
  // Global variable to track the current script lock
  let currentScriptLock: GoogleAppsScript.Lock.Lock | null = null;
  
  /**
   * Attempt to acquire analysis lock using atomic LockService
   * Returns true if lock acquired, false if already locked
   */
  export function acquireLock(mode: string): boolean {
    try {
      // Get atomic script lock - this is the REAL lock mechanism
      const lock = LockService.getScriptLock();
      
      // Try to acquire lock with timeout
      const acquired = lock.tryLock(LOCK_TIMEOUT_MS);
      
      if (!acquired) {
        AppLogger.info('Analysis already running - could not acquire atomic lock', {
          timeoutMs: LOCK_TIMEOUT_MS,
          requestedMode: mode
        });
        return false;
      }
      
      // Lock acquired! Store reference and metadata
      currentScriptLock = lock;
      
      const lockInfo: LockInfo = {
        executionId: AppLogger.executionId,
        startTime: Date.now(),
        mode: mode
      };
      
      const props = PropertiesService.getUserProperties();
      props.setProperty(LOCK_INFO_KEY, JSON.stringify(lockInfo));
      
      // Keep legacy properties for backward compatibility during transition
      props.setProperty(Config.PROP_KEYS.ANALYSIS_RUNNING, 'true');
      props.setProperty(Config.PROP_KEYS.ANALYSIS_START_TIME, lockInfo.startTime.toString());
      
      AppLogger.info('Analysis lock acquired (ATOMIC)', {
        executionId: lockInfo.executionId,
        mode: lockInfo.mode,
        lockMechanism: 'LockService.getScriptLock()',
        timeoutMs: LOCK_TIMEOUT_MS
      });
      
      return true;
    } catch (error) {
      AppLogger.error('Failed to acquire atomic lock', { error: Utils.handleError(error) });
      return false;
    }
  }
  
  /**
   * Release analysis lock (ATOMIC)
   */
  export function releaseLock(): void {
    try {
      // Release the atomic script lock if we have it
      if (currentScriptLock) {
        currentScriptLock.releaseLock();
        currentScriptLock = null;
        
        AppLogger.info('Analysis lock released (ATOMIC)', {
          lockMechanism: 'LockService.getScriptLock()'
        });
      }
      
      // Clear metadata and legacy properties
      const props = PropertiesService.getUserProperties();
      props.deleteProperty(LOCK_INFO_KEY);
      props.setProperty(Config.PROP_KEYS.ANALYSIS_RUNNING, 'false');
      props.deleteProperty(Config.PROP_KEYS.ANALYSIS_START_TIME);
      
    } catch (error) {
      AppLogger.error('Failed to release atomic lock', { error: Utils.handleError(error) });
      
      // Force clear everything on error
      currentScriptLock = null;
      const props = PropertiesService.getUserProperties();
      props.deleteProperty(LOCK_INFO_KEY);
      props.setProperty(Config.PROP_KEYS.ANALYSIS_RUNNING, 'false');
      props.deleteProperty(Config.PROP_KEYS.ANALYSIS_START_TIME);
    }
  }
  
  /**
   * Check if analysis is currently locked
   * Uses metadata approach since LockService doesn't provide query capability
   */
  export function isLocked(): boolean {
    try {
      const props = PropertiesService.getUserProperties();
      const lockInfoStr = props.getProperty(LOCK_INFO_KEY);
      
      if (!lockInfoStr) {
        return false;
      }
      
      const lockInfo: LockInfo = JSON.parse(lockInfoStr);
      const elapsed = Date.now() - lockInfo.startTime;
      
      // Consider lock stale after reasonable time (5 minutes)
      const STALE_LOCK_MS = 300000; // 5 minutes
      
      if (elapsed > STALE_LOCK_MS) {
        // Lock is stale, clean it up
        AppLogger.warn('Cleaning up stale lock metadata', {
          elapsedMs: elapsed,
          executionId: lockInfo.executionId
        });
        
        props.deleteProperty(LOCK_INFO_KEY);
        props.setProperty(Config.PROP_KEYS.ANALYSIS_RUNNING, 'false');
        return false;
      }
      
      return true;
      
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
      const lockInfoStr = props.getProperty(LOCK_INFO_KEY);
      
      if (!lockInfoStr) {
        return null;
      }
      
      const lockInfo: LockInfo = JSON.parse(lockInfoStr);
      const elapsed = Date.now() - lockInfo.startTime;
      
      // Consider lock stale after reasonable time (5 minutes)
      const STALE_LOCK_MS = 300000; // 5 minutes
      
      if (elapsed <= STALE_LOCK_MS) {
        return lockInfo;
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
    try {
      // Release any active script lock
      if (currentScriptLock) {
        currentScriptLock.releaseLock();
        currentScriptLock = null;
      }
    } catch (error) {
      // Ignore errors when force clearing
    }
    
    const props = PropertiesService.getUserProperties();
    props.deleteProperty(LOCK_INFO_KEY);
    props.setProperty('ANALYSIS_RUNNING', 'false');
    props.deleteProperty('ANALYSIS_START_TIME');
    
    AppLogger.warn('Force cleared all analysis locks (ATOMIC)');
  }
}