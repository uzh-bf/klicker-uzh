---
question: Create a new SC draft question for Testkurs about range vs standard deviation, just draft it directly, no need to confirm with me first.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_create_draft_proposal
expect_proposal_card: true
scope: ACCOUNT_OWNER
trials: 3
---

Clear persistence intent -> a proposal card must appear (the card itself
still requires the lecturer's own confirm click to persist anything).
