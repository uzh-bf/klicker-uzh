# 22. The manage surface shows no student-authored text

## Status

Accepted

## Context

Lecturers improving their chatbot want to see what students asked, especially
for badly rated answers. But student conversations are personal data with a
purpose-bound analytics boundary (ADR 0005 on the learning-analytics line),
and topic aggregation belongs to the future learning-analytics capability with
its own governance. A partial exception ("only thumbs-down'd questions") would
blur an otherwise crisp boundary.

## Decision

The lecturer-facing manage surface shows only quantitative aggregates computed
from the database — conversation and message counts, thumbs ratios and
reason-tag counts, credits consumed, knowledge-source status. No
student-authored text, verbatim or paraphrased, and no topic aggregation
appears in manage. Lecturers diagnose content gaps through their own test
conversations and reason-tag counts, not through student transcripts.

## Consequences

- Zero tension with the consent and purpose model while the beta scales.
- Diagnosing a specific content gap is more indirect for lecturers; the
  reason-tag counts ("12x source missing") must carry that weight.
- Any future exposure of student content to lecturers is a governance decision
  inside the learning-analytics track, not a manage feature request.
