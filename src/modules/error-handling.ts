/**
 * Error Handling Module
 * Contains global error handling functionality
 */

namespace ErrorHandling {
  /**
   * Initialize global error handler with enhanced error preservation
   */
  export function handleGlobalError(error: any): GoogleAppsScript.Card_Service.Card {
    // Parse error into structured format
    const appError = ErrorTaxonomy.parseError(error);
    
    // Log the error with appropriate severity
    ErrorTaxonomy.logError(appError);
    
    // Get user-friendly message
    const userMessage = ErrorTaxonomy.getUserMessage(appError.type);
    
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle(getSeverityIcon(appError.severity) + ' Error')
        .setSubtitle('Gmail AI Support Triage'))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph()
          .setText(userMessage))
        .addWidget(CardService.newTextParagraph()
          .setText(getRecoveryMessage(appError)))
        .addWidget(CardService.newTextParagraph()
          .setText('<i>Error type: ' + appError.type + '</i>')));
    
    return card.build();
  }
  
  /**
   * Get icon for severity level
   */
  function getSeverityIcon(severity: ErrorTaxonomy.ErrorSeverity): string {
    switch (severity) {
      case ErrorTaxonomy.ErrorSeverity.CRITICAL:
        return '❌';
      case ErrorTaxonomy.ErrorSeverity.HIGH:
        return '⚠️';
      case ErrorTaxonomy.ErrorSeverity.MEDIUM:
        return '⚡';
      case ErrorTaxonomy.ErrorSeverity.LOW:
        return 'ℹ️';
      default:
        return '⚠️';
    }
  }
  
  /**
   * Get recovery message based on error
   */
  function getRecoveryMessage(error: ErrorTaxonomy.AppError): string {
    if (error.recoverable) {
      return 'This error is recoverable. Please try again.';
    }
    
    switch (error.type) {
      case ErrorTaxonomy.AppErrorType.API_KEY_INVALID:
      case ErrorTaxonomy.AppErrorType.API_KEY_MISSING:
        return 'Please configure your API key in the settings tab.';
      case ErrorTaxonomy.AppErrorType.GMAIL_PERMISSION_DENIED:
        return 'Please reinstall the add-on to grant necessary permissions.';
      case ErrorTaxonomy.AppErrorType.API_QUOTA_EXCEEDED:
      case ErrorTaxonomy.AppErrorType.GMAIL_QUOTA_EXCEEDED:
        return 'Please wait a while before trying again.';
      default:
        return 'Please try reloading Gmail or contact support if the issue persists.';
    }
  }
}