# Gmail AI Support Triage - Architecture Overview

## Project Structure

```
simple-gmail-ai/
├── src/                      # Source code
│   ├── modules/             # Modular TypeScript namespaces
│   │   ├── config.ts        # Configuration & constants
│   │   ├── types.ts         # TypeScript interfaces
│   │   ├── logger.ts        # Logging system
│   │   ├── ai.ts            # Gemini API integration
│   │   ├── gmail.ts         # Gmail processing
│   │   ├── ui.ts            # UI building functions
│   │   └── utils.ts         # Utility functions
│   ├── Code.ts              # Main entry point
│   ├── SafetyConfig.ts      # Safety configuration
│   └── appsscript.json      # Apps Script manifest
├── dist/                    # Build output
│   ├── Code.gs              # Bundled single file
│   └── appsscript.json      # Copied manifest
├── tests/                   # Test configuration
└── package.json             # npm scripts

```

## Module Architecture

### 1. **Config Module** (`config.ts`)
- Label constants (support, undefined, ai✓, ai✗)
- Version information
- Default prompts
- Gemini API configuration

### 2. **Types Module** (`types.ts`)
- `FormInputs` - Form input handling
- `GeminiResponse` - API response structure
- `ProcessingStats` - Analysis statistics

### 3. **Logger Module** (`logger.ts`)
- Console logging with levels (DEBUG, INFO, WARN, ERROR)
- Spreadsheet logging to Google Drive
- Daily log rotation
- Sensitive data masking
- Performance timing

### 4. **AI Module** (`ai.ts`)
- Gemini API integration
- Request/response logging with unique IDs
- Error handling
- Response parsing

### 5. **Gmail Module** (`gmail.ts`)
- Label management
- Thread fetching and deduplication
- Email classification
- Draft/reply creation
- Error labeling

### 6. **UI Module** (`ui.ts`)
- Homepage with mode selection and prompts
- API key configuration tab
- Logs viewer with direct links
- Settings tab
- Navigation helpers

### 7. **Utils Module** (`utils.ts`)
- Form value extraction
- Error handling helpers

## Main Entry Point (`Code.ts`)

Contains only:
- `onHomepage()` - Main entry point
- Navigation handlers (showApiKeyTab, showLogsTab, etc.)
- Action handlers (saveApiKey, runAnalysis, etc.)
- Universal actions (viewLogsUniversal)

## Build Process

1. **TypeScript Compilation**: `tsc` compiles all `.ts` files to `.js`
2. **Bundle Creation**: `bundle.js` combines all modules into single file
3. **Version Injection**: Replaces `__VERSION__` and `__DEPLOY_TIME__`
4. **Cleanup**: Removes intermediate files
5. **Output**: Single `Code.gs` file ready for deployment

## Key Features

- **Modular Design**: Easy to maintain and extend
- **Single File Deployment**: All modules bundled for Apps Script
- **Type Safety**: Full TypeScript support
- **Comprehensive Logging**: Console + Spreadsheet with daily rotation
- **Clean UI/UX**: Tab-based navigation with clear hierarchy
- **Safety First**: Development mode by default
- **Extensible**: Easy to add new modules or features

## Development Commands

```bash
npm run build    # Build TypeScript and bundle
npm run test     # Run tests
npm run lint     # Type check with tsc
npm run push     # Push to Apps Script
npm run deploy   # Full deployment with version bump
```

## Deployment

The project deploys as a single `Code.gs` file (27KB) containing all modules, maintaining the benefits of modular development while meeting Apps Script requirements.