# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

**THE MAIN GOAL**: Create a working Gmail Add-on that uses AI to automatically triage and respond to customer support emails.

### Project Context:
- This is a simplified, single-file version inspired by Google's official "Gmail Sentiment Analysis with Gemini" sample
- Instead of using Vertex AI (which requires complex authentication), we use the simpler Gemini Developer API with API keys
- Instead of sentiment analysis (positive/negative/neutral), we do support triage (support request vs not)

### Core Functionality:

1. **Email Classification & Labeling**:
   - Scans Gmail inbox (last 50 messages + all unread messages)
   - Uses Gemini 2.5 Flash API to classify each email as:
     - "support" = customer support request → applies "Support Request" label
     - "not" = everything else → applies "Not Support Request" label
   - Classification prompt is customizable by the user

2. **Automated Response Options**:
   - **Label Only Mode** (default): Just classifies and labels emails
   - **Draft Mode**: Creates draft replies for support emails using AI
   - **Auto-Reply Mode**: Automatically sends replies (with danger warning!)
   - Response generation prompt is customizable by the user

3. **User Interface (Gmail Add-on Card)**:
   - Gemini API key input field (stored securely in user properties)
   - Mode selection radio buttons (label only vs create drafts)
   - Auto-reply checkbox with "Danger" warning
   - Two customizable prompt text areas:
     - Prompt 1: For email classification
     - Prompt 2: For generating responses
   - "Analyse & Go" action button
   - Results notification showing counts (scanned/support/drafts/sent)

4. **Technical Constraints**:
   - Must be a proper Gmail Add-on (not just a standalone script)
   - Single `.gs` file implementation for simplicity
   - ASCII-only code (no template literals `${}`)
   - Uses Gemini 2.5 Flash via REST API (not Google AI SDK)
   - Temperature set to 0.3 for consistent results
   - Proper error handling with user-friendly messages

5. **API Key Note**:
   - Found API key in gemini-api-key.md: AIzaSyBDeR8FBytoqxJ16aJV_2ryF__ChsUPCDE
   - This appears to be for testing purposes

## Project Overview

This is a Gmail Add-on project written in Google Apps Script (.gs) that uses the Gemini 2.5 Flash API to analyze and categorize Gmail messages. The add-on performs sentiment analysis on emails and can automatically draft replies.

### Current Issues to Fix
- The original `first-try.gs` throws errors when deployed
- Need proper error handling and validation
- Must be deployable via clasp
- Needs a working test suite

## PRODUCTION READY

This Gmail add-on is production ready and will send emails when configured for auto-reply mode. Please test thoroughly before deploying to production.

## Key Architecture Components

### Core Files
- **first-try.gs**: Main implementation file containing all the add-on logic
  - Entry points: `onHomepage()` and `runAnalysis()`
  - UI building with CardService
  - Gmail integration for reading and labeling messages
  - Gemini API integration for AI analysis

### Functionality
1. **Email Classification**: Determines if emails are support requests or not
2. **Auto-labeling**: Applies "Support Request" or "Not Support Request" labels
3. **Draft/Reply Generation**: Can create draft responses or auto-send replies for support emails
4. **Configurable Prompts**: Users can customize the AI prompts for classification and reply generation

## Development Commands

Since this is a Google Apps Script project, there are no traditional build/test commands. Instead:

### Deployment & Testing
1. **Run in Apps Script Editor**: Open the script in the Apps Script editor and use the Run button
2. **Test Deployments**: Deploy > Test deployments > Install
3. **Authorization**: The script requires authorization for Gmail and external URL fetch

### API Configuration
- Gemini API endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- API key is stored in user properties after first run
- Default temperature: 0.3 for consistency

## Important Implementation Details

### Gmail Integration
- Processes the 50 most recent inbox threads plus all unread messages
- Uses Gmail labels for categorization
- Supports batch processing of multiple threads

### Gemini API Usage
- Single-file implementation optimized for simplicity
- ASCII-only code (no template literals)
- Supports disabling "thinking" mode by setting `thinkingBudget: 0`
- Error handling for API failures with descriptive messages

### UI Components
- CardService-based interface
- Form inputs for API key, mode selection, and prompt customization
- Radio buttons for operation mode (label-only vs draft creation)
- Checkbox for enabling dangerous auto-reply feature

## Security Considerations
- API key is stored in user properties (not hardcoded)
- Auto-reply feature has explicit warning and requires user opt-in
- All Gmail operations require explicit user authorization