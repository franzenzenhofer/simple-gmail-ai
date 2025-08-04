/**
 * UI Improvements Module
 * Enhanced UI components with collapsible sections and overlays
 */

namespace UIImprovements {
  
  // Section states
  interface SectionState {
    mainSettings: boolean;
    prompts: boolean;
    advanced: boolean;
    statistics: boolean;
  }
  
  // Form input event type
  interface UIFormEvent {
    formInput: {
      section?: string;
      logLevel?: string;
      searchTerm?: string;
      refreshLog?: string;
      [key: string]: string | undefined;
    };
    parameters?: {
      section?: string;
      [key: string]: string | undefined;
    };
  }
  
  const SECTION_STATES_KEY = 'UI_SECTION_STATES';
  const LIVE_LOG_SETTINGS_KEY = 'LIVE_LOG_SETTINGS';
  
  /**
   * Get section collapse states
   */
  export function getSectionStates(): SectionState {
    const statesStr = PropertiesService.getUserProperties().getProperty(SECTION_STATES_KEY);
    
    if (statesStr) {
      try {
        return JSON.parse(statesStr);
      } catch (e) {
        // Ignore
      }
    }
    
    // Default: all sections expanded
    return {
      mainSettings: true,
      prompts: true,
      advanced: false,
      statistics: false
    };
  }
  
  /**
   * Toggle section state
   */
  export function toggleSection(sectionName: keyof SectionState): void {
    const states = getSectionStates();
    states[sectionName] = !states[sectionName];
    
    PropertiesService.getUserProperties().setProperty(
      SECTION_STATES_KEY,
      JSON.stringify(states)
    );
  }
  
  /**
   * Create collapsible section
   */
  export function createCollapsibleSection(
    title: string,
    sectionKey: keyof SectionState,
    widgets: GoogleAppsScript.Card_Service.Widget[]
  ): GoogleAppsScript.Card_Service.CardSection {
    const states = getSectionStates();
    const isExpanded = states[sectionKey];
    
    const section = CardService.newCardSection();
    
    // Create header with toggle button
    const toggleAction = CardService.newAction()
      .setFunctionName('toggleSectionState')
      .setParameters({ section: sectionKey });
    
    const headerText = CardService.newDecoratedText()
      .setText(title)
      .setIconUrl(isExpanded 
        ? 'https://www.gstatic.com/images/icons/material/system/2x/expand_less_black_48dp.png'
        : 'https://www.gstatic.com/images/icons/material/system/2x/expand_more_black_48dp.png')
      .setOnClickAction(toggleAction);
    
    section.addWidget(headerText);
    
    // Add widgets if expanded
    if (isExpanded) {
      widgets.forEach(widget => section.addWidget(widget));
    }
    
    return section;
  }
  
  /**
   * Create condensed main card
   */
  export function createCondensedMainCard(): GoogleAppsScript.Card_Service.Card {
    const apiKey = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.API_KEY);
    const isDarkMode = DarkMode.isDarkModeEnabled();
    
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('Gmail AI Assistant')
        .setSubtitle(apiKey ? 'Ready to analyze' : 'Setup required')
        .setImageUrl('https://www.gstatic.com/images/branding/product/2x/gmail_2020q4_48dp.png')
        .setImageStyle(CardService.ImageStyle.CIRCLE));
    
    // Quick actions section (always visible)
    const quickActions = CardService.newCardSection();
    
    if (apiKey) {
      const analyzeAction = CardService.newAction()
        .setFunctionName('runAnalysis')
        .setLoadIndicator(CardService.LoadIndicator.SPINNER);
      
      quickActions.addWidget(CardService.newTextButton()
        .setText('🚀 Analyze Emails')
        .setOnClickAction(analyzeAction)
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED));
      
      const testModeAction = CardService.newAction()
        .setFunctionName('toggleTestMode');
      
      quickActions.addWidget(CardService.newTextButton()
        .setText('🧪 Test Mode')
        .setOnClickAction(testModeAction)
        .setTextButtonStyle(CardService.TextButtonStyle.TEXT));
    } else {
      const setupAction = CardService.newAction()
        .setFunctionName('showApiKeyTab');
      
      quickActions.addWidget(CardService.newTextButton()
        .setText('🔑 Setup API Key')
        .setOnClickAction(setupAction)
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED));
    }
    
    card.addSection(quickActions);
    
    // Main settings section (collapsible)
    const mainSettingsWidgets: GoogleAppsScript.Card_Service.Widget[] = [];
    
    mainSettingsWidgets.push(CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.RADIO_BUTTON)
      .setFieldName('mode')
      .setTitle('Processing Mode')
      .addItem('Label emails only', 'label', true)
      .addItem('Label + Create draft replies', 'draft', false));
    
    mainSettingsWidgets.push(CardService.newDecoratedText()
      .setText('Dark Mode')
      .setBottomLabel(isDarkMode ? 'Enabled' : 'Disabled')
      .setSwitchControl(CardService.newSwitch()
        .setFieldName('darkMode')
        .setValue(String(isDarkMode))
        .setOnChangeAction(CardService.newAction()
          .setFunctionName('toggleDarkMode'))));
    
    card.addSection(createCollapsibleSection(
      '⚙️ Main Settings',
      'mainSettings',
      mainSettingsWidgets
    ));
    
    // Prompts are now managed ONLY through Google Docs
    // No on-page editing allowed - redirect to docs
    const promptsWidgets: GoogleAppsScript.Card_Service.Widget[] = [];
    
    promptsWidgets.push(CardService.newTextParagraph()
      .setText('📝 <b>All prompts are now managed in Google Docs</b><br>' +
               'Use the Docs Prompt Editor below to edit labels and prompts.<br>' +
               'This ensures consistency and prevents conflicting configurations.'));
    
    card.addSection(createCollapsibleSection(
      '💬 AI Prompts (Docs Only)',
      'prompts',
      promptsWidgets
    ));
    
    // Advanced section (collapsible, default closed)
    const advancedWidgets: GoogleAppsScript.Card_Service.Widget[] = [];
    
    advancedWidgets.push(CardService.newDecoratedText()
      .setText('⚠️ Auto-Reply Mode')
      .setBottomLabel('DANGER: Automatically sends emails')
      .setSwitchControl(CardService.newSwitch()
        .setFieldName('autoReply')
        .setValue('false')));
    
    advancedWidgets.push(CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('batchSize')
      .setTitle('Batch Size')
      .addItem('Small (10 emails)', '10', false)
      .addItem('Medium (20 emails)', '20', true)
      .addItem('Large (50 emails)', '50', false));
    
    advancedWidgets.push(CardService.newDecoratedText()
      .setText('Debug Mode')
      .setBottomLabel('Extra logging for troubleshooting')
      .setSwitchControl(CardService.newSwitch()
        .setFieldName('debugMode')
        .setValue(String(PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.DEBUG_MODE) === 'true'))));
    
    card.addSection(createCollapsibleSection(
      '🔧 Advanced Settings',
      'advanced',
      advancedWidgets
    ));
    
    // Statistics section (collapsible, default closed)
    const stats = getProcessingStatistics();
    const statsWidgets: GoogleAppsScript.Card_Service.Widget[] = [];
    
    statsWidgets.push(CardService.newTextParagraph()
      .setText(
        '📊 Processing Statistics:\n\n' +
        `Total Processed: ${stats.totalProcessed || stats.emailsScanned}\n` +
        `Support Emails: ${stats.supportCount || stats.supportRequests} (${stats.supportPercentage || 0}%)\n` +
        `Drafts Created: ${stats.draftsCreated}\n` +
        `Errors: ${stats.errorCount || 0}\n` +
        `Last Run: ${stats.lastRun || 'Never'}`
      ));
    
    statsWidgets.push(CardService.newTextButton()
      .setText('Reset Statistics')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('resetStatistics'))
      .setTextButtonStyle(CardService.TextButtonStyle.TEXT));
    
    card.addSection(createCollapsibleSection(
      '📈 Statistics',
      'statistics',
      statsWidgets
    ));
    
    return card.build();
  }
  
  /**
   * Create live log overlay dialog
   */
  export function createLiveLogOverlay(): GoogleAppsScript.Card_Service.Card {
    const logs = AppLogger.getRecentLogs(50);
    const settings = getLiveLogSettings();
    
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('📜 Live Processing Log')
        .setSubtitle('Real-time activity monitor'));
    
    // Controls section
    const controls = CardService.newCardSection();
    
    // Filter dropdown
    controls.addWidget(CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('logLevel')
      .setTitle('Filter Level')
      .addItem('All', 'all', settings.level === 'all')
      .addItem('Info only', 'info', settings.level === 'info')
      .addItem('Errors only', 'error', settings.level === 'error')
      .setOnChangeAction(CardService.newAction()
        .setFunctionName('updateLogFilter')));
    
    // Search input
    controls.addWidget(CardService.newTextInput()
      .setFieldName('searchTerm')
      .setTitle('Search Logs')
      .setHint('Enter search term...')
      .setValue(settings.searchTerm || ''));
    
    // Action buttons
    const buttonSet = CardService.newButtonSet();
    
    buttonSet.addButton(CardService.newTextButton()
      .setText('🔄 Refresh')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('refreshLiveLogOverlay')));
    
    buttonSet.addButton(CardService.newTextButton()
      .setText('🗑️ Clear')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('clearLogs')));
    
    buttonSet.addButton(CardService.newTextButton()
      .setText('❌ Close')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('closeLiveLogOverlay')));
    
    controls.addWidget(buttonSet);
    
    card.addSection(controls);
    
    // Progress indicator
    if (isProcessingActive()) {
      const progress = getProcessingProgress();
      const progressSection = CardService.newCardSection();
      
      progressSection.addWidget(CardService.newTextParagraph()
        .setText(`⏳ Processing: ${progress.current}/${progress.total} (${progress.percentage}%)`));
      
      // Simple progress bar using text
      const barLength = 20;
      const filled = Math.round((progress.percentage / 100) * barLength);
      const progressBar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
      
      progressSection.addWidget(CardService.newTextParagraph()
        .setText(progressBar));
      
      card.addSection(progressSection);
    }
    
    // Logs section
    const logsSection = CardService.newCardSection()
      .setHeader('Log Entries');
    
    // Filter logs
    const filteredLogs = filterLogs(logs, settings);
    
    if (filteredLogs.length === 0) {
      logsSection.addWidget(CardService.newTextParagraph()
        .setText('No logs match the current filter'));
    } else {
      // Show latest logs first
      filteredLogs.reverse().slice(0, 20).forEach(log => {
        const logEntry = log as { level?: string; message?: string; context?: string; timestamp?: string | number };
        const icon = getLogIcon(logEntry.level || 'info');
        const time = logEntry.timestamp ? new Date(logEntry.timestamp).toLocaleTimeString() : 'Unknown';
        
        logsSection.addWidget(CardService.newDecoratedText()
          .setText(`${icon} ${logEntry.message || 'No message'}`)
          .setBottomLabel(`${time} | ${logEntry.context || ''}`));
      });
    }
    
    card.addSection(logsSection);
    
    return card.build();
  }
  
  /**
   * Get live log settings
   */
  function getLiveLogSettings(): {level: string; searchTerm?: string} {
    const settingsStr = PropertiesService.getUserProperties().getProperty(LIVE_LOG_SETTINGS_KEY);
    
    if (settingsStr) {
      try {
        return JSON.parse(settingsStr);
      } catch (e) {
        // Ignore
      }
    }
    
    return { level: 'all' };
  }
  
  /**
   * Update log filter
   */
  export function updateLogFilter(e: UIFormEvent): GoogleAppsScript.Card_Service.ActionResponse {
    const settings = getLiveLogSettings();
    settings.level = e.formInput.logLevel || 'all';
    settings.searchTerm = e.formInput.searchTerm || '';
    
    PropertiesService.getUserProperties().setProperty(
      LIVE_LOG_SETTINGS_KEY,
      JSON.stringify(settings)
    );
    
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation()
        .updateCard(createLiveLogOverlay()))
      .build();
  }
  
  /**
   * Filter logs based on settings
   */
  function filterLogs(logs: unknown[], settings: {level: string; searchTerm?: string}): unknown[] {
    return logs.filter(log => {
      const logEntry = log as { level?: string; message?: string; context?: string };
      
      // Level filter
      if (settings.level !== 'all' && logEntry.level !== settings.level) {
        return false;
      }
      
      // Search filter
      if (settings.searchTerm && logEntry.message) {
        const searchLower = settings.searchTerm.toLowerCase();
        const messageMatch = logEntry.message.toLowerCase().includes(searchLower);
        const contextMatch = logEntry.context ? logEntry.context.toLowerCase().includes(searchLower) : false;
        return messageMatch || contextMatch;
      }
      
      return true;
    });
  }
  
  /**
   * Get log icon based on level
   */
  function getLogIcon(level: string): string {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      case 'debug': return '🐛';
      default: return '📝';
    }
  }
  
  /**
   * Check if processing is active
   */
  function isProcessingActive(): boolean {
    return LockManager.isLocked() ||
           ContinuationTriggers.isContinuationActive();
  }
  
  /**
   * Get processing progress
   */
  function getProcessingProgress(): {current: number; total: number; percentage: number} {
    // Check continuation progress
    const continuationStatus = ContinuationTriggers.getContinuationStatus();
    if (continuationStatus.isActive && continuationStatus.progress) {
      return {
        current: continuationStatus.progress.processed,
        total: continuationStatus.progress.estimated,
        percentage: continuationStatus.progress.percentage
      };
    }
    
    // Default progress
    const processed = parseInt(PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.EMAILS_PROCESSED) || '0');
    const total = parseInt(PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.EMAILS_TOTAL) || '0');
    
    return {
      current: processed,
      total: total,
      percentage: total > 0 ? Math.round((processed / total) * 100) : 0
    };
  }
  
  /**
   * Get processing statistics
   */
  function getProcessingStatistics(): {
    emailsScanned: number;
    supportRequests: number;
    draftsCreated: number;
    emailsSent: number;
    totalProcessed?: number;
    supportCount?: number;
    supportPercentage?: number;
    errorCount?: number;
    lastRun?: string | null;
  } {
    const defaultStats = {
      emailsScanned: 0,
      supportRequests: 0,
      draftsCreated: 0,
      emailsSent: 0,
      totalProcessed: 0,
      supportCount: 0,
      supportPercentage: 0,
      errorCount: 0,
      lastRun: null as string | null
    };
    
    try {
      const statsStr = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.PROCESSING_STATS);
      if (statsStr) {
        const parsed = JSON.parse(statsStr);
        return { ...defaultStats, ...parsed };
      }
    } catch (e) {
      // Ignore
    }
    
    return defaultStats;
  }
  
  /**
   * Reset statistics
   */
  export function resetStatistics(): GoogleAppsScript.Card_Service.ActionResponse {
    PropertiesService.getUserProperties().deleteProperty(Config.PROP_KEYS.PROCESSING_STATS);
    
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('📊 Statistics reset'))
      .setNavigation(CardService.newNavigation()
        .updateCard(createCondensedMainCard()))
      .build();
  }
  
  /**
   * Toggle section state action handler
   */
  export function toggleSectionState(e: UIFormEvent): GoogleAppsScript.Card_Service.ActionResponse {
    const sectionKey = (e.parameters?.section || 'mainSettings') as keyof SectionState;
    toggleSection(sectionKey);
    
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation()
        .updateCard(createCondensedMainCard()))
      .build();
  }
  
  /**
   * Refresh live log overlay
   */
  export function refreshLiveLogOverlay(): GoogleAppsScript.Card_Service.ActionResponse {
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation()
        .updateCard(createLiveLogOverlay()))
      .build();
  }
  
  /**
   * Close live log overlay
   */
  export function closeLiveLogOverlay(): GoogleAppsScript.Card_Service.ActionResponse {
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation()
        .popCard())
      .build();
  }
  
  /**
   * Clear logs
   */
  export function clearLogs(): GoogleAppsScript.Card_Service.ActionResponse {
    AppLogger.clearLogs();
    
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('🗑️ Logs cleared'))
      .setNavigation(CardService.newNavigation()
        .updateCard(createLiveLogOverlay()))
      .build();
  }
}