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


Below is a **UI‑only review** of the Gmail add‑on as it appears to end‑users. Think of it as a miniature product‑design brief plus concrete code hooks, so you can iterate quickly in `src/modules/ui.ts` without touching the back‑end logic.

---

## 1 · First‑run “Welcome” flow

### Problem

Opening the add‑on before an API key is configured shows the regular homepage with a red warning and a disabled button. Users feel blocked.

### Improvement

1. Detect `!hasApiKey` and **replace** the main card with a dedicated **Welcome Card**:

   * Short headline: “Get started in two minutes”
   * Step list with checkmarks ( 🎯 Get an API key → 🔑 Paste it → 🚀 Run analysis ).
   * Single **“Paste my API key”** CTA that deep‑links to the API‑Key tab.
2. After the key is saved, store `ONBOARDED = true` in `UserProperties` and never show the Welcome card again.

```ts
if (!hasApiKey && !props.getProperty('ONBOARDED')) {
  return UI.buildWelcomeCard();
}
```

---

## 2 · Condense the Main Card (reduce scroll)

| Current Element                          | Issue                                                                   | Change                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Processing‑mode radio buttons + checkbox | Live at top but visually similar to prompts; users sometimes skip them. | Move into an **Expander** (“Processing Options ▸”) collapsed by default.                     |
| 2 large prompt fields                    | Take 60–70 % of vertical space; many users leave defaults.              | Collapse behind a **“Customize AI Prompts ▸”** expander. Persist open/closed state per user. |
| “Analyze Inbox” footer                   | Disabled state looks identical; users don’t notice.                     | When disabled, change color to grey (`#dadce0`) and text to **“Enter API key to continue”**. |

**Implementation Hint**

Google CardService has no native accordion, but you can simulate it with a toggle switch stored in `UserProperties` plus `pushCard(updateCard())`. Example:

```ts
const expanded = props.getProperty('SHOW_PROMPTS') === 'true';
const arrow = expanded ? '▼' : '▶';
section.addWidget(CardService.newDecoratedText()
  .setText(`${arrow} Customize AI Prompts`)
  .setOnClickAction(CardService.newAction()
    .setFunctionName('togglePrompts')));
if (expanded) { /* render the 2 TextInputs */ }
```

---

## 3 · Live‑Log Screen UX

### Make it a *dialog* instead of a full card

`pushCard()` replaces the whole UI; jumping back and forth is jarring. Use:

```ts
CardService.newNavigation()
  .setOpenLink(CardService.newOpenLink()
     .setUrl('#')      // dummy
     .setOpenAs(CardService.OpenAs.OVERLAY)
     .setOnClose(CardService.OnClose.NOTHING));
```

Within the overlay show:

* A **progress bar** (`CardService.newDecoratedText().setWrapText(false)`) that updates via Property polling: `"████░ 62 %"`
* A **Close** button (`NAVIGATE_CLOSE`) so users land where they were.

### Visual log levels

Prefix each log line with coloured emojis already, but also use **key colours** via `setIconUrl()`:

| Level | Emoji | Color suggestion |
| ----- | ----- | ---------------- |
| INFO  | 🛈    | Default          |
| WARN  | ⚠️    | `#e37400`        |
| ERROR | ❌     | `#d93025`        |

---

## 4 · Settings Tab – group by mental model

**Current**: Two on/off switches + version.
**Proposed layout**

| Section     | Widgets                                                |
| ----------- | ------------------------------------------------------ |
| **General** | Debug‑mode switch, Spreadsheet‑logging switch          |
| **Storage** | Link to “View log folder”                              |
| **About**   | Version, “Release notes”, “Report an issue” open‑links |

Leverage `CardService.newCardSection().setHeader('General')` for visual separation.

---

## 5 · Accessibility & Theming

* **Contrast** – blue `#1a73e8` text on white is AA‑compliant for body text but becomes borderline for small labels. Consider `#1967d2`.
* **Screen‑readers** – Add `.setAltText()` on icons and `.setFieldName('…').setTitle('… (required)')` to ensure ARIA “required” is spoken when API key missing.
* **RTL support** – Gmail automatically flips icons if strings are wrapped in `Utilities.formatString('<b dir="auto">%s</b>', txt)`; test with Arabic locale.

---

## 6 · Micro‑copy tweaks

| Location     | Current          | Suggested                          |
| ------------ | ---------------- | ---------------------------------- |
| Mode radio   | “Labels + Send”  | “Auto‑reply (sends email)”         |
| Prompt hints | none             | Add “Leave blank to keep default.” |
| Live log     | “REFRESH (Auto)” | “Live refresh (5 s)”               |

---

## 7 · Quick‑access speed‑dial (advanced)

Google add‑ons support **Universal Actions** in the three‑dot menu but not FABs. For power users, add a **“Quick analyse last 10 emails”** universal action:

```json
{
  "label": "Quick‑scan last 10",
  "runFunction": "runQuickScanUniversal"
}
```

and in code call the same processing routine with `limit=10`—no UI, just a toast.

---

## 8 · Code snippets to drop‑in

Below are *surgical* inserts; no refactor needed.

```ts
// ui.ts – expanders state toggles
function togglePrompts(e) {
  const props = PropertiesService.getUserProperties();
  const val = props.getProperty('SHOW_PROMPTS') === 'true';
  props.setProperty('SHOW_PROMPTS', (!val).toString());
  return UI.navigateTo(UI.buildHomepage());   // re‑render
}

function toggleProcOpts(e) { /* same pattern for processing options */ }
```

```ts
// ui.ts – analyse button state
const analyzeBtn = CardService.newTextButton()
  .setText(hasApiKey ? '📈 Analyse Inbox' : 'Enter API key to continue')
  .setDisabled(!hasApiKey)
  .setOnClickAction(CardService.newAction()
     .setFunctionName('runAnalysis'));
```

---

## 9 · Visual “done” state

After a successful run, instead of silently navigating to the Live‑Log view, show a **completion toast** on the main card:

```ts
return UI.navigateTo(UI.buildHomepage())
         .setNotification(CardService.newNotification()
            .setText(`✅ Analysed ${stats.scanned} emails – ${stats.supports} support`));
```

Users get immediate feedback even if they don’t open the logs.

---

## 10 · Dark‑mode readiness

Google is gradually rolling out dark‑mode for add‑ons (auto‑inverts whites). Ensure you:

* Avoid hard‑coding white backgrounds – rely on CardService defaults.
* Use **transparent PNG** icons or Google Material icons (`setIcon(CardService.Icon.XXX)`).

---

### Next steps

1. **Implement the Welcome flow**—*biggest perceived hurdle*.
2. Collapse optional sections via expander toggles.
3. Replace Live‑Log full‑page with overlay + progress bar.
4. Polish micro‑copy & colours for accessibility.

These items are UI‑only and contained within `ui.ts` (plus minor universal‑actions list in `appsscript.json`). No back‑end or build‑chain changes required.


>>

### Level-Up the **Live Log Viewer** – keep everyone inside Gmail, no spreadsheet hopping 🚀

Below is a **pure-UI revamp plan** for `UI.buildLiveLogView()` + tiny tweaks in `logger.ts`. Everything stays client-side; no back-end or spreadsheet changes required.

---

## 1 · Split the viewer into three panes

| Pane                       | Widget ideas                                                                                                                         | Why it helps                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **A. Status Bar** (sticky) | • Progress bar<br>• Elapsed time<br>• “Stop analysis” button                                                                         | Users instantly see if the run is alive, and can abort without hunting. |
| **B. Filters & Controls**  | • Toggle chips: 🛈 INFO / ⚠️ WARN / ❌ ERROR<br>• “Show AI traffic” switch (request / response)<br>• “Load older” button (pagination) | Lets users zero-in on signal, reduces noise.                            |
| **C. Log stream**          | • Collapsible **KeyValue** widgets per entry<br>• Color strip on left by level<br>• Long lines truncated with “More…” expand         | Scannable, collapsible, no overflow.                                    |

### Card layout skeleton

```ts
const nav = CardService.newNavigation();
nav.pushCard(
  CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
        .setTitle('🔴 Live analysis')
        .setSubtitle('Execution ' + execId))
    .addSection(buildStatusBar(isRunning, stats))
    .addSection(buildFilterBar(e))
    .addSection(buildLogStream(entries, filters))
    .build()
);
return CardService.newActionResponseBuilder().setNavigation(nav).build();
```

---

## 2 · Progress bar without HTML

Apps-Script Cards don’t have a native `<progress>` tag, so fake it with block characters:

```ts
function renderProgress(scanned, total) {
  const pct = total ? Math.round(scanned / total * 100) : 0;
  const blocks = Math.round(pct / 10);
  return '█'.repeat(blocks) + '░'.repeat(10 - blocks) +
         ` ${pct}%`;
}
```

Display it in a `DecoratedText` widget (`wrapText(false)` to keep it in one line).

---

## 3 · Real-time-ish auto-refresh

Gmail add-ons can’t run timers, but you can **self-refresh** when the user leaves the card open:

```ts
return CardService.newActionResponseBuilder()
  .setNavigation(nav)
  .setStateChanged(true)      // key trick
  .build();
```

`setStateChanged(true)` tells Gmail that data might be stale; Gmail will re-invoke the homepage/contextual trigger when the card regains focus (tab switch, window refocus). Net effect: users see fresh logs whenever they bounce back to Gmail.

Add a subtle hint: “Viewer auto-updates when you return to the tab”.

---

## 4 · Filter chips implementation

```ts
function buildFilterBar(e) {
  const props = PropertiesService.getUserProperties();
  const current = props.getProperty('LOG_FILTER') || 'INFO,WARN,ERROR';

  const chipBar = CardService.newCardSection()
     .setHeader('Filters');

  ['INFO','WARN','ERROR'].forEach(level => {
     chipBar.addWidget(CardService.newDecoratedText()
        .setText(level)
        .setIcon(CardService.Icon.INFO)  // pick suitable Material icons
        .setSwitchControl(CardService.newSwitch()
           .setFieldName('filter_'+level)
           .setValue(current.includes(level).toString())
           .setOnChangeAction(CardService.newAction()
              .setFunctionName('toggleLogFilter'))));
  });
  return chipBar;
}

function toggleLogFilter(e) {
  // collect all filter_* fields that are 'true'
  const selected = Object.keys(e.formInput)
     .filter(k => k.startsWith('filter_') && e.formInput[k] === 'true')
     .map(k => k.replace('filter_',''));
  PropertiesService.getUserProperties()
     .setProperty('LOG_FILTER', selected.join(','));
  return UI.navigateTo(UI.buildLiveLogView());
}
```

In `buildLogStream`, just skip entries whose `entry.level` isn’t in the selection.

---

## 5 · Pagination: “Load older”

Your logger already stores only the last 50 entries → keep that for performance but expose pagination:

```ts
function buildLogStream(entries, filters, offset = 0) {
  const slice = entries.slice(offset, offset+20);   // 20 per “page”
  // …build widgets…
  if (entries.length > offset+20) {
    section.addWidget(CardService.newTextButton()
      .setText('Load older')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('loadOlderLogs')
        .setParameters({ offset: (offset+20).toString() })));
  }
  return section;
}
```

The handler reads the parameter and re-renders with new offset—no spreadsheet lookup needed.

---

## 6 · Prettify each log line

```ts
function widgetFor(entry) {
  const color = entry.level==='ERROR' ? '#d93025'
            : entry.level==='WARN'  ? '#e37400'
            : '#5f6368';

  const kv = CardService.newKeyValue()
     .setContent(entry.message.length > 80
        ? entry.message.slice(0,80) + '…'
        : entry.message)
     .setIconUrl(`https://singlepixel.app/${color}`)  // tiny coloured png
     .setTopLabel(entry.timestamp.substring(11,19))   // hh:mm:ss
     .setBottomLabel(entry.level);

  if (entry.context) {
     kv.setOnClickAction(CardService.newAction()
       .setFunctionName('expandLog')
       .setParameters({ ts: entry.timestamp }));
  }
  return kv;
}
```

`expandLog` opens a small overlay with the full JSON context prettified via `JSON.stringify(ctx,null,2)`.

---

## 7 · Store logs efficiently

In **`logger.ts`**:

```ts
const MAX_PROP_SIZE = 90000;  // stay under 100 KB
function writeLiveLog(entry) {
  const props = PropertiesService.getUserProperties();
  const key = 'LIVE_LOG_'+executionId;
  let buf = JSON.parse(props.getProperty(key) || '[]');
  buf.push(entry);
  while (JSON.stringify(buf).length > MAX_PROP_SIZE) buf.shift();  // drop oldest
  props.setProperty(key, JSON.stringify(buf));
}
```

Now the live viewer is fully independent of Sheets; the spreadsheet remains a cold archive.

---

## 8 · “Copy raw logs” utility

At bottom of viewer add a button:

```ts
new TextButton().setText('📋 Copy raw JSON')
                .setOnClickAction(new Action()
                   .setFunctionName('copyLogsToClipboard'));
```

The handler wraps logs in a `CardService.newActionResponseBuilder().setClipboardData(JSON.stringify(entries,null,2))` (works in Gmail add-ons since 2024).

---

## 9 · Abort/stop button

If `isRunning` true:

```ts
new TextButton().setText('🛑 Stop analysis')
   .setBackgroundColor('#d93025')
   .setOnClickAction(new Action()
       .setFunctionName('cancelAnalysis'));
```

`cancelAnalysis` just writes `ANALYSIS_RUNNING=false` so your loop notices and exits early.

---

## 10 · Mobile friendliness

* Keep log line width under \~40 chars; wrap after that.
* Hide Sidebar filter pane on Gmail mobile by detecting `e.clientPlatform` and collapsing into a single “Filters ▸” expander.

---

### TL;DR Roadmap

1. **Replace full-page viewer with three-pane card architecture.**
2. **Add filter switches & pagination** to keep view focused.
3. **Inline progress bar + abort button** for instant feedback.
4. **Write/Read logs from `UserProperties` only** (max 100 KB ring buffer) – spreadsheet becomes optional.
5. **Copy-to-clipboard & expand-details** for power users.

Drop these snippets into `ui.ts` and `logger.ts`, re-deploy, and you’ve got a spreadsheet-free live log console that feels almost real-time. Happy shipping! 🎉
>>>>

choose the google one ### Yes —pick a **token-based** open-source design system and *compile it* into your bundle

Because Gmail add-ons can’t load external JS / CSS at runtime, the trick is to import a **JSON design-token palette** at build time, convert it to a plain JS object, and reference those tokens inside your `UI` helpers. Tokens are tiny, tree-shakable, and live happily in a single-file architecture.

Below are three solid OSS options—each ships its tokens as JSON so you can embed them directly in `Config.ts` while keeping zero runtime deps.

| Project                             | What you get                                                                                        | Single-file friendly?                                                               | Source                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------ |
| **Material 3 “M3” tokens**          | Google’s official color roles, type ramp, elevation & motion specs in JSON (`material-theme.json`). | ✔ The palette is \~2 KB once you strip unused roles; matches Google-Workspace look. | ([Google for Developers][1])   |
| **Atlassian Design Tokens**         | Neutrals, accent blues, spacing scale, radii, typography in `/tokens/*.json`.                       | ✔ MIT-licensed, <5 KB if you cherry-pick `color` + `spacing`.                       | ([Atlassian Design System][2]) |
| **Clarity Core tokens** (by VMware) | Color + spacing + elevation; web-component ready.                                                   | ✔ Distributed as `@clr/core/tokens` JSON; copy-paste into config.                   | ([GitHub][3])                  |

*(The “Awesome-Design-Tokens” repo is a meta-list that links to all of the above plus many more.)* ([GitHub][4])

---

## How to wire tokens into your single file

1. **Copy & prune**
   Grab the JSON, delete roles you’ll never use, and paste into `src/modules/config.ts`:

   ```ts
   // config.ts (excerpt)
   export const TOKENS = {
     color: {
       surface: '#FFFFFF',
       textPrimary: '#202124',
       primary500: '#1A73E8',
       error: '#D93025',
       warn: '#E37400'
     },
     spacing: { xs: 4, sm: 8, md: 16, lg: 24 }
   } as const;
   ```

2. **Create tiny helpers** in `ui.ts` so CardService calls stay readable:

   ```ts
   const C = Config.TOKENS;   // shorthand

   export function btn(text: string, fn: string) {
     return CardService.newTextButton()
       .setText(text)
       .setBackgroundColor(C.color.primary500)
       .setOnClickAction(CardService.newAction().setFunctionName(fn));
   }

   export function heading(txt: string) {
     return CardService.newDecoratedText()
       .setText(`<b>${txt}</b>`)
       .setWrapText(true)
       .setBottomPadding(C.spacing.sm);
   }
   ```

3. **Swap hard-coded colors / paddings**
   Replace `'#1a73e8'` etc. with `C.color.primary500`, `C.spacing.md` so the palette is centralized.

4. **Add a build-time strip**
   In `bundle.js` you already kill comments; add a quick step that drops any token not referenced (optional optimisation).

---

## Bonus: automatic token updates

If you want to pull fresh tokens without manual copy-paste:

* Add a **pre-build Node script** that `fetch()`es the raw GitHub JSON, writes it into `src/modules/tokens.ts`, and commits it.
* The script runs before `tsc`, but the final emitted `Code.gs` **still contains only constants**—no runtime fetches, so single-file purity is preserved.

---

### Take-away

*Choose a design-token library, paste or script its JSON into `Config`, write two or three tiny helpers, and every CardService widget you build instantly follows an industry-grade design system—without ever breaking the “one Code.gs” deployment model.*

[1]: https://developers.google.com/workspace/add-ons?utm_source=chatgpt.com "Google Workspace add-ons | Google for Developers"
[2]: https://atlassian.design/foundations/tokens/?utm_source=chatgpt.com "Tokens - atlassian.design"
[3]: https://github.com/topics/design-system?utm_source=chatgpt.com "design-system · GitHub Topics · GitHub"
[4]: https://github.com/sturobson/Awesome-Design-Tokens?utm_source=chatgpt.com "sturobson/Awesome-Design-Tokens - GitHub"


