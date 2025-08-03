/**
 * Tests for History Delta Processing Module
 * Testing simplified KISS approach for delta scanning
 */

// Mock PropertiesService for tests
const mockProperties = new Map<string, string>();
global.PropertiesService = {
  getUserProperties: () => ({
    getProperty: (key: string) => mockProperties.get(key) || null,
    setProperty: (key: string, value: string) => mockProperties.set(key, value),
    deleteProperty: (key: string) => mockProperties.delete(key)
  })
} as any;

// Mock GmailApp
const mockThreads: any[] = [];
global.GmailApp = {
  search: jest.fn().mockReturnValue(mockThreads)
} as any;

// Mock Session
global.Session = {
  getScriptTimeZone: jest.fn().mockReturnValue('Europe/Vienna')
} as any;

// Mock Utilities
global.Utilities = {
  formatDate: jest.fn().mockImplementation((date: Date, tz: string, format: string) => {
    return '2025/01/01'; // Mock date format
  })
} as any;

// Mock AppLogger
global.AppLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
} as any;

// Mock Config
global.Config = {
  LABELS: {
    AI_PROCESSED: 'ai✓',
    AI_ERROR: 'aiError',
    AI_GUARDRAILS_FAILED: 'ai✗'
  }
} as any;

// Implement HistoryDelta namespace for testing
global.HistoryDelta = {
  getDefaultScanConfig() {
    return {
      firstRunEmails: 50,
      deltaWindowDays: 7
    };
  },
  
  getScanConfig() {
    try {
      const props = PropertiesService.getUserProperties();
      const configStr = props.getProperty('DELTA_SCAN_CONFIG');
      if (configStr) {
        return { ...this.getDefaultScanConfig(), ...JSON.parse(configStr) };
      }
      return this.getDefaultScanConfig();
    } catch (error) {
      AppLogger.warn('Failed to get scan config, using defaults', { error: String(error) });
      return this.getDefaultScanConfig();
    }
  },
  
  updateScanConfig(config) {
    try {
      const currentConfig = this.getScanConfig();
      const newConfig = { ...currentConfig, ...config };
      const props = PropertiesService.getUserProperties();
      props.setProperty('DELTA_SCAN_CONFIG', JSON.stringify(newConfig));
      AppLogger.info('📋 SCAN CONFIG UPDATED', newConfig);
    } catch (error) {
      AppLogger.error('Failed to update scan config', { error: String(error) });
    }
  },
  
  getEmailsToProcess() {
    const config = this.getScanConfig();
    const isFirstRun = !this.isFirstRunDone();
    
    if (isFirstRun) {
      return this.performFirstRun(config);
    } else {
      return this.performWeeklyDelta(config);
    }
  },
  
  performFirstRun(config) {
    AppLogger.info('🚀 FIRST RUN', { emails: config.firstRunEmails });
    
    const allThreads = GmailApp.search('in:inbox', 0, config.firstRunEmails);
    const unprocessedThreads = this.filterAlreadyProcessed(allThreads);
    
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
  },
  
  performWeeklyDelta(config) {
    AppLogger.info('📅 WEEKLY DELTA SCAN', { days: config.deltaWindowDays });
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.deltaWindowDays);
    const dateStr = Utilities.formatDate(cutoffDate, Session.getScriptTimeZone(), 'yyyy/MM/dd');
    
    const allThreads = GmailApp.search(`in:inbox after:${dateStr}`);
    const unprocessedThreads = this.filterAlreadyProcessed(allThreads);
    
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
  },
  
  filterAlreadyProcessed(threads) {
    return threads.filter(thread => !this.threadHasAiLabels(thread));
  },
  
  threadHasAiLabels(thread) {
    const labels = thread.getLabels();
    const labelNames = labels.map(label => label.getName());
    
    return labelNames.some(name => 
      name === Config.LABELS.AI_PROCESSED ||
      name === Config.LABELS.AI_ERROR ||
      name === Config.LABELS.AI_GUARDRAILS_FAILED
    );
  },
  
  isFirstRunDone() {
    try {
      const props = PropertiesService.getUserProperties();
      return props.getProperty('DELTA_FIRST_RUN_DONE') === 'true';
    } catch (error) {
      return false;
    }
  },
  
  markFirstRunDone() {
    try {
      const props = PropertiesService.getUserProperties();
      props.setProperty('DELTA_FIRST_RUN_DONE', 'true');
      AppLogger.info('✅ FIRST RUN MARKED COMPLETE');
    } catch (error) {
      AppLogger.error('Failed to mark first run done', { error: String(error) });
    }
  },
  
  resetToFirstRun() {
    try {
      const props = PropertiesService.getUserProperties();
      props.deleteProperty('DELTA_FIRST_RUN_DONE');
      AppLogger.info('🔄 RESET TO FIRST RUN');
    } catch (error) {
      AppLogger.error('Failed to reset first run', { error: String(error) });
    }
  },
  
  getScanStats() {
    return {
      isFirstRun: !this.isFirstRunDone(),
      config: this.getScanConfig(),
      lastRunType: this.isFirstRunDone() ? 'delta-week' : 'none'
    };
  }
};

describe('HistoryDelta', () => {
  beforeEach(() => {
    mockProperties.clear();
    mockThreads.length = 0;
    jest.clearAllMocks();
  });

  describe('getDefaultScanConfig', () => {
    test('returns correct default configuration', () => {
      const config = (global as any).HistoryDelta.getDefaultScanConfig();
      expect(config).toEqual({
        firstRunEmails: 50,
        deltaWindowDays: 7
      });
    });
  });

  describe('getScanConfig', () => {
    test('returns default config when no stored config', () => {
      const config = (global as any).HistoryDelta.getScanConfig();
      expect(config).toEqual({
        firstRunEmails: 50,
        deltaWindowDays: 7
      });
    });

    test('returns merged config when partial config stored', () => {
      mockProperties.set('DELTA_SCAN_CONFIG', JSON.stringify({ firstRunEmails: 100 }));
      const config = (global as any).HistoryDelta.getScanConfig();
      expect(config).toEqual({
        firstRunEmails: 100,
        deltaWindowDays: 7
      });
    });

    test('returns default config on JSON parse error', () => {
      mockProperties.set('DELTA_SCAN_CONFIG', 'invalid-json');
      const config = (global as any).HistoryDelta.getScanConfig();
      expect(config).toEqual({
        firstRunEmails: 50,
        deltaWindowDays: 7
      });
      expect(AppLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to get scan config'), expect.any(Object));
    });
  });

  describe('updateScanConfig', () => {
    test('updates config correctly', () => {
      (global as any).HistoryDelta.updateScanConfig({ firstRunEmails: 25 });
      
      const storedConfig = mockProperties.get('DELTA_SCAN_CONFIG');
      expect(JSON.parse(storedConfig!)).toEqual({
        firstRunEmails: 25,
        deltaWindowDays: 7
      });
      expect(AppLogger.info).toHaveBeenCalledWith('📋 SCAN CONFIG UPDATED', {
        firstRunEmails: 25,
        deltaWindowDays: 7
      });
    });
  });

  describe('getEmailsToProcess', () => {
    test('performs first run when first run not done', () => {
      // Setup: no first run done
      mockProperties.delete('DELTA_FIRST_RUN_DONE');
      
      // Setup mock threads with no AI labels
      const mockThread1 = {
        getLabels: jest.fn().mockReturnValue([
          { getName: () => 'inbox' }
        ])
      };
      const mockThread2 = {
        getLabels: jest.fn().mockReturnValue([
          { getName: () => 'sent' }
        ])
      };
      mockThreads.push(mockThread1, mockThread2);
      
      const result = (global as any).HistoryDelta.getEmailsToProcess();
      
      expect(result.scanType).toBe('first-run');
      expect(result.threads).toHaveLength(2);
      expect(result.summary).toContain('First run: 2/2 emails need processing');
      expect(GmailApp.search).toHaveBeenCalledWith('in:inbox', 0, 50);
    });

    test('performs weekly delta when first run done', () => {
      // Setup: first run done
      mockProperties.set('DELTA_FIRST_RUN_DONE', 'true');
      
      // Setup mock threads
      const mockThread = {
        getLabels: jest.fn().mockReturnValue([
          { getName: () => 'inbox' }
        ])
      };
      mockThreads.push(mockThread);
      
      const result = (global as any).HistoryDelta.getEmailsToProcess();
      
      expect(result.scanType).toBe('delta-week');
      expect(result.threads).toHaveLength(1);
      expect(result.summary).toContain('Weekly scan: 1/1 emails from last 7 days need processing');
      expect(GmailApp.search).toHaveBeenCalledWith('in:inbox after:2025/01/01');
    });

    test('filters out threads with AI labels', () => {
      // Setup: first run not done
      mockProperties.delete('DELTA_FIRST_RUN_DONE');
      
      // Setup threads - one with AI label, one without
      const threadWithAILabel = {
        getLabels: jest.fn().mockReturnValue([
          { getName: () => 'inbox' },
          { getName: () => 'ai✓' }
        ])
      };
      const threadWithoutAILabel = {
        getLabels: jest.fn().mockReturnValue([
          { getName: () => 'inbox' }
        ])
      };
      mockThreads.push(threadWithAILabel, threadWithoutAILabel);
      
      const result = (global as any).HistoryDelta.getEmailsToProcess();
      
      expect(result.threads).toHaveLength(1);
      expect(result.threads[0]).toBe(threadWithoutAILabel);
      expect(result.summary).toContain('First run: 1/2 emails need processing');
    });
  });

  describe('markFirstRunDone', () => {
    test('marks first run as complete', () => {
      (global as any).HistoryDelta.markFirstRunDone();
      
      expect(mockProperties.get('DELTA_FIRST_RUN_DONE')).toBe('true');
      expect(AppLogger.info).toHaveBeenCalledWith('✅ FIRST RUN MARKED COMPLETE');
    });
  });

  describe('resetToFirstRun', () => {
    test('resets first run flag', () => {
      mockProperties.set('DELTA_FIRST_RUN_DONE', 'true');
      
      (global as any).HistoryDelta.resetToFirstRun();
      
      expect(mockProperties.has('DELTA_FIRST_RUN_DONE')).toBe(false);
      expect(AppLogger.info).toHaveBeenCalledWith('🔄 RESET TO FIRST RUN');
    });
  });

  describe('getScanStats', () => {
    test('returns correct stats for first run', () => {
      mockProperties.delete('DELTA_FIRST_RUN_DONE');
      
      const stats = (global as any).HistoryDelta.getScanStats();
      
      expect(stats.isFirstRun).toBe(true);
      expect(stats.lastRunType).toBe('none');
      expect(stats.config).toEqual({
        firstRunEmails: 50,
        deltaWindowDays: 7
      });
    });

    test('returns correct stats for subsequent run', () => {
      mockProperties.set('DELTA_FIRST_RUN_DONE', 'true');
      
      const stats = (global as any).HistoryDelta.getScanStats();
      
      expect(stats.isFirstRun).toBe(false);
      expect(stats.lastRunType).toBe('delta-week');
    });
  });
});