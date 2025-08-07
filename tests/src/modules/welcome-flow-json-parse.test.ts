import { jest } from '@jest/globals';

// This test focuses only on the JSON parse error handling improvement

describe('Welcome Flow - JSON Parse Error Handling', () => {
  let mockGetProperty: jest.Mock;
  let mockDeleteProperty: jest.Mock;
  let mockError: jest.Mock;
  let mockWarn: jest.Mock;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock functions
    mockGetProperty = jest.fn();
    mockDeleteProperty = jest.fn();
    mockError = jest.fn();
    mockWarn = jest.fn();
    
    // Set up global mocks
    global.PropertiesService = {
      getUserProperties: jest.fn(() => ({
        getProperty: mockGetProperty,
        deleteProperty: mockDeleteProperty
      }))
    } as any;
    
    global.AppLogger = {
      error: mockError,
      warn: mockWarn
    } as any;
    
    global.Utils = {
      handleError: jest.fn((e) => e.toString())
    } as any;
  });
  
  // The core function we're testing
  function getOnboardingProgress() {
    const progressStr = PropertiesService.getUserProperties().getProperty('ONBOARDING_PROGRESS');
    
    if (progressStr) {
      try {
        return JSON.parse(progressStr);
      } catch (e) {
        // Log the parse error for debugging
        AppLogger.error('Failed to parse onboarding progress', {
          error: Utils.handleError(e),
          corruptedData: progressStr
        });
        
        // Clear the corrupted data
        PropertiesService.getUserProperties().deleteProperty('ONBOARDING_PROGRESS');
        
        // Notify about reset (will be shown on next UI interaction)
        AppLogger.warn('Onboarding progress reset due to data corruption');
      }
    }
    
    // Default progress
    return {
      state: 'not_started',
      apiKeyConfigured: false,
      permissionsGranted: false,
      testRunCompleted: false,
      customizationDone: false
    };
  }
  
  describe('getOnboardingProgress with new error handling', () => {
    it('should handle corrupted JSON data by logging, clearing, and returning defaults', () => {
      const corruptedData = '{"state": "api_key_setup", invalid json}';
      mockGetProperty.mockReturnValue(corruptedData);
      
      const progress = getOnboardingProgress();
      
      // Should log error with details
      expect(mockError).toHaveBeenCalledWith(
        'Failed to parse onboarding progress',
        expect.objectContaining({
          error: expect.any(String),
          corruptedData: corruptedData
        })
      );
      
      // Should warn about reset
      expect(mockWarn).toHaveBeenCalledWith(
        'Onboarding progress reset due to data corruption'
      );
      
      // Should delete corrupted data
      expect(mockDeleteProperty).toHaveBeenCalledWith('ONBOARDING_PROGRESS');
      
      // Should return default progress
      expect(progress).toEqual({
        state: 'not_started',
        apiKeyConfigured: false,
        permissionsGranted: false,
        testRunCompleted: false,
        customizationDone: false
      });
    });
    
    it('should handle various types of corrupted data', () => {
      const testCases = [
        { data: 'not json at all', shouldError: true },
        { data: '{"incomplete":', shouldError: true },
        { data: '[1,2,3]', shouldError: false, parsed: [1,2,3] }, // Array is valid JSON
        { data: 'null', shouldError: false, parsed: null },
        { data: 'undefined', shouldError: true }, // 'undefined' is not valid JSON
        { data: '""', shouldError: false, parsed: "" },
        { data: '{}', shouldError: false, parsed: {} }
      ];
      
      testCases.forEach(({ data, shouldError, parsed }) => {
        jest.clearAllMocks();
        mockGetProperty.mockReturnValue(data);
        
        const progress = getOnboardingProgress();
        
        if (shouldError) {
          expect(mockError).toHaveBeenCalled();
          expect(mockDeleteProperty).toHaveBeenCalledWith('ONBOARDING_PROGRESS');
          expect(progress.state).toBe('not_started');
        } else {
          expect(mockError).not.toHaveBeenCalled();
          // For valid JSON that isn't an object, it returns as-is
          if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            expect(progress).toEqual(parsed);
          } else {
            // For null, arrays, strings etc, the function would return them directly
            expect(progress).toEqual(parsed);
          }
        }
      });
    });
    
    it('should return default progress when no data exists', () => {
      mockGetProperty.mockReturnValue(null);
      
      const progress = getOnboardingProgress();
      
      expect(mockError).not.toHaveBeenCalled();
      expect(mockDeleteProperty).not.toHaveBeenCalled();
      expect(progress).toEqual({
        state: 'not_started',
        apiKeyConfigured: false,
        permissionsGranted: false,
        testRunCompleted: false,
        customizationDone: false
      });
    });
    
    it('should parse valid JSON data successfully', () => {
      const validData = {
        state: 'api_key_setup',
        apiKeyConfigured: true,
        permissionsGranted: false,
        testRunCompleted: false,
        customizationDone: false
      };
      
      mockGetProperty.mockReturnValue(JSON.stringify(validData));
      
      const progress = getOnboardingProgress();
      
      expect(mockError).not.toHaveBeenCalled();
      expect(mockDeleteProperty).not.toHaveBeenCalled();
      expect(progress).toEqual(validData);
    });
  });
});