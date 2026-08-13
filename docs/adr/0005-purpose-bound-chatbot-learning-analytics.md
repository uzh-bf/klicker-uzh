# ADR-0005: Keep chatbot learning analytics purpose-bound

## Status

Accepted

## Context

Chatbot conversations can support durable learning analytics, product-quality
work, and later research. The same persistence and linkage that make
longitudinal analysis useful also increase the possibility of identifying a
student or reusing their records for another purpose. Pseudonymised conversation
data therefore remains personal data.

The consent and eligibility model is being designed separately. The analysis
capability needs a stable boundary that can consume those decisions without
turning a broad analytics role or an exported workbook into general access to
personal information.

## Decision

Learning analytics and research are separate purposes with separate,
fail-closed eligibility flags. The analysis capability consumes those flags and
does not own their collection.

Eligible records use stable pseudonyms only within one purpose and one course
instance. Cross-purpose and cross-course linkage is unavailable by default.
Eligibility is prospective unless the consent design explicitly authorizes and
explains retrospective inclusion.

Row-level content may leave the governed analysis environment only through an
explicit restricted export. Each export records its purpose, named operator,
eligibility filter, expiry date, and encrypted destination in an immutable audit
record. Withdrawal stops future inclusion and removes the person from
rebuildable row-level and derived datasets; only outputs demonstrated to be
anonymous may remain.

## Considered options

- Global pseudonyms would make cross-course longitudinal analysis easier, but
  would create a broader linkage boundary than the initial purposes require.
- Per-export pseudonyms would minimize linkage, but would prevent longitudinal
  analysis even within an eligible course cohort.
- Role-only exports would be simpler, but would not bind portable copies to a
  declared purpose or lifecycle.

## Consequences

- The first capability supports longitudinal analysis within a course instance,
  not a person-level history across courses.
- Restricted exports need technical access, audit, expiry, and deletion controls;
  pseudonymisation alone is insufficient.
- A later cross-course or retrospective-analysis feature requires a new
  governance and architecture decision rather than a wider query.
