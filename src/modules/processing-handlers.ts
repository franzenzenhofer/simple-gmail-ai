/**
 * Processing Handlers Module
 * Contains all processing logic for email analysis
 */

namespace ProcessingHandlers {
  /**
   * Common processing logic extracted to avoid DRY violation
   * Returns stats and execution info
   */
  function executeProcessing(
    apiKey: string,
    mode: string,
    prompt1: string,
    prompt2: string,
    createDrafts: boolean,
    autoReply: boolean
  ): { stats: Types.ProcessingStats; executionTime: string; statsString: string } {
    const threads = GmailService.getUnprocessedThreads();
    const stats: Types.ProcessingStats = {
      scanned: 0,
      supports: 0,
      drafted: 0,
      sent: 0,
      errors: 0
    };
    
    AppLogger.info('📊 Starting analysis', {
      threadCount: threads.length,
      mode,
      createDrafts,
      autoReply
    });
    
    // Use batch processing instead of individual thread processing
    const results = GmailService.processThreads(
      threads,
      apiKey,
      createDrafts,
      autoReply,
      prompt1,
      prompt2
    );
    
    // Process results and update stats
    results.forEach((result) => {
      stats.scanned++;
      
      if (result.error) {
        stats.errors++;
      } else if (result.isSupport) {
        stats.supports++;
        if (createDrafts) {
          stats.drafted++;
        }
        if (autoReply) {
          stats.sent++;
        }
      }
      
      // Update real-time stats after each thread is processed
      const properties = PropertiesService.getUserProperties();
      properties.setProperty(Config.PROP_KEYS.CURRENT_SCANNED, stats.scanned.toString());
      properties.setProperty(Config.PROP_KEYS.CURRENT_SUPPORTS, stats.supports.toString());
      properties.setProperty(Config.PROP_KEYS.CURRENT_DRAFTED, stats.drafted.toString());
      properties.setProperty(Config.PROP_KEYS.CURRENT_SENT, stats.sent.toString());
      properties.setProperty(Config.PROP_KEYS.CURRENT_ERRORS, stats.errors.toString());
    });
    
    AppLogger.info('🎯 Analysis completed', { stats });
    
    // Save execution info (lock will be released in finally block)
    const props = PropertiesService.getUserProperties();
    
    // T-20: Mark first run as complete for delta processing
    HistoryDelta.markFirstRunDone();
    
    // Save last execution time and stats
    const executionTime = new Date().toLocaleString('de-AT', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: Session.getScriptTimeZone()
    });
    const statsString = `${stats.scanned} analyzed | ${stats.supports} support | ${stats.drafted} drafts | ${stats.sent} sent${stats.errors > 0 ? ' | ' + stats.errors + ' errors' : ''}`;
    
    props.setProperty(Config.PROP_KEYS.LAST_EXECUTION_TIME, executionTime);
    props.setProperty(Config.PROP_KEYS.LAST_EXECUTION_STATS, statsString);
    
    // CRITICAL: Save this execution ID as the last one for live log view
    props.setProperty(Config.PROP_KEYS.LAST_EXECUTION_ID, AppLogger.executionId);
    
    const message = `✅ COMPLETED: ${statsString}`;
    AppLogger.info(message);
    
    return { stats, executionTime, statsString };
  }
  export function continueProcessingAndNavigate(
    apiKey: string,
    mode: string,
    prompt1: string,
    prompt2: string,
    createDrafts: boolean,
    autoReply: boolean
  ): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      // Use common processing logic
      executeProcessing(apiKey, mode, prompt1, prompt2, createDrafts, autoReply);
      
      // Navigate to live log view to show results
      AppLogger.info('🚀 NAVIGATING TO LIVE LOG VIEW - processing complete');
      return UI.navigateTo(UI.buildLiveLogView());
      
    } catch (err) {
      AppLogger.error('Error in processing', { error: Utils.handleError(err) });
      return UI.showNotification('Error: ' + Utils.handleError(err));
    } finally {
      // Ensure lock is released exactly once regardless of success/failure
      LockManager.releaseLock();
    }
  }

  export function continueProcessing(_e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.ActionResponse {
    const userProps = PropertiesService.getUserProperties();
    
    try {
      // Retrieve saved parameters
      const mode = userProps.getProperty(Config.PROP_KEYS.PROCESSING_MODE) || Config.ProcessingMode.LABEL_ONLY;
      const apiKey = userProps.getProperty(Config.PROP_KEYS.API_KEY);
      
      // Prompts now come ONLY from the Google Docs editor
      // Using empty strings as they will be replaced by docs prompts in gmail.ts
      const prompt1 = '';
      const prompt2 = '';
      
      if (!apiKey) {
        throw new Error('API key not found');
      }
      
      const createDrafts = (mode === Config.ProcessingMode.CREATE_DRAFTS || mode === Config.ProcessingMode.AUTO_SEND);
      const autoReply = (mode === Config.ProcessingMode.AUTO_SEND);
      
      // Use common processing logic
      const result = executeProcessing(apiKey, mode, prompt1, prompt2, createDrafts, autoReply);
      
      const message = `✅ COMPLETED: ${result.statsString}`;
      
      // Show success notification and navigate back to homepage
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(message)
        )
        .setNavigation(CardService.newNavigation().updateCard(UI.buildHomepage()))
        .build();
        
    } catch (err) {
      AppLogger.error('Error in processing', { error: Utils.handleError(err) });
      return UI.showNotification('Error: ' + Utils.handleError(err));
    } finally {
      // Ensure lock is released exactly once regardless of success/failure
      LockManager.releaseLock();
    }
  }
}