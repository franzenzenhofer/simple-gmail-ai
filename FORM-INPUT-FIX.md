# Gmail Add-on Form Input Fix Documentation

## Problem
The Gmail Add-on was throwing "Missing Gemini API key" error despite the API key being visible in the form field.

## Root Cause Analysis (7 Whys)

1. **Why is the error appearing?** - API key validation throws error when empty
2. **Why is apiKey empty?** - Form input not being retrieved correctly
3. **Why is form input not retrieved?** - The code only checked `e.formInputs` (plural)
4. **Why is this a problem?** - Google Apps Script provides both `e.formInput` and `e.formInputs`
5. **Why are there two formats?** - Google provides direct access via `formInput` and array format via `formInputs`
6. **Why wasn't this documented?** - Google's documentation is inconsistent about which format to use
7. **Why did it work sometimes?** - Different deployment contexts may use different formats

## Solution

### 1. Multi-Format Support
The fix handles all possible input formats:
- `e.formInput.fieldName` (direct access)
- `e.formInputs.fieldName[0]` (array format)
- `e.formInputs.fieldName.stringValues[0]` (object format)

### 2. Fallback Mechanism
If no API key is found in the form, fall back to saved user properties.

### 3. Enhanced Error Handling
- Comprehensive logging of event structure
- Clear error messages indicating what's missing
- Debug information for troubleshooting

## Code Changes

### Before:
```javascript
const inputs = e.formInputs || {};
const apiKey = getFormValue(inputs, 'apiKey');
```

### After:
```javascript
const formInput = e.formInput || {};
const formInputs = e.formInputs || {};

let apiKey = formInput.apiKey || 
             (formInputs.apiKey && formInputs.apiKey[0]) ||
             getFormValue(formInputs, 'apiKey');

if (!apiKey || apiKey.trim() === '') {
  apiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
}
```

## Testing
Created `test-form-inputs.gs` to verify handling of:
- Standard e.formInput format
- Array format (e.formInputs)
- Object format with stringValues
- Empty form submissions
- Mixed formats

## Key Learnings

1. **Always check both `formInput` and `formInputs`** - Google Apps Script may use either
2. **Implement fallbacks** - Saved properties provide resilience
3. **Log extensively** - Event structure varies by context
4. **Test multiple formats** - Don't assume consistent input structure

## Common Pitfalls

1. Only checking `e.formInputs` (plural) misses direct access format
2. Not handling array vs object formats in formInputs
3. No fallback to saved values
4. Insufficient error logging for debugging

## Safety Features Added

- Development mode prevents accidental email sending
- Clear UI indication of current mode
- Console logging instead of actual sends in dev mode
- Explicit confirmation required for production mode