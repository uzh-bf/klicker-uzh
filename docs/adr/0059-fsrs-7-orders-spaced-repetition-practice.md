# FSRS-7 orders spaced-repetition practice instead of SM-2

Spaced-repetition practice quizzes and the course practice pool ordered stacks
by an SM-2 due date. SM-2 ignores how much time passed since the last answer,
resets every failed element to a one-day interval and cannot express partial
answers except as a pass/fail threshold. An offline replay of exported
practice-quiz answers compared it with FSRS-6 and FSRS-7: within a student,
SM-2 ranked elements by recall barely better than chance, while both FSRS
versions ranked clearly better, and FSRS-7 was best in every group, especially
for repeats on the same day. Fitting the FSRS-7 weights to Klicker answers did
not improve its predictions, so the published default weights are used.

Each `QuestionResponse` now also stores the FSRS-7 memory state (slow and fast
stability, difficulty). Answers are mapped to ratings from the graded
correctness: below 0.5 is Again, from 0.5 up to below 1 is Hard, and fully
correct is Good; flashcards use their self-rating the same way, and selection
answers first remove the chance of picking a correct entry by guessing, as
`(c - p) / (1 - p)` for correctness `c` and `p = solutions / entries`. Easy is
not used, because automatic grading cannot tell an effortless answer from a
correct one. Content elements and questions without a sample solution are
always graded as correct, so they get no FSRS state.

The order shows unanswered stacks first, then answered stacks by the lowest
predicted recall at load time among their graded elements, then stacks that
only contain elements without recall information, least recently viewed first.
Ordering by current recall rather than by a due date matches what the
evaluation measured and needs no stored date; `nextDueAt` is still written,
and for graded elements it is the time when recall falls to 90 %.

SM-2 keeps updating its existing fields in parallel, so the switch can be
reverted without losing state. Its fields and function are removed in a later
change. Responses answered before the switch are given an FSRS state by
replaying their stored answers; until then, their recall is estimated from the
SM-2 interval, and an element answered again starts its FSRS state from that
answer until the replay recomputes it from the full history.
