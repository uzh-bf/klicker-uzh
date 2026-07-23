---
status: proposed
---

# Track code submissions separately from question responses

CODE attempts use a separate `CodeSubmission` lifecycle until grading finishes. `QuestionResponse` and its related score, XP, leaderboard, analytics, and spaced-repetition updates are written only by an idempotent finalization transaction, preserving the existing invariant that a question response is already graded.
