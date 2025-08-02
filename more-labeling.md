## ✨ Pitch Deck‑Style Narrative

*(Why we’re building the “Prompt‑Powered Gmail Triage & Automation Studio” and how the new Classification + Action Builders unlock the next level.)*

---

### 1 · Problem

**Customer‑support mailboxes are overloaded and heterogenous.**
*Refund requests, bugs, presales, spam, partner intros*—all land in the same Gmail inbox. Existing rules are binary (filters / labels) and brittle. Teams either:

* Manually read & label every thread, losing hours.
* Deploy heavyweight help‑desk suites, sacrificing Gmail’s native speed and discoverability.

---

### 2 · Vision

Bring **LLM‑grade intelligence** *inside* Gmail—no tab‑switching, no vendor lock‑in, no complex infra.
Teams should design bespoke triage logic and response flows **visually**, then watch the system label, draft, forward or close tickets 24/7 while they stay in the inbox they already love.

---

### 3 · Solution Components

| Layer                             | What it does                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Prompt Builders** (new UI tabs) | Drag‑and‑drop interface to declare unlimited *label ↔ criteria* pairs and per‑label *action recipes* (draft, send, forward, spam, delete). |
| **Prompt Compiler**               | Translates those human‑readable rows into two readonly prompts—the Classification prompt & the Action prompt—optimised for Gemini 2.5.     |
| **AI Runtime**                    | Two fast API calls per email. Call #1 returns `{label}`. Call #2 (optional) returns `{actions[]}` aligning to our JSON schema.             |
| **Execution Engine**              | Executes Gmail actions safely (respecting Dev vs. Prod mode) and logs every step to the Live Log Viewer & spreadsheet archive.             |
| **Live Log Viewer 2.0**           | Spreadsheet‑free, filterable, real‑time console—stay in Gmail, debug instantly.                                                            |

---

### 4 · Why it wins

1. **No vendor migration** – Teams keep Gmail labels, filters, shortcuts.
2. **Infinite flexibility** – Add new labels or flows in 30 seconds via the builder; catch‑all “undefined” rule ensures nothing slips.
3. **Cost‑efficient** – Gemini Flash call per thread ≈ \$0.0003; cheaper than SaaS desk seats.
4. **Single‑file deployment** – One `Code.gs`, version‑controlled, auditable by security teams.
5. **Design‑system ready** – Material‑3 tokens embedded; UI feels native to Google Workspace.
6. **Governance** – All rules + prompts stored in user properties; exportable JSON, easy rollback, fully local, GDPR‑friendly.

---

### 5 · Target Users & ROI

| Persona                                     | Pain today                                          | Payoff with us                                                            |
| ------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| **Solo founder** running support from Gmail | Drowns in mixed inquiries, forgets to reply         | Auto‑drafts answers, highlights refunds; zero missed emails.              |
| **SMB support lead** (3‑5 reps)             | Creates 20+ Gmail filters manually, brittle         | Visual builder → maintains rules w/out IT; <1 hr/week savings/rep.        |
| **Growth hacker**                           | Needs to route leads vs. support vs. spam           | Gemini labels & forwards hot leads to CRM instantly.                      |
| **Enterprise help‑desk manager** (pilot)    | Wants LLM benefits but can’t move off Gmail + Vault | Single‑file Apps Script passes security review faster than external SaaS. |

---

### 6 · Go‑to‑Market Footprint

* **Google Workspace Marketplace listing** (free tier up to 100 mails/day).
* In‑product **“Upgrade to Pro”** upsell toggles more daily quota & analytics sheet.
* Content marketing: templates gallery (“Refund flow”, “Bug triage flow”) importable via JSON.

---

### 7 · Roadmap (3 releases)

| Quarter    | Focus                                      | Highlights                                         |
| ---------- | ------------------------------------------ | -------------------------------------------------- |
| **Q3 ’25** | 🏗 Launch Classification & Action builders | Unlimited labels, live viewer 2.0                  |
| **Q4 ’25** | 📊 Analytics & SLA monitoring              | Charts in sidebar; export to BigQuery              |
| **Q1 ’26** | 🤖 Tool‑calling                            | Add custom webhooks & data look‑ups inside prompts |

---

### 8 · Asks

* **Design approval** for Builder UI wireframes.
* **Security review** of JSON action schema.
* **Beta testers** (3–5 Gmail power‑users) to validate flows.

---

**In short:** We turn Gmail into a programmable, AI‑assisted help desk—*without* leaving Gmail, *without* extra SaaS logins, powered by a single Google Apps Script file your admin can audit in five minutes.


## 📐 End‑to‑End Specification

*(UI + data model + AI contract)*

This document turns your idea into a **concrete blueprint** that fits the “single‑file, no external runtime deps” constraint. It has two pillars:

1. **Configuration UI** (two builder tabs) – everything users touch.
2. **Runtime contract** – how we translate those configs into prompts, what JSON the AI must return, and how the execution engine in Apps Script fulfils Gmail actions.

---

### 1 Processing pipeline (big picture)

```
User Inbox           ┌─────► Step 1
                     │         Classification prompt
                     │         → AI returns {label}
                     │
Original email ──────┤
                     │         Step 2
                     └─────►   Action prompt
                               → AI returns {actions[]}
                                          ↓
                                   GmailService executes
```

*We keep two separate calls:*

* **Classification call** is *fast & cheap* (few tokens).
* **Action call** (optional per label) can be heavier (draft body, forward, etc.).

---

### 2 Data model stored in `PropertiesService`

| Key                      | Type                         | Comment                         |
| ------------------------ | ---------------------------- | ------------------------------- |
| `CLASS_RULES`            | JSON string → `Rule[]`       | All label/criteria rows.        |
| `ACTION_RULES`           | JSON string → `ActionRule[]` | Label → actions mapping.        |
| `CLASS_PROMPT_OVERRIDE`  | string                       | If user hand‑edits full prompt. |
| `ACTION_PROMPT_OVERRIDE` | string                       | idem for action prompt.         |

```ts
interface Rule {
  label: string;            // “Refund”, “Bug”, “undefined”
  criteria: string;         // free‑text condition
  order: number;            // evaluation order
}

interface ActionRule {
  label: string;            // must exist in Rule[]
  actions: GmailAction[];   // see §7
}

type GmailAction =
  | { type: 'labelOnly' }                               // default
  | { type: 'draftReply'; tone?: 'friendly'|'formal'; template?: string }
  | { type: 'sendReply';   tone?: string; template?: string }
  | { type: 'forward';     to: string;   note?: string }
  | { type: 'markSpam' }
  | { type: 'delete' }
  | { type: 'replyAll';    tone?: string; template?: string };
```

*Catch‑all* rule: A pseudo‑row with label `"undefined"` and empty criteria is auto‑appended and locked.

---

### 3 UI spec – **Classification Prompt Builder** tab

| Zone                         | Widgets (CardService)                                                                                          | Behaviour                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Header**                   | Title “Classification rules”                                                                                   |                                                                                                                                   |
| **Toolbar**                  | `＋ Add rule` button                                                                                            | pushes an overlay card with two fields: **Label** (TextInput) & **Criteria** (TextInput, multiline). On save → append new `Rule`. |
| **Rule list**                | For each rule<br> `KeyValue` → `label: criteria` + inline `✏️` *(edit)* & `🗑️` *(delete)* icons               | Order draggable: up/down arrows.                                                                                                  |
| **Catch‑all row**            | Greyed text: `undefined : (matches all remaining)`                                                             | Not editable.                                                                                                                     |
| **Generated prompt preview** | Collapsible `TextInput` (multiline) showing built prompt. `Edit raw` toggle writes to `CLASS_PROMPT_OVERRIDE`. |                                                                                                                                   |
| **Save**                     | Fixed‑footer `Save` button                                                                                     | Serialises `Rule[]` and override value to `PropertiesService`.                                                                    |

#### Prompt builder algorithm

```ts
"Return exactly one JSON line. Available labels: [Refund, Bug, Sales, undefined].\n" +
rules.map(r => `- ${r.label}: ${r.criteria}`).join("\n") +
"\nRespond with {\"label\":\"<one label>\"}"
```

If `CLASS_PROMPT_OVERRIDE` exists → use it verbatim.

---

### 4 UI spec – **Action Builder** tab

| Zone                                | Widgets                                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Toolbar**                         | `＋ Add action set` (choose existing **label** first)                                                                                                                                 |
| **Action rows**                     | Each row: **Label badge** + pills for enabled actions (`Draft`, `Send`, `Forward`, `Spam`, `Delete`). Clicking a pill opens parameters dialog (e.g. template text, forward address). |
| **Generated action prompt preview** | Same collapsible raw editor tied to `ACTION_PROMPT_OVERRIDE`.                                                                                                                        |

#### Sample generated prompt

```
You are an email automation agent. Read the email and its assigned label,
then respond ONLY with valid JSON following the schema below.

### Labels & actions
- Refund:
    draftReply: Use friendly tone, start with apology.
- Bug:
    draftReply: Formal tone. Ask for repro steps.
- Sales:
    forward: "sales@company.com"
- undefined:
    labelOnly

### JSON schema
{
 "label": "<one label from above>",
 "actions": [
   { "type": "draftReply", "body": "<markdown>" },
   { "type": "forward", "to": "<email>", "note": "<optional>" },
   ...
 ]
}
END.
```

If `ACTION_PROMPT_OVERRIDE` exists, use it.

---

### 5 Opening the tabs (hydrate UI)

1. Read `CLASS_RULES` / `ACTION_RULES` JSON.
2. Populate list widgets.
3. If user previously edited raw prompt, set collapsible “Raw prompt (custom)” open and fill value.

---

### 6 Execution time flow

```ts
const { label } = AI.callClassification(apiKey, emailBody);
const rule = actionRules.find(r => r.label === label) || { actions:[{type:'labelOnly'}]};
if (rule.actions.some(a => a.type !== 'labelOnly')) {
  const { actions } = AI.callAction(apiKey, { emailBody, label });
  GmailService.perform(actions, label);
} else {
  GmailService.perform([{type:'labelOnly'}], label);
}
```

---

### 7 💾 AI → Apps Script **response schema**

```jsonc
{
  "label": "Refund",            // must exist in Rule[] (else "undefined")
  "actions": [
    { "type": "labelOnly" },

    { "type": "draftReply",
      "body": "Hi … We’ve processed your refund …",
      "htmlBody": "<p>Hi …</p>"              // optional; plain body used if missing
    },

    { "type": "forward",
      "to": "support-tier2@company.com",
      "note": "High‑value client"             // optional
    },

    { "type": "markSpam" },

    { "type": "delete" }
  ]
}
```

*Rules*

* `actions` may be empty → we fall back to `labelOnly`.
* Allowed `type` values (case‑sensitive):
  `labelOnly | draftReply | sendReply | replyAll | forward | markSpam | delete`.
* `delete` means “move to trash”, **never** “permanent”.
* If multiple conflicting actions exist (e.g. `draftReply` **and** `sendReply`), execution order is: **labelOnly → spam/delete → forward → draft → send → replyAll** ; later wins in conflicts.

---

### 8 Execution engine (`GmailService.perform`)

```ts
export function perform(cmds: GmailAction[], label: string) {
  const thread = ...; // current GmailThread
  switch (label) { case … add/remove Gmail labels … }

  cmds.forEach(c => {
    switch (c.type) {
      case 'draftReply':
        thread.createDraftReply(c.body, { htmlBody: c.htmlBody || c.body });
        break;
      case 'sendReply':
        thread.reply(c.body, { htmlBody: c.htmlBody || c.body });
        break;
      case 'replyAll':
        thread.replyAll(c.body, { htmlBody: c.htmlBody || c.body });
        break;
      case 'forward':
        thread.forward(c.to, { subject: "FWD: " + thread.getFirstMessageSubject(),
                               htmlBody: c.note ? c.note + '\n\n' + c.body : c.body });
        break;
      case 'markSpam':
        thread.markSpam();
        break;
      case 'delete':
        thread.moveToTrash();
        break;
    }
  });
}
```

*(Development‑mode guard remains: send/draft operations become console logs unless production confirmed.)*

---

### 9 Storage & size considerations

* `Rule[]` and `ActionRule[]` JSON stay small (<10 KB).
* Generated prompts live only in memory at build time; overrides stored in `PropertiesService` under 100 KB limit.
* Live‑log writer unchanged.

---

### 10 UI implementation notes

* Build two new helpers: `UI.buildClassificationBuilder()` and `UI.buildActionBuilder()`.
* Extend `appsscript.json → addOns.common.universalActions` with “Classification rules” & “Action rules”.
* Reuse design tokens for colours (e.g. label badges use `primary500` background).

---

### Example end‑to‑end flow

1. **User** adds 3 rules: Refund, Bug, Sales.
2. Adds actions: Refund → draftReply; Sales → forward.
3. System constructs prompts (or user tweaks raw).
4. Inbox email hits pipeline.
5. **AI** returns

   ```json
   {"label":"Sales","actions":[{"type":"forward","to":"sales@company.com"}]}
   ```
6. Engine labels thread “Sales”, forwards, done. Spreadsheet logs everything, live viewer shows it.

---

### Summary

*Two builder tabs* give non‑technical users unlimited labeling & automation while we preserve a single‑file deployment. Rules → prompts → AI JSON → execution—all strictly defined. Drop this spec into your backlog and Jazz-away the UI; the back‑end already has most plumbing.
