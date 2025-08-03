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
    type: 'duplicate_labels' | 'missing_undefined' | 'invalid_order';
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
    undefinedPrompt: string;
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
- One label per row in Section B
- Never rename section headings  
- Keep code blocks unwrapped
- Test changes before going live

## B · Label registry

| Label | Criteria | Order | Actions? |
|-------|----------|-------|----------|
| Support | mentions "help", "support", or "issue" | 10 | YES |
| Refund | mentions "refund", "money back", or "chargeback" | 20 | YES |
| Bug | mentions "bug", "error", or "broken" | 30 | YES |
| undefined |  | 9999 | YES |

## C.1 · Overall Prompt

\`\`\`text
You are an email classification assistant. Analyze the email content and classify it according to the provided labels. Choose the most specific label that matches the email content. If no specific label applies, use "undefined".

Return your response in JSON format with the label and a brief explanation.
\`\`\`

## C.2 · Prompt · Support

\`\`\`text
{"instructions": "Draft a helpful response acknowledging their support request and providing initial guidance", "tone": "helpful and professional"}
\`\`\`

## C.3 · Prompt · Refund

\`\`\`text
{"instructions": "Draft a response asking for order details and explaining the refund process", "tone": "understanding and solution-focused"}
\`\`\`

## C.4 · Prompt · Bug

\`\`\`text
{"instructions": "Draft a response asking for reproduction steps and technical details", "tone": "technical but approachable"}
\`\`\`

## D · Prompt · undefined

\`\`\`text
{"instructions": "labelOnly", "note": "No specific action - just apply appropriate label"}
\`\`\``;
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
    rulesText.appendText('\n• One label per row in Section B');
    rulesText.appendText('\n• Never rename section headings');
    rulesText.appendText('\n• Keep code blocks unwrapped');
    rulesText.appendText('\n• Test changes before going live');
    
    // Section B - Label Registry
    body.appendParagraph('B · Label registry').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    
    const table = body.appendTable([
      ['Label', 'Criteria', 'Order', 'Actions?'],
      ['Support', 'mentions "help", "support", or "issue"', '10', 'YES'],
      ['Refund', 'mentions "refund", "money back", or "chargeback"', '20', 'YES'],
      ['Bug', 'mentions "bug", "error", or "broken"', '30', 'YES'],
      ['undefined', '', '9999', 'YES']
    ]);
    
    // Style table header
    const headerRow = table.getRow(0);
    for (let i = 0; i < 4; i++) {
      headerRow.getCell(i).getChild(0).asParagraph().setAttributes({
        [DocumentApp.Attribute.BOLD]: true
      });
    }
    
    // Section C - Prompts
    body.appendParagraph('C.1 · Overall Prompt').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph('You are an email classification assistant. Analyze the email content and classify it according to the provided labels. Choose the most specific label that matches the email content. If no specific label applies, use "undefined".\n\nReturn your response in JSON format with the label and a brief explanation.');
    
    body.appendParagraph('C.2 · Prompt · Support').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph('{"instructions": "Draft a helpful response acknowledging their support request and providing initial guidance", "tone": "helpful and professional"}');
    
    body.appendParagraph('C.3 · Prompt · Refund').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph('{"instructions": "Draft a response asking for order details and explaining the refund process", "tone": "understanding and solution-focused"}');
    
    body.appendParagraph('C.4 · Prompt · Bug').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph('{"instructions": "Draft a response asking for reproduction steps and technical details", "tone": "technical but approachable"}');
    
    // Section D
    body.appendParagraph('D · Prompt · undefined').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph('{"instructions": "labelOnly", "note": "No specific action - just apply appropriate label"}');
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
        errors: [{ type: 'missing_undefined', message: 'No prompt document found' }],
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
        errors: [{ type: 'missing_undefined', message: 'Failed to read document: ' + Utils.handleError(e) }],
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
      undefinedPrompt: '',
      actionPrompts: {}
    };
    
    let currentSection = '';
    let currentPromptLabel = '';
    
    // Find table in Section B
    const tables = body.getTables();
    if (tables.length > 0) {
      const table = tables[0];
      if (table) {
        const numRows = table.getNumRows();
        
        // Skip header row, parse data rows
        for (let i = 1; i < numRows; i++) {
          const row = table.getRow(i);
          if (row.getNumCells() >= 4) {
            const label = row.getCell(0).getText().trim();
            const criteria = row.getCell(1).getText().trim();
            const orderText = row.getCell(2).getText().trim();
            const actionsText = row.getCell(3).getText().trim();
            
            if (label) {
              const order = parseInt(orderText) || 0;
              result.labels.push({
                label,
                criteria,
                order,
                hasActions: actionsText.toUpperCase() === 'YES'
              });
            }
          }
        }
      }
    }
    
    // Parse headings and content
    for (const paragraph of paragraphs) {
      const heading = paragraph.getHeading();
      const text = paragraph.getText().trim();
      
      if (heading === DocumentApp.ParagraphHeading.HEADING1) {
        if (text.includes('D · Prompt · undefined')) {
          currentSection = 'undefined';
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
      } else if (text && currentSection) {
        // Capture content based on current section
        if (currentSection === 'overall' && text.length > 10) {
          result.overallPrompt = text;
        } else if (currentSection === 'undefined' && text.length > 10) {
          result.undefinedPrompt = text;
        } else if (currentSection === 'action' && currentPromptLabel && text.length > 10) {
          result.actionPrompts[currentPromptLabel] = text;
        }
      }
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
    
    // Check for undefined label
    const hasUndefined = parsed.labels.some(rule => rule.label === 'undefined');
    if (!hasUndefined) {
      errors.push({
        type: 'missing_undefined',
        message: 'Missing required "undefined" label in registry'
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
    const labelsWithActions = parsed.labels.filter(rule => rule.hasActions && rule.label !== 'undefined');
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
        
        // Check for default/undefined
        if ((prompt.label.toLowerCase() === 'default' || prompt.label === 'undefined') && !bestMatch) {
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