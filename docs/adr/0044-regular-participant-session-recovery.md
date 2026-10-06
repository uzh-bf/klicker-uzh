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
before cookies and bind a private client/cache to that identity before child
queries. Persist the projected session and retire the prior client only after
React commits; abandoned renders must not change retained identity. Scope
requests and session-changing responses to the originating client generation.
Invalid explicit credentials fail closed; scoped OTP/activation credentials
must undergo their own exchange. Assessment and other origin audiences retain
their existing credential selection and authorization.

Keep the established cookie name/domain/path and bound registered retention by
the signed session. Expire known legacy partitioned state in the current
partition before canonical issuance. A browser-only memory fallback supports
the current document when storage is denied; it cannot provide identity after
a credential-free reload. Provide relaunch recovery for that boundary.

Longer launch-token lifetimes would hide stale state and increase credential
exposure. Removing a bearer merely because a cookie exists confuses cookie
presence with identity proof. Falling back to another credential after explicit
failure risks an unintended account switch. Browser protection changes remain
a diagnostic possibility, not a required product workaround established by the
reported screenshots. See [Auth Model](../auth-model.md) for the resulting
contract and evidence limits.
