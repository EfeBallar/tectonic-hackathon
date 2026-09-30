"""Process-wide Google Cloud clients, created on first use.

Credentials come from the Cloud Run service account in the cloud and from
`gcloud auth application-default login` on a laptop.
"""

from functools import lru_cache

from kate.config import get_settings


@lru_cache
def bigquery_client():
    from google.cloud import bigquery

    s = get_settings()
    return bigquery.Client(project=s.gcp_project_id or None, location=s.bq_location)


@lru_cache
def firestore_client():
    from google.cloud import firestore

    s = get_settings()
    return firestore.Client(project=s.gcp_project_id or None, database=s.firestore_database)


@lru_cache
def publisher_client():
    from google.cloud import pubsub_v1

    return pubsub_v1.PublisherClient()


@lru_cache
def genai_client():
    from google import genai

    s = get_settings()
    if s.gemini_api_key:  # Gemini API (AI Studio key), for projects where Vertex AI is blocked
        return genai.Client(api_key=s.gemini_api_key)
    # location "eu"/"us" resolves to the multi-region endpoint (aiplatform.eu.rep.googleapis.com)
    return genai.Client(vertexai=True, project=s.gcp_project_id, location=s.gemini_location)
