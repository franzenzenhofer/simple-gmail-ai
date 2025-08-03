# Gmail AI Support Triage - Quick Reference

## 🚀 Quick Start

1. **Install**: Deploy → Test deployments → Install
2. **Configure**: Enter your Gemini API key in the 🔑 API Key tab
3. **Run**: Click "🚀 Analyze Inbox" on the main tab

## 📋 Label Reference

| Label | Meaning | Icon |
|-------|---------|------|
| `support` | Customer support request | 📧 |
| `undefined` | Not a support request | 📄 |
| `ai✓` | Successfully processed by AI | ✅ |
| `ai✗` | Error during AI processing | ❌ |

## 🎯 Navigation

### Tabs
- **Main**: Mode selection and prompts
- **🔑 API Key**: Configure Gemini API key
- **📊 Logs**: View logs with direct links
- **⚙️ Settings**: Debug mode and options

### Three-Dot Menu
- **View Logs**: Quick access to logs
- **Toggle Debug Mode**: Enable verbose logging

## 🔧 Processing Modes

1. **Label Only** (Default)
   - Classifies emails
   - Applies labels
   - No emails sent

2. **Label + Create Drafts**
   - Everything above PLUS
   - Creates draft replies
   - Still no emails sent

3. **Auto-Reply** (🚨 DANGER)
   - Everything above PLUS
   - Actually sends emails!
   - Use with extreme caution

## 📝 Default Prompts

### Classification Prompt
```
You are an email triage assistant.
Return exactly one word:
  - support : if the email is a customer support request
  - undefined : for anything else (not support).
---------- EMAIL START ----------
```

### Response Prompt
```
You are a customer support agent.
Draft a friendly, concise reply that resolves the customer issue.
---------- ORIGINAL EMAIL ----------
```

## 📊 Logging

- **Console**: JSON structured logs
- **Spreadsheet**: Daily logs in "Gmail AI Logs" folder
- **AI Tracking**: Each request has unique ID with emojis

## ⚡ Keyboard Shortcuts

Currently, all actions require clicking. Future versions may add keyboard shortcuts.

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| No API key error | Add key in 🔑 API Key tab |
| Labels missing | Refresh Gmail |
| Add-on not visible | Reinstall test deployment |
| Logs not showing | Check spreadsheet permissions |

## 🔗 Useful Links

- [Get Gemini API Key](https://aistudio.google.com/apikey)
- [Apps Script Console](https://script.google.com)
- [Gmail Add-ons Documentation](https://developers.google.com/gmail/add-ons)