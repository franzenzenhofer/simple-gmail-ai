/**
 * Contextual Actions Module
 * Per-message processing and contextual card actions
 */

namespace ContextualActions {
  
  // Contextual action types
  export interface ContextualAction {
    id: string;
    label: string;
    icon?: string;
    description?: string;
    handler: (context: MessageContext) => GoogleAppsScript.Card_Service.ActionResponse;
  }
  
  // Message context for actions
  export interface MessageContext {
    messageId: string;
    threadId: string;
    subject: string;
    from: string;
    to: string;
    body: string;
    labels: string[];
    attachments: number;
    isUnread: boolean;
    isDraft: boolean;
  }
  
  // Analysis result for message
  export interface MessageAnalysis {
    classification: string; // Dynamic label from AI/docs
    confidence: number;
    sentiment?: 'positive' | 'neutral' | 'negative' | 'urgent';
    suggestedActions: string[];
    keyPhrases?: string[];
    intent?: string;
  }
  
  /**
   * Get available actions for a message
   */
  export function getAvailableActions(context: MessageContext): ContextualAction[] {
    const actions: ContextualAction[] = [];
    
    // Always available actions
    actions.push(analyzeMessageAction);
    actions.push(classifyAndLabelAction);
    
    // Conditional actions based on context
    // Check if any label has actions configured in docs
    const docsPrompts = DocsPromptEditor.getPromptForLabels(context.labels);
    if (docsPrompts && docsPrompts.responsePrompt) {
      actions.push(generateReplyAction);
      actions.push(escalateAction);
    }
    
    if (!context.isDraft) {
      actions.push(createDraftAction);
    }
    
    if (context.attachments > 0) {
      actions.push(analyzeAttachmentsAction);
    }
    
    // Advanced actions
    actions.push(extractEntitiesAction);
    actions.push(suggestLabelsAction);
    
    return actions;
  }
  
  /**
   * Analyze single message action
   */
  const analyzeMessageAction: ContextualAction = {
    id: 'analyze_message',
    label: 'Analyze Message',
    icon: 'https://www.gstatic.com/images/icons/material/system/2x/analytics_black_48dp.png',
    description: 'Perform deep analysis of this message',
    handler: (context) => {
      const apiKey = Utils.getApiKey();
      if (!apiKey) {
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('❌ API key not configured'))
          .build();
      }
      
      const analysis = analyzeMessage(apiKey, context);
      
      // Create result card
      const card = CardService.newCardBuilder()
        .setHeader(CardService.newCardHeader()
          .setTitle('Message Analysis')
          .setSubtitle(context.subject));
      
      const section = CardService.newCardSection();
      
      section.addWidget(CardService.newTextParagraph()
        .setText(
          `📊 Classification: ${analysis.classification.toUpperCase()}\n` +
          `🎯 Confidence: ${Math.round(analysis.confidence * 100)}%\n` +
          `💭 Sentiment: ${analysis.sentiment || 'neutral'}\n` +
          `🔍 Intent: ${analysis.intent || 'unknown'}`
        ));
      
      if (analysis.keyPhrases && analysis.keyPhrases.length > 0) {
        section.addWidget(CardService.newTextParagraph()
          .setText('🔑 Key Phrases:\n• ' + analysis.keyPhrases.join('\n• ')));
      }
      
      if (analysis.suggestedActions.length > 0) {
        section.addWidget(CardService.newTextParagraph()
          .setText('💡 Suggested Actions:\n• ' + analysis.suggestedActions.join('\n• ')));
      }
      
      card.addSection(section);
      
      return CardService.newActionResponseBuilder()
        .setNavigation(CardService.newNavigation()
          .pushCard(card.build()))
        .build();
    }
  };
  
  /**
   * Classify and label action
   */
  const classifyAndLabelAction: ContextualAction = {
    id: 'classify_label',
    label: 'Classify & Label',
    icon: 'https://www.gstatic.com/images/icons/material/system/2x/label_black_48dp.png',
    description: 'Classify this message and apply appropriate labels',
    handler: (context) => {
      const apiKey = Utils.getApiKey();
      if (!apiKey) {
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('❌ API key not configured'))
          .build();
      }
      
      try {
        const thread = GmailApp.getThreadById(context.threadId);
        const analysis = analyzeMessage(apiKey, context);
        
        // Apply dynamic label from AI
        const labelToApply = analysis.classification || 'General';
        const dynamicLabel = GmailService.getOrCreateLabel(labelToApply);
        const processedLabel = GmailService.getOrCreateLabel(Config.LABELS.AI_PROCESSED);
        
        thread.addLabel(dynamicLabel);
        thread.addLabel(processedLabel);
        
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText(`✅ Classified as ${labelToApply.toUpperCase()} and labeled`))
          .build();
          
      } catch (error) {
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('❌ ' + Utils.logAndHandleError(error, 'Classify and label')))
          .build();
      }
    }
  };
  
  /**
   * Generate reply action
   */
  const generateReplyAction: ContextualAction = {
    id: 'generate_reply',
    label: 'Generate Reply',
    icon: 'https://www.gstatic.com/images/icons/material/system/2x/reply_black_48dp.png',
    description: 'Generate an AI-powered reply to this message',
    handler: (context) => {
      const apiKey = Utils.getApiKey();
      if (!apiKey) {
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('❌ API key not configured'))
          .build();
      }
      
      try {
        // Get response prompt from docs configuration
        const threadLabels = GmailApp.getThreadById(context.threadId).getLabels().map(l => l.getName());
        const docsPrompt = DocsPromptEditor.getPromptForLabels(threadLabels);
        const responsePrompt = docsPrompt?.responsePrompt || 'Generate a helpful, professional response to this email.';
        
        // Create secure prompt with injection protection
        const fullPrompt = PromptSanitizer.createReplyPrompt(
          responsePrompt,
          context.body
        );
        
        // Define JSON schema for reply
        const replySchema = {
          type: 'object',
          properties: {
            reply: { type: 'string' },
            tone: { type: 'string' },
            confidence: { type: 'number' }
          },
          required: ['reply']
        };
        
        const result = AI.callGemini(apiKey, fullPrompt, replySchema);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to generate reply');
        }
        
        // Parse JSON response
        let replyData: { reply: string; tone?: string; confidence?: number };
        if (typeof result.data === 'string') {
          replyData = JSON.parse(result.data);
        } else {
          replyData = result.data as { reply: string; tone?: string; confidence?: number };
        }
        
        // Create draft with formatted text
        const thread = GmailApp.getThreadById(context.threadId);
        const formattedReply = Utils.formatEmailText(replyData.reply);
        thread.createDraftReply(formattedReply);
        
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('✅ Draft reply created'))
          .build();
          
      } catch (error) {
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('❌ ' + Utils.logAndHandleError(error, 'Generate reply')))
          .build();
      }
    }
  };
  
  /**
   * Escalate action
   */
  const escalateAction: ContextualAction = {
    id: 'escalate',
    label: 'Escalate',
    icon: 'https://www.gstatic.com/images/icons/material/system/2x/priority_high_black_48dp.png',
    description: 'Mark for escalation to senior support',
    handler: (context) => {
      try {
        const thread = GmailApp.getThreadById(context.threadId);
        const escalationLabel = GmailService.getOrCreateLabel('Escalation Required');
        thread.addLabel(escalationLabel);
        
        // Could also send notification email to supervisor
        
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('⚠️ Marked for escalation'))
          .build();
          
      } catch (error) {
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('❌ ' + Utils.logAndHandleError(error, 'Escalate')))
          .build();
      }
    }
  };
  
  /**
   * Create draft action
   */
  const createDraftAction: ContextualAction = {
    id: 'create_draft',
    label: 'Create Draft',
    icon: 'https://www.gstatic.com/images/icons/material/system/2x/drafts_black_48dp.png',
    description: 'Create a draft reply',
    handler: (context) => {
      try {
        const thread = GmailApp.getThreadById(context.threadId);
        thread.createDraftReply('', {});
        
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('✅ Empty draft created'))
          .build();
          
      } catch (error) {
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('❌ ' + Utils.logAndHandleError(error, 'Create draft')))
          .build();
      }
    }
  };
  
  /**
   * Analyze attachments action
   */
  const analyzeAttachmentsAction: ContextualAction = {
    id: 'analyze_attachments',
    label: 'Analyze Attachments',
    icon: 'https://www.gstatic.com/images/icons/material/system/2x/attach_file_black_48dp.png',
    description: 'Analyze message attachments',
    handler: (context) => {
      // Simplified - would need actual attachment analysis
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText(`📎 ${context.attachments} attachment(s) detected`))
        .build();
    }
  };
  
  /**
   * Extract entities action
   */
  const extractEntitiesAction: ContextualAction = {
    id: 'extract_entities',
    label: 'Extract Entities',
    icon: 'https://www.gstatic.com/images/icons/material/system/2x/category_black_48dp.png',
    description: 'Extract key entities from message',
    handler: (context) => {
      const apiKey = Utils.getApiKey();
      if (!apiKey) {
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('❌ API key not configured'))
          .build();
      }
      
      try {
        const entities = extractEntities(apiKey, context.body);
        
        if (entities.length === 0) {
          return CardService.newActionResponseBuilder()
            .setNotification(CardService.newNotification()
              .setText('🔍 No entities found'))
            .build();
        }
        
        // Create a card to display the entities
        const card = CardService.newCardBuilder()
          .setHeader(CardService.newCardHeader()
            .setTitle('Extracted Entities')
            .setSubtitle(`Found ${entities.length} entities`));
        
        const section = CardService.newCardSection();
        
        // Group entities by type if we have type information
        const entityList = entities.slice(0, 20); // Limit to 20 for UI
        section.addWidget(CardService.newTextParagraph()
          .setText('🔍 Entities found:\n• ' + entityList.join('\n• ')));
        
        card.addSection(section);
        
        return CardService.newActionResponseBuilder()
          .setNavigation(CardService.newNavigation()
            .pushCard(card.build()))
          .build();
          
      } catch (error) {
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('❌ ' + Utils.logAndHandleError(error, 'Extract entities')))
          .build();
      }
    }
  };
  
  /**
   * Suggest labels action
   */
  const suggestLabelsAction: ContextualAction = {
    id: 'suggest_labels',
    label: 'Suggest Labels',
    icon: 'https://www.gstatic.com/images/icons/material/system/2x/new_label_black_48dp.png',
    description: 'Suggest additional labels for this message',
    handler: (context) => {
      const apiKey = Utils.getApiKey();
      if (!apiKey) {
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('❌ API key not configured'))
          .build();
      }
      
      try {
        const suggestions = suggestLabels(apiKey, context);
        
        if (suggestions.length === 0) {
          return CardService.newActionResponseBuilder()
            .setNotification(CardService.newNotification()
              .setText('🏷️ No additional labels suggested'))
            .build();
        }
        
        // Create a card with clickable label buttons
        const card = CardService.newCardBuilder()
          .setHeader(CardService.newCardHeader()
            .setTitle('Suggested Labels')
            .setSubtitle('Click to apply'));
        
        const section = CardService.newCardSection();
        
        suggestions.forEach(label => {
          section.addWidget(CardService.newTextButton()
            .setText('🏷️ ' + label)
            .setOnClickAction(CardService.newAction()
              .setFunctionName('applyLabelToThread')
              .setParameters({
                threadId: context.threadId,
                labelName: label
              })));
        });
        
        card.addSection(section);
        
        return CardService.newActionResponseBuilder()
          .setNavigation(CardService.newNavigation()
            .pushCard(card.build()))
          .build();
          
      } catch (error) {
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText('❌ ' + Utils.logAndHandleError(error, 'Suggest labels')))
          .build();
      }
    }
  };
  
  /**
   * Analyze a single message
   */
  function analyzeMessage(apiKey: string, context: MessageContext): MessageAnalysis {
    try {
      // Define JSON schema for structured response
      const analysisSchema = {
        type: 'object',
        properties: {
          classification: { type: 'string' },
          confidence: { type: 'number' },
          sentiment: { 
            type: 'string',
            enum: ['positive', 'neutral', 'negative', 'urgent']
          },
          suggestedActions: {
            type: 'array',
            items: { type: 'string' }
          },
          keyPhrases: {
            type: 'array',
            items: { type: 'string' }
          },
          intent: { type: 'string' }
        },
        required: ['classification', 'confidence', 'sentiment', 'suggestedActions']
      };
      
      const prompt = `Analyze this email and provide a detailed analysis:

Email Details:
Subject: ${context.subject}
From: ${context.from}
Body: ${context.body}

Provide:
1. Classification (what type of email this is)
2. Confidence score (0-1)
3. Sentiment (positive/neutral/negative/urgent)
4. Intent of the sender
5. Key phrases (important terms or concepts)
6. Suggested actions (what should be done with this email)`;
      
      const result = AI.callGemini(apiKey, prompt, analysisSchema);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to analyze message');
      }
      
      // Parse the JSON response
      let analysisData: MessageAnalysis;
      if (typeof result.data === 'string') {
        analysisData = JSON.parse(result.data);
      } else {
        analysisData = result.data as MessageAnalysis;
      }
      
      // Ensure all required fields are present
      return {
        classification: analysisData.classification || 'unknown',
        confidence: analysisData.confidence || 0.5,
        sentiment: analysisData.sentiment || 'neutral',
        suggestedActions: analysisData.suggestedActions || [],
        keyPhrases: analysisData.keyPhrases || [],
        intent: analysisData.intent || 'unknown'
      };
      
    } catch (error) {
      AppLogger.error('Failed to analyze message', { error: Utils.handleError(error) });
      // Return fallback analysis
      return {
        classification: 'unknown',
        confidence: 0,
        sentiment: 'neutral',
        suggestedActions: ['Manual review required'],
        keyPhrases: [],
        intent: 'unknown'
      };
    }
  }
  
  /**
   * Extract entities from text
   */
  function extractEntities(apiKey: string, text: string): string[] {
    try {
      // Define JSON schema for entity extraction
      const entitySchema = {
        type: 'object',
        properties: {
          entities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                type: { type: 'string' }
              },
              required: ['text', 'type']
            }
          }
        },
        required: ['entities']
      };
      
      const prompt = `Extract all important entities from this text. Include:
- People names
- Company/Organization names
- Product names
- Email addresses
- URLs
- Phone numbers
- Dates
- Monetary amounts
- Technical terms

Text: ${text}

Return each entity with its type.`;
      
      const result = AI.callGemini(apiKey, prompt, entitySchema);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to extract entities');
      }
      
      // Parse the JSON response
      let entityData: { entities: Array<{ text: string; type: string }> };
      if (typeof result.data === 'string') {
        entityData = JSON.parse(result.data);
      } else {
        entityData = result.data as { entities: Array<{ text: string; type: string }> };
      }
      
      // Extract unique entity texts
      const uniqueEntities = [...new Set(entityData.entities.map(e => e.text))];
      return uniqueEntities;
      
    } catch (error) {
      AppLogger.warn('Failed to extract entities with AI, falling back to regex', { 
        error: Utils.handleError(error) 
      });
      
      // Fallback to regex-based extraction
      const entities: string[] = [];
      
      // Extract email addresses
      const emails = text.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/g) || [];
      entities.push(...emails);
      
      // Extract URLs
      const urls = text.match(/https?:\/\/[^\s]+/g) || [];
      entities.push(...urls);
      
      // Extract phone numbers
      const phones = text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || [];
      entities.push(...phones);
      
      return [...new Set(entities)];
    }
  }
  
  /**
   * Suggest labels for a message
   */
  function suggestLabels(apiKey: string, context: MessageContext): string[] {
    try {
      // Define JSON schema for label suggestions
      const labelSchema = {
        type: 'object',
        properties: {
          labels: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 5
          },
          reasoning: { type: 'string' }
        },
        required: ['labels']
      };
      
      // Get existing labels from docs configuration if available
      const docsPrompts = DocsPromptEditor.hasCompiledPrompts() ? 
        'Consider these existing labels: ' + context.labels.join(', ') : '';
      
      const prompt = `Suggest up to 5 appropriate Gmail labels for this email based on its content.
${docsPrompts}

Email:
Subject: ${context.subject}
From: ${context.from}
Body: ${context.body}

Suggest specific, actionable labels that would help organize this email. Examples:
- Priority/Urgent
- Bug Report
- Feature Request
- Customer Complaint
- Billing Issue
- Technical Support
- Follow-up Required
- Positive Feedback`;
      
      const result = AI.callGemini(apiKey, prompt, labelSchema);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to suggest labels');
      }
      
      // Parse the JSON response
      let labelData: { labels: string[]; reasoning?: string };
      if (typeof result.data === 'string') {
        labelData = JSON.parse(result.data);
      } else {
        labelData = result.data as { labels: string[]; reasoning?: string };
      }
      
      return labelData.labels || [];
      
    } catch (error) {
      AppLogger.warn('Failed to suggest labels with AI, falling back to keywords', { 
        error: Utils.handleError(error) 
      });
      
      // Fallback to keyword-based suggestions
      const suggestions: string[] = [];
      const keywords = {
        'urgent': ['Priority', 'Urgent'],
        'bug': ['Bug Report', 'Technical Issue'],
        'feature': ['Feature Request', 'Enhancement'],
        'billing': ['Billing', 'Payment'],
        'complaint': ['Complaint', 'Negative Feedback'],
        'praise': ['Positive Feedback', 'Testimonial'],
        'help': ['Support Request', 'Needs Assistance'],
        'error': ['Error Report', 'System Issue']
      };
      
      const lowerBody = (context.subject + ' ' + context.body).toLowerCase();
      
      Object.entries(keywords).forEach(([keyword, labels]) => {
        if (lowerBody.includes(keyword)) {
          suggestions.push(...labels);
        }
      });
      
      return [...new Set(suggestions)].slice(0, 5);
    }
  }
  
  /**
   * Create contextual actions card for a message
   */
  export function createContextualActionsCard(e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.Card {
    const accessToken = e.gmail?.accessToken || '';
    const messageId = e.gmail?.messageId || '';
    
    GmailApp.setCurrentMessageAccessToken(accessToken);
    
    const message = GmailApp.getMessageById(messageId);
    const thread = message.getThread();
    
    const context: MessageContext = {
      messageId: message.getId(),
      threadId: thread.getId(),
      subject: message.getSubject(),
      from: message.getFrom(),
      to: message.getTo(),
      body: message.getPlainBody(),
      labels: thread.getLabels().map(l => l.getName()),
      attachments: message.getAttachments().length,
      isUnread: message.isUnread(),
      isDraft: message.isDraft()
    };
    
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle('Contextual Actions')
        .setSubtitle(context.subject));
    
    const section = CardService.newCardSection();
    
    // Get available actions
    const actions = getAvailableActions(context);
    
    actions.forEach(action => {
      const actionBuilder = CardService.newAction()
        .setFunctionName('executeContextualAction')
        .setParameters({
          actionId: action.id,
          messageId: context.messageId,
          threadId: context.threadId
        });
      
      const button = CardService.newTextButton()
        .setText(action.label)
        .setOnClickAction(actionBuilder);
      
      // Note: TextButton doesn't support icons directly
      // Would need to use DecoratedText for icon support
      
      section.addWidget(button);
    });
    
    card.addSection(section);
    
    return card.build();
  }
}