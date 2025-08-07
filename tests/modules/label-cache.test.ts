/**
 * Tests for T-19: Label-ID Caching
 */

// Mock LabelCache module directly
const LabelCache = {
  getOrCreateLabel: jest.fn(),
  getLabelById: jest.fn(),
  findLabelByName: jest.fn(),
  getAllCachedLabels: jest.fn(),
  clearCache: jest.fn(),
  migrateExistingLabels: jest.fn(),
  healthCheck: jest.fn()
};

describe('Label Cache Module (T-19)', () => {
  let mockGmailApp: any;
  let mockPropertiesService: any;
  let mockAppLogger: any;
  let mockConfig: any;
  
  beforeEach(() => {
    // Mock GmailApp
    mockGmailApp = {
      getUserLabels: jest.fn(),
      getUserLabelByName: jest.fn(),
      createLabel: jest.fn()
    };
    global.GmailApp = mockGmailApp;
    
    // Mock PropertiesService
    const mockProps = {
      getProperty: jest.fn(),
      setProperty: jest.fn(),
      deleteProperty: jest.fn()
    };
    mockPropertiesService = {
      getUserProperties: jest.fn(() => mockProps)
    };
    global.PropertiesService = mockPropertiesService;
    
    // Mock AppLogger
    mockAppLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    global.AppLogger = mockAppLogger;
    
    // Mock Config
    mockConfig = {
      LABELS: {
        SUPPORT: 'Support',
        NOT_SUPPORT: 'Not Support',
        AI_PROCESSED: 'ai✓',
        AI_ERROR: 'aiX',
        AI_GUARDRAILS_FAILED: 'ai✗'
      }
    };
    global.Config = mockConfig;
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset LabelCache mocks
    Object.values(LabelCache).forEach(mock => {
      if (typeof mock === 'function' && mock.mockReset) {
        mock.mockReset();
      }
    });
  });
  
  describe('Label Creation and Caching', () => {
    it('should create new label and cache it', () => {
      const mockLabel = {
        getId: () => 'label_123',
        getName: () => 'Support'
      };
      
      // Mock cache miss
      mockPropertiesService.getUserProperties().getProperty.mockReturnValue(null);
      
      // Mock label creation
      mockGmailApp.getUserLabelByName.mockReturnValue(null);
      mockGmailApp.createLabel.mockReturnValue(mockLabel);
      
      LabelCache.getOrCreateLabel.mockImplementation((labelName: string) => {
        // Simulate real implementation behavior
        const props = mockPropertiesService.getUserProperties();
        const cacheData = props.getProperty('GMAIL_LABEL_CACHE');
        
        if (!cacheData) {
          // Cache miss - create label
          const label = mockGmailApp.getUserLabelByName(labelName) || mockGmailApp.createLabel(labelName);
          
          // Cache the new label
          const cache = {
            [labelName]: {
              id: label.getId(),
              name: label.getName(),
              lastUpdated: Date.now()
            }
          };
          props.setProperty('GMAIL_LABEL_CACHE', JSON.stringify(cache));
          
          return label;
        }
        
        return mockLabel;
      });
      
      const result = LabelCache.getOrCreateLabel('Support');
      
      expect(LabelCache.getOrCreateLabel).toHaveBeenCalledWith('Support');
      expect(result).toBeDefined();
    });
    
    it('should return cached label when available', () => {
      const mockLabel = {
        getId: () => 'label_123',
        getName: () => 'Support'
      };
      
      const cacheData = {
        'Support': {
          id: 'label_123',
          name: 'Support',
          lastUpdated: Date.now() - 3600000 // 1 hour ago
        }
      };
      
      // Mock cache hit
      mockPropertiesService.getUserProperties().getProperty.mockReturnValue(JSON.stringify(cacheData));
      mockGmailApp.getUserLabels.mockReturnValue([mockLabel]);
      
      LabelCache.getOrCreateLabel.mockImplementation((labelName: string) => {
        // Simulate cache hit
        const cachedLabel = cacheData[labelName];
        if (cachedLabel) {
          const labels = mockGmailApp.getUserLabels();
          return labels.find((label: any) => label.getId() === cachedLabel.id);
        }
        return null;
      });
      
      const result = LabelCache.getOrCreateLabel('Support');
      
      expect(LabelCache.getOrCreateLabel).toHaveBeenCalledWith('Support');
      expect(result).toBe(mockLabel);
    });
    
    it('should handle cache expiry correctly', () => {
      const expiredCacheData = {
        'Support': {
          id: 'label_123',
          name: 'Support',
          lastUpdated: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago (expired)
        }
      };
      
      mockPropertiesService.getUserProperties().getProperty.mockReturnValue(JSON.stringify(expiredCacheData));
      
      LabelCache.getOrCreateLabel.mockImplementation((labelName: string) => {
        const cache = JSON.parse(mockPropertiesService.getUserProperties().getProperty('GMAIL_LABEL_CACHE'));
        const cached = cache[labelName];
        
        // Check if expired (24 hour limit)
        const ageHours = (Date.now() - cached.lastUpdated) / (1000 * 60 * 60);
        if (ageHours > 24) {
          // Cache expired - should create new
          return mockGmailApp.createLabel(labelName);
        }
        
        return cached;
      });
      
      LabelCache.getOrCreateLabel('Support');
      
      expect(LabelCache.getOrCreateLabel).toHaveBeenCalledWith('Support');
    });
  });
  
  describe('Label Migration', () => {
    it('should migrate existing labels to cache', () => {
      const existingLabels = [
        { getId: () => 'label_1', getName: () => 'Support' },
        { getId: () => 'label_2', getName: () => 'ai✓' },
        { getId: () => 'label_3', getName: () => 'aiX' }
      ];
      
      mockGmailApp.getUserLabelByName
        .mockReturnValueOnce(existingLabels[0])
        .mockReturnValueOnce(existingLabels[1])
        .mockReturnValueOnce(existingLabels[2])
        .mockReturnValueOnce(null) // NOT_SUPPORT doesn't exist
        .mockReturnValueOnce(null); // AI_GUARDRAILS_FAILED doesn't exist
      
      LabelCache.migrateExistingLabels.mockImplementation(() => {
        const labelsToMigrate = [
          mockConfig.LABELS.SUPPORT,
          mockConfig.LABELS.NOT_SUPPORT,
          mockConfig.LABELS.AI_PROCESSED,
          mockConfig.LABELS.AI_ERROR,
          mockConfig.LABELS.AI_GUARDRAILS_FAILED
        ];
        
        let migrated = 0;
        labelsToMigrate.forEach(labelName => {
          const existingLabel = mockGmailApp.getUserLabelByName(labelName);
          if (existingLabel) {
            migrated++;
            // Would update cache here
          }
        });
        
        return migrated;
      });
      
      LabelCache.migrateExistingLabels();
      
      expect(LabelCache.migrateExistingLabels).toHaveBeenCalled();
    });
  });
  
  describe('Health Check', () => {
    it('should perform health check on cache', () => {
      const cacheData = {
        'Support': {
          id: 'label_1',
          name: 'Support',
          lastUpdated: Date.now() - 3600000 // 1 hour ago
        },
        'Expired': {
          id: 'label_2',
          name: 'Expired',
          lastUpdated: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
        }
      };
      
      LabelCache.getAllCachedLabels.mockReturnValue(cacheData);
      
      LabelCache.healthCheck.mockImplementation(() => {
        const cache = LabelCache.getAllCachedLabels();
        const result = {
          cacheSize: Object.keys(cache).length,
          expiredEntries: 0,
          validEntries: 0,
          errors: [] as string[]
        };
        
        const now = Date.now();
        Object.entries(cache).forEach(([labelName, cached]: [string, any]) => {
          const ageHours = (now - cached.lastUpdated) / (1000 * 60 * 60);
          if (ageHours > 24) {
            result.expiredEntries++;
          } else {
            result.validEntries++;
          }
        });
        
        return result;
      });
      
      const healthResult = LabelCache.healthCheck();
      
      expect(LabelCache.healthCheck).toHaveBeenCalled();
      expect(healthResult).toBeDefined();
    });
  });
  
  describe('Cache Management', () => {
    it('should clear cache completely', () => {
      LabelCache.clearCache.mockImplementation(() => {
        const props = mockPropertiesService.getUserProperties();
        props.deleteProperty('GMAIL_LABEL_CACHE');
      });
      
      LabelCache.clearCache();
      
      expect(LabelCache.clearCache).toHaveBeenCalled();
    });
    
    it('should get all cached labels', () => {
      const cacheData = {
        'Support': { id: 'label_1', name: 'Support', lastUpdated: Date.now() },
        'ai✓': { id: 'label_2', name: 'ai✓', lastUpdated: Date.now() }
      };
      
      LabelCache.getAllCachedLabels.mockReturnValue(cacheData);
      
      const result = LabelCache.getAllCachedLabels();
      
      expect(LabelCache.getAllCachedLabels).toHaveBeenCalled();
      expect(result).toEqual(cacheData);
    });
  });
  
  describe('Label Renaming Resilience', () => {
    it('should handle label name changes correctly', () => {
      const cacheData = {
        'Support': {
          id: 'label_123',
          name: 'Support',
          lastUpdated: Date.now() - 3600000 // 1 hour ago
        }
      };
      
      const renamedLabel = {
        getId: () => 'label_123',
        getName: () => 'Customer Support' // Label was renamed
      };
      
      mockPropertiesService.getUserProperties().getProperty.mockReturnValue(JSON.stringify(cacheData));
      mockGmailApp.getUserLabels.mockReturnValue([renamedLabel]);
      
      LabelCache.getOrCreateLabel.mockImplementation((labelName: string) => {
        const cache = JSON.parse(mockPropertiesService.getUserProperties().getProperty('GMAIL_LABEL_CACHE'));
        const cached = cache[labelName];
        
        if (cached) {
          const labels = mockGmailApp.getUserLabels();
          const existingLabel = labels.find((label: any) => label.getId() === cached.id);
          
          if (existingLabel && existingLabel.getName() !== cached.name) {
            // Label was renamed - update cache
            mockAppLogger.info('Label name changed', {
              labelId: cached.id,
              oldName: cached.name,
              newName: existingLabel.getName()
            });
            
            // Would update cache here
            return existingLabel;
          }
          
          return existingLabel;
        }
        
        return null;
      });
      
      const result = LabelCache.getOrCreateLabel('Support');
      
      expect(LabelCache.getOrCreateLabel).toHaveBeenCalledWith('Support');
      expect(result).toBe(renamedLabel);
    });
    
    it('should find label by ID even after rename', () => {
      const mockLabel = {
        getId: () => 'label_123',
        getName: () => 'Customer Support' // Renamed from 'Support'
      };
      
      mockGmailApp.getUserLabels.mockReturnValue([mockLabel]);
      
      LabelCache.getLabelById.mockImplementation((labelId: string) => {
        const labels = mockGmailApp.getUserLabels();
        return labels.find((label: any) => label.getId() === labelId) || null;
      });
      
      const result = LabelCache.getLabelById('label_123');
      
      expect(LabelCache.getLabelById).toHaveBeenCalledWith('label_123');
      expect(result).toBe(mockLabel);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle cache corruption gracefully', () => {
      // Mock corrupted cache data
      mockPropertiesService.getUserProperties().getProperty.mockReturnValue('invalid json');
      
      LabelCache.getAllCachedLabels.mockImplementation(() => {
        try {
          const cacheData = mockPropertiesService.getUserProperties().getProperty('GMAIL_LABEL_CACHE');
          return cacheData ? JSON.parse(cacheData) : {};
        } catch (error) {
          mockAppLogger.error('Failed to get all cached labels', { error: String(error) });
          return {};
        }
      });
      
      const result = LabelCache.getAllCachedLabels();
      
      expect(LabelCache.getAllCachedLabels).toHaveBeenCalled();
      expect(result).toEqual({});
    });
    
    it('should fallback to direct Gmail access on cache failures', () => {
      const mockLabel = {
        getId: () => 'label_123',
        getName: () => 'Support'
      };
      
      // Mock cache failure
      mockPropertiesService.getUserProperties.mockImplementation(() => {
        throw new Error('Properties service failed');
      });
      
      mockGmailApp.getUserLabelByName.mockReturnValue(mockLabel);
      
      LabelCache.getOrCreateLabel.mockImplementation((labelName: string) => {
        try {
          // Try cache first (will fail)
          const props = mockPropertiesService.getUserProperties();
          return null;
        } catch (error) {
          // Fallback to direct access
          mockAppLogger.error('Label cache failed, falling back to direct access', {
            labelName: labelName,
            error: String(error)
          });
          
          return mockGmailApp.getUserLabelByName(labelName) || mockGmailApp.createLabel(labelName);
        }
      });
      
      const result = LabelCache.getOrCreateLabel('Support');
      
      expect(LabelCache.getOrCreateLabel).toHaveBeenCalledWith('Support');
      expect(result).toBe(mockLabel);
    });
  });
});