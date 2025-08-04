/**
 * Factory Reset Module
 * Clears all application data and resets to initial state
 */

namespace FactoryReset {
  
  /**
   * Complete list of all property keys that need to be cleared
   * Based on comprehensive analysis of Config.PROP_KEYS
   */
  const ALL_PROPERTY_KEYS = [
    // Authentication & API
    Config.PROP_KEYS.API_KEY,
    
    // Processing & Analysis
    Config.PROP_KEYS.ANALYSIS_RUNNING,
    Config.PROP_KEYS.ANALYSIS_START_TIME,
    Config.PROP_KEYS.ANALYSIS_CANCELLED,
    Config.PROP_KEYS.PROCESSING_MODE,
    Config.PROP_KEYS.PROMPT_1,
    Config.PROP_KEYS.PROMPT_2,
    
    // Current Execution Stats
    Config.PROP_KEYS.CURRENT_SCANNED,
    Config.PROP_KEYS.CURRENT_SUPPORTS,
    Config.PROP_KEYS.CURRENT_DRAFTED,
    Config.PROP_KEYS.CURRENT_SENT,
    Config.PROP_KEYS.CURRENT_ERRORS,
    
    // Last Execution Info
    Config.PROP_KEYS.LAST_EXECUTION_TIME,
    Config.PROP_KEYS.LAST_EXECUTION_STATS,
    Config.PROP_KEYS.LAST_EXECUTION_ID,
    Config.PROP_KEYS.CURRENT_EXECUTION_ID,
    
    // System Flags & Migration
    Config.PROP_KEYS.ONBOARDING_PROGRESS,
    Config.PROP_KEYS.AI_HEARTBEAT,
    Config.PROP_KEYS.LABEL_CACHE_MIGRATED,
    Config.PROP_KEYS.DOCS_PROMPT_ERROR_COUNT,
    
    // Logging & Debug
    Config.PROP_KEYS.DEBUG_MODE,
    Config.PROP_KEYS.SPREADSHEET_LOGGING,
    Config.PROP_KEYS.SPREADSHEET_LOGGING_ENABLED,
    Config.PROP_KEYS.SPREADSHEET_LOG_ID,
    Config.PROP_KEYS.LOG_FOLDER_ID,
    
    // UI & Features
    Config.PROP_KEYS.DARK_MODE_ENABLED,
    Config.PROP_KEYS.DARK_MODE_INITIALIZED,
    Config.PROP_KEYS.TEST_MODE_CONFIG,
    
    // Welcome Flow
    Config.PROP_KEYS.autoCreateDrafts,
    Config.PROP_KEYS.classificationSensitivity,
    
    // UI Improvements (legacy)
    Config.PROP_KEYS.classificationPrompt,
    Config.PROP_KEYS.responsePrompt,
    Config.PROP_KEYS.EMAILS_PROCESSED,
    Config.PROP_KEYS.EMAILS_TOTAL,
    Config.PROP_KEYS.PROCESSING_STATS,
    
    // Continuation & State
    Config.PROP_KEYS.ACTIVE_CONTINUATION_KEY,
    
    // Additional properties from other modules
    'LOCK_INFO',
    'SPREADSHEET_CONFIG',
    'LABEL_CACHE',
    'HISTORY_DELTA_FIRST_RUN',
    'HISTORY_DELTA_LAST_HISTORY_ID',
    'TEST_MODE_CONFIG',
    'TEST_RUN_HISTORY',
    'DOCS_PROMPT_EDITOR_STATE',
    'DOCS_PROMPT_COMPILED_CONFIG',
    'LAST_ERROR_NOTIFICATION_TIME'
  ];
  
  /**
   * Performs a complete factory reset of the application
   * WARNING: This will delete ALL user data and settings
   */
  export function performFactoryReset(): FactoryResetResult {
    const startTime = Date.now();
    const errors: string[] = [];
    let propertiesCleared = 0;
    let labelsRemoved = 0;
    let spreadsheetsDeleted = 0;
    
    AppLogger.warn('🏭 FACTORY RESET INITIATED', {
      timestamp: new Date().toISOString(),
      executionId: AppLogger.executionId
    });
    
    try {
      // Step 1: Clear all user properties
      AppLogger.info('🧹 Clearing all user properties...');
      const userProps = PropertiesService.getUserProperties();
      
      // Delete each property individually to ensure complete removal
      ALL_PROPERTY_KEYS.forEach(key => {
        try {
          userProps.deleteProperty(key);
          propertiesCleared++;
        } catch (error) {
          const errorMsg = Utils.logAndHandleError(error, `Clear property: ${key}`);
          errors.push(`Failed to clear ${key}: ${errorMsg}`);
        }
      });
      
      // Step 2: Remove Gmail labels
      AppLogger.info('🏷️ Removing Gmail labels...');
      try {
        // Get ALL labels - we need to remove everything including user-created from docs
        const allLabels = GmailApp.getUserLabels();
        
        allLabels.forEach(label => {
          try {
            const labelName = label.getName();
            label.deleteLabel();
            labelsRemoved++;
            AppLogger.info(`Removed label: ${labelName}`);
          } catch (error) {
            const errorMsg = Utils.logAndHandleError(error, `Remove label: ${label.getName()}`);
            errors.push(`Failed to remove label ${label.getName()}: ${errorMsg}`);
          }
        });
      } catch (error) {
        const errorMsg = Utils.logAndHandleError(error, 'Remove Gmail labels');
        errors.push(`Failed to remove Gmail labels: ${errorMsg}`);
      }
      
      // Step 3: Decouple log spreadsheets and docs (do NOT delete them)
      AppLogger.info('🔗 Decoupling logs and docs...');
      try {
        // Clear references to docs and spreadsheets without deleting them
        userProps.deleteProperty('PROMPT_DOC_ID');
        userProps.deleteProperty('PROMPT_DOC_REV');
        userProps.deleteProperty('GOOGLE_DOCS_PROMPTS_RAW');
        userProps.deleteProperty('PROMPTS_COMPILED_AT');
        AppLogger.info('Decoupled Google Docs prompt document');
        
        // Clear spreadsheet references
        userProps.deleteProperty(Config.PROP_KEYS.SPREADSHEET_LOG_ID);
        userProps.deleteProperty(Config.PROP_KEYS.LOG_FOLDER_ID);
        AppLogger.info('Decoupled log spreadsheets');
      } catch (error) {
        const errorMsg = Utils.logAndHandleError(error, 'Decouple documents');
        errors.push(`Failed to decouple documents: ${errorMsg}`);
      }
      
      // Step 4: Clear any caches
      AppLogger.info('🗑️ Clearing caches...');
      try {
        const cache = CacheService.getUserCache();
        if (cache) {
          cache.removeAll(['LABEL_CACHE', 'LOCK_INFO', 'SPREADSHEET_CONFIG']);
        }
      } catch (error) {
        // Cache clearing is non-critical
      }
      
      // Step 5: Force clear any active locks
      AppLogger.info('🔓 Clearing any active locks...');
      try {
        LockManager.forceClearLocks();
      } catch (error) {
        // Lock clearing is non-critical
      }
      
      const executionTime = Date.now() - startTime;
      
      AppLogger.warn('🏭 FACTORY RESET COMPLETED', {
        propertiesCleared,
        labelsRemoved,
        spreadsheetsDeleted,
        errors: errors.length,
        executionTimeMs: executionTime
      });
      
      return {
        success: errors.length === 0,
        propertiesCleared,
        labelsRemoved,
        spreadsheetsDeleted,
        errors,
        executionTimeMs: executionTime
      };
      
    } catch (error) {
      const errorMsg = Utils.logAndHandleError(error, 'Factory reset');
      errors.push(`Critical error during reset: ${errorMsg}`);
      
      return {
        success: false,
        propertiesCleared,
        labelsRemoved,
        spreadsheetsDeleted,
        errors,
        executionTimeMs: Date.now() - startTime
      };
    }
  }
  
  /**
   * Creates a confirmation card for factory reset
   */
  export function createConfirmationCard(): GoogleAppsScript.Card_Service.Card {
    const card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('🏭 Factory Reset')
          .setSubtitle('⚠️ Warning: This action cannot be undone!')
          .setImageStyle(CardService.ImageStyle.SQUARE)
          .setImageUrl('https://www.gstatic.com/images/icons/material/system/2x/warning_amber_48dp.png')
      );
    
    const warningSection = CardService.newCardSection();
    
    warningSection.addWidget(
      CardService.newTextParagraph()
        .setText(
          '<b>⚠️ WARNING: Factory Reset will permanently delete:</b><br><br>' +
          '• Your Gemini API key<br>' +
          '• All custom prompts and settings<br>' +
          '• ALL Gmail labels (system and user-created)<br>' +
          '• All execution history and statistics<br>' +
          '• All saved preferences and settings<br>' +
          '• Connection to docs and logs (files remain)<br><br>' +
          '<font color="#dc3545"><b>This action CANNOT be undone!</b></font>'
        )
    );
    
    card.addSection(warningSection);
    
    // Confirmation section
    const confirmSection = CardService.newCardSection();
    
    confirmSection.addWidget(
      CardService.newTextParagraph()
        .setText('To confirm, type "DELETE" in the box below:')
    );
    
    confirmSection.addWidget(
      CardService.newTextInput()
        .setFieldName('confirmationText')
        .setTitle('Type DELETE to confirm')
        .setHint('This is case-sensitive')
    );
    
    card.addSection(confirmSection);
    
    // Action buttons
    const buttonSection = CardService.newCardSection();
    
    buttonSection.addWidget(
      CardService.newTextButton()
        .setText('🏭 Execute Factory Reset')
        .setBackgroundColor('#dc3545')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('executeFactoryReset')
        )
    );
    
    buttonSection.addWidget(
      CardService.newTextButton()
        .setText('Cancel')
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('showSettingsTab')
        )
    );
    
    card.addSection(buttonSection);
    
    return card.build();
  }
  
  /**
   * Creates a result card showing factory reset outcome
   */
  export function createResultCard(result: FactoryResetResult): GoogleAppsScript.Card_Service.Card {
    const card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle(result.success ? '✅ Factory Reset Complete' : '❌ Factory Reset Failed')
          .setSubtitle(result.success ? 'Application has been reset' : 'Some errors occurred')
      );
    
    const resultSection = CardService.newCardSection();
    
    // Summary
    resultSection.addWidget(
      CardService.newTextParagraph()
        .setText(
          '<b>Reset Summary:</b><br>' +
          '• Properties cleared: ' + result.propertiesCleared + '<br>' +
          '• Labels removed: ' + result.labelsRemoved + '<br>' +
          '• Documents decoupled: Yes<br>' +
          '• Execution time: ' + result.executionTimeMs + 'ms'
        )
    );
    
    // Errors if any
    if (result.errors.length > 0) {
      resultSection.addWidget(
        CardService.newTextParagraph()
          .setText(
            '<br><b>⚠️ Errors encountered:</b><br>' +
            result.errors.map(e => '• ' + e).join('<br>')
          )
      );
    }
    
    card.addSection(resultSection);
    
    // Next steps
    const nextStepsSection = CardService.newCardSection();
    
    nextStepsSection.addWidget(
      CardService.newTextParagraph()
        .setText(
          result.success ?
          '<b>✅ Next Steps:</b><br>' +
          '1. Close and reopen the add-on<br>' +
          '2. Complete the welcome flow<br>' +
          '3. Enter your API key<br>' +
          '4. Configure your settings' :
          '<b>⚠️ Partial Reset:</b><br>' +
          'Some items could not be deleted. You may need to manually remove them.'
        )
    );
    
    nextStepsSection.addWidget(
      CardService.newTextButton()
        .setText('Close Add-on')
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('closeAddOn')
        )
    );
    
    card.addSection(nextStepsSection);
    
    return card.build();
  }
  
  export interface FactoryResetResult {
    success: boolean;
    propertiesCleared: number;
    labelsRemoved: number;
    spreadsheetsDeleted: number;
    errors: string[];
    executionTimeMs: number;
  }
}