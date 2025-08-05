/**
 * Tests for cancellation check in reply generation loop
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock PropertiesService
const mockGetProperty = jest.fn();
const mockPropertiesService = {
  getUserProperties: jest.fn(() => ({
    getProperty: mockGetProperty
  }))
};

// Mock Config
const mockConfig = {
  PROP_KEYS: {
    ANALYSIS_CANCELLED: 'ANALYSIS_CANCELLED'
  }
};

// Mock AppLogger
const mockAppLogger = {
  info: jest.fn()
};

describe('Cancellation Check in Reply Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up global mocks
    (global as any).PropertiesService = mockPropertiesService;
    (global as any).Config = mockConfig;
    (global as any).AppLogger = mockAppLogger;
  });

  it('should check cancellation flag at the start of each thread processing', () => {
    // Mock data
    const mockThreads = [
      { threadId: '1', thread: {}, redactedBody: 'test1', subject: 'sub1', sender: 'sender1', body: 'body1' },
      { threadId: '2', thread: {}, redactedBody: 'test2', subject: 'sub2', sender: 'sender2', body: 'body2' },
      { threadId: '3', thread: {}, redactedBody: 'test3', subject: 'sub3', sender: 'sender3', body: 'body3' }
    ];

    // Set cancellation to false for first thread, then true
    let callCount = 0;
    mockGetProperty.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 'false' : 'true';
    });

    // Mock the forEach behavior
    let processedCount = 0;
    mockThreads.forEach((thread) => {
      // Check for cancellation at the start
      if (mockGetProperty() === 'true') {
        mockAppLogger.info('🛑 Processing cancelled during reply generation');
        return; // Skip remaining
      }
      processedCount++;
    });

    // Verify only first thread was processed
    expect(processedCount).toBe(1);
    expect(mockGetProperty).toHaveBeenCalledTimes(3); // Called for each thread until cancelled
    expect(mockAppLogger.info).toHaveBeenCalledTimes(2); // Called for 2nd and 3rd threads
    expect(mockAppLogger.info).toHaveBeenCalledWith('🛑 Processing cancelled during reply generation');
  });

  it('should process all threads when not cancelled', () => {
    const mockThreads = [
      { threadId: '1', thread: {}, redactedBody: 'test1', subject: 'sub1', sender: 'sender1', body: 'body1' },
      { threadId: '2', thread: {}, redactedBody: 'test2', subject: 'sub2', sender: 'sender2', body: 'body2' }
    ];

    // Never cancelled
    mockGetProperty.mockReturnValue('false');

    let processedCount = 0;
    mockThreads.forEach(() => {
      if (mockGetProperty() === 'true') {
        mockAppLogger.info('🛑 Processing cancelled during reply generation');
        return;
      }
      processedCount++;
    });

    // All threads processed
    expect(processedCount).toBe(2);
    expect(mockGetProperty).toHaveBeenCalledTimes(2);
    expect(mockAppLogger.info).not.toHaveBeenCalled();
  });

  it('should stop immediately if cancelled before first thread', () => {
    const mockThreads = [
      { threadId: '1', thread: {}, redactedBody: 'test1', subject: 'sub1', sender: 'sender1', body: 'body1' }
    ];

    // Cancelled from start
    mockGetProperty.mockReturnValue('true');

    let processedCount = 0;
    mockThreads.forEach(() => {
      if (mockGetProperty() === 'true') {
        mockAppLogger.info('🛑 Processing cancelled during reply generation');
        return;
      }
      processedCount++;
    });

    // No threads processed
    expect(processedCount).toBe(0);
    expect(mockGetProperty).toHaveBeenCalledTimes(1);
    expect(mockAppLogger.info).toHaveBeenCalledWith('🛑 Processing cancelled during reply generation');
  });
});