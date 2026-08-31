-- Add durable Course soft-deletion without removing the retained graph.
SET lock_timeout = '5s';

ALTER TABLE "Course" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN "isDeletionPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN "deletionJobId" TEXT;
ALTER TABLE "Course" ADD COLUMN "deletionRequestedById" UUID;
ALTER TABLE "Course" ADD COLUMN "deletionPendingAt" TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN "deleteDraftActivitiesOnDeletion" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Course_deletionJobId_key" ON "Course"("deletionJobId");

-- Keep accepted response handoffs durable across Redis expiry, worker outages,
-- and course-deletion retries. No foreign keys are intentional: deleting a
-- parent must never erase the fence that protects an acknowledged response.
CREATE TABLE "LiveQuizResponseAdmission" (
  "token" UUID NOT NULL,
  "liveQuizId" UUID NOT NULL,
  "courseId" UUID,
  "eventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastReconciliationAttemptAt" TIMESTAMP(3),
  CONSTRAINT "LiveQuizResponseAdmission_pkey" PRIMARY KEY ("token")
);

CREATE INDEX "LiveQuizResponseAdmission_courseId_idx" ON "LiveQuizResponseAdmission"("courseId");
CREATE INDEX "LiveQuizResponseAdmission_liveQuizId_idx" ON "LiveQuizResponseAdmission"("liveQuizId");
CREATE INDEX "LiveQuizResponseAdmission_reconcile_idx" ON "LiveQuizResponseAdmission"("failedAt", "lastReconciliationAttemptAt", "publishedAt");

-- During a rolling deployment, old application pods still issue a hard DELETE.
-- Fail those legacy requests atomically before they can remove retained data.
CREATE OR REPLACE FUNCTION "preventCourseHardDelete"()
RETURNS TRIGGER AS $$
BEGIN
  -- Physical cleanup is deliberately privileged and transaction-local. Merely
  -- setting isDeleted is not sufficient: a rolling old pod can see the retained
  -- row but must never be able to cascade-delete it.
  IF current_setting('klicker.allow_course_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Course hard deletion is disabled; use the background soft-deletion workflow.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Course_preventHardDelete"
BEFORE DELETE ON "Course"
FOR EACH ROW EXECUTE FUNCTION "preventCourseHardDelete"();

-- Old application pods may still resolve retained rows during a rolling
-- deployment. Once deletion is pending or complete, reject their writes at the
-- database boundary. Only the transaction that owns deletion recovery/finalize
-- may change the marker.
CREATE OR REPLACE FUNCTION "preventCourseMutationDuringDeletion"()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD."isDeletionPending" = true OR OLD."isDeleted" = true)
     AND current_setting('klicker.allow_course_deletion_mutation', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Course mutation is disabled while deletion is pending or complete.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Course_preventMutationDuringDeletion"
BEFORE UPDATE ON "Course"
FOR EACH ROW EXECUTE FUNCTION "preventCourseMutationDuringDeletion"();

-- Replace the compatible view definition without dropping grants or dependents.
CREATE OR REPLACE VIEW "UserActivities" AS
SELECT
  -- Core activity fields
  lq.id,
  'LIVE_QUIZ' as type,
  1 as "typeOrder",
  lq.name,
  lq."displayName",
  lq.description,
  lq.status,
  lq."reviewStatus",
  lq."isDeleted",

  -- Activity features
  lq."areInstancesOutdated",
  lq."isGamificationEnabled",
  lq."isAssessmentEnabled",
  lq."pointsMultiplier",
  lq."pinCode" as "pinCode",

  -- Template information
  at.id as "templateId",
  lq."templateName",

  -- Timestamps
  lq."createdAt",
  lq."updatedAt",

  -- Type-specific scheduling fields
  NULL as "availableFrom",
  CAST(NULL AS TIMESTAMP(3)) as "scheduledStartAt",
  CAST(NULL AS TIMESTAMP(3)) as "scheduledEndAt",

  -- Course information
  c.id as "courseId",
  c.name as "courseName",
  c.language as "courseLanguage",
  c."startDate" as "courseStartDate",

  -- Group activity specific
  CAST(NULL AS TIMESTAMP(3)) as "groupDeadlineDate",
  CAST(NULL AS INTEGER) as "numOfParticipantGroups",

  -- Content metrics (count blocks and their elements)
  COALESCE(block_counts.num_stacks, 0) as "numOfStacks",
  COALESCE(block_counts.num_elements, 0) as "numOfElements",

  -- Permission fields
  dp."userId",
  dp."permissionLevel",
  dp.derived,

  -- Permission details for direct permissions
  p_direct.user_group_id as "directPermissionUserGroupId",

  -- Owner information
  lq."ownerId",

  -- Permission counts for numSharedUsers and isActivityReviewer calculation
  COALESCE(activity_perm_counts.num_permissions, 0) as "numActivityPermissions",
  COALESCE(course_perm_counts.is_user_course_admin, false) as "isUserCourseAdmin"

FROM "LiveQuiz" lq
JOIN "DerivedPermission" dp ON dp."liveQuizId" = lq.id
LEFT JOIN (
  SELECT p.id, p."userGroupId" as user_group_id
  FROM "Permission" p
) p_direct ON p_direct.id = dp."directPermissionId"
LEFT JOIN "ActivityTemplate" at ON at."liveQuizId" = lq.id
LEFT JOIN "Course" c ON c.id = lq."courseId"
LEFT JOIN (
  SELECT
    eb."liveQuizId",
    COUNT(eb.id) as num_stacks,
    COALESCE(SUM(ei_counts.element_count), 0) as num_elements
  FROM "ElementBlock" eb
  LEFT JOIN (
    SELECT
      ei."elementBlockId",
      COUNT(ei.id) as element_count
    FROM "ElementInstance" ei
    GROUP BY ei."elementBlockId"
  ) ei_counts ON ei_counts."elementBlockId" = eb.id
  GROUP BY eb."liveQuizId"
) block_counts ON block_counts."liveQuizId" = lq.id
LEFT JOIN (
  SELECT
    p."liveQuizId",
    COUNT(p.id) as num_permissions
  FROM "Permission" p
  WHERE p."liveQuizId" IS NOT NULL
  GROUP BY p."liveQuizId"
) activity_perm_counts ON activity_perm_counts."liveQuizId" = lq.id
LEFT JOIN (
  SELECT
    p."courseId",
    p."userId",
    true as is_user_course_admin
  FROM "DerivedPermission" p
  WHERE p."courseId" IS NOT NULL
    AND p."permissionLevel" IN ('ADMIN', 'OWNER')
  GROUP BY p."courseId", p."userId"
) course_perm_counts ON course_perm_counts."courseId" = lq."courseId" AND course_perm_counts."userId" = dp."userId"
WHERE lq."courseId" IS NULL OR (
  c."isDeleted" = false
  AND (
    c."isDeletionPending" = false
    OR c."deleteDraftActivitiesOnDeletion" = false
    OR lq.status <> 'DRAFT'
  )
)

UNION ALL

SELECT
  -- Core activity fields
  pq.id,
  'PRACTICE_QUIZ' as type,
  2 as "typeOrder",
  pq.name,
  pq."displayName",
  pq.description,
  pq.status,
  pq."reviewStatus",
  pq."isDeleted",

  -- Activity features
  pq."areInstancesOutdated",
  pq."isGamificationEnabled",
  pq."isAssessmentEnabled",
  pq."pointsMultiplier",
  CAST(NULL AS TEXT) as "pinCode",

  -- Template information
  at.id as "templateId",
  pq."templateName",

  -- Timestamps
  pq."createdAt",
  pq."updatedAt",

  -- Type-specific scheduling fields
  pq."availableFrom",
  CAST(NULL AS TIMESTAMP(3)) as "scheduledStartAt",
  CAST(NULL AS TIMESTAMP(3)) as "scheduledEndAt",

  -- Course information
  c.id as "courseId",
  c.name as "courseName",
  c.language as "courseLanguage",
  c."startDate" as "courseStartDate",

  -- Group activity specific
  CAST(NULL AS TIMESTAMP(3)) as "groupDeadlineDate",
  CAST(NULL AS INTEGER) as "numOfParticipantGroups",

  -- Content metrics (count stacks and their elements)
  COALESCE(stack_counts.num_stacks, 0) as "numOfStacks",
  COALESCE(stack_counts.num_elements, 0) as "numOfElements",

  -- Permission fields
  dp."userId",
  dp."permissionLevel",
  dp.derived,

  -- Permission details for direct permissions
  p_direct.user_group_id as "directPermissionUserGroupId",

  -- Owner information
  pq."ownerId",

  -- Permission counts for numSharedUsers and isActivityReviewer calculation
  COALESCE(activity_perm_counts.num_permissions, 0) as "numActivityPermissions",
  COALESCE(course_perm_counts.is_user_course_admin, false) as "isUserCourseAdmin"

FROM "PracticeQuiz" pq
JOIN "DerivedPermission" dp ON dp."practiceQuizId" = pq.id
LEFT JOIN (
  SELECT p.id, p."userGroupId" as user_group_id
  FROM "Permission" p
) p_direct ON p_direct.id = dp."directPermissionId"
LEFT JOIN "ActivityTemplate" at ON at."practiceQuizId" = pq.id
LEFT JOIN "Course" c ON c.id = pq."courseId"
LEFT JOIN (
  SELECT
    es."practiceQuizId",
    COUNT(es.id) as num_stacks,
    COALESCE(SUM(ei_counts.element_count), 0) as num_elements
  FROM "ElementStack" es
  LEFT JOIN (
    SELECT
      ei."elementStackId",
      COUNT(ei.id) as element_count
    FROM "ElementInstance" ei
    GROUP BY ei."elementStackId"
  ) ei_counts ON ei_counts."elementStackId" = es.id
  WHERE es."practiceQuizId" IS NOT NULL
  GROUP BY es."practiceQuizId"
) stack_counts ON stack_counts."practiceQuizId" = pq.id
LEFT JOIN (
  SELECT
    p."practiceQuizId",
    COUNT(p.id) as num_permissions
  FROM "Permission" p
  WHERE p."practiceQuizId" IS NOT NULL
  GROUP BY p."practiceQuizId"
) activity_perm_counts ON activity_perm_counts."practiceQuizId" = pq.id
LEFT JOIN (
  SELECT
    p."courseId",
    p."userId",
    true as is_user_course_admin
  FROM "DerivedPermission" p
  WHERE p."courseId" IS NOT NULL
    AND p."permissionLevel" IN ('ADMIN', 'OWNER')
  GROUP BY p."courseId", p."userId"
) course_perm_counts ON course_perm_counts."courseId" = pq."courseId" AND course_perm_counts."userId" = dp."userId"
WHERE c."isDeleted" = false
AND (
  c."isDeletionPending" = false
  OR c."deleteDraftActivitiesOnDeletion" = false
  OR pq.status <> 'DRAFT'
)

UNION ALL

SELECT
  -- Core activity fields
  ml.id,
  'MICRO_LEARNING' as type,
  3 as "typeOrder",
  ml.name,
  ml."displayName",
  ml.description,
  ml.status,
  ml."reviewStatus",
  ml."isDeleted",

  -- Activity features
  ml."areInstancesOutdated",
  ml."isGamificationEnabled",
  ml."isAssessmentEnabled",
  ml."pointsMultiplier",
  CAST(NULL AS TEXT) as "pinCode",

  -- Template information
  at.id as "templateId",
  ml."templateName",

  -- Timestamps
  ml."createdAt",
  ml."updatedAt",

  -- Type-specific scheduling fields
  NULL as "availableFrom",
  CAST(ml."scheduledStartAt" AS TIMESTAMP(3)) as "scheduledStartAt",
  CAST(ml."scheduledEndAt" AS TIMESTAMP(3)) as "scheduledEndAt",

  -- Course information
  c.id as "courseId",
  c.name as "courseName",
  c.language as "courseLanguage",
  c."startDate" as "courseStartDate",

  -- Group activity specific
  CAST(NULL AS TIMESTAMP(3)) as "groupDeadlineDate",
  CAST(NULL AS INTEGER) as "numOfParticipantGroups",

  -- Content metrics (count stacks and their elements)
  COALESCE(stack_counts.num_stacks, 0) as "numOfStacks",
  COALESCE(stack_counts.num_elements, 0) as "numOfElements",

  -- Permission fields
  dp."userId",
  dp."permissionLevel",
  dp.derived,

  -- Permission details for direct permissions
  p_direct.user_group_id as "directPermissionUserGroupId",

  -- Owner information
  ml."ownerId",

  -- Permission counts for numSharedUsers and isActivityReviewer calculation
  COALESCE(activity_perm_counts.num_permissions, 0) as "numActivityPermissions",
  COALESCE(course_perm_counts.is_user_course_admin, false) as "isUserCourseAdmin"

FROM "MicroLearning" ml
JOIN "DerivedPermission" dp ON dp."microLearningId" = ml.id
LEFT JOIN (
  SELECT p.id, p."userGroupId" as user_group_id
  FROM "Permission" p
) p_direct ON p_direct.id = dp."directPermissionId"
LEFT JOIN "ActivityTemplate" at ON at."microLearningId" = ml.id
LEFT JOIN "Course" c ON c.id = ml."courseId"
LEFT JOIN (
  SELECT
    es."microLearningId",
    COUNT(es.id) as num_stacks,
    COALESCE(SUM(ei_counts.element_count), 0) as num_elements
  FROM "ElementStack" es
  LEFT JOIN (
    SELECT
      ei."elementStackId",
      COUNT(ei.id) as element_count
    FROM "ElementInstance" ei
    GROUP BY ei."elementStackId"
  ) ei_counts ON ei_counts."elementStackId" = es.id
  WHERE es."microLearningId" IS NOT NULL
  GROUP BY es."microLearningId"
) stack_counts ON stack_counts."microLearningId" = ml.id
LEFT JOIN (
  SELECT
    p."microLearningId",
    COUNT(p.id) as num_permissions
  FROM "Permission" p
  WHERE p."microLearningId" IS NOT NULL
  GROUP BY p."microLearningId"
) activity_perm_counts ON activity_perm_counts."microLearningId" = ml.id
LEFT JOIN (
  SELECT
    p."courseId",
    p."userId",
    true as is_user_course_admin
  FROM "DerivedPermission" p
  WHERE p."courseId" IS NOT NULL
    AND p."permissionLevel" IN ('ADMIN', 'OWNER')
  GROUP BY p."courseId", p."userId"
) course_perm_counts ON course_perm_counts."courseId" = ml."courseId" AND course_perm_counts."userId" = dp."userId"
WHERE c."isDeleted" = false
AND (
  c."isDeletionPending" = false
  OR c."deleteDraftActivitiesOnDeletion" = false
  OR ml.status <> 'DRAFT'
)

UNION ALL

SELECT
  -- Core activity fields
  ga.id,
  'GROUP_ACTIVITY' as type,
  4 as "typeOrder",
  ga.name,
  ga."displayName",
  ga.description,
  ga.status,
  ga."reviewStatus",
  ga."isDeleted",

  -- Activity features
  ga."areInstancesOutdated",
  ga."isGamificationEnabled",
  ga."isAssessmentEnabled",
  ga."pointsMultiplier",
  CAST(NULL AS TEXT) as "pinCode",

  -- Template information
  at.id as "templateId",
  ga."templateName",

  -- Timestamps
  ga."createdAt",
  ga."updatedAt",

  -- Type-specific scheduling fields
  NULL as "availableFrom",
  ga."scheduledStartAt",
  ga."scheduledEndAt",

  -- Course information
  c.id as "courseId",
  c.name as "courseName",
  c.language as "courseLanguage",
  c."startDate" as "courseStartDate",

  -- Group activity specific
  c."groupDeadlineDate",
  course_stats.num_participant_groups as "numOfParticipantGroups",

  -- Content metrics (count stacks and their elements)
  COALESCE(stack_counts.num_stacks, 0) as "numOfStacks",
  COALESCE(stack_counts.num_elements, 0) as "numOfElements",

  -- Permission fields
  dp."userId",
  dp."permissionLevel",
  dp.derived,

  -- Permission details for direct permissions
  p_direct.user_group_id as "directPermissionUserGroupId",

  -- Owner information
  ga."ownerId",

  -- Permission counts for numSharedUsers and isActivityReviewer calculation
  COALESCE(activity_perm_counts.num_permissions, 0) as "numActivityPermissions",
  COALESCE(course_perm_counts.is_user_course_admin, false) as "isUserCourseAdmin"

FROM "GroupActivity" ga
JOIN "DerivedPermission" dp ON dp."groupActivityId" = ga.id
LEFT JOIN (
  SELECT p.id, p."userGroupId" as user_group_id
  FROM "Permission" p
) p_direct ON p_direct.id = dp."directPermissionId"
LEFT JOIN "ActivityTemplate" at ON at."groupActivityId" = ga.id
LEFT JOIN "Course" c ON c.id = ga."courseId"
LEFT JOIN (
  SELECT
    es."groupActivityId",
    COUNT(es.id) as num_stacks,
    COALESCE(SUM(ei_counts.element_count), 0) as num_elements
  FROM "ElementStack" es
  LEFT JOIN (
    SELECT
      ei."elementStackId",
      COUNT(ei.id) as element_count
    FROM "ElementInstance" ei
    GROUP BY ei."elementStackId"
  ) ei_counts ON ei_counts."elementStackId" = es.id
  WHERE es."groupActivityId" IS NOT NULL
  GROUP BY es."groupActivityId"
) stack_counts ON stack_counts."groupActivityId" = ga.id
LEFT JOIN (
  SELECT
    pg."courseId",
    COUNT(pg.id) as num_participant_groups
  FROM "ParticipantGroup" pg
  GROUP BY pg."courseId"
) course_stats ON course_stats."courseId" = ga."courseId"
LEFT JOIN (
  SELECT
    p."groupActivityId",
    COUNT(p.id) as num_permissions
  FROM "Permission" p
  WHERE p."groupActivityId" IS NOT NULL
  GROUP BY p."groupActivityId"
) activity_perm_counts ON activity_perm_counts."groupActivityId" = ga.id
LEFT JOIN (
  SELECT
    p."courseId",
    p."userId",
    true as is_user_course_admin
  FROM "DerivedPermission" p
  WHERE p."courseId" IS NOT NULL
    AND p."permissionLevel" IN ('ADMIN', 'OWNER')
  GROUP BY p."courseId", p."userId"
) course_perm_counts ON course_perm_counts."courseId" = ga."courseId" AND course_perm_counts."userId" = dp."userId"
WHERE c."isDeleted" = false
AND (
  c."isDeletionPending" = false
  OR c."deleteDraftActivitiesOnDeletion" = false
  OR ga.status <> 'DRAFT'
);
