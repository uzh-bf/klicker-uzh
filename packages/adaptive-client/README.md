# Adaptive service client

Public, server-only transport for the private adaptive calculation service.
This package contains versioned JSON schemas and an authenticated HTTP client;
it contains no IRT estimator and has no private workspace dependency.

The host start, advance and time-limit paths use this client. Reporting and
calibration extraction are still in progress; the integration PR is not ready
to merge based on the client tests alone.

The caller supplies an environment-derived base URL and token to
`createAdaptiveClient`, authorizes the activity/attempt, grades each response,
and constructs a strictly validated numeric snapshot. `decide` returns validated
estimates and the next item ID. It rejects raw content and unexpected fields,
invalid references, repeated next items and incompatible versions. It times out
and fails closed if the service is unavailable. It does not retry or use a local
estimator; the caller owns transaction and idempotency handling.

Requests retain the existing attempt UUID as an opaque routing seed so tie
breaking stays stable. Scale infinities are represented as null outer bounds.
Maps and sets use explicit JSON arrays. The contract schemas are mirrored in
Catalyst's `apps/adaptive-engine`; synchronize them and verify transport parity
when changing the versioned contract.

`posteriors` sends an IRT V2 EAP calibration/reporting batch to
`POST /adaptive/v1/posteriors`. It accepts at most 32 request-local numeric
subject IDs, 1,000 scored responses per subject, and 8,000 scored responses in
total. Subject records must not contain a participant identifier, name,
pseudonym, or strata. Each response carries only the calibrated numeric item
parameters (`a`, `b`, `c`) and the scored correctness value. The response is a
compact posterior summary and one normalized probability per scale band.

`estimates` sends a strict terminal runtime snapshot to
`POST /adaptive/v1/estimates` for retrospective and shadow computation. Its
required `terminalReason` is independent of selection and it returns estimates
only. `validate` sends the same raw runtime snapshot with a required empty
response ledger to `POST /adaptive/v1/validate`; it proves that the engine can
prepare the IRT V1 or V2 runtime without exposing private derived structures.

Run `pnpm --filter @klicker-uzh/adaptive-client test` to exercise request privacy,
response validation, safe errors and stream size limits. These tests require no
private repository, database, or imported test questions.
