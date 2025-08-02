Below are **24 detailed engineering tickets** (23 from the previous list + the brand-new **Strict JSON Mode** ticket).
Copy-paste each block into Jira / Linear / GitHub Issues—fields are aligned with common agile templates. All solutions **preserve the single-file Apps Script bundle** deployment model.

---

## T-01 · Batch Gemini Requests

**Background**
Current implementation calls Gemini once per thread → 50 × round-trip latency & token cost.

**Objective**
Send up to *N* emails per request (configurable ≤ 20) and receive a JSON array of classifications/replies.

**Task List**

1. Create `AI.callGeminiBatch(prompts: string[]): string[]`.
2. Slice inbox threads into batches; build delimiter-wrapped prompts.
3. Update `processThread` loop to map results back to threads.
4. Extend unit tests with mocked batch response.

**Acceptance Criteria**

* Processing 50 emails ≤ 25 s wall-clock.
* Total input+output tokens ≤ (Σ individual tokens) × 1.1.
* 100 % thread/result alignment verified in test.

**Tech Notes**
Use delimiter `"\u241E"` (Record Separator). Prompt:

```text
Return a JSON array like [{"id":0,"label":"support","reply":"..."}] …
```

**Risks / Mitigations**

* Gemini truncation → add check for `]` and retry smaller batch.

---

## T-02 · Continuation Triggers for Long Runs

**Background**
Apps Script execution cap: 30 s (add-ons) / 90 s (installable). Large inboxes hit limit.

**Objective**
Checkpoint progress & resume automatically.

**Task List**

1. Compute `Utilities.getRemainingQuota()` each loop.
2. If `<10 000 ms`, write pending thread IDs to `CacheService` key `RUN_<execId>`.
3. Create one-off trigger `ScriptApp.newTrigger('continueProcessing').timeBased().after(1000)`.
4. `continueProcessing()` pulls cache, processes rest, repeats as needed.

**Acceptance Criteria**

* Inbox of 500 messages finishes successfully.
* No duplicate labels/drafts across segments.
* Trigger chain cleans itself (deleteTrigger).

**Tech Notes**
`CacheService` quota 6 MB → store array of IDs as CSV.

---

## T-03 · Structured Error Taxonomy

**Background**
Logs contain raw strings; impossible to chart error types.

**Objective**
Implement enum-driven error handling.

**Task List**

1. Add `enum AppError { Network, Quota, InvalidApiKey, DraftFail, Unknown }`.
2. Wrap thrown errors with `new ErrorWithType(type, message)`.
3. Logger includes `errorType` field.
4. UI maps errorType→friendly message.

**Acceptance Criteria**

* Five distinct error types appear in logs.
* UI shows user-friendly toast (no stack trace).

---

## T-04 · Snapshot Telemetry Sheet

**Background**
Need longitudinal metrics without external DB.

**Objective**
Append one summary row per run to hidden “Dashboard”.

**Task List**

1. On run completion, open (or create) sheet `Dashboard`.
2. Append row: `=ARRAY_ROW(NOW(), EXEC_ID, scanned, supports, drafted, sent, errors, elapsed_ms)`.
3. Hide tab by default (`sheet.hideSheet()`).

**Acceptance Criteria**

* Sheet contains ≥ 10 historic rows after multiple runs.
* Charts can pivot on this data manually.

---

## T-05 · Add-on Heartbeat

**Background**
Ops needs liveness signal.

**Objective**
Write timestamp to `UserProperties` each sidebar open.

**Task List**

1. Implement `onAddOnOpen(e)` (simple trigger).
2. `PropertiesService.getUserProperties().setProperty('AI_HEARTBEAT', ISO_TIMESTAMP)`.
3. Document Cloud Monitoring alert recipe.

**Acceptance Criteria**

* Property updates every open (verified in logs).
* Missing heartbeat > 24 h triggers test alert.

---

## T-06 · Inline Source-Map Footer

**Background**
Stack traces show transpiled line numbers.

**Objective**
Embed source-map in `Code.gs`.

**Task List**

1. Generate `.map` via `tsc --sourceMap`.
2. Base64-encode and append:

   ```js
   //# sourceMappingURL=data:application/json;base64,<...>
   ```
3. Verify Apps Script IDE “View source map” link.

**Acceptance Criteria**

* Throwing error displays original `.ts` location.
* Bundle size growth < 3 %.

---

## T-07 · Deterministic Header (Git Hash)

**Background**
Need exact build provenance.

**Objective**
Add commit SHA and dirty marker.

**Task List**

1. In `bundle.js`, run `git rev-parse --short HEAD`.
2. Check `git diff --quiet` for dirty flag.
3. Inject `Commit: <sha>[+dirty]` into header.

**Acceptance Criteria**

* Header shows commit when viewing `Code.gs`.
* Dirty flag appears if uncommitted changes.

---

## T-08 · OSS Licence Aggregation

**Background**
Compliance requirement.

**Objective**
Bundle licences of prod dependencies into comment block.

**Task List**

1. During build, read `node_modules/*/package.json`.
2. Collect licence texts (MIT, BSD, Apache).
3. Append as `/* THIRD-PARTY LICENCES … */` before code.

**Acceptance Criteria**

* Header lists every dep from `package-lock.json`.
* Fails build if licence unknown/not-whitelisted.

---

## T-09 · Adaptive Dark-Mode Palette

**Background**
Hard-coded colors unreadable in Gmail dark theme.

**Objective**
Dynamic theming.

**Task List**

1. Detect theme: `CardService.getTheme()` (`DARK`, `LIGHT`).
2. Centralize palette in `Config.COLORS`.
3. Use neutral colors (Google blue 600 vs blue 300) per theme.
4. Update icon variants if needed.

**Acceptance Criteria**

* Contrast ratio ≥ 4.5:1 verified via Chrome devtools.
* No bright flashes on theme switch.

---

## T-10 · One-Email “Test-Run” Mode

**Background**
Users want safe dry-run.

**Objective**
Button processes newest thread only.

**Task List**

1. Add UI toggle “Test Run (1 email)”.
2. When enabled, `getUnprocessedThreads()` returns `threads.slice(0,1)`.
3. Skip labeling/drafting; show classification & proposed reply on card.

**Acceptance Criteria**

* No Gmail mutations during test-run.
* Card displays result inline.

---

## T-11 · Contextual Card Action

**Background**
Manual triage flow.

**Objective**
Provide per-message classify/draft actions.

**Task List**

1. Implement `onGmailMessage(e)`.
2. Build card with subject preview, “Classify”, “Draft Reply”.
3. Actions operate on `e.gmail.messageId`.

**Acceptance Criteria**

* Works on open thread in Gmail.
* Adds labels/draft without scanning inbox.

---

## T-12 · Per-Thread Redaction Cache

**Background**
Limit PII exposure.

**Objective**
Redact PII before LLM, restore in drafts.

**Task List**

1. Regex patterns: emails, phones, order numbers `#[0-9]{6,}`.
2. Replace with `{{token0}}` … store mapping in `CacheService` keyed by `threadId`.
3. After AI reply, reverse mapping.

**Acceptance Criteria**

* Draft shows original PII.
* Logs and Gemini payloads contain placeholders only.

---

## T-13 · Optional Encrypted API Key

**Background**
API key stored plain in UserProperties.

**Objective**
Allow user-provided passphrase encryption.

**Task List**

1. Add UI “Encrypt key” switch.
2. Use SJCL (2 KB minified) in bundle; AES-CTR encrypt key.
3. Store cipher + IV in UserProperties.
4. Cache passphrase in `CacheService` until logout.

**Acceptance Criteria**

* Key not readable in script properties.
* Decryption fails gracefully if passphrase wrong.

---

## T-14 · Function-Calling JSON Schema

**Background**
Want deterministic structure.

**Objective**
Use Gemini tools/responseSchema to enforce JSON.

**Task List**

1. Define schema:

   ```json
   {
     "$schema":"http://json-schema.org/draft-07/schema#",
     "type":"object",
     "required":["label"],
     "properties":{
       "label":{"type":"string","enum":["support","undefined"]},
       "reply":{"type":"string"}
     }
   }
   ```
2. Send `generationConfig.response_schema` (Developer API) or wrap in `tools` for function calling.
3. Parse via `JSON.parse`.

**Acceptance Criteria**

* 100 % of responses JSON-parseable without regex.
* Non-JSON response triggers retry with temperature 0.

**Implementation Notes**

* Per docs ([Google AI for Developers][1], [Google AI for Developers][2]), set `generationConfig.response_mime_type = "application/json"` and include `response_schema`.
* In Apps Script `UrlFetchApp`, payload key is `generationConfig`.

---

## T-15 · Personality Slider

**Background**
Need brand-voice flexibility.

**Objective**
Add slider 0–5 controlling formal vs friendly tone.

**Task List**

1. UI Slider `fieldName=voice`.
2. System prompt template uses array index → descriptor (`formal`, `neutral`, `friendly`, etc.).
3. Persist in UserProperties.

**Acceptance Criteria**

* Draft tone differs between level 0 & 5 in snapshot tests.

---

## T-16 · Post-Reply Guardrails

**Background**
Prevent risky content.

**Objective**
Validate AI reply before draft/send.

**Task List**

1. Checks: `<a href>`, `<script>`, profanity list, length > 1 000 chars.
2. If fails, label `ai✗`, log error, skip sending.
3. UI toast summarises failure.

**Acceptance Criteria**

* 95 % of seeded bad replies caught in tests.
* No false positives on 100 good samples.

---

## T-17 · Golden-File Snapshot Tests

**Background**
Prevent accidental prompt drift.

**Objective**
Store expected AI JSON in repo.

**Task List**

1. Use Jest `toMatchSnapshot()`.
2. Mock `UrlFetchApp` to return saved JSON.
3. CI fails when snapshot changes.

**Acceptance Criteria**

* `npm test` passes offline.
* Committing changed snapshot requires reviewer approval.

---

## T-18 · Pre-Commit Hook

**Background**
Stop broken bundles reaching main.

**Objective**
Add Husky hook.

**Task List**

1. `npx husky-init && npm install`.
2. Script: `npm run lint && npm test && npm run test:postbundle`.
3. Docs update.

**Acceptance Criteria**

* Commit blocked on failing lint/tests/postbundle.

---

## T-19 · Label-ID Caching

**Background**
Label rename breaks processing.

**Objective**
Use Gmail Label IDs.

**Task List**

1. When creating/finding label, store `{name:id}` in UserProperties.
2. Search queries still use `name`; operations use ID.
3. Add migration for existing installs.

**Acceptance Criteria**

* Rename “Support” to “Customer Support” and run → processing still succeeds.

---

## T-20 · History API Delta Processing

**Background**
Repeated full-search wastes quota.

**Objective**
Use Gmail History endpoint.

**Task List**

1. Store last `historyId` (thread.getHistoryId()).
2. Call `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=...&historyTypes=messageAdded`.
3. Convert result IDs to threads.

**Acceptance Criteria**

* Second run after zero new mail processes ≤ 1 thread.
* Fallback to full search if error 404 (historyId too old).

---

## T-21 · Embedded `__help__()` Self-Doc

**Background**
On-call engineers need quick tips.

**Objective**
Function prints config & usage.

**Task List**

1. Build string with version, labels, commands.
2. `console.log` multi-line help.
3. Mention “Test-Run” and heartbeat.

**Acceptance Criteria**

* Invoking in IDE outputs < 200 lines.

---

## T-22 · Interactive REPL Mode

**Background**
Prompt iteration pain.

**Objective**
Utility to run arbitrary prompt.

**Task List**

1. `function execPrompt(prompt)` reads API key, calls Gemini (`response_mime_type='text/plain'`).
2. Logs raw text.
3. Abort if key missing.

**Acceptance Criteria**

* Running `execPrompt('Hello')` returns greeting in logs.

---

## T-23 · Dark-Mode Regression Tests

**Background**
Color regressions unnoticed.

**Objective**
Automated screenshot diff.

**Task List**

1. Puppeteer script loads add-on in Gmail (light & dark).
2. Captures critical cards.
3. Use `pixelmatch` diff threshold 0.1.

**Acceptance Criteria**

* CI artefact shows side-by-side images.
* Build fails on diff > 0.1.

---

## T-24 · Strict JSON Mode (NEW)

**Background**
We need deterministic JSON I/O with Gemini to simplify parsing and eliminate string heuristics.

**Objective**
Enforce strict JSON request/response round-trip using Gemini’s `response_mime_type` + `response_schema` (function-calling compatible).

**Technical Research**

* **`response_mime_type`**: Set to `"application/json"` inside `generationConfig` to instruct model to emit valid JSON only. ([Stack Overflow][3])
* **`response_schema`** (preferred): Include Draft-07 JSON schema; model validates before returning. ([Google AI for Developers][1], [Google Cloud][4])
* Works with gemini-2.5-flash (since May 2025). Function-calling fallback available if schema rejected.
* Streaming endpoint also supports JSON mode.

**Task List**

1. Update `AI.callGemini` payload:

   ```js
   generationConfig: {
     temperature: 0.3,
     response_mime_type: 'application/json',
     response_schema: { …see schema in T-14… }
   }
   ```
2. Remove prompt-level instructions about “Return exactly one word”.
   Schema enforces allowed enum values.
3. Implement `validateJson(result, schema)` (Ajv-mini 4 KB minified).
4. Retry logic: If parse fails, call again with `temperature:0`, max 2 attempts; else throw `ErrorType.InvalidJSON`.
5. Update tests: add malformed JSON sample to ensure retry path.

**Acceptance Criteria**

* 100 % of successful AI responses pass `JSON.parse` and `Ajv` validation first attempt.
* Logs include `request.schemaVersion`.
* Parsing code no longer uses regex or `.indexOf('support')`.

**Risks / Mitigations**

* Gemini may refuse schema → detect `error.code=400` & fallback to prompt-based JSON instructions (keep under 1 % occurrence).
* Slight token overhead for JSON braces; batch size parameter `N` in T-01 adjusted accordingly.

---

### How to Use

1. Prioritise tickets with **bold ROI**: T-24 (strict JSON), T-01, T-02.
2. Each ticket is independent but note dependencies:

   * T-14 (function-calling) complements T-24.
   * T-09 dark-theme and T-23 regression tests go together.
3. Retain single-file constraint: all external libs (Ajv, SJCL) must be inlined/minified by bundler.

Happy sprint planning!

[1]: https://ai.google.dev/gemini-api/docs/structured-output?utm_source=chatgpt.com "Structured output | Gemini API | Google AI for Developers"
[2]: https://ai.google.dev/api/generate-content?utm_source=chatgpt.com "Generating content | Gemini API | Google AI for Developers"
[3]: https://stackoverflow.com/questions/77844870/google-gemini-api-response?utm_source=chatgpt.com "python - Google Gemini API response - Stack Overflow"
[4]: https://cloud.google.com/vertex-ai/generative-ai/docs/samples/generativeaionvertexai-gemini-controlled-generation-response-schema?utm_source=chatgpt.com "Specify a MIME response type for the Gemini API - Google Cloud"
