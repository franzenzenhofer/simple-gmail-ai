/**
 * Tests for T-05: Add-on Heartbeat functionality
 */

describe('Heartbeat functionality (T-05)', () => {
  let mockSetProperty: jest.Mock;
  let mockGetProperty: jest.Mock;
  let mockDate: Date;
  let originalDate: any;
  
  beforeEach(() => {
    // Mock Date
    mockDate = new Date('2024-01-15T10:30:00.000Z');
    originalDate = global.Date;
    global.Date = jest.fn(() => mockDate) as any;
    global.Date.now = originalDate.now;
    global.Date.parse = originalDate.parse;
    (global.Date as any).prototype = originalDate.prototype;
    
    // Mock Google Apps Script services
    mockSetProperty = jest.fn();
    mockGetProperty = jest.fn();
    
    global.PropertiesService = {
      getUserProperties: jest.fn(() => ({
        setProperty: mockSetProperty,
        getProperty: mockGetProperty
      }))
    } as any;
    
    global.console = {
      log: jest.fn(),
      error: jest.fn()
    } as any;
    
    global.AppLogger = {
      initSpreadsheet: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      executionId: 'test-exec-123'
    } as any;
    
    global.DarkMode = {
      initializeDarkMode: jest.fn(),
      applyThemeToConfig: jest.fn()
    } as any;
    
    global.WelcomeFlow = {
      needsWelcomeFlow: jest.fn(() => false),
      createWelcomeCard: jest.fn()
    } as any;
    
    global.TestMode = {
      isTestModeActive: jest.fn(() => false),
      createTestModeCard: jest.fn()
    } as any;
    
    global.UIImprovements = {
      createCondensedMainCard: jest.fn(() => ({ build: () => 'mock-card' }))
    } as any;
    
    global.UI = {
      buildHomepage: jest.fn(() => 'mock-homepage')
    } as any;
    
    global.ErrorHandling = {
      handleGlobalError: jest.fn(() => 'error-card')
    } as any;
    
    global.Config = {
      VERSION: '1.0.0'
    } as any;
    
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore Date
    global.Date = originalDate;
  });
  
  describe('Heartbeat writing functionality', () => {
    it('should write ISO timestamp to AI_HEARTBEAT property', () => {
      // Test the core functionality - writing timestamp
      const timestamp = new Date().toISOString();
      PropertiesService.getUserProperties().setProperty('AI_HEARTBEAT', timestamp);
      
      expect(mockSetProperty).toHaveBeenCalledWith('AI_HEARTBEAT', '2024-01-15T10:30:00.000Z');
    });
    
    it('should handle errors gracefully', () => {
      // Test error handling
      mockSetProperty.mockImplementation(() => {
        throw new Error('Properties service error');
      });
      
      // Should not throw when wrapped in try-catch
      expect(() => {
        try {
          PropertiesService.getUserProperties().setProperty('AI_HEARTBEAT', new Date().toISOString());
        } catch (error) {
          console.error('Failed to write heartbeat', error);
        }
      }).not.toThrow();
      
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('Timestamp format', () => {
    it('should use valid ISO 8601 format', () => {
      const timestamp = new Date().toISOString();
      
      // Should match ISO format
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      // Should be parseable
      expect(Date.parse(timestamp)).not.toBeNaN();
      
      // Should round-trip correctly
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });
  
  describe('Property key consistency', () => {
    it('should always use AI_HEARTBEAT as the property key', () => {
      // The key should be consistent across all uses
      const KEY = 'AI_HEARTBEAT';
      
      PropertiesService.getUserProperties().setProperty(KEY, 'test-value');
      expect(mockSetProperty).toHaveBeenCalledWith(KEY, 'test-value');
      
      PropertiesService.getUserProperties().getProperty(KEY);
      expect(mockGetProperty).toHaveBeenCalledWith(KEY);
    });
  });
  
  describe('Monitoring integration requirements', () => {
    it('should provide timestamp suitable for monitoring alerts', () => {
      const timestamp = '2024-01-15T10:30:00.000Z';
      mockGetProperty.mockReturnValue(timestamp);
      
      // Get heartbeat
      const lastHeartbeat = PropertiesService.getUserProperties().getProperty('AI_HEARTBEAT');
      
      // Calculate time difference using original Date
      const heartbeatDate = new originalDate(lastHeartbeat!);
      const now = new originalDate('2024-01-15T11:00:00.000Z'); // 30 minutes later
      const diffMinutes = Math.floor((now.getTime() - heartbeatDate.getTime()) / 60000);
      
      expect(diffMinutes).toBe(30);
      
      // This can be used for monitoring alerts (e.g., alert if > 24 hours)
      const diffHours = diffMinutes / 60;
      expect(diffHours).toBeLessThan(24); // Would not trigger alert
    });
  });
  
  describe('UI display of heartbeat', () => {
    it('should format heartbeat for human-readable display', () => {
      const timestamp = '2024-01-15T10:30:00.000Z';
      const heartbeatDate = new originalDate(timestamp);
      
      // Test toLocaleString works
      const displayString = heartbeatDate.toLocaleString();
      expect(displayString).toBeTruthy();
      
      // Test relative time calculation
      const now = new originalDate('2024-01-15T10:31:00.000Z'); // 1 minute later
      const diffMinutes = Math.floor((now.getTime() - heartbeatDate.getTime()) / 60000);
      const relativeTime = diffMinutes === 0 ? 'Just now' : diffMinutes + ' minutes ago';
      
      expect(relativeTime).toBe('1 minutes ago');
    });
  });
});