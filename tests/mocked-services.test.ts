/**
 * Tests for the mocked services utility
 * Demonstrates how to use withMockedServices for consistent testing
 */

import { withMockedServices, clearMockedServices, createMockGmailThread } from './mocked-services';

describe('Mocked Services Utility', () => {
  afterEach(() => {
    clearMockedServices();
  });

  test('should provide comprehensive Google Apps Script mocks', () => {
    const mocks = withMockedServices();
    
    // Test that all major services are mocked
    expect(PropertiesService).toBeDefined();
    expect(CardService).toBeDefined();
    expect(GmailApp).toBeDefined();
    expect(UrlFetchApp).toBeDefined();
    expect(SpreadsheetApp).toBeDefined();
    expect(DriveApp).toBeDefined();
    expect(Session).toBeDefined();
    expect(Utilities).toBeDefined();
    expect(Logger).toBeDefined();
    
    // Test that mocks return expected types
    expect(mocks.PropertiesService.getUserProperties).toEqual(expect.any(Function));
    expect(mocks.CardService.newCardBuilder).toEqual(expect.any(Function));
    expect(mocks.GmailApp.search).toEqual(expect.any(Function));
  });

  test('should allow custom mock overrides', () => {
    const customApiKey = 'custom-test-key-123';
    withMockedServices({
      PropertiesService: {
        getUserProperties: jest.fn().mockReturnValue({
          getProperty: jest.fn().mockReturnValue(customApiKey),
          setProperty: jest.fn(),
          setProperties: jest.fn(),
          deleteProperty: jest.fn(),
          deleteAllProperties: jest.fn(),
          getProperties: jest.fn().mockReturnValue({}),
          getKeys: jest.fn().mockReturnValue([])
        })
      }
    });

    const userProps = PropertiesService.getUserProperties();
    expect(userProps.getProperty('GEMINI_API_KEY')).toBe(customApiKey);
  });

  test('should provide working CardService mock chain', () => {
    withMockedServices();
    
    const card = CardService.newCardBuilder()
      .setHeader({} as any)
      .addSection({} as any)
      .build();
    
    expect(card).toBeDefined();
    expect(CardService.newCardBuilder().setHeader).toHaveBeenCalled();
  });

  test('should provide working GmailApp mocks', () => {
    withMockedServices();
    
    const threads = GmailApp.search('label:inbox');
    expect(threads).toHaveLength(1);
    expect(threads[0]?.getId()).toBe('thread_123');
    expect(threads[0]?.getFirstMessageSubject()).toBe('Test Subject');
  });

  test('should create custom Gmail threads with createMockGmailThread', () => {
    const customThread = createMockGmailThread({
      id: 'custom_thread_456',
      subject: 'Support Request',
      labels: ['Support Request', 'Urgent'],
      messageCount: 3
    });

    expect(customThread.getId()).toBe('custom_thread_456');
    expect(customThread.getFirstMessageSubject()).toBe('Support Request');
    expect(customThread.getLabels()).toHaveLength(2);
    expect(customThread.getMessages()).toHaveLength(3);
  });

  test('should provide working UrlFetchApp mock', () => {
    withMockedServices();
    
    const response = UrlFetchApp.fetch('https://api.example.com/test');
    expect(response.getResponseCode()).toBe(200);
    expect(response.getContentText()).toBe('{"success": true}');
  });

  test('should provide Session and Utilities mocks', () => {
    withMockedServices();
    
    expect(Session.getScriptTimeZone()).toBe('America/New_York');
    expect(Utilities.getUuid()).toBe('uuid-1234-5678');
  });

  test('should clear all mocks when clearMockedServices is called', () => {
    withMockedServices();
    expect(PropertiesService).toBeDefined();
    
    clearMockedServices();
    expect((globalThis as any).PropertiesService).toBeUndefined();
    expect((globalThis as any).CardService).toBeUndefined();
    expect((globalThis as any).GmailApp).toBeUndefined();
  });
});