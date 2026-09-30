# Kate: run `make help` for the list of targets.
PYTHON ?= $(shell command -v python3.12 || command -v python3)
VENV := .venv
PY := $(VENV)/bin/python
N_CUSTOMERS ?= 2300000

.PHONY: help setup test up deploy agent agent-dry-run voices seed population check events simulate dev

help:
	@grep -E '^[a-z-]+:.*## ' Makefile | awk -F':.*## ' '{printf "  %-14s %s\n", $$1, $$2}'

setup: ## create .venv and install the Python dependencies
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install -q --upgrade pip
	$(VENV)/bin/pip install -q -r requirements-dev.txt

test: ## unit tests, no cloud access needed
	$(PY) -m pytest -q

up: ## create or update everything in GCP + ElevenLabs (idempotent)
	infra/up.sh

deploy: ## rebuild and redeploy both Cloud Run services
	infra/04_deploy.sh

agent: ## push the ElevenLabs agent (agent/prompt.md + agent/sync.py)
	infra/05_elevenlabs.sh

agent-dry-run: ## print the ElevenLabs agent + tool payloads without calling the API
	$(PY) -m agent.sync --dry-run

voices: ## list ElevenLabs voices to pick ELEVENLABS_VOICE_ID
	set -a; . ./.env; set +a; $(PY) -m agent.sync --list-voices

seed: ## reload the demo personas (Firestore + BigQuery)
	infra/06_seed.sh

population: ## scale demo: N_CUSTOMERS synthetic customers in BigQuery (default 2.3M)
	N_CUSTOMERS=$(N_CUSTOMERS) infra/07_population.sh

check: ## smoke-test BigQuery, Firestore, Pub/Sub and Gemini from this laptop
	$(PY) -m kate.ops.check

events: ## list personas and their scripted life events
	$(PY) -m kate.ops.simulate --list

simulate: ## publish a life event: make simulate ARGS="D001 moved_house"
	$(PY) -m kate.ops.simulate $(ARGS)

dev: ## run kate-api locally against the cloud data (needs ADC + secrets in .env)
	ENV=local $(VENV)/bin/uvicorn kate.api.main:app --reload --port 8080
