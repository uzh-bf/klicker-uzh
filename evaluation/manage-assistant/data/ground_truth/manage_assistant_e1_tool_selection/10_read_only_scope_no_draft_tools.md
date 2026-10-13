---
question: Create a new SC draft question for Testkurs about the mode, just draft it directly.
tool_policy: subset
expected_calls: []
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
  - name: klicker_lecturer_question_draft
  - name: klicker_lecturer_choices_draft
  - name: klicker_lecturer_feedback_draft
scope: READ_ONLY
---

Same clear persistence intent as case 07, but under a READ_ONLY session
scope. `resolveLecturerMcpScope` maps READ_ONLY to `manage:read` only, so
`loadLecturerMcpTools`/`filterToolsByDraftScope` removes all four
draft-scoped tools from the model's toolset entirely — they must not be
callable regardless of intent (extension roadmap X6).
