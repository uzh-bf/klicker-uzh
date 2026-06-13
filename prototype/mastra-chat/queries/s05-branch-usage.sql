-- S0.5 measurement #1 — branch usage
-- Question: what share of chat threads actually use the branching tree?
-- If this is single-digit %, dropping branch-SWITCHING (B-linear / managed
-- messages) costs little UX; if it's high, our branch-aware DIY memory is the
-- decisive differentiator. See PLAN-chat-mastra-prototype.md §7 (S0.5) and the
-- evaluation report §9.5 (decision input 1).
--
-- A thread "branches" when it has more than one leaf message. A leaf is a
-- message that is not the parent of any other message in the same thread.
-- Run against a COPY of the seeded Klicker DB (never production).

WITH per_thread AS (
  SELECT
    m."threadId"                                              AS thread_id,
    COUNT(*)                                                  AS msg_count,
    COUNT(*) FILTER (
      WHERE NOT EXISTS (
        SELECT 1 FROM "ChatMessage" c WHERE c."parentId" = m."id"
      )
    )                                                         AS leaf_count
  FROM "ChatMessage" m
  GROUP BY m."threadId"
)
SELECT
  COUNT(*)                                                    AS total_threads,
  COUNT(*) FILTER (WHERE leaf_count > 1)                      AS branched_threads,
  ROUND(100.0 * COUNT(*) FILTER (WHERE leaf_count > 1)
        / NULLIF(COUNT(*), 0), 1)                             AS branched_pct,
  ROUND(AVG(leaf_count), 2)                                   AS avg_leaves_per_thread,
  MAX(leaf_count)                                             AS max_leaves_in_a_thread
FROM per_thread;

-- Optional drill-down: distribution of leaf counts (how deep does branching go?)
-- WITH per_thread AS ( ... same CTE ... )
-- SELECT leaf_count, COUNT(*) AS threads
-- FROM per_thread GROUP BY leaf_count ORDER BY leaf_count;
