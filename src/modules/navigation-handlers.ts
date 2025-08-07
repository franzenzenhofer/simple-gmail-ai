/**
 * Navigation Handlers Module
 * Contains all navigation handlers for tab switching
 */

namespace NavigationHandlers {
  export function showApiKeyTab(): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      return UI.navigateTo(UI.buildApiKeyTab());
    } catch (error) {
      return UI.navigateTo(ErrorHandling.handleGlobalError(error));
    }
  }

  export function showLogsTab(): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      return UI.navigateTo(UI.buildLogsTab());
    } catch (error) {
      return UI.navigateTo(ErrorHandling.handleGlobalError(error));
    }
  }

  export function showSettingsTab(): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      return UI.navigateTo(UI.buildSettingsTab());
    } catch (error) {
      return UI.navigateTo(ErrorHandling.handleGlobalError(error));
    }
  }

  export function backToMain(): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      return UI.navigateTo(UI.buildHomepage());
    } catch (error) {
      return UI.navigateTo(ErrorHandling.handleGlobalError(error));
    }
  }

  export function refreshLiveLog(): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      return UI.navigateTo(UI.buildLiveLogView());
    } catch (error) {
      return UI.navigateTo(ErrorHandling.handleGlobalError(error));
    }
  }
}