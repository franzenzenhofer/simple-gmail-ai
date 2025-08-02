# How to View AI Requests & Responses in Logs

## IMPORTANT: Enable Debug Mode First! 🐛

The AI requests and responses are only logged when Debug Mode is ON!

### Step 1: Enable Debug Mode in Gmail Add-on
1. Open Gmail
2. Click on the Gmail Support Triage AI add-on in the sidebar
3. Scroll down to **"Debug & Diagnostics"** section
4. Toggle **"Debug Mode"** to **ON** (you'll see "🐛 Debug Mode: ON")

### Step 2: Run the Analysis
1. Fill in your Gemini API key
2. Click **"Analyse & Go"**

### Step 3: View the Logs

#### Option A: In Apps Script Editor
1. Go to the Apps Script editor
2. Click the **clock icon** (Executions) in the left sidebar
3. Find the execution labeled `runAnalysis` (not `onHomepage`)
4. Click on it to see logs

#### Option B: Real-time with clasp (BEST!)
```bash
clasp logs --watch
```
Then trigger the analysis in Gmail - you'll see logs in real-time!

## What You'll See

With Debug Mode ON, you'll see:

### 1. **AI Request** (🤖 SENDING TO GEMINI AI):
```json
{
  "timestamp": "2025-08-02T10:15:24.789Z",
  "level": "INFO",
  "message": "🤖 SENDING TO GEMINI AI",
  "context": {
    "model": "gemini-2.5-flash",
    "temperature": 0.3,
    "promptLength": 512,
    "promptPreview": "You are an email triage assistant...",
    "fullPrompt": "[FULL PROMPT TEXT HERE]"  // Only visible in DEBUG mode!
  }
}
```

### 2. **AI Response** (📥 GEMINI API RESPONSE):
```json
{
  "timestamp": "2025-08-02T10:15:25.123Z",
  "level": "INFO", 
  "message": "📥 GEMINI API RESPONSE",
  "context": {
    "statusCode": 200,
    "duration": 334,
    "responseLength": 7,
    "responsePreview": "support"
  }
}
```

### 3. **AI Result** (✅ GEMINI AI RESULT):
```json
{
  "timestamp": "2025-08-02T10:15:25.124Z",
  "level": "INFO",
  "message": "✅ GEMINI AI RESULT",
  "context": {
    "rawResponse": "support",
    "trimmedResponse": "support",
    "responseLength": 7
  }
}
```

## Troubleshooting

### Not seeing AI logs?
1. **Check Debug Mode is ON** - This is the #1 reason!
2. Make sure you're looking at `runAnalysis` execution, not `onHomepage`
3. The function must actually call the AI (needs emails to process)

### To test quickly:
1. Enable Debug Mode
2. Make sure you have some emails in your inbox
3. Run the analysis
4. Look for logs with these emojis: 🤖 📥 ✅

### Using clasp for best results:
```bash
# In your terminal:
clasp logs --watch

# Then in Gmail, click "Analyse & Go"
# You'll see the logs appear in real-time!
```

## Log Levels
- With **Debug Mode OFF**: You only see basic INFO logs
- With **Debug Mode ON**: You see EVERYTHING including:
  - Full AI prompts
  - Complete responses
  - Function parameters
  - Detailed execution flow