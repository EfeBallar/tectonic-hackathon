-- A synthetic customer base at KBC scale, generated entirely inside BigQuery.
-- Default: 2.3M customers x 6 periods of 30 days (~220M transactions, ~20 GB storage).
-- Generating reads no data, so on-demand query cost is ~0; storage is a few cents per day.
-- Quick run: make population N_CUSTOMERS=100000

DECLARE n_customers INT64 DEFAULT ${N_CUSTOMERS};
DECLARE periods INT64 DEFAULT 6;

-- Deterministic pseudo-random number in [0, 1) per customer and purpose.
CREATE TEMP FUNCTION rnd(n INT64, salt STRING) AS (
  MOD(MOD(FARM_FINGERPRINT(CONCAT(CAST(n AS STRING), ':', salt)), 1000000) + 1000000, 1000000) / 1000000.0
);

CREATE OR REPLACE TABLE `${PROJECT}.${DATASET}.population_customers`
CLUSTER BY customer_id
AS
WITH ids AS (
  SELECT a * 1000 + b + 1 AS n
  FROM UNNEST(GENERATE_ARRAY(0, DIV(n_customers - 1, 1000))) AS a
  CROSS JOIN UNNEST(GENERATE_ARRAY(0, 999)) AS b
  WHERE a * 1000 + b + 1 <= n_customers
),
segmented AS (
  SELECT
    n,
    CASE WHEN rnd(n, 'lang') < 0.70 THEN 'nl' WHEN rnd(n, 'lang') < 0.95 THEN 'fr' ELSE 'en' END AS language,
    CASE
      WHEN rnd(n, 'segment') < 0.10 THEN 'student'
      WHEN rnd(n, 'segment') < 0.35 THEN 'young_professional'
      WHEN rnd(n, 'segment') < 0.70 THEN 'family'
      WHEN rnd(n, 'segment') < 0.90 THEN 'senior'
      ELSE 'self_employed'
    END AS segment,
    rnd(n, 'income') AS r_income,
    rnd(n, 'housing') AS r_housing,
    rnd(n, 'event') AS r_event
  FROM ids
),
profiled AS (
  SELECT
    *,
    CASE segment
      WHEN 'student' THEN 0
      WHEN 'young_professional' THEN ROUND(2400 + r_income * 1400, 2)
      WHEN 'family' THEN ROUND(3000 + r_income * 2200, 2)
      WHEN 'senior' THEN ROUND(1500 + r_income * 1200, 2)
      ELSE ROUND(2000 + r_income * 4000, 2)
    END AS monthly_income,
    CASE
      WHEN segment IN ('student', 'young_professional') AND r_housing < 0.7 THEN 'rent'
      WHEN segment IN ('family', 'self_employed') AND r_housing < 0.6 THEN 'mortgage'
      WHEN segment = 'senior' AND r_housing < 0.2 THEN 'rent'
    END AS housing
  FROM segmented
)
SELECT
  FORMAT('P%08d', n) AS customer_id,
  n AS customer_number,
  ['Lotte', 'Emma', 'Noah', 'Lucas', 'Marie', 'Louis', 'Olivia', 'Arthur', 'Nora', 'Jules', 'Mila', 'Adam',
   'Lina', 'Victor', 'Elise'][OFFSET(MOD(n, 15))] AS first_name,
  CASE segment
    WHEN 'student' THEN 19 + CAST(r_income * 6 AS INT64)
    WHEN 'young_professional' THEN 25 + CAST(r_income * 10 AS INT64)
    WHEN 'family' THEN 30 + CAST(r_income * 20 AS INT64)
    WHEN 'senior' THEN 65 + CAST(r_income * 25 AS INT64)
    ELSE 28 + CAST(r_income * 35 AS INT64)
  END AS age,
  language,
  CASE language
    WHEN 'nl' THEN ['Antwerpen', 'Gent', 'Leuven', 'Brugge', 'Hasselt', 'Mechelen', 'Kortrijk'][OFFSET(MOD(n, 7))]
    WHEN 'fr' THEN ['Bruxelles', 'Namur', 'Liège', 'Charleroi', 'Mons'][OFFSET(MOD(n, 5))]
    ELSE 'Brussels'
  END AS city,
  segment,
  monthly_income,
  housing,
  ROUND(IF(segment = 'student', 380 + r_housing * 200, 750 + r_housing * 700), 2) AS housing_cost,
  -- The life moment (if any) planted in the most recent 30 days
  CASE
    WHEN segment = 'student' AND r_event < 0.08 THEN 'first_salary'
    WHEN housing = 'rent' AND r_event < 0.06 THEN 'moved_house'
    WHEN segment != 'student' AND r_event BETWEEN 0.10 AND 0.14 THEN 'salary_increase'
    WHEN segment IN ('young_professional', 'family', 'self_employed') AND r_event BETWEEN 0.14 AND 0.155 THEN 'salary_decrease'
    WHEN segment IN ('young_professional', 'family') AND r_event BETWEEN 0.20 AND 0.215 THEN 'growing_family'
    WHEN r_event BETWEEN 0.30 AND 0.36 THEN 'travelling_abroad'
    WHEN segment != 'student' AND r_event BETWEEN 0.40 AND 0.408 THEN 'vehicle_purchase'
    WHEN segment != 'student' AND r_event BETWEEN 0.50 AND 0.53 THEN 'cashflow_risk'
  END AS life_event
FROM profiled;

CREATE OR REPLACE TABLE `${PROJECT}.${DATASET}.population_transactions`
PARTITION BY DATE(booked_at)
CLUSTER BY customer_id, category
AS
WITH periods AS (
  -- p = 0 is the most recent 30 days
  SELECT p, DATE_SUB(CURRENT_DATE(), INTERVAL (30 * (p + 1)) DAY) AS period_start
  FROM UNNEST(GENERATE_ARRAY(0, periods - 1)) AS p
),
cp AS (
  SELECT c.*, periods.p, periods.period_start, periods.p = 0 AS is_recent
  FROM `${PROJECT}.${DATASET}.population_customers` AS c
  CROSS JOIN periods
),
salary AS (
  SELECT
    customer_id,
    TIMESTAMP(DATE_ADD(period_start, INTERVAL 24 DAY)) AS booked_at,
    CASE
      WHEN life_event = 'first_salary' THEN ROUND(2100 + rnd(customer_number, 'first') * 900, 2)
      WHEN is_recent AND life_event = 'salary_increase' THEN ROUND(monthly_income * (1.12 + rnd(customer_number, 'up') * 0.15), 2)
      WHEN is_recent AND life_event = 'salary_decrease' THEN ROUND(monthly_income * (0.6 + rnd(customer_number, 'down') * 0.25), 2)
      ELSE monthly_income
    END AS amount,
    IF(segment = 'senior', 'Federale Pensioendienst', FORMAT('Employer %05d', MOD(customer_number, 20000))) AS counterparty,
    'salary' AS category,
    'transfer' AS channel,
    'BE' AS country
  FROM cp
  WHERE (monthly_income > 0 AND life_event IS DISTINCT FROM 'first_salary')
     OR (life_event = 'first_salary' AND is_recent)
),
allowance AS (
  SELECT
    customer_id,
    TIMESTAMP(DATE_ADD(period_start, INTERVAL 1 DAY)) AS booked_at,
    ROUND(300 + rnd(customer_number, 'allowance') * 200, 0) AS amount,
    FORMAT('Parents %05d', MOD(customer_number, 20000)) AS counterparty,
    'transfer_in' AS category,
    'transfer' AS channel,
    'BE' AS country
  FROM cp
  WHERE segment = 'student'
),
housing_payments AS (
  SELECT
    customer_id,
    TIMESTAMP(DATE_ADD(period_start, INTERVAL 1 DAY)) AS booked_at,
    -IF(is_recent AND life_event = 'moved_house', ROUND(housing_cost * 1.2, 2), housing_cost) AS amount,
    CASE
      WHEN housing = 'mortgage' THEN 'Mortgage repayment'
      WHEN is_recent AND life_event = 'moved_house' THEN FORMAT('Landlord %06d', MOD(customer_number * 7 + 13, 999983))
      ELSE FORMAT('Landlord %06d', MOD(customer_number, 999983))
    END AS counterparty,
    housing AS category,
    IF(housing = 'mortgage', 'direct_debit', 'transfer') AS channel,
    'BE' AS country
  FROM cp
  WHERE housing IS NOT NULL
),
fixed_costs AS (
  SELECT
    customer_id,
    TIMESTAMP(DATE_ADD(period_start, INTERVAL f.day DAY)) AS booked_at,
    -ROUND(f.base * (0.8 + rnd(customer_number, f.category) * 0.4), 2) AS amount,
    f.merchants[OFFSET(MOD(customer_number, ARRAY_LENGTH(f.merchants)))] AS counterparty,
    f.category AS category,
    'direct_debit' AS channel,
    'BE' AS country
  FROM cp,
    UNNEST([
      STRUCT('utilities' AS category, 4 AS day, 110.0 AS base, ['Engie', 'Luminus', 'TotalEnergies', 'Eneco'] AS merchants),
      STRUCT('telecom', 7, 50.0, ['Proximus', 'Telenet', 'Orange Belgium', 'Mobile Vikings']),
      STRUCT('subscription', 11, 14.0, ['Spotify', 'Netflix', 'Disney+', 'Streamz']),
      STRUCT('insurance', 2, 45.0, ['Home insurance', 'Car insurance', 'Hospital insurance'])
    ]) AS f
  WHERE f.category != 'insurance' OR segment IN ('family', 'senior', 'self_employed')
),
variable_spend AS (
  SELECT
    customer_id,
    TIMESTAMP_ADD(TIMESTAMP(period_start),
      INTERVAL CAST(rnd(customer_number, FORMAT('t-%s-%d-%d', v.category, p, k)) * 29 * 24 * 60 AS INT64) MINUTE) AS booked_at,
    -ROUND(v.base * (0.4 + rnd(customer_number, FORMAT('a-%s-%d-%d', v.category, p, k)) * 1.2)
      * IF(segment = 'student', 0.5, 1.0), 2) AS amount,
    v.merchants[OFFSET(MOD(customer_number + k + p, ARRAY_LENGTH(v.merchants)))] AS counterparty,
    v.category AS category,
    'card' AS channel,
    'BE' AS country
  FROM cp,
    UNNEST([
      STRUCT('groceries' AS category, 6 AS n, 55.0 AS base,
             ['Colruyt', 'Delhaize', 'Aldi', 'Lidl', 'Carrefour Market', 'Albert Heijn'] AS merchants),
      STRUCT('restaurants', 2, 30.0, ['Le Pain Quotidien', 'Exki', 'Panos', 'Balls & Glory', 'Local brasserie']),
      STRUCT('transport', 2, 25.0, ['NMBS/SNCB', 'De Lijn', 'STIB-MIVB', 'Q8', 'TotalEnergies']),
      STRUCT('shopping', 1, 60.0, ['Bol.com', 'Zalando', 'Hema', 'Action', 'Fnac'])
    ]) AS v,
    UNNEST(GENERATE_ARRAY(1, v.n)) AS k
),
life_events AS (
  SELECT
    customer_id,
    TIMESTAMP(DATE_ADD(period_start, INTERVAL (20 + CAST(rnd(customer_number, 'event-day') * 8 AS INT64)) DAY)) AS booked_at,
    CASE life_event
      WHEN 'growing_family' THEN -ROUND(150 + rnd(customer_number, 'baby') * 600, 2)
      WHEN 'travelling_abroad' THEN -ROUND(40 + rnd(customer_number, 'trip') * 400, 2)
      WHEN 'vehicle_purchase' THEN -ROUND(8000 + rnd(customer_number, 'car') * 22000, 2)
      WHEN 'cashflow_risk' THEN -ROUND(monthly_income * (1.2 + rnd(customer_number, 'cash') * 0.5) + 300, 2)
    END AS amount,
    CASE life_event
      WHEN 'growing_family' THEN 'Dreambaby'
      WHEN 'travelling_abroad' THEN ['Hotel Lisboa', 'Trattoria Roma', 'Café de Paris', 'Hostal Barcelona'][OFFSET(MOD(customer_number, 4))]
      WHEN 'vehicle_purchase' THEN 'Car dealer'
      WHEN 'cashflow_risk' THEN 'Unexpected repair'
    END AS counterparty,
    CASE life_event
      WHEN 'growing_family' THEN 'baby'
      WHEN 'travelling_abroad' THEN 'travel'
      WHEN 'vehicle_purchase' THEN 'vehicle'
      WHEN 'cashflow_risk' THEN 'home'
    END AS category,
    IF(life_event = 'vehicle_purchase', 'transfer', 'card') AS channel,
    IF(life_event = 'travelling_abroad', ['PT', 'IT', 'FR', 'ES'][OFFSET(MOD(customer_number, 4))], 'BE') AS country
  FROM cp
  WHERE is_recent AND life_event IN ('growing_family', 'travelling_abroad', 'vehicle_purchase', 'cashflow_risk')
)
SELECT
  GENERATE_UUID() AS transaction_id,
  customer_id,
  booked_at,
  CAST(ROUND(amount, 2) AS NUMERIC) AS amount,
  'EUR' AS currency,
  counterparty,
  category,
  channel,
  country,
  CAST(NULL AS STRING) AS description,
  CAST(NULL AS NUMERIC) AS balance_after,
  'population' AS source,
  CURRENT_TIMESTAMP() AS ingested_at
FROM (
  SELECT * FROM salary
  UNION ALL SELECT * FROM allowance
  UNION ALL SELECT * FROM housing_payments
  UNION ALL SELECT * FROM fixed_costs
  UNION ALL SELECT * FROM variable_spend
  UNION ALL SELECT * FROM life_events
);

SELECT
  (SELECT COUNT(*) FROM `${PROJECT}.${DATASET}.population_customers`) AS customers,
  (SELECT COUNT(*) FROM `${PROJECT}.${DATASET}.population_transactions`) AS transactions,
  (SELECT COUNTIF(life_event IS NOT NULL) FROM `${PROJECT}.${DATASET}.population_customers`) AS customers_with_a_life_moment;
