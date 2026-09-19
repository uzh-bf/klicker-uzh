---
question: Create a FREE_TEXT draft question asking students to explain the difference between population and sample standard deviation. Draft it directly, no need to confirm anything else with me first.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_create_draft_proposal
expect_proposal_card: true
expected_type: FREE_TEXT
scope: ACCOUNT_OWNER
---

FREE_TEXT proposals have no `choices` at all (`options` is
`{hasSampleSolution, restrictions}`) -- option-count/correct-count/feedback
constraints do not apply and are left unset.
