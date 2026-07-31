# KlickerUZH

KlickerUZH supports learning activities, participant attempts, and grading across synchronous and self-paced teaching formats.

## Language

**Code submission**:
A participant attempt for one CODE element with an immutable code payload and its own grading lifecycle. The lifecycle ends when the attempt either produces a finalized question response or fails.
_Avoid_: Pending response, grading job

**Question response**:
The finalized, graded record used for scores, points, XP, analytics, and spaced repetition.
_Avoid_: Submission
