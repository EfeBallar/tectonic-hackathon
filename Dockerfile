FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY kate ./kate

RUN useradd --uid 10001 --no-create-home kate
USER kate

# One image, two Cloud Run services: APP=api (public edge) or APP=engine (private Pub/Sub consumer).
ENV APP=api PORT=8080
CMD ["sh", "-c", "exec uvicorn \"kate.${APP}.main:app\" --host 0.0.0.0 --port \"${PORT}\" --no-server-header"]
