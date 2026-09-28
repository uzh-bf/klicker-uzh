-- Populated pre-repair fixture for migration 20260713210000. The three checks
-- are re-added NOT VALID after inserting rows that emulate legacy data which
-- predates enforcement for new writes.
ALTER TABLE "AdaptivePracticeQuizAttempt"
DROP CONSTRAINT "apqa_runtime_state_check";

ALTER TABLE "AdaptivePracticeQuizResponse"
DROP CONSTRAINT "apqr_pool_item_required_check";

ALTER TABLE "AdaptivePracticeQuizResponse"
DROP CONSTRAINT "apqr_element_snapshot_required_check";

INSERT INTO "User" (
  "id",
  "email",
  "shortname",
  "updatedAt"
) VALUES (
  '91000000-0000-4000-8000-000000000001',
  'adaptive-phase10-owner@example.com',
  'adaptive-phase10-owner',
  CURRENT_TIMESTAMP
);

INSERT INTO "Course" (
  "id",
  "name",
  "displayName",
  "ownerId",
  "pinCode",
  "startDate",
  "endDate",
  "groupDeadlineDate",
  "isAdaptiveLearningEnabled",
  "updatedAt"
) VALUES (
  '91000000-0000-4000-8000-000000000002',
  'adaptive-phase10-course',
  'Adaptive Phase 10 course',
  '91000000-0000-4000-8000-000000000001',
  9101,
  '2026-01-01T00:00:00Z',
  '2027-01-01T00:00:00Z',
  '2026-12-01T00:00:00Z',
  TRUE,
  CURRENT_TIMESTAMP
);

INSERT INTO "CompetenceTree" (
  "id",
  "name",
  "displayName",
  "ownerId",
  "updatedAt"
) VALUES (
  '91000000-0000-4000-8000-000000000003',
  'adaptive-phase10-tree',
  'Adaptive Phase 10 tree',
  '91000000-0000-4000-8000-000000000001',
  CURRENT_TIMESTAMP
);

INSERT INTO "CompetenceTreeLevel" (
  "id",
  "label",
  "order",
  "treeId"
) VALUES (
  9101,
  'Independent',
  0,
  '91000000-0000-4000-8000-000000000003'
);

INSERT INTO "CompetenceTreeNode" (
  "id",
  "kind",
  "name",
  "order",
  "depth",
  "treeId",
  "updatedAt"
) VALUES
  (
    9101,
    'COMPETENCE',
    'Reading',
    0,
    0,
    '91000000-0000-4000-8000-000000000003',
    CURRENT_TIMESTAMP
  );

INSERT INTO "CompetenceTreeNode" (
  "id",
  "kind",
  "name",
  "order",
  "depth",
  "treeId",
  "parentId",
  "updatedAt"
) VALUES (
  9102,
  'SUBCOMPETENCE',
  'Scanning',
  0,
  1,
  '91000000-0000-4000-8000-000000000003',
  9101,
  CURRENT_TIMESTAMP
);

INSERT INTO "Element" (
  "id",
  "name",
  "content",
  "options",
  "type",
  "ownerId",
  "updatedAt"
) VALUES (
  9101,
  'Legacy adaptive item',
  'Legacy adaptive item',
  '{"displayMode":"LIST","choices":[{"ix":0,"value":"A","correct":true},{"ix":1,"value":"B","correct":false}]}'::jsonb,
  'SC',
  '91000000-0000-4000-8000-000000000001',
  CURRENT_TIMESTAMP
);

INSERT INTO "Element" (
  "id",
  "name",
  "content",
  "options",
  "type",
  "ownerId",
  "updatedAt"
) VALUES (
  9102,
  'Legacy adaptive next item',
  'Legacy adaptive next item',
  '{"displayMode":"LIST","choices":[{"ix":0,"value":"A","correct":true},{"ix":1,"value":"B","correct":false}]}'::jsonb,
  'SC',
  '91000000-0000-4000-8000-000000000001',
  CURRENT_TIMESTAMP
);

INSERT INTO "CompetenceTreeElementAssignment" (
  "id",
  "treeId",
  "elementId",
  "leafNodeId",
  "levelId",
  "updatedAt"
) VALUES (
  9101,
  '91000000-0000-4000-8000-000000000003',
  9101,
  9102,
  9101,
  CURRENT_TIMESTAMP
);

INSERT INTO "CompetenceTreeElementAssignment" (
  "id",
  "treeId",
  "elementId",
  "leafNodeId",
  "levelId",
  "updatedAt"
) VALUES (
  9102,
  '91000000-0000-4000-8000-000000000003',
  9102,
  9102,
  9101,
  CURRENT_TIMESTAMP
);

INSERT INTO "PracticeQuiz" (
  "id",
  "name",
  "displayName",
  "mode",
  "status",
  "pointsMultiplier",
  "ownerId",
  "courseId",
  "updatedAt"
) VALUES (
  '91000000-0000-4000-8000-000000000004',
  'adaptive-phase10-quiz',
  'Adaptive Phase 10 quiz',
  'ADAPTIVE',
  'PUBLISHED',
  0,
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  CURRENT_TIMESTAMP
);

INSERT INTO "PracticeQuizAdaptiveConfig" (
  "id",
  "practiceQuizId",
  "competenceTreeId",
  "poolPublishedAt",
  "updatedAt"
) VALUES (
  '91000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000004',
  '91000000-0000-4000-8000-000000000003',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "PracticeQuizAdaptivePoolItem" (
  "id",
  "configId",
  "competenceTreeId",
  "sourceAssignmentId",
  "elementId",
  "elementVersion",
  "elementType",
  "elementName",
  "elementData",
  "leafNodeId",
  "nodePath",
  "nodeNamePath",
  "levelId",
  "levelLabel",
  "levelOrder",
  "discrimination",
  "difficulty",
  "guessing"
) VALUES (
  9101,
  '91000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000003',
  9101,
  9101,
  1,
  'SC',
  'Legacy adaptive item',
  '{"id":"9101-v1","elementId":9101,"type":"SC","name":"Legacy adaptive item","content":"Legacy adaptive item","pointsMultiplier":1,"options":{"displayMode":"LIST","choices":[{"ix":0,"value":"A","correct":true},{"ix":1,"value":"B","correct":false}]}}'::jsonb,
  9102,
  ARRAY[9101, 9102],
  ARRAY['Reading', 'Scanning'],
  9101,
  'Independent',
  0,
  1.2,
  0.0,
  0.5
);

INSERT INTO "PracticeQuizAdaptivePoolItem" (
  "id",
  "configId",
  "competenceTreeId",
  "sourceAssignmentId",
  "elementId",
  "elementVersion",
  "elementType",
  "elementName",
  "elementData",
  "leafNodeId",
  "nodePath",
  "nodeNamePath",
  "levelId",
  "levelLabel",
  "levelOrder",
  "discrimination",
  "difficulty",
  "guessing"
) VALUES (
  9102,
  '91000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000003',
  9102,
  9102,
  1,
  'SC',
  'Legacy adaptive next item',
  '{"id":"9102-v1","elementId":9102,"type":"SC","name":"Legacy adaptive next item","content":"Legacy adaptive next item","pointsMultiplier":1,"options":{"displayMode":"LIST","choices":[{"ix":0,"value":"A","correct":true},{"ix":1,"value":"B","correct":false}]}}'::jsonb,
  9102,
  ARRAY[9101, 9102],
  ARRAY['Reading', 'Scanning'],
  9101,
  'Independent',
  0,
  1.2,
  1.0,
  0.5
);

INSERT INTO "Participant" (
  "id",
  "username",
  "password",
  "updatedAt"
) VALUES (
  '91000000-0000-4000-8000-000000000006',
  'adaptive-phase10-participant',
  'test',
  CURRENT_TIMESTAMP
);

INSERT INTO "Participant" (
  "id",
  "username",
  "password",
  "updatedAt"
) VALUES (
  '91000000-0000-4000-8000-000000000010',
  'adaptive-phase10-active-participant',
  'test',
  CURRENT_TIMESTAMP
);

INSERT INTO "Participation" (
  "id",
  "courseId",
  "participantId",
  "updatedAt"
) VALUES (
  9101,
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000006',
  CURRENT_TIMESTAMP
);

INSERT INTO "Participation" (
  "id",
  "courseId",
  "participantId",
  "updatedAt"
) VALUES (
  9102,
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000010',
  CURRENT_TIMESTAMP
);

-- Unresumable legacy state: the forward migration preserves it as abandoned.
INSERT INTO "AdaptivePracticeQuizAttempt" (
  "id",
  "status",
  "currentTheta",
  "currentStandardError",
  "configId",
  "competenceTreeId",
  "practiceQuizId",
  "courseId",
  "participantId",
  "participationId",
  "nextPoolItemId",
  "updatedAt"
) VALUES (
  '91000000-0000-4000-8000-000000000007',
  'IN_PROGRESS',
  0.0,
  1.0,
  '91000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000004',
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000006',
  9101,
  NULL,
  CURRENT_TIMESTAMP
);

-- Resumable answered state: the non-null immutable next pointer must survive.
INSERT INTO "AdaptivePracticeQuizAttempt" (
  "id",
  "status",
  "currentTheta",
  "currentStandardError",
  "configId",
  "competenceTreeId",
  "practiceQuizId",
  "courseId",
  "participantId",
  "participationId",
  "nextPoolItemId",
  "updatedAt"
) VALUES (
  '91000000-0000-4000-8000-000000000009',
  'IN_PROGRESS',
  0.1,
  0.9,
  '91000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000004',
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000010',
  9102,
  9102,
  CURRENT_TIMESTAMP
);

-- Legacy terminal state and response: completion metadata, immutable pool
-- identity, and the delivered element snapshot all need deterministic repair.
INSERT INTO "AdaptivePracticeQuizAttempt" (
  "id",
  "status",
  "currentTheta",
  "currentStandardError",
  "finalTheta",
  "finalStandardError",
  "finalLevelId",
  "configId",
  "competenceTreeId",
  "practiceQuizId",
  "courseId",
  "participantId",
  "participationId",
  "nextPoolItemId",
  "stopReason",
  "completedAt",
  "updatedAt"
) VALUES (
  '91000000-0000-4000-8000-000000000008',
  'COMPLETED',
  0.0,
  1.0,
  0.0,
  1.0,
  9101,
  '91000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000004',
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000006',
  9101,
  NULL,
  NULL,
  NULL,
  CURRENT_TIMESTAMP
);

-- Existing canonical abandoned rows remain unchanged and valid.
INSERT INTO "AdaptivePracticeQuizAttempt" (
  "id",
  "status",
  "stopReason",
  "currentTheta",
  "currentStandardError",
  "configId",
  "competenceTreeId",
  "practiceQuizId",
  "courseId",
  "participantId",
  "participationId",
  "nextPoolItemId",
  "completedAt",
  "updatedAt"
) VALUES (
  '91000000-0000-4000-8000-000000000011',
  'ABANDONED',
  'ABANDONED',
  -0.2,
  1.1,
  '91000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000004',
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000006',
  9101,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "AdaptivePracticeQuizResponse" (
  "id",
  "order",
  "response",
  "normalizedResponse",
  "score",
  "correct",
  "attemptId",
  "configId",
  "assignmentId",
  "poolItemId",
  "elementId",
  "elementSnapshot"
) VALUES (
  9101,
  1,
  '{"choiceIndices":[0]}'::jsonb,
  '{"choiceIndices":[0]}'::jsonb,
  1.0,
  TRUE,
  '91000000-0000-4000-8000-000000000008',
  '91000000-0000-4000-8000-000000000005',
  9101,
  NULL,
  9101,
  NULL
);

INSERT INTO "AdaptivePracticeQuizResponse" (
  "id",
  "order",
  "response",
  "normalizedResponse",
  "score",
  "correct",
  "attemptId",
  "configId",
  "assignmentId",
  "poolItemId",
  "elementId",
  "elementSnapshot",
  "overallThetaBefore",
  "overallThetaAfter",
  "overallStandardErrorAfter"
) VALUES (
  9102,
  1,
  '{"choiceIndices":[0]}'::jsonb,
  '{"choiceIndices":[0]}'::jsonb,
  1.0,
  TRUE,
  '91000000-0000-4000-8000-000000000009',
  '91000000-0000-4000-8000-000000000005',
  9101,
  9101,
  9101,
  '{"id":"9101-v1","elementId":9101,"type":"SC","name":"Legacy adaptive item","content":"Legacy adaptive item","pointsMultiplier":1,"options":{"displayMode":"LIST","choices":[{"ix":0,"value":"A","correct":true},{"ix":1,"value":"B","correct":false}]}}'::jsonb,
  0.0,
  0.1,
  0.9
);

INSERT INTO "AdaptivePracticeQuizEstimate" (
  "id",
  "nodeKind",
  "theta",
  "standardError",
  "responseCount",
  "stopReason",
  "attemptId",
  "configId",
  "competenceTreeId",
  "levelId"
) VALUES (
  9101,
  'OVERALL',
  0.0,
  1.0,
  1,
  'CLASSIFIED',
  '91000000-0000-4000-8000-000000000008',
  '91000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000003',
  9101
);

ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD CONSTRAINT "apqa_runtime_state_check"
CHECK (
  (
    "status" = 'IN_PROGRESS'
    AND "nextPoolItemId" IS NOT NULL
    AND "stopReason" IS NULL
    AND "completedAt" IS NULL
  )
  OR (
    "status" = 'COMPLETED'
    AND "nextPoolItemId" IS NULL
    AND "stopReason" IS NOT NULL
    AND "stopReason" <> 'ABANDONED'
    AND "completedAt" IS NOT NULL
  )
  OR (
    "status" = 'ABANDONED'
    AND "nextPoolItemId" IS NULL
    AND "stopReason" = 'ABANDONED'
    AND "completedAt" IS NOT NULL
  )
) NOT VALID;

ALTER TABLE "AdaptivePracticeQuizResponse"
ADD CONSTRAINT "apqr_pool_item_required_check"
CHECK ("poolItemId" IS NOT NULL) NOT VALID;

ALTER TABLE "AdaptivePracticeQuizResponse"
ADD CONSTRAINT "apqr_element_snapshot_required_check"
CHECK ("elementSnapshot" IS NOT NULL) NOT VALID;
