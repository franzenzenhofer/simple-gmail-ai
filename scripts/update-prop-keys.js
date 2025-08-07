#!/usr/bin/env node

/**
 * Script to help update hardcoded property strings to use Config.PROP_KEYS
 * This generates the replacements needed for all files
 */

const replacements = [
  // UI module
  { old: "'GEMINI_API_KEY'", new: "Config.PROP_KEYS.API_KEY" },
  { old: "'PROCESSING_MODE'", new: "Config.PROP_KEYS.PROCESSING_MODE" },
  { old: "'PROMPT_1'", new: "Config.PROP_KEYS.PROMPT_1" },
  { old: "'PROMPT_2'", new: "Config.PROP_KEYS.PROMPT_2" },
  { old: "'LAST_EXECUTION_TIME'", new: "Config.PROP_KEYS.LAST_EXECUTION_TIME" },
  { old: "'LAST_EXECUTION_STATS'", new: "Config.PROP_KEYS.LAST_EXECUTION_STATS" },
  { old: "'DEBUG_MODE'", new: "Config.PROP_KEYS.DEBUG_MODE" },
  { old: "'SPREADSHEET_LOGGING'", new: "Config.PROP_KEYS.SPREADSHEET_LOGGING" },
  { old: "'AI_HEARTBEAT'", new: "Config.PROP_KEYS.AI_HEARTBEAT" },
  { old: "'LAST_EXECUTION_ID'", new: "Config.PROP_KEYS.LAST_EXECUTION_ID" },
  { old: "'CURRENT_SCANNED'", new: "Config.PROP_KEYS.CURRENT_SCANNED" },
  { old: "'CURRENT_SUPPORTS'", new: "Config.PROP_KEYS.CURRENT_SUPPORTS" },
  { old: "'CURRENT_DRAFTED'", new: "Config.PROP_KEYS.CURRENT_DRAFTED" },
  { old: "'CURRENT_SENT'", new: "Config.PROP_KEYS.CURRENT_SENT" },
  { old: "'CURRENT_ERRORS'", new: "Config.PROP_KEYS.CURRENT_ERRORS" },
  { old: "'CURRENT_EXECUTION_ID'", new: "Config.PROP_KEYS.CURRENT_EXECUTION_ID" },
  
  // Lock manager
  { old: "'ANALYSIS_RUNNING'", new: "Config.PROP_KEYS.ANALYSIS_RUNNING" },
  { old: "'ANALYSIS_START_TIME'", new: "Config.PROP_KEYS.ANALYSIS_START_TIME" },
  { old: "'ANALYSIS_CANCELLED'", new: "Config.PROP_KEYS.ANALYSIS_CANCELLED" },
  
  // Entry points
  { old: "'LABEL_CACHE_MIGRATED'", new: "Config.PROP_KEYS.LABEL_CACHE_MIGRATED" },
  
  // Gmail
  { old: "'DOCS_PROMPT_ERROR_COUNT'", new: "Config.PROP_KEYS.DOCS_PROMPT_ERROR_COUNT" },
  { old: "'TEST_MODE_CONFIG'", new: "Config.PROP_KEYS.TEST_MODE_CONFIG" },
  
  // Logger
  { old: "'LOG_FOLDER_ID'", new: "Config.PROP_KEYS.LOG_FOLDER_ID" },
  
  // Dark mode
  { old: "'DARK_MODE_ENABLED'", new: "Config.PROP_KEYS.DARK_MODE_ENABLED" },
  { old: "'DARK_MODE_INITIALIZED'", new: "Config.PROP_KEYS.DARK_MODE_INITIALIZED" },
  
  // Continuation
  { old: "'ACTIVE_CONTINUATION_KEY'", new: "Config.PROP_KEYS.ACTIVE_CONTINUATION_KEY" },
  
  // UI improvements
  { old: "'classificationPrompt'", new: "Config.PROP_KEYS.classificationPrompt" },
  { old: "'responsePrompt'", new: "Config.PROP_KEYS.responsePrompt" },
  { old: "'EMAILS_PROCESSED'", new: "Config.PROP_KEYS.EMAILS_PROCESSED" },
  { old: "'EMAILS_TOTAL'", new: "Config.PROP_KEYS.EMAILS_TOTAL" },
  { old: "'PROCESSING_STATS'", new: "Config.PROP_KEYS.PROCESSING_STATS" },
  
  // Welcome flow
  { old: "'autoCreateDrafts'", new: "Config.PROP_KEYS.autoCreateDrafts" },
  { old: "'classificationSensitivity'", new: "Config.PROP_KEYS.classificationSensitivity" },
];

console.log('Property Key Replacements Needed:\n');

replacements.forEach(r => {
  console.log(`Replace: ${r.old}`);
  console.log(`   With: ${r.new}`);
  console.log('');
});

console.log('\nTotal replacements needed:', replacements.length);
console.log('\nNote: Run search and replace in each file, being careful to:');
console.log('1. Only replace in getProperty/setProperty/deleteProperty calls');
console.log('2. Test after each file update');
console.log('3. Make atomic commits');