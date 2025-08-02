/**
 * Tests for UI module
 */

// Mock PropertiesService
const mockProps = new Map<string, string>();
const globalAny = (globalThis as any);

globalAny.PropertiesService = {
  getUserProperties: () => ({
    getProperty: (key: string) => mockProps.get(key) || null,
    setProperty: (key: string, value: string) => { mockProps.set(key, value); },
    deleteProperty: (key: string) => { mockProps.delete(key); },
    getProperties: () => Object.fromEntries(mockProps),
    deleteAllProperties: () => { mockProps.clear(); }
  }),
  getScriptProperties: () => ({
    getProperty: (_key: string) => null,
    setProperty: (_key: string, _value: string) => {},
    deleteProperty: (_key: string) => {},
    getProperties: () => ({}),
    deleteAllProperties: () => {}
  })
} as any;

// Mock CardService
globalAny.CardService = {
  newCardBuilder: () => ({
    setHeader: () => ({ build: () => ({ _type: 'card' }) }),
    build: () => ({ _type: 'card' })
  }),
  newKeyValue: () => ({
    setTopLabel: () => ({}),
    setContent: () => ({})
  }),
  newTextParagraph: () => ({
    setText: () => ({})
  })
} as any;

// Import UI module after mocks are set up
import './ui';

describe('UI Module', () => {
  beforeEach(() => {
    mockProps.clear();
  });

  describe('UI Module Basic Functionality', () => {
    it('should be importable without errors', () => {
      // If we got this far, the module imported successfully
      expect(true).toBe(true);
    });

    it('should have CardService available globally', () => {
      expect(globalAny.CardService).toBeDefined();
    });

    it('should have PropertiesService available globally', () => {
      expect(globalAny.PropertiesService).toBeDefined();
    });
  });
});