---
question: What is the status and type of question ID 31, and what does its content say?
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_get
    arguments:
      elementId: 31
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
scope: ACCOUNT_OWNER
---

Same seeded element id as E1 case 06 ("What standard deviation measures",
DRAFT SC). The judge checks the reported status/type/content against
`element_get`'s actual output this turn.
