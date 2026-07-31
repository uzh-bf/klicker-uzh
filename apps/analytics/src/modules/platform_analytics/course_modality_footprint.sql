-- Updates AggregatedCourseAnalytics modality-footprint columns for every course.
-- Requires that AggregatedCourseAnalytics rows already exist for the course (they are
-- created by script 2 — 2_initial_aggregated_course_analytics). Courses without a row are
-- skipped silently; this script never creates rows.

WITH chat_courses AS (
  SELECT DISTINCT ct."participantId", cb."courseId" AS "courseId"
  FROM "ChatThread" ct JOIN "Chatbot" cb ON cb.id = ct."chatbotId"
),
quiz_courses AS (
  SELECT DISTINCT qr."participantId", qr."courseId"
  FROM "QuestionResponse" qr
),
footprint AS (
  SELECT
    c.id AS "courseId",
    (SELECT COUNT(*) FROM "Chatbot"       cb WHERE cb."courseId" = c.id)            AS chatbot_count,
    (SELECT COUNT(*) FROM "PracticeQuiz"  pq WHERE pq."courseId" = c.id)            AS practice_quiz_count,
    (SELECT COUNT(*) FROM "MicroLearning" ml WHERE ml."courseId" = c.id)            AS microlearning_count,
    (SELECT COUNT(*) FROM "LiveQuiz"      lq WHERE lq."courseId" = c.id)            AS live_quiz_count,
    (SELECT COUNT(*) FROM chat_courses cc WHERE cc."courseId" = c.id)               AS chat_participant_count,
    (SELECT COUNT(*) FROM quiz_courses qc WHERE qc."courseId" = c.id)               AS quiz_participant_count,
    (SELECT COUNT(*)
     FROM chat_courses cc JOIN quiz_courses qc USING ("participantId", "courseId")
     WHERE cc."courseId" = c.id)                                                    AS both_chat_and_quiz_count
  FROM "Course" c
)
UPDATE "AggregatedCourseAnalytics" aca SET
  "chatbotCount"         = f.chatbot_count,
  "practiceQuizCount"    = f.practice_quiz_count,
  "microLearningCount"   = f.microlearning_count,
  "liveQuizCount"        = f.live_quiz_count,
  "chatParticipantCount" = f.chat_participant_count,
  "quizParticipantCount" = f.quiz_participant_count,
  "bothChatAndQuizCount" = f.both_chat_and_quiz_count,
  "updatedAt"            = NOW()
FROM footprint f
WHERE aca."courseId" = f."courseId";
