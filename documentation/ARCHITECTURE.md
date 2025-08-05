# Gmail AI Support Triage - Architecture Overview v2.32.0

## Project Structure

```
simple-gmail-ai/
├── src/                      # Source code
│   ├── modules/             # Modular TypeScript namespaces (40+ modules)
│   │   ├── config.ts        # Configuration & constants
│   │   ├── types.ts         # TypeScript interfaces
│   │   ├── logger.ts        # Enhanced logging system with PII masking
│   │   ├── ai.ts            # Gemini 2.5 Flash API integration
│   │   ├── gmail.ts         # Gmail processing with label sanitization
│   │   ├── ui.ts            # Advanced UI building functions
│   │   ├── utils.ts         # Utility functions with sanitization
│   │   ├── label-cache.ts   # Gmail label caching system
│   │   ├── factory-reset.ts # Safe factory reset with user label preservation
│   │   ├── docs-prompt-editor.ts # Google Docs integration
│   │   ├── welcome-flow.ts  # User onboarding system
│   │   ├── test-mode.ts     # Development testing features
│   │   └── ... (30+ more modules)
│   ├── Code.ts              # Main entry point
│   └── appsscript.json      # Apps Script manifest
├── dist/                    # Build output
│   ├── Code.gs              # Bundled single file (400KB)
│   └── appsscript.json      # Copied manifest
├── tests/                   # Comprehensive test suite (540+ tests)
├── documentation/           # Complete documentation
└── package.json             # npm scripts with CI/CD
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

- **Advanced Modular Design**: 40+ focused modules for maintainability
- **Single File Deployment**: All modules bundled into 400KB Apps Script file
- **Type Safety**: Full TypeScript support with strict typing
- **Enhanced Security**: Gmail label sanitization, PII masking, safe factory reset
- **Comprehensive Logging**: Console + Spreadsheet with PII masking and daily rotation
- **Production Ready**: 540+ tests covering all critical functions
- **Clean UI/UX**: Tab-based navigation with welcome flow and test mode
- **Safety First**: Multiple layers of protection and validation
- **Extensible**: Easy to add new modules with dependency management

## Development Commands

```bash
npm run build    # Build TypeScript and bundle
npm run test     # Run tests
npm run lint     # Type check with tsc
npm run push     # Push to Apps Script
npm run deploy   # Full deployment with version bump
```

## Security Architecture (v2.32.0)

### Gmail Label Sanitization
- **Module**: `utils.ts` - `sanitizeGmailLabel()` function
- **Purpose**: Ensures AI-generated labels meet Gmail's constraints
- **Features**:
  - 40-character limit with intelligent truncation
  - Illegal character replacement with safe alternatives
  - Nested label support with proper slash handling
  - Word boundary truncation when possible

### PII Protection
- **Module**: `logger.ts` - Enhanced masking system
- **Purpose**: Protects sensitive data in logs and spreadsheets
- **Features**:
  - API key masking (Gemini, OpenAI, Anthropic, etc.)
  - Email address redaction
  - Phone number masking
  - Generic pattern detection for various PII types

### Factory Reset Safety
- **Module**: `factory-reset.ts` 
- **Purpose**: Safe reset that preserves user's personal labels
- **Features**:
  - Only deletes add-on managed labels (Config.LABELS + compiled docs)
  - Preserves all user-created personal labels
  - Comprehensive property cleanup
  - Safe document decoupling (preserves files)

### Cancellation Protection
- **Module**: `gmail.ts` - Processing loops
- **Purpose**: Respects user cancellation during long operations
- **Features**:
  - Cancellation checks in reply generation loops
  - Early exit on user cancellation
  - Prevents partial processing states

## Deployment

The project deploys as a single `Code.gs` file (400KB) containing all modules, maintaining the benefits of modular development while meeting Apps Script requirements. The advanced bundler handles dependency resolution and ensures all security features are properly included.