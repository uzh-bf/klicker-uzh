---
question: Search my question pool for anything about standard deviation and summarize each result you found, including its status.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_search
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
scope: ACCOUNT_OWNER
---

The judge checks the summarized results (names/statuses) against
`element_search`'s actual snippet output this turn, not a generic
restatement of the question.
