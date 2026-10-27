---
question: What courses do I have access to?
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_course_list
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
scope: ACCOUNT_OWNER
---

Direct course-listing intent.
