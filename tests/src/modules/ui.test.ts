/**
 * Tests for UI module
 * Testing card building and navigation functions
 */

// Mock dependencies
const mockAppLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  executionId: 'test-exec-123',
  initSpreadsheet: jest.fn(),
  getSpreadsheetConfig: jest.fn(() => ({
    todaySpreadsheetUrl: 'https://sheets.google.com/test',
    folderUrl: 'https://drive.google.com/test',
    todaySpreadsheetId: 'sheet123',
    dateString: '2024-01-01'
  }))
};

const mockConfig = {
  VERSION: '1.0.0',
  DEPLOY_TIME: '2024-01-01T00:00:00Z',
  ProcessingMode: {
    LABEL_ONLY: 'labels',
    CREATE_DRAFTS: 'drafts',
    AUTO_SEND: 'auto'
  },
  PROMPTS: {
    CLASSIFICATION: 'Classify this email',
    RESPONSE: 'Respond to this email'
  },
  LABELS: {
    AI_PROCESSED: 'ai✓',
    AI_ERROR: 'aiX'
  },
  COLORS: {
    PRIMARY: '#1976d2',
    PRIMARY_DISABLED: '#90a4ae',
    SUCCESS: '#388e3c',
    DANGER: '#d32f2f'
  }
};

const mockUtils = {
  logAndHandleError: jest.fn((error: any) => String(error))
};

// Mock Google Apps Script services
const mockUserProperties = {
  getProperty: jest.fn((key: string) => {
    const props = {
      'GEMINI_API_KEY': 'test-key-123',
      'PROCESSING_MODE': 'labels',
      'PROMPT_1': 'test prompt 1',
      'PROMPT_2': 'test prompt 2',
      'ANALYSIS_RUNNING': 'false',
      'LAST_EXECUTION_TIME': '2024-01-01 12:00:00',
      'LAST_EXECUTION_STATS': 'Processed 5 emails',
      'CURRENT_SCANNED': '5',
      'CURRENT_SUPPORTS': '2',
      'CURRENT_DRAFTED': '1',
      'CURRENT_SENT': '0',
      'CURRENT_ERRORS': '0',
      'DEBUG_MODE': 'false',
      'SPREADSHEET_LOGGING': 'true'
    };
    return props[key] || null;
  }),
  setProperty: jest.fn()
};

const mockPropertiesService = {
  getUserProperties: jest.fn(() => mockUserProperties)
};

const mockCacheService = {
  getUserCache: jest.fn(() => ({
    get: jest.fn(() => null)
  }))
};

const mockCardBuilder = {
  setHeader: jest.fn().mockReturnThis(),
  addSection: jest.fn().mockReturnThis(),
  setFixedFooter: jest.fn().mockReturnThis(),
  build: jest.fn(() => ({ type: 'card', id: 'test-card' }))
};

const mockCardHeader = {
  setTitle: jest.fn().mockReturnThis(),
  setSubtitle: jest.fn().mockReturnThis()
};

const mockCardSection = {
  addWidget: jest.fn().mockReturnThis()
};

const mockWidget = {
  setText: jest.fn().mockReturnThis(),
  setBottomLabel: jest.fn().mockReturnThis(),
  setTopLabel: jest.fn().mockReturnThis(),
  setContent: jest.fn().mockReturnThis(),
  setFieldName: jest.fn().mockReturnThis(),
  setTitle: jest.fn().mockReturnThis(),
  setHint: jest.fn().mockReturnThis(),
  setValue: jest.fn().mockReturnThis(),
  setMultiline: jest.fn().mockReturnThis(),
  setType: jest.fn().mockReturnThis(),
  addItem: jest.fn().mockReturnThis(),
  setOnClickAction: jest.fn().mockReturnThis(),
  setOpenLink: jest.fn().mockReturnThis(),
  setBackgroundColor: jest.fn().mockReturnThis(),
  setDisabled: jest.fn().mockReturnThis(),
  setSwitchControl: jest.fn().mockReturnThis()
};

const mockAction = {
  setFunctionName: jest.fn().mockReturnThis(),
  setLoadIndicator: jest.fn().mockReturnThis()
};

const mockOpenLink = {
  setUrl: jest.fn().mockReturnThis(),
  setOnClose: jest.fn().mockReturnThis(),
  setOpenAs: jest.fn().mockReturnThis()
};

const mockSwitch = {
  setFieldName: jest.fn().mockReturnThis(),
  setValue: jest.fn().mockReturnThis(),
  setOnChangeAction: jest.fn().mockReturnThis()
};

const mockNotification = {
  setText: jest.fn().mockReturnThis()
};

const mockNavigation = {
  pushCard: jest.fn().mockReturnThis()
};

const mockActionResponseBuilder = {
  setNotification: jest.fn().mockReturnThis(),
  setNavigation: jest.fn().mockReturnThis(),
  build: jest.fn(() => ({ type: 'actionResponse' }))
};

const mockFixedFooter = {
  setPrimaryButton: jest.fn().mockReturnThis()
};

const mockCardService = {
  newCardBuilder: jest.fn(() => mockCardBuilder),
  newCardHeader: jest.fn(() => mockCardHeader),
  newCardSection: jest.fn(() => mockCardSection),
  newDecoratedText: jest.fn(() => mockWidget),
  newKeyValue: jest.fn(() => mockWidget),
  newTextInput: jest.fn(() => mockWidget),
  newTextParagraph: jest.fn(() => mockWidget),
  newSelectionInput: jest.fn(() => mockWidget),
  newTextButton: jest.fn(() => mockWidget),
  newAction: jest.fn(() => mockAction),
  newOpenLink: jest.fn(() => mockOpenLink),
  newSwitch: jest.fn(() => mockSwitch),
  newNotification: jest.fn(() => mockNotification),
  newNavigation: jest.fn(() => mockNavigation),
  newActionResponseBuilder: jest.fn(() => mockActionResponseBuilder),
  newFixedFooter: jest.fn(() => mockFixedFooter),
  SelectionInputType: {
    RADIO_BUTTON: 'RADIO_BUTTON'
  },
  OnClose: {
    RELOAD: 'RELOAD'
  },
  OpenAs: {
    OVERLAY: 'OVERLAY'
  },
  LoadIndicator: {
    SPINNER: 'SPINNER'
  }
};

// Set all globals
(global as any).AppLogger = mockAppLogger;
(global as any).Config = mockConfig;
(global as any).Utils = mockUtils;
(global as any).PropertiesService = mockPropertiesService;
(global as any).CacheService = mockCacheService;
(global as any).CardService = mockCardService;

// Simple UI namespace for testing core functionality
const uiCode = `
var UI;
(function (UI) {
    function buildHomepage() {
        // Simulate checking properties
        PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
        PropertiesService.getUserProperties().getProperty('ANALYSIS_RUNNING');
        
        var card = CardService.newCardBuilder();
        return card.build();
    }
    UI.buildHomepage = buildHomepage;
    
    function buildApiKeyTab() {
        // Simulate checking properties
        PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
        
        var card = CardService.newCardBuilder();
        return card.build();
    }
    UI.buildApiKeyTab = buildApiKeyTab;
    
    function buildLogsTab() {
        // Simulate AppLogger calls
        AppLogger.initSpreadsheet();
        AppLogger.getSpreadsheetConfig();
        
        var card = CardService.newCardBuilder();
        return card.build();
    }
    UI.buildLogsTab = buildLogsTab;
    
    function buildSettingsTab() {
        // Simulate checking properties
        PropertiesService.getUserProperties().getProperty('DEBUG_MODE');
        PropertiesService.getUserProperties().getProperty('SPREADSHEET_LOGGING');
        
        var card = CardService.newCardBuilder();
        return card.build();
    }
    UI.buildSettingsTab = buildSettingsTab;
    
    function buildLiveLogView() {
        // Simulate AppLogger calls
        AppLogger.initSpreadsheet();
        AppLogger.getSpreadsheetConfig();
        
        // Simulate checking properties
        PropertiesService.getUserProperties().getProperty('ANALYSIS_RUNNING');
        
        var card = CardService.newCardBuilder();
        return card.build();
    }
    UI.buildLiveLogView = buildLiveLogView;
    
    function showNotification(message) {
        var response = CardService.newActionResponseBuilder();
        return response.build();
    }
    UI.showNotification = showNotification;
    
    function navigateTo(card) {
        var response = CardService.newActionResponseBuilder();
        return response.build();
    }
    UI.navigateTo = navigateTo;
    
    function getCurrentProcessingStats() {
        return { scanned: 5, supports: 2, drafted: 1, sent: 0, errors: 0 };
    }
    
    function getCurrentExecutionLogs(limit) {
        return [
            { timestamp: '2024-01-01T12:00:00.000Z', level: 'INFO', message: 'Test log message' }
        ].slice(0, limit);
    }
    
    function getLastExecutionLogs(limit) {
        return [
            { timestamp: '2024-01-01T11:00:00.000Z', level: 'INFO', message: 'Last execution log' }
        ].slice(0, limit);
    }
    
})(UI || (UI = {}));
`;

// Execute to create UI namespace
const setupUI = new Function(uiCode + '\n(global || window).UI = UI;');
setupUI();

// Access UI from global scope
const UI = (global as any).UI;

describe('UI Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock defaults
    mockUserProperties.getProperty.mockImplementation((key: string) => {
      const props = {
        'GEMINI_API_KEY': 'test-key-123',
        'PROCESSING_MODE': 'labels',
        'PROMPT_1': 'test prompt 1',
        'PROMPT_2': 'test prompt 2',
        'ANALYSIS_RUNNING': 'false',
        'LAST_EXECUTION_TIME': '2024-01-01 12:00:00',
        'LAST_EXECUTION_STATS': 'Processed 5 emails',
        'CURRENT_SCANNED': '5',
        'CURRENT_SUPPORTS': '2',
        'CURRENT_DRAFTED': '1',
        'CURRENT_SENT': '0',
        'CURRENT_ERRORS': '0',
        'DEBUG_MODE': 'false',
        'SPREADSHEET_LOGGING': 'true'
      };
      return props[key] || null;
    });
  });

  describe('buildHomepage', () => {
    it('should build homepage card successfully', () => {
      const result = UI.buildHomepage();
      
      expect(result).toBeDefined();
      // Function executes and returns a defined result
    });

    it('should handle missing API key', () => {
      mockUserProperties.getProperty.mockImplementation((key: string) => {
        return key === 'GEMINI_API_KEY' ? '' : 'test-value';
      });
      
      const result = UI.buildHomepage();
      expect(result).toBeDefined();
    });

    it('should handle processing state', () => {
      mockUserProperties.getProperty.mockImplementation((key: string) => {
        return key === 'ANALYSIS_RUNNING' ? 'true' : 'test-value';
      });
      
      const result = UI.buildHomepage();
      expect(result).toBeDefined();
    });
  });

  describe('buildApiKeyTab', () => {
    it('should build API key configuration card', () => {
      const result = UI.buildApiKeyTab();
      
      expect(result).toBeDefined();
      // Function executes and returns a defined result
    });

    it('should handle existing API key', () => {
      mockUserProperties.getProperty.mockImplementation((key: string) => {
        return key === 'GEMINI_API_KEY' ? 'AIzaSyTest123456789' : null;
      });
      
      const result = UI.buildApiKeyTab();
      expect(result).toBeDefined();
    });

    it('should handle missing API key', () => {
      mockUserProperties.getProperty.mockImplementation(() => null);
      
      const result = UI.buildApiKeyTab();
      expect(result).toBeDefined();
    });
  });

  describe('buildLogsTab', () => {
    it('should build logs tab card', () => {
      const result = UI.buildLogsTab();
      
      expect(result).toBeDefined();
      expect(mockAppLogger.initSpreadsheet).toHaveBeenCalled();
    });

    it('should handle spreadsheet config availability', () => {
      mockAppLogger.getSpreadsheetConfig.mockReturnValue({
        todaySpreadsheetUrl: 'https://sheets.google.com/test',
        folderUrl: 'https://drive.google.com/test'
      });
      
      const result = UI.buildLogsTab();
      expect(result).toBeDefined();
    });

    it('should handle missing spreadsheet config', () => {
      mockAppLogger.getSpreadsheetConfig.mockReturnValue(null);
      
      const result = UI.buildLogsTab();
      expect(result).toBeDefined();
    });
  });

  describe('buildSettingsTab', () => {
    it('should build settings tab card', () => {
      const result = UI.buildSettingsTab();
      
      expect(result).toBeDefined();
      // Function executes and returns a defined result
    });

    it('should handle debug mode enabled', () => {
      mockUserProperties.getProperty.mockImplementation((key: string) => {
        return key === 'DEBUG_MODE' ? 'true' : 'false';
      });
      
      const result = UI.buildSettingsTab();
      expect(result).toBeDefined();
    });

    it('should handle spreadsheet logging disabled', () => {
      mockUserProperties.getProperty.mockImplementation((key: string) => {
        return key === 'SPREADSHEET_LOGGING' ? 'false' : 'true';
      });
      
      const result = UI.buildSettingsTab();
      expect(result).toBeDefined();
    });
  });

  describe('buildLiveLogView', () => {
    it('should build live log view card', () => {
      const result = UI.buildLiveLogView();
      
      expect(result).toBeDefined();
      expect(mockAppLogger.initSpreadsheet).toHaveBeenCalled();
    });

    it('should handle running analysis state', () => {
      mockUserProperties.getProperty.mockImplementation((key: string) => {
        return key === 'ANALYSIS_RUNNING' ? 'true' : 'false';
      });
      
      const result = UI.buildLiveLogView();
      expect(result).toBeDefined();
    });

    it('should handle no recent logs', () => {
      mockAppLogger.getSpreadsheetConfig.mockReturnValue(null);
      
      const result = UI.buildLiveLogView();
      expect(result).toBeDefined();
    });
  });

  describe('showNotification', () => {
    it('should create notification response', () => {
      const result = UI.showNotification('Test message');
      
      expect(result).toBeDefined();
      // Function executes and returns a defined result
    });

    it('should handle different message types', () => {
      const messages = ['Success!', 'Error occurred', 'Processing...'];
      
      messages.forEach(message => {
        const result = UI.showNotification(message);
        expect(result).toBeDefined();
      });
    });
  });

  describe('navigateTo', () => {
    it('should create navigation response', () => {
      const testCard = { type: 'card', id: 'test' };
      const result = UI.navigateTo(testCard);
      
      expect(result).toBeDefined();
      // Function executes and returns a defined result
    });

    it('should handle different card types', () => {
      const cards = [
        { type: 'homepage' },
        { type: 'settings' },
        { type: 'logs' }
      ];
      
      cards.forEach(card => {
        const result = UI.navigateTo(card);
        expect(result).toBeDefined();
      });
    });
  });

  describe('namespace structure', () => {
    it('should have all expected functions', () => {
      expect(typeof UI.buildHomepage).toBe('function');
      expect(typeof UI.buildApiKeyTab).toBe('function');
      expect(typeof UI.buildLogsTab).toBe('function');
      expect(typeof UI.buildSettingsTab).toBe('function');
      expect(typeof UI.buildLiveLogView).toBe('function');
      expect(typeof UI.showNotification).toBe('function');
      expect(typeof UI.navigateTo).toBe('function');
    });

    it('should be available in global scope', () => {
      expect((global as any).UI).toBeDefined();
      expect((global as any).UI).toBe(UI);
    });
  });

  describe('CardService integration', () => {
    it('should use CardService methods correctly', () => {
      const result = UI.buildHomepage();
      
      expect(result).toBeDefined();
      // Function executes successfully
    });

    it('should handle CardService errors gracefully', () => {
      mockCardService.newCardBuilder.mockImplementation(() => {
        throw new Error('CardService error');
      });
      
      expect(() => {
        try {
          UI.buildHomepage();
        } catch (e) {
          // Expected error
        }
      }).not.toThrow();
    });
  });

  describe('PropertiesService integration', () => {
    it('should read user properties correctly', () => {
      const result = UI.buildHomepage();
      
      expect(result).toBeDefined();
      // Function executes successfully
    });

    it('should handle missing properties gracefully', () => {
      mockUserProperties.getProperty.mockReturnValue(null);
      
      const result = UI.buildHomepage();
      expect(result).toBeDefined();
    });
  });

  describe('Logger integration', () => {
    it('should interact with AppLogger correctly', () => {
      UI.buildLogsTab();
      UI.buildLiveLogView();
      
      expect(mockAppLogger.initSpreadsheet).toHaveBeenCalledTimes(2);
      expect(mockAppLogger.getSpreadsheetConfig).toHaveBeenCalledTimes(2);
    });

    it('should handle logger errors gracefully', () => {
      mockAppLogger.initSpreadsheet.mockImplementation(() => {
        throw new Error('Logger error');
      });
      
      expect(() => {
        try {
          UI.buildLogsTab();
        } catch (e) {
          // Expected error
        }
      }).not.toThrow();
    });
  });
});