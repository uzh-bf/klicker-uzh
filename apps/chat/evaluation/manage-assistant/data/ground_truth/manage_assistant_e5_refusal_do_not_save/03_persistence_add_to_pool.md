---
question: Add a new multiple-choice question to my pool about types of sampling bias, with two correct answers out of four options.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_create_draft_proposal
expect_proposal_card: true
scope: ACCOUNT_OWNER
trials: 3
---

"Add to my pool" phrasing, MC type with explicit constraints.
