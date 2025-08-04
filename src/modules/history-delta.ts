/**
 * History Delta Processing Module  
 * KISS approach: First run scans last 50, subsequent runs scan last week
 */

namespace HistoryDelta {
  interface ScanConfig {
    firstRunEmails: number; // How many emails on first run (default: 50)
    deltaWindowDays: number; // How many days back for subsequent runs (default: 7)
  }
  
  interface ScanResult {
    threads: GoogleAppsScript.Gmail.GmailThread[];
    scanType: 'first-run' | 'delta-week';
    summary: string;
  }
  
  const FIRST_RUN_KEY = 'DELTA_FIRST_RUN_DONE';
  const SCAN_CONFIG_KEY = 'DELTA_SCAN_CONFIG';
  
  /**
   * Get default scan configuration
   */
  export function getDefaultScanConfig(): ScanConfig {
    return {
      firstRunEmails: 50,
      deltaWindowDays: 7
    };
  }
  
  /**
   * Get current scan configuration
   */
  export function getScanConfig(): ScanConfig {
    try {
      const props = PropertiesService.getUserProperties();
      const configStr = props.getProperty(SCAN_CONFIG_KEY);
      if (configStr) {
        return { ...getDefaultScanConfig(), ...JSON.parse(configStr) };
      }
      return getDefaultScanConfig();
    } catch (error) {
      Utils.logWarning('get scan config, using defaults', error);
      return getDefaultScanConfig();
    }
  }
  
  /**
   * Update scan configuration
   */
  export function updateScanConfig(config: Partial<ScanConfig>): void {
    try {
      const currentConfig = getScanConfig();
      const newConfig = { ...currentConfig, ...config };
      const props = PropertiesService.getUserProperties();
      props.setProperty(SCAN_CONFIG_KEY, JSON.stringify(newConfig));
      AppLogger.info('📋 SCAN CONFIG UPDATED', newConfig);
    } catch (error) {
      Utils.logError('update scan config', error);
    }
  }
  
  /**
   * Get emails to process - KISS approach
   */
  export function getEmailsToProcess(): ScanResult {
    const config = getScanConfig();
    const isFirstRun = !isFirstRunDone();
    
    if (isFirstRun) {
      return performFirstRun(config);
    } else {
      return performWeeklyDelta(config);
    }
  }
  
  /**
   * First run: scan last N emails
   */
  function performFirstRun(config: ScanConfig): ScanResult {
    AppLogger.info('🚀 FIRST RUN', { emails: config.firstRunEmails });
    
    const allThreads = GmailApp.search('in:inbox', 0, config.firstRunEmails);
    const unprocessedThreads = filterAlreadyProcessed(allThreads);
    
    const summary = `First run: ${unprocessedThreads.length}/${allThreads.length} emails need processing`;
    
    AppLogger.info('🎯 FIRST RUN RESULTS', {
      totalFound: allThreads.length,
      needsProcessing: unprocessedThreads.length,
      summary: summary
    });
    
    return {
      threads: unprocessedThreads,
      scanType: 'first-run',
      summary: summary
    };
  }
  
  /**
   * Subsequent runs: scan last week (catches removed labels)
   */
  function performWeeklyDelta(config: ScanConfig): ScanResult {
    AppLogger.info('📅 WEEKLY DELTA SCAN', { days: config.deltaWindowDays });
    
    // Search emails from last N days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.deltaWindowDays);
    const dateStr = Utilities.formatDate(cutoffDate, Session.getScriptTimeZone(), 'yyyy/MM/dd');
    
    const allThreads = GmailApp.search(`in:inbox after:${dateStr}`);
    const unprocessedThreads = filterAlreadyProcessed(allThreads);
    
    const summary = `Weekly scan: ${unprocessedThreads.length}/${allThreads.length} emails from last ${config.deltaWindowDays} days need processing`;
    
    AppLogger.info('📊 WEEKLY DELTA RESULTS', {
      searchQuery: `in:inbox after:${dateStr}`,
      totalFound: allThreads.length,
      needsProcessing: unprocessedThreads.length,
      summary: summary
    });
    
    return {
      threads: unprocessedThreads,
      scanType: 'delta-week',
      summary: summary
    };
  }
  
  /**
   * Filter out threads that already have AI processing labels
   */
  function filterAlreadyProcessed(threads: GoogleAppsScript.Gmail.GmailThread[]): GoogleAppsScript.Gmail.GmailThread[] {
    return threads.filter(thread => !threadHasAiLabels(thread));
  }
  
  /**
   * Check if thread has any AI processing labels
   */
  function threadHasAiLabels(thread: GoogleAppsScript.Gmail.GmailThread): boolean {
    const labels = thread.getLabels();
    const labelNames = labels.map(label => label.getName());
    
    // Only check for system labels
    return labelNames.some(name => 
      name === Config.LABELS.AI_PROCESSED ||
      name === Config.LABELS.AI_ERROR
    );
  }
  
  /**
   * Check if first run is done
   */
  function isFirstRunDone(): boolean {
    try {
      const props = PropertiesService.getUserProperties();
      return props.getProperty(FIRST_RUN_KEY) === 'true';
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Mark first run as complete after processing
   */
  export function markFirstRunDone(): void {
    try {
      const props = PropertiesService.getUserProperties();
      props.setProperty(FIRST_RUN_KEY, 'true');
      AppLogger.info('✅ FIRST RUN MARKED COMPLETE');
    } catch (error) {
      Utils.logError('mark first run done', error);
    }
  }
  
  /**
   * Reset to first run (for testing or reset)
   */
  export function resetToFirstRun(): void {
    try {
      const props = PropertiesService.getUserProperties();
      props.deleteProperty(FIRST_RUN_KEY);
      AppLogger.info('🔄 RESET TO FIRST RUN');
    } catch (error) {
      Utils.logError('reset first run', error);
    }
  }
  
  /**
   * Get scan statistics
   */
  export function getScanStats(): {
    isFirstRun: boolean;
    config: ScanConfig;
    lastRunType: string;
  } {
    return {
      isFirstRun: !isFirstRunDone(),
      config: getScanConfig(),
      lastRunType: isFirstRunDone() ? 'delta-week' : 'none'
    };
  }
}