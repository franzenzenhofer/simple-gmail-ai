/**
 * Docs Prompt Editor Handlers Module
 * UI handlers for Google Docs-based prompt editor
 */

namespace DocsPromptHandlers {
  
  /**
   * Show prompt editor navigation
   */
  export function showPromptEditor(): GoogleAppsScript.Card_Service.ActionResponse {
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation()
        .pushCard(createPromptEditorCard()))
      .build();
  }
  
  /**
   * Create prompt editor card
   */
  export function createPromptEditorCard(): GoogleAppsScript.Card_Service.Card {
    const hasDoc = DocsPromptEditor.hasPromptDocument();
    
    if (!hasDoc) {
      // Show welcome card with create button
      return CardService.newCardBuilder()
        .setHeader(CardService.newCardHeader()
          .setTitle('📝 Docs Prompt Editor • Configuration')
          .setSubtitle('🎯 Google Docs-based prompt management • Single source of truth'))
        .addSection(CardService.newCardSection()
          .addWidget(CardService.newTextParagraph()
            .setText('Welcome! Click below to create your prompt configuration document.'))
          .addWidget(CardService.newTextButton()
            .setText('Create Prompt Document')
            .setOnClickAction(CardService.newAction()
              .setFunctionName('createPromptDocument'))))
        .build();
    }
    
    // Show editor card with validation
    const validation = DocsPromptEditor.validateDocument();
    const docUrl = DocsPromptEditor.getDocumentUrl();
    
    const section = CardService.newCardSection();
    
    // Add document link
    if (docUrl) {
      section.addWidget(CardService.newTextButton()
        .setText('📝 Open Document')
        .setOpenLink(CardService.newOpenLink()
          .setUrl(docUrl)));
    }
    
    // Add validation summary with last update time
    const lastModified = DocsPromptEditor.getDocumentLastModified();
    const summaryText = validation.success 
      ? `✅ ${validation.labelsCount} labels configured`
      : `❌ ${validation.errors.length} errors found`;
    
    section.addWidget(CardService.newTextParagraph()
      .setText(summaryText));
    
    if (lastModified) {
      section.addWidget(CardService.newTextParagraph()
        .setText(`<i>Last edited: ${lastModified}</i>`));
    }
    
    // Add refresh button to revalidate document
    section.addWidget(CardService.newTextButton()
      .setText('🔄 Refresh from Docs')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('refreshPromptDocument')));
    
    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('📝 Docs Prompt Editor • Configuration')
        .setSubtitle('Manage your AI prompts'))
      .addSection(section)
      .build();
  }
  
  /**
   * Create prompt document action handler
   */
  export function createPromptDocument(): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      DocsPromptEditor.createPromptDocument();
      const docUrl = DocsPromptEditor.getDocumentUrl();
      
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('✅ Document created successfully'))
        .setOpenLink(CardService.newOpenLink()
          .setUrl(docUrl || ''))
        .setNavigation(CardService.newNavigation()
          .updateCard(createPromptEditorCard()))
        .build();
    } catch (err) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('❌ Failed to create document: ' + err))
        .build();
    }
  }
  
  /**
   * Compile prompts action handler
   */
  export function compilePrompts(): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      DocsPromptEditor.compileAndSavePrompts();
      
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('✅ Prompts compiled successfully'))
        .setNavigation(CardService.newNavigation()
          .updateCard(createPromptEditorCard()))
        .build();
    } catch (err) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('❌ Failed to compile: ' + err))
        .build();
    }
  }
  
  /**
   * Refresh prompt document
   */
  export function refreshPromptDocument(): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      // Force revalidation of the document
      const validation = DocsPromptEditor.validateDocument();
      
      const message = validation.success 
        ? `✅ Document refreshed - ${validation.labelsCount} labels found`
        : `❌ Document has errors - ${validation.errors.length} issues found`;
      
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText(message))
        .setNavigation(CardService.newNavigation()
          .updateCard(createPromptEditorCard()))
        .build();
    } catch (err) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('❌ Failed to refresh: ' + err))
        .build();
    }
  }
}