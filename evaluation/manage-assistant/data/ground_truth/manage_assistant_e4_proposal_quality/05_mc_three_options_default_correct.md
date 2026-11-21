---
question: Create an MC draft question about outliers with 3 answer options. Draft it directly, no need to confirm anything else with me first.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_create_draft_proposal
expect_proposal_card: true
expected_type: MC
expected_option_count: 3
scope: ACCOUNT_OWNER
---

No "exactly N correct" phrasing in the prompt, so `expected_correct_count` is
left unset -- the schema check falls back to MC's own default invariant
(>= 1 correct choice), the same one `elementCreateDraftProposalSchema`
enforces server-side.
