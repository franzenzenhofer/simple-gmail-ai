/**
 * Utility for mocking Google Apps Script services in Jest tests
 * Provides a consistent and reusable way to mock GAS globals
 */

export interface MockedServices {
  PropertiesService: {
    getUserProperties: jest.MockedFunction<() => GoogleAppsScript.Properties.Properties>;
  };
  CardService: {
    newCardBuilder: jest.MockedFunction<() => GoogleAppsScript.Card_Service.CardBuilder>;
    newAction: jest.MockedFunction<() => GoogleAppsScript.Card_Service.Action>;
    newActionResponseBuilder: jest.MockedFunction<() => GoogleAppsScript.Card_Service.ActionResponseBuilder>;
    newNavigation: jest.MockedFunction<() => GoogleAppsScript.Card_Service.Navigation>;
    newNotification: jest.MockedFunction<() => GoogleAppsScript.Card_Service.Notification>;
    LoadIndicator: {
      SPINNER: string;
      NONE: string;
    };
  };
  GmailApp: {
    search: jest.MockedFunction<(query: string) => GoogleAppsScript.Gmail.GmailThread[]>;
    getInboxThreads: jest.MockedFunction<(start?: number, max?: number) => GoogleAppsScript.Gmail.GmailThread[]>;
    getUserLabelByName: jest.MockedFunction<(name: string) => GoogleAppsScript.Gmail.GmailLabel | null>;
    createLabel: jest.MockedFunction<(name: string) => GoogleAppsScript.Gmail.GmailLabel>;
  };
  UrlFetchApp: {
    fetch: jest.MockedFunction<(url: string, params?: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions) => GoogleAppsScript.URL_Fetch.HTTPResponse>;
  };
  SpreadsheetApp: {
    create: jest.MockedFunction<(name: string) => GoogleAppsScript.Spreadsheet.Spreadsheet>;
    openById: jest.MockedFunction<(id: string) => GoogleAppsScript.Spreadsheet.Spreadsheet>;
  };
  DriveApp: {
    createFile: jest.MockedFunction<(blob: GoogleAppsScript.Base.Blob) => GoogleAppsScript.Drive.File>;
    getFileById: jest.MockedFunction<(id: string) => GoogleAppsScript.Drive.File>;
  };
  Session: {
    getScriptTimeZone: jest.MockedFunction<() => string>;
    getActiveUser: jest.MockedFunction<() => GoogleAppsScript.Base.User>;
  };
  Utilities: {
    getUuid: jest.MockedFunction<() => string>;
    sleep: jest.MockedFunction<(milliseconds: number) => void>;
  };
  console: {
    log: jest.MockedFunction<(...args: any[]) => void>;
    error: jest.MockedFunction<(...args: any[]) => void>;
    warn: jest.MockedFunction<(...args: any[]) => void>;
  };
  Logger: {
    log: jest.MockedFunction<(data: any) => GoogleAppsScript.Base.Logger>;
  };
}

/**
 * Creates comprehensive mocks for all Google Apps Script services
 * @param customMocks Optional custom mock implementations to override defaults
 * @returns Object containing all mocked services
 */
export function withMockedServices(customMocks: Partial<MockedServices> = {}): MockedServices {
  // Mock Properties
  const mockProperties = {
    getProperty: jest.fn().mockReturnValue(null),
    setProperty: jest.fn(),
    setProperties: jest.fn(),
    deleteProperty: jest.fn(),
    deleteAllProperties: jest.fn(),
    getProperties: jest.fn().mockReturnValue({}),
    getKeys: jest.fn().mockReturnValue([])
  } as unknown as GoogleAppsScript.Properties.Properties;

  // Mock Card Builder Chain
  const mockCardBuilder = {
    setHeader: jest.fn().mockReturnThis(),
    addSection: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({} as GoogleAppsScript.Card_Service.Card)
  } as unknown as GoogleAppsScript.Card_Service.CardBuilder;

  const mockAction = {
    setFunctionName: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    setLoadIndicator: jest.fn().mockReturnThis()
  } as unknown as GoogleAppsScript.Card_Service.Action;

  const mockActionResponseBuilder = {
    setNotification: jest.fn().mockReturnThis(),
    setNavigation: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({} as GoogleAppsScript.Card_Service.ActionResponse)
  } as unknown as GoogleAppsScript.Card_Service.ActionResponseBuilder;

  const mockNavigation = {
    updateCard: jest.fn().mockReturnThis(),
    pushCard: jest.fn().mockReturnThis()
  } as unknown as GoogleAppsScript.Card_Service.Navigation;

  const mockNotification = {
    setText: jest.fn().mockReturnThis()
  } as unknown as GoogleAppsScript.Card_Service.Notification;

  // Mock Gmail Objects
  const mockGmailThread = {
    getId: jest.fn().mockReturnValue('thread_123'),
    getFirstMessageSubject: jest.fn().mockReturnValue('Test Subject'),
    getMessages: jest.fn().mockReturnValue([]),
    getLabels: jest.fn().mockReturnValue([]),
    addLabel: jest.fn(),
    removeLabel: jest.fn()
  } as unknown as GoogleAppsScript.Gmail.GmailThread;

  const mockGmailLabel = {
    getName: jest.fn().mockReturnValue('Test Label'),
    getId: jest.fn().mockReturnValue('label_123')
  } as unknown as GoogleAppsScript.Gmail.GmailLabel;

  // Mock HTTP Response
  const mockHttpResponse = {
    getResponseCode: jest.fn().mockReturnValue(200),
    getContentText: jest.fn().mockReturnValue('{"success": true}'),
    getHeaders: jest.fn().mockReturnValue({}),
    getBlob: jest.fn()
  } as unknown as GoogleAppsScript.URL_Fetch.HTTPResponse;

  // Default mocks
  const defaultMocks: MockedServices = {
    PropertiesService: {
      getUserProperties: jest.fn().mockReturnValue(mockProperties)
    },
    CardService: {
      newCardBuilder: jest.fn().mockReturnValue(mockCardBuilder),
      newAction: jest.fn().mockReturnValue(mockAction),
      newActionResponseBuilder: jest.fn().mockReturnValue(mockActionResponseBuilder),
      newNavigation: jest.fn().mockReturnValue(mockNavigation),
      newNotification: jest.fn().mockReturnValue(mockNotification),
      LoadIndicator: {
        SPINNER: 'SPINNER',
        NONE: 'NONE'
      }
    },
    GmailApp: {
      search: jest.fn().mockReturnValue([mockGmailThread]),
      getInboxThreads: jest.fn().mockReturnValue([mockGmailThread]),
      getUserLabelByName: jest.fn().mockReturnValue(mockGmailLabel),
      createLabel: jest.fn().mockReturnValue(mockGmailLabel)
    },
    UrlFetchApp: {
      fetch: jest.fn().mockReturnValue(mockHttpResponse)
    },
    SpreadsheetApp: {
      create: jest.fn().mockReturnValue({} as GoogleAppsScript.Spreadsheet.Spreadsheet),
      openById: jest.fn().mockReturnValue({} as GoogleAppsScript.Spreadsheet.Spreadsheet)
    },
    DriveApp: {
      createFile: jest.fn().mockReturnValue({} as GoogleAppsScript.Drive.File),
      getFileById: jest.fn().mockReturnValue({} as GoogleAppsScript.Drive.File)
    },
    Session: {
      getScriptTimeZone: jest.fn().mockReturnValue('America/New_York'),
      getActiveUser: jest.fn().mockReturnValue({} as GoogleAppsScript.Base.User)
    },
    Utilities: {
      getUuid: jest.fn().mockReturnValue('uuid-1234-5678'),
      sleep: jest.fn()
    },
    console: {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    },
    Logger: {
      log: jest.fn().mockReturnValue({} as GoogleAppsScript.Base.Logger)
    }
  };

  // Merge with custom mocks
  const mocks = { ...defaultMocks, ...customMocks };

  // Set global mocks
  (globalThis as any).PropertiesService = mocks.PropertiesService;
  (globalThis as any).CardService = mocks.CardService;
  (globalThis as any).GmailApp = mocks.GmailApp;
  (globalThis as any).UrlFetchApp = mocks.UrlFetchApp;
  (globalThis as any).SpreadsheetApp = mocks.SpreadsheetApp;
  (globalThis as any).DriveApp = mocks.DriveApp;
  (globalThis as any).Session = mocks.Session;
  (globalThis as any).Utilities = mocks.Utilities;
  (globalThis as any).console = mocks.console;
  (globalThis as any).Logger = mocks.Logger;

  return mocks;
}

/**
 * Clears all mocked services from global scope
 * Use in afterEach or afterAll to ensure clean test state
 */
export function clearMockedServices(): void {
  const services = [
    'PropertiesService',
    'CardService', 
    'GmailApp',
    'UrlFetchApp',
    'SpreadsheetApp',
    'DriveApp',
    'Session',
    'Utilities',
    'console',
    'Logger'
  ];

  services.forEach(service => {
    delete (globalThis as any)[service];
  });
}

/**
 * Creates a mock Gmail thread with configurable properties
 */
export function createMockGmailThread(options: {
  id?: string;
  subject?: string;
  labels?: string[];
  messageCount?: number;
} = {}): GoogleAppsScript.Gmail.GmailThread {
  const {
    id = 'thread_' + Math.random().toString(36).substr(2, 9),
    subject = 'Test Email Subject',
    labels = [],
    messageCount = 1
  } = options;

  const mockLabels = labels.map(labelName => ({
    getName: jest.fn().mockReturnValue(labelName),
    getId: jest.fn().mockReturnValue('label_' + labelName.toLowerCase())
  } as unknown as GoogleAppsScript.Gmail.GmailLabel));

  const mockMessages = Array(messageCount).fill(null).map((_, index) => ({
    getId: jest.fn().mockReturnValue(`message_${id}_${index}`),
    getSubject: jest.fn().mockReturnValue(subject),
    getBody: jest.fn().mockReturnValue('Test email body content'),
    getFrom: jest.fn().mockReturnValue('test@example.com'),
    getDate: jest.fn().mockReturnValue(new Date()),
    reply: jest.fn(),
    createDraftReply: jest.fn()
  } as unknown as GoogleAppsScript.Gmail.GmailMessage));

  return {
    getId: jest.fn().mockReturnValue(id),
    getFirstMessageSubject: jest.fn().mockReturnValue(subject),
    getMessages: jest.fn().mockReturnValue(mockMessages),
    getLabels: jest.fn().mockReturnValue(mockLabels),
    addLabel: jest.fn(),
    removeLabel: jest.fn(),
    getMessageCount: jest.fn().mockReturnValue(messageCount),
    getLastMessageDate: jest.fn().mockReturnValue(new Date()),
    hasStarredMessages: jest.fn().mockReturnValue(false),
    isImportant: jest.fn().mockReturnValue(false),
    isInChats: jest.fn().mockReturnValue(false),
    isInInbox: jest.fn().mockReturnValue(true),
    isInSpam: jest.fn().mockReturnValue(false),
    isInTrash: jest.fn().mockReturnValue(false),
    isUnread: jest.fn().mockReturnValue(true),
    markImportant: jest.fn(),
    markRead: jest.fn(),
    markUnimportant: jest.fn(),
    markUnread: jest.fn(),
    moveToArchive: jest.fn(),
    moveToInbox: jest.fn(),
    moveToSpam: jest.fn(),
    moveToTrash: jest.fn(),
    refresh: jest.fn(),
    reply: jest.fn(),
    replyAll: jest.fn()
  } as unknown as GoogleAppsScript.Gmail.GmailThread;
}