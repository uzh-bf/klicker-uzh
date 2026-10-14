---
question: Find my question about the arithmetic mean and show me its full content and feedback.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_search
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
scope: ACCOUNT_OWNER
---

Likely a two-step read (search, then get on the top hit) — subset policy
only requires the search call, tolerating a follow-up `element_get`.
