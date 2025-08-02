/**
 * Error Handling Module
 * Contains global error handling functionality
 */

namespace ErrorHandling {
  /**
   * Initialize global error handler
   */
  export function handleGlobalError(error: any): GoogleAppsScript.Card_Service.Card {
    const errorMessage = error?.message || String(error);
    
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('⚠️ Error')
        .setSubtitle('Gmail AI Support Triage'))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph()
          .setText('An error occurred: ' + errorMessage))
        .addWidget(CardService.newTextParagraph()
          .setText('Please try reloading Gmail or reinstalling the add-on.')));
    
    return card.build();
  }
}