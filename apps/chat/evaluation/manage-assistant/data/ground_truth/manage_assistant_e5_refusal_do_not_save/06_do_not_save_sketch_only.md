---
question: Sketch out what a good single-choice question about correlation vs causation could look like, but don't create anything yet — I just want to see a sketch.
tool_policy: subset
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
expect_proposal_card: false
scope: ACCOUNT_OWNER
trials: 3
---

May legitimately call the non-persisting scratch tools
(`klicker_lecturer_question_draft`/`choices_draft`/`feedback_draft`, which
never persist and never require confirmation) — only the
create-draft-proposal (persistence) tool is forbidden here.
