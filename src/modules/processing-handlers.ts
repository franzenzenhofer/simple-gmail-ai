/**
 * Processing Handlers Module
 * Contains all processing logic for email analysis
 */

namespace ProcessingHandlers {
  export function continueProcessingAndNavigate(
    apiKey: string,
    mode: string,
    prompt1: string,
    prompt2: string,
    createDrafts: boolean,
    autoReply: boolean
  ): GoogleAppsScript.Card_Service.ActionResponse {
    const userProps = PropertiesService.getUserProperties();
    
    try {
      // START ACTUAL PROCESSING
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
        properties.setProperty('CURRENT_SCANNED', stats.scanned.toString());
        properties.setProperty('CURRENT_SUPPORTS', stats.supports.toString());
        properties.setProperty('CURRENT_DRAFTED', stats.drafted.toString());
        properties.setProperty('CURRENT_SENT', stats.sent.toString());
        properties.setProperty('CURRENT_ERRORS', stats.errors.toString());
      });
      
      AppLogger.info('🎯 Analysis completed', { stats });
      
      // Mark analysis as complete and save execution info
      const props = PropertiesService.getUserProperties();
      props.setProperty('ANALYSIS_RUNNING', 'false');
      
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
      
      props.setProperty('LAST_EXECUTION_TIME', executionTime);
      props.setProperty('LAST_EXECUTION_STATS', statsString);
      
      // CRITICAL: Save this execution ID as the last one for live log view
      props.setProperty('LAST_EXECUTION_ID', AppLogger.executionId);
      
      const message = `✅ COMPLETED: ${statsString}`;
      AppLogger.info(message);
      
      // Navigate to live log view to show results
      AppLogger.info('🚀 NAVIGATING TO LIVE LOG VIEW - processing complete');
      return UI.navigateTo(UI.buildLiveLogView());
      
    } catch (err) {
      userProps.setProperty('ANALYSIS_RUNNING', 'false');
      AppLogger.error('Error in processing', { error: Utils.handleError(err) });
      return UI.showNotification('Error: ' + Utils.handleError(err));
    }
  }

  export function continueProcessing(_e: any): GoogleAppsScript.Card_Service.ActionResponse {
    const userProps = PropertiesService.getUserProperties();
    
    try {
      // Retrieve saved parameters
      const mode = userProps.getProperty('PROCESSING_MODE') || Config.ProcessingMode.LABEL_ONLY;
      const prompt1 = userProps.getProperty('PROMPT_1') || Config.PROMPTS.CLASSIFICATION;
      const prompt2 = userProps.getProperty('PROMPT_2') || Config.PROMPTS.RESPONSE;
      const apiKey = userProps.getProperty('GEMINI_API_KEY');
      
      if (!apiKey) {
        throw new Error('API key not found');
      }
      
      const createDrafts = (mode === Config.ProcessingMode.CREATE_DRAFTS || mode === Config.ProcessingMode.AUTO_SEND);
      const autoReply = (mode === Config.ProcessingMode.AUTO_SEND);
      
      // START ACTUAL PROCESSING
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
        properties.setProperty('CURRENT_SCANNED', stats.scanned.toString());
        properties.setProperty('CURRENT_SUPPORTS', stats.supports.toString());
        properties.setProperty('CURRENT_DRAFTED', stats.drafted.toString());
        properties.setProperty('CURRENT_SENT', stats.sent.toString());
        properties.setProperty('CURRENT_ERRORS', stats.errors.toString());
      });
      
      AppLogger.info('🎯 Analysis completed', { stats });
      
      // Mark analysis as complete and save execution info
      const props = PropertiesService.getUserProperties();
      props.setProperty('ANALYSIS_RUNNING', 'false');
      
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
      
      props.setProperty('LAST_EXECUTION_TIME', executionTime);
      props.setProperty('LAST_EXECUTION_STATS', statsString);
      
      // CRITICAL: Save this execution ID as the last one for live log view
      props.setProperty('LAST_EXECUTION_ID', AppLogger.executionId);
      
      const message = `✅ COMPLETED: ${statsString}`;
      AppLogger.info(message);
      
      // Show success notification and navigate back to homepage
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(message)
        )
        .setNavigation(CardService.newNavigation().updateCard(UI.buildHomepage()))
        .build();
        
    } catch (err) {
      userProps.setProperty('ANALYSIS_RUNNING', 'false');
      AppLogger.error('Error in processing', { error: Utils.handleError(err) });
      return UI.showNotification('Error: ' + Utils.handleError(err));
    }
  }
}