---
question: How many live quizzes and practice quizzes are in my Gamified Assessment Course? Only report numbers you can see in the tool result.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_course_get
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
scope: ACCOUNT_OWNER
---

Same seeded course name as E1 case 11. Activity counts are exactly the kind
of fact this dimension exists to catch a hallucinated number for (the plan's
"no hallucinated course names, counts, ids").
