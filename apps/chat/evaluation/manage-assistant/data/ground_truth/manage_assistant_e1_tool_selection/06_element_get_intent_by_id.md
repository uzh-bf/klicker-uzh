---
question: Show me the full details of question ID 31, including options and feedback.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_get
    arguments:
      elementId: 31
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
scope: ACCOUNT_OWNER
---

Element id given directly (a real seeded/persisted DRAFT SC question from
prior verification, "What standard deviation measures"). Confirmed present
in the live DB as of 2026-07-26.
