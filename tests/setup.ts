/**
 * Test setup for Gmail Support Triage AI
 * Following the principle: No mocks, fail fast, fail hard
 */

// Global Google Apps Script types and services setup
declare global {
  var CardService: GoogleAppsScript.Card_Service.CardService;
  var GmailApp: GoogleAppsScript.Gmail.GmailApp;
  var PropertiesService: GoogleAppsScript.Properties.PropertiesService;
  var UrlFetchApp: GoogleAppsScript.URL_Fetch.UrlFetchApp;
  var console: Console;
}

// Make TypeScript happy with global
const globalAny = (globalThis as any);

// Real implementations that will fail fast if not properly set up
export const setupGoogleAppsScriptEnvironment = () => {
  // These will throw errors if not properly initialized - that's good!
  if (typeof globalAny.CardService === 'undefined') {
    throw new Error('CardService not initialized - Google Apps Script environment required');
  }
  if (typeof globalAny.GmailApp === 'undefined') {
    throw new Error('GmailApp not initialized - Google Apps Script environment required');
  }
  if (typeof globalAny.PropertiesService === 'undefined') {
    throw new Error('PropertiesService not initialized - Google Apps Script environment required');
  }
  if (typeof globalAny.UrlFetchApp === 'undefined') {
    throw new Error('UrlFetchApp not initialized - Google Apps Script environment required');
  }
};

// For unit tests that don't require actual Google services
export const setupMinimalEnvironment = () => {
  // Console should always be available
  if (!globalAny.console) {
    globalAny.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    } as any;
  }
};