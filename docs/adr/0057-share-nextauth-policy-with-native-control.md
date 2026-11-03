---
status: accepted
concepts:
  - lecturer-authentication
  - native-control
---

# Share NextAuth session policy with native Control

## Decision

Keep NextAuth v4 as the owner of lecturer sign-in and browser sessions. Reuse
its existing application JWT signer, explicit expiry policy and current-account
validation for bundled Control. Replace the persistent native Redis session
registry with a fixed **30-day signed credential** in device-only secure storage.
This supersedes [ADR 0056](0056-control-native-session-contract.md).

NextAuth's custom unsalted encoder applies the effective `maxAge` on every
issuance and reissue, including payloads with an old `exp`. Legacy browser tokens
remain decodable until their ordinary reissue; there is no forced global logout.
Salt-bearing temporary OAuth state, nonce and PKCE cookies continue through the
library's salt-bound encoder/decoder. Participant/assessment audience selection
and existing delegated providers remain unchanged.

## Minimal native adapter

The external authentication browser and Capacitor WebView have separate cookie
stores. Keep the existing short-lived proof-bound handoff: start, bind, approve,
exchange and cancel. Redis retains only five-minute transaction/rate-limit state
and a one-minute one-use code; it is no longer an app-session store. Exchange
validates current identity and atomically consumes the transaction. Concurrent
requests issue at most one response. The redirect contains only code and state.
No signed app credential or upstream IdP credential enters a redirect URL.

With no browser evidence, completion redirects directly to lecturer login. An
ineligible existing browser account retains the explicit sign-out/account-switch
path so it cannot loop between login and completion. Fresh successful lecturer
sign-in binds the signed browser JWT to the exact native transaction, host-only
browser secret and authenticated account using an HMAC. Capture the library's
validated return destination; session reads/reissue never create this proof.
The existing five-minute transaction deadline bounds its use. Matching completion
automatically submits the same-origin CSRF-checked form once. A reused browser
session retains explicit account confirmation and account switching. Terms and
the current ephemeral browser mode remain; the login page names the Control app
before provider choice. No credential or browser binding enters a redirect URL.

The exchange adapter signs a restricted projection with `role: USER`, at most
`SESSION_EXEC` or `READ_ONLY`, current identity provenance, `purpose:
lecturer-control`, `aud: control-graphql`, the configured auth issuer and explicit
`iat`/`exp`. It uses the shared JWT helper, with a server-selected signing key
HMAC-derived from APP_SECRET under a native label. Existing generic web consumers
cannot accept that signature even if they do not validate an audience. The
native header type is only a routing hint; signature and claims are mandatory.

The API accepts these credentials only on the main GraphQL transport from the
allowlisted Capacitor origins and rejects them in assessment mode. Native
requests cannot fall back to cookies. Every request checks current lecturer
role, verified institutional identity or delegated login/password digest, and
the lowest issued/current scope. Current catalyst flags come from the database.
No persistent session lookup or Redis client exists in native API authentication.

## Persistence, expiry and logout

Keep Keychain/Keystore storage, reinstall clearing and no cloud synchronization.
Persist only the app credential and expiration metadata. A client-side shape
check is not signature verification; the server remains authoritative. Reopen
restores the credential until its fixed 30-day deadline. Timer rearming respects
platform timeout limits, and cold restore independently checks expiry.

No refresh endpoint or silent rolling native renewal is provided. NextAuth's
`getToken` can read bearer input but its normal session endpoint renews cookies;
it is not a native token issuer or renewal grant. At native expiry, sign in
again through the system browser. Fixed lifetime also bounds unchecked upstream
institutional affiliation freshness; local account checks do not establish
immediate upstream deprovisioning.

Logout clears local secure storage and local application state, including when
offline. A storage failure is reported. It cannot invalidate a copied JWT;
remaining validity is bounded by expiry and current identity checks. There is
no revoke endpoint, per-device registry, native-only epoch or global logout side
effect. Account-wide revocation could later extend shared policy with a
session-version field; per-device revocation requires server state.

The cancel response acknowledges transaction cleanup only and makes no claim
that an already issued credential was revoked. Cancellation before the atomic
exchange prevents issuance. Cancellation after
issuance cannot revoke the JWT; the app discards a late response and never
activates or saves it. Unconfirmed transaction cleanup is reported truthfully.
Secure-storage failure discards the response and leaves the app signed out.
Do not retry an exchange or replay an uncertain lecture mutation automatically.

## Migration and verification

Remove the old opaque token format, session record/digest lookup, Redis session
writes, revoke endpoint and client revocation warnings entirely. Keep no dual
issuer or compatibility fallback. Existing opaque records expire under their
previous short TTL; no database or broad Redis deletion is needed. Pilot app
binaries must be updated and signed in once; record expiry does not update
bundled JavaScript. Coordinate before updating a shared issuer. Qualify the new auth and backend together
in one controlled release window, update every pilot binary, and reauthenticate
once; independently deploying either side with the old counterpart interrupts
native login. No such deployment is part of this source change.

Verify shared web expiry/reissue and legacy decode; salt/audience separation;
proof binding, code expiry, cancellation and one-use concurrency; signing-key
isolation, native claim limits and no fallback; current account/scope changes;
next-day restoration, timeout overflow, local offline logout and storage failure.
Browser verification covers web login and eligible/ineligible completion paths.
Installed Simulator and physical-device checks remain separately identified.

Public deployment, institutional identity qualification, privacy-controller
publication, supported-build windows and signed store distribution remain
separate gates. Longer authentication does not itself establish store approval.
