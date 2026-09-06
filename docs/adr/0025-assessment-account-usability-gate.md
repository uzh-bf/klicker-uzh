---
status: accepted
---

# Assessment accounts remain unusable until required choices are complete

Assessment authentication may create or link an account before the participant
finishes the research, Learning Analytics, and privacy acknowledgement choices.
The account remains unusable until those required choices are submitted. Account
creation therefore does not require a temporary pre-account identity flow, while
the assessment entry path still requires explicit choices and never offers an
undecided submission state.

The same rule covers accounts created before the choices existed: the backend
marks an undecided account in its login session, every app honours the mark,
and the student PWA hosts the single gate page. An account without a recorded
research decision is never eligible for a research export.
