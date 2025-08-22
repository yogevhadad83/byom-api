# Chat Hub SaaS – Node/Express + dynamic LLM provider

A minimal Express server that supports per-request credentials via headers or a per-user in-memory provider registry (agent). No server default API key.

## Run locally

```bash
npm install
npm start
```

Server starts on PORT (default 3000) and exposes:
- GET `/` → health check: `chat-hub alive`
- POST `/chat` → accepts `{ messages }` or `{ prompt }` and optional `{ userId }`
- POST `/register-provider` → register per-user provider config (in-memory, 24h TTL)
- GET `/provider/:userId` → fetch masked provider config
- DELETE `/provider` → delete stored provider config

## Environment variables
- `FINE_TUNED_MODEL` — default model name; defaults to `gpt-4o-mini`
- `PORT` — optional port (defaults to 3000)

## Configure a provider

Option A — via headers (per request):

OpenAI:
- `x-llm-provider: openai` (or omit and include an API key)
- `x-llm-api-key: <your-openai-key>`
- `x-llm-model: <model>` (optional; defaults to `FINE_TUNED_MODEL`)

Custom HTTP endpoint:
- `x-llm-provider: http`
- `x-llm-endpoint: https://...` (server will POST `{ messages }`)
- `x-llm-model: <model>` (optional; forwarded in header)

Option B — via per-user registration:

1) POST `/register-provider` with body `{ userId, provider: 'openai'|'http', config: { apiKey?, endpoint?, model? } }`
	- For `openai`, `config.apiKey` is required (model optional)
	- For `http`, `config.endpoint` is required (model optional)
2) Then call POST `/chat` with body `{ userId, messages:[...] }` (or set header `x-user-id`)

Provider configs are stored only in memory with a 24h TTL and purged about every 10 minutes. This is for POC usage only.

## Error behavior
Quota/rate-limit errors are normalized to:
```
"Quota exceeded or rate limit hit. Please check your API key or usage."
```

Other errors are returned as `{ ok: false, error }`.

If neither headers nor a per-user config are provided:
```
"No provider configured for this user. Register a provider first."
```