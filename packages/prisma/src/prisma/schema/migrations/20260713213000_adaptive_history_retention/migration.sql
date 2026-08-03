-- Preserve adaptive attempt history when owners, quizzes, configs, or courses
-- are removed. Participant and participation cascades deliberately remain so
-- participant erasure can still delete the learner's adaptive history.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

ALTER TABLE "CompetenceTree"
ADD CONSTRAINT "CompetenceTree_ownerId_restrict_fkey"
FOREIGN KEY ("ownerId")
REFERENCES "User" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE
NOT VALID;

ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD CONSTRAINT "AdaptivePracticeQuizAttempt_config_quiz_tree_restrict_fkey"
FOREIGN KEY ("configId", "practiceQuizId", "competenceTreeId")
REFERENCES "PracticeQuizAdaptiveConfig" ("id", "practiceQuizId", "competenceTreeId")
ON DELETE RESTRICT ON UPDATE CASCADE
NOT VALID;

ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD CONSTRAINT "AdaptivePracticeQuizAttempt_practiceQuiz_course_restrict_fkey"
FOREIGN KEY ("practiceQuizId", "courseId")
REFERENCES "PracticeQuiz" ("id", "courseId")
ON DELETE RESTRICT ON UPDATE CASCADE
NOT VALID;

ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD CONSTRAINT "AdaptivePracticeQuizAttempt_courseId_fkey"
FOREIGN KEY ("courseId")
REFERENCES "Course" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE
NOT VALID;

ALTER TABLE "CompetenceTree"
VALIDATE CONSTRAINT "CompetenceTree_ownerId_restrict_fkey";

ALTER TABLE "AdaptivePracticeQuizAttempt"
VALIDATE CONSTRAINT "AdaptivePracticeQuizAttempt_config_quiz_tree_restrict_fkey";

ALTER TABLE "AdaptivePracticeQuizAttempt"
VALIDATE CONSTRAINT "AdaptivePracticeQuizAttempt_practiceQuiz_course_restrict_fkey";

ALTER TABLE "AdaptivePracticeQuizAttempt"
VALIDATE CONSTRAINT "AdaptivePracticeQuizAttempt_courseId_fkey";

ALTER TABLE "CompetenceTree"
DROP CONSTRAINT "CompetenceTree_ownerId_fkey";

ALTER TABLE "CompetenceTree"
RENAME CONSTRAINT "CompetenceTree_ownerId_restrict_fkey"
TO "CompetenceTree_ownerId_fkey";

ALTER TABLE "AdaptivePracticeQuizAttempt"
DROP CONSTRAINT "AdaptivePracticeQuizAttempt_config_quiz_tree_fkey";

ALTER TABLE "AdaptivePracticeQuizAttempt"
RENAME CONSTRAINT "AdaptivePracticeQuizAttempt_config_quiz_tree_restrict_fkey"
TO "AdaptivePracticeQuizAttempt_config_quiz_tree_fkey";

ALTER TABLE "AdaptivePracticeQuizAttempt"
DROP CONSTRAINT "AdaptivePracticeQuizAttempt_practiceQuizId_courseId_fkey";

ALTER TABLE "AdaptivePracticeQuizAttempt"
RENAME CONSTRAINT "AdaptivePracticeQuizAttempt_practiceQuiz_course_restrict_fkey"
TO "AdaptivePracticeQuizAttempt_practiceQuizId_courseId_fkey";

CREATE INDEX "apqa_course_retention_idx"
ON "AdaptivePracticeQuizAttempt" ("courseId");

COMMIT;
