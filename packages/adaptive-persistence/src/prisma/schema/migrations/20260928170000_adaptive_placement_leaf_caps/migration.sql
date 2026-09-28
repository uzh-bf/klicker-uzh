BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "PracticeQuizAdaptivePublication"
ADD CONSTRAINT "pqap_root_placement_leaf_caps_check" CHECK (
  "stoppingPolicyVersion" <> 'IRT_V2_ROOT_BALANCED_PLACEMENT_1'
  OR NOT jsonb_path_exists("questionCapSnapshot", '$.leaf.* ? (@ != null)')
) NOT VALID;
ALTER TABLE "PracticeQuizAdaptivePublication"
VALIDATE CONSTRAINT "pqap_root_placement_leaf_caps_check";
COMMIT;
