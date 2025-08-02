# Gmail Support Triage AI

An intelligent Gmail add-on that automatically classifies and responds to customer support emails using Google's Gemini 2.5 Flash AI model.

## Features

- 🤖 **AI-Powered Classification**: Automatically identifies support requests vs. other emails
- 🏷️ **Smart Labeling**: Applies "Support Request" or "Not Support Request" labels
- ✉️ **Draft Generation**: Creates AI-generated draft replies for support emails
- ⚡ **Auto-Reply**: Can automatically send responses (use with caution!)
- 🛡️ **Safety First**: Development mode prevents accidental email sending
- 🎨 **Customizable Prompts**: Tailor AI behavior to your needs

## Safety Notice ⚠️

**IMPORTANT**: This add-on starts in DEVELOPMENT MODE by default:
- No emails will be sent
- Actions are logged to console
- Labels are still applied for testing

To enable production mode (DANGEROUS):
```javascript
// Only do this when you're ready to send real emails!
SafetyConfig.enableProductionMode('I UNDERSTAND THIS WILL SEND REAL EMAILS');
```

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

1. Login to Google:
```bash
npm run login
```

2. Deploy the add-on:
```bash
./deploy.sh
```

3. The script will:
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

1. **Enter API Key**: Paste your Gemini API key (stored securely)

2. **Choose Mode**:
   - **Label Only**: Just classifies and labels emails
   - **Create Drafts**: Also creates draft replies for support emails

3. **Optional - Enable Auto-Reply**: ⚠️ DANGEROUS - automatically sends replies

4. **Customize Prompts** (optional):
   - Modify the classification prompt
   - Adjust the reply generation prompt

5. **Click "Analyse & Go"**: Processes your emails

## Development

### Project Structure
```
simple-gmail-ai/
├── src/
│   ├── Code.ts          # Main add-on logic
│   ├── SafetyConfig.ts  # Safety mechanisms
│   └── appsscript.json  # Apps Script manifest
├── tests/               # Test files
├── dist/               # Compiled output
└── deploy.sh           # Deployment script
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and rebuild
- `npm test` - Run test suite
- `npm run push` - Push code to Apps Script
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

### Gemini API Settings

The add-on uses these Gemini settings:
- Model: `gemini-2.5-flash`
- Temperature: `0.3` (for consistent results)
- Endpoint: `generateContent`

### Email Processing

- Processes: Last 50 emails + all unread
- Labels: "Support Request" / "Not Support Request"
- Default classification: Binary (support or not)

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

```bash
npm run logs
```

## License

MIT License - See LICENSE file for details

## Contributing

1. Fork the repository
2. Create your feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Support

For issues or questions, please open a GitHub issue.