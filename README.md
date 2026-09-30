# Kate: a bank that notices the moment

Tectonic hackathon, KBC challenge. Kate reads the signals in a customer's transactions (a new landlord, a
first salary, a card payment in Lisbon, a balance that will not cover the rent) and reaches out at that
moment. She writes in the customer's language, can say it out loud, explains *why* she is reaching out, and
continues the conversation by voice. The same detection runs as one BigQuery pass over a synthetic
customer base of 2.3 million.

Everything runs on Google Cloud (`europe-west1`, Belgium) plus ElevenLabs. **Synthetic data only.**

## Architecture

```
  payment / demo life event
            │
            ▼
  Pub/Sub kate-transactions ──push (OIDC)──► kate-engine   Cloud Run, private
            │                                  detectors → contact policy → Gemini (Vertex AI, "eu")
            └─ after 5 failures ─► DLQ         ├─► Firestore  customers/{id}/nudges
                                               └─► BigQuery   live_transactions · signals · nudge_events

  browser / your frontend ──► kate-api         Cloud Run, public (auth in the app)
                                /api/*         sessions, nudges, feedback, demo controls, analytics
                                /api/nudges/{id}/audio   ElevenLabs text-to-speech ("Kate reads it to you")
                                /api/voice/session       short-lived ElevenLabs credentials + session token
  ElevenLabs agent "Kate" ────► /tools/*       7 webhook tools (voice: nl / fr / en, Gemini as LLM)

  BigQuery population_*   2.3M synthetic customers → batch signals → AI.GENERATE messages from SQL
  Secret Manager          session key, tool secret, demo access code, ElevenLabs key
```

| Path | What |
|---|---|
| `infra/` | Idempotent gcloud scripts: `up.sh` runs `00`→`06`; `07_population.sh` is the scale demo |
| `kate/engine/` | Pub/Sub consumer: `detectors.py` (life moments), `policy.py` (consent, cooldown, caps), `composer.py` (Gemini) |
| `kate/api/` | Public API, ElevenLabs tools (`tools.py`), test console (`static/index.html`) |
| `kate/store.py` | Every Firestore/BigQuery read and write |
| `kate/personas.py` | Four demo customers (nl/fr/en) with six months of history and scripted life events |
| `agent/` | Kate on ElevenLabs, as code: `prompt.md` + `sync.py` (secret, tools, agent) |
| `sql/` | Schema, 2.3M-customer generator, batch signal detection, Gemini-in-SQL messages |
| `tests/` | Unit tests with in-memory fakes, no cloud needed |

## Run it

You need `gcloud`, Python 3.12, the team's GCP credentials (Builderbase link) and an ElevenLabs API key.

```bash
gcloud auth login
```
```bash
gcloud auth application-default login
```
```bash
cp .env.example .env
```
Fill in `GCP_PROJECT_ID` and `ELEVENLABS_API_KEY` in `.env`, then:
```bash
make setup
```
```bash
make test
```
```bash
make up
```

`make up` takes about 10 minutes the first time. At the end it prints the `kate-api` URL and the demo
access code. Open the URL, log in as a persona, click a life event. Kate's message appears within seconds;
use **▶ Listen** or **Talk about this** (voice needs Chrome or Safari with a microphone).

Scale demo: `make population` creates 2.3M customers (~20 GB in BigQuery, generation reads no data), detects
life moments for all of them and lets Gemini write 200 sample messages from SQL. Use `make population
N_CUSTOMERS=100000` for a quick run. Log in as an analyst (`POST /api/auth/analyst-login`) and read
`GET /api/analytics/overview`.

## Day to day

| I want to… | Run |
|---|---|
| ship code changes | `make deploy` |
| change Kate's prompt, voice or tools | edit `agent/`, then `make agent` |
| pick another voice (e.g. Flemish) | `make voices`, set `ELEVENLABS_VOICE_ID` in `.env`, `make agent` |
| replay a persona | **Reset persona** in the console, or `make seed` |
| fire an event from the terminal | `make simulate ARGS="D002 vehicle_purchase"` (list: `make events`) |
| check every cloud dependency | `make check` |
| read engine logs | `gcloud run services logs read kate-engine --region europe-west1 --limit 50` |
| avoid cold starts before filming | `MIN_INSTANCES=1` in `.env`, `make deploy` |

## Building your frontend on it

Set `CORS_ALLOWED_ORIGINS` (e.g. `http://localhost:3000`) and `make deploy`. All calls use
`Authorization: Bearer <token>` from the login.

| Endpoint | |
|---|---|
| `GET /api/demo/personas` | personas + their scripted events |
| `POST /api/auth/demo-login` `{access_code, customer_id}` | customer session token |
| `GET /api/me` · `/api/transactions?days=30` · `/api/spending?days=30` | profile and history |
| `GET /api/nudges` | Kate's messages: title, message, reason ("why"), products, status |
| `POST /api/nudges/{id}/respond` `{response: accepted\|dismissed\|snoozed}` | feedback loop |
| `GET /api/nudges/{id}/audio` | MP3 of Kate reading the message |
| `POST /api/voice/session` `{nudge_id?}` | pass the result to `Conversation.startSession` of `@elevenlabs/client` (see the console) |
| `POST /api/demo/events` `{event_id}` · `POST /api/demo/reset` | drive the demo |

## Security choices (Aikido)

- The customer id always comes from a verified token, never from a request parameter. Firestore paths are
  scoped per customer, so another customer's nudge id simply returns 404 (IDOR tests in `tests/test_api.py`).
- The voice agent cannot pick whose data it reads. ElevenLabs injects two headers into every tool call: a
  workspace secret (proves the caller is our agent) and a 30-minute session token our backend minted for this
  customer (audience `kate-voice`, useless on `/api`). The LLM never sees or chooses either.
- The ElevenLabs agent is private (`enable_auth`): conversations need credentials from `kate-api`, and the
  browser may only override the language.
- kate-engine is private: Cloud Run IAM *and* the app verify the Google-signed Pub/Sub token and its identity.
- Least-privilege service accounts per service; secrets live in Secret Manager, per-secret access, never in git.
- HS256 pinned, expiry/audience/issuer required, constant-time secret comparison, login rate limiting,
  parameterised BigQuery queries, strict input validation, LLM output rendered as text only, security headers.

## Troubleshooting

- **Cloud Build permission errors** right after `00_bootstrap.sh`: IAM grants take a minute; rerun
  `make deploy`, or build locally with `BUILD_MODE=docker` (needs Docker running).
- **`allUsers` blocked by an org policy**: `04_deploy.sh` falls back to `--no-invoker-iam-check`. If that is
  refused too, ask the organisers to allow public Cloud Run services.
- **Gemini "model not found"**: set `GEMINI_MODEL` / `GEMINI_LOCATION` (e.g. `global`) and `make deploy`.
  Nudges still arrive meanwhile, written from templates (`composer: template`).
- **No nudge appears**: `make check`, the engine logs, and the `kate-transactions-dlq-inspect` subscription.
- **Firestore errors from your laptop**: `gcloud auth application-default set-quota-project <project-id>`.
- **Voice does not start**: `make agent` sets `ELEVENLABS_AGENT_ID`; allow the microphone. If WebRTC is blocked
  on the venue Wi-Fi the console falls back to WebSockets.

## Unfinished / known limits

- Demo login (shared access code + persona picker) stands in for real authentication such as itsme.
- Synthetic data only; the product catalogue in `kate/catalog.py` is illustrative, not KBC's.
- Rate limiting is in memory, per Cloud Run instance.
- Conversation transcripts are not stored yet; Kate remembers preferences through the `kate_remember` tool.
- The 2.3M-customer run is batch only; the live pipeline serves the demo personas.
