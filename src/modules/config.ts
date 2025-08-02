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
    NOT_SUPPORT: 'undefined', 
    AI_PROCESSED: 'ai✓',
    AI_ERROR: 'aiX'
  };
  
  export const VERSION = '__VERSION__';
  export const DEPLOY_TIME = '__DEPLOY_TIME__';
  
  export const PROMPTS = {
    CLASSIFICATION: [
      'You are an email triage assistant.',
      'Return exactly one word:',
      '  - support : if the email is a customer support request',
      '  - undefined : for anything else (not support).',
      '---------- EMAIL START ----------'
    ].join('\n'),
    
    RESPONSE: [
      'You are a customer support agent.',
      'Draft a friendly, concise reply that resolves the customer issue.',
      '---------- ORIGINAL EMAIL ----------'
    ].join('\n')
  };
  
  export const GEMINI = {
    MODEL: 'gemini-2.5-flash',
    TEMPERATURE: 0.3,
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',
    TIMEOUT_MS: 30000 // 30 seconds timeout for API calls
  };
}