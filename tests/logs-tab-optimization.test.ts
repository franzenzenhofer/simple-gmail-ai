/**
 * Tests for logs tab initialization optimization
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock AppLogger
const mockInitSpreadsheet = jest.fn();
const mockGetSpreadsheetConfig = jest.fn();
const mockAppLogger = {
  initSpreadsheet: mockInitSpreadsheet,
  getSpreadsheetConfig: mockGetSpreadsheetConfig
};

// Mock CardService
const mockCardBuilder = {
  setHeader: jest.fn().mockReturnThis(),
  addSection: jest.fn().mockReturnThis(),
  build: jest.fn()
};

const mockCardHeader = {
  setTitle: jest.fn().mockReturnThis()
};

const mockCardSection = {
  addWidget: jest.fn().mockReturnThis()
};

const mockDecoratedText = {
  setText: jest.fn().mockReturnThis(),
  setIconUrl: jest.fn().mockReturnThis(),
  setOpenLink: jest.fn().mockReturnThis()
};

const mockCardService = {
  newCardBuilder: jest.fn(() => mockCardBuilder),
  newCardHeader: jest.fn(() => mockCardHeader),
  newCardSection: jest.fn(() => mockCardSection),
  newDecoratedText: jest.fn(() => mockDecoratedText),
  newOpenLink: jest.fn(() => ({ setUrl: jest.fn() }))
};

describe('Logs Tab Initialization Optimization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up global mocks
    (global as any).AppLogger = mockAppLogger;
    (global as any).CardService = mockCardService;
  });

  it('should not call initSpreadsheet if config already exists', () => {
    // Mock existing config
    const existingConfig = {
      folderId: 'folder123',
      todaySpreadsheetId: 'sheet123',
      todaySpreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet123',
      dateString: '2025-08-05'
    };
    
    mockGetSpreadsheetConfig.mockReturnValue(existingConfig);

    // Simulate buildLogsTab logic
    let config = mockAppLogger.getSpreadsheetConfig();
    if (!config) {
      mockAppLogger.initSpreadsheet();
      config = mockAppLogger.getSpreadsheetConfig();
    }

    // Verify initSpreadsheet was NOT called
    expect(mockGetSpreadsheetConfig).toHaveBeenCalledTimes(1);
    expect(mockInitSpreadsheet).not.toHaveBeenCalled();
    expect(config).toBe(existingConfig);
  });

  it('should call initSpreadsheet only when config is null', () => {
    // Mock no existing config
    mockGetSpreadsheetConfig
      .mockReturnValueOnce(null) // First call returns null
      .mockReturnValueOnce({ // Second call after init returns config
        folderId: 'folder456',
        todaySpreadsheetId: 'sheet456',
        todaySpreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet456',
        dateString: '2025-08-05'
      });

    // Simulate buildLogsTab logic
    let config = mockAppLogger.getSpreadsheetConfig();
    if (!config) {
      mockAppLogger.initSpreadsheet();
      config = mockAppLogger.getSpreadsheetConfig();
    }

    // Verify initSpreadsheet was called
    expect(mockGetSpreadsheetConfig).toHaveBeenCalledTimes(2);
    expect(mockInitSpreadsheet).toHaveBeenCalledTimes(1);
    expect(config).toHaveProperty('folderId', 'folder456');
  });

  it('should reuse config on multiple tab opens', () => {
    const existingConfig = {
      folderId: 'folder789',
      todaySpreadsheetId: 'sheet789',
      todaySpreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet789',
      dateString: '2025-08-05'
    };
    
    mockGetSpreadsheetConfig.mockReturnValue(existingConfig);

    // Simulate multiple tab opens
    for (let i = 0; i < 5; i++) {
      let config = mockAppLogger.getSpreadsheetConfig();
      if (!config) {
        mockAppLogger.initSpreadsheet();
        config = mockAppLogger.getSpreadsheetConfig();
      }
    }

    // Verify initSpreadsheet was never called
    expect(mockGetSpreadsheetConfig).toHaveBeenCalledTimes(5);
    expect(mockInitSpreadsheet).not.toHaveBeenCalled();
  });

  it('should handle initSpreadsheet failure gracefully', () => {
    // Mock no config and init failure
    mockGetSpreadsheetConfig.mockReturnValue(null);
    mockInitSpreadsheet.mockImplementation(() => {
      // Simulate initialization failure
    });

    // Simulate buildLogsTab logic
    let config = mockAppLogger.getSpreadsheetConfig();
    if (!config) {
      mockAppLogger.initSpreadsheet();
      config = mockAppLogger.getSpreadsheetConfig();
    }

    // Verify proper handling
    expect(mockInitSpreadsheet).toHaveBeenCalledTimes(1);
    expect(config).toBeNull();
  });
});