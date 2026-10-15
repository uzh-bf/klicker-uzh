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
Separate browser profiles remain separate contexts. An embedded LMS frame
whose browser refuses the shared cookie cannot join that login, so it keeps a
frame session instead (see below). The boundary covers every
regular PWA page, including anonymous entry points: its shared layout and queries
can discover a participant cookie. In Chat, it wraps authenticated chatbot content
after the server access checks. Public login and error pages contain no participant
data and render outside the boundary, preserving their HTTP status. Server HTML
renders normally, because it reflects the cookies of the request that produced
it; the boundary applies its browser-side checks once the page has mounted.
Server-fetched data remains available for hydration only when its session
revision still matches and the document has no frame session.

The `participant_session` cookie contains a random, non-secret revision with the
credential's domain, path, security policy and lifetime. Login, logout and
successful account deletion replace it. Clients bind their rendered state to
that revision, check before requests and after responses, and discard/reload
stale state on change. Focus, interaction and periodic checks synchronize idle
tabs across app origins. Browser requests send `x-participant-session`; APIs
reject mismatches with HTTP 409 before executing work under another identity.
The revision is not an authentication credential. Existing sessions without a
revision use an empty binding until their next session transition.

## Frame sessions

KlickerUZH has always worked inside LMS frames whose browser blocks
third-party cookies, such as Safari and Firefox by default. Such a frame keeps
its own participant session: the LTI exchange or LTI account creation hands the
token to that frame only, the tab stores it in sessionStorage, and requests send
it as a bearer. The identity stays fixed for the tab until the next launch, so
the shared revision neither confirms nor invalidates it, and logout or deletion
ends it. The backend accepts such a bearer only when no participant cookie is
present and only for a plain participant token, so it can never replace a
shared login. The token reaches server props only for requests that may be
framed, never for a top-level document, and never travels in a URL. A frame
joins the shared login instead once it has unpartitioned cookie access and the
shared cookie holds the session its launch created. Cookie access alone is not
enough, because a browser can grant it and still refuse a cross-site cookie.

LTI exchange and account creation outside an LMS frame must confirm cookie
acceptance. A refused cookie leads to recovery outside the LMS frame, never a
memory-only login or silent use of the former participant. Recovery preserves
an LTI launch URL for opening in a top-level tab, where it replaces the shared
login. Once the
replacement cookies are accepted, the landing URL drops the consumed handoff
without another exchange; refresh then uses the shared cookie session. The Chat link
opens normally; its bridge
checks course membership and confirms any newly exchanged session before
navigation. Invalid launches and unavailable exchanges block their protected
view but leave the existing session untouched, because any site can make a
browser load a forged launch. Only page navigations count as launches.
Rejected logout/deletion retain the current session and offer feedback.

The last completed cookie-changing response determines the browser session.
Already-dispatched server work and Set-Cookie responses cannot be undone by
ignoring a late JavaScript result. Logout is cookie cleanup and client-state
invalidation, not global JWT revocation. Lost responses can leave an uncertain
server outcome; clients observe the resulting revision when it is available.

Regular PWA browser requests authenticate from cookies, or from a frame
session when no participant cookie is present. Server-side and
non-browser bearer callers and the separate assessment/lecturer contracts
remain supported. Assessment fallback is not a retained regular-session mode.
Participant cookies and Chat API origin checks require a configured COOKIE_DOMAIN;
the Chat ConfigMap uses the same backendGraphql.cookieDomain value as GraphQL.
SameSite=None does not authorize foreign-origin cookie selection or issuance.
Current-partition cookie cleanup does not claim to clear every browser partition.

This decision replaces the earlier tab-isolation policy and Chat login gate.
Their implementation is removed; prior rationale remains in Git history.
