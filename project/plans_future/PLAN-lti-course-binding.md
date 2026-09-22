# LTI Course Binding Follow-Up Plan

## Summary

The current LTI handoff proves the identity of the launched LTI user, but it does
not cryptographically bind that launch to a specific Klicker course. The
requested Klicker course is passed separately by URL or GraphQL arguments.

This is a valid security hardening concern, but it should be handled as a
separate contract change. The Student PWA already relies on the current shape,
so changing it inside the iframe-auth / CHIPS rollout would risk breaking the
critical student app.

## Current Behavior

`apps/lti` verifies the LMS launch and signs an internal JWT containing:

- `sub`
- `email`
- `scope`

It does not include a Klicker `courseId`, LTI context id, deployment id, or
platform binding.

Consumers then pass the target course separately:

- PWA: `loginParticipantWithLti(signedLtiData, courseId)` in GraphQL.
- Chat: `/auth/lti?jwt=...&courseId=...&chatbotId=...`.

Chat additionally verifies that `chatbot.courseId === courseId`, which prevents
mixing a chatbot with the wrong course id. It does not prove that the LTI launch
itself was intended for that course.

## Risk

A valid short-lived LTI handoff JWT for one launch could be replayed against a
different known Klicker `(courseId, chatbotId)` pair while the token is still
valid. In the chat guest path, that can create or reuse a guest participant for
the requested course.

This is not a new PWA business-logic change introduced by the CHIPS rollout. It
is an existing shape shared by the LTI handoff model and the PWA GraphQL login
flow.

## Non-Goals For The Current PR

- Do not change the PWA LTI login contract inside the CHIPS / iframe-auth PR.
- Do not require a new signed claim without first validating existing LMS launch
  data across deployments.
- Do not block student PWA launches while the proper binding model is designed.
- Do not treat the redirect URL alone as the final authority for course access.

## Target Design

The robust model should bind a verified LTI launch context to a Klicker course,
then require consumers to prove that binding before creating participation.

Possible binding inputs:

- LTI platform issuer.
- LTI deployment id.
- LTI context id.
- LTI resource link id.
- Klicker course id configured in the launch target or LMS placement.

The final verifier should answer:

> Is this verified LTI launch allowed to create or access participation for this
> Klicker course?

## Proposed Phases

### Phase 1: Discovery

- Inspect real LTI launch payloads from OpenOLAT and any other supported LMS.
- Identify stable claims for course/context binding.
- Document which claims are present for LTI 1.1 and LTI 1.3 launches.
- Confirm whether existing LMS placements encode a Klicker course id, resource
  link id, or external context id.

### Phase 2: Data Model

- Decide where the mapping lives:
  - LMS platform/deployment/context to Klicker course, or
  - LMS placement/resource link to Klicker course.
- Add the minimal database shape needed for that mapping.
- Define migration behavior for existing deployments and launches.

### Phase 3: Token Contract

- Extend `apps/lti` to include the selected binding claims in the internal
  handoff JWT.
- Keep a temporary compatibility path for existing PWA launches if needed.
- Add issuer/audience/expiry validation consistently across PWA, GraphQL, and
  chat.

### Phase 4: Consumer Enforcement

- PWA GraphQL `loginParticipantWithLti` verifies the signed launch binding
  before creating participation for `courseId`.
- Chat `/auth/lti` verifies the same binding before resolving account or guest
  access.
- Any future LTI-consuming app uses the same shared verifier.

### Phase 5: Rollout And Removal

- Deploy in observe-only mode first: log missing or mismatched binding data
  without blocking launches.
- Enable enforcement for chat first, because it is less critical than the PWA.
- Enable enforcement for PWA only after staging and real LMS smoke tests pass.
- Remove compatibility paths after existing LMS placements are confirmed.

## Validation Requirements

- Unit tests for accepted and rejected binding combinations.
- Integration tests for PWA `loginParticipantWithLti`.
- Integration tests for chat `/auth/lti`.
- Browser smoke test of PWA LTI launch in the real local/staging routing setup.
- Regression check that normal student course join, login, quiz, and practice
  flows still work without an LMS launch.

## PR Guidance

Treat this as a dedicated security/design PR, not a cleanup inside the current
iframe-auth branch. The PR description should explicitly state whether it is
observe-only or enforcement mode, and it should include the PWA verification
evidence before merge.
