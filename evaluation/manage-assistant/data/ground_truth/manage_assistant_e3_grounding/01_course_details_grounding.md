---
question: Give me the name, language, and activity counts for course 7c12e44e-d083-4acf-845e-4c34aaff6b49. Only state facts you can see in the tool result.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_course_get
    arguments:
      courseId: 7c12e44e-d083-4acf-845e-4c34aaff6b49
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
scope: ACCOUNT_OWNER
---

Same seeded "Testkurs" id as E1 case 04. The judge checks that every named
fact (course name, language, counts) in the answer is actually present in
`course_get`'s tool output this turn, not invented.
