# Changelog

## [2.33.0] - 2025-08-05

### Added
- **Documentation Updates**: Comprehensive update of all project documentation
  - Updated architecture documentation to reflect 38 modules and 540+ tests
  - Archived outdated documentation to `/documentation/old-stuff/`
  - Enhanced deployment checklist with latest procedures
  - Updated quick start guide with current setup instructions

### Changed
- **Project Organization**: Cleaned up documentation structure
  - Moved 7 outdated .md files to archive directory
  - Preserved all active documentation in main directory
  - Improved documentation clarity and accuracy

### Technical
- Current state: 38 TypeScript modules, 47 test files (540+ test cases)
- Maintained production-ready status with all security enhancements
- Documentation now accurately reflects v2.33.0 capabilities

## [2.32.0] - 2025-08-05

### Added
- **Gmail Label Sanitization**: AI-generated labels are now properly sanitized
  - Enforces Gmail's 40-character limit with intelligent truncation
  - Replaces illegal characters with safe alternatives
  - Handles nested labels and preserves allowed characters
  - Comprehensive test suite with 12 test cases covering edge cases
- **Enhanced Security**: Comprehensive security review and bug fixes
  - Verified PII masking in spreadsheet logging works correctly
  - Confirmed factory reset safely preserves user's personal labels
  - Validated cancellation checks in processing loops
  - All critical security issues reviewed and addressed

### Changed
- **Test Coverage**: Expanded to 540+ tests for comprehensive validation
- **Label Creation**: Now uses `Utils.sanitizeGmailLabel()` for all AI-generated labels
- **Documentation**: Updated with latest security fixes and current status

### Fixed
- **Label Creation Failures**: AI-generated labels with invalid characters no longer cause Gmail API failures
- **Bug Report Review**: Completed comprehensive review of 60+ reported issues
  - Issue #7: Gmail label sanitization - IMPLEMENTED
  - Issue #8: AppLogger PII masking - ALREADY CORRECT
  - Issue #10: Factory reset safety - ALREADY SAFE  
  - Issue #12: Cancellation checks - ALREADY IMPLEMENTED

### Technical
- Added `Utils.sanitizeGmailLabel()` function with intelligent truncation
- Enhanced error handling for label creation edge cases
- Improved logging with detailed sanitization information
- Comprehensive test coverage for all security-critical functions

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