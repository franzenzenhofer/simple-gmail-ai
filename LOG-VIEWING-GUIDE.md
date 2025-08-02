# How to View Logs in Google Apps Script Editor

## Quick Access to Logs

### 1. **In the Apps Script Editor**:
   - Open your script: https://script.google.com/d/1rsJQPU1V1CIHbxfz4SZbZu3sYmK8eEcXuGUM_-no1Mtr0rNbu-RHq6Xt/edit
   - Click **"View"** in the top menu
   - Select **"Logs"** (or press **Ctrl+Enter** / **Cmd+Enter**)
   - A panel will open at the bottom showing console.log outputs

### 2. **Using Executions Tab** (Best for Add-ons):
   - In the Apps Script editor sidebar, click **"Executions"** (clock icon)
   - You'll see a list of all function executions
   - Click on any execution to see its logs
   - Look for entries marked with timestamps and log levels

### 3. **Real-time Logs with clasp** (Recommended):
   Open your terminal and run:
   ```bash
   clasp logs --watch
   ```
   This shows logs in real-time as the add-on runs.

### 4. **Cloud Logging** (Advanced):
   - Click the **"Project Settings"** gear icon in the Apps Script editor
   - Find your **Cloud Platform project number**
   - Click the link to open Google Cloud Console
   - Navigate to **Logging** → **Logs Explorer**
   - Filter by `resource.type="apps_script_function"`

## What You'll See in Logs

Our add-on uses structured JSON logging, so you'll see entries like:

```json
{
  "timestamp": "2025-08-02T10:15:23.456Z",
  "executionId": "abc123xyz",
  "level": "INFO",
  "message": "Gmail Add-on started",
  "context": {
    "version": "1.8",
    "deployTime": "2025-08-02 10:12:33 UTC"
  }
}
```

## Debugging Tips

1. **Enable Debug Mode** first:
   - Open the Gmail add-on
   - Go to "Debug & Diagnostics"
   - Toggle "Debug Mode" to ON
   - Now you'll see much more detailed logs

2. **Look for Key Log Messages**:
   - `"Gmail Add-on started"` - Add-on initialization
   - `"🤖 SENDING TO GEMINI AI"` - AI requests
   - `"📥 GEMINI API RESPONSE"` - AI responses
   - `"Thread classified as SUPPORT/NOT SUPPORT"` - Classification results

3. **Common Issues**:
   - If you see no logs, make sure you're looking at the right execution
   - If logs are truncated, use `clasp logs` instead
   - For real-time debugging, always use `clasp logs --watch`

## Testing the Logger

To test if logging is working, run this in the Apps Script editor:

1. Open the script editor
2. Select the `onHomepage` function from the dropdown
3. Click "Run" button
4. Press Ctrl+Enter to open logs
5. You should see the startup logs

## Log Levels

- **DEBUG**: Detailed function flow (only in debug mode)
- **INFO**: Important operations
- **WARN**: Warnings like duplicate processing
- **ERROR**: Errors with stack traces

Remember: API keys are automatically masked in logs for security!