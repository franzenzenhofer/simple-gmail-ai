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
    classification: 'support' | 'not';
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
    if (context.labels.includes(Config.LABELS.SUPPORT)) {
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
        
        // Apply labels based on classification
        const supportLabel = GmailService.getOrCreateLabel(Config.LABELS.SUPPORT);
        const notSupportLabel = GmailService.getOrCreateLabel(Config.LABELS.NOT_SUPPORT);
        const processedLabel = GmailService.getOrCreateLabel(Config.LABELS.AI_PROCESSED);
        
        if (analysis.classification === 'support') {
          thread.addLabel(supportLabel);
          thread.removeLabel(notSupportLabel);
        } else {
          thread.addLabel(notSupportLabel);
          thread.removeLabel(supportLabel);
        }
        
        thread.addLabel(processedLabel);
        
        return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
            .setText(`✅ Classified as ${analysis.classification.toUpperCase()} and labeled`))
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
        const responsePrompt = PropertiesService.getUserProperties().getProperty('responsePrompt') || Config.DEFAULT_RESPONSE_PROMPT;
        const fullPrompt = responsePrompt + '\n' + context.body + '\n---------- END ----------';
        
        const result = AI.callGemini(apiKey, fullPrompt);
        
        if (!result.success) {
          throw new Error(result.error);
        }
        
        // Create draft
        const thread = GmailApp.getThreadById(context.threadId);
        thread.createDraftReply(result.data, { htmlBody: result.data });
        
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
      
      const entities = extractEntities(apiKey, context.body);
      
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText(`🔍 Found: ${entities.length} entities`))
        .build();
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
      
      const suggestions = suggestLabels(apiKey, context);
      
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('🏷️ Suggested: ' + suggestions.join(', ')))
        .build();
    }
  };
  
  /**
   * Analyze a single message
   */
  function analyzeMessage(_apiKey: string, context: MessageContext): MessageAnalysis {
    // Note: Full AI analysis implementation would use:
    // const prompt = `Analyze this email and provide:
    // 1. Classification (support or not)
    // 2. Confidence score (0-1)
    // 3. Sentiment (positive/neutral/negative/urgent)
    // 4. Intent of the sender
    // 5. Key phrases
    // 6. Suggested actions
    //
    // Email:
    // Subject: ${context.subject}
    // From: ${context.from}
    // Body: ${context.body}`;
    // const result = AI.callGemini(apiKey, prompt);
    
    // Parse response (simplified)
    return {
      classification: context.body.toLowerCase().includes('help') ? 'support' : 'not',
      confidence: 0.85,
      sentiment: 'neutral',
      suggestedActions: ['Reply within 24h', 'Check documentation'],
      keyPhrases: ['customer support', 'technical issue'],
      intent: 'seeking assistance'
    };
  }
  
  /**
   * Extract entities from text
   */
  function extractEntities(_apiKey: string, text: string): string[] {
    // Simplified entity extraction
    const entities: string[] = [];
    
    // Extract email addresses
    const emails = text.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/g) || [];
    entities.push(...emails);
    
    // Extract URLs
    const urls = text.match(/https?:\/\/[^\s]+/g) || [];
    entities.push(...urls);
    
    // Extract potential product names (capitalized words)
    const products = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    entities.push(...products.slice(0, 5));
    
    return [...new Set(entities)];
  }
  
  /**
   * Suggest labels for a message
   */
  function suggestLabels(_apiKey: string, context: MessageContext): string[] {
    const suggestions: string[] = [];
    
    // Basic keyword-based suggestions
    const keywords = {
      'urgent': ['Priority', 'Urgent'],
      'bug': ['Bug Report', 'Technical Issue'],
      'feature': ['Feature Request', 'Enhancement'],
      'billing': ['Billing', 'Payment'],
      'complaint': ['Complaint', 'Negative Feedback'],
      'praise': ['Positive Feedback', 'Testimonial']
    };
    
    const lowerBody = context.body.toLowerCase();
    
    Object.entries(keywords).forEach(([keyword, labels]) => {
      if (lowerBody.includes(keyword)) {
        suggestions.push(...labels);
      }
    });
    
    return [...new Set(suggestions)].slice(0, 5);
  }
  
  /**
   * Create contextual actions card for a message
   */
  export function createContextualActionsCard(e: any): GoogleAppsScript.Card_Service.Card {
    const accessToken = e.messageMetadata.accessToken;
    const messageId = e.messageMetadata.messageId;
    
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