---
question: Search my question pool for anything about variance.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_search
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
scope: ACCOUNT_OWNER
---

Direct search intent over the lecturer's own question pool.
