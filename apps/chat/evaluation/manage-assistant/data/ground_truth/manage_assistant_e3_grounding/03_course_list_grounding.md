---
question: List the courses I currently have access to and tell me exactly how many there are.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_course_list
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
scope: ACCOUNT_OWNER
---

The judge checks that the stated course names/count match `course_list`'s
actual output this turn -- a plausible-sounding but wrong count (e.g. off
by one, or a course name not in the result) must fail.
