# Gmail Add-on Comprehensive Logging & Debugging Features

## Overview
The Gmail Support Triage AI add-on now includes a robust logging and debugging system that provides complete visibility into all operations.

## Key Features

### 1. **Multi-Level Logging**
- **DEBUG**: Detailed function flow, parameters, and internal state
- **INFO**: Important operations like API calls and classifications
- **WARN**: Warnings like already-processed threads
- **ERROR**: Errors with full stack traces
- **FATAL**: Critical failures

### 2. **AI Request/Response Logging**
- **Full Prompt Logging**: Every prompt sent to Gemini AI is logged
- **Response Tracking**: Complete AI responses are captured
- **Performance Metrics**: API call durations are tracked
- **Preview & Full Content**: Shows preview in INFO, full content in DEBUG mode

### 3. **Duplicate Processing Prevention**
- **AI-Processed Label**: Marks emails that have been analyzed
- **AI-Processing-Error Label**: Marks emails that failed processing
- **Search Filtering**: Excludes already-processed emails from searches
- **Safety Double-Check**: Secondary verification in processing loop

### 4. **UI Log Viewer**
- **Debug Mode Toggle**: Switch between normal and verbose logging
- **View Logs Button**: Opens log viewer card with instructions
- **Execution ID**: Unique ID for each run to track related logs
- **Settings Display**: Shows current debug mode and log level

### 5. **Log Access Methods**

#### Method 1: Google Apps Script Editor
- Open script editor
- View → Logs (or Ctrl+Enter)
- Shows console.log outputs in real-time

#### Method 2: Clasp CLI (Recommended)
```bash
# Watch logs in real-time
clasp logs --watch

# View recent logs
clasp logs
```

#### Method 3: Google Cloud Console
- Advanced option for production monitoring
- Full structured logging with filters

### 6. **Security Features**
- **API Key Masking**: Automatically masks Gemini API keys in logs
- **Sensitive Data Protection**: Masks any field with "key" or "token" in name
- **Safe Logging**: No personal email content logged without debug mode

### 7. **Performance Tracking**
- Function execution times
- API call durations
- Total analysis duration
- Thread processing metrics

## Log Examples

### Standard Operation Log
```json
{
  "timestamp": "2025-08-02T10:15:23.456Z",
  "executionId": "abc123xyz",
  "level": "INFO",
  "message": "Gmail Add-on started",
  "context": {
    "version": "1.6",
    "deployTime": "2025-08-02 10:04:57 UTC",
    "executionId": "abc123xyz"
  }
}
```

### AI Request Log (Debug Mode)
```json
{
  "timestamp": "2025-08-02T10:15:24.789Z",
  "executionId": "abc123xyz",
  "level": "INFO",
  "message": "🤖 SENDING TO GEMINI AI",
  "context": {
    "model": "gemini-2.5-flash",
    "temperature": 0.3,
    "promptLength": 512,
    "promptPreview": "You are an email triage assistant...",
    "fullPrompt": "[Full prompt content in debug mode]"
  }
}
```

### Error Log
```json
{
  "timestamp": "2025-08-02T10:15:25.123Z",
  "executionId": "abc123xyz",
  "level": "ERROR",
  "message": "Error processing thread",
  "context": {
    "threadId": "thread123",
    "subject": "Help with product issue",
    "error": {
      "message": "API rate limit exceeded",
      "stack": "[Stack trace]"
    }
  }
}
```

## Usage Instructions

### Enable Debug Mode
1. Open the Gmail Add-on
2. Scroll to "Debug & Diagnostics" section
3. Toggle "Debug Mode" switch to ON
4. Click "View Logs" to see log viewer

### View Real-Time Logs
```bash
# In terminal
clasp logs --watch
```

### Clear Log Markers
- Use "Clear Log Markers" button in log viewer
- This doesn't delete logs, just resets the cleared timestamp

## Benefits

1. **Complete Visibility**: See exactly what the add-on is doing
2. **Easy Debugging**: Identify issues quickly with detailed logs
3. **Performance Monitoring**: Track API call times and bottlenecks
4. **Security**: API keys and sensitive data are automatically masked
5. **User-Friendly**: Toggle debug mode without code changes

## Best Practices

1. **Development**: Always enable debug mode during development
2. **Production**: Use INFO level for normal operations
3. **Troubleshooting**: Enable debug mode temporarily to diagnose issues
4. **Monitoring**: Use `clasp logs --watch` for real-time monitoring
5. **Privacy**: Be mindful that debug mode logs email content

## Technical Implementation

- Modular logger integrated into single-file deployment
- Minimal performance impact (< 5ms per log)
- Automatic API key masking with regex
- Structured JSON logging for easy parsing
- Execution ID for correlating related logs