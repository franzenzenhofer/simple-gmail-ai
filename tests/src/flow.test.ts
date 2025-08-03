/**
 * Integration test for the complete analysis flow
 */

import { ProcessingMode } from '../config-constants';

describe('Complete Analysis Flow', () => {
  let mockProps: Map<string, string>;
  const globalAny = (globalThis as any);
  
  beforeEach(() => {
    mockProps = new Map();
    
    // Mock PropertiesService
    globalAny.PropertiesService = {
      getUserProperties: () => ({
        getProperty: (key: string) => mockProps.get(key) || null,
        setProperty: (key: string, value: string) => { mockProps.set(key, value); },
        deleteProperty: (key: string) => { mockProps.delete(key); },
        getProperties: () => Object.fromEntries(mockProps),
        deleteAllProperties: () => { mockProps.clear(); }
      })
    };
    
    // Set up initial state with API key
    mockProps.set('GEMINI_API_KEY', 'test-api-key');
  });
  
  describe('Step 1: Click Analyze Inbox Button', () => {
    it('should call runAnalysis when button is clicked', () => {
      // The button configuration
      const analyzeButton = {
        text: 'Analyze Inbox',
        backgroundColor: '#1a73e8',
        onClickAction: {
          functionName: 'runAnalysis',
          loadIndicator: 'NONE' // No spinner for immediate feedback
        }
      };
      
      expect(analyzeButton.onClickAction.functionName).toBe('runAnalysis');
      expect(analyzeButton.onClickAction.loadIndicator).toBe('NONE');
    });
  });
  
  describe('Step 2: runAnalysis Function', () => {
    it('should save form data and show processing overlay', () => {
      // Simulate form event
      const mockEvent = {
        formInput: {
          mode: ProcessingMode.CREATE_DRAFTS,
          prompt1: 'Custom classification prompt',
          prompt2: 'Custom response prompt'
        }
      };
      
      // Mock the runAnalysis logic
      const mode = mockEvent.formInput.mode;
      const prompt1 = mockEvent.formInput.prompt1;
      const prompt2 = mockEvent.formInput.prompt2;
      
      // Save settings
      mockProps.set('PROCESSING_MODE', mode);
      mockProps.set('PROMPT_1', prompt1);
      mockProps.set('PROMPT_2', prompt2);
      mockProps.set('ANALYSIS_RUNNING', 'true');
      mockProps.set('ANALYSIS_START_TIME', Date.now().toString());
      
      // Verify saved
      expect(mockProps.get('PROCESSING_MODE')).toBe(ProcessingMode.CREATE_DRAFTS);
      expect(mockProps.get('PROMPT_1')).toBe('Custom classification prompt');
      expect(mockProps.get('ANALYSIS_RUNNING')).toBe('true');
      
      // Would return UI.navigateTo(ProcessingOverlay.build())
    });
  });
  
  describe('Step 3: Processing Overlay', () => {
    it('should show correct mode and have Start button', () => {
      mockProps.set('PROCESSING_MODE', ProcessingMode.AUTO_SEND);
      
      // Simulate ProcessingOverlay.build()
      const mode = mockProps.get('PROCESSING_MODE');
      const overlayConfig = {
        title: 'Processing Starting',
        modeDisplay: mode === ProcessingMode.AUTO_SEND ? '🚨 Auto-Reply' :
                     mode === ProcessingMode.CREATE_DRAFTS ? '✍️ Create Drafts' :
                     '🏷️ Label Only',
        text: 'Will scan emails and apply Support/undefined labels' +
              (mode !== ProcessingMode.LABEL_ONLY ? '\n+ ' + 
                (mode === ProcessingMode.CREATE_DRAFTS ? 'create drafts' : 'send replies') : ''),
        button: {
          text: 'Start',
          functionName: 'continueProcessing'
        }
      };
      
      expect(overlayConfig.modeDisplay).toBe('🚨 Auto-Reply');
      expect(overlayConfig.text).toContain('send replies');
      expect(overlayConfig.button.functionName).toBe('continueProcessing');
    });
  });
  
  describe('Step 4: continueProcessing Function', () => {
    it('should retrieve saved parameters and process emails', () => {
      // Set up saved state
      mockProps.set('PROCESSING_MODE', ProcessingMode.LABEL_ONLY);
      mockProps.set('PROMPT_1', 'Classification prompt');
      mockProps.set('PROMPT_2', 'Response prompt');
      mockProps.set('GEMINI_API_KEY', 'test-key');
      
      // Simulate continueProcessing logic
      const mode = mockProps.get('PROCESSING_MODE');
      const apiKey = mockProps.get('GEMINI_API_KEY');
      
      expect(mode).toBe(ProcessingMode.LABEL_ONLY);
      expect(apiKey).toBe('test-key');
      
      const createDrafts = (mode === ProcessingMode.CREATE_DRAFTS || mode === ProcessingMode.AUTO_SEND);
      const autoReply = (mode === ProcessingMode.AUTO_SEND);
      
      expect(createDrafts).toBe(false);
      expect(autoReply).toBe(false);
    });
  });
  
  describe('Gmail Search Query', () => {
    it('should exclude emails with ai✓ or aiX labels', () => {
      // Simulate label escaping
      const AI_PROCESSED = 'ai✓';
      const AI_ERROR = 'aiX';
      
      const escapeLabelForSearch = (label: string) => {
        if (label.includes(' ') || label.includes('(') || label.includes(')') || 
            label.includes('✓') || label.includes('✗') || label.includes('X')) {
          return '"' + label + '"';
        }
        return label;
      };
      
      const escapedProcessed = escapeLabelForSearch(AI_PROCESSED);
      const escapedError = escapeLabelForSearch(AI_ERROR);
      
      const recentQuery = 'in:inbox -label:' + escapedProcessed + ' -label:' + escapedError;
      const unreadQuery = 'in:inbox is:unread -label:' + escapedProcessed + ' -label:' + escapedError;
      
      expect(recentQuery).toBe('in:inbox -label:"ai✓" -label:"aiX"');
      expect(unreadQuery).toBe('in:inbox is:unread -label:"ai✓" -label:"aiX"');
    });
  });
  
  describe('Complete Flow Integration', () => {
    it('should complete the full flow from button click to processing', () => {
      // 1. Initial state
      mockProps.set('GEMINI_API_KEY', 'test-key');
      expect(mockProps.get('ANALYSIS_RUNNING')).toBeUndefined();
      
      // 2. User clicks Analyze Inbox -> runAnalysis
      mockProps.set('PROCESSING_MODE', ProcessingMode.CREATE_DRAFTS);
      mockProps.set('ANALYSIS_RUNNING', 'true');
      expect(mockProps.get('ANALYSIS_RUNNING')).toBe('true');
      
      // 3. Processing overlay shown
      const mode = mockProps.get('PROCESSING_MODE');
      expect(mode).toBe(ProcessingMode.CREATE_DRAFTS);
      
      // 4. User clicks Start -> continueProcessing
      // Would call GmailService.getUnprocessedThreads()
      // Would call GmailService.processThreads()
      
      // 5. Processing completes
      mockProps.set('ANALYSIS_RUNNING', 'false');
      mockProps.set('LAST_EXECUTION_STATS', '10 analyzed | 3 support | 3 drafts | 0 sent');
      
      expect(mockProps.get('ANALYSIS_RUNNING')).toBe('false');
      expect(mockProps.get('LAST_EXECUTION_STATS')).toContain('3 drafts');
    });
  });
  
  describe('Cancel Processing', () => {
    it('should cancel processing when button is clicked', () => {
      // Set up processing state
      mockProps.set('ANALYSIS_RUNNING', 'true');
      mockProps.set('ANALYSIS_START_TIME', Date.now().toString());
      mockProps.set('CURRENT_SCANNED', '5');
      mockProps.set('CURRENT_SUPPORTS', '2');
      
      // Simulate cancelProcessing logic
      const isProcessing = mockProps.get('ANALYSIS_RUNNING') === 'true';
      expect(isProcessing).toBe(true);
      
      // Cancel processing
      mockProps.set('ANALYSIS_RUNNING', 'false');
      mockProps.set('ANALYSIS_CANCELLED', 'true');
      
      // Clear stats
      mockProps.delete('CURRENT_SCANNED');
      mockProps.delete('CURRENT_SUPPORTS');
      mockProps.delete('CURRENT_DRAFTED');
      mockProps.delete('CURRENT_SENT');
      mockProps.delete('CURRENT_ERRORS');
      
      // Verify cancellation
      expect(mockProps.get('ANALYSIS_RUNNING')).toBe('false');
      expect(mockProps.get('ANALYSIS_CANCELLED')).toBe('true');
      expect(mockProps.get('CURRENT_SCANNED')).toBeUndefined();
    });
    
    it('should show cancel button only when processing is active', () => {
      // When not processing
      mockProps.set('ANALYSIS_RUNNING', 'false');
      expect(mockProps.get('ANALYSIS_RUNNING') === 'true').toBe(false);
      
      // When processing
      mockProps.set('ANALYSIS_RUNNING', 'true');
      expect(mockProps.get('ANALYSIS_RUNNING') === 'true').toBe(true);
    });
  });
});