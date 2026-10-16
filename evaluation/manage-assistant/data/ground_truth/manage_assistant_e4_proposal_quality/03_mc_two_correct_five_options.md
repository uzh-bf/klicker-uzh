---
question: Create an MC draft question about measures of central tendency with 5 answer options, where exactly two are correct. Draft it directly, no need to confirm anything else with me first.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_create_draft_proposal
expect_proposal_card: true
expected_type: MC
expected_option_count: 5
expected_correct_count: 2
scope: ACCOUNT_OWNER
---

"Exactly two correct" is an explicit constraint beyond MC's own default
invariant (>= 1) -- checked via `expected_correct_count`.
