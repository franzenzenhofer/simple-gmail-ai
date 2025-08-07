# Changelog

All notable changes to this project will be documented in this file.

## [2.62.0] - 2025-08-07

### Fixed
- **CRITICAL**: Fixed "ai-" label creation bug that was affecting new email conversations
  - Added `mapAILabelVariants()` to properly map AI label variants to ai✓/aiX
  - Added `preventAiDashLabel()` to prevent creation of forbidden "ai-" patterns
  - Updated `sanitizeGmailLabel()` to use the new protection functions
  - Ensures ONLY ai✓ and aiX labels exist in the system
  - All 25 dangerous inputs tested with 0 creating "ai-" labels

### Added
- Comprehensive test scripts for AI label verification
- Documentation for the AI label fix in `documentation/ai-label-fix-summary.md`

## [2.61.0] - 2025-08-07

### Changed
- Updated label sanitization logic
- Enhanced Gmail label validation

## Previous versions...
- See git history for detailed changes