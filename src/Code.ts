/**
 * Gmail Support Triage & Auto-Reply Add-on
 * Main entry point - imports all modules and exposes global functions
 */

// Module imports (will be inlined by bundler)
/// <reference path="modules/config.ts" />
/// <reference path="modules/types.ts" />
/// <reference path="modules/logger.ts" />
/// <reference path="modules/utils.ts" />
/// <reference path="modules/json-validator.ts" />
/// <reference path="modules/ai-schemas.ts" />
/// <reference path="modules/batch-processor.ts" />
/// <reference path="modules/continuation-triggers.ts" />
/// <reference path="modules/continuation-handlers.ts" />
/// <reference path="modules/function-calling.ts" />
/// <reference path="modules/dark-mode.ts" />
/// <reference path="modules/test-mode.ts" />
/// <reference path="modules/contextual-actions.ts" />
/// <reference path="modules/welcome-flow.ts" />
/// <reference path="modules/ui-improvements.ts" />
/// <reference path="modules/ai.ts" />
/// <reference path="modules/structured-ai.ts" />
/// <reference path="modules/gmail.ts" />
/// <reference path="modules/ui.ts" />
/// <reference path="modules/error-handling.ts" />
/// <reference path="modules/entry-points.ts" />
/// <reference path="modules/navigation-handlers.ts" />
/// <reference path="modules/action-handlers.ts" />
/// <reference path="modules/processing-handlers.ts" />
/// <reference path="modules/universal-actions.ts" />
/// <reference path="modules/docs-prompt-editor.ts" />
/// <reference path="modules/docs-prompt-handlers.ts" />

// ===== GLOBAL FUNCTION EXPORTS =====
// These functions must be globally accessible for Google Apps Script
// Organized by functional category for better maintainability

// =============================================================================
// 🚀 ADD-ON TRIGGERS & ENTRY POINTS
// Core functions called by Google Apps Script runtime
// =============================================================================

function onAddOnOpen(e: any): void {
  return EntryPoints.onAddOnOpen(e);
}

function onHomepage(): GoogleAppsScript.Card_Service.Card {
  return EntryPoints.onHomepage();
}

function onGmailMessage(e: any): GoogleAppsScript.Card_Service.Card {
  return EntryPoints.onGmailMessage(e);
}

// =============================================================================
// 🧭 NAVIGATION HANDLERS  
// Tab switching and page navigation within the add-on UI
// =============================================================================

function showApiKeyTab(): GoogleAppsScript.Card_Service.ActionResponse {
  return NavigationHandlers.showApiKeyTab();
}

function showLogsTab(): GoogleAppsScript.Card_Service.ActionResponse {
  return NavigationHandlers.showLogsTab();
}

function showSettingsTab(): GoogleAppsScript.Card_Service.ActionResponse {
  return NavigationHandlers.showSettingsTab();
}

function backToMain(): GoogleAppsScript.Card_Service.ActionResponse {
  return NavigationHandlers.backToMain();
}

function refreshLiveLog(): GoogleAppsScript.Card_Service.ActionResponse {
  return NavigationHandlers.refreshLiveLog();
}

// =============================================================================
// ⚡ ACTION HANDLERS
// Core user actions: settings, configuration, email processing
// =============================================================================

function saveApiKey(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return ActionHandlers.saveApiKey(e);
}

function validateApiKeyFormat(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return ActionHandlers.validateApiKeyFormat(e);
}

function runAnalysis(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return ActionHandlers.runAnalysis(e);
}

function cancelProcessing(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return ActionHandlers.cancelProcessing(e);
}

function toggleDebugMode(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return ActionHandlers.toggleDebugMode(e);
}

function toggleSpreadsheetLogging(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return ActionHandlers.toggleSpreadsheetLogging(e);
}

// =============================================================================
// 🔄 PROCESSING HANDLERS
// Long-running email processing and continuation logic
// =============================================================================

function continueProcessing(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return ProcessingHandlers.continueProcessing(e);
}

// =============================================================================
// 🌐 UNIVERSAL ACTIONS
// Three-dot menu actions available from any screen
// =============================================================================

function viewLogsUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return UniversalActions.viewLogsUniversal();
}

function showApiKeyTabUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return UniversalActions.showApiKeyTabUniversal();
}

function showLogsTabUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return UniversalActions.showLogsTabUniversal();
}

function showSettingsTabUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return UniversalActions.showSettingsTabUniversal();
}

function showLiveLogTabUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return UniversalActions.showLiveLogTabUniversal();
}

function showHomepageUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return UniversalActions.showHomepageUniversal();
}

function showPromptEditorUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return UniversalActions.showPromptEditorUniversal();
}

function showTestModeUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return UniversalActions.showTestModeUniversal();
}

function showWelcomeFlowUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return UniversalActions.showWelcomeFlowUniversal();
}

// =============================================================================
// ⏳ CONTINUATION HANDLERS
// Background processing for large inbox operations
// =============================================================================

function continueLargeInboxProcessing(): void {
  return ContinuationHandlers.continueLargeInboxProcessing();
}

// =============================================================================
// 🧪 TEST MODE HANDLERS
// Safe testing with limited email processing
// =============================================================================

function toggleTestMode(): GoogleAppsScript.Card_Service.ActionResponse {
  const isActive = TestMode.isTestModeActive();
  
  if (isActive) {
    TestMode.disableTestMode();
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('🧪 Test mode disabled'))
      .setNavigation(CardService.newNavigation()
        .updateCard(UI.buildHomepage()))
      .build();
  } else {
    TestMode.enableTestMode();
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('🧪 Test mode enabled - safe processing active'))
      .setNavigation(CardService.newNavigation()
        .updateCard(TestMode.createTestModeCard()))
      .build();
  }
}

function runTestAnalysis(): GoogleAppsScript.Card_Service.ActionResponse {
  const apiKey = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.API_KEY);
  if (!apiKey) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('❌ API key not configured'))
      .build();
  }
  
  const result = TestMode.runTestAnalysis(
    apiKey,
    PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.PROMPT_1) || Config.PROMPTS.CLASSIFICATION,
    PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.PROMPT_2) || Config.PROMPTS.RESPONSE
  );
  
  // T-10: Show results inline on card
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation()
      .pushCard(TestMode.createTestResultCard(result)))
    .build();
}

// T-10: Quick test mode toggle from main UI
function toggleTestModeQuick(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  const isEnabled = e.formInput.testMode === 'true';
  
  if (isEnabled) {
    TestMode.enableTestMode();
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('🧪 Test mode enabled - will process only 1 email'))
      .setNavigation(CardService.newNavigation()
        .updateCard(UI.buildHomepage()))
      .build();
  } else {
    TestMode.disableTestMode();
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('✅ Test mode disabled - normal processing'))
      .setNavigation(CardService.newNavigation()
        .updateCard(UI.buildHomepage()))
      .build();
  }
}

// Navigate to test mode card
function showTestModeCard(): GoogleAppsScript.Card_Service.ActionResponse {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation()
      .pushCard(TestMode.createTestModeCard()))
    .build();
}

// =============================================================================
// 🎨 THEME & UI HANDLERS
// Dark mode and visual preferences
// =============================================================================

function toggleDarkMode(): GoogleAppsScript.Card_Service.ActionResponse {
  const newMode = DarkMode.toggleDarkMode();
  
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification()
      .setText(newMode ? '🌙 Dark mode enabled' : '☀️ Light mode enabled'))
    .setNavigation(CardService.newNavigation()
      .updateCard(UIImprovements.createCondensedMainCard()))
    .build();
}

// =============================================================================
// 👋 WELCOME FLOW HANDLERS
// First-time user onboarding experience
// =============================================================================

function startWelcomeFlow(): GoogleAppsScript.Card_Service.ActionResponse {
  return WelcomeFlow.startWelcomeFlow();
}

function saveApiKeyFromWelcome(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return WelcomeFlow.saveApiKeyFromWelcome(e);
}

function runWelcomeTestAnalysis(): GoogleAppsScript.Card_Service.ActionResponse {
  return WelcomeFlow.runWelcomeTestAnalysis();
}

function toggleDarkModeFromWelcome(): GoogleAppsScript.Card_Service.ActionResponse {
  DarkMode.toggleDarkMode();
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification()
      .setText('🌓 Theme preference saved'))
    .build();
}

function finishWelcomeFlow(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return WelcomeFlow.finishWelcomeFlow(e);
}

// =============================================================================
// 📨 CONTEXTUAL ACTIONS
// Email-specific actions and smart suggestions
// =============================================================================

function executeContextualAction(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  const actionId = e.parameters.actionId;
  const messageId = e.parameters.messageId;
  const threadId = e.parameters.threadId;
  
  // Get the action and execute it
  const message = GmailApp.getMessageById(messageId);
  const thread = GmailApp.getThreadById(threadId);
  
  const context: ContextualActions.MessageContext = {
    messageId: messageId,
    threadId: threadId,
    subject: message.getSubject(),
    from: message.getFrom(),
    to: message.getTo(),
    body: message.getPlainBody(),
    labels: thread.getLabels().map(l => l.getName()),
    attachments: message.getAttachments().length,
    isUnread: message.isUnread(),
    isDraft: message.isDraft()
  };
  
  // Find and execute the action
  const actions = ContextualActions.getAvailableActions(context);
  const action = actions.find(a => a.id === actionId);
  
  if (action) {
    return action.handler(context);
  }
  
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification()
      .setText('❌ Action not found'))
    .build();
}

// =============================================================================
// 🎛️ UI IMPROVEMENTS HANDLERS
// Enhanced interface features and controls
// =============================================================================

function toggleSectionState(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return UIImprovements.toggleSectionState(e);
}

function updateLogFilter(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return UIImprovements.updateLogFilter(e);
}

function refreshLiveLogOverlay(): GoogleAppsScript.Card_Service.ActionResponse {
  return UIImprovements.refreshLiveLogOverlay();
}

function closeLiveLogOverlay(): GoogleAppsScript.Card_Service.ActionResponse {
  return UIImprovements.closeLiveLogOverlay();
}

function clearLogs(): GoogleAppsScript.Card_Service.ActionResponse {
  return UIImprovements.clearLogs();
}

function resetStatistics(): GoogleAppsScript.Card_Service.ActionResponse {
  return UIImprovements.resetStatistics();
}

// =============================================================================
// 📝 DOCS PROMPT EDITOR HANDLERS
// Advanced prompt management via Google Docs
// =============================================================================

function showPromptEditor(): GoogleAppsScript.Card_Service.ActionResponse {
  return DocsPromptHandlers.showPromptEditor();
}

function createPromptEditorCard(): GoogleAppsScript.Card_Service.Card {
  return DocsPromptHandlers.createPromptEditorCard();
}

function createPromptDocument(): GoogleAppsScript.Card_Service.ActionResponse {
  return DocsPromptHandlers.createPromptDocument();
}

function compilePrompts(): GoogleAppsScript.Card_Service.ActionResponse {
  return DocsPromptHandlers.compilePrompts();
}