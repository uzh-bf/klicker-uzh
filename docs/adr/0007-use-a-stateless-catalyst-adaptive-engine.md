# 7. Use a stateless Catalyst adaptive engine

Status: Accepted

Adaptive learning combines public product state and authorization with
psychometric algorithms that belong to Catalyst. Keeping the algorithms in the
public host would publish the private decision strategy, while moving attempt
state or grading into Catalyst would duplicate the canonical KlickerUZH record
and widen the private service's access to participant data.

KlickerUZH therefore retains authorization, Prisma state, publication
snapshots, attempt lifecycle, deterministic response grading, and all UI/API
surfaces. A separate stateless Catalyst adaptive service owns IRT estimation,
calibration mathematics, item selection, stopping, classification, and
psychometric diagnostics. The host sends bounded item metadata and graded
observations through a dedicated ordinal contract and persists the returned
decision. The adaptive service is not part of the chat or tutoring engine.

This adds an HTTP and conformance boundary to each adaptive decision, but keeps
one application record, limits private-service data access, and lets the public
host and private algorithms evolve through explicit contract generations.
