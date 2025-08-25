# Chat Hub SaaS – Node/Express + dynamic LLM provider

A minimal Express server that supports per-request credentials via headers or a per-user in-memory provider registry (agent). No server default API key.

## Run locally

```bash
npm install
npm start
```

Server starts on PORT (default 3000) and exposes:
- GET `/` → health check: `byom-api alive`
- POST `/chat` → accepts `{ messages }` or `{ prompt }` or a full `{ conversation }` snapshot
- POST `/register-provider` → register per-user provider config
- GET `/provider/:userId` → fetch masked provider config
- DELETE `/provider` → delete stored provider config

## Environment variables
- `FINE_TUNED_MODEL` — default model name; defaults to `gpt-4o-mini`
- `PORT` — optional port (defaults to 3000)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anon key (JWT secret)
- `CORS_ORIGIN` — comma-separated origins to allow (e.g. `http://localhost:3000,https://byom-chat.onrender.com`)

## Supabase
This API now protects POST `/register-provider` and POST `/chat` with Supabase Auth. Provider config is persisted per-user in `public.providers` with row level security (RLS) so users can only access their own config.

Required table and RLS (for reference):

```
create table if not exists public.providers (
	user_id uuid primary key references auth.users(id) on delete cascade,
	provider text not null,
	config jsonb not null,
	updated_at timestamptz not null default now()
);
alter table public.providers enable row level security;
create policy "users manage their provider"
	on public.providers
	for all
	to authenticated
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);
```

Auth is via the standard `Authorization: Bearer <supabase_user_access_token>` header.

### Test with curl

```
# 1) Get a Supabase user session token (use the UI for magic link or a provider),
#    then export it before hitting the API:
export SUPA_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Set the API URL
export API="http://localhost:3000"

# 2) Register provider
curl -s -X POST "$API/register-provider" \
	-H "Authorization: Bearer $SUPA_TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"provider":"openai","config":{"apiKey":"sk-...","model":"gpt-4o-mini"}}'

# 3) Chat
curl -s -X POST "$API/chat" \
	-H "Authorization: Bearer $SUPA_TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"prompt":"Say hi as a pirate.","conversation":[{"author":"alice","role":"user","text":"hey","ts":1}]}'
```

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

Option B — via per-user registration (now persisted in Supabase and protected by RLS):

1) POST `/register-provider` with body `{ provider: 'openai'|'http', config: { apiKey?, endpoint?, model? } }`
	- For `openai`, `config.apiKey` is required (model optional)
	- For `http`, `config.endpoint` is required (model optional)
2) Then call POST `/chat` with body `{ messages:[...] }` or `{ prompt }` and include the Supabase bearer token

Conversation snapshot and response meta

You can also submit a conversation snapshot in the request body, for example:

```json
{
	"userId": "alice",
	"conversation": [
		{ "author": "Alice", "role": "user", "text": "Hi", "ts": 1690000000000 },
		{ "author": "Assistant", "role": "assistant", "text": "Hello!", "ts": 1690000001000 }
	],
	"prompt": "What's a good next reply?"
}
```

When a `conversation` array is supplied the server will convert it into a single user message containing the lines `"Author: text"` and forward it to the configured provider along with any `systemPrompt` from the per-user provider config.

Responses include the model id used by the provider in `meta.modelId`, e.g.:

```json
{ "ok": true, "reply": "...assistant text...", "meta": { "modelId": "gpt-4o-mini" } }
```

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