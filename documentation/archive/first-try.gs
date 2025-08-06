/******************************************************
 * Gmail Support-Triage & Auto-Reply Add-on           *
 * Single-file fork of Google’s “Sentiment Analysis”  *
 * Uses Gemini 2.5 Flash Developer API (API-key)      *
 * ASCII-only; no template literals.                  *
 ******************************************************/

/* ---------- CONSTANTS ---------- */
const LABEL_SUPPORT     = 'Support Request';
const LABEL_NOT_SUPPORT = 'Not Support Request';

/* ---------- SAFETY CONFIG ---------- */
const SafetyConfig = {
  isDevelopmentMode: PropertiesService.getUserProperties().getProperty('DEV_MODE') !== 'false',
  
  enableProductionMode: function(confirmation) {
    if (confirmation === 'I UNDERSTAND THIS WILL SEND REAL EMAILS') {
      this.isDevelopmentMode = false;
      console.log('PRODUCTION MODE ENABLED - EMAILS WILL BE SENT!');
    }
  },
  
  isDevMode: function() {
    return this.isDevelopmentMode;
  }
};

const DEFAULT_PROMPT_1 = [
  'You are an email triage assistant.',
  'Return exactly one word:',
  '  - support : if the email is a customer support request',
  '  - not     : for anything else.',
  '---------- EMAIL START ----------'
].join('\n');

const DEFAULT_PROMPT_2 = [
  'You are a customer support agent.',
  'Draft a friendly, concise reply that resolves the customer issue.',
  '---------- ORIGINAL EMAIL ----------'
].join('\n');

/* ---------- ENTRY POINTS ---------- */
function onHomepage() {
  return buildHomepageCard();
}

function runAnalysis(e) {
  try {
    // Log the entire event object for debugging
    console.log('Event object:', JSON.stringify(e));
    
    // Use e.formInput (singular) for direct access
    const formInput = e.formInput || {};
    const formInputs = e.formInputs || {};
    
    // Try multiple ways to get the API key
    let apiKey = formInput.apiKey || 
                 (formInputs.apiKey && formInputs.apiKey[0]) ||
                 getFormValue(formInputs, 'apiKey');
    
    // Fallback to saved API key if form input is empty
    if (!apiKey || apiKey.trim() === '') {
      console.log('No API key in form, trying saved properties...');
      apiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
    }
    
    // Get other form values using the same approach
    const mode      = formInput.mode || getFormValue(formInputs, 'mode', 'label');
    const autoReply = formInput.autoReply === 'send' || !!formInputs.autoReply;
    
    // Sanitize prompts to prevent injection attacks
    function sanitizePrompt(prompt) {
      return (prompt || '')
        .substring(0, 5000)  // Limit length
        .replace(/\{\{.*?\}\}/g, '') // Remove template patterns
        .replace(/<%.*?%>/g, '');    // Remove server-side patterns
    }
    
    const prompt1   = sanitizePrompt(formInput.prompt1 || getFormValue(formInputs, 'prompt1', DEFAULT_PROMPT_1));
    const prompt2   = sanitizePrompt(formInput.prompt2 || getFormValue(formInputs, 'prompt2', DEFAULT_PROMPT_2));

    if (!apiKey || apiKey.trim() === '') {
      console.error('API Key validation failed. formInput:', JSON.stringify(formInput), 'formInputs:', JSON.stringify(formInputs));
      throw new Error('Missing Gemini API key. Please enter your API key in the form.');
    }
    PropertiesService.getUserProperties()
                     .setProperty('GEMINI_API_KEY', apiKey);

    const supportLabel = getOrCreateLabel(LABEL_SUPPORT);
    const notLabel     = getOrCreateLabel(LABEL_NOT_SUPPORT);

    /* Fetch inbox threads: last 50 + all unread */
    const recent  = GmailApp.search('in:inbox', 0, 50);
    const unread  = GmailApp.search('in:inbox is:unread');
    
    // Fix thread deduplication - dedupe by thread ID
    const threadMap = new Map();
    recent.forEach(thread => threadMap.set(thread.getId(), thread));
    unread.forEach(thread => threadMap.set(thread.getId(), thread));
    const threads = Array.from(threadMap.values());

    let scanned = 0; supports = 0; drafted = 0; sent = 0;
    
    // Rate limiting configuration
    const BATCH_SIZE = 10;
    const DELAY_MS = 1000;

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      try {
        const messages = thread.getMessages();
        if (!messages || messages.length === 0) {
          console.warn('Thread has no messages:', thread.getId());
          return;
        }
        const msg = messages[messages.length - 1]; // newest
        scanned++;

        let body = msg.getPlainBody().trim();
        if (!body) {
          // Fallback to HTML body with tags stripped
          const htmlBody = msg.getBody();
          body = htmlBody.replace(/<[^>]*>/g, ' ').trim();
        }
        if (!body) {
          console.warn('Email has no content:', msg.getId());
          return;
        }
      const clsRaw = callGemini(apiKey,
        prompt1 + '\n' + body + '\n---------- EMAIL END ----------');
      const cls    = (clsRaw || '').toLowerCase();

      if (cls === 'support' || cls.startsWith('support')) {
        supports++;
        try {
          thread.addLabel(supportLabel).removeLabel(notLabel);
        } catch (labelError) {
          console.error('Failed to apply labels to thread:', thread.getId(), labelError);
          // Continue processing
        }

        if (mode === 'draft' || autoReply) {
          const replyBody = callGemini(apiKey,
            prompt2 + '\n' + body + '\n---------- END ----------');

          if (autoReply) {
            if (SafetyConfig.isDevMode()) {
              console.log('DEV MODE: Would send reply to thread:', thread.getFirstMessageSubject());
              console.log('Reply body:', replyBody);
              drafted++; // Count as draft in dev mode
            } else {
              const htmlBody = replyBody.replace(/\n/g, '<br>');
            thread.reply(replyBody, { htmlBody: htmlBody });
              sent++;
            }
          } else {
            if (SafetyConfig.isDevMode()) {
              console.log('DEV MODE: Would create draft for thread:', thread.getFirstMessageSubject());
              console.log('Draft body:', replyBody);
            }
            const htmlBody = replyBody.replace(/\n/g, '<br>');
            thread.createDraftReply(replyBody, { htmlBody: htmlBody });
            drafted++;
          }
        }
      } else {
        try {
          thread.addLabel(notLabel).removeLabel(supportLabel);
        } catch (labelError) {
          console.error('Failed to apply labels to thread:', thread.getId(), labelError);
        }
      }
      } catch (threadError) {
        console.error('Error processing thread:', thread.getId(), threadError);
        // Continue with next thread
      }
      
      // Add delay between batches to avoid rate limits
      if ((i + 1) % BATCH_SIZE === 0 && i + 1 < threads.length) {
        console.log('Rate limiting: processed', i + 1, 'threads, pausing...');
        Utilities.sleep(DELAY_MS);
      }
    }

    const toast = 'Scanned ' + scanned +
                  ' | Support ' + supports +
                  ' | Drafts ' + drafted +
                  ' | Sent ' + sent;
    return buildActionResponse(toast);

  } catch (err) {
    console.error(err);
    return buildActionResponse('Error: ' + err.message);
  }
}

/* ---------- UI BUILD ---------- */
function buildHomepageCard() {
  const savedKey = PropertiesService.getUserProperties()
                   .getProperty('GEMINI_API_KEY') || '';

  // Development mode warning section
  const devModeSection = CardService.newCardSection();
  if (SafetyConfig.isDevMode()) {
    devModeSection.addWidget(CardService.newDecoratedText()
      .setText('DEVELOPMENT MODE ACTIVE')
      .setBottomLabel('Emails will NOT be sent. Labels will still be applied.')
      .setIcon(CardService.Icon.INFO));
  }

  const s1 = CardService.newCardSection()
      .addWidget(CardService.newTextInput()
        .setFieldName('apiKey')
        .setTitle('Gemini API key')
        .setValue(savedKey)
        .setMultiline(false));

  const radios = CardService.newSelectionInput()
      .setFieldName('mode')
      .setType(CardService.SelectionInputType.RADIO_BUTTON)
      .addItem('Label only',   'label', true)
      .addItem('Create drafts','draft', false);

  const s2 = CardService.newCardSection()
      .addWidget(radios)
      .addWidget(CardService.newSelectionInput()
        .setFieldName('autoReply')
        .setType(CardService.SelectionInputType.CHECK_BOX)
        .addItem('Danger Auto Reply (send immediately)', 'send', false));

  const s3 = CardService.newCardSection()
      .addWidget(CardService.newTextInput()
        .setFieldName('prompt1')
        .setTitle('Prompt 1 – classify support')
        .setValue(DEFAULT_PROMPT_1)
        .setMultiline(true))
      .addWidget(CardService.newTextInput()
        .setFieldName('prompt2')
        .setTitle('Prompt 2 – draft response')
        .setValue(DEFAULT_PROMPT_2)
        .setMultiline(true));

  const runBtn = CardService.newTextButton()
      .setText('Analyse & Go')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('runAnalysis')
        .setLoadIndicator(CardService.LoadIndicator.SPINNER));

  const cardBuilder = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('Support-Triage & Auto-Reply'));
  
  // Add dev mode warning if active
  if (SafetyConfig.isDevMode()) {
    cardBuilder.addSection(devModeSection);
  }
  
  return cardBuilder
      .addSection(s1)
      .addSection(s2)
      .addSection(s3)
      .setFixedFooter(CardService.newFixedFooter().setPrimaryButton(runBtn))
      .build();
}

function buildActionResponse(text) {
  return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(text))
      .build();
}

/* ---------- HELPERS ---------- */
function getOrCreateLabel(name) {
  try {
    const existing = GmailApp.getUserLabelByName(name);
    if (existing) return existing;
    
    // Validate label name (Gmail constraints)
    if (!name || name.length > 225 || name.includes('/')) {
      throw new Error('Invalid label name: ' + name);
    }
    
    return GmailApp.createLabel(name);
  } catch (e) {
    console.error('Failed to create label:', name, e);
    throw new Error('Cannot create label "' + name + '": ' + e.message);
  }
}

function getFormValue(formInputs, field, fallback) {
  const obj = formInputs[field];
  if (obj) {
    // Handle array format (most common)
    if (Array.isArray(obj) && obj.length > 0) {
      return obj[0];
    }
    // Handle object with stringValues
    if (obj.stringValues && obj.stringValues.length) {
      return obj.stringValues[0];
    }
    // Handle object with stringInputs
    if (obj.stringInputs && obj.stringInputs.length && obj.stringInputs[0].value) {
      return obj.stringInputs[0].value;
    }
  }
  return fallback || '';
}

function callGemini(apiKey, prompt) {
  // Validate API key format
  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 30) {
    throw new Error('Invalid API key format');
  }
  
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              'gemini-2.5-flash:generateContent';

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3 }
  };

  const res  = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-goog-api-key': apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const data = JSON.parse(res.getContentText());
  if (!data.candidates || data.candidates.length === 0) {
    const errorMessage = data.error?.message || 
                        data.error?.details?.[0]?.reason || 
                        'Gemini API returned no candidates';
    console.error('Gemini API Error:', JSON.stringify(data));
    throw new Error(errorMessage);
  }
  return (data.candidates[0].content.parts[0].text || '').trim();
}
