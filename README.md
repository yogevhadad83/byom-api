# Chat Hub SaaS – Node/Express + dynamic LLM provider

A minimal Express server that requires per-request credentials and supports provider overrides via HTTP headers.

## Run locally

```bash
npm install
npm start
```

Server starts on PORT (default 3000) and exposes:
- GET `/` → health check: `chat-hub alive`
- POST `/chat` → accepts `{ messages }` or `{ prompt }`

## Environment variables
- `FINE_TUNED_MODEL` — default model name; defaults to `gpt-4o-mini`
- `PORT` — optional port (defaults to 3000)

## Required headers
Pick one of the following per request:

OpenAI:
- `x-llm-provider: openai` (or omit and include an API key)
- `x-llm-api-key: <your-openai-key>`
- `x-llm-model: <model>` (optional; defaults to `FINE_TUNED_MODEL`)

Custom HTTP endpoint:
- `x-llm-provider: http`
- `x-llm-endpoint: https://...` (server will POST `{ messages }`)
- `x-llm-model: <model>` (optional; forwarded in header)

Without these headers, the server will return an error: missing provider credentials.

## Error behavior
Quota/rate-limit errors are normalized to:
```
"Quota exceeded or rate limit hit. Please check your API key or usage."
```

Other errors are returned as `{ ok: false, error }`.