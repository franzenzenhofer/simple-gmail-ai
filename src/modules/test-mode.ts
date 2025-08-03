/**
 * Test Mode Module
 * One-email test-run mode for safe dry-run testing
 */

namespace TestMode {
  
  // Test mode configuration
  export interface TestModeConfig {
    enabled: boolean;
    maxEmails: number;
    skipLabeling: boolean;
    skipDraftCreation: boolean;
    skipAutoReply: boolean;
    verbose: boolean;
    testEmailId?: string;
  }
  
  // Test run results
  export interface TestRunResult {
    success: boolean;
    emailsProcessed: number;
    classifications: Array<{
      threadId: string;
      subject: string;
      classification: 'support' | 'not';
      confidence?: number;
      wouldApplyLabels: string[];
      wouldCreateDraft: boolean;
      draftPreview?: string;
    }>;
    errors: string[];
    executionTime: number;
    apiCallsEstimated: number;
  }
  
  const TEST_MODE_KEY = 'TEST_MODE_CONFIG';
  const TEST_RUN_HISTORY_KEY = 'TEST_RUN_HISTORY';
  
  /**
   * Enable test mode with configuration
   */
  export function enableTestMode(config: Partial<TestModeConfig> = {}): TestModeConfig {
    const defaultConfig: TestModeConfig = {
      enabled: true,
      maxEmails: 1,
      skipLabeling: true,
      skipDraftCreation: true,
      skipAutoReply: true,
      verbose: true,
      testEmailId: undefined
    };
    
    const finalConfig = { ...defaultConfig, ...config };
    
    PropertiesService.getUserProperties().setProperty(
      TEST_MODE_KEY,
      JSON.stringify(finalConfig)
    );
    
    AppLogger.info('🧪 TEST MODE ENABLED', {
      config: finalConfig
    });
    
    return finalConfig;
  }
  
  /**
   * Disable test mode
   */
  export function disableTestMode(): void {
    PropertiesService.getUserProperties().deleteProperty(TEST_MODE_KEY);
    AppLogger.info('🧪 TEST MODE DISABLED');
  }
  
  /**
   * Check if test mode is active
   */
  export function isTestModeActive(): boolean {
    const config = getTestModeConfig();
    return config?.enabled || false;
  }
  
  /**
   * Get current test mode configuration
   */
  export function getTestModeConfig(): TestModeConfig | null {
    try {
      const configStr = PropertiesService.getUserProperties().getProperty(TEST_MODE_KEY);
      return configStr ? JSON.parse(configStr) : null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Run test on specific email or random sample
   */
  export function runTestAnalysis(
    apiKey: string,
    classificationPrompt: string,
    responsePrompt: string
  ): TestRunResult {
    const startTime = Date.now();
    const config = getTestModeConfig();
    const result: TestRunResult = {
      success: false,
      emailsProcessed: 0,
      classifications: [],
      errors: [],
      executionTime: 0,
      apiCallsEstimated: 0
    };
    
    try {
      if (!config || !config.enabled) {
        throw new Error('Test mode is not enabled');
      }
      
      AppLogger.info('🧪 STARTING TEST RUN', {
        maxEmails: config.maxEmails,
        targetEmailId: config.testEmailId
      });
      
      // Get test emails
      const threads = getTestEmails(config);
      
      if (threads.length === 0) {
        throw new Error('No emails found for testing');
      }
      
      // Process each test email
      threads.forEach(thread => {
        try {
          const testResult = processTestEmail(
            thread,
            apiKey,
            classificationPrompt,
            responsePrompt,
            config
          );
          
          result.classifications.push(testResult);
          result.emailsProcessed++;
          result.apiCallsEstimated += testResult.wouldCreateDraft ? 2 : 1;
          
        } catch (error) {
          const errorMsg = Utils.logAndHandleError(error, `Test email ${thread.getId()}`);
          result.errors.push(errorMsg);
        }
      });
      
      result.success = result.errors.length === 0;
      result.executionTime = Date.now() - startTime;
      
      // Save test run history
      saveTestRunHistory(result);
      
      AppLogger.info('🧪 TEST RUN COMPLETE', {
        success: result.success,
        emailsProcessed: result.emailsProcessed,
        errors: result.errors.length,
        executionTime: result.executionTime
      });
      
    } catch (error) {
      result.errors.push(Utils.logAndHandleError(error, 'Test run'));
      result.executionTime = Date.now() - startTime;
    }
    
    return result;
  }
  
  /**
   * Get emails for testing based on config
   */
  function getTestEmails(config: TestModeConfig): GoogleAppsScript.Gmail.GmailThread[] {
    if (config.testEmailId) {
      // Get specific email by ID
      try {
        const thread = GmailApp.getThreadById(config.testEmailId);
        return thread ? [thread] : [];
      } catch (error) {
        AppLogger.error('Failed to get test email by ID', {
          emailId: config.testEmailId,
          error: String(error)
        });
        return [];
      }
    }
    
    // Get random sample of unprocessed emails
    const unprocessed = GmailService.getUnprocessedThreads();
    const sampleSize = Math.min(config.maxEmails, unprocessed.length);
    
    // Shuffle and take first N
    const shuffled = unprocessed.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, sampleSize);
  }
  
  /**
   * Process single email in test mode
   */
  function processTestEmail(
    thread: GoogleAppsScript.Gmail.GmailThread,
    apiKey: string,
    classificationPrompt: string,
    responsePrompt: string,
    config: TestModeConfig
  ): TestRunResult['classifications'][0] {
    const messages = thread.getMessages();
    if (messages.length === 0) {
      throw new Error('Thread has no messages');
    }
    
    const lastMessage = messages[messages.length - 1];
    const subject = thread.getFirstMessageSubject();
    const body = lastMessage?.getPlainBody() || '';
    
    AppLogger.info('🧪 PROCESSING TEST EMAIL', {
      threadId: thread.getId(),
      subject: subject.substring(0, 50) + '...',
      bodyLength: body.length
    });
    
    // Classify email
    const fullPrompt = classificationPrompt + '\n' + body + '\n---------- EMAIL END ----------';
    const classificationResult = AI.callGemini(apiKey, fullPrompt);
    
    if (!classificationResult.success) {
      throw new Error('Classification failed: ' + classificationResult.error);
    }
    
    const classification = classificationResult.data.toLowerCase();
    const isSupport = classification.indexOf('support') === 0;
    
    // Determine what labels would be applied
    const wouldApplyLabels: string[] = [];
    if (!config.skipLabeling) {
      wouldApplyLabels.push(Config.LABELS.AI_PROCESSED);
      wouldApplyLabels.push(isSupport ? Config.LABELS.SUPPORT : Config.LABELS.NOT_SUPPORT);
    }
    
    // Generate draft preview if applicable
    let draftPreview: string | undefined;
    let wouldCreateDraft = false;
    
    if (isSupport && !config.skipDraftCreation) {
      wouldCreateDraft = true;
      
      if (config.verbose) {
        // Actually generate draft for preview
        const replyPrompt = responsePrompt + '\n' + body + '\n---------- END ----------';
        const replyResult = AI.callGemini(apiKey, replyPrompt);
        
        if (replyResult.success) {
          draftPreview = replyResult.data.substring(0, 200) + '...';
        }
      }
    }
    
    const result = {
      threadId: thread.getId(),
      subject,
      classification: isSupport ? 'support' : 'not' as 'support' | 'not',
      confidence: 0.85, // Mock confidence for now
      wouldApplyLabels,
      wouldCreateDraft,
      draftPreview
    };
    
    if (config.verbose) {
      AppLogger.info('🧪 TEST EMAIL RESULT', result);
    }
    
    return result;
  }
  
  /**
   * Save test run history
   */
  function saveTestRunHistory(result: TestRunResult): void {
    try {
      const historyStr = PropertiesService.getUserProperties().getProperty(TEST_RUN_HISTORY_KEY);
      const history = historyStr ? JSON.parse(historyStr) : [];
      
      // Keep only last 10 test runs
      history.unshift({
        timestamp: new Date().toISOString(),
        ...result
      });
      
      if (history.length > 10) {
        history.pop();
      }
      
      PropertiesService.getUserProperties().setProperty(
        TEST_RUN_HISTORY_KEY,
        JSON.stringify(history)
      );
      
    } catch (error) {
      AppLogger.error('Failed to save test run history', { error: String(error) });
    }
  }
  
  /**
   * Get test run history
   */
  export function getTestRunHistory(): Array<TestRunResult & {timestamp: string}> {
    try {
      const historyStr = PropertiesService.getUserProperties().getProperty(TEST_RUN_HISTORY_KEY);
      return historyStr ? JSON.parse(historyStr) : [];
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Create test mode UI card
   */
  export function createTestModeCard(): GoogleAppsScript.Card_Service.Card {
    const config = getTestModeConfig();
    const isEnabled = config?.enabled || false;
    
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('🧪 Test Mode')
        .setSubtitle(isEnabled ? 'Active' : 'Inactive')
        .setImageStyle(CardService.ImageStyle.SQUARE)
        .setImageUrl('https://www.gstatic.com/images/icons/material/system/2x/science_black_48dp.png')
      );
    
    const section = CardService.newCardSection();
    
    // Status
    section.addWidget(CardService.newTextParagraph()
      .setText(isEnabled 
        ? '✅ Test mode is active. Processing is limited and safe.'
        : '❌ Test mode is inactive. Normal processing will occur.')
    );
    
    // Configuration
    if (isEnabled && config) {
      section.addWidget(CardService.newTextParagraph()
        .setText(
          'Configuration:\n' +
          `• Max emails: ${config.maxEmails}\n` +
          `• Skip labeling: ${config.skipLabeling ? 'Yes' : 'No'}\n` +
          `• Skip drafts: ${config.skipDraftCreation ? 'Yes' : 'No'}\n` +
          `• Verbose mode: ${config.verbose ? 'Yes' : 'No'}`
        )
      );
    }
    
    // Toggle button
    const toggleAction = CardService.newAction()
      .setFunctionName('toggleTestMode');
    
    section.addWidget(CardService.newTextButton()
      .setText(isEnabled ? 'Disable Test Mode' : 'Enable Test Mode')
      .setOnClickAction(toggleAction)
      .setTextButtonStyle(
        isEnabled 
          ? CardService.TextButtonStyle.TEXT 
          : CardService.TextButtonStyle.FILLED
      )
    );
    
    // Run test button (if enabled)
    if (isEnabled) {
      const runTestAction = CardService.newAction()
        .setFunctionName('runTestAnalysis');
      
      section.addWidget(CardService.newTextButton()
        .setText('Run Test Analysis')
        .setOnClickAction(runTestAction)
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      );
    }
    
    card.addSection(section);
    
    // Test history
    const history = getTestRunHistory();
    if (history.length > 0) {
      const historySection = CardService.newCardSection()
        .setHeader('Recent Test Runs');
      
      history.slice(0, 3).forEach(run => {
        historySection.addWidget(CardService.newTextParagraph()
          .setText(
            `${new Date(run.timestamp).toLocaleString()}\n` +
            `Processed: ${run.emailsProcessed} | ` +
            `Errors: ${run.errors.length} | ` +
            `Time: ${run.executionTime}ms`
          )
        );
      });
      
      card.addSection(historySection);
    }
    
    return card.build();
  }
}