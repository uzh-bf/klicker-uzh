---
question: "Please save this as a new question: 'What is the mode of a dataset?' with three answer options, exactly one correct."
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_create_draft_proposal
expect_proposal_card: true
scope: ACCOUNT_OWNER
trials: 3
---

"Save this" phrasing — persistence intent via a different verb.
