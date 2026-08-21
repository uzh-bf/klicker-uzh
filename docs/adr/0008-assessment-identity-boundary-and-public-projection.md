# 8. Keep assessment identity course-scoped and minimize public credential identity

- **Status:** Accepted — 2026-08-20

## Context

Assessment results need identity attributes from SWITCH edu-ID for later grade
matching and for the student's credential download. The existing participant
account is also used by ordinary courses, while an assessment credential can be
verified through a bearer token without authentication. Invitation rosters can
also carry a matriculation number, but that input has a different provenance
from an edu-ID assertion. The edu-ID release approval covers the required email,
unique ID, surname, and given name claims, plus the desired matriculation number
and linked-affiliation claims.

## Decision

Keep assessment participation identity course-scoped and nullable. Store the
given name, surname, and matriculation number for an assessment participation,
not on the global participant account; non-assessment participation has no such
values. Keep invitation roster identity distinct from the edu-ID assertion and
make missing or conflicting values explicit in authorized assessment exports.

Assessment exports include the identity needed for grade matching without
adding it to the Manage UI. A student's private credential download may include
the approved identity projection. Public credential verification exposes only
the student's full name, composed from given name and surname; it exposes
neither email nor matriculation number.

Existing credential snapshots remain immutable. Identity-bearing snapshots move
to a new version rather than changing the meaning of previously issued
credentials.

Version-one credentials retain the normalized accepted invitation email and
its invitation provenance. A private version-two credential instead uses the
participant's current normalized edu-ID email together with the course-scoped
edu-ID claims; it never relabels an invitation email as edu-ID-sourced. If that
email is unavailable or invalid, version-two issuance fails closed rather than
falling back across identity sources.

The feature does not persist the approved affiliation claims in the
assessment-participation identity because no assessment consumer needs them;
the existing account and affiliation flows continue to own those values.

## Consequences

- Ordinary-course users do not acquire assessment-only identity data.
- A bearer verification link does not disclose the direct identifiers needed
  for grade matching.
- Export consumers must distinguish edu-ID values from invitation-roster values
  and handle missing or conflicting data explicitly.
- The assessment login and credential flows need a versioned migration path;
  existing version-one credentials remain verifiable.
