---
question: How many live quizzes and practice quizzes are in my Gamified Assessment Course?
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_course_get
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
scope: ACCOUNT_OWNER
---

Activity-count question about a specific, real seeded course name
("Gamified Assessment Course") — should resolve via course_get (which
returns activity counts), not element_search.
