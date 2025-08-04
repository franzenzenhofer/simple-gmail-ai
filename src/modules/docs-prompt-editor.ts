/**
 * Docs Prompt Editor Module
 * Google Docs-based prompt management system
 */

namespace DocsPromptEditor {
  
  // Document configuration
  const PROMPT_DOC_ID_KEY = 'PROMPT_DOC_ID';
  const PROMPT_DOC_REV_KEY = 'PROMPT_DOC_REV';
  const COMPILED_PROMPTS_KEY = 'GOOGLE_DOCS_PROMPTS_RAW';
  const COMPILED_AT_KEY = 'PROMPTS_COMPILED_AT';
  
  // Validation results
  export interface ValidationResult {
    success: boolean;
    labelsCount: number;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    lastCompiled?: string;
  }
  
  export interface ValidationError {
    type: 'duplicate_labels' | 'missing_general' | 'invalid_order';
    message: string;
    details?: string[];
  }
  
  export interface ValidationWarning {
    type: 'missing_prompts' | 'orphan_prompts';
    message: string;
    details?: string[];
  }
  
  export interface ParsedDocument {
    overallPrompt: string;
    labels: LabelRule[];
    generalPrompt: string;
    actionPrompts: Record<string, string>;
  }
  
  export interface LabelRule {
    label: string;
    criteria: string;
    order: number;
    hasActions: boolean;
  }
  
  /**
   * Check if prompt document exists
   */
  export function hasPromptDocument(): boolean {
    const docId = PropertiesService.getUserProperties().getProperty(PROMPT_DOC_ID_KEY);
    return !!docId;
  }
  
  /**
   * Create initial prompt document with template
   */
  export function createPromptDocument(): string {
    try {
      const doc = DocumentApp.create('Gmail AI Prompts - ' + new Date().toISOString().split('T')[0]);
      const docId = doc.getId();
    
    // Clear default content and add template
    const body = doc.getBody();
    body.clear();
    body.appendParagraph('Gmail AI Prompts Configuration').setHeading(DocumentApp.ParagraphHeading.TITLE);
    
    // Add template content
    addTemplateContent(body);
    
    // Store document ID and initial revision
    const props = PropertiesService.getUserProperties();
    props.setProperty(PROMPT_DOC_ID_KEY, docId);
    
    // Get revision ID after creation - simplified since Drive.Revisions may not be available
    try {
      // For now, we'll use a simple timestamp as revision ID
      // This will be updated when the document is first validated
      props.setProperty(PROMPT_DOC_REV_KEY, Date.now().toString());
    } catch (e) {
      AppLogger.warn('Failed to get initial revision ID', { error: Utils.handleError(e) });
    }
    
    AppLogger.info('Created prompt document', { docId: docId });
    
    return docId;
    } catch (error) {
      AppLogger.error('Failed to create prompt document', { error: Utils.handleError(error) });
      throw new Error('Unable to create prompt document. Please check permissions and try again.');
    }
  }
  
  /**
   * Generate document template content (exported for testing)
   */
  export function generateDocumentTemplate(): string {
    return `# Gmail AI Prompts Configuration

## A · How to use this document

This document contains all AI prompts and labeling rules for the Gmail AI Assistant.

**Who should edit**: Operations lead, Customer Experience manager - never frontline agents.

**Versioning tips**: Use File ▸ Version history ▸ Name current version after each change.

**Golden rules**: 
- Use simple markdown format below
- Never rename section headings  
- Test changes before going live
- Add new labels by copying the format

## B · Label Registry

### Label: Support
**Priority:** 10
**Criteria:** mentions "help", "support", or "issue"
**Actions:** YES

### Label: Refund  
**Priority:** 20
**Criteria:** mentions "refund", "money back", or "chargeback"
**Actions:** YES

### Label: Bug
**Priority:** 30
**Criteria:** mentions "bug", "error", or "broken"  
**Actions:** YES

### Label: General
**Priority:** 9999
**Criteria:** (catch-all for everything else)
**Actions:** YES

## C.1 · Overall Prompt

You are an email classification assistant. Analyze the email content and classify it according to the labels defined in the Label Registry above.

Important:
- Review the Label Registry (Section B) for available labels and their criteria
- Return ONLY the exact label name from the registry
- Choose the most specific label that matches the email content
- If no specific label applies, return "General"
- The label you return will be created in Gmail if it doesn't exist

## C.2 · Prompt · Support

Draft a helpful and professional response to this support request.

Guidelines:
- Acknowledge their issue
- Provide clear next steps or initial guidance
- Be empathetic and solution-focused
- Keep it concise but thorough

## C.3 · Prompt · Refund

Draft a response about this refund request.

Guidelines:
- Show understanding of their situation
- Ask for order/transaction details if not provided
- Explain the refund process clearly
- Provide expected timeline
- Be solution-focused

## C.4 · Prompt · Bug

Draft a response about this bug report.

Guidelines:
- Thank them for reporting the issue
- Ask for specific reproduction steps
- Request technical details (browser, OS, error messages)
- Be technical but approachable
- Assure them we take bugs seriously

## D · Prompt · General

For general emails that don't match specific categories:

Action: Label only - no draft response needed.

This category catches all emails that don't require a specific support response.`;
  }
  
  /**
   * Add template content to document body
   */
  function addTemplateContent(body: GoogleAppsScript.Document.Body): void {
    // Section A
    body.appendParagraph('A · How to use this document').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph('This document contains all AI prompts and labeling rules for the Gmail AI Assistant.');
    body.appendParagraph('Who should edit: Operations lead, Customer Experience manager - never frontline agents.');
    body.appendParagraph('Versioning tips: Use File ▸ Version history ▸ Name current version after each change.');
    
    const rulesText = body.appendParagraph('Golden rules:');
    rulesText.appendText('\n• Use simple markdown format below');
    rulesText.appendText('\n• Never rename section headings');
    rulesText.appendText('\n• Test changes before going live');
    rulesText.appendText('\n• Add new labels by copying the format');
    
    // Section B - Label Registry (Markdown format)
    body.appendParagraph('B · Label Registry').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    
    // Support label
    body.appendParagraph('Label: Support').setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendParagraph('Priority: 10').setAttributes({[DocumentApp.Attribute.BOLD]: true});
    body.appendParagraph('Criteria: mentions "help", "support", or "issue"').setAttributes({[DocumentApp.Attribute.BOLD]: true});
    body.appendParagraph('Actions: YES').setAttributes({[DocumentApp.Attribute.BOLD]: true});
    body.appendParagraph(''); // spacing
    
    // Refund label
    body.appendParagraph('Label: Refund').setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendParagraph('Priority: 20').setAttributes({[DocumentApp.Attribute.BOLD]: true});
    body.appendParagraph('Criteria: mentions "refund", "money back", or "chargeback"').setAttributes({[DocumentApp.Attribute.BOLD]: true});
    body.appendParagraph('Actions: YES').setAttributes({[DocumentApp.Attribute.BOLD]: true});
    body.appendParagraph(''); // spacing
    
    // Bug label
    body.appendParagraph('Label: Bug').setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendParagraph('Priority: 30').setAttributes({[DocumentApp.Attribute.BOLD]: true});
    body.appendParagraph('Criteria: mentions "bug", "error", or "broken"').setAttributes({[DocumentApp.Attribute.BOLD]: true});
    body.appendParagraph('Actions: YES').setAttributes({[DocumentApp.Attribute.BOLD]: true});
    body.appendParagraph(''); // spacing
    
    // General label
    body.appendParagraph('Label: General').setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendParagraph('Priority: 9999').setAttributes({[DocumentApp.Attribute.BOLD]: true});
    body.appendParagraph('Criteria: (catch-all for everything else)').setAttributes({[DocumentApp.Attribute.BOLD]: true});
    body.appendParagraph('Actions: YES').setAttributes({[DocumentApp.Attribute.BOLD]: true});
    body.appendParagraph(''); // spacing
    
    // Section C - Prompts
    body.appendParagraph('C.1 · Overall Prompt').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph('You are an email classification assistant. Analyze the email content and classify it according to the labels defined in the Label Registry above.\n\nImportant:\n- Review the Label Registry (Section B) for available labels and their criteria\n- Return ONLY the exact label name from the registry\n- Choose the most specific label that matches the email content\n- If no specific label applies, return "General"\n- The label you return will be created in Gmail if it doesn\'t exist');
    
    body.appendParagraph('C.2 · Prompt · Support').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph('Draft a helpful and professional response to this support request.\n\nGuidelines:\n- Acknowledge their issue\n- Provide clear next steps or initial guidance\n- Be empathetic and solution-focused\n- Keep it concise but thorough');
    
    body.appendParagraph('C.3 · Prompt · Refund').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph('Draft a response about this refund request.\n\nGuidelines:\n- Show understanding of their situation\n- Ask for order/transaction details if not provided\n- Explain the refund process clearly\n- Provide expected timeline\n- Be solution-focused');
    
    body.appendParagraph('C.4 · Prompt · Bug').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph('Draft a response about this bug report.\n\nGuidelines:\n- Thank them for reporting the issue\n- Ask for specific reproduction steps\n- Request technical details (browser, OS, error messages)\n- Be technical but approachable\n- Assure them we take bugs seriously');
    
    // Section D
    body.appendParagraph('D · Prompt · General').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph('For general emails that don\'t match specific categories:\n\nAction: Label only - no draft response needed.\n\nThis category catches all emails that don\'t require a specific support response.');
  }
  
  /**
   * Check if document has changed since last validation
   */
  export function hasDocumentChanged(): boolean {
    const docId = PropertiesService.getUserProperties().getProperty(PROMPT_DOC_ID_KEY);
    const cachedRev = PropertiesService.getUserProperties().getProperty(PROMPT_DOC_REV_KEY);
    
    if (!docId || !cachedRev) {
      return true;
    }
    
    try {
      // For now, use document's last modified time as a simple change detection
      const lastModified = DriveApp.getFileById(docId).getLastUpdated().getTime().toString();
      return lastModified !== cachedRev;
    } catch (e) {
      AppLogger.warn('Failed to check document changes', { error: Utils.handleError(e) });
      return true;
    }
  }
  
  /**
   * Parse and validate the prompt document
   */
  export function validateDocument(): ValidationResult {
    const docId = PropertiesService.getUserProperties().getProperty(PROMPT_DOC_ID_KEY);
    
    if (!docId) {
      return {
        success: false,
        labelsCount: 0,
        errors: [{ type: 'missing_general', message: 'No prompt document found' }],
        warnings: []
      };
    }
    
    try {
      const doc = DocumentApp.openById(docId);
      const parsed = parseDocument(doc);
      const validation = validateParsedDocument(parsed);
      
      // Update revision tracking
      try {
        const lastModified = DriveApp.getFileById(docId).getLastUpdated().getTime().toString();
        PropertiesService.getUserProperties().setProperty(PROMPT_DOC_REV_KEY, lastModified);
      } catch (e) {
        AppLogger.warn('Failed to update revision tracking', { error: Utils.handleError(e) });
      }
      
      // Store parsed data if valid
      if (validation.success) {
        PropertiesService.getUserProperties().setProperty(
          COMPILED_PROMPTS_KEY,
          JSON.stringify(parsed)
        );
      }
      
      // Add compilation timestamp to result
      const lastCompiled = PropertiesService.getUserProperties().getProperty(COMPILED_AT_KEY);
      validation.lastCompiled = lastCompiled || undefined;
      
      return validation;
      
    } catch (e) {
      AppLogger.error('Failed to validate document', { error: Utils.handleError(e) });
      return {
        success: false,
        labelsCount: 0,
        errors: [{ type: 'missing_general', message: 'Failed to read document: ' + Utils.handleError(e) }],
        warnings: []
      };
    }
  }
  
  /**
   * Parse document content into structured data
   */
  function parseDocument(doc: GoogleAppsScript.Document.Document): ParsedDocument {
    const body = doc.getBody();
    const paragraphs = body.getParagraphs();
    
    const result: ParsedDocument = {
      overallPrompt: '',
      labels: [],
      generalPrompt: '',
      actionPrompts: {}
    };
    
    let currentSection = '';
    let currentPromptLabel = '';
    let currentLabel = '';
    let currentLabelData: {
      label: string;
      priority?: number;
      criteria?: string;
      actions?: boolean;
    } = {
      label: ''
    };
    
    // Parse markdown-style labels from Section B
    // No longer using tables - parse markdown format instead
    
    // Parse headings and content
    for (const paragraph of paragraphs) {
      const heading = paragraph.getHeading();
      const text = paragraph.getText().trim();
      
      if (heading === DocumentApp.ParagraphHeading.HEADING1) {
        if (text.includes('D · Prompt · General')) {
          currentSection = 'general';
        } else if (text.includes('B · Label Registry')) {
          currentSection = 'labels';
        }
      } else if (heading === DocumentApp.ParagraphHeading.HEADING2) {
        if (text.includes('C.1 · Overall Prompt')) {
          currentSection = 'overall';
        } else if (text.includes('C.') && text.includes('· Prompt ·')) {
          const match = text.match(/C\.\d+ · Prompt · (.+)/);
          if (match && match[1]) {
            currentPromptLabel = match[1].trim();
            currentSection = 'action';
          }
        }
      } else if (heading === DocumentApp.ParagraphHeading.HEADING3) {
        // Handle markdown-style label definitions: "Label: Support"
        if (text.startsWith('Label: ')) {
          // Save previous label if it exists
          if (currentLabelData.label) {
            result.labels.push({
              label: currentLabelData.label,
              criteria: currentLabelData.criteria || '',
              order: currentLabelData.priority || 9999,
              hasActions: currentLabelData.actions || false
            });
          }
          
          // Start new label
          currentLabel = text.replace('Label: ', '').trim();
          currentLabelData = {
            label: currentLabel
          };
          currentSection = 'label_data';
        }
      } else if (text && currentSection) {
        // Capture content based on current section
        if (currentSection === 'overall' && text.length > 10) {
          result.overallPrompt = text;
        } else if (currentSection === 'general' && text.length > 10) {
          result.generalPrompt = text;
        } else if (currentSection === 'action' && currentPromptLabel && text.length > 10) {
          result.actionPrompts[currentPromptLabel] = text;
        } else if (currentSection === 'label_data') {
          // Parse label properties in markdown format
          if (text.startsWith('Priority: ')) {
            const priorityText = text.replace('Priority: ', '').trim();
            currentLabelData.priority = parseInt(priorityText) || 9999;
          } else if (text.startsWith('Criteria: ')) {
            currentLabelData.criteria = text.replace('Criteria: ', '').trim();
          } else if (text.startsWith('Actions: ')) {
            const actionsText = text.replace('Actions: ', '').trim();
            currentLabelData.actions = actionsText.toUpperCase() === 'YES';
          }
        }
      }
    }
    
    // Don't forget to save the last label
    if (currentLabelData.label) {
      result.labels.push({
        label: currentLabelData.label,
        criteria: currentLabelData.criteria || '',
        order: currentLabelData.priority || 9999,
        hasActions: currentLabelData.actions || false
      });
    }
    
    return result;
  }
  
  /**
   * Validate parsed document structure
   */
  function validateParsedDocument(parsed: ParsedDocument): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check for duplicate labels
    const labelCounts = new Map<string, number>();
    parsed.labels.forEach(rule => {
      labelCounts.set(rule.label, (labelCounts.get(rule.label) || 0) + 1);
    });
    
    const duplicates = Array.from(labelCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([label, _]) => label);
    
    if (duplicates.length > 0) {
      errors.push({
        type: 'duplicate_labels',
        message: 'Duplicate labels found',
        details: duplicates
      });
    }
    
    // Check for General label
    const hasGeneral = parsed.labels.some(rule => rule.label === 'General');
    if (!hasGeneral) {
      errors.push({
        type: 'missing_general',
        message: 'Missing required "General" label in registry'
      });
    }
    
    // Check for invalid order values
    const invalidOrders = parsed.labels
      .filter(rule => isNaN(rule.order) || rule.order < 0)
      .map(rule => rule.label);
    
    if (invalidOrders.length > 0) {
      errors.push({
        type: 'invalid_order',
        message: 'Invalid order values',
        details: invalidOrders
      });
    }
    
    // Check for missing prompts
    const labelsWithActions = parsed.labels.filter(rule => rule.hasActions && rule.label !== 'General');
    const missingPrompts = labelsWithActions
      .filter(rule => !parsed.actionPrompts[rule.label])
      .map(rule => rule.label);
    
    if (missingPrompts.length > 0) {
      warnings.push({
        type: 'missing_prompts',
        message: 'Missing action prompts',
        details: missingPrompts
      });
    }
    
    // Check for orphan prompts
    const definedLabels = new Set(parsed.labels.map(rule => rule.label));
    const orphanPrompts = Object.keys(parsed.actionPrompts)
      .filter(label => !definedLabels.has(label));
    
    if (orphanPrompts.length > 0) {
      warnings.push({
        type: 'orphan_prompts',
        message: 'Orphan prompts without labels',
        details: orphanPrompts
      });
    }
    
    return {
      success: errors.length === 0,
      labelsCount: parsed.labels.length,
      errors,
      warnings
    };
  }
  
  /**
   * Check if compiled prompts exist
   */
  export function hasCompiledPrompts(): boolean {
    try {
      const props = PropertiesService.getUserProperties();
      const compiledStr = props.getProperty(COMPILED_PROMPTS_KEY);
      return compiledStr !== null && compiledStr.trim() !== '';
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Prompt configuration interface
   */
  export interface PromptConfig {
    label: string;
    classificationPrompt?: string;
    responsePrompt?: string;
  }
  
  /**
   * Compiled prompts interface
   */
  export interface CompiledPrompts {
    prompts: PromptConfig[];
  }
  
  /**
   * Get prompt configuration for specific labels
   */
  export function getPromptForLabels(threadLabels: string[]): PromptConfig | null {
    try {
      const props = PropertiesService.getUserProperties();
      const compiledStr = props.getProperty(COMPILED_PROMPTS_KEY);
      
      if (!compiledStr) {
        return null;
      }
      
      const parsed: ParsedDocument = JSON.parse(compiledStr);
      
      // Build prompt configurations from parsed document
      const prompts: PromptConfig[] = [];
      
      // Add label-specific prompts
      for (const labelRule of parsed.labels) {
        const config: PromptConfig = {
          label: labelRule.label
        };
        
        // Use overall prompt as classification prompt
        if (parsed.overallPrompt) {
          config.classificationPrompt = parsed.overallPrompt;
        }
        
        // Use action prompt as response prompt
        if (parsed.actionPrompts[labelRule.label]) {
          config.responsePrompt = parsed.actionPrompts[labelRule.label];
        }
        
        prompts.push(config);
      }
      
      // Find the most specific matching prompt
      // Priority: exact label match > default
      let bestMatch: PromptConfig | null = null;
      
      for (const prompt of prompts) {
        // Skip invalid prompts
        if (!prompt.label || (!prompt.classificationPrompt && !prompt.responsePrompt)) {
          continue;
        }
        
        // Check for exact match
        if (threadLabels.includes(prompt.label)) {
          return prompt;
        }
        
        // Check for default/General
        if ((prompt.label.toLowerCase() === 'default' || prompt.label === 'General') && !bestMatch) {
          bestMatch = prompt;
        }
      }
      
      return bestMatch;
    } catch (error) {
      AppLogger.warn('Failed to get prompts for labels', { error: String(error) });
      return null;
    }
  }
  
  /**
   * Compile and save prompts for runtime use
   */
  export function compileAndSavePrompts(): void {
    const validation = validateDocument();
    
    if (!validation.success) {
      throw new Error('Cannot compile - document has errors');
    }
    
    // Mark as compiled
    PropertiesService.getUserProperties().setProperty(
      COMPILED_AT_KEY,
      new Date().toISOString()
    );
    
    AppLogger.info('Prompts compiled successfully', {
      labelsCount: validation.labelsCount,
      compiledAt: new Date().toISOString()
    });
  }
  
  /**
   * Get document URL for editing
   */
  export function getDocumentUrl(): string | null {
    const docId = PropertiesService.getUserProperties().getProperty(PROMPT_DOC_ID_KEY);
    return docId ? `https://docs.google.com/document/d/${docId}/edit` : null;
  }
  
  /**
   * Get document title
   */
  export function getDocumentTitle(): string | null {
    const docId = PropertiesService.getUserProperties().getProperty(PROMPT_DOC_ID_KEY);
    
    if (!docId) {
      return null;
    }
    
    try {
      const doc = DocumentApp.openById(docId);
      return doc.getName();
    } catch (e) {
      AppLogger.warn('Failed to get document title', { error: Utils.handleError(e) });
      return 'Unknown Document';
    }
  }
  
  /**
   * Reset document (for testing/development)
   */
  export function resetDocument(): void {
    const props = PropertiesService.getUserProperties();
    props.deleteProperty(PROMPT_DOC_ID_KEY);
    props.deleteProperty(PROMPT_DOC_REV_KEY);
    props.deleteProperty(COMPILED_PROMPTS_KEY);
    props.deleteProperty(COMPILED_AT_KEY);
    
    AppLogger.info('Document configuration reset');
  }
}