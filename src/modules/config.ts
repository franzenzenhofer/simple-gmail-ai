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
    // ONLY system labels remain - ALL other labels come from docs
    AI_PROCESSED: 'ai✓',
    AI_ERROR: 'aiX'
  };
  
  export const VERSION = '__VERSION__';
  export const DEPLOY_TIME = '__DEPLOY_TIME__';
  
  // All prompts must come from Google Docs - no hardcoded defaults
  // This ensures labels are 100% managed in the prompt document
  
  export const GEMINI = {
    MODEL: 'gemini-2.5-flash',
    TEMPERATURE: 0.3,
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',
    TIMEOUT_MS: 30000 // 30 seconds timeout for API calls
  };
  
  // Property keys - centralized to avoid inconsistency
  export const PROP_KEYS = {
    // Authentication & API
    API_KEY: 'GEMINI_API_KEY', // Single source of truth for API key property
    
    // Processing & Analysis
    ANALYSIS_RUNNING: 'ANALYSIS_RUNNING',
    ANALYSIS_START_TIME: 'ANALYSIS_START_TIME',
    ANALYSIS_CANCELLED: 'ANALYSIS_CANCELLED',
    PROCESSING_MODE: 'PROCESSING_MODE',
    PROMPT_1: 'PROMPT_1',
    PROMPT_2: 'PROMPT_2',
    
    // Current Execution Stats
    CURRENT_SCANNED: 'CURRENT_SCANNED',
    CURRENT_SUPPORTS: 'CURRENT_SUPPORTS',
    CURRENT_DRAFTED: 'CURRENT_DRAFTED',
    CURRENT_SENT: 'CURRENT_SENT',
    CURRENT_ERRORS: 'CURRENT_ERRORS',
    
    // Last Execution Info
    LAST_EXECUTION_TIME: 'LAST_EXECUTION_TIME',
    LAST_EXECUTION_STATS: 'LAST_EXECUTION_STATS',
    LAST_EXECUTION_ID: 'LAST_EXECUTION_ID',
    CURRENT_EXECUTION_ID: 'CURRENT_EXECUTION_ID',
    
    // System Flags & Migration
    ONBOARDING_PROGRESS: 'ONBOARDING_PROGRESS',
    AI_HEARTBEAT: 'AI_HEARTBEAT',
    LABEL_CACHE_MIGRATED: 'LABEL_CACHE_MIGRATED',
    DOCS_PROMPT_ERROR_COUNT: 'DOCS_PROMPT_ERROR_COUNT',
    
    // Logging & Debug
    DEBUG_MODE: 'DEBUG_MODE',
    SPREADSHEET_LOGGING: 'SPREADSHEET_LOGGING',
    SPREADSHEET_LOGGING_ENABLED: 'SPREADSHEET_LOGGING_ENABLED',
    SPREADSHEET_LOG_ID: 'SPREADSHEET_LOG_ID',
    LOG_FOLDER_ID: 'LOG_FOLDER_ID',
    
    // UI & Features
    DARK_MODE_ENABLED: 'DARK_MODE_ENABLED',
    DARK_MODE_INITIALIZED: 'DARK_MODE_INITIALIZED',
    TEST_MODE_CONFIG: 'TEST_MODE_CONFIG',
    
    // Welcome Flow
    autoCreateDrafts: 'autoCreateDrafts',
    classificationSensitivity: 'classificationSensitivity',
    
    // UI Improvements (legacy)
    classificationPrompt: 'classificationPrompt',
    responsePrompt: 'responsePrompt',
    EMAILS_PROCESSED: 'EMAILS_PROCESSED',
    EMAILS_TOTAL: 'EMAILS_TOTAL',
    PROCESSING_STATS: 'PROCESSING_STATS',
    
    // Continuation & State
    ACTIVE_CONTINUATION_KEY: 'ACTIVE_CONTINUATION_KEY'
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