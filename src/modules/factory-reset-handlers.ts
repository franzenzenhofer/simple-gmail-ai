/**
 * Factory Reset Handlers
 * Global functions for handling factory reset actions
 */

namespace FactoryResetHandlers {
  /**
   * Shows the factory reset confirmation dialog
   */
  export function showFactoryResetConfirmation(_e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.ActionResponse {
    return UI.navigateTo(FactoryReset.createConfirmationCard());
  }

  /**
   * Executes the factory reset after confirmation
   */
  export function executeFactoryReset(e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.ActionResponse {
    // Form inputs are not typed in Google Apps Script types
    const eventWithForm = e as GoogleAppsScript.Addons.EventObject & {
      formInputs?: {
        confirmationText?: string[];
      };
    };
    const confirmationText = eventWithForm.formInputs?.confirmationText?.[0];
    
    // Check confirmation
    if (confirmationText !== 'DELETE') {
      return UI.showNotification('❌ Confirmation failed. You must type "DELETE" exactly to proceed.');
    }
    
    // Perform the reset
    const result = FactoryReset.performFactoryReset();
    
    // Show result card
    return UI.navigateTo(FactoryReset.createResultCard(result));
  }

  /**
   * Closes the add-on (navigates away)
   */
  export function closeAddOn(_e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.ActionResponse {
    // Return to Gmail by popping all cards
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().popToRoot())
      .setNotification(
        CardService.newNotification()
          .setText('Add-on has been reset. Please close and reopen to start fresh.')
      )
      .build();
  }
}

// Global function wrappers for Apps Script
// These functions are called from UI actions and must be global
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function showFactoryResetConfirmation(e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.ActionResponse {
  return FactoryResetHandlers.showFactoryResetConfirmation(e);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function executeFactoryReset(e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.ActionResponse {
  return FactoryResetHandlers.executeFactoryReset(e);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function closeAddOn(e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.ActionResponse {
  return FactoryResetHandlers.closeAddOn(e);
}