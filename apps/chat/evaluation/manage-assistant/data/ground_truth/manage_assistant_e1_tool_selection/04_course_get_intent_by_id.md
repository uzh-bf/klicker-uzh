---
question: Give me details and activity counts for course 7c12e44e-d083-4acf-845e-4c34aaff6b49.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_course_get
    arguments:
      courseId: 7c12e44e-d083-4acf-845e-4c34aaff6b49
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
scope: ACCOUNT_OWNER
---

Course id given directly (seeded "Testkurs") so the model should not need to
list first. Subset policy tolerates an extra `course_list` call if the model
double-checks.
