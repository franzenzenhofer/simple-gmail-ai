/**
 * Configuration Module
 * Contains all constants and configuration values
 */

namespace Config {
  export enum ProcessingMode {
    LABEL_ONLY = 'label',
    CREATE_DRAFTS = 'draft', 
    AUTO_SEND = 'send'
  }
  
  export const LABELS = {
    SUPPORT: 'Support',
    NOT_SUPPORT: 'General', 
    AI_PROCESSED: 'ai✓',
    AI_ERROR: 'aiX',
    AI_GUARDRAILS_FAILED: 'ai✗'
  };
  
  export const VERSION = '__VERSION__';
  export const DEPLOY_TIME = '__DEPLOY_TIME__';
  
  export const DEFAULT_CLASSIFICATION_PROMPT = [
    'You are an email triage assistant.',
    'Return exactly one word:',
    '  - support : if the email is a customer support request',
    '  - undefined : for anything else (not support).',
    '---------- EMAIL START ----------'
  ].join('\n');
  
  export const DEFAULT_RESPONSE_PROMPT = [
    'You are a customer support agent.',
    'Draft a friendly, concise reply that resolves the customer issue.',
    '---------- ORIGINAL EMAIL ----------'
  ].join('\n');
  
  export const PROMPTS = {
    CLASSIFICATION: DEFAULT_CLASSIFICATION_PROMPT,
    RESPONSE: DEFAULT_RESPONSE_PROMPT
  };
  
  export const GEMINI = {
    MODEL: 'gemini-2.5-flash',
    TEMPERATURE: 0.3,
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',
    TIMEOUT_MS: 30000 // 30 seconds timeout for API calls
  };
  
  // Property keys - centralized to avoid inconsistency
  export const PROP_KEYS = {
    API_KEY: 'GEMINI_API_KEY', // Single source of truth for API key property
    ONBOARDING_PROGRESS: 'ONBOARDING_PROGRESS',
    ANALYSIS_RUNNING: 'ANALYSIS_RUNNING',
    ANALYSIS_START_TIME: 'ANALYSIS_START_TIME',
    LAST_EXECUTION_STATS: 'LAST_EXECUTION_STATS',
    DEBUG_MODE: 'DEBUG_MODE',
    SPREADSHEET_LOGGING_ENABLED: 'SPREADSHEET_LOGGING_ENABLED',
    SPREADSHEET_LOG_ID: 'SPREADSHEET_LOG_ID',
    DARK_MODE_ENABLED: 'DARK_MODE_ENABLED',
    TEST_MODE_CONFIG: 'TEST_MODE_CONFIG'
  };
  
  // Theme colors - can be customized or made theme-aware
  export const COLORS = {
    // Primary actions
    PRIMARY: '#1a73e8',        // Google Blue - primary buttons, links
    PRIMARY_DISABLED: '#999999', // Gray - disabled state
    
    // Status colors
    SUCCESS: '#34a853',        // Google Green - success actions
    DANGER: '#dc3545',         // Red - dangerous actions
    WARNING: '#fbbc04',        // Google Yellow - warnings
    INFO: '#4285f4',          // Light Blue - informational
    
    // Text colors
    TEXT_PRIMARY: '#202124',   // Almost black - main text
    TEXT_SECONDARY: '#5f6368', // Gray - secondary text
    TEXT_DISABLED: '#999999',  // Light gray - disabled text
    
    // Background colors
    BACKGROUND: '#ffffff',     // White - card backgrounds
    BACKGROUND_SUBTLE: '#f8f9fa' // Light gray - subtle backgrounds
  };
}