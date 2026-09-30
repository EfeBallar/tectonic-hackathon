FROM node:22-bookworm-slim AS shared-engine
WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/lib ./lib
COPY web/scripts ./scripts
RUN node scripts/build-engine.mjs

FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 libatomic1 && rm -rf /var/lib/apt/lists/*
COPY --from=shared-engine /usr/local/bin/node /usr/local/bin/node

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY kate ./kate
COPY --from=shared-engine /build/kate/assets ./kate/assets

RUN useradd --uid 10001 --no-create-home kate
USER kate

# One image, two Cloud Run services: APP=api (public edge) or APP=engine (private Pub/Sub consumer).
ENV APP=api PORT=8080
CMD ["sh", "-c", "exec uvicorn \"kate.${APP}.main:app\" --host 0.0.0.0 --port \"${PORT}\" --no-server-header"]
