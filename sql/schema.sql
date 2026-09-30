-- BigQuery dataset and tables for Kate. Idempotent: run by infra/01_data.sh.
-- Synthetic data only. Placeholders are filled in by kate/ops/run_sql.py.

CREATE SCHEMA IF NOT EXISTS `${PROJECT}.${DATASET}`
OPTIONS (location = '${LOCATION}', description = 'Kate: transactions, life-moment signals and nudges (synthetic data)');

CREATE TABLE IF NOT EXISTS `${PROJECT}.${DATASET}.customers` (
  customer_id STRING NOT NULL,
  first_name STRING,
  age INT64,
  language STRING,
  city STRING,
  segment STRING,
  products ARRAY<STRING>,
  created_at TIMESTAMP
)
OPTIONS (description = 'Demo personas, mirrors Firestore customers/*. Replaced by make seed.');

-- Seed history is replaced by load jobs; live events are only ever streamed in. Keeping them in
-- separate tables means re-seeding never needs DML on rows still in the streaming buffer.
CREATE TABLE IF NOT EXISTS `${PROJECT}.${DATASET}.seed_transactions` (
  transaction_id STRING NOT NULL,
  customer_id STRING NOT NULL,
  booked_at TIMESTAMP NOT NULL,
  amount NUMERIC NOT NULL,
  currency STRING,
  counterparty STRING,
  category STRING,
  channel STRING,
  country STRING,
  description STRING,
  balance_after NUMERIC,
  source STRING,
  ingested_at TIMESTAMP
)
PARTITION BY DATE(booked_at)
CLUSTER BY customer_id
OPTIONS (description = 'Six months of history per demo persona (make seed)');

CREATE TABLE IF NOT EXISTS `${PROJECT}.${DATASET}.live_transactions` (
  transaction_id STRING NOT NULL,
  customer_id STRING NOT NULL,
  booked_at TIMESTAMP NOT NULL,
  amount NUMERIC NOT NULL,
  currency STRING,
  counterparty STRING,
  category STRING,
  channel STRING,
  country STRING,
  description STRING,
  balance_after NUMERIC,
  source STRING,
  ingested_at TIMESTAMP
)
PARTITION BY DATE(booked_at)
CLUSTER BY customer_id
OPTIONS (description = 'Transactions streamed through Pub/Sub into kate-engine');

CREATE OR REPLACE VIEW `${PROJECT}.${DATASET}.transactions` AS
SELECT * FROM `${PROJECT}.${DATASET}.seed_transactions`
UNION ALL
SELECT * FROM `${PROJECT}.${DATASET}.live_transactions`;

CREATE TABLE IF NOT EXISTS `${PROJECT}.${DATASET}.signals` (
  signal_id STRING NOT NULL,
  customer_id STRING NOT NULL,
  signal_type STRING NOT NULL,
  topic STRING,
  detected_at TIMESTAMP NOT NULL,
  transaction_id STRING,
  confidence FLOAT64,
  evidence JSON,
  decision STRING,
  source STRING
)
PARTITION BY DATE(detected_at)
CLUSTER BY signal_type
OPTIONS (description = 'Every detected life moment and the contact-policy decision (explainability)');

CREATE TABLE IF NOT EXISTS `${PROJECT}.${DATASET}.nudge_events` (
  event_id STRING NOT NULL,
  nudge_id STRING NOT NULL,
  customer_id STRING NOT NULL,
  signal_type STRING,
  event_type STRING NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  detail JSON
)
PARTITION BY DATE(occurred_at)
CLUSTER BY customer_id
OPTIONS (description = 'created / accepted / dismissed / snoozed: the feedback loop');
