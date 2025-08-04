# Email Routing IS/SHOULD Document

## CRITICAL: Email Routing Requirements

This document defines how the Gmail AI add-on currently handles (IS) and should handle (SHOULD) email recipient selection when creating drafts or sending automated responses.

## Current State (IS)

### What Currently Happens:
1. **No recipient validation** - The system creates drafts without verifying recipients
2. **No context awareness** - AI doesn't know who should receive the response
3. **Default to reply** - Always assumes simple reply to sender
4. **No CC/BCC handling** - Ignores additional recipients
5. **No forward detection** - Cannot identify when email should be forwarded

### Current Code Flow:
```
1. AI analyzes email content
2. AI generates response text
3. System creates draft with minimal recipient logic
4. Draft uses basic Gmail reply mechanism
```

### Current Risks:
- ❌ Replies might go to wrong person (reply vs reply-all)
- ❌ Forwarded emails might reply to forwarder instead of original sender
- ❌ CC/BCC recipients might be dropped or incorrectly included
- ❌ No-reply addresses might receive responses
- ❌ Mailing lists might get individual replies

## Desired State (SHOULD)

### Core Requirements:

#### 1. Thread Context Extraction
- Extract ALL email addresses from thread:
  - Original sender (From:)
  - All recipients (To:, CC:, BCC:)
  - Reply-To: header if present
  - List headers (List-Id, List-Unsubscribe)
- Preserve threading information
- Identify email direction (inbound vs outbound)

#### 2. Intelligent Recipient Selection
```
IF email contains "please forward to..." THEN
  → Forward mode: New recipients from email content
ELSE IF email is from mailing list THEN
  → Check list reply preferences
ELSE IF email has Reply-To header THEN
  → Use Reply-To address
ELSE IF email was sent to multiple people THEN
  → Analyze content for reply vs reply-all signals:
    - "Hi all" / "Team" → Reply All
    - Direct question to group → Reply All
    - Personal/sensitive content → Reply only
ELSE
  → Standard reply to sender
```

#### 3. AI Context Enhancement
The AI prompt should include:
```
Thread Context:
- Original sender: john@example.com
- Other recipients: mary@example.com, team@company.com
- Email type: [support request / team discussion / forward]
- Suggested reply mode: [reply / reply-all / forward]

Based on the email content, who should receive the response?
```

#### 4. Safety Checks
- **No-reply detection**: Check for noreply@, no-reply@, donotreply@
- **Mailing list detection**: Check List-* headers
- **Bounce detection**: Identify mail delivery failures
- **Internal only**: Detect if reply should stay internal

#### 5. Implementation Flow
```
1. Extract full thread context
2. Analyze email patterns and headers
3. Determine email type (support/discussion/forward)
4. Pass context to AI for content analysis
5. AI suggests recipient strategy
6. Apply safety checks
7. Create draft with correct recipients
8. Log recipient decision for audit
```

### Test Scenarios Required:

1. **Simple Reply**
   - Single sender → Reply to sender only
   
2. **Reply All**
   - Multiple recipients with "Hi team" → Reply to all
   
3. **Forward Request**
   - "Please forward to John" → New recipient
   
4. **Mailing List**
   - List headers present → Follow list rules
   
5. **No-Reply Address**
   - noreply@ sender → Block response
   
6. **CC/BCC Preservation**
   - Original has CC → Preserve in reply-all
   
7. **Thread Hijacking**
   - Changed subject → Detect new conversation

### Success Metrics:
- 100% correct recipient selection in test cases
- 0% emails to no-reply addresses
- Clear audit trail of recipient decisions
- User override capability

## Implementation Priority:
1. **Phase 1**: Extract thread context (CRITICAL)
2. **Phase 2**: Add safety checks for no-reply
3. **Phase 3**: Implement reply vs reply-all logic
4. **Phase 4**: Add AI recipient suggestions
5. **Phase 5**: Handle forward scenarios

## Code Architecture:
```typescript
interface EmailContext {
  originalSender: string;
  replyTo?: string;
  allRecipients: {
    to: string[];
    cc: string[];
    bcc: string[];
  };
  threadId: string;
  isMailingList: boolean;
  hasNoReply: boolean;
  suggestedMode: 'reply' | 'reply-all' | 'forward';
}

interface RecipientDecision {
  to: string[];
  cc?: string[];
  bcc?: string[];
  reason: string;
  mode: 'reply' | 'reply-all' | 'forward';
}
```

## CRITICAL: Testing Requirements
- Unit tests for EVERY recipient scenario
- Integration tests with real Gmail threads
- Manual verification of high-risk cases
- Rollback plan if issues detected

---

**WARNING**: Email routing errors can cause significant problems:
- Privacy breaches (wrong recipients)
- Spam complaints (mailing list errors)  
- Professional damage (reply-all disasters)

This MUST be implemented with extreme care and comprehensive testing.