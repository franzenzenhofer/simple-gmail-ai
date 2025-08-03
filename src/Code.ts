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

// ===== GLOBAL FUNCTION EXPORTS =====
// These functions must be globally accessible for Google Apps Script

// Entry Points
function onAddOnOpen(e: any): void {
  return EntryPoints.onAddOnOpen(e);
}

function onHomepage(): GoogleAppsScript.Card_Service.Card {
  return EntryPoints.onHomepage();
}

function onGmailMessage(e: any): GoogleAppsScript.Card_Service.Card {
  return EntryPoints.onGmailMessage(e);
}

// Navigation Handlers
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

// Action Handlers
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

// Processing Handlers
function continueProcessing(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return ProcessingHandlers.continueProcessing(e);
}

// Universal Actions
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

// Continuation Processing Handler
function continueLargeInboxProcessing(): void {
  return ContinuationHandlers.continueLargeInboxProcessing();
}

// Test Mode Handlers
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
  const apiKey = PropertiesService.getUserProperties().getProperty('apiKey');
  if (!apiKey) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('❌ API key not configured'))
      .build();
  }
  
  const result = TestMode.runTestAnalysis(
    apiKey,
    PropertiesService.getUserProperties().getProperty('classificationPrompt') || Config.DEFAULT_CLASSIFICATION_PROMPT,
    PropertiesService.getUserProperties().getProperty('responsePrompt') || Config.DEFAULT_RESPONSE_PROMPT
  );
  
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification()
      .setText(result.success 
        ? `✅ Test complete: ${result.emailsProcessed} email(s) analyzed`
        : `❌ Test failed: ${result.errors[0]}`))
    .setNavigation(CardService.newNavigation()
      .updateCard(TestMode.createTestModeCard()))
    .build();
}

// Dark Mode Handler
function toggleDarkMode(): GoogleAppsScript.Card_Service.ActionResponse {
  const newMode = DarkMode.toggleDarkMode();
  
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification()
      .setText(newMode ? '🌙 Dark mode enabled' : '☀️ Light mode enabled'))
    .setNavigation(CardService.newNavigation()
      .updateCard(UIImprovements.createCondensedMainCard()))
    .build();
}

// Welcome Flow Handlers
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

// Contextual Actions Handler
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

// UI Improvements Handlers
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