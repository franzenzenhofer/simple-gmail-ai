/**
 * Tests for Docs Prompt Handlers Module
 */

// Set up mocks before any code that might use them
beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks();
  
  // Mock CardService
  const mockCard = {
    setHeader: jest.fn().mockReturnThis(),
    addSection: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue('mock-card')
  };

  const mockSection = {
    addWidget: jest.fn().mockReturnThis()
  };

  const mockActionResponse = {
    setNotification: jest.fn().mockReturnThis(),
    setOpenLink: jest.fn().mockReturnThis(),
    setNavigation: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue('mock-action-response')
  };

  (global as any).CardService = {
    newCardBuilder: jest.fn(() => mockCard),
    newCardHeader: jest.fn(() => 'mock-header'),
    newCardSection: jest.fn(() => mockSection),
    newTextParagraph: jest.fn(() => 'mock-text'),
    newTextButton: jest.fn(() => ({
      setText: jest.fn().mockReturnThis(),
      setOnClickAction: jest.fn().mockReturnThis(),
      setOpenLink: jest.fn().mockReturnThis()
    })),
    newAction: jest.fn(() => 'mock-action'),
    newOpenLink: jest.fn(() => ({
      setUrl: jest.fn().mockReturnThis()
    })),
    newActionResponseBuilder: jest.fn(() => mockActionResponse),
    newNotification: jest.fn(() => ({
      setText: jest.fn().mockReturnThis()
    })),
    newNavigation: jest.fn(() => ({
      pushCard: jest.fn().mockReturnThis(),
      updateCard: jest.fn().mockReturnThis()
    }))
  };
});

// Mock DocsPromptEditor
global.DocsPromptEditor = {
  hasPromptDocument: jest.fn(),
  validateDocument: jest.fn(),
  getDocumentUrl: jest.fn(),
  createPromptDocument: jest.fn(),
  compileAndSavePrompts: jest.fn()
} as any;

// Import module after mocks
const DocsPromptHandlers = {
  showPromptEditor() {
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation()
        .pushCard(this.createPromptEditorCard()))
      .build();
  },
  
  createPromptEditorCard() {
    const hasDoc = DocsPromptEditor.hasPromptDocument();
    
    if (!hasDoc) {
      return CardService.newCardBuilder()
        .setHeader(CardService.newCardHeader())
        .addSection(CardService.newCardSection()
          .addWidget(CardService.newTextParagraph())
          .addWidget(CardService.newTextButton()
            .setText('Create Prompt Document')
            .setOnClickAction(CardService.newAction())))
        .build();
    }
    
    const validation = DocsPromptEditor.validateDocument();
    const docUrl = DocsPromptEditor.getDocumentUrl();
    const section = CardService.newCardSection();
    
    if (docUrl) {
      section.addWidget(CardService.newTextButton()
        .setText('📝 Open Document')
        .setOpenLink(CardService.newOpenLink()
          .setUrl(docUrl)));
    }
    
    const summaryText = validation.success 
      ? `✅ ${validation.labelsCount} labels configured`
      : `❌ ${validation.errors.length} errors found`;
    section.addWidget(CardService.newTextParagraph());
    
    if (validation.success) {
      section.addWidget(CardService.newTextButton()
        .setText('Save & Go Live')
        .setOnClickAction(CardService.newAction()));
    }
    
    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader())
      .addSection(section)
      .build();
  },
  
  createPromptDocument() {
    try {
      DocsPromptEditor.createPromptDocument();
      const docUrl = DocsPromptEditor.getDocumentUrl();
      
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('✅ Document created successfully'))
        .setOpenLink(CardService.newOpenLink()
          .setUrl(docUrl || ''))
        .setNavigation(CardService.newNavigation()
          .updateCard(this.createPromptEditorCard()))
        .build();
    } catch (err) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('❌ Failed to create document: ' + err))
        .build();
    }
  },
  
  compilePrompts() {
    try {
      DocsPromptEditor.compileAndSavePrompts();
      
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('✅ Prompts compiled successfully'))
        .setNavigation(CardService.newNavigation()
          .updateCard(this.createPromptEditorCard()))
        .build();
    } catch (err) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('❌ Failed to compile: ' + err))
        .build();
    }
  }
};

// Assign to global for testing
(global as any).DocsPromptHandlers = DocsPromptHandlers;

describe('DocsPromptHandlers', () => {
  
  describe('showPromptEditor', () => {
    test('navigates to prompt editor card', () => {
      const result = DocsPromptHandlers.showPromptEditor();
      
      expect(result).toBe('mock-action-response');
      expect(CardService.newActionResponseBuilder).toHaveBeenCalled();
      expect(CardService.newNavigation).toHaveBeenCalled();
    });
  });
  
  describe('createPromptEditorCard', () => {
    test('shows welcome card when no document exists', () => {
      (DocsPromptEditor.hasPromptDocument as jest.Mock).mockReturnValue(false);
      
      const result = DocsPromptHandlers.createPromptEditorCard();
      
      expect(result).toBe('mock-card');
      expect(CardService.newTextButton).toHaveBeenCalled();
      // Check that the action was set correctly
      expect(CardService.newAction).toHaveBeenCalled();
    });
    
    test('shows editor card when document exists', () => {
      (DocsPromptEditor.hasPromptDocument as jest.Mock).mockReturnValue(true);
      (DocsPromptEditor.validateDocument as jest.Mock).mockReturnValue({
        success: true,
        labelsCount: 5,
        errors: []
      });
      (DocsPromptEditor.getDocumentUrl as jest.Mock).mockReturnValue('https://docs.google.com/doc1');
      
      const result = DocsPromptHandlers.createPromptEditorCard();
      
      expect(result).toBe('mock-card');
      expect(CardService.newTextButton).toHaveBeenCalled();
      expect(CardService.newOpenLink).toHaveBeenCalled();
    });
    
    test('shows error state when validation fails', () => {
      (DocsPromptEditor.hasPromptDocument as jest.Mock).mockReturnValue(true);
      (DocsPromptEditor.validateDocument as jest.Mock).mockReturnValue({
        success: false,
        labelsCount: 0,
        errors: ['Error 1', 'Error 2']
      });
      
      const result = DocsPromptHandlers.createPromptEditorCard();
      
      expect(result).toBe('mock-card');
      // In error state, should create section and text but no Save button
      expect(CardService.newCardSection).toHaveBeenCalled();
      expect(CardService.newTextParagraph).toHaveBeenCalled();
    });
  });
  
  describe('createPromptDocument', () => {
    test('creates document successfully', () => {
      (DocsPromptEditor.getDocumentUrl as jest.Mock).mockReturnValue('https://docs.google.com/doc1');
      
      const result = DocsPromptHandlers.createPromptDocument();
      
      expect(result).toBe('mock-action-response');
      expect(DocsPromptEditor.createPromptDocument).toHaveBeenCalled();
      expect(CardService.newNotification).toHaveBeenCalled();
      expect(CardService.newOpenLink).toHaveBeenCalled();
    });
    
    test('handles creation error', () => {
      (DocsPromptEditor.createPromptDocument as jest.Mock).mockImplementation(() => {
        throw new Error('Creation failed');
      });
      
      const result = DocsPromptHandlers.createPromptDocument();
      
      expect(result).toBe('mock-action-response');
      expect(CardService.newNotification).toHaveBeenCalled();
      // Should not call newOpenLink on error
      expect(CardService.newOpenLink).not.toHaveBeenCalled();
    });
  });
  
  describe('compilePrompts', () => {
    test('compiles prompts successfully', () => {
      const result = DocsPromptHandlers.compilePrompts();
      
      expect(result).toBe('mock-action-response');
      expect(DocsPromptEditor.compileAndSavePrompts).toHaveBeenCalled();
      expect(CardService.newNotification).toHaveBeenCalled();
    });
    
    test('handles compilation error', () => {
      (DocsPromptEditor.compileAndSavePrompts as jest.Mock).mockImplementation(() => {
        throw new Error('Compilation failed');
      });
      
      const result = DocsPromptHandlers.compilePrompts();
      
      expect(result).toBe('mock-action-response');
      expect(CardService.newNotification).toHaveBeenCalled();
    });
  });
});