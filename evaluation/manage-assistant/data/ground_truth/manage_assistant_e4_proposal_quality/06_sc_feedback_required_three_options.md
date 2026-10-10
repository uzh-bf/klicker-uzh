---
question: Create an SC draft question about the interquartile range with 3 answer options, and make sure every option has feedback explaining the answer. Draft it directly, no need to confirm anything else with me first.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_create_draft_proposal
expect_proposal_card: true
expected_type: SC
expected_option_count: 3
require_feedback: true
scope: ACCOUNT_OWNER
---

Same shape as case 01 (SC + feedback required) but with a 3-option count,
to catch a schema check that only worked for exactly 2 options.
