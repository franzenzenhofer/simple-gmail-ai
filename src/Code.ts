/**
 * Gmail Support Triage & Auto-Reply Add-on
 * Main entry point - imports all modules and exposes global functions
 */

// Module imports (will be inlined by bundler)
/// <reference path="modules/config.ts" />
/// <reference path="modules/types.ts" />
/// <reference path="modules/logger.ts" />
/// <reference path="modules/ai.ts" />
/// <reference path="modules/gmail.ts" />
/// <reference path="modules/ui.ts" />
/// <reference path="modules/utils.ts" />
/// <reference path="modules/error-handling.ts" />
/// <reference path="modules/entry-points.ts" />
/// <reference path="modules/navigation-handlers.ts" />
/// <reference path="modules/action-handlers.ts" />
/// <reference path="modules/processing-handlers.ts" />
/// <reference path="modules/universal-actions.ts" />

// ===== GLOBAL FUNCTION EXPORTS =====
// These functions must be globally accessible for Google Apps Script

// Entry Points
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