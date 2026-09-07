---
module: participant-authentication
date: 2026-09-07
problem_type: integration
severity: medium
symptoms:
  - "Course-to-chatbot navigation returns to login despite a participant session"
root_cause: The LTI cookie outlived its JWT and took precedence over the participant session
tags: [authentication, lti, cookies, pwa]
---

# Stale LTI cookies can cause a participant login loop

## Problem

A participant can open a course yet return to login when opening its chatbot.
Direct chatbot access can still work. This combination does not by itself
indicate missing course access.

## Cause and solution

The PWA checks pending LTI state before accepting an existing participant session
in [getParticipantToken](../../../apps/frontend-pwa/src/lib/getParticipantToken.ts).
The LTI JWT expires after five minutes, but its cookie previously lasted for the
browser session. An expired cookie therefore continued selecting a failed LTI
authentication path after normal login.

Successful authentication now consumes the cookie in the shared participant
login helper in [accounts.ts](../../../packages/graphql/src/services/accounts.ts).
Failed authentication leaves it unchanged. The
[LTI service](../../../apps/lti/src/index.ts) also gives newly issued cookies a
five-minute lifetime and an explicit root path. The
[password form](../../../apps/frontend-pwa/src/pages/login.tsx) awaits navigation
and settles its submitting state even when navigation fails or is cancelled.

Keep identity selection fail-closed: a valid pending LTI identity takes
precedence, and invalid LTI state must not silently select another signed-in
participant. Cookie cleanup belongs after successful authentication.

## Verification lessons

Model the old cookie as a shared-domain session cookie containing an expired
JWT. A host-only fixture does not reach the PWA host and cannot reproduce the
failure. Normal login alone is insufficient evidence: check that failed login
preserves the cookie, successful login deletes the same domain/path scope, and
the course bridge reaches the chatbot origin afterward.

Focused authentication tests cover cookie effects for successful and rejected
login paths. Local browser checks covered stale-cookie recovery, same-page
return, and cancelled or rejected navigation. These checks do not establish
production deployment or verify a chatbot answer.
