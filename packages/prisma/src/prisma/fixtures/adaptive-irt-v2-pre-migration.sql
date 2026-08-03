-- Additional pre-v2 scale geometry used by the adaptive IRT migration rehearsal.
-- The Phase 10 fixture supplies the owner and a populated one-level NEAREST tree.
INSERT INTO "CompetenceTree" (
  "id",
  "name",
  "displayName",
  "ownerId",
  "thetaMin",
  "thetaMax",
  "levelMappingRule",
  "updatedAt"
) VALUES (
  '92000000-0000-4000-8000-000000000001',
  'adaptive-irt-v2-mastery-tree',
  'Adaptive IRT v2 mastery tree',
  '91000000-0000-4000-8000-000000000001',
  -3,
  3,
  'MASTERY',
  CURRENT_TIMESTAMP
);

INSERT INTO "CompetenceTreeLevel" ("id", "label", "order", "treeId") VALUES
  (9201, 'Foundation', 0, '92000000-0000-4000-8000-000000000001'),
  (9202, 'Developing', 1, '92000000-0000-4000-8000-000000000001'),
  (9203, 'Independent', 2, '92000000-0000-4000-8000-000000000001');

INSERT INTO "CompetenceTree" (
  "id", "name", "displayName", "ownerId", "thetaMin", "thetaMax",
  "levelMappingRule", "updatedAt"
) VALUES
  (
    '92000000-0000-4000-8000-000000000002',
    'adaptive-irt-v2-nearest-tree',
    'Adaptive IRT v2 nearest tree',
    '91000000-0000-4000-8000-000000000001',
    -3,
    3,
    'NEAREST',
    CURRENT_TIMESTAMP
  ),
  (
    '92000000-0000-4000-8000-000000000003',
    'adaptive-irt-v2-one-level-mastery-tree',
    'Adaptive IRT v2 one-level mastery tree',
    '91000000-0000-4000-8000-000000000001',
    -4,
    2,
    'MASTERY',
    CURRENT_TIMESTAMP
  );

INSERT INTO "CompetenceTreeLevel" ("id", "label", "order", "treeId") VALUES
  (9211, 'Basic', 0, '92000000-0000-4000-8000-000000000002'),
  (9212, 'Independent', 1, '92000000-0000-4000-8000-000000000002'),
  (9213, 'Advanced', 2, '92000000-0000-4000-8000-000000000002'),
  (9221, 'Observed', 0, '92000000-0000-4000-8000-000000000003');

-- The materialized pool intentionally retains element version 1 while the
-- mutable source element has advanced to version 2.
UPDATE "Element"
SET version = 2, "updatedAt" = CURRENT_TIMESTAMP
WHERE id = 9101;
