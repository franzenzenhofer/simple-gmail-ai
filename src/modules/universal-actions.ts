/**
 * Universal Actions Module
 * Contains all Universal Action handlers for Google Apps Script
 */

namespace UniversalActions {
  export function viewLogsUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
    return CardService.newUniversalActionResponseBuilder()
      .displayAddOnCards([UI.buildLogsTab()])
      .build();
  }

  export function showApiKeyTabUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
    return CardService.newUniversalActionResponseBuilder()
      .displayAddOnCards([UI.buildApiKeyTab()])
      .build();
  }

  export function showLogsTabUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
    return CardService.newUniversalActionResponseBuilder()
      .displayAddOnCards([UI.buildLogsTab()])
      .build();
  }

  export function showSettingsTabUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
    return CardService.newUniversalActionResponseBuilder()
      .displayAddOnCards([UI.buildSettingsTab()])
      .build();
  }

  export function showLiveLogTabUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
    return CardService.newUniversalActionResponseBuilder()
      .displayAddOnCards([UI.buildLiveLogView()])
      .build();
  }

  export function showHomepageUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
    return CardService.newUniversalActionResponseBuilder()
      .displayAddOnCards([UI.buildHomepage()])
      .build();
  }

  export function showPromptEditorUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
    return CardService.newUniversalActionResponseBuilder()
      .displayAddOnCards([DocsPromptHandlers.createPromptEditorCard()])
      .build();
  }

  export function showTestModeUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
    return CardService.newUniversalActionResponseBuilder()
      .displayAddOnCards([TestMode.createTestModeCard()])
      .build();
  }

  export function showWelcomeFlowUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
    return CardService.newUniversalActionResponseBuilder()
      .displayAddOnCards([WelcomeFlow.createWelcomeCard()])
      .build();
  }
}