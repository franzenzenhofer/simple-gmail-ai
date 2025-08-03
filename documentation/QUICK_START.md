# Quick Start Guide

## 5-Minute Setup

### 1. Get a Gemini API Key
Visit: https://makersuite.google.com/app/apikey

### 2. Install & Build
```bash
npm install
npm run build
```

### 3. Deploy
```bash
# Login to Google (first time only)
npm run login

# Deploy the add-on
./deploy.sh
```

### 4. Install in Gmail
1. Run `npm run open` to open Apps Script editor
2. Click "Deploy" > "Test deployments"
3. Click "Install" > "Done"

### 5. Use in Gmail
1. Open Gmail
2. Click the add-on icon in right sidebar
3. Enter your Gemini API key
4. Click "Analyse & Go"

## That's it! 🎉

Your emails are now being classified. Check the labels in Gmail.

⚠️ **Remember**: The add-on is in DEVELOPMENT MODE by default (no emails sent).