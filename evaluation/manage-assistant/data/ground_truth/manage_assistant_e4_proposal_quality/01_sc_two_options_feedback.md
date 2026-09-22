---
question: Create an SC draft question about the difference between the mean and the median, with exactly 2 answer options, and feedback on each option explaining why it is right or wrong. Just draft it directly, no need to confirm anything else with me first.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_create_draft_proposal
expect_proposal_card: true
expected_type: SC
expected_option_count: 2
expected_correct_count: 1
require_feedback: true
scope: ACCOUNT_OWNER
---

Explicit constraints: SC, exactly 2 options, exactly 1 correct (SC's own
invariant), feedback required on every option.
