/**
 * Welcome Flow Module
 * First-time user onboarding experience
 */

namespace WelcomeFlow {
  
  // Welcome flow states
  export enum WelcomeState {
    NOT_STARTED = 'not_started',
    API_KEY_SETUP = 'api_key_setup',
    PERMISSIONS_GRANT = 'permissions_grant',
    TEST_RUN = 'test_run',
    CUSTOMIZATION = 'customization',
    COMPLETED = 'completed'
  }
  
  // Type for form input events with formInput property
  interface FormInputEvent {
    formInput: {
      apiKey?: string;
      [key: string]: string | undefined;
    };
  }
  
  // User onboarding progress
  export interface OnboardingProgress {
    state: WelcomeState;
    apiKeyConfigured: boolean;
    permissionsGranted: boolean;
    testRunCompleted: boolean;
    customizationDone: boolean;
    completedAt?: string;
  }
  
  const ONBOARDING_KEY = 'ONBOARDING_PROGRESS';
  const WELCOME_SHOWN_KEY = 'WELCOME_FLOW_SHOWN';
  
  /**
   * Check if user needs welcome flow
   */
  export function needsWelcomeFlow(): boolean {
    const apiKey = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.API_KEY);
    const welcomeShown = PropertiesService.getUserProperties().getProperty(WELCOME_SHOWN_KEY);
    
    return !apiKey && !welcomeShown;
  }
  
  /**
   * Get current onboarding progress
   */
  export function getOnboardingProgress(): OnboardingProgress {
    const progressStr = PropertiesService.getUserProperties().getProperty(ONBOARDING_KEY);
    
    if (progressStr) {
      try {
        return JSON.parse(progressStr);
      } catch (e) {
        // Log the parse error for debugging
        AppLogger.error('Failed to parse onboarding progress', {
          error: Utils.handleError(e),
          corruptedData: progressStr
        });
        
        // Clear the corrupted data
        PropertiesService.getUserProperties().deleteProperty(ONBOARDING_KEY);
        
        // Notify about reset (will be shown on next UI interaction)
        AppLogger.warn('Onboarding progress reset due to data corruption');
      }
    }
    
    // Default progress
    return {
      state: WelcomeState.NOT_STARTED,
      apiKeyConfigured: false,
      permissionsGranted: false,
      testRunCompleted: false,
      customizationDone: false
    };
  }
  
  /**
   * Update onboarding progress
   */
  export function updateOnboardingProgress(updates: Partial<OnboardingProgress>): void {
    const current = getOnboardingProgress();
    const updated = { ...current, ...updates };
    
    PropertiesService.getUserProperties().setProperty(
      ONBOARDING_KEY,
      JSON.stringify(updated)
    );
    
    AppLogger.info('👋 ONBOARDING PROGRESS UPDATED', updated);
  }
  
  /**
   * Create welcome card
   */
  export function createWelcomeCard(): GoogleAppsScript.Card_Service.Card {
    const progress = getOnboardingProgress();
    
    switch (progress.state) {
      case WelcomeState.NOT_STARTED:
        return createIntroCard();
      case WelcomeState.API_KEY_SETUP:
        return createApiKeySetupCard();
      case WelcomeState.PERMISSIONS_GRANT:
        return createPermissionsCard();
      case WelcomeState.TEST_RUN:
        return createTestRunCard();
      case WelcomeState.CUSTOMIZATION:
        return createCustomizationCard();
      case WelcomeState.COMPLETED:
        return createCompletionCard();
      default:
        return createIntroCard();
    }
  }
  
  /**
   * Create intro card
   */
  function createIntroCard(): GoogleAppsScript.Card_Service.Card {
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('Welcome to Gmail AI Assistant! 👋')
        .setSubtitle('Let\'s get you set up in just a few steps')
        .setImageUrl('https://www.gstatic.com/images/branding/product/2x/gmail_2020q4_48dp.png')
        .setImageStyle(CardService.ImageStyle.CIRCLE));
    
    const section = CardService.newCardSection();
    
    section.addWidget(CardService.newTextParagraph()
      .setText(
        'Gmail AI Assistant helps you:\n\n' +
        '✨ Automatically classify emails\n' +
        '🏷️ Apply smart labels\n' +
        '✍️ Generate professional replies\n' +
        '⚡ Save hours on email management\n\n' +
        'This quick setup will take less than 2 minutes.'
      ));
    
    section.addWidget(CardService.newImage()
      .setImageUrl('https://www.gstatic.com/images/icons/material/system/2x/auto_awesome_black_48dp.png')
      .setAltText('AI Assistant'));
    
    const startAction = CardService.newAction()
      .setFunctionName('startWelcomeFlow');
    
    section.addWidget(CardService.newTextButton()
      .setText('Get Started →')
      .setOnClickAction(startAction)
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED));
    
    card.addSection(section);
    
    // Mark welcome as shown
    PropertiesService.getUserProperties().setProperty(WELCOME_SHOWN_KEY, 'true');
    
    return card.build();
  }
  
  /**
   * Create API key setup card
   */
  function createApiKeySetupCard(): GoogleAppsScript.Card_Service.Card {
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('Step 1: API Key Setup 🔑')
        .setSubtitle('Connect to Google\'s AI service'));
    
    const section = CardService.newCardSection();
    
    section.addWidget(CardService.newTextParagraph()
      .setText(
        'To use AI features, you\'ll need a free Gemini API key.\n\n' +
        '1. Click the link below to get your key\n' +
        '2. Copy the API key\n' +
        '3. Paste it in the field below'
      ));
    
    section.addWidget(CardService.newTextButton()
      .setText('Get Free API Key')
      .setOpenLink(CardService.newOpenLink()
        .setUrl('https://makersuite.google.com/app/apikey')
        .setOpenAs(CardService.OpenAs.FULL_SIZE)
        .setOnClose(CardService.OnClose.NOTHING))
      .setTextButtonStyle(CardService.TextButtonStyle.TEXT));
    
    section.addWidget(CardService.newTextInput()
      .setFieldName('apiKey')
      .setTitle('Gemini API Key')
      .setHint('AIza...')
      .setMultiline(false));
    
    const saveAction = CardService.newAction()
      .setFunctionName('saveApiKeyFromWelcome')
      .setLoadIndicator(CardService.LoadIndicator.SPINNER);
    
    section.addWidget(CardService.newTextButton()
      .setText('Save & Continue')
      .setOnClickAction(saveAction)
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED));
    
    card.addSection(section);
    
    // Add help section
    const helpSection = CardService.newCardSection()
      .setHeader('Need help?');
    
    helpSection.addWidget(CardService.newTextParagraph()
      .setText(
        '• API keys are free for personal use\n' +
        '• Your key is stored securely\n' +
        '• You can change it anytime in Settings'
      ));
    
    card.addSection(helpSection);
    
    return card.build();
  }
  
  /**
   * Create permissions card
   */
  function createPermissionsCard(): GoogleAppsScript.Card_Service.Card {
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('Step 2: Grant Permissions 🔐')
        .setSubtitle('Allow the assistant to help you'));
    
    const section = CardService.newCardSection();
    
    section.addWidget(CardService.newTextParagraph()
      .setText(
        'The assistant needs permission to:\n\n' +
        '📧 Read your emails (to classify them)\n' +
        '🏷️ Manage labels (to organize emails)\n' +
        '✍️ Create drafts (for suggested replies)\n\n' +
        'Your data stays private and is never shared.'
      ));
    
    const grantAction = CardService.newAction()
      .setFunctionName('grantPermissionsFromWelcome');
    
    section.addWidget(CardService.newTextButton()
      .setText('Grant Permissions')
      .setOnClickAction(grantAction)
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED));
    
    card.addSection(section);
    
    return card.build();
  }
  
  /**
   * Create test run card
   */
  function createTestRunCard(): GoogleAppsScript.Card_Service.Card {
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('Step 3: Test Run 🧪')
        .setSubtitle('Try it on one email first'));
    
    const section = CardService.newCardSection();
    
    section.addWidget(CardService.newTextParagraph()
      .setText(
        'Let\'s test the AI on a single email to make sure everything works.\n\n' +
        'This will:\n' +
        '• Analyze one recent email\n' +
        '• Show you the classification result\n' +
        '• NOT apply any labels or create drafts\n\n' +
        'It\'s completely safe!'
      ));
    
    const testAction = CardService.newAction()
      .setFunctionName('runWelcomeTestAnalysis')
      .setLoadIndicator(CardService.LoadIndicator.SPINNER);
    
    section.addWidget(CardService.newTextButton()
      .setText('Run Test')
      .setOnClickAction(testAction)
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED));
    
    card.addSection(section);
    
    return card.build();
  }
  
  /**
   * Create customization card
   */
  function createCustomizationCard(): GoogleAppsScript.Card_Service.Card {
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('Step 4: Customize (Optional) ⚙️')
        .setSubtitle('Tailor the AI to your needs'));
    
    const section = CardService.newCardSection();
    
    section.addWidget(CardService.newTextParagraph()
      .setText('You can customize how the AI works:'));
    
    // Dark mode toggle
    section.addWidget(CardService.newDecoratedText()
      .setText('Dark Mode')
      .setBottomLabel('Match Gmail\'s theme')
      .setSwitchControl(CardService.newSwitch()
        .setFieldName('darkMode')
        .setValue('false')
        .setOnChangeAction(CardService.newAction()
          .setFunctionName('toggleDarkModeFromWelcome'))));
    
    // Auto-reply toggle
    section.addWidget(CardService.newDecoratedText()
      .setText('Auto-create Drafts')
      .setBottomLabel('Automatically draft replies for support emails')
      .setSwitchControl(CardService.newSwitch()
        .setFieldName('autoCreateDrafts')
        .setValue('false')));
    
    // Classification sensitivity
    section.addWidget(CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('sensitivity')
      .setTitle('Classification Sensitivity')
      .addItem('High (More emails as support)', 'high', false)
      .addItem('Medium (Balanced)', 'medium', true)
      .addItem('Low (Fewer emails as support)', 'low', false));
    
    const finishAction = CardService.newAction()
      .setFunctionName('finishWelcomeFlow');
    
    section.addWidget(CardService.newTextButton()
      .setText('Finish Setup')
      .setOnClickAction(finishAction)
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED));
    
    section.addWidget(CardService.newTextButton()
      .setText('Skip & Use Defaults')
      .setOnClickAction(finishAction)
      .setTextButtonStyle(CardService.TextButtonStyle.TEXT));
    
    card.addSection(section);
    
    return card.build();
  }
  
  /**
   * Create completion card
   */
  function createCompletionCard(): GoogleAppsScript.Card_Service.Card {
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('All Set! 🎉')
        .setSubtitle('Your AI assistant is ready'));
    
    const section = CardService.newCardSection();
    
    section.addWidget(CardService.newTextParagraph()
      .setText(
        'Congratulations! Your Gmail AI Assistant is now configured.\n\n' +
        'What\'s next:\n' +
        '• Click "Analyze Emails" to process your inbox\n' +
        '• Check the Settings tab to customize prompts\n' +
        '• Use Test Mode for safe experimentation\n\n' +
        'Happy emailing! 💌'
      ));
    
    const startAction = CardService.newAction()
      .setFunctionName('backToMain');
    
    section.addWidget(CardService.newTextButton()
      .setText('Go to Main Screen')
      .setOnClickAction(startAction)
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED));
    
    card.addSection(section);
    
    // Mark onboarding as complete
    updateOnboardingProgress({
      state: WelcomeState.COMPLETED,
      completedAt: new Date().toISOString()
    });
    
    return card.build();
  }
  
  /**
   * Start welcome flow action handler
   */
  export function startWelcomeFlow(): GoogleAppsScript.Card_Service.ActionResponse {
    updateOnboardingProgress({
      state: WelcomeState.API_KEY_SETUP
    });
    
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation()
        .updateCard(createApiKeySetupCard()))
      .build();
  }
  
  /**
   * Save API key from welcome flow
   */
  export function saveApiKeyFromWelcome(e: FormInputEvent): GoogleAppsScript.Card_Service.ActionResponse {
    const apiKey = e.formInput.apiKey;
    
    if (!apiKey) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('Please enter an API key'))
        .build();
    }
    
    const validation = Utils.validateApiKeyFormat(apiKey);
    if (!validation.isValid) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('❌ ' + validation.message))
        .build();
    }
    
    PropertiesService.getUserProperties().setProperty(Config.PROP_KEYS.API_KEY, apiKey);
    
    updateOnboardingProgress({
      state: WelcomeState.TEST_RUN,
      apiKeyConfigured: true
    });
    
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation()
        .updateCard(createTestRunCard()))
      .setNotification(CardService.newNotification()
        .setText('✅ API key saved successfully'))
      .build();
  }
  
  /**
   * Run welcome test analysis
   */
  export function runWelcomeTestAnalysis(): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      const apiKey = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.API_KEY);
      if (!apiKey) {
        throw new Error('API key not found');
      }
      
      // Enable test mode for safety
      TestMode.enableTestMode({ maxEmails: 1, verbose: true });
      
      const result = TestMode.runTestAnalysis(
        apiKey,
        Config.DEFAULT_CLASSIFICATION_PROMPT,
        Config.DEFAULT_RESPONSE_PROMPT
      );
      
      TestMode.disableTestMode();
      
      if (result.success && result.emailsProcessed > 0) {
        updateOnboardingProgress({
          state: WelcomeState.CUSTOMIZATION,
          testRunCompleted: true
        });
        
        const classification = result.classifications[0];
        
        return CardService.newActionResponseBuilder()
          .setNavigation(CardService.newNavigation()
            .updateCard(createCustomizationCard()))
          .setNotification(CardService.newNotification()
            .setText(`✅ Test successful! Email classified as: ${classification?.classification?.toUpperCase() || 'UNKNOWN'}`))
          .build();
      } else {
        throw new Error(result.errors[0] || 'Test failed');
      }
      
    } catch (error) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('❌ ' + Utils.logAndHandleError(error, 'Welcome test')))
        .build();
    }
  }
  
  /**
   * Finish welcome flow
   */
  export function finishWelcomeFlow(e: FormInputEvent): GoogleAppsScript.Card_Service.ActionResponse {
    // Save customization preferences if provided
    if (e.formInput) {
      if (e.formInput.darkMode === 'true') {
        DarkMode.toggleDarkMode();
      }
      
      if (e.formInput.autoCreateDrafts === 'true') {
        PropertiesService.getUserProperties().setProperty(Config.PROP_KEYS.autoCreateDrafts, 'true');
      }
      
      if (e.formInput.sensitivity) {
        PropertiesService.getUserProperties().setProperty(Config.PROP_KEYS.classificationSensitivity, e.formInput.sensitivity);
      }
    }
    
    updateOnboardingProgress({
      state: WelcomeState.COMPLETED,
      customizationDone: true,
      completedAt: new Date().toISOString()
    });
    
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation()
        .updateCard(createCompletionCard()))
      .build();
  }
}