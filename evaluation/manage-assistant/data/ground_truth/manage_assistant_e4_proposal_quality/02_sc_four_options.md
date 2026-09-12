---
question: Create an SC draft question about variance with exactly 4 answer options. Draft it directly, no need to confirm anything else with me first.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_create_draft_proposal
expect_proposal_card: true
expected_type: SC
expected_option_count: 4
scope: ACCOUNT_OWNER
---

Option-count constraint only; feedback not requested, so `require_feedback`
is left unset (not checked).
