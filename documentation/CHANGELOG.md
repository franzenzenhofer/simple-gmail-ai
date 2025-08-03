# Changelog

## [1.9.0] - 2025-08-02

### Added
- **Modular Architecture**: Split code into 7 focused modules
  - `config.ts` - Configuration and constants
  - `types.ts` - TypeScript interfaces
  - `logger.ts` - Comprehensive logging system
  - `ai.ts` - Gemini API integration
  - `gmail.ts` - Email processing logic
  - `ui.ts` - UI building functions
  - `utils.ts` - Utility functions
- **Enhanced Logging**:
  - Spreadsheet logging enabled by default
  - Daily log rotation with folder structure
  - Direct clickable links to logs
  - Unique AI request/response tracking with emojis
- **Improved UI/UX**:
  - Tab-based navigation (Main, API Key, Logs, Settings)
  - Three-dot menu integration for quick access
  - Clean interface without unnecessary warnings
  - Settings tab for advanced options
- **Architecture Documentation**: Comprehensive docs for maintainability

### Changed
- **Label Names**: Shorter, cleaner labels
  - `support` (was: Support Request)
  - `undefined` (was: Not Support Request)
  - `ai✓` (was: AI Processed)
  - `ai✗` (was: AI Error)
- **Main Tab**: Now includes mode selection and prompt customization
- **API Key**: Moved to dedicated tab with better validation
- **Bundler**: Enhanced to handle modular structure

### Fixed
- Form input handling for better compatibility
- Console logging with proper ESLint exceptions
- TypeScript compilation issues

### Technical
- Modular namespace-based architecture
- Enhanced bundling process
- Improved test coverage
- Simplified linting with TypeScript compiler

## [1.8.0] - Previous Version
- Basic functionality with monolithic code structure
- Simple logging to console only
- All settings on single page