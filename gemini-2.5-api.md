Below is a one-stop cheat-sheet for **Gemini 2.5 Flash (GA since 17 Jun 2025)** when you want plain-text in / plain-text out—no images, audio or video.

---

## 1. What the model can do (text-only focus)

| Area                             | Highlights                                                                                                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context window**               | 1 048 576 input tokens + up to 65 535 output tokens (≈ 500 MB request size) ([Google Cloud][1])                                                                               |
| **Speed vs quality**             | “**Thinking**” (chain-of-thought in the response) is **ON by default**; disable it by setting `thinkingBudget = 0` for lower latency and cost ([Google AI for Developers][2]) |
| **Core text skills**             | Chat, summarization (long docs), classification/extraction, advanced reasoning, RAG, code generation, tool/function calling, JSON / structured output ([Google Cloud][1])     |
| **Fine-tuning & caching**        | Supports supervised fine-tuning and  context-cache API; both work for text-only workloads.                                                                                    |
| **Grounding & function calling** | Optional Google Search grounding and JSON function-call schema; both available in text-only mode.                                                                             |

---

## 2. Pricing snapshot (Developer API – paid tier)

| Tokens                           | Cost per 1 M tokens         |
| -------------------------------- | --------------------------- |
| **Input (text / image / video)** | **\$ 0.30**                 |
| **Input (audio)**                | \$ 1.00 *(irrelevant here)* |
| **Output (incl. thinking)**      | **\$ 2.50**                 |

Free-tier calls are still available but with tight rate limits. ([Google AI for Developers][3])
*(Vertex AI prices differ—see their table if you deploy there.)*

---

## 3. Calling the model

### 3.1 Google AI Developer API (REST)

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "contents":[{"parts":[{"text":"Explain large-scale RAG in 5 sentences"}]}],
        "generationConfig":{
          "temperature":0.7,
          "thinkingConfig":{"thinkingBudget":0}   # turn off thinking if wanted
        }
      }'
```

*Streaming?* change the method suffix to **`:streamGenerateContent`** and keep everything else the same. ([Google AI for Developers][2])

### 3.2 Google AI SDKs

Python:

```python
from google import genai
client = genai.Client()
resp = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Summarize the attached RFC in 150 words.",
    config=genai.GenerateContentConfig(
        temperature=0.3,
        thinking_config=genai.ThinkingConfig(thinking_budget=0)
    )
)
print(resp.text)
```

JS/Go/Java examples are identical—just swap the library.

### 3.3 Vertex AI (managed, regional)

* **Endpoint form (REST):**
  `POST https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{REGION}/publishers/google/models/gemini-2.5-flash:predict`

* **Python SDK (recommended):**

  ```python
  from vertexai.preview.generative_models import GenerativeModel
  model = GenerativeModel("gemini-2.5-flash")
  response = model.generate_content(
      "Create a one-paragraph TL;DR for the text below ...",
      generation_config={"temperature":0.5, "max_output_tokens":512}
  )
  ```

Vertex gives you quota management, provisioned throughput and data-residency controls; the JSON request body structure is identical to the Developer API minus the API-key header.

---

## 4. Request & response anatomy

```jsonc
{
  "contents": [
    {
      // optional role: "user" | "model" | "system"
      "parts": [
        { "text": "<your prompt here>" },
        // multishot? just add more parts
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "topP": 0.95,
    "candidateCount": 1,
    "thinkingConfig": { "thinkingBudget": 0 }   // 0 = off
  },
  "tools": [ /* function-calling schemas, Google Search, etc. */ ]
}
```

The response is an array of `candidates` → `content.parts[0].text` for plain text. If you enabled thinking, you’ll get an extra `thinking` field containing the scratchpad.

---

## 5. Best-practice tips (text work)

1. **Chunk long docs**: 1 M tokens is huge, but latency scales with input size. For near-real-time jobs, break the text into paragraphs and chain calls.
2. **Disable thinking when you only need speed**—it can add 15-30 % extra tokens + latency.
3. **Structured output**: supply a JSON schema in `tools` to force the model to reply with strict JSON—handy for downstream parsing.
4. **Context caching**: reuse large static passages (e.g., manuals) cheaply by passing a `cacheId`; only delta tokens are billed.
5. **Function calls**: build simple tool wrappers (e.g., call a weather API) and let Gemini decide when to invoke them.
6. **Grounding**: for fact-heavy answers, wrap your prompt with `groundingConfig.useGoogleSearch = true` to auto-cite web URLs.

---

### TL;DR

*`gemini-2.5-flash`* is the sweet-spot Google model this summer: huge context, cheap-ish tokens, and “thinking” for tough problems—yet you can strip it down for ultra-fast plain-text generation. Use the **`generateContent`** (or streaming) path on the Developer API, or the `predict` path / Vertex SDK if you’re on GCP. Enjoy building! 🎉

[1]: https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash "Gemini 2.5 Flash  |  Generative AI on Vertex AI  |  Google Cloud"
[2]: https://ai.google.dev/gemini-api/docs/quickstart "Gemini API quickstart  |  Google AI for Developers"
[3]: https://ai.google.dev/gemini-api/docs/pricing "Gemini Developer API Pricing  |  Gemini API  |  Google AI for Developers"
