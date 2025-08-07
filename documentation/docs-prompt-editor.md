# Google Docs Prompt Editor

The Google Docs Prompt Editor is an advanced feature that allows you to manage AI prompts using a Google Docs document. This provides a more flexible and user-friendly interface for customizing prompts, especially for complex labeling scenarios.

## Overview

Instead of using the simple text fields in the Gmail add-on UI, you can create a Google Docs document that contains:
- Label definitions and criteria
- Per-label custom classification prompts
- Per-label custom response prompts
- Priority ordering for label matching

## Key Benefits

1. **Per-Label Customization**: Define different AI prompts for different types of emails
2. **Visual Editing**: Use Google Docs' familiar interface for editing
3. **Version Control**: Leverage Google Docs' built-in version history
4. **Collaboration**: Multiple team members can collaborate on prompt optimization
5. **Complex Rules**: Support for sophisticated labeling hierarchies

## Getting Started

### 1. Access the Prompt Editor

From the Gmail add-on:
1. Open the Gmail add-on sidebar
2. Click the "📝 Open Docs Prompt Editor" button
3. Click "Create Prompt Document" to generate a new configuration document

### 2. Document Structure

The document is organized into sections:

#### Section A: Instructions
- Usage guidelines
- Best practices
- Who should edit the document

#### Section B: Label Registry
A table containing:
- **Label**: The Gmail label name to apply
- **Criteria**: Human-readable description of when to apply this label
- **Order**: Priority order (lower numbers = higher priority)
- **Actions?**: Whether to generate responses for this label

Example:
| Label | Criteria | Order | Actions? |
|-------|----------|-------|----------|
| Support | mentions "help", "support", or "issue" | 10 | YES |
| Refund | mentions "refund", "money back", or "chargeback" | 20 | YES |
| Bug | mentions "bug", "error", or "broken" | 30 | YES |
| undefined | (catch-all for unmatched emails) | 9999 | YES |

#### Section C: Label-Specific Prompts
Individual prompts for each label with actions enabled:
- C.1: Overall classification prompt (applies to all labels)
- C.2, C.3, etc.: Response prompts for specific labels

#### Section D: Undefined Prompt
Special handling for emails that don't match any specific label.

### 3. Editing Prompts

1. **Classification Prompt** (C.1): Edit the overall prompt that determines how emails are classified
2. **Response Prompts** (C.2+): Edit the JSON-formatted prompts that control how responses are generated

Example response prompt:
```json
{
  "instructions": "Draft a helpful response acknowledging their support request and providing initial guidance",
  "tone": "helpful and professional"
}
```

### 4. Saving Changes

After editing:
1. Return to the Gmail add-on
2. Click "Save & Go Live" in the prompt editor
3. The system will validate your document and compile the prompts

## Best Practices

### Label Design
- Keep label names short and descriptive
- Use consistent naming conventions
- Order labels from most specific to most general
- Always include an "undefined" catch-all label

### Prompt Writing
- Be specific about classification criteria
- Use clear, actionable language in response prompts
- Test prompts with sample emails before going live
- Include tone and style guidance in response prompts

### Version Control
- Use Google Docs' "Name current version" feature before major changes
- Document changes in version descriptions
- Test changes in a development environment first

## Advanced Features

### Label Priority
The "Order" column determines which label is applied when multiple labels could match:
- Lower numbers = higher priority
- Example: If an email matches both "Refund" (order 20) and "Support" (order 10), "Support" will be applied

### Conditional Actions
Set "Actions?" to NO for labels that should only categorize emails without generating responses.

### Complex Criteria
While the "Criteria" column is for human reference, the actual classification is controlled by the AI prompt in Section C.1. Make sure these align.

## Troubleshooting

### Validation Errors
- **Duplicate labels**: Each label must appear only once in the registry
- **Missing undefined**: The "undefined" label is required
- **Invalid order**: Order values must be positive numbers

### Common Issues
1. **Changes not taking effect**: Remember to click "Save & Go Live" after editing
2. **Classification errors**: Check that your overall prompt (C.1) aligns with your label criteria
3. **Response quality**: Ensure response prompts include clear instructions and tone guidance

## Integration with Gmail Processing

When processing emails:
1. The system checks if a Docs-based configuration exists
2. For each email, it finds matching labels based on the email's current Gmail labels
3. It uses the most specific matching prompt configuration
4. Falls back to default prompts if no Docs configuration is found

This allows for sophisticated prompt management while maintaining backward compatibility with the simple prompt system.