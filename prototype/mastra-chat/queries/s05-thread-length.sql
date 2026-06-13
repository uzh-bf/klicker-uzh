-- S0.5 measurement #2 — thread length / token distribution
-- Question: what share of threads are long enough that conversation
-- compression (Observational-Memory-equivalent) actually matters?
-- If ~95% of threads are short, compression solves a non-problem and the
-- TokenLimiter processor already covers us — DO NOT build S5. This is the
-- single most important number gating the compression slice.
-- See PLAN §7 (S0.5 → gates S5) and report §9.5 (decision input 2).
--
-- NOTE: char/4 is a crude token proxy, good enough for bucketing. Refine with a
-- real tokenizer offline before any final compression decision.
-- Run against a COPY of the seeded Klicker DB (never production).

WITH per_thread AS (
  SELECT
    m."threadId"                       AS thread_id,
    COUNT(*)                           AS msg_count,
    SUM(LENGTH(m."content"::text))     AS approx_chars,
    SUM(LENGTH(m."content"::text)) / 4 AS approx_tokens
  FROM "ChatMessage" m
  GROUP BY m."threadId"
)
-- Bucketed distribution
SELECT
  CASE
    WHEN approx_tokens <  2000 THEN '1: < 2k tokens'
    WHEN approx_tokens < 10000 THEN '2: 2k - 10k'
    WHEN approx_tokens < 30000 THEN '3: 10k - 30k'
    ELSE                            '4: > 30k tokens'
  END                                                         AS token_bucket,
  COUNT(*)                                                    AS threads,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1)          AS pct_of_threads,
  ROUND(AVG(msg_count), 1)                                    AS avg_messages
FROM per_thread
GROUP BY token_bucket
ORDER BY token_bucket;

-- Companion percentiles (run separately):
-- WITH per_thread AS ( ... same CTE ... )
-- SELECT
--   COUNT(*)                                                       AS threads,
--   ROUND(percentile_cont(0.50) WITHIN GROUP (ORDER BY approx_tokens)) AS p50_tokens,
--   ROUND(percentile_cont(0.90) WITHIN GROUP (ORDER BY approx_tokens)) AS p90_tokens,
--   ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY approx_tokens)) AS p95_tokens,
--   MAX(approx_tokens)                                                 AS max_tokens
-- FROM per_thread;
