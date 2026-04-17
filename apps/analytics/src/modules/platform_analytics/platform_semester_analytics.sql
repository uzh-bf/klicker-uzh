-- One row per UZH semester. Semester boundaries are the same ones used in Batch 6:
--   FS{YY}: YYYY-02-15 .. YYYY-08-31
--   HS{YY}: YYYY-09-01 .. (YYYY+1)-02-14
-- The semesters CTE is generated dynamically from the earliest data row, so the query
-- keeps working year after year without code changes.

WITH bounds AS (
  SELECT
    LEAST(
      COALESCE((SELECT MIN("createdAt") FROM "QuestionResponse"),     NOW()),
      COALESCE((SELECT MIN("createdAt") FROM "LiveQuizResponse"),     NOW()),
      COALESCE((SELECT MIN("createdAt") FROM "ChatMessage"),          NOW())
    ) AS first_seen,
    NOW() AS now_ts
),
years AS (
  SELECT generate_series(
    EXTRACT(YEAR FROM (SELECT first_seen FROM bounds))::int,
    EXTRACT(YEAR FROM (SELECT now_ts     FROM bounds))::int + 1
  ) AS yr
),
semesters AS (
  SELECT
    ('FS' || LPAD((yr % 100)::text, 2, '0')) AS semester_label,
    make_timestamptz(yr,     2, 15, 0, 0, 0)         AS semester_start,
    make_timestamptz(yr,     8, 31, 23, 59, 59)      AS semester_end
  FROM years
  UNION ALL
  SELECT
    ('HS' || LPAD((yr % 100)::text, 2, '0')),
    make_timestamptz(yr,     9,  1, 0, 0, 0),
    make_timestamptz(yr + 1, 2, 14, 23, 59, 59)
  FROM years
),
relevant_semesters AS (
  SELECT * FROM semesters s, bounds b
  WHERE s.semester_end   >= b.first_seen
    AND s.semester_start <= b.now_ts
)
INSERT INTO "PlatformSemesterAnalytics" (
  "semesterLabel", "semesterStart", "semesterEnd",
  "quizResponseRows", "quizTrials", "quizDistinctParticipants",
  "liveQuizResponses", "liveQuizDistinctParticipants",
  "chatMessages", "chatDistinctParticipants",
  "activeCourses", "coursesWithChatbot", "coursesWithLiveQuiz", "coursesWithQuizActivity",
  "createdAt", "updatedAt"
)
SELECT
  rs.semester_label,
  rs.semester_start,
  rs.semester_end,
  COALESCE(q.response_rows, 0),
  COALESCE(q.total_trials, 0),
  COALESCE(q.distinct_participants, 0),
  COALESCE(lq.responses, 0),
  COALESCE(lq.distinct_participants, 0),
  COALESCE(ch.messages, 0),
  COALESCE(ch.distinct_participants, 0),
  COALESCE(c.active_courses, 0),
  COALESCE(c.courses_with_chatbot, 0),
  COALESCE(c.courses_with_livequiz, 0),
  COALESCE(c.courses_with_quiz_activity, 0),
  NOW(), NOW()
FROM relevant_semesters rs
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                            AS response_rows,
    COALESCE(SUM(qr."trialsCount"), 0)                                  AS total_trials,
    COUNT(DISTINCT qr."participantId")                                  AS distinct_participants
  FROM "QuestionResponse" qr
  WHERE qr."createdAt" >= rs.semester_start AND qr."createdAt" <= rs.semester_end
) q ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                            AS responses,
    COUNT(DISTINCT lqr."participantId")                                 AS distinct_participants
  FROM "LiveQuizResponse" lqr
  WHERE lqr."createdAt" >= rs.semester_start AND lqr."createdAt" <= rs.semester_end
) lq ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                            AS messages,
    COUNT(DISTINCT ct."participantId")                                  AS distinct_participants
  FROM "ChatMessage" m
  JOIN "ChatThread" ct ON ct.id = m."threadId"
  WHERE m."createdAt" >= rs.semester_start AND m."createdAt" <= rs.semester_end
    AND m.role = 'user'
) ch ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT c.id) FILTER (
      WHERE EXISTS (SELECT 1 FROM "Participation" p WHERE p."courseId" = c.id)
    ) AS active_courses,
    COUNT(DISTINCT c.id) FILTER (
      WHERE EXISTS (SELECT 1 FROM "Chatbot" cb WHERE cb."courseId" = c.id)
    ) AS courses_with_chatbot,
    COUNT(DISTINCT c.id) FILTER (
      WHERE EXISTS (SELECT 1 FROM "LiveQuiz" lq2 WHERE lq2."courseId" = c.id)
    ) AS courses_with_livequiz,
    COUNT(DISTINCT c.id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM "QuestionResponse" qr2
        WHERE qr2."courseId" = c.id
          AND qr2."createdAt" >= rs.semester_start AND qr2."createdAt" <= rs.semester_end
      )
    ) AS courses_with_quiz_activity
  FROM "Course" c
  WHERE c."startDate" <= rs.semester_end
    AND c."endDate"   >= rs.semester_start
) c ON true
ON CONFLICT ("semesterLabel") DO UPDATE SET
  "semesterStart"                = EXCLUDED."semesterStart",
  "semesterEnd"                  = EXCLUDED."semesterEnd",
  "quizResponseRows"             = EXCLUDED."quizResponseRows",
  "quizTrials"                   = EXCLUDED."quizTrials",
  "quizDistinctParticipants"     = EXCLUDED."quizDistinctParticipants",
  "liveQuizResponses"            = EXCLUDED."liveQuizResponses",
  "liveQuizDistinctParticipants" = EXCLUDED."liveQuizDistinctParticipants",
  "chatMessages"                 = EXCLUDED."chatMessages",
  "chatDistinctParticipants"     = EXCLUDED."chatDistinctParticipants",
  "activeCourses"                = EXCLUDED."activeCourses",
  "coursesWithChatbot"           = EXCLUDED."coursesWithChatbot",
  "coursesWithLiveQuiz"          = EXCLUDED."coursesWithLiveQuiz",
  "coursesWithQuizActivity"      = EXCLUDED."coursesWithQuizActivity",
  "updatedAt"                    = NOW();
