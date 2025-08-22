# Chat Hub SaaS – Node/Express + dynamic LLM provider

A minimal Express server that supports a default OpenAI model plus per-request provider overrides via HTTP headers.

## Run locally

```bash
npm install
npm start
```

Server starts on PORT (default 3000) and exposes:
- GET `/` → health check: `chat-hub alive`
- POST `/chat` → accepts `{ messages }` or `{ prompt }`

## Environment variables
- `OPENAI_API_KEY` — default server OpenAI key (optional; required unless client overrides with headers)
- `FINE_TUNED_MODEL` — default model name; defaults to `gpt-4o-mini`
- `PORT` — optional port (defaults to 3000)

## Provider override headers
A client can override the default server provider/model per request by sending these headers:
- `x-llm-provider` — `openai` or `http`
- `x-llm-model` — model name to use for the request
- `x-llm-api-key` — API key to override the default server key (used when provider=openai)
- `x-llm-endpoint` — endpoint URL (used when provider=http). The server will POST `{ messages }` and expects one of `reply | content | output` in the JSON response.

## Error behavior
Quota/rate-limit errors are normalized to:
```
"Quota exceeded or rate limit hit. Please check your API key or usage."
```

Other errors are returned as `{ ok: false, error }`.