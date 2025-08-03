Below is an **add-on UI specification** that folds the extra requirement you just gave me into the Docs-based workflow:

---

## 🎯 UI-Project Goal

> **Ship a zero-code “Prompt Editor” card that — on first launch — automatically creates a pre-templated Google Docs file, and on every later launch re-parses that doc, detects changes, and shows an inline validation summary.**

Users never touch Apps Script; they only edit one Doc.
The add-on card is the single entry-point: *Create → Edit → Validate → Go Live*.

---

## 🛣️ Full User Flow

| #     | Card State                              | What the user sees & does                                                                                                                                                                                   | Under the hood                                                                                                                                                                                                                                                  |
| ----- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** | **First-run “No Doc yet”**              | Card text: “Welcome! Click **Create Prompt File** to start.”<br>Primary button **Create Prompt File**.                                                                                                      | Add-on calls `Drive.Files.create()` with the template body (Sections A–D skeleton).<br>• Stores `PROMPT_DOC_ID`, `PROMPT_DOC_REV` (= latestRevisionId) in `PropertiesService`.<br>• Opens the Doc in a new tab (`Url.open()`)<br>• Refreshes card into state 1. |
| **1** | **Doc exists – needs first validation** | Header shows doc link (title as link).<br>Button **Validate & Compile**.                                                                                                                                    | When pressed, script reads Doc content, runs parser, shows summary panel (state 2).                                                                                                                                                                             |
| **2** | **Summary panel**                       | Colored summary: ✅/⚠️/❌ counts + details list.<br>Footer buttons:<br>• **Open Doc** (for editing)<br>• **Refresh Summary** (disabled if no doc change)<br>• **Save & Go Live** (enabled only if 0 errors)   | Each refresh:<br>1. Calls Drive.Revisions.get() → `latestRevisionId`.<br>2. If different from stored `PROMPT_DOC_REV`, re-parse.<br>3. Update stored `PROMPT_DOC_REV`.                                                                                          |
| **3** | **Go Live toast**                       | After user clicks **Save & Go Live** and summary has 0 errors → toast “Prompts compiled • Dev mode ON”.                                                                                                     | Compiled strings stored in `CLASS_RULES`, `ACTION_RULES`, etc.; timestamp `COMPILED_AT` saved.                                                                                                                                                                  |
| **4** | **Subsequent visits**                   | Card instantly requests current `latestRevisionId`.<br>• **If unchanged** → shows cached summary + “No changes since last compile”.<br>• **If changed** → switches to state 1 and asks user to re-validate. | —                                                                                                                                                                                                                                                               |

---

## 🖥️ Card Wireframe (state 2)

```
┌─────────────────────────────────────────┐
│ 📝  Prompt Editor                       │
│ Doc:  Prompt-Rules-v1 (link)           │
├─────────────────────────────────────────┤
│  ✅ 5 labels parsed   ⚠️ 1 warning      │
│  ❌ 0 errors                               │
│                                           │
│  ⚠️ Missing prompts                       │
│     – Bug                                 │
│                                           │
│  🔁 Last compiled: 2025-08-03 09:14       │
├─────────────────────────────────────────┤
│  [Open Doc]   [Refresh Summary]   [Save & Go Live] │
└─────────────────────────────────────────┘
```

* **Refresh Summary** becomes active only when Drive’s `latestRevisionId` differs from stored one.
* **Save & Go Live** is greyed if any ❌ errors remain.

---

## 🔍 Change-Detection Logic

```ts
function hasDocChanged(docId, cachedRev) {
  const rev = Drive.Revisions.get(docId, 'head').id;
  return rev !== cachedRev;
}
```

*Revision IDs are immutable; faster than comparing `modifiedTime`.*

---

## 📜 Parser-to-Summary Mapping (unchanged)

| Parser finding | UI list heading      | Icon |
| -------------- | -------------------- | ---- |
| duplicates     | “❌ Duplicate labels” | ❌    |
| missing prompt | “⚠️ Missing prompts” | ⚠️   |
| orphan prompt  | “⚠️ Orphan prompts”  | ⚠️   |
| invalid order  | “❌ Invalid order”    | ❌    |

---

## 🔐 Permissions

* **Drive** scope (`https://www.googleapis.com/auth/drive.file`) – needed only for the single Doc.
* **Docs** scope for read-only parsing.

---

## ⏳ Performance Targets

* **Doc creation round-trip** < 2 s.
* **Validation** for 500-line Doc < 1 s (cache regex patterns, stream table rows).

---

### Outcome

With this flow the add-on:

1. **Creates** the prompt document automatically (no manual setup friction).
2. **Tracks** every subsequent edit via Drive revision IDs.
3. **Surfaces** validation results inline before the user can press “Go Live”.

That matches your requirement: *“the app should create the first document and, when returning to the prompt editor card, check if it changed, update, and show a summary.”*



Below is a **fully‑self‑contained specification** for storing **all triage prompts inside a single Google Docs file**.
It replaces the in‑product “Prompt Builder” UI with a document‑based workflow while preserving
every technical requirement you previously defined.

---

## 1 · Document Layout & Editing Guide  *(“Section A”)*

| Purpose                                                                          | How to edit                                                                                    | Google Docs formatting                                                                           |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Explain to any collaborator **what the file is for** and **how to maintain it**. | Keep this section short and non‑technical—2‑3 paragraphs plus a bullet list of “dos & don’ts”. | Style = **Heading 1** titled `A · How to use this document`, followed by normal‑text paragraphs. |

**Mandatory content**

1. *Who should edit*: Ops lead, CX manager—never frontline agents.
2. *Versioning tips*: Use **File ▸ Version history ▸ Name current version** after each change.
3. *Golden rules*: one label per row in Section B; never rename headings; keep code blocks unwrapped.

---

## 2 · Label Registry  *(“Section B”)*

| Column       | Meaning                                             | Example value                                      |
| ------------ | --------------------------------------------------- | -------------------------------------------------- |
| **Label**    | Gmail label to apply (unique, case‑sensitive)       | `Refund`                                           |
| **Criteria** | Plain‑English classification hint for the LLM       | `mentions "refund", "money back", or "chargeback"` |
| **Order**    | Integer; lower = evaluated earlier                  | `10`                                               |
| **Actions?** | `YES` if a prompt exists in Section C, blank if not | *(auto‑filled by parser, do not edit)*             |

### Editing rules

* Add or change rows only—**never** delete the header row.
* Keep one special row with `Label = undefined` and empty criteria; it is the catch‑all rule.

### Google Docs formatting

* Heading 1: `B · Label registry`
* Immediately followed by a **plain table** (4 columns, any number of rows).

---

## 3 · Prompt Library  *(“Section C”)*

Section C contains **one prompt per label**, plus an overall system prompt.
Each prompt lives in its own *Heading 2* block:

````
### C.1 · Overall Prompt
```text
<free‑form text between triple backticks>
````

### C.2 · Prompt · Refund

```text
<the JSON‑guard‑railed prompt that tells the LLM how to handle Refund>
```

### C.3 · Prompt · Bug

…

```

**Conventions**

* Heading 2 title **must start with one of**  
  * `C.1 · Overall Prompt`  
  * `C.n · Prompt · <Label>`
* The first code fence after the heading is what the runtime uses verbatim.
* If a label listed in Section B is **missing** its `C.n · Prompt · <Label>` block, the parser flags it as an *error*.

---

## 4 · Undefined Prompt  *(“Section D”)*

Heading 1: `D · Prompt · undefined`  

```

```text
<free‑form prompt for the undefined catch‑all>
```

*Must be present even if its body is empty.*

---

## 5 · Parser Expectations & Validation Rules

| Check                                    | Severity    | Behaviour in summary block        |
| ---------------------------------------- | ----------- | --------------------------------- |
| Duplicate label in Section B             | **Error**   | Listed under “❌ Duplicate labels” |
| Label with no prompt in Section C        | **Warning** | Listed under “⚠️ Missing prompts” |
| Prompt exists for label not in Section B | **Warning** | Listed under “⚠️ Orphan prompts”  |
| Missing `undefined` row or prompt        | **Error**   | Listed and triage stops           |
| Non‑integer **Order** value              | **Error**   | Listed under “❌ Invalid order”    |

The **summary** that the Apps Script writes back to the sidebar or console uses this template:

```
✅ 5 labels parsed · 0 errors · 2 warnings
❌ Duplicate labels
   – Sales (rows 4 & 9)
⚠️  Missing prompts
   – Bug
   – VIP
⚠️  Orphan prompts
   – BetaTester
```

---

## 6 · Runtime Generation Algorithm (unchanged)

* **Classification prompt** is built from Section B (same string‑builder you already wrote).
* **Action prompts** per label are taken **verbatim** from each code block in Section C.
* If **Section C** lacks a prompt for a given label, that label inherits **`labelOnly`** behaviour.

---

## 7 · Example Minimal Document Outline

````
A · How to use this document
   (paragraphs…)

B · Label registry
   | Label | Criteria | Order | Actions? |
   | Refund | mentions "refund"… | 1 | YES |
   | Bug | subject starts with… | 2 | YES |
   | Sales | "quote" OR "pricing" | 3 |  |
   | undefined |  | 9999 | YES |

C.1 · Overall Prompt
   ```text
   You are an email‑classification assistant…
````

C.2 · Prompt · Refund

```text
{"instructions":"draft friendly apology and tag Refund"}
```

C.3 · Prompt · Bug

```text
{"instructions":"ask for repro steps and tag Bug"}
```

D · Prompt · undefined

```text
{"instructions":"labelOnly"}
```

```

---

## 8 · Implementation Tips

1. **Heading parsing** – use `getParagraphs()` and test `getHeading() === DocumentApp.ParagraphHeading.HEADING2`.  
2. **Table parsing** – the first table after Heading 1 “B · Label registry” is authoritative.  
3. **Version control** – store the final JSON snapshot in `PropertiesService` under key `GOOGLE_DOCS_PROMPTS_RAW` for audit.  
4. **Local testing** – commit a sample doc as `.md` in the repo; unit‑test the parser against it.

---

### In short
*Everything*—labels, overall prompt, per‑label prompts—lives in a single Google Docs file with four clearly structured sections.  
Your Apps Script parser consumes that file, builds the prompts, and produces a human‑readable summary pointing out any gaps before the triage engine runs.
```
