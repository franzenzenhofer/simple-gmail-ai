/**
 * Error Handling Module
 * Contains global error handling functionality
 */

namespace ErrorHandling {
  /**
   * Initialize global error handler with enhanced error preservation
   */
  export function handleGlobalError(error: any): GoogleAppsScript.Card_Service.Card {
    // Use enhanced error handling to preserve stack trace
    const errorDetails = Utils.preserveErrorStack(error);
    
    // Log the full error details for debugging
    AppLogger.error('Global error handler triggered', {
      message: errorDetails.message,
      fullError: errorDetails.fullError,
      stack: errorDetails.stack,
      context: 'Global UI Error Handler'
    });
    
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('⚠️ Error')
        .setSubtitle('Gmail AI Support Triage'))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph()
          .setText('An error occurred: ' + errorDetails.message))
        .addWidget(CardService.newTextParagraph()
          .setText('Please try reloading Gmail or reinstalling the add-on.'))
        .addWidget(CardService.newTextParagraph()
          .setText('<i>Error details have been logged for debugging.</i>')));
    
    return card.build();
  }
}