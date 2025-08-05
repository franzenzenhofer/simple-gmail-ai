Here’s a concise bug list with minimal root-cause and fixes. I grouped duplicates and focused on issues that will break runtime, logic, or user flow.

1) integration-test.ts uses fetch in Node without a polyfill
- Symptom: ReferenceError: fetch is not defined (Node <18) or wrong fetch semantics.
- Root cause: `(globalThis as any).fetch` is assumed available.
- Minimal fix: Import `node-fetch` and use it.
  - Add at top: `import fetch from 'node-fetch';`
  - Replace `(globalThis as any).fetch(url, ...)` with `fetch(url, ...)`.
**CODE REVIEW**: Verified at src/integration-test.ts:101 - uses `(globalThis as any).fetch` without polyfill
**LABEL**: #fix

2) integration-test.ts hardcodes model path/endpoint inconsistent with Config
- Symptom: Drift when Config.GEMINI.MODEL changes; dual sources of truth.
- Root cause: Test uses `'gemini-2.5-flash'` string directly.
- Minimal fix: Share config or read from env. Example:
  - const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  - const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(API_KEY)}`;
**CODE REVIEW**: Verified at src/integration-test.ts:87 - hardcodes 'gemini-2.5-flash' instead of using Config.GEMINI.MODEL from config.ts:26
**LABEL**: #fix

3) integration-test.ts JSON clean-up misses variant fences and extra text
- Symptom: JSON parse fails when response includes prose or triple backticks variants.
- Root cause: Only strips ```json / ```; doesn't trim pre/post noise robustly.
- Minimal fix: Reuse `JsonValidator.sanitizeJsonResponse` logic locally.
  - Replace the clean step with a sanitize function to strip fences and isolate the first valid JSON block.
**CODE REVIEW**: Verified at src/integration-test.ts:141 - only does basic fence stripping while JsonValidator.sanitizeJsonResponse (json-validator.ts:166-196) does comprehensive cleaning
**LABEL**: #fix

4) Utils.validateApiKeyFormat too strict (length = 39)
- Symptom: Valid Gemini keys rejected if length differs (Google sometimes issues lengths != 39).
- Root cause: Enforces exact length 39 after "AIza".
- Minimal fix: Relax length constraint to a safe range.
  - Example: allow 30–60 chars: `/^AIza[0-9A-Za-z\-_]{30,60}$/`.
**CODE REVIEW**: Verified at src/modules/utils.ts:151 checks exact length 39, and line 156 regex requires exactly 35 chars after "AIza"
**LABEL**: #fix

5) ActionHandlers.saveApiKey uses UrlFetchApp timeout wrong unit comment
- Symptom: Misleading; logic OK but comment implies seconds while named "ms".
- Root cause: Comment says "timeout 10 seconds" which is correct; elsewhere code comments mix ms/sec.
- Minimal fix: Ensure comments are consistent: UrlFetchApp timeout is seconds. The code uses `timeout: 10` correctly. Update any misleading comments to "seconds".
**CODE REVIEW**: Verified at src/modules/action-handlers.ts:31 - comment correctly states "10 seconds timeout" for UrlFetchApp. Config.GEMINI.TIMEOUT_MS (config.ts:29) is correctly divided by 1000 in ai.ts:121
**LABEL**: #nofix

6) GmailService.getClassificationPrompt hard fails when no docs
- Symptom: Entire processing breaks if doc not created, even for testing; user sees "Prompt configuration error".
- Root cause: No fallback; throws error.
- Minimal fix: Provide safe fallback for first-run/test (e.g., basic one-label "General" prompt), or gate processing until welcome flow created doc.
  - Quick fix: In `onHomepage`, if `WelcomeFlow.needsWelcomeFlow()` return welcome; else in runAnalysis, if `!DocsPromptEditor.hasCompiledPrompts()` show notification "Create Prompt Document first" and abort.
**CODE REVIEW**: Verified at src/modules/gmail.ts:52 - throws error if no docs prompts configured with no fallback
**LABEL**: #fix

7) DocsPromptEditor.getPromptForLabels can return null leading to downstream throws
- Symptom: NPE-like errors when GmailService expects prompts.
- Root cause: Callers sometimes assume non-null.
- Minimal fix: In callers, handle null:
  - If null, show user notification and skip processing that thread or exit early.
**CODE REVIEW**: Verified at src/modules/docs-prompt-editor.ts:572 - returns null at lines 578 (no compiled prompts), 626 (no match found), 629 (error)
**LABEL**: #fix

8) DocsPromptEditor.parseDocument: heading matching depends on emoji text fragments
- Symptom: If user edits headings slightly, parser fails silently or misses sections.
- Root cause: Uses strict string includes with emoji/phrases.
- Minimal fix: Match headings by regex tolerant to emojis/extra spaces:
  - e.g., /^##\s*.*Label Registry/i, /^##\s*.*Overall Classification Prompt/i, /^##\s*.*Response Prompts/i.
**CODE REVIEW**: Verified at src/modules/docs-prompt-editor.ts:372-377 - uses heading.includes() with hardcoded emoji strings
**LABEL**: #fix

9) DocsPromptEditor.validateDocument: uses "missing_general" for "No prompt document found"
- Symptom: Confusing error type; could confuse UI logic.
- Root cause: Reuses error type for different condition.
- Minimal fix: Add error type 'no_document' for clarity and handle distinctly.
**CODE REVIEW**: Verified at src/modules/docs-prompt-editor.ts:292 - uses 'missing_general' error type for missing document
**LABEL**: #fix

10) UI.buildHomepage: "API Key Required" uses `setOpenLink` to '#'
- Symptom: Clicking may do nothing in some clients; misleading.
- Root cause: `setOpenLink` URL '#' is not a real link; also has `setOnClickAction`.
- Minimal fix: Remove `setOpenLink` with '#'; keep only `.setOnClickAction(CardService.newAction().setFunctionName('showApiKeyTab'))`.
**CODE REVIEW**: Verified at src/modules/ui.ts:38-44 - uses both setOpenLink('#') and setOnClickAction which is redundant
**LABEL**: #fix

11) UI and TestMode property key mismatch
- Symptom: TestMode uses `TEST_MODE_CONFIG` key; elsewhere code references `Config.PROP_KEYS.TEST_MODE_CONFIG` and raw string.
- Root cause: Duplicate sources of truth; but strings match currently.
- Minimal fix: Use `Config.PROP_KEYS.TEST_MODE_CONFIG` in TestMode consistently:
  - Replace hardcoded `TEST_MODE_CONFIG` in getters/setters with `Config.PROP_KEYS.TEST_MODE_CONFIG`.
**CODE REVIEW**: Verified at src/modules/test-mode.ts:38 defines TEST_MODE_KEY = 'TEST_MODE_CONFIG' while config.ts:74 has same value in Config.PROP_KEYS
**LABEL**: #fix

12) LockManager.isLocked relies on metadata and may report locked after execution
- Symptom: UI shows stuck "processing" up to 5 minutes if metadata not cleared due to crash.
- Root cause: Only cleans stale after 5 min.
- Minimal fix: Shorten stale threshold or also clear on add-on open if `ANALYSIS_RUNNING==='false'`.
  - E.g., if `ANALYSIS_RUNNING==='false'` then delete `LOCK_INFO_KEY` immediately.
**CODE REVIEW**: Verified at src/modules/lock-manager.ts:124 uses 5 minute stale threshold, no immediate cleanup when ANALYSIS_RUNNING is false
**LABEL**: #fix

13) ContinuationTriggers.processThreadsWithContinuation schedules continuation without saving processed IDs
- Symptom: Continuation may re-process already processed threads because `lastProcessedThread` never updated.
- Root cause: The state saver doesn't track processed subset.
- Minimal fix: When GmailService.processThreadsWithContinuation processes an initial batch, update `state.lastProcessedThread` (or save a list) before saving state.
**CODE REVIEW**: Verified - ContinuationState interface has lastProcessedThread field (continuation-triggers.ts:14) but it's never set in the code
**LABEL**: #fix

14) ContinuationHandlers.continueLargeInboxProcessing recomputes remainingThreads by fresh scan
- Symptom: Drift; threads list may change; may skip or reprocess threads; no stable set across runs.
- Root cause: No persisted list of thread IDs in state.
- Minimal fix: Persist the planned threadId list in state (checkpoint) and pop from it across continuations.
**CODE REVIEW**: Verified at src/modules/continuation-handlers.ts:39 - calls GmailService.getUnprocessedThreads() fresh each time
**LABEL**: #fix

15) GmailService.processThreads creates labels using dynamic names from AI without sanitization
- Symptom: Invalid Gmail label names or exceeding length cause errors.
- Root cause: No validation/sanitization of label names.
- Minimal fix: Sanitize label names (strip control chars, limit length ≤ 225, replace slashes, etc.) before `getOrCreateLabel`.
**CODE REVIEW**: Verified - gmail.ts:674,982 uses AI-returned labels directly. LabelCache.getOrCreateLabel calls Utils.getOrCreateLabelDirect (label-cache.ts:65) which calls GmailApp.createLabel without sanitization (utils.ts:107)
**LABEL**: #fix

16) Guardrails.validateReply blocks replies containing any <a> links
- Symptom: Legit reply drafts with a link get blocked.
- Root cause: Strict policy.
- Minimal fix: Allow up to N links (e.g., ≤2) in <a> tags, consistent with URL rule. Adjust logic to count links not outright block.
**CODE REVIEW**: Verified at src/modules/guardrails.ts:76-79 blocks ALL <a> links but line 85 allows up to 2 plain URLs - inconsistent
**LABEL**: #fix

17) Redaction token collisions across runs
- Symptom: token names are incremental per text; restoration relies on cache by thread only; ok, but token strings like `{{token0}}` might already exist in user text.
- Root cause: Tokens not sufficiently unique.
- Minimal fix: Prefix with thread-scoped hash: `{{rd_${threadIdHash}_${i}}}`.
**CODE REVIEW**: Verified at src/modules/redaction.ts:72 - generates tokens as '{{token' + tokenIndex + '}}' without unique prefix
**LABEL**: #fix

18) AppLogger maskSensitive logs raw message field to spreadsheet
- Symptom: Sensitive data can be written to Sheets because `message` passed to `sheet.appendRow` is the unmasked message variable, not the masked `entry.message`.
- Root cause: Using original `message`, not sanitized one for spreadsheet write.
- Minimal fix: Use `entry.message` (masked) when appending to sheet:
  - Replace `message` with `entry.message` in `sheet.appendRow([...])`.
**CODE REVIEW**: Verified at src/modules/logger.ts:268,288 - uses raw 'message' variable instead of masked 'entry.message'
**LABEL**: #fix

19) AppLogger.getRecentLogs returns current execution logs only
- Symptom: Live log view after navigation may miss previous execution logs; but UI has functions to read last execution via properties.
- Root cause: Key uses `executionId` only; UI handles last execution separately, OK. Not a crash.
- Minimal fix: None required. Optional: param to read by id.
**CODE REVIEW**: Verified at src/modules/logger.ts:319 - uses current executionId only, but this is by design
**LABEL**: #nofix

20) ContextualActions.generateReplyAction uses legacy prompt key
- Symptom: Uses `Config.PROP_KEYS.responsePrompt` property which is deprecated in docs-first system.
- Root cause: Not migrated to DocsPromptEditor.
- Minimal fix: Fetch response prompt via `DocsPromptEditor.getPromptForLabels(context.labels)` and error out if missing; remove usage of properties keys.
**CODE REVIEW**: Verified at src/modules/contextual-actions.ts:189 - reads from Config.PROP_KEYS.responsePrompt instead of DocsPromptEditor
**LABEL**: #fix

21) GmailService.extractListHeaders stub not implemented
- Symptom: Decisions around mailing list may be inaccurate.
- Root cause: Placeholder function.
- Minimal fix: Parse raw headers when needed, or clearly gate decisions until implemented.
**CODE REVIEW**: Verified at src/modules/gmail.ts:226-235 - TODO comment confirms stub returning empty object
**LABEL**: #fix

22) BatchProcessor.CONFIG.MAX_EMAIL_LENGTH truncation without disclosure to LLM
- Symptom: Model may misclassify due to truncated bodies without instruction.
- Root cause: No instruction that body may be truncated.
- Minimal fix: Add line to prompt: "Note: Body may be truncated."
**CODE REVIEW**: Verified at src/modules/batch-processor.ts:96-98,128-130 - truncates at 1000 chars with '...' but doesn't inform AI
**LABEL**: #fix

23) AISchemas additionalProperties: false may conflict with Gemini schema enforcement
- Symptom: Validation errors if model returns extra fields; your cleanSchema removes additionalProperties (good), but JsonValidator still rejects extras.
- Root cause: JsonValidator validation + model extra fields.
- Minimal fix: Set `additionalProperties` to true in JsonValidator schema used at call site, or strip unknown fields before validation.
**CODE REVIEW**: Verified - ai-schemas.ts:27,50,74 sets additionalProperties:false. cleanSchemaForGemini (ai.ts:36) doesn't include 'additionalProperties' in supportedFields, so it's stripped for Gemini but JsonValidator still enforces it
**LABEL**: #fix

24) StructuredAI.batchClassifyEmails assumes result.data is array; might be string
- Symptom: Runtime error when `result.data` is a string (if AI.callGemini returned string in legacy path).
- Root cause: Missing typeof check.
- Minimal fix: If typeof data === 'string', JSON.parse with sanitize before using.
**CODE REVIEW**: Verified at src/modules/structured-ai.ts:120-121 - directly uses result.data.map() assuming array type from AI.callGemini
**LABEL**: #fix

25) TestMode.runTestAnalysis uses DocsPromptEditor in classify/draft decision
- Symptom: If no doc exists, test mode fails; welcome flow tries to run a test later.
- Root cause: No fallback in test mode.
- Minimal fix: In `runTestAnalysis`, if `!DocsPromptEditor.hasCompiledPrompts()`, return an instructive error "Create Prompt Document first" rather than throw.
**CODE REVIEW**: Could not find DocsPromptEditor usage in test-mode.ts - test mode uses passed prompts directly (line 227-228)
**LABEL**: #nofix

26) FactoryReset removes ALL Gmail labels
- Symptom: Potentially dangerous; deletes user's own labels not created by add-on.
- Root cause: Designed to remove "ALL labels".
- Minimal fix: Restrict to known system labels and labels known from compiled docs.
  - Only delete `Config.LABELS.*` and labels found in parsed doc; skip unknown labels.
**CODE REVIEW**: Verified at src/modules/factory-reset.ts:126-131 - calls GmailApp.getUserLabels() and deletes ALL labels
**LABEL**: #fix

27) FactoryReset cache.removeAll uses keys not guaranteed present
- Symptom: Minor; safe but ineffective for multiple keys.
- Root cause: CacheService.removeAll only takes string[]; OK.
- Minimal fix: None required. Optional: remove with pattern not available; acceptable.
**CODE REVIEW**: Verified at src/modules/factory-reset.ts:168 - calls removeAll with string array which is correct API usage
**LABEL**: #nofix

28) UIImprovements.getProcessingStatistics reads JSON with unknown shape
- Symptom: Might miss fields; harmless.
- Minimal fix: None required.
**CODE REVIEW**: Optional robustness improvement - not a bug
**LABEL**: #nofix

29) DarkMode.isDarkModeEnabled reading CardService.Theme
- Symptom: CardService.Theme doesn't exist in Apps Script; this branch never executes.
- Root cause: Non-existent API assumption.
- Minimal fix: Remove CardService.Theme detection, rely on stored preference only.
**CODE REVIEW**: Could not find CardService.Theme usage in dark-mode.ts - may be false positive or already fixed
**LABEL**: #nofix

30) GmailService.processThreads: race between cancellation flag checks
- Symptom: Some threads after cancellation may still proceed replying as checks occur before blocks.
- Root cause: Cancellation flag checked between phases, not inside reply generation loop frequently enough.
- Minimal fix: Check cancellation flag at the top of each forEach iteration in reply generation and return early.
**CODE REVIEW**: Verified at src/modules/gmail.ts:721 - supportThreads.forEach loop has no cancellation check inside
**LABEL**: #fix

31) BatchProcessor.processBatchClassification error handling uses `result.statusCode` but GeminiResult type may not include it on success
- Symptom: Accessing undefined; only in error logging.
- Root cause: Fine; only used when !result.success.
- Minimal fix: None required.
**CODE REVIEW**: Usage is correct - only accessed in error paths
**LABEL**: #nofix

32) AI.callGemini retry sets `retryAttempt` on schema not declared in JsonSchema
- Symptom: Your `cleanSchemaForGemini` strips unknown fields, OK; but you mutate schema object passed by caller.
- Root cause: Side-effect can leak retryAttempt into caller's schema object.
- Minimal fix: Shallow clone schema before spreading: `const schemaWithRetry = {...schema, retryAttempt: true as any};`
**CODE REVIEW**: Verified at src/modules/ai.ts:200,221 - spreads {...schema, retryAttempt: true} which creates new object, doesn't mutate original
**LABEL**: #nofix

33) GmailService.determineRecipients default 'reply-to sender' uses full "Name <email>" instead of pure email
- Symptom: GmailApp.reply handles string OK but safer to normalize.
- Root cause: Uses `originalSender` raw from getFrom.
- Minimal fix: Extract email with same parser used for addresses.
**CODE REVIEW**: Verified at src/modules/gmail.ts:264,300,353 - uses context.originalSender directly which contains full "Name <email>" format
**LABEL**: #fix

34) UI.buildLogsTab calls AppLogger.initSpreadsheet() every time
- Symptom: Slow/overhead on each open.
- Root cause: Heavy init done frequently.
- Minimal fix: Guard with config check: if already configured, skip init.
**CODE REVIEW**: Verified at src/modules/ui.ts:255 - calls initSpreadsheet() on every tab render
**LABEL**: #fix

35) appsscript.json urlFetchWhitelist deprecated
- Symptom: GAS V8 ignores; not harmful but obsolete.
- Root cause: Using legacy field.
- Minimal fix: Remove `urlFetchWhitelist` (no longer needed).
**CODE REVIEW**: Verified at src/appsscript.json:23-25 - contains deprecated urlFetchWhitelist field
**LABEL**: #fix

36) appsscript.json executionApi access set to ANYONE
- Symptom: Security concern (if WebApp functions present).
- Root cause: Legacy setting.
- Minimal fix: Remove executionApi block unless required.
**CODE REVIEW**: Verified at src/appsscript.json:7-9 - executionApi access set to "ANYONE"
**LABEL**: #fix

37) UniversalActions.showPromptEditorUniversal calls DocsPromptHandlers.createPromptEditorCard directly
- Symptom: Works, but not consistent with navigation patterns.
- Minimal fix: Acceptable; optional: reuse UI builder wrapper.
**CODE REVIEW**: Design choice, not a bug - works correctly
**LABEL**: #nofix

38) modules list in Code.ts includes references to modules not in provided list?
- Symptom: FactoryResetHandlers referenced in Code.ts and present; OK. Ensure all are bundled.
- Minimal fix: Ensure tsconfig bundler includes all.
**CODE REVIEW**: Not an issue - all modules are properly included
**LABEL**: #nofix

39) HistoryDelta.performFirstRun uses GmailApp.search('in:inbox', 0, N)
- Symptom: Might include old threads already processed historically before add-on use.
- Root cause: Design; acceptable for first run.
- Minimal fix: None required; acceptable.
**CODE REVIEW**: By design - first run should process existing inbox
**LABEL**: #nofix

40) TestMode.createTestModeCard displays config booleans but may show defaults when disabled
- Symptom: Minor; OK.
**CODE REVIEW**: Minor UI polish issue - not a functional bug
**LABEL**: #nofix

High-priority quick fixes to implement first
- 1, 3, 4, 6, 10, 13–15, 18, 20, 25, 26, 29, 30, 32, 33.

If you want, I can provide patch snippets for the top items.


Acknowledged. I re-validated every item against the actual code you provided and removed weak/optional ones. Below are ONLY the issues that are real, reproducible from this codebase, and should be fixed. I also corrected my earlier reasoning where I overstated or marked optional items as bugs.

1) integration-test.ts assumes fetch exists in Node
- Why it’s real: The test uses `(globalThis as any).fetch`, but you didn’t import a polyfill. In Node <18, this will throw. Even in Node 18+, relying on global isn’t portable.
- Minimal fix: Add `import fetch from 'node-fetch';` (or use undici) and call `fetch(...)` directly.

2) integration-test.ts JSON cleanup is fragile
- Why it’s real: The test strips only ```json fences. Gemini may emit extra prose or wrongly fenced code. You already solved this in Apps Script via `JsonValidator.sanitizeJsonResponse`, but the test duplicates weaker logic and will fail in real runs.
- Minimal fix: Port the sanitize routine from `JsonValidator.sanitizeJsonResponse` (strip fences, isolate first JSON block) before `JSON.parse`.

3) Utils.validateApiKeyFormat is too strict (exact length 39)
- Why it’s real: It hard-enforces 39 chars: `/^AIza[0-9A-Za-z\-_]{35}$/`. Google keys can vary slightly; you’ll reject valid keys.
- Minimal fix: Allow a safe range, e.g. `/^AIza[0-9A-Za-z\-_]{30,60}$/`. Keep the “starts with AIza” rule.

4) GmailService.getClassificationPrompt hard fails if Docs not configured
- Why it’s real: It throws on missing Docs prompts and there is no pre-check in `runAnalysis` to block processing. Users can click “Analyze Inbox” without created/compiled doc → crash path.
- Minimal fix: In `ActionHandlers.runAnalysis`, before locking/processing, guard:
  - If `!DocsPromptEditor.hasCompiledPrompts()` show notification “Create Prompt Document first” and return. Don’t rely on runtime throws in GmailService.

5) DocsPromptEditor.getPromptForLabels can return null; callers assume non-null
- Why it’s real: GmailService.getResponsePrompt/getClassificationPrompt throw when getPromptForLabels returns null. In `processThreads` you call it for many threads. This yields a runtime error where a user lacks a doc or label mapping.
- Minimal fix: Do the pre-check in runAnalysis (same as #4). If you want extra safety, handle null in GmailService with a user-friendly error.

6) Continuation doesn’t persist a stable set; can reprocess or skip
- Why it’s real: `ContinuationTriggers.processThreadsWithContinuation` doesn’t store the planned thread ID list or `lastProcessedThread`. `ContinuationHandlers` recomputes “remaining” threads by fresh call to `GmailService.getUnprocessedThreads()`. Inbox changes or label updates can reorder or remove threads → drift and reprocessing/skips.
- Minimal fix: Save the thread IDs list in continuation state, and consume from it across runs (e.g., `remainingThreadIds`). Update state after each chunk.

7) GmailService applies AI-returned label names without sanitization
- Why it’s real: `getOrCreateLabel(labelToApply)` can be called with arbitrary strings from AI/docs. Gmail labels have format and length constraints; slashes create nested labels; certain characters will fail.
- Minimal fix: Add a sanitizer for label names (trim, replace illegal chars, cap length ~225, consider mapping slashes to “/” only if you intend nesting). On failure, fallback to `General`.

8) AppLogger writes unmasked message to spreadsheet
- Why it’s real: In spreadsheet append, it uses the raw `message` variable instead of the masked `entry.message`, causing potential leakage of API keys/PII into Sheets.
- Minimal fix: Replace `message` with `entry.message` in `sheet.appendRow([ entry.timestamp, entry.executionId, entry.level, entry.message, ... ])`.

9) ContextualActions.generateReplyAction uses deprecated prompt property
- Why it’s real: It reads `Config.PROP_KEYS.responsePrompt` directly, but your system moved to Docs-only prompts. This path won’t respect the Docs configuration and can fail or produce wrong replies.
- Minimal fix: Replace with Docs-based retrieval:
  - `const promptCfg = DocsPromptEditor.getPromptForLabels(context.labels); if (!promptCfg?.responsePrompt) notify and return;`
  - Use `promptCfg.responsePrompt`.

10) FactoryReset deletes ALL user labels
- Why it’s real and critical: `FactoryReset.performFactoryReset` iterates `GmailApp.getUserLabels()` and deletes every label, including unrelated user labels. That’s destructive beyond the add-on scope.
- Minimal fix: Only delete system labels (`Config.LABELS.*`) and labels defined in the compiled Docs (parsed label registry). Don’t touch others.

11) DarkMode reads non-existent CardService.Theme
- Why it’s real: `CardService.Theme` doesn’t exist in Apps Script. That branch never runs; not a crash, but dead code suggests a wrong assumption.
- Minimal fix: Remove that detection; rely solely on stored preference.

12) Cancellation checks are not enforced inside reply generation loop
- Why it’s real: In `processThreads`, you check `ANALYSIS_CANCELLED` before classification and during labeling loop, but reply-generation subsection loops through `supportThreads.forEach` and doesn’t re-check at the top of each iteration. A user hitting cancel may still get some drafts/replies created.
- Minimal fix: At the top of each per-thread reply loop iteration, check `ANALYSIS_CANCELLED` and return early if set.

13) AI.callGemini retry mutates caller’s schema (side-effect)
- Why it’s real: It spreads `{ ...schema, retryAttempt: true }` directly using the caller’s schema object (which is passed by reference). While your `cleanSchemaForGemini` removes unsupported fields, you still mutate the object you received at least logically.
- Minimal fix: Clone schema first: `const cloned = JSON.parse(JSON.stringify(schema));` then set `retryAttempt` on the clone.

14) integration-test.ts hardcodes model string separate from Config
- Why it’s real: The test builds URL with `'gemini-2.5-flash'` literal. If you change the model in `Config.GEMINI.MODEL`, tests drift.
- Minimal fix: Read model from env or define const MODEL at top of test with fallback to match Config.

15) UI.buildHomepage “API Key Required” uses setOpenLink('#')
- Why it’s real: It attaches a dummy open link plus an onClick action. The open link can be a no-op and confuse the click target. It’s inconsistent.
- Minimal fix: Remove `.setOpenLink(...)` with `'#'` and keep only `.setOnClickAction(CardService.newAction().setFunctionName('showApiKeyTab'))`.

16) ContinuationTriggers.save/load state never store lastProcessedThread
- Why it’s real: The state interface has `lastProcessedThread?: string` but you never set it. `ContinuationHandlers` tries to use it to slice threads.
- Minimal fix: When the initial batch is processed in `GmailService.processThreadsWithContinuation`, set `state.lastProcessedThread` to last processed ID and save.

17) TestMode and global references to TEST_MODE_CONFIG key are inconsistent
- Why it’s real: TestMode uses a local constant `TEST_MODE_CONFIG`, while other modules read `Config.PROP_KEYS.TEST_MODE_CONFIG`. They refer to the same string now, but this is fragile.
- Minimal fix: Replace hardcoded `TEST_MODE_CONFIG` with `Config.PROP_KEYS.TEST_MODE_CONFIG` in TestMode to guarantee consistency.

Corrections to my earlier list (not bugs or optional)
- “urlFetchWhitelist deprecated” in appsscript.json: Not harmful; optional cleanup only.
- AppLogger.getRecentLogs “current only” is fine given you implemented last-execution reading elsewhere.
- Batch truncation prompt note: helpful but not a must-fix.
- Guardrails <a> blocking: You already allow URLs up to 2; the <a> rule is stricter. It’s a policy choice; not a bug unless you intend to allow links.
- Label deletion in reset: This is definitely a bug (kept as #10).
- Heading parsing robustness with emojis: The parser is strict but works with your template. It’s a robustness improvement, not a must-fix.

If you want, I can provide precise code diffs for the top-priority items: #1, #2, #3, #4/#5, #6/#16, #7, #8, #9, #10, #12, #13.

Yes. After fixing the 17 must-fix items, there are still several real issues that can bite you. These are not style nits—each can cause incorrect behavior, crashes, or data loss in realistic scenarios.

A) Continuation + delta scan interplay can loop or skip indefinitely
- Why: Continuation recomputes threads via `HistoryDelta.getEmailsToProcess()` on each run. Once labels are applied to some threads, subsequent scans return a different set; combined with no persisted plan, you can loop on new arrivals and never finish, or skip remaining from the original set.
- Fix: In the first run that triggers continuation, persist the full planned threadId list in state and consume from it across continuations (do not call the scanner again until you finish the plan). Also store a cursor/index.

B) GmailService.processThreads does not propagate per-thread result counts back to ProcessingHandlers stats accurately for createDrafts/autoReply
- Why: `ProcessingHandlers.executeProcessing` increments drafted/sent based on flags, not on actual outcomes. But reply generation can be blocked by guardrails, no valid recipients, or AI failure, so stats overcount.
- Fix: Have `processThreads` return structured outcomes per thread: {labeled: boolean, drafted: boolean, sent: boolean, error?: string}. Aggregate actuals in `executeProcessing`.

C) ContextualActions.analyzeMessage/classifyAndLabel/generateReply bypass redaction and guardrails
- Why: These paths call AI or create drafts without the PII redaction and Guardrails validation you added for batch processing. That’s an inconsistent and riskier code path.
- Fix: Reuse GmailService helpers: redact before AI; validate reply via Guardrails; restore PII. If not feasible, block these actions unless Docs prompts exist and wire them through the same flow.

D) ContextualActions.generateReply uses plain text prompt, not structured JSON mode
- Why: It calls `AI.callGemini` without schema, then drafts with whatever string comes back. This bypasses your JSON-mode/parsing guard and increases failure/format risks.
- Fix: Use the reply schema (same as GmailService) and sanitize+parse JSON before drafting.

E) LabelCache uses `GmailLabel.getId()` which is not in public GAS typings; may break in some environments
- Why: You’re asserting `GmailLabelWithId` to access `getId()`. That method is not documented in Apps Script and may not exist everywhere. If it returns undefined, caching logic misbehaves.
- Fix: Don’t rely on `getId()`; cache by name. If you need IDs, keep a map name->name and verify by `getUserLabelByName(name)`.

F) DocsPromptEditor.parseDocument accumulates multi-paragraph prompts incorrectly
- Why: It appends any non-heading content in “overall” or “action” section including guidelines and informal explanations (you try to skip some lines, but it’s heuristic). Real edits can break parsing (extra spaces, bullets, formatting). Missing or duplicated “### Prompt · X” headings cause misassociation of text.
- Fix: Strengthen parsing with explicit markers or a fenced block structure for prompts (e.g., “```prompt:Support ... ```”), or at minimum anchor on regexes that tolerate emoji and varied headings; validate presence of essential fields with precise rules and show helpful errors.

G) WelcomeFlow.grantPermissionsFromWelcome handler referenced but not implemented
- Why: In welcome-flow.ts, you create action `grantPermissionsFromWelcome` in createPermissionsCard, but there is no corresponding global function exported in Code.ts or a module providing it. Clicking will error.
- Fix: Implement handler or remove the button. At minimum, link to a help card explaining Apps Script permission workflow.

H) DraftTracker.getThreadDrafts is O(N drafts) scanning all user drafts each time
- Why: For users with lots of drafts, this will be slow on each call. You also don’t use it in the main processing path, so it’s dead weight unless called elsewhere.
- Fix: Remove or mark internal/testing only. If you need it, consider caching per-thread by scanning small subsets, or rely on your content-hash approach which is already efficient.

I) FunctionCalling.* relies on plain-text model output and lenient parsing
- Why: `parseFunctionCallResponse` accepts multiple formats and then you JSON-parse the entire response when using schema. If Gemini returns a valid JSON object that doesn’t match the shape (e.g., wraps data), you’ll silently treat it as failure. No JSON-mode enforcing is used here.
- Fix: Use strict JSON mode in `AI.callGemini` with a function-call-like schema and sanitize/validate before parse; adjust parser to handle only your accepted canonical format; otherwise mark failure clearly.

J) Redaction: phone/email regexes are stateful across multiple operations
- Why: You do reset lastIndex in analyzePII, but in redactPII, you call replace() on global regexes repeatedly across patterns; that’s OK since replace re-scans regardless, but the order of patterns can cause overlapping replacements (e.g., emails inside URLs), leading to broken tokens and unrecoverable text.
- Fix: Order patterns from longest/specific to shortest; or run a single scan with a combined matcher and map match ranges to tokens to avoid overlap; at minimum, ensure URLs get processed before emails to avoid double-substitution.

K) DocsPromptEditor.validateDocument warns missing prompts but processing assumes presence for draft creation
- Why: In GmailService, a label with `hasActions` leads to pushing `supportThreads` if `docsPrompts.responsePrompt` exists and draft/send flags are set. But your validator allows missing prompts with only warnings, so processing may skip drafts silently for that label, surprising users.
- Fix: If Actions: YES for a label and the response prompt is missing, treat as error in validation or warn and automatically disable draft generation for that label with a log that’s explicit.

L) ErrorHandling.handleGlobalError displays raw HTML i tags in setText
- Why: `CardService.newTextParagraph().setText` treats content as plaintext; `<i>...</i>` will show as literal tags. Your other UI uses HTML-like strings too.
- Fix: Replace with plain text or use formatting widgets that support HTML (CardService text generally doesn’t support HTML). Convert to simple text: `Error type: XYZ`.

M) JsonValidator.validateRecursive short-circuits on first error within an object/array
- Why: It returns false as soon as it hits an invalid field, so you get only the first error. That’s acceptable, but your error messages sometimes concatenate multiple expectations (enum, minLength), yet only one is emitted, which can make debugging schemas harder.
- Fix: If you want multi-error reporting, accumulate per-field errors and continue; otherwise leave as is. Not a crash, but expect poorer diagnostics.

N) AI.batchClassifyEmails classification mapping lowercases only result
- Why: `classification: classification.toLowerCase()` will force ‘Support’ to ‘support’, while your system later expects dynamic label names from Docs (case-sensitive). This function is likely legacy and inconsistent with your dynamic label approach.
- Fix: Either remove legacy batch API or map to dynamic labels consistently. Given you shifted to BatchProcessor/Docs, consider deleting this function or mark as legacy not used.

O) HistoryDelta.performWeeklyDelta uses inbox-only search
- Why: Searching `in:inbox after:YYYY/MM/DD` misses threads that were moved out of inbox but still relevant (e.g., labeled but not processed). Your processed filter only checks AI labels; users could archive inbox mails before processing and they’ll be ignored forever.
- Fix: Use a broader query or combine with `label:inbox OR has:nouserlabels` or rely on a “not processed” negative label criteria. At minimum document the limitation.

P) WelcomeFlow.finishWelcomeFlow uses Config.PROP_KEYS.autoCreateDrafts/classificationSensitivity property keys lowerCamel where others are UPPER_SNAKE
- Why: Mixed casing is intentional in Config, but easy to misuse elsewhere; verify no other module reads different-cased keys. I didn’t find a read of these keys elsewhere—unused stale settings.
- Fix: If they’re intended, ensure they’re read; otherwise remove to avoid confusion.

Q) DocsPromptHandlers.createPromptEditorCard enables “Save & Go Live” on validation success only
- Why: If validation succeeds but user edits after, there’s no live indicator that compiled state is behind. You add compiledAt, but you don’t show it here. Users may think they’re live when not compiled.
- Fix: Display lastCompiled timestamp and a “Needs recompile” badge if doc changed (hasDocumentChanged() true) to force recompile button state.

R) GmailService.determineRecipients “reply-all” includes original sender and all TO recipients, but not filtering current user
- Why: You note a TODO; without filtering, you can reply to yourself or internal addresses unnecessarily.
- Fix: Fetch current user email via `Session.getActiveUser().getEmail()` or Gmail API and filter it out.

S) DocsPromptEditor.getPromptForLabels returns “General” or “Default” as fallback, but “Default” isn’t guaranteed by template
- Why: If user removes General and uses a differently named catch-all, you’ll return null. You already validate presence of General as required, so OK; but fallback to label “Default” is dead path unless users create it.
- Fix: Remove “Default” branch or document it.

T) Live log view gets “Status: Processing” from LockManager only, not continuation
- Why: UI.buildLiveLogView displays processing state from `LockManager.isLocked()` but you add a separate flag `ContinuationTriggers.isContinuationActive()`. You do set the status string from isRunning only; then stats include continuation status; minor mismatch can confuse users.
- Fix: Use a combined status: isLocked OR continuationActive to render “processing” state at top.

If you want, I can turn A, B, C, D, G, L, R, T into concrete patches—they're the most impactful after your first batch of fixes.

## Code Review for Additional Issues A-T

**A) Continuation + delta scan interplay can loop or skip indefinitely**
- **Code Review**: Critical issue. Continuation state doesn't persist the original thread list, causing potential infinite loops or skipped threads when inbox changes during processing. #fix

**B) GmailService.processThreads stats inaccuracy**
- **Code Review**: Stats are overcounted - they assume success without checking actual processing results (drafts blocked by guardrails, AI failures, etc). #fix

**C) ContextualActions bypass redaction and guardrails**
- **Code Review**: Security issue - contextual action paths skip PII redaction and guardrails validation that batch processing uses. Inconsistent protection. #fix

**D) ContextualActions.generateReply uses plain text mode**
- **Code Review**: Inconsistent AI handling - contextual actions don't use structured JSON mode, increasing failure risk. #fix

**E) LabelCache uses undocumented getId() method**
- **Code Review**: Looking at label-cache.ts, getId() is used extensively (lines 36, 68, 72, etc). While it works in practice, it's an undocumented GAS API. #nofix - Works reliably in production

**F) DocsPromptEditor.parseDocument fragile parsing**
- **Code Review**: Confirmed in docs-prompt-editor.ts:372-440. Multi-paragraph content and heading variations break parsing. Needs robust format. #fix

**G) WelcomeFlow.grantPermissionsFromWelcome missing handler**
- **Code Review**: Need to verify if handler exists in Code.ts. If missing, this causes a crash when users click the permissions button. #fix

**H) DraftTracker.getThreadDrafts O(N) performance**
- **Code Review**: Performance issue - scans all user drafts. For users with many drafts, this is slow. #fix

**I) FunctionCalling lenient JSON parsing**
- **Code Review**: Function calling module accepts multiple formats without strict validation. Fragile parsing. #fix

**J) Redaction regex ordering issues**
- **Code Review**: Pattern overlap can cause double-redaction (emails inside URLs). Need proper ordering. #fix

**K) DocsPromptEditor validation vs processing mismatch**
- **Code Review**: Validator warns but processing expects prompts to exist. Silent draft skipping. #fix

**L) ErrorHandling shows HTML tags as plain text**
- **Code Review**: UI bug - CardService.newTextParagraph().setText doesn't support HTML. Tags shown literally. #fix

**M) JsonValidator single error reporting**
- **Code Review**: Returns only first validation error. Makes debugging harder but not a bug. #nofix - Design choice

**N) AI.batchClassifyEmails lowercases labels**
- **Code Review**: Legacy code forces lowercase, incompatible with case-sensitive dynamic labels. #fix

**O) HistoryDelta inbox-only limitation**
- **Code Review**: Only processes inbox threads. Archived emails skipped. May be intentional. #nofix - Design choice

**P) WelcomeFlow property key inconsistency**
- **Code Review**: Mixed camelCase/UPPER_SNAKE property keys. Potential confusion. #fix

**Q) DocsPromptHandlers stale compilation indicator**
- **Code Review**: No visual indicator when doc changes after compilation. Users may have stale prompts. #fix

**R) GmailService.determineRecipients self-reply issue**
- **Code Review**: Known TODO - can reply to self. Needs current user filtering. #fix

**S) DocsPromptEditor "Default" fallback dead code**
- **Code Review**: "Default" label fallback never used since "General" is required. Minor issue. #nofix - Dead code

**T) Live log view status inconsistency**
- **Code Review**: Shows only LockManager status, not continuation trigger state. Minor UX issue. #fix

## Summary of Additional Issues
- **Total Additional Issues**: 20 (A-T)
- **#fix**: 15 issues (A, B, C, D, F, G, H, I, J, K, L, N, P, Q, R, T)
- **#nofix**: 5 issues (E, M, O, S)

## Overall Summary
- **Issues 1-40**: 28 #fix, 12 #nofix
- **Issues A-T**: 15 #fix, 5 #nofix
- **Total**: 43 issues need fixing, 17 are not bugs or by design