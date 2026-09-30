-- Life moments for the whole synthetic customer base in one pass: the batch twin of
-- kate/engine/detectors.py. Scans population_transactions (~20 GB at 2.3M customers, about 0.15 USD on-demand).

CREATE OR REPLACE TABLE `${PROJECT}.${DATASET}.population_signals`
CLUSTER BY signal_type
AS
WITH t AS (
  SELECT
    customer_id, booked_at, amount, counterparty, category, country,
    booked_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) AS is_recent
  FROM `${PROJECT}.${DATASET}.population_transactions`
),
rent AS (
  SELECT
    customer_id,
    ARRAY_AGG(DISTINCT IF(is_recent, counterparty, NULL) IGNORE NULLS) AS recent_landlords,
    ARRAY_AGG(DISTINCT IF(NOT is_recent, counterparty, NULL) IGNORE NULLS) AS previous_landlords,
    MAX(IF(is_recent, -amount, NULL)) AS monthly_rent
  FROM t
  WHERE category = 'rent'
  GROUP BY customer_id
),
salary AS (
  SELECT
    customer_id,
    AVG(IF(is_recent, amount, NULL)) AS recent_salary,
    AVG(IF(NOT is_recent, amount, NULL)) AS previous_salary,
    COUNTIF(NOT is_recent) AS previous_count,
    ANY_VALUE(counterparty) AS employer
  FROM t
  WHERE category = 'salary'
  GROUP BY customer_id
),
flows AS (
  SELECT
    customer_id,
    SUM(IF(is_recent AND amount > 0, amount, 0)) AS recent_in,
    SUM(IF(is_recent AND amount < 0, -amount, 0)) AS recent_out,
    SAFE_DIVIDE(SUM(IF(NOT is_recent AND amount < 0, -amount, 0)) * 30,
                GREATEST(DATE_DIFF(CURRENT_DATE(), DATE(MIN(booked_at)), DAY) - 30, 1)) AS avg_previous_out,
    COUNTIF(is_recent AND category = 'baby') AS recent_baby,
    COUNTIF(NOT is_recent AND category = 'baby') AS previous_baby,
    ARRAY_AGG(IF(is_recent AND country != 'BE', country, NULL) IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS abroad_country,
    MAX(IF(is_recent AND category = 'vehicle', -amount, NULL)) AS vehicle_amount
  FROM t
  GROUP BY customer_id
),
signals AS (
  SELECT customer_id, 'moved_house' AS signal_type, 0.85 AS confidence,
    TO_JSON(STRUCT(recent_landlords[SAFE_OFFSET(0)] AS new_landlord, CAST(monthly_rent AS FLOAT64) AS monthly_rent)) AS evidence
  FROM rent
  WHERE ARRAY_LENGTH(recent_landlords) > 0
    AND ARRAY_LENGTH(previous_landlords) > 0
    AND NOT EXISTS (SELECT 1 FROM UNNEST(recent_landlords) AS l WHERE l IN UNNEST(previous_landlords))

  UNION ALL
  SELECT customer_id,
    CASE WHEN previous_count = 0 THEN 'first_salary'
         WHEN recent_salary > previous_salary THEN 'salary_increase'
         ELSE 'salary_decrease' END,
    0.8,
    TO_JSON(STRUCT(employer, CAST(ROUND(recent_salary, 2) AS FLOAT64) AS new_salary,
                   CAST(ROUND(previous_salary, 2) AS FLOAT64) AS previous_average))
  FROM salary
  WHERE recent_salary IS NOT NULL
    AND (previous_count = 0 OR ABS(recent_salary - previous_salary) / previous_salary >= 0.10)

  UNION ALL
  SELECT customer_id, 'growing_family', 0.6, TO_JSON(STRUCT(recent_baby AS baby_purchases))
  FROM flows WHERE recent_baby > 0 AND previous_baby = 0

  UNION ALL
  SELECT customer_id, 'travelling_abroad', 0.9, TO_JSON(STRUCT(abroad_country AS country))
  FROM flows WHERE abroad_country IS NOT NULL

  UNION ALL
  SELECT customer_id, 'vehicle_purchase', 0.8, TO_JSON(STRUCT(CAST(vehicle_amount AS FLOAT64) AS amount))
  FROM flows WHERE vehicle_amount >= 2000

  UNION ALL
  -- a spike: spending well above income this month AND well above the usual month
  SELECT customer_id, 'cashflow_risk', 0.7,
    TO_JSON(STRUCT(CAST(ROUND(recent_in, 2) AS FLOAT64) AS money_in, CAST(ROUND(recent_out, 2) AS FLOAT64) AS money_out))
  FROM flows WHERE recent_out > 1.2 * recent_in AND recent_out > 1.5 * avg_previous_out
)
SELECT
  GENERATE_UUID() AS signal_id,
  customer_id,
  signal_type,
  confidence,
  evidence,
  CURRENT_TIMESTAMP() AS detected_at,
  'batch' AS source
FROM signals;

SELECT
  signal_type,
  COUNT(*) AS customers,
  ROUND(100 * COUNT(*) / (SELECT COUNT(*) FROM `${PROJECT}.${DATASET}.population_customers`), 2) AS pct_of_customers
FROM `${PROJECT}.${DATASET}.population_signals`
GROUP BY signal_type
ORDER BY customers DESC;
