---
type: Decision
title: Regular participant session recovery
description: Fresh participant identity takes precedence over retained browser credentials within the existing regular PWA audience.
timestamp: '2026-10-06'
status: accepted
tags:
  - auth
  - integration
---

# Explicit participant identity supersedes ambient session state

A verified OLAT login can coexist with an expired cookie or a previous
participant's browser bearer. Selecting ambient credentials first prevents the
fresh login from taking effect and can restore the wrong account. Within the
existing regular PWA audience, use a verified explicit participant session
before cookies and bind a client/cache to that identity before child queries.
Only explicit credentials (an LTI exchange or LTI-backed account creation) are
kept in the tab; ambient cookie sessions are never copied into its persistent
credential store. Logout affects subsequent requests in cookie-authenticated
tabs, without immediately clearing their rendered data. Another tab holding
an explicit credential continues as its launched participant. Ordinary login
in that same tab clears the explicit credential and returns it to cookie mode.
Logout is local credential cleanup, not server-side JWT revocation.
A URL never carries a participant session token. Retire the client of an ended
identity, reject further transport work and retries, and ignore its late
responses. Already-dispatched server work cannot be undone. Invalid explicit
credentials fail closed; scoped OTP/activation credentials must undergo their own exchange.
Because participant cookies are SameSite=None and CORS reflects any origin,
only an origin inside the cookie domain may select or receive them. Manage and
control cookies stay SameSite=Lax. Assessment and other origin audiences retain their
existing credential selection and authorization.

Keep the established cookie name/domain/path and bound registered retention by
the signed session. Expire known legacy partitioned state in the current
partition before canonical issuance. A browser-only memory fallback supports
the current document when storage is denied; it cannot provide identity after
a credential-free reload. Provide relaunch recovery for that boundary.

The Header chatbot action must not send an explicitly authenticated tab to a
server-rendered bridge that may select a different cookie identity. Show
recovery guidance without navigation or prefetch whenever that tab holds an
explicit credential. Offer ordinary login in the same tab; a fresh LTI launch
recovers the PWA but does not unlock this action. This deliberately withholds
the link even when a cookie might match. Cookie-mode entry retains its new-tab
behavior. A directly opened bridge still authenticates its own request and
cannot infer another tab's identity. No new token transfer to Chat is added.

HttpOnly protects the cookie, not a JWT separately exposed to JavaScript.
Explicit credentials remain readable in memory/sessionStorage; pre-existing
ambient JWT page props also remain readable. Ordinary password, magic-link
and activation login still depend on cookies, and manual registration returns
no participant-session JWT.

Longer launch-token lifetimes would hide stale state and increase credential
exposure. A session token in a URL would let any participant link another into
their own account. Falling back to another credential after explicit
failure risks an unintended account switch. Browser protection changes remain
a diagnostic possibility, not a required product workaround established by the
reported screenshots. See [Auth Model](../auth-model.md) for the resulting
contract and evidence limits.
