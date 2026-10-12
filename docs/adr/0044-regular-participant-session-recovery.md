---
type: Decision
title: Regular participant session recovery
description: A successful LTI or ordinary login replaces the shared regular participant session across PWA and Chat tabs.
timestamp: '2026-10-06'
status: accepted
tags:
  - auth
  - integration
---

# One shared regular participant login

A successful LTI launch replaces the regular participant login for the browser
cookie context. Ordinary login follows the same rule. PWA and Chat tabs use the
shared HttpOnly credential rather than keeping independent participant tokens.
Separate browser profiles remain separate contexts. Embedded pages must confirm
unpartitioned cookie access before mounting authenticated UI; a partitioned
LMS login cannot coexist as another usable identity.

The `participant_session` cookie contains a random, non-secret revision with the
credential's domain, path, security policy and lifetime. Login, logout and
successful account deletion replace it. Clients bind their rendered state to
that revision, check before requests and after responses, and discard/reload
stale state on change. Focus, interaction and periodic checks synchronize idle
tabs across app origins. Browser requests send `x-participant-session`; APIs
reject mismatches with HTTP 409 before executing work under another identity.
The revision is not an authentication credential. Existing sessions without a
revision use an empty binding until their next session transition.

LTI exchange and account creation must confirm cookie acceptance. A refused
cookie or partition-only access leads to recovery outside the LMS frame, never a memory-only login or
silent use of the former participant. Recovery preserves an LTI launch URL for
opening in a top-level tab, where it replaces the shared login. The Chat link
opens normally; its bridge
checks course membership and confirms any newly exchanged session before
navigation. Invalid launches block their protected view and clear the regular
session. Rejected logout/deletion retain the current session and offer feedback.

The last completed cookie-changing response determines the browser session.
Already-dispatched server work and Set-Cookie responses cannot be undone by
ignoring a late JavaScript result. Logout is cookie cleanup and client-state
invalidation, not global JWT revocation. Lost responses can leave an uncertain
server outcome; clients observe the resulting revision when it is available.

Regular PWA browser requests authenticate only from cookies. Server-side and
non-browser bearer callers and the separate assessment/lecturer contracts
remain supported. Assessment fallback is not a retained regular-session mode.
Participant cookies require a configured COOKIE_DOMAIN and origin checks;
SameSite=None does not authorize foreign-origin cookie selection or issuance.
Current-partition cookie cleanup does not claim to clear every browser partition.

This decision replaces the earlier tab-isolation policy and Chat login gate.
Their implementation is removed; prior rationale remains in Git history.
