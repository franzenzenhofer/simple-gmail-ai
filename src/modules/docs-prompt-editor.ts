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
   * Creates pure markdown content that will be visible as markdown in Google Docs
   */
  export function generateDocumentTemplate(): string {
    return `# Gmail AI Prompts Configuration

## 📋 How to Use This Document

This document controls how your Gmail AI Assistant works. It's written in **simple markdown format** that you can edit directly.

### 👥 Who Should Edit This
- **✅ Recommended**: Operations lead, Customer Experience manager
- **❌ Not recommended**: Frontline agents (risk of breaking the system)

### 🔄 Making Changes Safely
1. **Before editing**: Use File ▸ Version history ▸ Name current version 
2. **Make your changes** using the format below
3. **Test**: Use Test Mode in the app before going live
4. **Deploy**: Click "Save & Go Live" in the Docs Prompt Editor

### 📝 Editing Rules
- **Keep section headings exactly as they are** (never change # headings)
- **Use the exact format** shown in examples below
- **Copy and modify** existing labels to add new ones
- **Be specific** - the AI follows your instructions literally

---

## 🏷️ Label Registry

This section defines all the labels the AI can assign to emails. Labels are checked in Priority order (lowest number first).

### Label: Support
**Priority:** 10  
**Criteria:** mentions "help", "support", "assistance", "trouble", or "issue"  
**Actions:** YES *(create draft reply)*

### Label: Refund
**Priority:** 20  
**Criteria:** mentions "refund", "money back", "return", or "chargeback"  
**Actions:** YES *(create draft reply)*

### Label: Bug
**Priority:** 30  
**Criteria:** mentions "bug", "error", "broken", "not working", or "crash"  
**Actions:** YES *(create draft reply)*

### Label: General
**Priority:** 9999 *(catch-all - always last)*  
**Criteria:** (matches everything else that doesn't fit above labels)  
**Actions:** YES *(label only, no draft)*

**📋 Field Explanations:**
- **Label:** The exact Gmail label name (will be created if doesn't exist)
- **Priority:** Lower numbers checked first (10 before 20 before 30)
- **Criteria:** What the AI looks for in the email content
- **Actions:** YES = create draft reply, NO = label only

---

## 🤖 Overall Classification Prompt

*This tells the AI how to classify emails into the labels above.*

You are an email classification assistant. Analyze the email content and classify it according to the labels defined in the Label Registry above.

**Instructions:**
- Review each label's criteria in priority order (lowest number first)
- Return ONLY the exact label name from the registry
- Choose the most specific label that matches the email content  
- If multiple labels could apply, use the one with the lowest priority number
- If no specific label applies, return "General"
- The label you return will be created in Gmail if it doesn't exist

**Response format:** Return only the label name, nothing else.

---

## ✍️ Response Prompts

*These tell the AI how to write draft replies for each label that has Actions: YES*

### Prompt · Support

Draft a helpful and professional response to this support request.

**Guidelines:**
- Acknowledge their specific issue or concern
- Provide clear next steps or initial guidance  
- Be empathetic and solution-focused
- Keep it concise but thorough (2-3 paragraphs max)
- End with an invitation for follow-up questions

### Prompt · Refund

Draft a response about this refund request.

**Guidelines:**
- Show understanding of their situation
- Ask for order/transaction details if not provided in the original email
- Explain our refund process clearly and simply
- Provide expected timeline (be realistic)
- Be solution-focused and helpful

### Prompt · Bug

Draft a response about this bug report.

**Guidelines:**
- Thank them for reporting the issue
- Ask for specific reproduction steps if not provided
- Request technical details: browser, OS, error messages, screenshots
- Be technical but approachable
- Assure them we take bugs seriously and are investigating

### Prompt · General

*This label has Actions: NO, so no response prompt is needed.*

For general emails that don't match specific categories, we just apply the "General" label without creating a draft response.

---

## 🎯 Tips for Success

### Adding New Labels
1. Copy an existing label section
2. Change the label name and criteria
3. Set priority (lower = higher priority)
4. Choose Actions: YES (with draft) or NO (label only)
5. Add a response prompt if Actions: YES

### Testing Changes
1. Save this document
2. Go to Docs Prompt Editor ▸ Save & Go Live
3. Use Test Mode to verify it works as expected
4. Only then use on your real inbox

### Common Mistakes
- ❌ Changing section headings (breaks the parser)
- ❌ Forgetting to update priority numbers
- ❌ Making criteria too broad or too narrow
- ❌ Not testing changes before going live

**Remember**: The AI follows your instructions exactly. Be clear and specific!`;
  }
  
  /**
   * Add template content to document body as pure markdown
   * This creates visible markdown text instead of formatted content
   */
  function addTemplateContent(body: GoogleAppsScript.Document.Body): void {
    // Get the template markdown and add it as plain text
    const markdownTemplate = generateDocumentTemplate();
    
    // Split into lines and add each as a paragraph to preserve structure
    const lines = markdownTemplate.split('\n');
    
    for (const line of lines) {
      // Add each line as a plain paragraph without any formatting
      // This ensures the markdown syntax remains visible
      body.appendParagraph(line);
    }
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
   * Now parses pure markdown text instead of formatted headings
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
    
    // Parse raw text looking for markdown patterns
    for (const paragraph of paragraphs) {
      const text = paragraph.getText().trim();
      
      if (!text) continue; // Skip empty lines
      
      // Parse markdown headings (##, ###)
      if (text.startsWith('## ')) {
        const heading = text.replace('## ', '').trim();
        
        if (heading.includes('🏷️ Label Registry')) {
          currentSection = 'labels';
        } else if (heading.includes('🤖 Overall Classification Prompt')) {
          currentSection = 'overall';
        } else if (heading.includes('✍️ Response Prompts')) {
          currentSection = 'response_section';
        }
      } else if (text.startsWith('### ')) {
        const heading = text.replace('### ', '').trim();
        
        if (heading.startsWith('Label: ')) {
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
          currentLabel = heading.replace('Label: ', '').trim();
          currentLabelData = {
            label: currentLabel
          };
          currentSection = 'label_data';
        } else if (heading.startsWith('Prompt · ')) {
          currentPromptLabel = heading.replace('Prompt · ', '').trim();
          currentSection = 'action';
        }
      } else if (text.startsWith('**') && text.includes(':**')) {
        // Parse markdown bold fields like **Priority:** 10
        if (currentSection === 'label_data') {
          if (text.startsWith('**Priority:**')) {
            const priorityText = text.replace('**Priority:**', '').trim();
            // Remove any markdown formatting from the value
            const cleanPriority = priorityText.replace(/\*|\(.*?\)/g, '').trim();
            currentLabelData.priority = parseInt(cleanPriority) || 9999;
          } else if (text.startsWith('**Criteria:**')) {
            currentLabelData.criteria = text.replace('**Criteria:**', '').trim();
          } else if (text.startsWith('**Actions:**')) {
            const actionsText = text.replace('**Actions:**', '').trim();
            // Remove any markdown formatting like *(create draft reply)*
            const cleanActions = actionsText.replace(/\*|\(.*?\)/g, '').trim();
            currentLabelData.actions = cleanActions.toUpperCase() === 'YES';
          }
        }
      } else if (text && currentSection) {
        // Capture content based on current section
        if (currentSection === 'overall' && text.length > 10) {
          // Skip explanatory text but capture everything else
          if (!text.startsWith('*This tells the AI') && !text.startsWith('*These tell the AI')) {
            if (result.overallPrompt) {
              result.overallPrompt += '\n' + text;
            } else {
              result.overallPrompt = text;
            }
          }
        } else if (currentSection === 'action' && currentPromptLabel && text.length > 10) {
          // Skip explanation headers but capture the actual prompt content
          if (!text.startsWith('*This label') && !text.startsWith('*These tell the AI') && !text.startsWith('For general emails')) {
            // Capture all content including guidelines
            if (result.actionPrompts[currentPromptLabel]) {
              result.actionPrompts[currentPromptLabel] += '\n' + text;
            } else {
              result.actionPrompts[currentPromptLabel] = text;
            }
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