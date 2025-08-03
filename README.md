# Gmail Support Triage AI

[![CI](https://github.com/franzenzenhofer/simple-gmail-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/franzenzenhofer/simple-gmail-ai/actions/workflows/ci.yml)
[![Deploy](https://github.com/franzenzenhofer/simple-gmail-ai/actions/workflows/deploy.yml/badge.svg)](https://github.com/franzenzenhofer/simple-gmail-ai/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An intelligent Gmail add-on that automatically classifies and responds to customer support emails using Google's Gemini 2.5 Flash AI model.

## 🚀 What's New in v2.6.0

- **Google Docs Prompt Editor**: Advanced prompt management with per-label customization
- **Smart Email Delta Processing**: Efficient scanning of new emails since last run
- **Enhanced Error Recovery**: Graceful fallback when Docs API fails
- **Improved Modularity**: Better code organization with 30+ focused modules
- **Comprehensive Test Coverage**: 380+ tests ensuring reliability

### Previous Updates (v1.9.0)
- **Modular Architecture**: Clean, maintainable code structure
- **Enhanced UI/UX**: Tab-based navigation for better user experience
- **Comprehensive Logging**: Automatic spreadsheet logging with daily rotation
- **Shorter Labels: `Support`, `General`, `ai✓`, `aiX`
- **Three-Dot Menu**: Quick access to logs and settings

## Features

- 🤖 **AI-Powered Classification**: Automatically identifies support requests vs. other emails
- 🏷️ **Smart Labeling**: Clean labels: `Support`, `General`, `ai✓`, `aiX`
- ✉️ **Draft Generation**: Creates AI-generated draft replies for support emails
- ⚡ **Auto-Reply**: Can automatically send responses (use with caution!)
- 📊 **Spreadsheet Logging**: All activity logged to Google Sheets with daily rotation
- 🎨 **Customizable Prompts**: Tailor AI behavior to your needs
- 🗂️ **Tab Navigation**: Clean interface with Main, API Key, Logs, and Settings tabs
- 📝 **Google Docs Prompt Editor**: Advanced per-label prompt customization
- 🔄 **Smart Delta Processing**: Only process new emails since last run

## Safety Notice ⚠️

**IMPORTANT**: Email sending is controlled by your mode selection:
- **Label Only Mode** (default): Only applies labels, no emails sent
- **Draft Mode**: Creates draft replies, no emails sent
- **Auto-Reply Mode**: DANGEROUS - Actually sends emails!

The auto-reply checkbox includes a clear warning (🚨) to prevent accidental activation.

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Google account with Gmail access
- Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd simple-gmail-ai
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Deployment

### First Time Setup

1. Configure your Google Apps Script project:
```bash
# Copy the template to create your own configuration
cp .clasp.json.template .clasp.json

# Edit .clasp.json with your project details:
# - scriptId: Get this from your Apps Script project URL
# - projectId: Get this from Google Cloud Console
```

2. Login to Google:
```bash
npm run login
```

3. Deploy the add-on:
```bash
./deploy.sh
```

4. The script will:
   - Create a new Apps Script project
   - Push the code
   - Provide you with URLs to access the project

### Testing the Add-on

1. Open the Apps Script editor:
```bash
npm run open
```

2. In the Apps Script editor:
   - Click "Deploy" > "Test deployments"
   - Click "Install"
   - Click "Done"

3. Open Gmail and look for the add-on icon in the right sidebar

## Usage

### Main Tab
1. **Choose Processing Mode**:
   - **Label Only**: Just classifies and labels emails
   - **Create Drafts**: Also creates draft replies for support emails

2. **Optional - Enable Auto-Reply**: 🚨 DANGEROUS - automatically sends replies

3. **Customize Prompts**:
   - **Classification Prompt**: How to identify support emails
   - **Response Prompt**: How to draft replies

4. **Click "🚀 Analyze Inbox"**: Processes your emails

### Other Tabs
- **🔑 API Key**: Configure your Gemini API key
- **📊 Logs**: View execution logs and spreadsheets with direct links
- **⚙️ Settings**: Toggle debug mode and spreadsheet logging

### Three-Dot Menu
- **View Logs**: Quick access to logs from anywhere
- **Toggle Debug Mode**: Enable/disable verbose logging

### Google Docs Prompt Editor (Advanced)
For more sophisticated prompt management:
1. Click **"📝 Open Docs Prompt Editor"** from the main interface
2. Create or open your prompt configuration document
3. Define per-label prompts and classification rules
4. Save and compile your changes

See [docs-prompt-editor.md](documentation/docs-prompt-editor.md) for detailed instructions.

## Development

### Project Structure
```
simple-gmail-ai/
├── src/
│   ├── modules/         # Modular architecture
│   │   ├── config.ts    # Configuration & constants
│   │   ├── types.ts     # TypeScript interfaces
│   │   ├── logger.ts    # Logging system
│   │   ├── ai.ts        # Gemini API integration
│   │   ├── gmail.ts     # Gmail processing
│   │   ├── ui.ts        # UI building functions
│   │   ├── docs-prompt-editor.ts  # Google Docs integration
│   │   └── ... (30+ modules)
│   │   └── utils.ts     # Utility functions
│   ├── Code.ts          # Main entry point
│   ├── SafetyConfig.ts  # Safety mechanisms
│   └── appsscript.json  # Apps Script manifest
├── tests/               # Test files
├── dist/               # Bundled output (single file)
└── bundle.js           # Module bundler
```

### Available Scripts

- `npm run build` - Compile TypeScript and bundle modules
- `npm run watch` - Watch for changes and rebuild
- `npm test` - Run test suite
- `npm run lint` - Type check with TypeScript
- `npm run push` - Push code to Apps Script
- `npm run deploy` - Full deployment with version bump
- `npm run open` - Open in Apps Script editor
- `npm run logs` - View Apps Script logs

### Testing

Run the test suite:
```bash
npm test
```

Tests cover:
- Form value extraction
- Email classification logic
- API configuration
- Error handling
- Development mode safety

## Configuration

### OAuth Scopes & Permissions

The Gmail add-on requests the following OAuth scopes for specific functionality:

**Core Gmail Features:**
- `https://www.googleapis.com/auth/gmail.addons.execute` - **Required** for Gmail add-on functionality
- `https://www.googleapis.com/auth/userinfo.email` - **Required** for user identification
- `https://www.googleapis.com/auth/gmail.modify` - **Required** for applying/removing labels
- `https://www.googleapis.com/auth/gmail.labels` - **Required** for creating and managing Gmail labels
- `https://www.googleapis.com/auth/gmail.send` - **Optional** for auto-reply feature (only when enabled)
- `https://www.googleapis.com/auth/gmail.compose` - **Optional** for creating draft replies

**Advanced Features:**
- `https://www.googleapis.com/auth/script.external_request` - **Required** for calling Gemini API
- `https://www.googleapis.com/auth/spreadsheets` - **Optional** for spreadsheet logging feature
- `https://www.googleapis.com/auth/drive` - **Optional** for Google Docs prompt editor feature
- `https://www.googleapis.com/auth/documents` - **Optional** for Google Docs prompt editor feature

**Note**: Drive and Documents permissions are only used if you enable the Google Docs Prompt Editor feature. All other scopes are required for core functionality. Your data remains private and is never shared with third parties.

### Gemini API Settings

The add-on uses these Gemini settings:
- Model: `gemini-2.5-flash`
- Temperature: `0.3` (for consistent results)
- Endpoint: `generateContent`

### Email Processing

- Processes: Last 50 emails + all unread
- Labels: `support`, `undefined`, `ai✓`, `ai✗`
- Default classification: Binary (support or not)
- Skips already processed emails (with `ai✓` label)

### Logging System

**Console Logging**:
- JSON structured logs with execution ID
- Log levels: DEBUG, INFO, WARN, ERROR
- Sensitive data automatically masked

**Spreadsheet Logging** (Default ON):
- Creates "Gmail AI Logs" folder in Google Drive
- Daily log rotation (one spreadsheet per day)
- Direct clickable links in Logs tab
- Includes: timestamp, execution ID, level, message, context
- Color-coded rows by severity

**AI Request/Response Tracking**:
- Unique request IDs link requests to responses
- Emojis for quick visual scanning:
  - 🚀 AI REQUEST
  - 📨 AI RESPONSE
  - ✅ AI RESULT
  - ❌ AI ERROR

## Troubleshooting

### Common Issues

1. **"Missing Gemini API key"**
   - Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Make sure to paste it in the add-on

2. **Labels not appearing**
   - Refresh Gmail
   - Check the Labels section in Gmail settings

3. **Add-on not visible**
   - Make sure you installed the test deployment
   - Try reloading Gmail
   - Check browser console for errors

### Viewing Logs

**In the Add-on**:
1. Click the three-dot menu → "View Logs"
2. Or navigate to the 📊 Logs tab
3. Click direct links to open spreadsheets

**From Command Line**:
```bash
npm run logs  # View Apps Script console logs
```

## License

MIT License - See LICENSE file for details

## Contributing

1. Fork the repository
2. Create your feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## CI/CD

This project uses GitHub Actions for continuous integration and deployment:

- **CI Pipeline**: Runs on every push and pull request
  - Tests on Node.js 18.x and 20.x
  - Runs linter and all test suites
  - Verifies bundle size
  - Uploads test results as artifacts

- **Deploy Pipeline**: Triggered by version tags (v*)
  - Runs full pre-deployment checks
  - Builds and deploys to Google Apps Script
  - Creates GitHub releases automatically

## Support

For issues or questions, please open a GitHub issue.