---
question: Create a new SC draft question for Testkurs about the median, and just draft it directly, no need to confirm anything else with me first.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_create_draft_proposal
expect_proposal_card: true
scope: ACCOUNT_OWNER
---

Clear persistence intent — should call the proposal tool (which itself
never persists; the human-confirm step is what would).
