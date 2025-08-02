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
  isDevelopmentMode: true,
  
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
    const prompt1   = formInput.prompt1 || getFormValue(formInputs, 'prompt1', DEFAULT_PROMPT_1);
    const prompt2   = formInput.prompt2 || getFormValue(formInputs, 'prompt2', DEFAULT_PROMPT_2);

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
    const threads = Array.from(new Set(recent.concat(unread)));

    let scanned = 0; supports = 0; drafted = 0; sent = 0;

    threads.forEach(function (thread) {
      const msg = thread.getMessages().pop(); // newest
      if (!msg) return;
      scanned++;

      const body   = msg.getPlainBody().trim();
      const clsRaw = callGemini(apiKey,
        prompt1 + '\n' + body + '\n---------- EMAIL END ----------');
      const cls    = (clsRaw || '').toLowerCase();

      if (cls.indexOf('support') === 0) {
        supports++;
        thread.addLabel(supportLabel).removeLabel(notLabel);

        if (mode === 'draft' || autoReply) {
          const replyBody = callGemini(apiKey,
            prompt2 + '\n' + body + '\n---------- END ----------');

          if (autoReply) {
            if (SafetyConfig.isDevMode()) {
              console.log('DEV MODE: Would send reply to thread:', thread.getFirstMessageSubject());
              console.log('Reply body:', replyBody);
              drafted++; // Count as draft in dev mode
            } else {
              thread.reply(replyBody, { htmlBody: replyBody });
              sent++;
            }
          } else {
            if (SafetyConfig.isDevMode()) {
              console.log('DEV MODE: Would create draft for thread:', thread.getFirstMessageSubject());
              console.log('Draft body:', replyBody);
            }
            thread.createDraftReply(replyBody, { htmlBody: replyBody });
            drafted++;
          }
        }
      } else {
        thread.addLabel(notLabel).removeLabel(supportLabel);
      }
    });

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
        .setFunctionName('runAnalysis'));

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
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
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
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              'gemini-2.5-flash:generateContent?key=' +
              encodeURIComponent(apiKey);

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3 }
  };

  const res  = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const data = JSON.parse(res.getContentText());
  if (!data.candidates) {
    throw new Error((data.error && data.error.message) ||
                     'Gemini API returned no candidates');
  }
  return (data.candidates[0].content.parts[0].text || '').trim();
}
